import { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll } from './fetch-all'
import { ResolvedUser } from './identity'

/**
 * Feature usage, from user_activity.
 *
 * The single most dangerous failure mode of a usage dashboard is rendering an
 * empty panel for a feature that is simply NOT INSTRUMENTED, which reads as
 * "nobody uses this". UniteHQ emits events from only a handful of places, so
 * this module ships an explicit registry: every known product feature, and
 * whether it can currently report anything at all.
 *
 * Verified against unitehq on 2026-08-04 by grepping callers of
 * `logEventBestEffort`. Keep INSTRUMENTED in sync when the telemetry PR lands.
 */

export type InstrumentationStatus = 'instrumented' | 'not_instrumented' | 'retired'

export interface FeatureDefinition {
  /** The `event_details.feature` value emitted by unitehq. */
  key: string
  label: string
  status: InstrumentationStatus
  note?: string
}

/**
 * Ground truth for what unitehq actually emits today.
 * `retired` = the league product, deleted in the 2026-07 replatform; historical
 * events exist but no new ones will ever arrive.
 */
export const FEATURE_REGISTRY: FeatureDefinition[] = [
  // Instrumented before 2026-08-04.
  { key: 'auth', label: 'Login', status: 'instrumented' },
  { key: 'org_context', label: 'Workspace load', status: 'instrumented' },
  { key: 'evaluations', label: 'Assessments', status: 'instrumented' },
  { key: 'player_plans', label: 'Player plans', status: 'instrumented' },
  { key: 'documents', label: 'Documents', status: 'instrumented' },
  { key: 'mdc_library', label: 'MDC library', status: 'instrumented' },
  { key: 'announcements', label: 'Announcements', status: 'instrumented' },

  // Instrumented 2026-08-04 by unitehq PRs #1053 and #1054.
  // ⚠️ These have NO HISTORICAL DATA before that date. A low event count here
  // means "recently instrumented", not "recently abandoned" — do not read a
  // trend across the boundary.
  {
    key: 'coach_assistant',
    label: 'Coach AI Assistant',
    status: 'instrumented',
    note: 'Instrumented 2026-08-04 (#1053). No data before then.',
  },
  {
    key: 'drill_library',
    label: 'Drill library',
    status: 'instrumented',
    note: 'Instrumented 2026-08-04 (#1053). No data before then.',
  },
  {
    key: 'video_review',
    label: 'Video review',
    status: 'instrumented',
    note: 'Instrumented 2026-08-04 (#1053). No data before then.',
  },
  {
    key: 'practice_plans',
    label: 'Practice plans',
    status: 'instrumented',
    note: 'Instrumented 2026-08-04 (#1053). No data before then.',
  },
  {
    key: 'tools',
    label: 'Tool enable / disable',
    status: 'instrumented',
    note: 'Instrumented 2026-08-04 (#1053). No data before then.',
  },
  {
    key: 'chat',
    label: 'Chat / messaging',
    status: 'instrumented',
    note: 'Instrumented 2026-08-04 (#1054). No data before then.',
  },
  {
    key: 'workout_planner',
    label: 'Workout planner',
    status: 'instrumented',
    note: 'Instrumented 2026-08-04 (#1054). No data before then.',
  },
  {
    key: 'routine_planner',
    label: 'Daily routines',
    status: 'instrumented',
    note: 'Instrumented 2026-08-04 (#1054). No data before then.',
  },
  {
    key: 'marketplace',
    label: 'Marketplace listing',
    status: 'instrumented',
    note: 'Instrumented 2026-08-04 (#1054). No data before then.',
  },
  {
    key: 'billing',
    label: 'Billing / Stripe',
    status: 'instrumented',
    note: 'Instrumented 2026-08-04 (#1054). Connect onboarding start only.',
  },
  {
    key: 'onboarding',
    label: 'Onboarding wizard',
    status: 'instrumented',
    note: 'Instrumented 2026-08-04 (#1054). No data before then.',
  },

  // Still emitting nothing.
  { key: 'drive_importer', label: 'Google Drive importer', status: 'not_instrumented' },

  {
    key: 'schedule',
    label: 'Schedule',
    status: 'retired',
    note: 'League product, deleted July 2026. Historical events only.',
  },
]

/**
 * The date the second instrumentation wave landed. Features carrying a
 * "no data before then" note cannot be compared against anything earlier.
 */
export const INSTRUMENTATION_WAVE_2 = new Date('2026-08-04T00:00:00Z')

export interface FeatureUsageRow {
  key: string
  label: string
  status: InstrumentationStatus
  note?: string
  eventCount: number
  uniqueUsers: number
  lastUsedAt: Date | null
  byRole: Record<string, number>
  /** True when this feature is in the registry but produced no events. */
  silent: boolean
}

