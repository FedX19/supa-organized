import type { AttributionEvent } from './types'

export type TimelinePoint = {
  t: string
  hour: string
  website: number
  unite: number
  total: number
  purchases: number
  cta: number
}

export type DayPoint = {
  day: string
  label: string
  weekday: string
  website: number
  unite: number
  total: number
  sessions: number
  purchases: number
}

export type SourceRow = {
  key: string
  label: string
  website: number
  unite: number
  total: number
  purchases: number
  share: number
  isX: boolean
}

export type PageRow = {
  path: string
  property: 'website' | 'unite'
  views: number
  sessions: number
}

export type FunnelStep = {
  id: string
  label: string
  property: 'website' | 'unite'
  count: number
  rateFromPrev: number | null
  rateFromTop: number
}

export type DeviceRow = { device: string; count: number; share: number }

export type LocationRow = {
  key: string
  label: string
  count: number
  share: number
  country?: string
}

export type DualAnalytics = {
  totalEvents: number
  websiteViews: number
  uniteViews: number
  ctaClicks: number
  purchases: number
  uniqueSessions: number
  websiteSessions: number
  uniteSessions: number
  fromX: number
  /** IANA zone used to bucket timeline / byDay (viewer). */
  viewerTimezone: string | null
  timeline: TimelinePoint[]
  byDay: DayPoint[]
  sources: SourceRow[]
  topPagesWebsite: PageRow[]
  topPagesUnite: PageRow[]
  funnel: FunnelStep[]
  devices: DeviceRow[]
  locations: LocationRow[]
  recent: AttributionEvent[]
  stitched: Array<{
    sessionId: string
    source: string
    websitePaths: string[]
    unitePaths: string[]
    purchased: boolean
    firstAt: string
    lastAt: string
    location?: string
  }>
}

