import { NextRequest, NextResponse } from 'next/server'
import { buildDualAnalytics, isValidTimeZone } from '@/lib/attribution/analytics'
import { decorateSources } from '@/lib/attribution/decorate-sources'
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
    const tzRaw = request.nextUrl.searchParams.get('tz')
    const timeZone = tzRaw && isValidTimeZone(tzRaw) ? tzRaw : null
    const includeBots = request.nextUrl.searchParams.get('include_bots') === '1'
    const since = new Date(Date.now() - Math.min(Math.max(Number.isFinite(hours) ? hours : 720, 1), 24 * 90) * 3600_000).toISOString()

    const admin = createSupabaseAdminClient()
    const events: AttributionEvent[] = []
    for (let offset = 0; offset < 100000; offset += 1000) {
      let query = admin.from('attribution_events').select(SELECT_FULL)
        .eq('workspace_id', workspaceId).gte('created_at', since)
        .order('created_at', { ascending: false }).range(offset, offset + 999)
      if (!includeBots) query = query.eq('is_bot', false)
      const page = await query
      if (page.error && offset === 0) {
        // Old installations may need the additive hygiene migration. Do not silently show polluted metrics.
        return NextResponse.json({ ok: false, error: page.error.message, migrationRequired: true }, { status: 503 })
      }
      if (page.error) return NextResponse.json({ ok: false, error: page.error.message }, { status: 503 })
      const rows = asEvents(page.data)
      events.push(...rows)
      if (rows.length < 1000) break
      if (offset === 99000) return NextResponse.json({ ok: false, error: 'Event limit exceeded; use aggregate reporting' }, { status: 503 })
    }

    const analytics = decorateSources(
      buildDualAnalytics(events, {
        hours: Number.isFinite(hours) ? hours : 24 * 30,
        timeZone,
      }),
      events
    )

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
