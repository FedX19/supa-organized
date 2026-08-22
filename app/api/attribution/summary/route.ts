import { NextRequest, NextResponse } from 'next/server'
import { buildDualAnalytics, isValidTimeZone } from '@/lib/attribution/analytics'
import {
  AttributionAuthError,
  requireAttributionAccess,
} from '@/lib/attribution/auth'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { syncEventsFromUnite } from '@/lib/attribution/sync-from-unite'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireAttributionAccess(request)
    const sync = await syncEventsFromUnite(200)

    const hoursRaw = request.nextUrl.searchParams.get('hours')
    const hours = hoursRaw ? Number(hoursRaw) : 24 * 30
    const limitRaw = request.nextUrl.searchParams.get('limit')
    const limit = limitRaw ? Number(limitRaw) : 500
    const tzRaw = request.nextUrl.searchParams.get('tz')
    const timeZone = tzRaw && isValidTimeZone(tzRaw) ? tzRaw : null
    const includeBots = request.nextUrl.searchParams.get('include_bots') === '1'

    const admin = createSupabaseAdminClient()
    const selectFull =
      'id, workspace_id, created_at, property, event_type, path, source, medium, campaign, content, term, referrer, landing_url, session_id, device, source_label, timezone, locale, country, region, city, is_bot, meta'

    let query = admin
      .from('attribution_events')
      .select(selectFull)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 1000))

    if (!includeBots) query = query.eq('is_bot', false)

    let { data, error } = await query

    if (error) {
      console.warn('[attribution/summary] full select failed, legacy fallback', error.message)
      const legacy = await admin
        .from('attribution_events')
        .select(
          'id, workspace_id, created_at, property, event_type, path, source, medium, campaign, content, referrer, landing_url, session_id, device, source_label, timezone, locale, country, region, city'
        )
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 1000))
      if (legacy.error) {
        return NextResponse.json(
          { ok: false, error: legacy.error.message, migrationRequired: true },
          { status: 503 }
        )
      }
      data = legacy.data
    }

    const events = data ?? []
    const analytics = buildDualAnalytics(events, {
      hours: Number.isFinite(hours) ? hours : 24 * 30,
      timeZone,
      includeBots,
    })

    return NextResponse.json({
      ok: true,
      workspaceId,
      eventCount: events.length,
      includeBots,
      analytics,
      timeZone,
      sync,
    })
  } catch (err) {
    if (err instanceof AttributionAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'error' },
      { status: 500 }
    )
  }
}
