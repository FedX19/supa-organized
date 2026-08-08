import { createSupabaseAdminClient } from '@/lib/supabase'
import type { AttributionEvent, AttributionEventInput, AttributionProperty } from './types'

function clip(v: unknown, max = 240): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function asUuid(v?: string | null): string {
  if (v && UUID_RE.test(v)) return v
  return crypto.randomUUID()
}

function asIso(v?: string | null): string {
  if (v) {
    const t = Date.parse(v)
    if (Number.isFinite(t)) return new Date(t).toISOString()
  }
  return new Date().toISOString()
}

export function parseTrackBody(raw: unknown): AttributionEventInput | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  return {
    id: typeof o.id === 'string' ? o.id : undefined,
    created_at: typeof o.created_at === 'string' ? o.created_at : undefined,
    property: typeof o.property === 'string' ? o.property : undefined,
    event_type:
      typeof o.event_type === 'string'
        ? o.event_type
        : typeof o.type === 'string'
          ? o.type
          : undefined,
    path: typeof o.path === 'string' ? o.path : undefined,
    source: typeof o.source === 'string' ? o.source : undefined,
    medium: typeof o.medium === 'string' ? o.medium : undefined,
    campaign: typeof o.campaign === 'string' ? o.campaign : undefined,
    content: typeof o.content === 'string' ? o.content : undefined,
    referrer: typeof o.referrer === 'string' ? o.referrer : undefined,
    landing_url: typeof o.landing_url === 'string' ? o.landing_url : undefined,
    session_id: typeof o.session_id === 'string' ? o.session_id : undefined,
    device: typeof o.device === 'string' ? o.device : undefined,
    source_label: typeof o.source_label === 'string' ? o.source_label : undefined,
    timezone: typeof o.timezone === 'string' ? o.timezone : undefined,
    locale: typeof o.locale === 'string' ? o.locale : undefined,
    country: typeof o.country === 'string' ? o.country : undefined,
    region: typeof o.region === 'string' ? o.region : undefined,
    city: typeof o.city === 'string' ? o.city : undefined,
  }
}

export function geoFromRequest(headers: Headers): {
  country?: string
  region?: string
  city?: string
} {
  const country =
    headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry') || undefined
  const region =
    headers.get('x-vercel-ip-country-region') ||
    headers.get('x-vercel-ip-region') ||
    undefined
  const city = headers.get('x-vercel-ip-city') || undefined
  const decode = (v?: string) => {
    if (!v) return undefined
    try {
      return decodeURIComponent(v.replace(/\+/g, ' '))
    } catch {
      return v
    }
  }
  return {
    country: country && country !== 'XX' ? country : undefined,
    region: decode(region),
    city: decode(city),
  }
}

export async function getDefaultWorkspaceId(): Promise<string | null> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('attribution_workspaces')
    .select('id')
    .eq('slug', 'mdc')
    .maybeSingle()
  if (error || !data?.id) {
    console.warn('[attribution] workspace mdc missing — run migrations', error?.message)
    return null
  }
  return data.id as string
}

export async function insertAttributionEvents(
  inputs: AttributionEventInput[],
  edgeGeo?: { country?: string; region?: string; city?: string }
): Promise<{ accepted: number; ids: string[] }> {
  const workspaceId = await getDefaultWorkspaceId()
  if (!workspaceId) return { accepted: 0, ids: [] }

  const admin = createSupabaseAdminClient()
  const rows = inputs.slice(0, 20).map((input) => {
    const property: AttributionProperty =
      input.property === 'unite' || input.property === 'email' || input.property === 'call'
        ? input.property
        : 'website'
    return {
      id: asUuid(input.id),
      workspace_id: workspaceId,
      created_at: asIso(input.created_at),
      property,
      event_type: clip(input.event_type || input.type, 80) || 'page_view',
      path: clip(input.path, 200),
      source: clip(input.source, 80),
      medium: clip(input.medium, 80),
      campaign: clip(input.campaign, 120),
      content: clip(input.content, 120),
      referrer: clip(input.referrer, 120),
      landing_url: clip(input.landing_url, 400),
      session_id: clip(input.session_id, 80),
      device: clip(input.device, 20),
      source_label: clip(input.source_label, 160),
      timezone: clip(input.timezone, 80),
      locale: clip(input.locale, 40),
      country: clip(edgeGeo?.country || input.country, 8),
      region: clip(edgeGeo?.region || input.region, 80),
      city: clip(edgeGeo?.city || input.city, 80),
    }
  })

  if (rows.length === 0) return { accepted: 0, ids: [] }

  const { data, error } = await admin
    .from('attribution_events')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.warn('[attribution] upsert failed', error.message)
    const { data: ins, error: insErr } = await admin.from('attribution_events').insert(rows).select('id')
    if (insErr) {
      console.warn('[attribution] insert failed', insErr.message)
      return { accepted: 0, ids: [] }
    }
    return { accepted: ins?.length ?? 0, ids: (ins ?? []).map((r) => r.id as string) }
  }

  return { accepted: data?.length ?? rows.length, ids: (data ?? []).map((r) => r.id as string) }
}

export async function listAttributionEvents(limit = 200): Promise<AttributionEvent[]> {
  const workspaceId = await getDefaultWorkspaceId()
  if (!workspaceId) return []
  const admin = createSupabaseAdminClient()
  const take = Math.min(Math.max(limit, 1), 500)
  const { data, error } = await admin
    .from('attribution_events')
    .select(
      'id, workspace_id, created_at, property, event_type, path, source, medium, campaign, content, referrer, landing_url, session_id, device, source_label, timezone, locale, country, region, city'
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(take)

  if (error) {
    console.warn('[attribution] list failed', error.message)
    return []
  }
  return (data ?? []) as AttributionEvent[]
}
