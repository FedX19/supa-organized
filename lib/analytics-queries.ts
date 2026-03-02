import { SupabaseClient } from '@supabase/supabase-js'

// Generic client type that works with any Supabase client instance
type AnyClient = { from: SupabaseClient['from'] }

// ═══════════════════════════════════════════
// METRIC A: Logins
// ═══════════════════════════════════════════
// "How many users came back this week"
// event_details->>'feature' = 'auth' AND event_details->>'action' = 'login'

export interface LoginResult {
  uniqueLogins: number
  totalLoginEvents: number
  byRole: { coach: number; parent: number; admin: number; staff: number; unknown: number }
}

export async function queryLogins(
  client: AnyClient,
  orgId: string,
  start: string,
  end: string
): Promise<LoginResult> {
  const { data, error } = await client
    .from('user_activity')
    .select('profile_id, event_details')
    .eq('organization_id', orgId)
    .gte('timestamp', start)
    .lt('timestamp', end)
    .contains('event_details', { feature: 'auth', action: 'login' })

  if (error || !data) {
    return { uniqueLogins: 0, totalLoginEvents: 0, byRole: { coach: 0, parent: 0, admin: 0, staff: 0, unknown: 0 } }
  }

  type Row = { profile_id: string; event_details: Record<string, unknown> | null }
  const rows = data as Row[]
  const uniqueIds = new Set(rows.map(r => r.profile_id))
  const byRole = { coach: 0, parent: 0, admin: 0, staff: 0, unknown: 0 }

  for (const row of rows) {
    const role = (row.event_details?.viewer_role as string) || 'unknown'
    if (role in byRole) {
      byRole[role as keyof typeof byRole]++
    } else {
      byRole.unknown++
    }
  }

  return {
    uniqueLogins: uniqueIds.size,
    totalLoginEvents: rows.length,
    byRole,
  }
}

// ═══════════════════════════════════════════
// METRIC B: Active Users
// ═══════════════════════════════════════════
// "How many users did something meaningful after logging in"
// org_context/load OR event_type = 'feature_used'

export interface ActiveUsersResult {
  uniqueActiveUsers: number
  totalActivityEvents: number
}

export async function queryActiveUsers(
  client: AnyClient,
  orgId: string,
  start: string,
  end: string
): Promise<ActiveUsersResult> {
  // We need two separate queries since Supabase doesn't support OR across different columns well
  const [contextResult, featureResult] = await Promise.all([
    client
      .from('user_activity')
      .select('profile_id')
      .eq('organization_id', orgId)
      .gte('timestamp', start)
      .lt('timestamp', end)
      .contains('event_details', { feature: 'org_context', action: 'load' }),
    client
      .from('user_activity')
      .select('profile_id')
      .eq('organization_id', orgId)
      .eq('event_type', 'feature_used')
      .gte('timestamp', start)
      .lt('timestamp', end),
  ])

  type Row = { profile_id: string }
  const contextRows = (contextResult.data as Row[] | null) || []
  const featureRows = (featureResult.data as Row[] | null) || []
  const allRows = [...contextRows, ...featureRows]
  const uniqueIds = new Set(allRows.map(r => r.profile_id))

  return {
    uniqueActiveUsers: uniqueIds.size,
    totalActivityEvents: allRows.length,
  }
}

// ═══════════════════════════════════════════
// METRIC C: Feature Breakdown
// ═══════════════════════════════════════════
// "What are they actually using"
// event_type = 'feature_used', excludes auth & org_context

export interface FeatureBreakdownItem {
  feature: string
  event_count: number
  unique_users: number
}

export async function queryFeatureBreakdown(
  client: AnyClient,
  orgId: string,
  start: string,
  end: string
): Promise<FeatureBreakdownItem[]> {
  const { data, error } = await client
    .from('user_activity')
    .select('profile_id, event_details')
    .eq('organization_id', orgId)
    .eq('event_type', 'feature_used')
    .gte('timestamp', start)
    .lt('timestamp', end)

  if (error || !data) return []

  type Row = { profile_id: string; event_details: Record<string, unknown> | null }
  const rows = data as Row[]

  const featureMap = new Map<string, { count: number; users: Set<string> }>()
  for (const row of rows) {
    const feature = (row.event_details?.feature as string) || 'unknown'
    if (feature === 'auth' || feature === 'org_context') continue

    if (!featureMap.has(feature)) {
      featureMap.set(feature, { count: 0, users: new Set() })
    }
    const entry = featureMap.get(feature)!
    entry.count++
    entry.users.add(row.profile_id)
  }

  return Array.from(featureMap.entries())
    .map(([feature, data]) => ({
      feature,
      event_count: data.count,
      unique_users: data.users.size,
    }))
    .sort((a, b) => b.event_count - a.event_count)
}

