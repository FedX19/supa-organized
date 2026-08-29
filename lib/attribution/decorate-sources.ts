import type { DualAnalytics, SourceRow } from './analytics'
import type { AttributionEvent } from './types'

const GENERIC = new Set(['', 'site', 'none', '(none)', 'direct'])

export function isXEvent(ev: AttributionEvent): boolean {
  const s = (ev.source ?? '').toLowerCase()
  const r = (ev.referrer ?? '').toLowerCase()
  const label = (ev.source_label ?? '').toLowerCase()
  return (
    s === 'x' ||
    s === 'twitter' ||
    r.includes('x.com') ||
    r.includes('twitter') ||
    r === 't.co' ||
    label.startsWith('x ') ||
    label.includes('x ·')
  )
}

export function isEmailEvent(ev: AttributionEvent): boolean {
  const s = (ev.source ?? '').toLowerCase()
  const m = (ev.medium ?? '').toLowerCase()
  const label = (ev.source_label ?? '').toLowerCase()
  return (
    s === 'email' ||
    s === 'instantly' ||
    s === 'smartlead' ||
    s === 'mailchimp' ||
    s === 'resend' ||
    m === 'email' ||
    m === 'cold' ||
    m === 'outreach' ||
    m.includes('email') ||
    label.startsWith('email')
  )
}

export function channelOf(ev: AttributionEvent): string {
  if (isXEvent(ev)) return 'x'
  if (isEmailEvent(ev)) return 'email'
  const s = (ev.source ?? '').toLowerCase().trim()
  if (s && s !== 'direct' && s !== 'none') return s
  const r = (ev.referrer ?? '').toLowerCase()
  if (r.includes('google')) return 'google'
  if (r.includes('instagram')) return 'instagram'
  if (r.includes('facebook')) return 'facebook'
  if (r.includes('linkedin')) return 'linkedin'
  if (r.includes('youtube')) return 'youtube'
  if (r) return r.replace(/^www\./, '').split('/')[0] || 'referral'
  return 'direct'
}

function campaignOf(ev: AttributionEvent): string | null {
  const c = (ev.campaign ?? '').trim()
  if (!c || GENERIC.has(c.toLowerCase())) return null
  return c
}

function pretty(ch: string): string {
  if (ch === 'x') return 'X'
  if (ch === 'email') return 'Email'
  if (ch === 'google') return 'Google'
  if (ch === 'direct') return 'Direct / unknown'
  return ch
}

function isCta(type: string) {
  return type === 'cta_click' || type === 'cta_to_unite'
}

function isPurchase(type: string) {
  return type === 'purchase' || type === 'purchase_completed'
}

export function decorateSources(base: DualAnalytics, events: AttributionEvent[]): DualAnalytics {
  const map = new Map<
    string,
    {
      website: number
      unite: number
      purchases: number
      cta: number
      sess: Set<string>
      sample: AttributionEvent
    }
  >()
  let fromEmail = 0
  let fromGoogle = 0
  let fromDirect = 0
  let fromX = 0
  let ctaClicks = 0
  let purchases = 0

  for (const ev of events) {
    const type = (ev.event_type || 'page_view').toLowerCase()
    const ch = channelOf(ev)
    const camp = campaignOf(ev)
    const key = camp ? `${ch}::${camp.toLowerCase()}` : ch
    const sid = ev.session_id || ev.id
    const row = map.get(key) ?? {
      website: 0,
      unite: 0,
      purchases: 0,
      cta: 0,
      sess: new Set<string>(),
      sample: ev,
    }
    if (ev.property === 'unite') row.unite += 1
    else row.website += 1
    if (isPurchase(type)) {
      row.purchases += 1
      purchases += 1
    }
    if (isCta(type)) {
      row.cta += 1
      ctaClicks += 1
    }
    row.sess.add(sid)
    map.set(key, row)
    if (ch === 'email') fromEmail += 1
    else if (ch === 'x') fromX += 1
    else if (ch === 'google') fromGoogle += 1
    else if (ch === 'direct') fromDirect += 1
  }

  const total = events.length || 1
  const sources: SourceRow[] = Array.from(map.entries())
    .map(([key, v]) => {
      const ch = key.split('::')[0] || 'direct'
      const camp = campaignOf(v.sample)
      const tot = v.website + v.unite
      return {
        key,
        label: camp ? `${pretty(ch)} · ${camp}` : pretty(ch),
        website: v.website,
        unite: v.unite,
        total: tot,
        purchases: v.purchases,
        share: tot / total,
        isX: ch === 'x',
        channel: ch,
        campaign: camp,
        medium: v.sample.medium || null,
        sessions: v.sess.size,
        cta: v.cta,
        isEmail: ch === 'email',
      } as SourceRow
    })
    .sort((a, b) => b.total - a.total)

  return {
    ...base,
    sources,
    fromX: fromX || base.fromX,
    ctaClicks: ctaClicks || base.ctaClicks,
    purchases: purchases || base.purchases,
    fromEmail,
    fromGoogle,
    fromDirect,
  } as DualAnalytics
}

export function originCount(
  a: DualAnalytics,
  key: 'fromEmail' | 'fromGoogle' | 'fromDirect'
): number {
  const v = (a as unknown as Record<string, unknown>)[key]
  return typeof v === 'number' ? v : 0
}
