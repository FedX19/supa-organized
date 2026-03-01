import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'

// Type for user_activity rows
interface UserActivityRow {
  id: string
  organization_id: string
  profile_id: string
  event_type: string
  event_details: Record<string, unknown> | null
  timestamp: string
}

// Generic supabase client type for customer databases (with any to handle dynamic schemas)
// biome-ignore lint: Dynamic customer database client
type AnySupabaseClient = ReturnType<typeof createClient<Record<string, never>>>

type MetricType =
  | 'overview'
  | 'features'
  | 'actions'
  | 'roles'
  | 'daily'
  | 'errors'
  | 'error_detail'
  | 'drilldown_feature'
  | 'drilldown_action'
  | 'drilldown_user'

interface QueryParams {
  org_id: string
  range: '7d' | '30d' | 'custom'
  date_from: string
  date_to: string
  role?: string
  event_type?: string
  metric: MetricType
  feature?: string
  action?: string
  profile_id?: string
}

function getDateRange(range: string, dateFrom?: string, dateTo?: string): { from: Date; to: Date } {
  const now = new Date()
  const to = dateTo ? new Date(dateTo) : now

  let from: Date
  if (range === 'custom' && dateFrom) {
    from = new Date(dateFrom)
  } else if (range === '30d') {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  } else {
    // Default to 7d
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }

  return { from, to }
}

async function getCustomerClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Server configuration error')
  }

  // Get access token from Authorization header
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization token')
  }
  const token = authHeader.substring(7)

  // Create Supabase client with auth token in headers for RLS
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  // Verify the user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // Get user's connection
  const { data: connection, error: connError } = await supabase
    .from('user_connections')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (connError || !connection) {
    throw new Error('No connection found')
  }

  // Decrypt the key
  const decrypted = decrypt(connection.encrypted_key)
  if (!decrypted) {
    throw new Error('Failed to decrypt credentials')
  }

  // Create customer client - cast to AnySupabaseClient for compatibility
  return createClient(connection.supabase_url, decrypted) as unknown as AnySupabaseClient
}

async function fetchOverviewMetrics(
  customerClient: AnySupabaseClient,
  orgId: string
) {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Run all queries in parallel
  const [
    activeUsers7dRes,
    activeUsers30dRes,
    totalEvents7dRes,
    totalEvents30dRes,
    errors7dRes,
    errors30dRes,
  ] = await Promise.all([
    // Active users 7d
    customerClient
      .from('user_activity')
      .select('profile_id')
      .eq('organization_id', orgId)
      .gte('timestamp', sevenDaysAgo.toISOString()),
    // Active users 30d
    customerClient
      .from('user_activity')
      .select('profile_id')
      .eq('organization_id', orgId)
      .gte('timestamp', thirtyDaysAgo.toISOString()),
    // Total events 7d
    customerClient
      .from('user_activity')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('timestamp', sevenDaysAgo.toISOString()),
    // Total events 30d
    customerClient
      .from('user_activity')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('timestamp', thirtyDaysAgo.toISOString()),
    // Errors 7d
    customerClient
      .from('user_activity')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('event_type', 'error')
      .gte('timestamp', sevenDaysAgo.toISOString()),
    // Errors 30d
    customerClient
      .from('user_activity')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('event_type', 'error')
      .gte('timestamp', thirtyDaysAgo.toISOString()),
  ])

  // Count distinct profile_ids - cast data to proper type
  const users7dData = activeUsers7dRes.data as { profile_id: string }[] | null
  const users30dData = activeUsers30dRes.data as { profile_id: string }[] | null
  const activeUsers7d = new Set((users7dData || []).map(r => r.profile_id)).size
  const activeUsers30d = new Set((users30dData || []).map(r => r.profile_id)).size
  const totalEvents7d = totalEvents7dRes.count || 0
  const totalEvents30d = totalEvents30dRes.count || 0
  const errors7d = errors7dRes.count || 0
  const errors30d = errors30dRes.count || 0

  return {
    activeUsers7d,
    activeUsers30d,
    totalEvents7d,
    totalEvents30d,
    errors7d,
    errors30d,
    errorRate7d: totalEvents7d > 0 ? ((errors7d / totalEvents7d) * 100).toFixed(2) : '0.00',
    errorRate30d: totalEvents30d > 0 ? ((errors30d / totalEvents30d) * 100).toFixed(2) : '0.00',
    avgEventsPerUser7d: activeUsers7d > 0 ? (totalEvents7d / activeUsers7d).toFixed(1) : '0',
    avgEventsPerUser30d: activeUsers30d > 0 ? (totalEvents30d / activeUsers30d).toFixed(1) : '0',
  }
}