function isX(ev: AttributionEvent): boolean {
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

function sourceKey(ev: AttributionEvent): string {
  if (isX(ev)) return 'x'
  const s = (ev.source ?? '').toLowerCase().trim()
  if (s && s !== 'direct') return s
  const r = (ev.referrer ?? '').toLowerCase()
  if (r.includes('google')) return 'google'
  if (r.includes('instagram')) return 'instagram'
  if (r.includes('facebook')) return 'facebook'
  if (r) return r.replace(/^www\./, '').split('/')[0] || 'referral'
  return 'direct'
}

function sourceLabel(key: string, sample?: AttributionEvent): string {
  if (key === 'x') return 'X (Twitter)'
  if (key === 'google') return 'Google'
  if (key === 'direct') return 'Direct / unknown'
  if (sample?.source_label) return sample.source_label
  if (sample?.campaign) return `${key} · ${sample.campaign}`
  return key
}

/** Resolve calendar parts in a specific IANA timezone (viewer or fallback). */
function zonedParts(
  iso: string,
  timeZone?: string | null
): {
  year: string
  month: string
  day: string
  hour: string
  weekdayLong: string
  weekdayShort: string
  monthShort: string
  dayNum: string
  hourLabel: string
} | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null

  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : undefined
  const base: Intl.DateTimeFormatOptions = {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'long',
  }

  try {
    const parts = new Intl.DateTimeFormat('en-US', base).formatToParts(d)
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? ''

    const year = get('year')
    const month = get('month')
    const day = get('day')
    let hour = get('hour')
    // Some engines emit "24" for midnight with h23; normalize to 00
    if (hour === '24') hour = '00'
    hour = hour.padStart(2, '0')

    const weekdayLong = get('weekday') || '—'
    const weekdayShort =
      new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(d)
    const monthShort = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      month: 'short',
    }).format(d)
    const dayNum = String(Number(day) || day)
    const hourLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
    }).format(d)

    return {
      year,
      month,
      day,
      hour,
      weekdayLong,
      weekdayShort,
      monthShort,
      dayNum,
      hourLabel,
    }
  } catch {
    // Fallback: host local (should be rare)
    const year = String(d.getFullYear())
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    return {
      year,
      month,
      day,
      hour,
      weekdayLong: d.toLocaleDateString('en-US', { weekday: 'long' }),
      weekdayShort: d.toLocaleDateString('en-US', { weekday: 'short' }),
      monthShort: d.toLocaleDateString('en-US', { month: 'short' }),
      dayNum: String(d.getDate()),
      hourLabel: d.toLocaleString('en-US', { hour: 'numeric' }),
    }
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function hourBucket(
  iso: string,
  timeZone?: string | null
): { key: string; label: string } {
  const p = zonedParts(iso, timeZone)
  if (!p) return { key: 'unknown', label: '—' }
  const key = `${p.year}-${p.month}-${p.day}T${p.hour}`
  const label = `${p.monthShort} ${p.dayNum}, ${p.hourLabel}`
  return { key, label }
}

function dayBucket(
  iso: string,
  timeZone?: string | null
): { key: string; label: string; weekday: string } {
  const p = zonedParts(iso, timeZone)
  if (!p) return { key: 'unknown', label: '—', weekday: '—' }
  const key = `${p.year}-${p.month}-${p.day}`
  const label = `${p.weekdayShort}, ${p.monthShort} ${p.dayNum}`
  return { key, label, weekday: p.weekdayLong }
}

function propertyOf(ev: AttributionEvent): 'website' | 'unite' {
  return ev.property === 'unite' ? 'unite' : 'website'
}

export function buildDualAnalytics(
  raw: AttributionEvent[],
  opts?: { hours?: number; timeZone?: string | null }
): DualAnalytics {
  const hours = opts?.hours ?? 24 * 30
  const timeZone =
    opts?.timeZone && isValidTimeZone(opts.timeZone) ? opts.timeZone : null
  const cutoff = Date.now() - hours * 3600_000
  const filtered = [...raw].filter((e) => {
    const t = new Date(e.created_at).getTime()
    return Number.isFinite(t) && t >= cutoff
  })
  const pool = (filtered.length > 0 ? filtered : [...raw]).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  let websiteViews = 0
  let uniteViews = 0
  let ctaClicks = 0
  let purchases = 0
  let fromX = 0
  const sessions = new Set<string>()
  const websiteSessions = new Set<string>()
  const uniteSessions = new Set<string>()
  const timelineMap = new Map<string, TimelinePoint>()
  const dayMap = new Map<string, DayPoint & { sess: Set<string> }>()
  const sourceMap = new Map<
    string,
    { website: number; unite: number; purchases: number; sample?: AttributionEvent }
  >()
  const pageMap = new Map<string, PageRow & { sess: Set<string> }>()
  const deviceMap = new Map<string, number>()
  const locationMap = new Map<string, { label: string; count: number; country?: string }>()
  const sessionMap = new Map<
    string,
    {
      source: string
      websitePaths: string[]
      unitePaths: string[]
      purchased: boolean
      firstAt: string
      lastAt: string
      location?: string
    }
  >()

  for (const ev of pool) {
    const prop = propertyOf(ev)
    const type = (ev.event_type || 'page_view').toLowerCase()
    const sid = ev.session_id || ev.id
    sessions.add(sid)
    if (prop === 'website') websiteSessions.add(sid)
    else uniteSessions.add(sid)

    if (type === 'page_view' || type === 'content_view') {
      if (prop === 'website') websiteViews += 1
      else uniteViews += 1
    }
    if (type === 'cta_to_unite') ctaClicks += 1
    if (type === 'purchase') purchases += 1
    if (isX(ev)) fromX += 1

    const { key: hk, label } = hourBucket(ev.created_at, timeZone)
    const tp = timelineMap.get(hk) ?? {
      t: label,
      hour: hk,
      website: 0,
      unite: 0,
      total: 0,
      purchases: 0,
      cta: 0,
    }
    if (prop === 'website') tp.website += 1
    else tp.unite += 1
    tp.total += 1
    if (type === 'purchase') tp.purchases += 1
    if (type === 'cta_to_unite') tp.cta += 1
    timelineMap.set(hk, tp)

    const { key: dk, label: dLabel, weekday } = dayBucket(ev.created_at, timeZone)
    const dp =
      dayMap.get(dk) ??
      ({
        day: dk,
        label: dLabel,
        weekday,
        website: 0,
        unite: 0,
        total: 0,
        sessions: 0,
        purchases: 0,
        sess: new Set<string>(),
      } as DayPoint & { sess: Set<string> })
    if (prop === 'website') dp.website += 1
    else dp.unite += 1
    dp.total += 1
    if (type === 'purchase') dp.purchases += 1
    dp.sess.add(sid)
    dp.sessions = dp.sess.size
    dayMap.set(dk, dp)

    const sk = sourceKey(ev)
    const sr = sourceMap.get(sk) ?? {
      website: 0,
      unite: 0,
      purchases: 0,
      sample: ev,
    }
    if (prop === 'website') sr.website += 1
    else sr.unite += 1
    if (type === 'purchase') sr.purchases += 1
    if (!sr.sample) sr.sample = ev
    sourceMap.set(sk, sr)

    const path = ev.path || '/'
    const pk = `${prop}::${path}`
    const pr =
      pageMap.get(pk) ??
      ({
        path,
        property: prop,
        views: 0,
        sessions: 0,
        sess: new Set<string>(),
      } as PageRow & { sess: Set<string> })
    pr.views += 1
    pr.sess.add(sid)
    pr.sessions = pr.sess.size
    pageMap.set(pk, pr)

    const dev = (ev.device || 'desktop').toLowerCase()
    deviceMap.set(dev, (deviceMap.get(dev) ?? 0) + 1)

    const locParts = [ev.city, ev.region, ev.country].filter(Boolean)
    const locLabel = locParts.length
      ? locParts.join(', ')
      : ev.timezone
        ? `${String(ev.timezone).split('/').pop()?.replace(/_/g, ' ')} (tz)`
        : 'Unknown'
    const locKey = locLabel.toLowerCase()
    const lr = locationMap.get(locKey) ?? {
      label: locLabel,
      count: 0,
      country: ev.country || undefined,
    }
    lr.count += 1
    locationMap.set(locKey, lr)

    const st = sessionMap.get(sid) ?? {
      source: sourceLabel(sk, ev),
      websitePaths: [] as string[],
      unitePaths: [] as string[],
      purchased: false,
      firstAt: ev.created_at,
      lastAt: ev.created_at,
      location: locLabel,
    }
    if (prop === 'website' && path && !st.websitePaths.includes(path)) {
      st.websitePaths.push(path)
    }
    if (prop === 'unite' && path && !st.unitePaths.includes(path)) {
      st.unitePaths.push(path)
    }
    if (type === 'purchase') st.purchased = true
    st.lastAt = ev.created_at
    if (!st.location || st.location === 'Unknown') st.location = locLabel
    sessionMap.set(sid, st)
  }

  const total = pool.length || 1
  const sources: SourceRow[] = Array.from(sourceMap.entries())
    .map(([key, v]) => {
      const tot = v.website + v.unite
      return {
        key,
        label: sourceLabel(key, v.sample),
        website: v.website,
        unite: v.unite,
        total: tot,
        purchases: v.purchases,
        share: tot / total,
        isX: key === 'x',
      }
    })
    .sort((a, b) => b.total - a.total)

  const pages = Array.from(pageMap.values()).map(({ sess: _s, ...rest }) => rest)
  const topPagesWebsite = pages
    .filter((p) => p.property === 'website')
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)
  const topPagesUnite = pages
    .filter((p) => p.property === 'unite')
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)

  const activateViews = pool.filter(
    (e) => propertyOf(e) === 'unite' && (e.path || '').includes('activate')
  ).length
  const marketplaceViews = pool.filter(
    (e) =>
      propertyOf(e) === 'unite' &&
      ((e.path || '').includes('marketplace') || (e.path || '').includes('mdc'))
  ).length

  const f1 = websiteViews
  const f2 = ctaClicks || Math.min(websiteViews, uniteViews)
  const f3 = uniteViews
  const f4 = activateViews || marketplaceViews
  const f5 = purchases
  const stepsRaw = [
    { id: 'site_view', label: 'Website page views', property: 'website' as const, count: f1 },
    { id: 'cta', label: 'Clicked through to Unite', property: 'website' as const, count: f2 },
    { id: 'unite_view', label: 'Unite app page views', property: 'unite' as const, count: f3 },
    { id: 'activate', label: 'Hit activate / membership', property: 'unite' as const, count: f4 },
    { id: 'purchase', label: 'Purchases', property: 'unite' as const, count: f5 },
  ]
  const top = stepsRaw[0]?.count || 1
  const funnel: FunnelStep[] = stepsRaw.map((s, i) => ({
    ...s,
    rateFromTop: s.count / top,
    rateFromPrev:
      i === 0 ? null : stepsRaw[i - 1]!.count > 0 ? s.count / stepsRaw[i - 1]!.count : 0,
  }))

  const deviceTotal = Array.from(deviceMap.values()).reduce((a, b) => a + b, 0) || 1
  const devices: DeviceRow[] = Array.from(deviceMap.entries())
    .map(([device, count]) => ({ device, count, share: count / deviceTotal }))
    .sort((a, b) => b.count - a.count)

  const locTotal = Array.from(locationMap.values()).reduce((a, b) => a + b.count, 0) || 1
  const locations: LocationRow[] = Array.from(locationMap.entries())
    .map(([key, v]) => ({
      key,
      label: v.label,
      count: v.count,
      share: v.count / locTotal,
      country: v.country,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  const timeline = Array.from(timelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)

  const byDay: DayPoint[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => {
      const { sess: _s, ...rest } = v
      return rest
    })

  const stitched = Array.from(sessionMap.entries())
    .map(([sessionId, s]) => ({ sessionId, ...s }))
    .filter((s) => s.websitePaths.length > 0 || s.unitePaths.length > 0)
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    .slice(0, 20)

  return {
    totalEvents: pool.length,
    websiteViews,
    uniteViews,
    ctaClicks,
    purchases,
    uniqueSessions: sessions.size,
    websiteSessions: websiteSessions.size,
    uniteSessions: uniteSessions.size,
    fromX,
    viewerTimezone: timeZone,
    timeline,
    byDay,
    sources,
    topPagesWebsite,
    topPagesUnite,
    funnel,
    devices,
    locations,
    recent: [...pool].reverse().slice(0, 50),
    stitched,
  }
}

export function formatShare(n: number): string {
  return `${Math.round(n * 100)}%`
}

export function emptyAnalytics(): DualAnalytics {
  return buildDualAnalytics([])
}