// ═══════════════════════════════════════════
// METRIC D: Funnel
// ═══════════════════════════════════════════

export interface FunnelResult {
  evalsSubmitted: number
  coachCount: number
  plansGenerated: number
  parentOpens: number
  parentCount: number
  openRate: number | null
  funnelBroken: boolean
}

export async function queryFunnel(
  client: AnyClient,
  orgId: string,
  start: string,
  end: string
): Promise<FunnelResult> {
  const [evalsResult, plansResult, opensResult] = await Promise.all([
    // D1: Evals submitted
    client
      .from('user_activity')
      .select('profile_id')
      .eq('organization_id', orgId)
      .gte('timestamp', start)
      .lt('timestamp', end)
      .contains('event_details', { feature: 'evaluations', action: 'submit' }),
    // D2: Plans generated
    client
      .from('user_activity')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('timestamp', start)
      .lt('timestamp', end)
      .contains('event_details', { feature: 'player_plans', action: 'generated' }),
    // D3: Parent opens
    client
      .from('user_activity')
      .select('profile_id')
      .eq('organization_id', orgId)
      .gte('timestamp', start)
      .lt('timestamp', end)
      .contains('event_details', { feature: 'player_plans', action: 'open', viewer_role: 'parent' }),
  ])

  type Row = { profile_id: string }
  const evalRows = (evalsResult.data as Row[] | null) || []
  const evalCoaches = new Set(evalRows.map(r => r.profile_id))
  const plansGenerated = plansResult.count || 0
  const openRows = (opensResult.data as Row[] | null) || []
  const openParents = new Set(openRows.map(r => r.profile_id))

  const openRate = plansGenerated > 0 ? Math.round((openRows.length / plansGenerated) * 100) : null
  const funnelBroken = plansGenerated > 0 && openRows.length === 0

  return {
    evalsSubmitted: evalRows.length,
    coachCount: evalCoaches.size,
    plansGenerated,
    parentOpens: openRows.length,
    parentCount: openParents.size,
    openRate,
    funnelBroken,
  }
}

// ═══════════════════════════════════════════
// METRIC E: Time to Open
// ═══════════════════════════════════════════

export interface TimeToOpenResult {
  medianHours: number | null
  p75Hours: number | null
}

export async function queryTimeToOpen(
  client: AnyClient,
  orgId: string,
  start: string,
  end: string
): Promise<TimeToOpenResult> {
  // Get generated events with player_id
  const [genResult, openResult] = await Promise.all([
    client
      .from('user_activity')
      .select('timestamp, event_details')
      .eq('organization_id', orgId)
      .gte('timestamp', start)
      .lt('timestamp', end)
      .contains('event_details', { feature: 'player_plans', action: 'generated' }),
    client
      .from('user_activity')
      .select('timestamp, event_details')
      .eq('organization_id', orgId)
      .gte('timestamp', start)
      .contains('event_details', { feature: 'player_plans', action: 'open', viewer_role: 'parent' }),
  ])

  type Row = { timestamp: string; event_details: Record<string, unknown> | null }
  const genRows = (genResult.data as Row[] | null) || []
  const openRows = (openResult.data as Row[] | null) || []

  if (genRows.length === 0) return { medianHours: null, p75Hours: null }

  // Build map of player_id -> first open time
  const firstOpenMap = new Map<string, Date>()
  for (const row of openRows) {
    const playerId = row.event_details?.player_id as string
    if (!playerId) continue
    const ts = new Date(row.timestamp)
    const existing = firstOpenMap.get(playerId)
    if (!existing || ts < existing) {
      firstOpenMap.set(playerId, ts)
    }
  }

  // Calculate hours between gen and first open for each plan
  const hoursArray: number[] = []
  for (const row of genRows) {
    const playerId = row.event_details?.player_id as string
    if (!playerId) continue
    const firstOpen = firstOpenMap.get(playerId)
    if (!firstOpen) continue
    const genTime = new Date(row.timestamp)
    if (firstOpen <= genTime) continue
    const hours = (firstOpen.getTime() - genTime.getTime()) / (1000 * 60 * 60)
    hoursArray.push(hours)
  }

  if (hoursArray.length === 0) return { medianHours: null, p75Hours: null }

  hoursArray.sort((a, b) => a - b)
  const median = percentile(hoursArray, 0.5)
  const p75 = percentile(hoursArray, 0.75)

  return {
    medianHours: Math.round(median * 10) / 10,
    p75Hours: Math.round(p75 * 10) / 10,
  }
}

