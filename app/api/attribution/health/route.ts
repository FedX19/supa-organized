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
    const admin = createSupabaseAdminClient()
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()

    const { count: last24h, error: cErr } = await admin
      .from('attribution_events')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', since)

    const { data: latest, error: lErr } = await admin
      .from('attribution_events')
      .select('id, created_at, property, event_type, path')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cErr || lErr) {
      return NextResponse.json(
        {
          ok: false,
          migrationRequired: true,
          error: cErr?.message || lErr?.message,
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      ok: true,
      workspaceId,
      last24h: last24h ?? 0,
      latest: latest ?? null,
      collectPath: '/api/public/mdc-track',
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
