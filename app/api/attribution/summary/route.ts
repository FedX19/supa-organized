import { NextRequest, NextResponse } from 'next/server'
import { buildDualAnalytics } from '@/lib/attribution/analytics'
import {
  AttributionAuthError,
  requireAttributionAccess,
} from '@/lib/attribution/auth'
import { listAttributionEvents } from '@/lib/attribution/events'
import { createSupabaseAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireAttributionAccess(request)
    const hoursRaw = request.nextUrl.searchParams.get('hours')
    const hours = hoursRaw ? Number(hoursRaw) : 24 * 30
    const limitRaw = request.nextUrl.searchParams.get('limit')
    const limit = limitRaw ? Number(limitRaw) : 500

    // Use admin scoped by workspace (already authorized)
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from('attribution_events')
      .select(
        'id, workspace_id, created_at, property, event_type, path, source, medium, campaign, content, referrer, landing_url, session_id, device, source_label, timezone, locale, country, region, city'
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 1000))

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, migrationRequired: true },
        { status: 503 }
      )
    }

    const events = data ?? []
    const analytics = buildDualAnalytics(events, {
      hours: Number.isFinite(hours) ? hours : 24 * 30,
    })

    return NextResponse.json({
      ok: true,
      workspaceId,
      eventCount: events.length,
      analytics,
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
