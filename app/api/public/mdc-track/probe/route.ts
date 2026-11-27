import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { getDefaultWorkspaceId } from '@/lib/attribution/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROBE_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
]

function allowedCampaign(campaign: string): boolean {
  return campaign === 'agent-wiring-probe' || campaign.startsWith('mdc-test-')
}

/**
 * Read or delete only synthetic test campaigns. Real outreach campaigns are untouched.
 */
export async function POST(request: NextRequest) {
  let body: { op?: string; campaign?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }
  const campaign = typeof body.campaign === 'string' ? body.campaign.trim() : ''
  if (!allowedCampaign(campaign)) {
    return NextResponse.json({ ok: false, error: 'campaign not allowed' }, { status: 400 })
  }
  const workspaceId = await getDefaultWorkspaceId()
  if (!workspaceId) {
    return NextResponse.json({ ok: false, error: 'workspace missing' }, { status: 503 })
  }
  const admin = createSupabaseAdminClient()

  if (body.op === 'purge') {
    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString()
    const deleted = await admin
      .from('attribution_events')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('campaign', campaign)
      .gte('created_at', since)
      .select('id')
    if (deleted.error) {
      return NextResponse.json({ ok: false, error: deleted.error.message }, { status: 500 })
    }
    let extra = 0
    if (campaign === 'agent-wiring-probe') {
      const byId = await admin
        .from('attribution_events')
        .delete()
        .in('id', PROBE_IDS)
        .select('id')
      if (!byId.error) extra = byId.data?.length ?? 0
    }
    return NextResponse.json({
      ok: true,
      deleted: (deleted.data?.length ?? 0) + extra,
    })
  }

  if (body.op === 'status') {
    const humans = await admin
      .from('attribution_events')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('campaign', campaign)
      .eq('is_bot', false)
    const bots = await admin
      .from('attribution_events')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('campaign', campaign)
      .eq('is_bot', true)
    const latest = await admin
      .from('attribution_events')
      .select('id, created_at, path, event_type, is_bot, meta')
      .eq('workspace_id', workspaceId)
      .eq('campaign', campaign)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (humans.error || bots.error || latest.error) {
      return NextResponse.json(
        { ok: false, error: humans.error?.message || bots.error?.message || latest.error?.message },
        { status: 500 }
      )
    }
    const meta = (latest.data?.meta || {}) as {
      org_code?: string
      ua_class?: string
      actor?: string
      asn_seen?: boolean
    }
    return NextResponse.json({
      ok: true,
      campaign,
      humans: humans.count ?? 0,
      bots: bots.count ?? 0,
      latest: latest.data
        ? {
            id: latest.data.id,
            created_at: latest.data.created_at,
            path: latest.data.path,
            event_type: latest.data.event_type,
            is_bot: latest.data.is_bot,
            org_code: meta.org_code || null,
            ua_class: meta.ua_class || null,
            actor: meta.actor || null,
            asn_seen: Boolean(meta.asn_seen),
          }
        : null,
    })
  }

  return NextResponse.json({ ok: false, error: 'op must be status or purge' }, { status: 400 })
}
