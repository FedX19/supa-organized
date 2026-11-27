import { NextRequest, NextResponse } from 'next/server'
import {
  AttributionAuthError,
  requireAttributionAccess,
} from '@/lib/attribution/auth'
import { aggregateOrgs, codeForOrg, normalizeCampaignCode, normalizeOrgType, orgOutreachUrl } from '@/lib/attribution/orgs'
import type { AttributionEvent } from '@/lib/attribution/types'
import type { OutreachOrg } from '@/lib/attribution/orgs'
import { createSupabaseAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SELECT =
  'id, created_at, property, event_type, path, campaign, landing_url, session_id, is_bot, meta'

function missingOrgsTable(message: string): boolean {
  return /attribution_orgs/i.test(message) && /does not exist|schema cache|could not find/i.test(message)
}

async function allow(request: NextRequest): Promise<{ workspaceId: string }> {
  const secret = process.env.MDC_TRACK_FORWARD_SECRET
  const got = request.headers.get('x-mdc-forward-secret')
  if (secret && got && got === secret) {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from('attribution_workspaces')
      .select('id')
      .eq('slug', 'mdc')
      .maybeSingle()
    if (error || !data?.id) {
      throw new AttributionAuthError('Attribution workspace not configured — run supabase/migrations', 503)
    }
    return { workspaceId: data.id as string }
  }
  const access = await requireAttributionAccess(request)
  return { workspaceId: access.workspaceId }
}

async function loadRegistry(workspaceId: string): Promise<{ orgs: OutreachOrg[]; migrationRequired: boolean }> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('attribution_orgs')
    .select('code, name, org_type, email, batch_date, campaign, path, created_at')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true })
    .limit(1000)
  if (error) {
    if (missingOrgsTable(error.message)) return { orgs: [], migrationRequired: true }
    throw new Error(error.message)
  }
  const orgs: OutreachOrg[] = (data || []).map((row) => ({
    code: String(row.code),
    name: String(row.name),
    org_type: normalizeOrgType(row.org_type),
    email: row.email ? String(row.email) : null,
    batch_date: row.batch_date ? String(row.batch_date).slice(0, 10) : null,
    campaign: row.campaign ? String(row.campaign) : null,
    path: row.path ? String(row.path) : '/leagues',
    created_at: row.created_at ? String(row.created_at) : undefined,
  }))
  return { orgs, migrationRequired: false }
}

async function loadEvents(workspaceId: string, includeBots: boolean): Promise<AttributionEvent[]> {
  const admin = createSupabaseAdminClient()
  const since = new Date(Date.now() - 90 * 24 * 3600_000).toISOString()
  const events: AttributionEvent[] = []
  for (let offset = 0; offset < 5000; offset += 1000) {
    let query = admin
      .from('attribution_events')
      .select(SELECT)
      .eq('workspace_id', workspaceId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .range(offset, offset + 999)
    if (!includeBots) query = query.eq('is_bot', false)
    const page = await query
    if (page.error) throw new Error(page.error.message)
    const rows = (page.data || []) as AttributionEvent[]
    events.push(...rows)
    if (rows.length < 1000) break
  }
  return events
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireAttributionAccess(request)
    const includeBots = request.nextUrl.searchParams.get('include_bots') === '1'
    const [registry, events] = await Promise.all([
      loadRegistry(workspaceId),
      loadEvents(workspaceId, includeBots),
    ])
    const rows = aggregateOrgs(events, registry.orgs).map((row) => ({
      ...row,
      url: row.campaign ? orgOutreachUrl(row.code, row.campaign, row.path) : null,
    }))
    const emailed = rows.filter((r) => r.in_registry).length
    const visited = rows.filter((r) => r.visited).length
    return NextResponse.json({
      ok: true,
      includeBots,
      migrationRequired: registry.migrationRequired,
      emailed,
      visited,
      rows,
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

type MintBody = {
  orgs?: Array<{
    name?: string
    type?: string
    email?: string
    batch_date?: string
    campaign?: string
    path?: string
    code?: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await allow(request)
    let body: MintBody
    try {
      body = (await request.json()) as MintBody
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
    }
    const incoming = Array.isArray(body.orgs) ? body.orgs.slice(0, 200) : []
    if (!incoming.length) {
      return NextResponse.json({ ok: false, error: 'orgs required' }, { status: 400 })
    }

    const rows = []
    const links = []
    for (const org of incoming) {
      const name = (org.name || '').trim().slice(0, 120)
      if (!name) return NextResponse.json({ ok: false, error: 'each org needs a name' }, { status: 400 })
      const orgType = normalizeOrgType(org.type)
      const campaign = normalizeCampaignCode(org.campaign)
      if (!campaign) {
        return NextResponse.json({ ok: false, error: `campaign slug required for ${name}` }, { status: 400 })
      }
      let code: string
      try {
        code = codeForOrg(orgType, name, org.code)
      } catch {
        return NextResponse.json({ ok: false, error: `invalid code for ${name}` }, { status: 400 })
      }
      const path = (org.path || '/leagues').trim().slice(0, 200)
      const safePath = path.startsWith('/') ? path : `/${path}`
      const email = (org.email || '').trim().toLowerCase().slice(0, 160)
      if (email && (email.includes(' ') || !email.includes('@'))) {
        return NextResponse.json({ ok: false, error: `email looks wrong for ${name}` }, { status: 400 })
      }
      let storedPath = '/leagues'
      try {
        const draft = new URL(safePath, 'https://www.modern-day-coach.com')
        draft.searchParams.delete('o')
        draft.searchParams.delete('c')
        storedPath = `${draft.pathname}${draft.search}`.slice(0, 200)
      } catch {
        storedPath = '/leagues'
      }
      const url = orgOutreachUrl(code, campaign, storedPath)
      if (email && url.toLowerCase().includes(email)) {
        return NextResponse.json({ ok: false, error: 'refusing to put an email in the link' }, { status: 400 })
      }
      const batch = (org.batch_date || '').trim()
      const batchDate = /^\d{4}-\d{2}-\d{2}$/.test(batch) ? batch : null
      rows.push({
        workspace_id: workspaceId,
        code,
        name,
        org_type: orgType,
        email: email || null,
        batch_date: batchDate,
        campaign,
        path: storedPath,
      })
      links.push({ code, name, type: orgType, email: email || null, campaign, url })
    }

    const admin = createSupabaseAdminClient()
    const { error } = await admin.from('attribution_orgs').upsert(rows, { onConflict: 'workspace_id,code' })
    if (error) {
      if (missingOrgsTable(error.message)) {
        return NextResponse.json(
          {
            ok: false,
            migrationRequired: true,
            error: 'Run supabase/migrations/20261127180000_outreach_orgs.sql in the SupaOrganized SQL editor',
            links,
          },
          { status: 503 }
        )
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, upserted: rows.length, links })
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
