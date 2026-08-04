import { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll } from './fetch-all'

/**
 * Who is each user, really?
 *
 * Every other metric depends on this. UniteHQ has no single "user type" column
 * — identity is implied by which tables a profile appears in. This resolves
 * that once, so signups / retention / coach-funnel all agree on the answer.
 *
 * Validated against production (xkubmjogdwsywdlpvydt) on 2026-08-04:
 *   coach 4 · mdc_member 9 · staff 39 · guardian 403
 */

export type UserKind = 'coach' | 'mdc_member' | 'staff' | 'guardian' | 'orphan'

export const USER_KIND_LABELS: Record<UserKind, string> = {
  coach: 'Coach',
  mdc_member: 'MDC member',
  staff: 'Staff / operator',
  guardian: 'Parent / guardian',
  orphan: 'No profile',
}

/** UniteHQ business_type values. `league` is the deprecated product. */
export const LEAGUE_BUSINESS_TYPE = 'league'

export interface ResolvedUser {
  profileId: string
  fullName: string | null
  email: string | null
  kind: UserKind
  /** From profiles.created_at — populated for all 455 rows on prod. */
  signedUpAt: Date | null
  /** From auth.users.last_sign_in_at. Null means NEVER logged in. */
  lastSignInAt: Date | null
  /** Never signed in despite having an account — the activation gap. */
  neverActivated: boolean
  /** Every org this user touches, as membership or staff. */
  orgIds: string[]
  /**
   * True when every org this user belongs to is a deprecated league org.
   * Drives the global "exclude league" toggle.
   */
  isLeagueLegacy: boolean
  /** MDC-specific, when kind === 'mdc_member'. */
  membership?: {
    status: string | null
    memberType: string | null
    billingMode: string | null
    source: string | null
    leagueName: string | null
    activatedAt: Date | null
    onboardingCompletedAt: Date | null
  }
}

export interface IdentityGraph {
  users: ResolvedUser[]
  byId: Map<string, ResolvedUser>
  orgs: Map<string, OrgRow>
  /**
   * True when neither the admin API nor the activity fallback produced any
   * last-seen data. Retention and activation are unavailable (not zero) in
   * that case — callers must not render 0.
   */
  signInDataUnavailable: boolean
  signInUnavailableReason?: string
  /**
   * Where lastSignInAt came from:
   *  - auth_admin_api: authoritative sign-in timestamps
   *  - activity_fallback: approximate, derived from user_activity. UNDER-reports.
   *  - unavailable: no data at all
   */
  signInSource: 'auth_admin_api' | 'activity_fallback' | 'unavailable'
  warnings: string[]
}

export interface OrgRow {
  id: string
  name: string | null
  slug: string | null
  business_type: string | null
  org_type: string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  created_at: string | null
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Reads auth.users via the GoTrue admin API.
 *
 * This cannot go through PostgREST: the `auth` schema is not in Supabase's
 * exposed-schemas list, so `client.from('auth.users')` fails. The admin API
 * accepts the same service-role key we already hold.
 *
 * Returns null (rather than throwing) if the key lacks admin rights, so the
 * dashboard degrades to "unknown" instead of rendering a misleading zero.
 */
async function fetchAuthUsers(
  client: SupabaseClient
): Promise<{ map: Map<string, Date | null> | null; reason?: string }> {
  const map = new Map<string, Date | null>()
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) return { map: null, reason: error.message }
      const users = data?.users ?? []
      for (const u of users) {
        map.set(u.id, toDate(u.last_sign_in_at as string | null))
      }
      if (users.length < 1000) break
    }
    return { map }
  } catch (err) {
    return { map: null, reason: err instanceof Error ? err.message : 'admin API unavailable' }
  }
}

/**
 * Fallback last-activity, derived from user_activity.
 *
 * The admin API is the better source (it sees every sign-in, including ones
 * that never reached an instrumented route), but it is not guaranteed to be
 * reachable with the stored key. user_activity IS readable over plain
 * PostgREST, so this gives a reduced-accuracy answer instead of no answer.
 *
 * It UNDER-reports: a user who signed in but triggered no logged event is
 * invisible here, and nothing exists before telemetry was switched on. Callers
 * must label it as approximate rather than presenting it as sign-in truth.
 */
async function fetchLastActivityFallback(
  client: SupabaseClient
): Promise<Map<string, Date>> {
  const map = new Map<string, Date>()
  const res = await fetchAll<{ profile_id: string | null; timestamp: string }>(
    client,
    'user_activity',
    { columns: 'id, profile_id, timestamp', orderBy: 'timestamp' }
  )
  for (const row of res.rows) {
    if (!row.profile_id) continue
    const ts = toDate(row.timestamp)
    if (!ts) continue
    const existing = map.get(row.profile_id)
    if (!existing || ts > existing) map.set(row.profile_id, ts)
  }
  return map
}

