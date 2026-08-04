import { ResolvedUser, UserKind, applyLeagueFilter } from './identity'

/**
 * Retention and dormancy.
 *
 * Honesty constraint: with ~7 genuinely active users, cohort percentages are
 * noise — one person leaving is a 14% swing. So this returns COUNTS AND NAMES
 * first and percentages second, and flags cohorts too small to interpret.
 * The cohort machinery is real and will scale; it just refuses to pretend a
 * 2-person cohort means anything.
 *
 * Built on auth.users.last_sign_in_at, which is a LAST-seen timestamp, not a
 * full session history. That limits what is knowable:
 *   - "is this user still active" — yes, reliable.
 *   - "how often do they come back" — NOT knowable from this alone; it needs
 *     user_activity login events. Stated rather than faked.
 */

export interface CohortRow {
  /** YYYY-MM */
  month: string
  signedUp: number
  everActivated: number
  stillActive30d: number
  activationRate: number | null
  retentionRate: number | null
  /** True when the cohort is too small for the rates to mean anything. */
  tooSmallToInterpret: boolean
}

export interface ActiveUserRow {
  profileId: string
  name: string
  email: string | null
  kind: UserKind
  lastSignInAt: Date | null
  daysSinceLastSignIn: number | null
  status: 'active' | 'slipping' | 'dormant' | 'never'
}

export interface RetentionMetrics {
  dataAvailable: boolean
  unavailableReason?: string
  active7d: number
  active30d: number
  active90d: number
  /** Was active in the prior 30d window but not the current one. */
  slipping: ActiveUserRow[]
  dormant: ActiveUserRow[]
  users: ActiveUserRow[]
  cohorts: CohortRow[]
  /** Honest note rendered next to the numbers. */
  interpretationNote: string
}

/** Below this, a cohort's percentages are not meaningful. */
const MIN_COHORT_FOR_RATES = 10

const DAY = 864e5

function daysSince(from: Date, now: Date): number {
  return Math.floor((now.getTime() - from.getTime()) / DAY)
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function classify(days: number | null): ActiveUserRow['status'] {
  if (days === null) return 'never'
  if (days <= 7) return 'active'
  if (days <= 30) return 'slipping'
  return 'dormant'
}

export function computeRetentionMetrics(
  allUsers: ResolvedUser[],
  options: {
    includeLeague: boolean
    signInDataUnavailable: boolean
    unavailableReason?: string
    now?: Date
  }
): RetentionMetrics {
  const { includeLeague, signInDataUnavailable, unavailableReason } = options
  const now = options.now ?? new Date()
  const users = applyLeagueFilter(allUsers, includeLeague)

  if (signInDataUnavailable) {
    return {
      dataAvailable: false,
      unavailableReason,
      active7d: 0,
      active30d: 0,
      active90d: 0,
      slipping: [],
      dormant: [],
      users: [],
      cohorts: [],
      interpretationNote:
        'Sign-in history could not be read, so retention is UNKNOWN — not zero.',
    }
  }

  const rows: ActiveUserRow[] = users.map((u) => {
    const days = u.lastSignInAt ? daysSince(u.lastSignInAt, now) : null
    return {
      profileId: u.profileId,
      name: u.fullName?.trim() || '(no name)',
      email: u.email,
      kind: u.kind,
      lastSignInAt: u.lastSignInAt,
      daysSinceLastSignIn: days,
      status: classify(days),
    }
  })

  const withinDays = (n: number) =>
    rows.filter((r) => r.daysSinceLastSignIn !== null && r.daysSinceLastSignIn <= n).length

  const sortByRecency = (a: ActiveUserRow, b: ActiveUserRow) =>
    (a.daysSinceLastSignIn ?? Infinity) - (b.daysSinceLastSignIn ?? Infinity)

  // Cohort by signup month.
  const byMonth = new Map<string, ResolvedUser[]>()
  for (const u of users) {
    if (!u.signedUpAt) continue
    const key = monthKey(u.signedUpAt)
    byMonth.set(key, [...(byMonth.get(key) ?? []), u])
  }

  const cohorts: CohortRow[] = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cohortUsers]) => {
      const signedUp = cohortUsers.length
      const everActivated = cohortUsers.filter((u) => u.lastSignInAt !== null).length
      const stillActive30d = cohortUsers.filter(
        (u) => u.lastSignInAt !== null && daysSince(u.lastSignInAt, now) <= 30
      ).length
      const tooSmall = signedUp < MIN_COHORT_FOR_RATES

      return {
        month,
        signedUp,
        everActivated,
        stillActive30d,
        activationRate: tooSmall ? null : Math.round((everActivated / signedUp) * 1000) / 10,
        retentionRate: tooSmall ? null : Math.round((stillActive30d / signedUp) * 1000) / 10,
        tooSmallToInterpret: tooSmall,
      }
    })

  const active30d = withinDays(30)
  const interpretationNote =
    active30d < 20
      ? `Only ${active30d} users were active in the last 30 days. At this scale percentages are noise — read the names, not the rates.`
      : 'Cohort rates are shown for cohorts of 10+ users.'

  return {
    dataAvailable: true,
    active7d: withinDays(7),
    active30d,
    active90d: withinDays(90),
    slipping: rows.filter((r) => r.status === 'slipping').sort(sortByRecency),
    dormant: rows.filter((r) => r.status === 'dormant').sort(sortByRecency),
    users: rows.sort(sortByRecency),
    cohorts,
    interpretationNote,
  }
}
