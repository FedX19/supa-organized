import { createSupabaseAdminClient } from '@/lib/supabase'
import type {
  AttributionEvent,
  AttributionEventInput,
  AttributionEventMeta,
  AttributionProperty,
} from './types'

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

function normalizeProperty(raw?: string | null): AttributionProperty {
  const p = (raw || '').toLowerCase().trim()
  if (p === 'unite' || p === 'unitehq' || p === 'app' || p === 'unite_hq') return 'unite'
  if (p === 'email') return 'email'
  if (p === 'call') return 'call'
  return 'website'
}

function normalizeEventType(raw?: string | null): string {
  const t = (raw || '').toLowerCase().trim()
  if (!t) return 'page_view'
  if (t === 'cta_to_unite' || t === 'cta') return 'cta_click'
  if (t === 'purchase' || t === 'paid' || t === 'stripe_paid') return 'purchase_completed'
  if (t === 'activate' || t === 'activate_membership' || t === 'checkout') return 'checkout_started'
  if (t === 'form' || t === 'submit') return 'form_submit'
  if (t === 'visit_from_x' || t === 'from_x') return 'visit_from_x'
  return t.slice(0, 80)
}

function foldMeta(input: AttributionEventInput): AttributionEventMeta {
  const base: AttributionEventMeta =
    input.meta && typeof input.meta === 'object' ? { ...input.meta } : {}
  if (input.label) base.label = String(input.label).slice(0, 120)
  if (input.href) base.href = String(input.href).slice(0, 400)
  if (input.form_type) base.form_type = String(input.form_type).slice(0, 40)
  if (input.plan) base.plan = String(input.plan).slice(0, 80)
  if (input.sku) base.sku = String(input.sku).slice(0, 80)
  if (typeof input.amount === 'number' && Number.isFinite(input.amount)) base.amount = input.amount
  if (input.currency) base.currency = String(input.currency).slice(0, 8)
  if (input.org_name) base.org_name = String(input.org_name).slice(0, 120)
  if (input.page_path && !base.page_path) base.page_path = String(input.page_path).slice(0, 200)
  return base
}

export function classifySuspicious(opts: {
  userAgent?: string | null
  city?: string | null
  region?: string | null
  sessionId?: string | null
}): boolean {
  const ua = (opts.userAgent || '').toLowerCase()
  if (!ua) return true
  const bots = [
    'bot', 'crawler', 'spider', 'slurp', 'facebookexternalhit', 'twitterbot',
    'linkedinbot', 'slackbot', 'discordbot', 'whatsapp', 'telegrambot', 'preview',
    'headless', 'phantomjs', 'selenium', 'puppeteer', 'playwright', 'curl/',
    'wget/', 'python-requests', 'go-http-client', 'scrapy', 'okhttp', 'axios/',
    'node-fetch', 'vercel-screenshot', 'lighthouse', 'pagespeed', 'pingdom',
    'uptimerobot', 'statuscake',
  ]
  if (bots.some((p) => ua.includes(p))) return true
  const city = (opts.city || '').toLowerCase()
  if ((city === 'ashburn' || city === 'boardman' || city === 'the dalles') && !opts.sessionId) {
    return true
  }
  return false
}