export interface ActivityEventRow {
  id: string
  profile_id: string | null
  organization_id: string | null
  event_type: string
  event_details: Record<string, unknown> | null
  timestamp: string
}

export interface FeatureMetrics {
  features: FeatureUsageRow[]
  instrumentedCount: number
  notInstrumentedCount: number
  totalEvents: number
  errorCount: number
  /** Distinct features seen in data but missing from the registry. */
  unknownFeatures: string[]
  coverageNote: string
  warnings: string[]
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function fetchActivity(
  client: SupabaseClient,
  sinceISO: string
): Promise<{ rows: ActivityEventRow[]; error?: string; truncated: boolean }> {
  const res = await fetchAll<ActivityEventRow>(client, 'user_activity', {
    columns: 'id, profile_id, organization_id, event_type, event_details, timestamp',
    filter: (q) => q.gte('timestamp', sinceISO),
    orderBy: 'timestamp',
  })
  return { rows: res.rows, error: res.error, truncated: res.truncated }
}

export function computeFeatureMetrics(
  events: ActivityEventRow[],
  options: {
    /** Restricts to these profiles — used to apply the league filter. */
    allowedProfileIds?: Set<string>
    warnings?: string[]
  } = {}
): FeatureMetrics {
  const { allowedProfileIds } = options
  const warnings = [...(options.warnings ?? [])]

  const relevant = allowedProfileIds
    ? events.filter((e) => e.profile_id && allowedProfileIds.has(e.profile_id))
    : events

  const agg = new Map<
    string,
    { count: number; users: Set<string>; last: Date | null; byRole: Record<string, number> }
  >()
  let errorCount = 0

  for (const e of relevant) {
    if (e.event_type === 'error') errorCount++
    const details = e.event_details ?? {}
    const feature = typeof details.feature === 'string' ? details.feature : 'unknown'
    const role = typeof details.viewer_role === 'string' ? details.viewer_role : 'unknown'

    const entry = agg.get(feature) ?? {
      count: 0,
      users: new Set<string>(),
      last: null,
      byRole: {},
    }
    entry.count++
    if (e.profile_id) entry.users.add(e.profile_id)
    const ts = toDate(e.timestamp)
    if (ts && (!entry.last || ts > entry.last)) entry.last = ts
    entry.byRole[role] = (entry.byRole[role] ?? 0) + 1
    agg.set(feature, entry)
  }

  const registryKeys = new Set(FEATURE_REGISTRY.map((f) => f.key))
  const unknownFeatures = Array.from(agg.keys()).filter(
    (k) => !registryKeys.has(k) && k !== 'unknown'
  )
  for (const k of unknownFeatures) {
    warnings.push(`Feature "${k}" appears in data but is missing from FEATURE_REGISTRY.`)
  }

  const features: FeatureUsageRow[] = FEATURE_REGISTRY.map((def) => {
    const entry = agg.get(def.key)
    return {
      key: def.key,
      label: def.label,
      status: def.status,
      note: def.note,
      eventCount: entry?.count ?? 0,
      uniqueUsers: entry?.users.size ?? 0,
      lastUsedAt: entry?.last ?? null,
      byRole: entry?.byRole ?? {},
      silent: !entry || entry.count === 0,
    }
  })

  // Anything present in data but not in the registry still gets surfaced.
  for (const key of unknownFeatures) {
    const entry = agg.get(key)!
    features.push({
      key,
      label: key,
      status: 'instrumented',
      note: 'Not in registry — add it to FEATURE_REGISTRY.',
      eventCount: entry.count,
      uniqueUsers: entry.users.size,
      lastUsedAt: entry.last,
      byRole: entry.byRole,
      silent: false,
    })
  }

  features.sort((a, b) => b.eventCount - a.eventCount)

  const instrumentedCount = FEATURE_REGISTRY.filter((f) => f.status === 'instrumented').length
  const notInstrumentedCount = FEATURE_REGISTRY.filter(
    (f) => f.status === 'not_instrumented'
  ).length

  return {
    features,
    instrumentedCount,
    notInstrumentedCount,
    totalEvents: relevant.length,
    errorCount,
    unknownFeatures,
    coverageNote:
      notInstrumentedCount > 0
        ? `${instrumentedCount} of ${instrumentedCount + notInstrumentedCount} live features emit telemetry. ${notInstrumentedCount} report nothing yet — a blank row means "not measured", not "not used". Features marked "new" were instrumented on 4 Aug 2026 and have no history before that.`
        : `All ${instrumentedCount} live features emit telemetry. Features marked "new" were instrumented on 4 Aug 2026 — a low count there means recently instrumented, not recently abandoned.`,
    warnings,
  }
}

/** Convenience: profile ids that survive the league filter. */
export function allowedProfileIds(users: ResolvedUser[]): Set<string> {
  return new Set(users.map((u) => u.profileId))
}