async function fetchFeatures(
  customerClient: AnySupabaseClient,
  orgId: string,
  dateFrom: Date,
  dateTo: Date,
  role?: string
) {
  // Build base query for feature counts
  let query = customerClient
    .from('user_activity')
    .select('event_details, profile_id')
    .eq('organization_id', orgId)
    .gte('timestamp', dateFrom.toISOString())
    .lte('timestamp', dateTo.toISOString())

  if (role) {
    query = query.eq('event_details->>viewer_role', role)
  }

  const { data, error } = await query

  if (error) {
    console.error('Features query error:', error)
    return { features: [] }
  }

  // Cast data to proper type
  const rows = data as Pick<UserActivityRow, 'event_details' | 'profile_id'>[] | null

  // Aggregate features
  const featureMap = new Map<string, { count: number; users: Set<string>; byRole: Record<string, number> }>()

  for (const row of rows || []) {
    const details = row.event_details
    const feature = (details?.feature as string) || 'unknown'
    const viewerRole = (details?.viewer_role as string) || 'unknown'
    const profileId = row.profile_id

    if (!featureMap.has(feature)) {
      featureMap.set(feature, { count: 0, users: new Set(), byRole: {} })
    }

    const entry = featureMap.get(feature)!
    entry.count++
    entry.users.add(profileId)
    entry.byRole[viewerRole] = (entry.byRole[viewerRole] || 0) + 1
  }

  // Convert to array and sort
  const features = Array.from(featureMap.entries())
    .map(([feature, data]) => ({
      feature,
      event_count: data.count,
      unique_users: data.users.size,
      by_role: {
        coach: data.byRole['coach'] || 0,
        parent: data.byRole['parent'] || 0,
        admin: data.byRole['admin'] || 0,
        staff: data.byRole['staff'] || 0,
        unknown: data.byRole['unknown'] || 0,
      },
    }))
    .sort((a, b) => b.event_count - a.event_count)
    .slice(0, 20)

  return { features }
}

async function fetchActions(
  customerClient: AnySupabaseClient,
  orgId: string,
  dateFrom: Date,
  dateTo: Date
) {
  // Get actions with counts
  const { data, error } = await customerClient
    .from('user_activity')
    .select('event_details, profile_id, event_type')
    .eq('organization_id', orgId)
    .gte('timestamp', dateFrom.toISOString())
    .lte('timestamp', dateTo.toISOString())
    .not('event_details->>action', 'is', null)

  if (error) {
    console.error('Actions query error:', error)
    return { actions: [] }
  }

  // Cast data to proper type
  const rows = data as Pick<UserActivityRow, 'event_details' | 'profile_id' | 'event_type'>[] | null

  // Aggregate actions
  const actionMap = new Map<string, { count: number; users: Set<string>; errors: number }>()

  for (const row of rows || []) {
    const details = row.event_details
    const action = (details?.action as string) || 'unknown'
    const profileId = row.profile_id
    const isError = row.event_type === 'error'

    if (!actionMap.has(action)) {
      actionMap.set(action, { count: 0, users: new Set(), errors: 0 })
    }

    const entry = actionMap.get(action)!
    entry.count++
    entry.users.add(profileId)
    if (isError) entry.errors++
  }

  const actions = Array.from(actionMap.entries())
    .map(([action, data]) => ({
      action,
      event_count: data.count,
      unique_users: data.users.size,
      error_count: data.errors,
    }))
    .sort((a, b) => b.event_count - a.event_count)
    .slice(0, 20)

  return { actions }
}

async function fetchRoles(
  customerClient: AnySupabaseClient,
  orgId: string,
  dateFrom: Date,
  dateTo: Date
) {
  const { data, error } = await customerClient
    .from('user_activity')
    .select('event_details, profile_id')
    .eq('organization_id', orgId)
    .gte('timestamp', dateFrom.toISOString())
    .lte('timestamp', dateTo.toISOString())

  if (error) {
    console.error('Roles query error:', error)
    return { roles: [] }
  }

  // Cast data to proper type
  const rows = data as Pick<UserActivityRow, 'event_details' | 'profile_id'>[] | null

  // Aggregate roles
  const roleMap = new Map<string, { count: number; users: Set<string> }>()

  for (const row of rows || []) {
    const details = row.event_details
    const role = (details?.viewer_role as string) || 'unknown'
    const profileId = row.profile_id

    if (!roleMap.has(role)) {
      roleMap.set(role, { count: 0, users: new Set() })
    }

    const entry = roleMap.get(role)!
    entry.count++
    entry.users.add(profileId)
  }

  const roles = Array.from(roleMap.entries())
    .map(([viewer_role, data]) => ({
      viewer_role,
      event_count: data.count,
      unique_users: data.users.size,
    }))
    .sort((a, b) => b.event_count - a.event_count)

  return { roles }
}

