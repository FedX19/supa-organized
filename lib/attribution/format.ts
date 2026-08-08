export function formatNumber(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

export function formatClock(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)
}

export type GeoBits = {
  city?: string | null
  region?: string | null
  country?: string | null
  timezone?: string | null
}

export function formatLocation(g: GeoBits | null | undefined): string {
  if (!g) return 'Unknown location'
  const parts = [g.city, g.region, g.country].filter(
    (p): p is string => Boolean(p && String(p).trim())
  )
  if (parts.length) return parts.join(', ')
  if (g.timezone) {
    const cityish = g.timezone.split('/').pop()?.replace(/_/g, ' ')
    return cityish ? `${cityish} (tz)` : g.timezone
  }
  return 'Unknown location'
}

export function formatTimezone(tz?: string | null): string {
  if (!tz) return ''
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date())
    const name = parts.find((p) => p.type === 'timeZoneName')?.value
    return name ? `${tz.replace(/_/g, ' ')} · ${name}` : tz.replace(/_/g, ' ')
  } catch {
    return tz.replace(/_/g, ' ')
  }
}
