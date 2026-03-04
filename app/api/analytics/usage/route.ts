import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'
import {
  queryLogins,
  queryActiveUsers,
  queryFeatureBreakdown,
  queryDailyBreakdown,
  normalizeRole,
} from '@/lib/analytics-queries'

type RangeType = '7d' | '30d'

function getDateRanges(range: RangeType) {
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

  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Server configuration error')

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing authorization token')
  const token = authHeader.substring(7)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) throw new Error('Unauthorized')

  const { data: connection, error: connError } = await supabase
    .from('user_connections')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (connError || !connection) throw new Error('No connection found')

  const decrypted = decrypt(connection.encrypted_key)
  if (!decrypted) throw new Error('Failed to decrypt credentials')

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
    const fromISO = from.toISOString()
    const toISO = to.toISOString()
    const priorFromISO = priorFrom.toISOString()
    const priorToISO = priorTo.toISOString()

    // Run all queries in parallel using shared helpers
    const [
      loginsCurrent,
      loginsPrior,
      activeUsersCurrent,
      activeUsersPrior,
      featureBreakdown,
      dailyActivity,
      allEventsData,
      hourlyData,
      topUsersData,
    ] = await Promise.all([
      queryLogins(customerClient, orgId, fromISO, toISO),
      queryLogins(customerClient, orgId, priorFromISO, priorToISO),
      queryActiveUsers(customerClient, orgId, fromISO, toISO),
      queryActiveUsers(customerClient, orgId, priorFromISO, priorToISO),
      queryFeatureBreakdown(customerClient, orgId, fromISO, toISO),
      queryDailyBreakdown(
        customerClient,
        orgId,
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        new Date().toISOString()
      ),
      // Action + role breakdown (all events in period)
      customerClient
        .from('user_activity')
        .select('event_details')
        .eq('organization_id', orgId)
        .eq('event_type', 'feature_used')
        .gte('timestamp', fromISO)
        .lt('timestamp', toISO),
      // Hourly distribution
      customerClient
        .from('user_activity')
        .select('timestamp')
        .eq('organization_id', orgId)
        .gte('timestamp', fromISO)
        .lt('timestamp', toISO),
      // Top users by activity
      customerClient
        .from('user_activity')
        .select('profile_id, timestamp')
        .eq('organization_id', orgId)
        .eq('event_type', 'feature_used')
        .gte('timestamp', fromISO)
        .lt('timestamp', toISO),
    ])

    // Process action breakdown from feature_used events
    type EventRow = { event_details: Record<string, unknown> | null }
    const eventRows = allEventsData.data as EventRow[] || []
    const actionMap = new Map<string, number>()
    const roleMap = new Map<string, number>()
    for (const row of eventRows) {
      const action = (row.event_details?.action as string) || 'unknown'
      actionMap.set(action, (actionMap.get(action) || 0) + 1)
      // Normalize roles to 5-value set (platform_admin, admin, coach, parent, unknown)
      const rawRole = row.event_details?.viewer_role as string | undefined
      const role = normalizeRole(rawRole)
      roleMap.set(role, (roleMap.get(role) || 0) + 1)
    }
    const actionBreakdown = Array.from(actionMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
    const roleBreakdown = Array.from(roleMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Process hourly distribution
    type HourlyRow = { timestamp: string }
    const hourlyRows = hourlyData.data as HourlyRow[] || []
    const hourlyMap = new Map<number, number>()
    for (let i = 0; i < 24; i++) hourlyMap.set(i, 0)
    for (const row of hourlyRows) {
      const hour = new Date(row.timestamp).getHours()
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1)
    }
    const hourlyDistribution = Array.from(hourlyMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour)

    // Process top users
    type UserRow = { profile_id: string; timestamp: string }
    const userRows = topUsersData.data as UserRow[] || []
    const userMap = new Map<string, { count: number; lastActive: Date }>()
    for (const row of userRows) {
      const ts = new Date(row.timestamp)
      if (!userMap.has(row.profile_id)) {
        userMap.set(row.profile_id, { count: 0, lastActive: ts })
      }
      const user = userMap.get(row.profile_id)!
      user.count++
      if (ts > user.lastActive) user.lastActive = ts
    }

    const topUserIds = Array.from(userMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([id]) => id)

    // Fetch profiles
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

    const topUsers = topUserIds.map(id => {
      const user = userMap.get(id)!
      const profile = profileMap.get(id)
      return {
        profile_id: id,
        full_name: profile?.full_name || 'Unknown',
        email: profile?.email || '',
        event_count: user.count,
        last_active: user.lastActive.toISOString(),
      }
    })

    const days = range === '30d' ? 30 : 7
    const hasData = activeUsersCurrent.totalActivityEvents > 0

    return NextResponse.json({
      success: true,
      hasData,
      range,
      metrics: {
        logins: {
          current: loginsCurrent.uniqueLogins,
          prior: loginsPrior.uniqueLogins,
          delta: loginsCurrent.uniqueLogins - loginsPrior.uniqueLogins,
        },
        activeUsers: {
          current: activeUsersCurrent.uniqueActiveUsers,
          prior: activeUsersPrior.uniqueActiveUsers,
          delta: activeUsersCurrent.uniqueActiveUsers - activeUsersPrior.uniqueActiveUsers,
        },
        totalFeatureEvents: {
          current: activeUsersCurrent.totalActivityEvents,
          prior: activeUsersPrior.totalActivityEvents,
          delta: activeUsersCurrent.totalActivityEvents - activeUsersPrior.totalActivityEvents,
        },
        avgEventsPerDay: {
          current: Math.round(activeUsersCurrent.totalActivityEvents / days),
          prior: Math.round(activeUsersPrior.totalActivityEvents / days),
        },
      },
      loginsByRole: loginsCurrent.byRole,
      featureBreakdown: featureBreakdown.map(f => ({ name: f.feature, count: f.event_count })),
      actionBreakdown,
      roleBreakdown,
      dailyActivity: dailyActivity.map(d => ({
        date: d.date,
        logins: d.logins,
        activeUsers: d.active_users,
        events: d.feature_events,
      })),
      hourlyDistribution,
      topUsers,
    })
  } catch (error) {
    console.error('Usage API error:', error)
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
