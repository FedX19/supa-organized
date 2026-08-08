import { NextRequest, NextResponse } from 'next/server'
import {
  AttributionAuthError,
  requireAttributionAccess,
} from '@/lib/attribution/auth'
import { createSupabaseAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireAttributionAccess(request)
    const limitRaw = request.nextUrl.searchParams.get('limit')
    const property = request.nextUrl.searchParams.get('property')
    const limit = Math.min(Math.max(Number(limitRaw) || 100, 1), 500)

    const admin = createSupabaseAdminClient()
    let q = admin
      .from('attribution_events')
      .select(
        'id, workspace_id, created_at, property, event_type, path, source, medium, campaign, content, referrer, landing_url, session_id, device, source_label, timezone, locale, country, region, city'
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (property === 'website' || property === 'unite') {
      q = q.eq('property', property)
    }

    const { data, error } = await q
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, migrationRequired: true },
        { status: 503 }
      )
    }

    return NextResponse.json({
      ok: true,
      count: data?.length ?? 0,
      events: data ?? [],
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
