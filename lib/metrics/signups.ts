import { ResolvedUser, UserKind, applyLeagueFilter } from './identity'

/**
 * Signups and activation.
 *
 * Derived entirely from `profiles.created_at` + `auth.users.last_sign_in_at` —
 * no instrumentation, and it works retroactively over all existing history.
 *
 * The headline number here is the ACTIVATION GAP: on production, 455 accounts
 * exist but only 148 have ever signed in. 67% of accounts have never been used.
 * That is the largest single number in the business and it was previously
 * invisible.
 */

export interface SignupWindow {
  label: string
  since: Date
  total: number
  byKind: Record<UserKind, number>
}

export interface SignupRow {
  profileId: string
  name: string
  email: string | null
  kind: UserKind
  signedUpAt: Date | null
  lastSignInAt: Date | null
  /** Hours between account creation and first sign-in. Null if never. */
  hoursToFirstLogin: number | null
  neverActivated: boolean
  isLeagueLegacy: boolean
}

export interface ActivationSummary {
  totalAccounts: number
  everSignedIn: number
  neverSignedIn: number
  /** Null when sign-in data is unavailable — never render this as 0. */
  activationRate: number | null
  dataAvailable: boolean
}

export interface SignupMetrics {
  windows: SignupWindow[]
  recent: SignupRow[]
  activation: ActivationSummary
  neverActivated: SignupRow[]
}

const EMPTY_KIND_COUNTS = (): Record<UserKind, number> => ({
  coach: 0,
  mdc_member: 0,
  staff: 0,
  guardian: 0,
  orphan: 0,
})

function hoursBetween(a: Date, b: Date): number {
  return Math.round(((b.getTime() - a.getTime()) / 36e5) * 10) / 10
}

function toRow(u: ResolvedUser): SignupRow {
  const hoursToFirstLogin =
    u.signedUpAt && u.lastSignInAt && u.lastSignInAt >= u.signedUpAt
      ? hoursBetween(u.signedUpAt, u.lastSignInAt)
      : null

  return {
    profileId: u.profileId,
    name: u.fullName?.trim() || '(no name)',
    email: u.email,
    kind: u.kind,
    signedUpAt: u.signedUpAt,
    lastSignInAt: u.lastSignInAt,
    hoursToFirstLogin,
    neverActivated: u.neverActivated,
    isLeagueLegacy: u.isLeagueLegacy,
  }
}

export function computeSignupMetrics(
  allUsers: ResolvedUser[],
  options: { includeLeague: boolean; signInDataUnavailable: boolean; now?: Date }
): SignupMetrics {
  const { includeLeague, signInDataUnavailable } = options
  const now = options.now ?? new Date()
  const users = applyLeagueFilter(allUsers, includeLeague)

  const windowDefs: Array<{ label: string; hours: number }> = [
    { label: 'Last 24 hours', hours: 24 },
    { label: 'Last 7 days', hours: 24 * 7 },
    { label: 'Last 30 days', hours: 24 * 30 },
  ]

  const windows: SignupWindow[] = windowDefs.map(({ label, hours }) => {
    const since = new Date(now.getTime() - hours * 36e5)
    const inWindow = users.filter((u) => u.signedUpAt && u.signedUpAt >= since)
    const byKind = EMPTY_KIND_COUNTS()
    for (const u of inWindow) byKind[u.kind]++
    return { label, since, total: inWindow.length, byKind }
  })

  const recent = users
    .filter((u) => u.signedUpAt)
    .sort((a, b) => (b.signedUpAt!.getTime() ?? 0) - (a.signedUpAt!.getTime() ?? 0))
    .slice(0, 100)
    .map(toRow)

  const everSignedIn = users.filter((u) => u.lastSignInAt !== null).length
  const neverSignedIn = users.length - everSignedIn

  const activation: ActivationSummary = {
    totalAccounts: users.length,
    everSignedIn: signInDataUnavailable ? 0 : everSignedIn,
    neverSignedIn: signInDataUnavailable ? 0 : neverSignedIn,
    activationRate:
      signInDataUnavailable || users.length === 0
        ? null
        : Math.round((everSignedIn / users.length) * 1000) / 10,
    dataAvailable: !signInDataUnavailable,
  }

  // Sorted newest-first: the most recent never-activated accounts are the ones
  // still worth chasing.
  const neverActivated = signInDataUnavailable
    ? []
    : users
        .filter((u) => u.neverActivated)
        .sort((a, b) => (b.signedUpAt?.getTime() ?? 0) - (a.signedUpAt?.getTime() ?? 0))
        .slice(0, 200)
        .map(toRow)

  return { windows, recent, activation, neverActivated }
}
