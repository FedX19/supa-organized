import type { AttributionEvent } from './types'

export type OrgType = 'little_league' | 'travel' | 'other'

export type OutreachOrg = {
  code: string
  name: string
  org_type: OrgType
  email: string | null
  batch_date: string | null
  campaign: string | null
  path: string
  created_at?: string
}

export type OrgVisitRow = OutreachOrg & {
  in_registry: boolean
  visited: boolean
  first_visit: string | null
  last_visit: string | null
  page_views: number
  sessions: number
  pages: string[]
  clicked_signup: boolean
  clicked_unite: boolean
}

const CODE_RE = /^[a-z0-9][a-z0-9-]{0,40}$/
const CAMPAIGN_RE = /^[a-z0-9][a-z0-9-]{0,80}$/
const SITE_ORIGIN = 'https://www.modern-day-coach.com'

export function normalizeOrgCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim().toLowerCase()
  return CODE_RE.test(t) ? t : null
}

export function normalizeCampaignCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim().toLowerCase()
  return CAMPAIGN_RE.test(t) ? t : null
}

export function normalizeOrgType(raw: unknown): OrgType {
  const t = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/\s+/g, '_') : ''
  if (t === 'little_league' || t === 'littleleague' || t === 'll') return 'little_league'
  if (t === 'travel' || t === 'travel_ball' || t === 'tb') return 'travel'
  return 'other'
}

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '')
}

export function codeForOrg(type: OrgType, name: string, explicit?: unknown): string {
  const given = normalizeOrgCode(explicit)
  if (given) return given
  const prefix = type === 'little_league' ? 'll' : type === 'travel' ? 'tb' : 'org'
  const code = normalizeOrgCode(`${prefix}-${slugifyName(name) || 'org'}`)
  if (!code) throw new Error('could not build org code')
  return code
}

export function orgOutreachUrl(code: string, campaign: string, path?: string | null): string {
  const url = new URL(path && path.startsWith('/') ? path : '/leagues', SITE_ORIGIN)
  url.searchParams.set('o', code)
  url.searchParams.set('c', campaign)
  return url.toString()
}

export function orgCodeFromEvent(ev: AttributionEvent): string | null {
  const meta = ev.meta
  const fromMeta = meta && typeof meta.org_code === 'string' ? meta.org_code : null
  const direct = normalizeOrgCode(fromMeta)
  if (direct) return direct
  if (!ev.landing_url) return null
  try {
    const url = new URL(ev.landing_url)
    return normalizeOrgCode(url.searchParams.get('o') || url.searchParams.get('org'))
  } catch {
    return null
  }
}

function hrefOf(ev: AttributionEvent): string {
  const href = ev.meta && typeof ev.meta.href === 'string' ? ev.meta.href : ''
  return `${href} ${ev.landing_url || ''}`.toLowerCase()
}

function clickedSignup(ev: AttributionEvent): boolean {
  const type = (ev.event_type || '').toLowerCase()
  if (type === 'form_submit') return true
  const path = (ev.path || '').toLowerCase()
  if (path === '/contact' || path.startsWith('/contact/')) return true
  const href = hrefOf(ev)
  return href.includes('/contact') || href.includes('/onboard/league')
}

function clickedUnite(ev: AttributionEvent): boolean {
  const type = (ev.event_type || '').toLowerCase()
  if (type !== 'cta_click' && type !== 'cta_to_unite') {
    return (ev.property || '') === 'unite'
  }
  return hrefOf(ev).includes('unite-hq.com') || hrefOf(ev).includes('/onboard/league')
}

function inferredType(code: string): OrgType {
  if (code.startsWith('ll-')) return 'little_league'
  if (code.startsWith('tb-')) return 'travel'
  return 'other'
}

export function aggregateOrgs(events: AttributionEvent[], registry: OutreachOrg[]): OrgVisitRow[] {
  const byCode = new Map<string, OrgVisitRow>()

  const ensure = (code: string): OrgVisitRow => {
    const existing = byCode.get(code)
    if (existing) return existing
    const row: OrgVisitRow = {
      code,
      name: code,
      org_type: inferredType(code),
      email: null,
      batch_date: null,
      campaign: null,
      path: '/leagues',
      in_registry: false,
      visited: false,
      first_visit: null,
      last_visit: null,
      page_views: 0,
      sessions: 0,
      pages: [],
      clicked_signup: false,
      clicked_unite: false,
    }
    byCode.set(code, row)
    return row
  }

  for (const org of registry) {
    const row = ensure(org.code)
    row.name = org.name
    row.org_type = org.org_type
    row.email = org.email
    row.batch_date = org.batch_date
    row.campaign = org.campaign
    row.path = org.path || '/leagues'
    row.created_at = org.created_at
    row.in_registry = true
  }

  const sessions = new Map<string, Set<string>>()
  const pages = new Map<string, Set<string>>()

  for (const ev of events) {
    const code = orgCodeFromEvent(ev)
    if (!code) continue
    const row = ensure(code)
    const type = (ev.event_type || 'page_view').toLowerCase()
    if (type === 'page_view' && (ev.property || 'website') !== 'unite') {
      row.page_views += 1
      row.visited = true
      const when = ev.created_at
      if (!row.first_visit || when < row.first_visit) row.first_visit = when
      if (!row.last_visit || when > row.last_visit) row.last_visit = when
      const path = ev.path || '/'
      const pageSet = pages.get(code) || new Set<string>()
      pageSet.add(path)
      pages.set(code, pageSet)
      if (ev.session_id) {
        const set = sessions.get(code) || new Set<string>()
        set.add(ev.session_id)
        sessions.set(code, set)
      }
    }
    if (clickedSignup(ev)) row.clicked_signup = true
    if (clickedUnite(ev)) row.clicked_unite = true
    if (!row.campaign && ev.campaign) row.campaign = ev.campaign
  }

  Array.from(byCode.entries()).forEach(([code, row]) => {
    row.pages = Array.from(pages.get(code) || []).sort()
    const sess = sessions.get(code)
    row.sessions = sess && sess.size > 0 ? sess.size : row.page_views
  })

  return Array.from(byCode.values()).sort((a, b) => {
    if (a.visited !== b.visited) return a.visited ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}
