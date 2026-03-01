import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'

type RangeType = '7d' | '30d'

interface DateRange {
  from: Date
  to: Date
  priorFrom: Date
  priorTo: Date
}

function getDateRanges(range: RangeType): DateRange {
  const now = new Date()
  const days = range === '30d' ? 30 : 7
  const ms = days * 24 * 60 * 60 * 1000

  return {
    from: new Date(now.getTime() - ms),
    to: now,
    priorFrom: new Date(now.getTime() - 2 * ms),
    priorTo: new Date(now.getTime() - ms),
  }
}

async function getCustomerClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Server configuration error')
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization token')
  }
  const token = authHeader.substring(7)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  const { data: connection, error: connError } = await supabase
    .from('user_connections')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (connError || !connection) {
    throw new Error('No connection found')
  }

  const decrypted = decrypt(connection.encrypted_key)
  if (!decrypted) {
    throw new Error('Failed to decrypt credentials')
  }

  return createClient(connection.supabase_url, decrypted)
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orgId = searchParams.get('org_id')
    const range = (searchParams.get('range') || '7d') as RangeType

    if (!orgId) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }

    const customerClient = await getCustomerClient(request)
    const { from, to, priorFrom, priorTo } = getDateRanges(range)

    // Run all queries in parallel
    const [
      errorsCurrent,
      errorsPrior,
      totalEventsCurrent,
      recentErrors,
      dailyErrors,
      errorsByCode,
      errorsByRoute,
      errorsByUser,
    ] = await Promise.all([
      // Errors current period
      customerClient
        .from('user_activity')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('event_type', 'error')
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Errors prior period
      customerClient
        .from('user_activity')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('event_type', 'error')
        .gte('timestamp', priorFrom.toISOString())
        .lte('timestamp', priorTo.toISOString()),

      // Total events current period (for error rate)
      customerClient
        .from('user_activity')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Recent errors (last 50)
      customerClient
        .from('user_activity')
        .select('id, profile_id, event_details, timestamp')
        .eq('organization_id', orgId)
        .eq('event_type', 'error')
        .gte('timestamp', from.toISOString())
        .order('timestamp', { ascending: false })
        .limit(50),

      // Daily error counts (last 14 days)
      customerClient
        .from('user_activity')
        .select('timestamp')
        .eq('organization_id', orgId)
        .eq('event_type', 'error')
        .gte('timestamp', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),

      // Errors by error_code
      customerClient
        .from('user_activity')
        .select('event_details')
        .eq('organization_id', orgId)
        .eq('event_type', 'error')
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Errors by route
      customerClient
        .from('user_activity')
        .select('event_details')
        .eq('organization_id', orgId)
        .eq('event_type', 'error')
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Errors by user
      customerClient
        .from('user_activity')
        .select('profile_id')
        .eq('organization_id', orgId)
        .eq('event_type', 'error')
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),
    ])

    const errorsCurrentCount = errorsCurrent.count || 0
    const errorsPriorCount = errorsPrior.count || 0
    const totalEventsCount = totalEventsCurrent.count || 0

    // Calculate error rate
    const errorRate = totalEventsCount > 0 ? (errorsCurrentCount / totalEventsCount) * 100 : 0

    // Process recent errors
    type ErrorRow = {
      id: string
      profile_id: string
      event_details: Record<string, unknown> | null
      timestamp: string
    }
    const recentErrorRows = recentErrors.data as ErrorRow[] || []

    // Get unique profile IDs for lookup
    const profileIds = Array.from(new Set(recentErrorRows.map(r => r.profile_id)))
    type ProfileRow = { id: string; full_name: string | null; email: string | null }
    let profiles: ProfileRow[] = []
    if (profileIds.length > 0) {
      const { data: profileData } = await customerClient
        .from('profiles')
        .select('id, full_name, email')
        .in('id', profileIds)
      profiles = (profileData as ProfileRow[] | null) || []
    }
    const profileMap = new Map(profiles.map(p => [p.id, p]))

    const recentErrorsList = recentErrorRows.map(row => {
      const profile = profileMap.get(row.profile_id)
      return {
        id: row.id,
        timestamp: row.timestamp,
        profile_id: row.profile_id,
        full_name: profile?.full_name || 'Unknown',
        email: profile?.email || '',
        error_code: (row.event_details?.error_code as string) || 'unknown',
        http_status: (row.event_details?.http_status as number) || null,
        route: (row.event_details?.route as string) || 'unknown',
        feature: (row.event_details?.feature as string) || 'unknown',
        source: (row.event_details?.source as string) || 'unknown',
      }
    })

    // Process daily errors
    type DailyRow = { timestamp: string }
    const dailyRows = dailyErrors.data as DailyRow[] || []
    const dailyMap = new Map<string, number>()
    for (const row of dailyRows) {
      const date = new Date(row.timestamp).toISOString().split('T')[0]
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1)
    }
    const dailyErrorCounts = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Process errors by code
    type EventDetailsRow = { event_details: Record<string, unknown> | null }
    const codeRows = errorsByCode.data as EventDetailsRow[] || []
    const codeMap = new Map<string, number>()
    for (const row of codeRows) {
      const code = (row.event_details?.error_code as string) || 'unknown'
      codeMap.set(code, (codeMap.get(code) || 0) + 1)
    }
    const errorCodeBreakdown = Array.from(codeMap.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)

    // Process errors by route
    const routeRows = errorsByRoute.data as EventDetailsRow[] || []
    const routeMap = new Map<string, number>()
    for (const row of routeRows) {
      const route = (row.event_details?.route as string) || 'unknown'
      routeMap.set(route, (routeMap.get(route) || 0) + 1)
    }
    const errorRouteBreakdown = Array.from(routeMap.entries())
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Process errors by user
    type UserRow = { profile_id: string }
    const userRows = errorsByUser.data as UserRow[] || []
    const userMap = new Map<string, number>()
    for (const row of userRows) {
      userMap.set(row.profile_id, (userMap.get(row.profile_id) || 0) + 1)
    }
    const topErrorUserIds = Array.from(userMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id)

    // Fetch additional profiles for top error users
    const additionalIds = topErrorUserIds.filter(id => !profileMap.has(id))
    if (additionalIds.length > 0) {
      const { data: additionalProfiles } = await customerClient
        .from('profiles')
        .select('id, full_name, email')
        .in('id', additionalIds)
      for (const p of (additionalProfiles as ProfileRow[] || [])) {
        profileMap.set(p.id, p)
      }
    }

    const topErrorUsers = topErrorUserIds.map(id => {
      const profile = profileMap.get(id)
      return {
        profile_id: id,
        full_name: profile?.full_name || 'Unknown',
        email: profile?.email || '',
        error_count: userMap.get(id) || 0,
      }
    })

    const hasData = errorsCurrentCount > 0 || totalEventsCount > 0

    return NextResponse.json({
      success: true,
      hasData,
      range,
      metrics: {
        totalErrors: {
          current: errorsCurrentCount,
          prior: errorsPriorCount,
          delta: errorsCurrentCount - errorsPriorCount,
        },
        errorRate: {
          current: Math.round(errorRate * 100) / 100,
          unit: '%' as const,
        },
        uniqueUsersAffected: new Set(userRows.map(r => r.profile_id)).size,
      },
      dailyErrorCounts,
      errorCodeBreakdown,
      errorRouteBreakdown,
      topErrorUsers,
      recentErrors: recentErrorsList,
    })
  } catch (error) {
    console.error('Errors API error:', error)
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
