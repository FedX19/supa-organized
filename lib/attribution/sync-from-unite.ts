import { insertAttributionEvents, parseTrackBody } from './events'
import type { AttributionEventInput } from './types'

const UNITE_LIVE =
  process.env.MDC_UNITE_TRACK_URL?.replace(/\/$/, '') ||
  'https://app.unite-hq.com/api/public/mdc-track'

/**
 * Pull recent non-PII events from Unite's live bus and upsert into SupaOrganized.
 * Makes the dashboard correct even when dual-write was offline for a stretch.
 */
export async function syncEventsFromUnite(limit = 200): Promise<{
  pulled: number
  accepted: number
}> {
  try {
    const res = await fetch(`${UNITE_LIVE}?limit=${Math.min(Math.max(limit, 1), 250)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      console.warn('[attribution] unite pull http', res.status)
      return { pulled: 0, accepted: 0 }
    }
    const data = (await res.json()) as { events?: unknown[] }
    const raw = Array.isArray(data.events) ? data.events : []
    const inputs: AttributionEventInput[] = []
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const parsed = parseTrackBody({
        ...o,
        // Unite rows already have id/created_at
        id: o.id,
        created_at: o.created_at,
        event_type: o.event_type,
        property: o.property,
      })
      if (parsed) {
        inputs.push({
          ...parsed,
          id: typeof o.id === 'string' ? o.id : parsed.id,
          created_at: typeof o.created_at === 'string' ? o.created_at : parsed.created_at,
          country: typeof o.country === 'string' ? o.country : parsed.country,
          region: typeof o.region === 'string' ? o.region : parsed.region,
          city: typeof o.city === 'string' ? o.city : parsed.city,
        })
      }
    }
    if (inputs.length === 0) return { pulled: 0, accepted: 0 }
    const result = await insertAttributionEvents(inputs)
    return { pulled: inputs.length, accepted: result.accepted }
  } catch (err) {
    console.warn(
      '[attribution] unite sync failed',
      err instanceof Error ? err.message : err,
    )
    return { pulled: 0, accepted: 0 }
  }
}