export function parseTrackBody(raw: unknown): AttributionEventInput | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const metaRaw = o.meta
  let meta: AttributionEventMeta | undefined
  if (metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)) {
    meta = metaRaw as AttributionEventMeta
  }
  return {
    id: typeof o.id === 'string' ? o.id : undefined,
    event_id: typeof o.event_id === 'string' ? o.event_id : undefined,
    created_at: typeof o.created_at === 'string' ? o.created_at : undefined,
    property: typeof o.property === 'string' ? o.property : undefined,
    event_type:
      typeof o.event_type === 'string'
        ? o.event_type
        : typeof o.type === 'string'
          ? o.type
          : undefined,
    type: typeof o.type === 'string' ? o.type : undefined,
    path: typeof o.path === 'string' ? o.path : undefined,
    source: typeof o.source === 'string' ? o.source : undefined,
    medium: typeof o.medium === 'string' ? o.medium : undefined,
    campaign: typeof o.campaign === 'string' ? o.campaign : undefined,
    content: typeof o.content === 'string' ? o.content : undefined,
    term: typeof o.term === 'string' ? o.term : undefined,
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
    is_bot: typeof o.is_bot === 'boolean' ? o.is_bot : undefined,
    meta,
    label: typeof o.label === 'string' ? o.label : undefined,
    href: typeof o.href === 'string' ? o.href : undefined,
    form_type: typeof o.form_type === 'string' ? o.form_type : undefined,
    plan: typeof o.plan === 'string' ? o.plan : undefined,
    sku: typeof o.sku === 'string' ? o.sku : undefined,
    amount: typeof o.amount === 'number' ? o.amount : undefined,
    currency: typeof o.currency === 'string' ? o.currency : undefined,
    org_name: typeof o.org_name === 'string' ? o.org_name : undefined,
    page_path: typeof o.page_path === 'string' ? o.page_path : undefined,
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

export type InsertOptions = {
  edgeGeo?: { country?: string; region?: string; city?: string }
  userAgent?: string | null
  headers?: Headers
}

export type InsertResult = {
  accepted: number
  deduped: number
  bots: number
  ids: string[]
}

export async function insertAttributionEvents(
  inputs: AttributionEventInput[],
  options?: InsertOptions
): Promise<InsertResult> {
  const workspaceId = await getDefaultWorkspaceId()
  if (!workspaceId) return { accepted: 0, deduped: 0, bots: 0, ids: [] }

  const admin = createSupabaseAdminClient()
  const edgeGeo = options?.edgeGeo
  const ua = options?.userAgent ?? null

  let bots = 0
  const rows = inputs.slice(0, 50).map((input) => {
    const property = normalizeProperty(input.property)
    const eventType = normalizeEventType(input.event_type || input.type)
    const city = edgeGeo?.city || input.city || null
    const region = edgeGeo?.region || input.region || null
    const country = edgeGeo?.country || input.country || null
    const sessionId = clip(input.session_id, 80)

    const isBot =
      typeof input.is_bot === 'boolean'
        ? input.is_bot
        : classifySuspicious({ userAgent: ua, city, region, sessionId })

    if (isBot) bots += 1

    return {
      id: asUuid(input.id || input.event_id),
      workspace_id: workspaceId,
      created_at: asIso(input.created_at),
      property,
      event_type: eventType,
      path: clip(input.path, 200),
      source: clip(input.source, 80),
      medium: clip(input.medium, 80),
      campaign: clip(input.campaign, 120),
      content: clip(input.content, 120),
      term: clip(input.term, 120),
      referrer: clip(input.referrer, 120),
      landing_url: clip(input.landing_url, 400),
      session_id: sessionId,
      device: clip(input.device, 20),
      source_label: clip(input.source_label, 160),
      timezone: clip(input.timezone, 80),
      locale: clip(input.locale, 40),
      country: clip(country, 8),
      region: clip(region, 80),
      city: clip(city, 80),
      is_bot: isBot,
      meta: foldMeta(input),
    }
  })

  if (rows.length === 0) return { accepted: 0, deduped: 0, bots: 0, ids: [] }

  const { data, error } = await admin
    .from('attribution_events')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.warn('[attribution] upsert failed, trying legacy insert', error.message)
    const legacy = rows.map((r) => {
      const { is_bot: _b, meta: _m, term: _t, ...rest } = r
      return rest
    })
    const { data: ins, error: insErr } = await admin
      .from('attribution_events')
      .insert(legacy)
      .select('id')
    if (insErr) {
      console.warn('[attribution] insert failed', insErr.message)
      return { accepted: 0, deduped: 0, bots, ids: [] }
    }
    return {
      accepted: ins?.length ?? 0,
      deduped: Math.max(0, rows.length - (ins?.length ?? 0)),
      bots,
      ids: (ins ?? []).map((r) => r.id as string),
    }
  }

  const accepted = data?.length ?? 0
  return {
    accepted: accepted || rows.length,
    deduped: Math.max(0, rows.length - accepted),
    bots,
    ids: (data ?? rows).map((r) => ('id' in r ? (r.id as string) : '')).filter(Boolean),
  }
}

export async function listAttributionEvents(
  limit = 200,
  opts?: { includeBots?: boolean }
): Promise<AttributionEvent[]> {
  const workspaceId = await getDefaultWorkspaceId()
  if (!workspaceId) return []
  const admin = createSupabaseAdminClient()
  const take = Math.min(Math.max(limit, 1), 500)
  const selectCols =
    'id, workspace_id, created_at, property, event_type, path, source, medium, campaign, content, term, referrer, landing_url, session_id, device, source_label, timezone, locale, country, region, city, is_bot, meta'

  let query = admin
    .from('attribution_events')
    .select(selectCols)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(take)

  if (!opts?.includeBots) query = query.eq('is_bot', false)

  const { data, error } = await query
  if (error) {
    console.warn('[attribution] list failed, trying legacy columns', error.message)
    const { data: legacy, error: legErr } = await admin
      .from('attribution_events')
      .select(
        'id, workspace_id, created_at, property, event_type, path, source, medium, campaign, content, referrer, landing_url, session_id, device, source_label, timezone, locale, country, region, city'
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(take)
    if (legErr) {
      console.warn('[attribution] legacy list failed', legErr.message)
      return []
    }
    return (legacy ?? []) as AttributionEvent[]
  }
  return (data ?? []) as AttributionEvent[]
}
