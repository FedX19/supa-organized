import { NextRequest, NextResponse } from 'next/server'
import { buildDualAnalytics, isValidTimeZone } from '@/lib/attribution/analytics'
import {
  AttributionAuthError,
  requireAttributionAccess,
} from '@/lib/attribution/auth'
import type { AttributionEvent } from '@/lib/attribution/types'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { syncEventsFromUnite } from '@/lib/attribution/sync-from-unite'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SELECT_FULL =
  'id, workspace_id, created_at, property, event_type, path, source, medium, campaign, content, term, referrer, landing_url, session_id, device, source_label, timezone, locale, country, region, city, is_bot, meta'

const SELECT_LEGACY =
  'id, workspace_id, created_at, property, event_type, path, source, medium, campaign, content, referrer, landing_url, session_id, device, source_label, timezone, locale, country, region, city'

function asEvents(rows: unknown): AttributionEvent[] {
  return (Array.isArray(rows) ? rows : []) as AttributionEvent[]
}

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
    const take = Math.min(Math.max(limit, 1), 1000)

    const admin = createSupabaseAdminClient()
    let query = admin
      .from('attribution_events')
      .select(SELECT_FULL)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(take)

    if (!includeBots) query = query.eq('is_bot', false)

    const full = await query
    let events: AttributionEvent[] = asEvents(full.data)

    if (full.error) {
      console.warn('[attribution/summary] full select failed, legacy fallback', full.error.message)
      const legacy = await admin
        .from('attribution_events')
        .select(SELECT_LEGACY)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(take)
      if (legacy.error) {
        return NextResponse.json(
          { ok: false, error: legacy.error.message, migrationRequired: true },
          { status: 503 }
        )
      }
      events = asEvents(legacy.data).map((row) => ({
        ...row,
        term: row.term ?? null,
        is_bot: row.is_bot ?? false,
        meta: row.meta ?? {},
      }))
    }

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