function percentile(sortedArr: number[], p: number): number {
  const index = (sortedArr.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sortedArr[lower]
  return sortedArr[lower] * (upper - index) + sortedArr[upper] * (index - lower)
}

// ═══════════════════════════════════════════
// METRIC F: Errors
// ═══════════════════════════════════════════

export interface ErrorsResult {
  total: number
  rate: number
  topErrors: Array<{ feature: string; error_code: string; count: number }>
}

export async function queryErrors(
  client: AnyClient,
  orgId: string,
  start: string,
  end: string
): Promise<ErrorsResult> {
  const [errorsResult, totalEventsResult] = await Promise.all([
    client
      .from('user_activity')
      .select('event_details')
      .eq('organization_id', orgId)
      .eq('event_type', 'error')
      .gte('timestamp', start)
      .lt('timestamp', end),
    client
      .from('user_activity')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('timestamp', start)
      .lt('timestamp', end),
  ])

  type Row = { event_details: Record<string, unknown> | null }
  const errorRows = (errorsResult.data as Row[] | null) || []
  const totalEvents = totalEventsResult.count || 0
  const total = errorRows.length
  const rate = totalEvents > 0 ? Math.round((total / totalEvents) * 10000) / 100 : 0

  // Group by feature + error_code
  const errorMap = new Map<string, { feature: string; error_code: string; count: number }>()
  for (const row of errorRows) {
    const feature = (row.event_details?.feature as string) || 'unknown'
    const errorCode = (row.event_details?.error_code as string) || 'unknown'
    const key = `${feature}::${errorCode}`
    if (!errorMap.has(key)) {
      errorMap.set(key, { feature, error_code: errorCode, count: 0 })
    }
    errorMap.get(key)!.count++
  }

  const topErrors = Array.from(errorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return { total, rate, topErrors }
}

// ═══════════════════════════════════════════
// DAILY BREAKDOWN
// ═══════════════════════════════════════════

export interface DailyBreakdownItem {
  date: string
  logins: number
  active_users: number
  feature_events: number
  evals: number
  plans_generated: number
  parent_opens: number
  errors: number
}

export async function queryDailyBreakdown(
  client: AnyClient,
  orgId: string,
  start: string,
  end: string
): Promise<DailyBreakdownItem[]> {
  const { data, error } = await client
    .from('user_activity')
    .select('timestamp, profile_id, event_type, event_details')
    .eq('organization_id', orgId)
    .gte('timestamp', start)
    .lt('timestamp', end)

  if (error || !data) return []

  type Row = { timestamp: string; profile_id: string; event_type: string; event_details: Record<string, unknown> | null }
  const rows = data as Row[]

  const dayMap = new Map<string, {
    loginUsers: Set<string>
    activeUsers: Set<string>
    featureEvents: number
    evals: number
    plansGenerated: number
    parentOpens: number
    errors: number
  }>()

  for (const row of rows) {
    const date = new Date(row.timestamp).toISOString().split('T')[0]
    if (!dayMap.has(date)) {
      dayMap.set(date, {
        loginUsers: new Set(),
        activeUsers: new Set(),
        featureEvents: 0,
        evals: 0,
        plansGenerated: 0,
        parentOpens: 0,
        errors: 0,
      })
    }
    const day = dayMap.get(date)!
    const feature = row.event_details?.feature as string | undefined
    const action = row.event_details?.action as string | undefined
    const viewerRole = row.event_details?.viewer_role as string | undefined

    // Login
    if (feature === 'auth' && action === 'login') {
      day.loginUsers.add(row.profile_id)
    }

    // Active user (org_context/load OR feature_used)
    if ((feature === 'org_context' && action === 'load') || row.event_type === 'feature_used') {
      day.activeUsers.add(row.profile_id)
      if (row.event_type === 'feature_used') {
        day.featureEvents++
      }
    }

    // Funnel
    if (feature === 'evaluations' && action === 'submit') day.evals++
    if (feature === 'player_plans' && action === 'generated') day.plansGenerated++
    if (feature === 'player_plans' && action === 'open' && viewerRole === 'parent') day.parentOpens++

    // Errors
    if (row.event_type === 'error') day.errors++
  }

  return Array.from(dayMap.entries())
    .map(([date, d]) => ({
      date,
      logins: d.loginUsers.size,
      active_users: d.activeUsers.size,
      feature_events: d.featureEvents,
      evals: d.evals,
      plans_generated: d.plansGenerated,
      parent_opens: d.parentOpens,
      errors: d.errors,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ═══════════════════════════════════════════
// HELPER: Parent Events (for coach-only detection)
// ═══════════════════════════════════════════

export async function queryParentEvents(
  client: AnyClient,
  orgId: string,
  start: string,
  end: string
): Promise<number> {
  const { count } = await client
    .from('user_activity')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .gte('timestamp', start)
    .lt('timestamp', end)
    .contains('event_details', { viewer_role: 'parent' })

  return count || 0
}