async function fetchDaily(
  customerClient: AnySupabaseClient,
  orgId: string,
  dateFrom: Date,
  dateTo: Date
) {
  const { data, error } = await customerClient
    .from('user_activity')
    .select('timestamp, event_type, profile_id')
    .eq('organization_id', orgId)
    .gte('timestamp', dateFrom.toISOString())
    .lte('timestamp', dateTo.toISOString())
    .order('timestamp', { ascending: true })

  if (error) {
    console.error('Daily query error:', error)
    return { daily: [] }
  }

  // Cast data to proper type
  const rows = data as Pick<UserActivityRow, 'timestamp' | 'event_type' | 'profile_id'>[] | null

  // Aggregate by day
  const dayMap = new Map<string, { total: number; errors: number; users: Set<string> }>()

  for (const row of rows || []) {
    const date = new Date(row.timestamp).toISOString().split('T')[0]
    const isError = row.event_type === 'error'
    const profileId = row.profile_id

    if (!dayMap.has(date)) {
      dayMap.set(date, { total: 0, errors: 0, users: new Set() })
    }

    const entry = dayMap.get(date)!
    entry.total++
    if (isError) entry.errors++
    entry.users.add(profileId)
  }

  const daily = Array.from(dayMap.entries())
    .map(([date, data]) => ({
      date,
      total_events: data.total,
      error_events: data.errors,
      unique_users: data.users.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { daily }
}

async function fetchErrors(
  customerClient: AnySupabaseClient,
  orgId: string,
  dateFrom: Date,
  dateTo: Date
) {
  const { data, error } = await customerClient
    .from('user_activity')
    .select('event_details, profile_id, timestamp')
    .eq('organization_id', orgId)
    .eq('event_type', 'error')
    .gte('timestamp', dateFrom.toISOString())
    .lte('timestamp', dateTo.toISOString())

  if (error) {
    console.error('Errors query error:', error)
    return { errors: [] }
  }

  // Cast data to proper type
  const rows = data as Pick<UserActivityRow, 'event_details' | 'profile_id' | 'timestamp'>[] | null

  // Aggregate by feature + error_code
  const errorMap = new Map<string, { count: number; users: Set<string>; lastSeen: Date }>()

  for (const row of rows || []) {
    const details = row.event_details
    const feature = (details?.feature as string) || 'unknown'
    const errorCode = (details?.error_code as string) || 'unknown'
    const key = `${feature}::${errorCode}`
    const profileId = row.profile_id
    const timestamp = new Date(row.timestamp)

    if (!errorMap.has(key)) {
      errorMap.set(key, { count: 0, users: new Set(), lastSeen: timestamp })
    }

    const entry = errorMap.get(key)!
    entry.count++
    entry.users.add(profileId)
    if (timestamp > entry.lastSeen) entry.lastSeen = timestamp
  }

  const errors = Array.from(errorMap.entries())
    .map(([key, data]) => {
      const [feature, error_code] = key.split('::')
      return {
        feature,
        error_code,
        count: data.count,
        unique_users: data.users.size,
        last_seen: data.lastSeen.toISOString(),
      }
    })
    .sort((a, b) => b.count - a.count)

  return { errors }
}

async function fetchErrorDetail(
  customerClient: AnySupabaseClient,
  orgId: string,
  dateFrom: Date,
  dateTo: Date
) {
  const { data, error } = await customerClient
    .from('user_activity')
    .select('timestamp, profile_id, event_details')
    .eq('organization_id', orgId)
    .eq('event_type', 'error')
    .gte('timestamp', dateFrom.toISOString())
    .lte('timestamp', dateTo.toISOString())
    .order('timestamp', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error detail query error:', error)
    return { error_details: [] }
  }

  // Cast data to proper type
  const rows = data as Pick<UserActivityRow, 'timestamp' | 'profile_id' | 'event_details'>[] | null

  const error_details = (rows || []).map(row => {
    const details = row.event_details
    return {
      timestamp: row.timestamp,
      profile_id: row.profile_id,
      feature: (details?.feature as string) || 'unknown',
      action: (details?.action as string) || null,
      error_code: (details?.error_code as string) || 'unknown',
      http_status: details?.http_status ? Number(details.http_status) : null,
      route: (details?.route as string) || null,
    }
  })

  return { error_details }
}

async function fetchDrilldownFeature(
  customerClient: AnySupabaseClient,
  orgId: string,
  dateFrom: Date,
  dateTo: Date,
  feature: string
) {
  // Get top users for this feature
  const { data: activityData, error: activityError } = await customerClient
    .from('user_activity')
    .select('profile_id, timestamp, event_type, event_details')
    .eq('organization_id', orgId)
    .gte('timestamp', dateFrom.toISOString())
    .lte('timestamp', dateTo.toISOString())

  if (activityError) {
    console.error('Drilldown feature query error:', activityError)
    return { top_users: [], recent_events: [] }
  }

  // Cast data to proper type
  const rows = activityData as Pick<UserActivityRow, 'profile_id' | 'timestamp' | 'event_type' | 'event_details'>[] | null

  // Filter by feature (handle coalesce manually)
  const filteredData = (rows || []).filter(row => {
    const details = row.event_details
    const rowFeature = (details?.feature as string) || 'unknown'
    return rowFeature === feature
  })

  // Aggregate by user
  const userMap = new Map<string, number>()
  for (const row of filteredData) {
    userMap.set(row.profile_id, (userMap.get(row.profile_id) || 0) + 1)
  }

  // Get top 10 users
  const topUserIds = Array.from(userMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  // Fetch profile info for top users
  type ProfileRow = { id: string; full_name: string | null; email: string | null }
  let profiles: ProfileRow[] = []
  if (topUserIds.length > 0) {
    const { data: profileData } = await customerClient
      .from('profiles')
      .select('id, full_name, email')
      .in('id', topUserIds)

    profiles = (profileData as ProfileRow[] | null) || []
  }

  const profileMap = new Map(profiles.map(p => [p.id, p]))

  const top_users = topUserIds.map(id => ({
    profile_id: id,
    full_name: profileMap.get(id)?.full_name || 'Unknown',
    email: profileMap.get(id)?.email || null,
    count: userMap.get(id) || 0,
  }))

  // Get recent events
  const recent_events = filteredData
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50)
    .map(row => {
      const details = row.event_details
      return {
        timestamp: row.timestamp,
        event_type: row.event_type,
        feature: (details?.feature as string) || 'unknown',
        action: (details?.action as string) || null,
        viewer_role: (details?.viewer_role as string) || null,
        route: (details?.route as string) || null,
      }
    })

  return { top_users, recent_events }
}

async function fetchDrilldownAction(
  customerClient: AnySupabaseClient,
  orgId: string,
  dateFrom: Date,
  dateTo: Date,
  action: string
) {
  // Get activity filtered by action
  const { data: activityData, error: activityError } = await customerClient
    .from('user_activity')
    .select('profile_id, timestamp, event_type, event_details')
    .eq('organization_id', orgId)
    .gte('timestamp', dateFrom.toISOString())
    .lte('timestamp', dateTo.toISOString())

  if (activityError) {
    console.error('Drilldown action query error:', activityError)
    return { top_users: [], recent_events: [] }
  }

  // Cast data to proper type
  const rows = activityData as Pick<UserActivityRow, 'profile_id' | 'timestamp' | 'event_type' | 'event_details'>[] | null

  // Filter by action
  const filteredData = (rows || []).filter(row => {
    const details = row.event_details
    return (details?.action as string) === action
  })

  // Aggregate by user
  const userMap = new Map<string, number>()
  for (const row of filteredData) {
    userMap.set(row.profile_id, (userMap.get(row.profile_id) || 0) + 1)
  }

  // Get top 10 users
  const topUserIds = Array.from(userMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  // Fetch profile info
  type ProfileRow = { id: string; full_name: string | null; email: string | null }
  let profiles: ProfileRow[] = []
  if (topUserIds.length > 0) {
    const { data: profileData } = await customerClient
      .from('profiles')
      .select('id, full_name, email')
      .in('id', topUserIds)

    profiles = (profileData as ProfileRow[] | null) || []
  }

  const profileMap = new Map(profiles.map(p => [p.id, p]))

  const top_users = topUserIds.map(id => ({
    profile_id: id,
    full_name: profileMap.get(id)?.full_name || 'Unknown',
    email: profileMap.get(id)?.email || null,
    count: userMap.get(id) || 0,
  }))

  // Get recent events
  const recent_events = filteredData
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50)
    .map(row => {
      const details = row.event_details
      return {
        timestamp: row.timestamp,
        event_type: row.event_type,
        feature: (details?.feature as string) || 'unknown',
        action: (details?.action as string) || null,
        viewer_role: (details?.viewer_role as string) || null,
        route: (details?.route as string) || null,
      }
    })

  return { top_users, recent_events }
}

async function fetchDrilldownUser(
  customerClient: AnySupabaseClient,
  orgId: string,
  dateFrom: Date,
  dateTo: Date,
  profileId: string
) {
  // Get profile info
  type ProfileRow = { id: string; full_name: string | null; email: string | null }
  const { data: profileData } = await customerClient
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', profileId)
    .single()

  const profile = profileData as ProfileRow | null

  // Get user's activity
  const { data: activityData, error: activityError } = await customerClient
    .from('user_activity')
    .select('timestamp, event_type, event_details')
    .eq('organization_id', orgId)
    .eq('profile_id', profileId)
    .gte('timestamp', dateFrom.toISOString())
    .lte('timestamp', dateTo.toISOString())
    .order('timestamp', { ascending: false })
    .limit(100)

  if (activityError) {
    console.error('Drilldown user query error:', activityError)
    return { profile: null, events: [] }
  }

  // Cast data to proper type
  const rows = activityData as Pick<UserActivityRow, 'timestamp' | 'event_type' | 'event_details'>[] | null

  const events = (rows || []).map(row => {
    const details = row.event_details
    return {
      timestamp: row.timestamp,
      event_type: row.event_type,
      feature: (details?.feature as string) || 'unknown',
      action: (details?.action as string) || null,
      viewer_role: (details?.viewer_role as string) || null,
      route: (details?.route as string) || null,
      error_code: (details?.error_code as string) || null,
    }
  })

  return {
    profile: profile
      ? {
          id: profile.id,
          full_name: profile.full_name || 'Unknown',
          email: profile.email || null,
        }
      : null,
    events,
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orgId = searchParams.get('org_id')
    const range = (searchParams.get('range') || '7d') as '7d' | '30d' | 'custom'
    const dateFromParam = searchParams.get('date_from')
    const dateToParam = searchParams.get('date_to')
    const role = searchParams.get('role') || undefined
    const eventType = searchParams.get('event_type') || undefined
    const metric = (searchParams.get('metric') || 'overview') as MetricType
    const feature = searchParams.get('feature') || undefined
    const action = searchParams.get('action') || undefined
    const profileId = searchParams.get('profile_id') || undefined

    if (!orgId) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }

    const customerClient = await getCustomerClient(request)
    const { from: dateFrom, to: dateTo } = getDateRange(range, dateFromParam || undefined, dateToParam || undefined)

    let result: Record<string, unknown>

    switch (metric) {
      case 'overview':
        result = await fetchOverviewMetrics(customerClient, orgId)
        break
      case 'features':
        result = await fetchFeatures(customerClient, orgId, dateFrom, dateTo, role)
        break
      case 'actions':
        result = await fetchActions(customerClient, orgId, dateFrom, dateTo)
        break
      case 'roles':
        result = await fetchRoles(customerClient, orgId, dateFrom, dateTo)
        break
      case 'daily':
        result = await fetchDaily(customerClient, orgId, dateFrom, dateTo)
        break
      case 'errors':
        result = await fetchErrors(customerClient, orgId, dateFrom, dateTo)
        break
      case 'error_detail':
        result = await fetchErrorDetail(customerClient, orgId, dateFrom, dateTo)
        break
      case 'drilldown_feature':
        if (!feature) {
          return NextResponse.json({ error: 'feature param required for drilldown_feature' }, { status: 400 })
        }
        result = await fetchDrilldownFeature(customerClient, orgId, dateFrom, dateTo, feature)
        break
      case 'drilldown_action':
        if (!action) {
          return NextResponse.json({ error: 'action param required for drilldown_action' }, { status: 400 })
        }
        result = await fetchDrilldownAction(customerClient, orgId, dateFrom, dateTo, action)
        break
      case 'drilldown_user':
        if (!profileId) {
          return NextResponse.json({ error: 'profile_id param required for drilldown_user' }, { status: 400 })
        }
        result = await fetchDrilldownUser(customerClient, orgId, dateFrom, dateTo, profileId)
        break
      default:
        return NextResponse.json({ error: 'Invalid metric type' }, { status: 400 })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Analytics API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'

    if (message === 'Unauthorized' || message === 'Missing authorization token') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (message === 'No connection found') {
      return NextResponse.json({ error: message }, { status: 404 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