export async function resolveIdentityGraph(client: SupabaseClient): Promise<IdentityGraph> {
  const warnings: string[] = []

  const [profilesRes, orgsRes, membersRes, staffRes, workspacesRes, membershipsRes, authRes] =
    await Promise.all([
      fetchAll<ProfileRow>(client, 'profiles', { columns: 'id, full_name, email, created_at' }),
      fetchAll<OrgRow>(client, 'organizations', {
        columns: 'id, name, slug, business_type, org_type',
      }),
      fetchAll<{ profile_id: string; organization_id: string }>(client, 'organization_members', {
        columns: 'id, profile_id, organization_id',
      }),
      fetchAll<{ profile_id: string; organization_id: string; role: string | null }>(
        client,
        'organization_staff',
        { columns: 'id, profile_id, organization_id, role' }
      ),
      fetchAll<{ owner_profile_id: string | null }>(client, 'consultant_workspaces', {
        columns: 'id, owner_profile_id',
      }),
      fetchAll<{
        profile_id: string
        status: string | null
        member_type: string | null
        billing_mode: string | null
        source: string | null
        league_name: string | null
        activated_at: string | null
        onboarding_completed_at: string | null
      }>(client, 'profile_memberships', {
        columns:
          'id, profile_id, status, member_type, billing_mode, source, league_name, activated_at, onboarding_completed_at',
      }),
      fetchAuthUsers(client),
    ])

  for (const [name, res] of [
    ['profiles', profilesRes],
    ['organizations', orgsRes],
    ['organization_members', membersRes],
    ['organization_staff', staffRes],
    ['consultant_workspaces', workspacesRes],
    ['profile_memberships', membershipsRes],
  ] as const) {
    if (res.error) warnings.push(`${name}: ${res.error}`)
    if (res.truncated) warnings.push(`${name}: result truncated — more rows exist than were read`)
  }

  const orgs = new Map<string, OrgRow>()
  for (const o of orgsRes.rows) orgs.set(o.id, o)

  const coachProfileIds = new Set(
    workspacesRes.rows.map((w) => w.owner_profile_id).filter((v): v is string => Boolean(v))
  )
  const staffProfileIds = new Set(staffRes.rows.map((s) => s.profile_id))
  const membershipByProfile = new Map<string, (typeof membershipsRes.rows)[number]>()
  for (const m of membershipsRes.rows) {
    if (m.profile_id) membershipByProfile.set(m.profile_id, m)
  }

  // Org affiliations from both membership and staff tables.
  const orgIdsByProfile = new Map<string, Set<string>>()
  const addOrg = (profileId: string, orgId: string) => {
    if (!profileId || !orgId) return
    const set = orgIdsByProfile.get(profileId) ?? new Set<string>()
    set.add(orgId)
    orgIdsByProfile.set(profileId, set)
  }
  for (const m of membersRes.rows) addOrg(m.profile_id, m.organization_id)
  for (const s of staffRes.rows) addOrg(s.profile_id, s.organization_id)

  // Prefer the admin API. If it is unreachable, fall back to last-activity
  // derived from user_activity so retention degrades to "approximate" rather
  // than disappearing entirely.
  let signInMap = authRes.map
  let signInSource: IdentityGraph['signInSource'] = 'auth_admin_api'

  if (signInMap === null) {
    const fallback = await fetchLastActivityFallback(client)
    if (fallback.size > 0) {
      signInMap = fallback
      signInSource = 'activity_fallback'
      warnings.push(
        `Sign-in history unavailable (${authRes.reason ?? 'unknown'}). Falling back to last activity from user_activity — this UNDER-reports, because users who signed in without triggering a logged event are invisible, and nothing exists before telemetry was enabled.`
      )
    } else {
      signInSource = 'unavailable'
      warnings.push(
        `Sign-in history unavailable (${authRes.reason ?? 'unknown'}) and no user_activity fallback. Activation and retention are UNKNOWN, not zero.`
      )
    }
  }

  const signInDataUnavailable = signInMap === null

  const users: ResolvedUser[] = profilesRes.rows.map((p) => {
    const orgIdSet = orgIdsByProfile.get(p.id) ?? new Set<string>()
    const orgIds = Array.from(orgIdSet)

    // Precedence is deliberate and matches the validated production query:
    // a coach who is also staff is a coach.
    const membership = membershipByProfile.get(p.id)
    let kind: UserKind = 'guardian'
    if (coachProfileIds.has(p.id)) kind = 'coach'
    else if (membership) kind = 'mdc_member'
    else if (staffProfileIds.has(p.id)) kind = 'staff'

    // League-legacy only when the user has orgs AND every one is a league org.
    // A user with zero orgs is unclassifiable, not legacy.
    const isLeagueLegacy =
      orgIds.length > 0 &&
      orgIds.every((id) => orgs.get(id)?.business_type === LEAGUE_BUSINESS_TYPE)

    const lastSignInAt = signInMap ? (signInMap.get(p.id) ?? null) : null

    return {
      profileId: p.id,
      fullName: p.full_name,
      email: p.email,
      kind,
      signedUpAt: toDate(p.created_at),
      lastSignInAt,
      neverActivated: signInMap ? lastSignInAt === null : false,
      orgIds,
      isLeagueLegacy,
      membership: membership
        ? {
            status: membership.status,
            memberType: membership.member_type,
            billingMode: membership.billing_mode,
            source: membership.source,
            leagueName: membership.league_name,
            activatedAt: toDate(membership.activated_at),
            onboardingCompletedAt: toDate(membership.onboarding_completed_at),
          }
        : undefined,
    }
  })

  const byId = new Map(users.map((u) => [u.profileId, u]))

  return {
    users,
    byId,
    orgs,
    signInDataUnavailable,
    signInUnavailableReason: authRes.reason,
    signInSource,
    warnings,
  }
}

/** Applies the global league toggle. Excluding is the default everywhere. */
export function applyLeagueFilter(users: ResolvedUser[], includeLeague: boolean): ResolvedUser[] {
  return includeLeague ? users : users.filter((u) => !u.isLeagueLegacy)
}
