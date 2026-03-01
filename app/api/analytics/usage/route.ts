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
      totalEventsCurrent,
      totalEventsPrior,
      featureData,
      actionData,
      roleData,
      dailyData,
      hourlyData,
      topUsersData,
    ] = await Promise.all([
      // Total events current period
      customerClient
        .from('user_activity')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Total events prior period
      customerClient
        .from('user_activity')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('timestamp', priorFrom.toISOString())
        .lte('timestamp', priorTo.toISOString()),

      // Feature breakdown
      customerClient
        .from('user_activity')
        .select('event_details')
        .eq('organization_id', orgId)
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Action breakdown
      customerClient
        .from('user_activity')
        .select('event_details')
        .eq('organization_id', orgId)
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Role breakdown
      customerClient
        .from('user_activity')
        .select('event_details')
        .eq('organization_id', orgId)
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Daily activity (last 14 days for sparkline)
      customerClient
        .from('user_activity')
        .select('timestamp, profile_id')
        .eq('organization_id', orgId)
        .gte('timestamp', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),

      // Hourly distribution (current period)
      customerClient
        .from('user_activity')
        .select('timestamp')
        .eq('organization_id', orgId)
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Top users by activity
      customerClient
        .from('user_activity')
        .select('profile_id, timestamp')
        .eq('organization_id', orgId)
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),
    ])

    // Process feature breakdown
    type EventRow = { event_details: Record<string, unknown> | null }
    const featureRows = featureData.data as EventRow[] || []
    const featureMap = new Map<string, number>()
    for (const row of featureRows) {
      const feature = (row.event_details?.feature as string) || 'unknown'
      featureMap.set(feature, (featureMap.get(feature) || 0) + 1)
    }
    const featureBreakdown = Array.from(featureMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Process action breakdown
    const actionRows = actionData.data as EventRow[] || []
    const actionMap = new Map<string, number>()
    for (const row of actionRows) {
      const action = (row.event_details?.action as string) || 'unknown'
      actionMap.set(action, (actionMap.get(action) || 0) + 1)
    }
    const actionBreakdown = Array.from(actionMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Process role breakdown
    const roleRows = roleData.data as EventRow[] || []
    const roleMap = new Map<string, number>()
    for (const row of roleRows) {
      const role = (row.event_details?.viewer_role as string) || 'unknown'
      roleMap.set(role, (roleMap.get(role) || 0) + 1)
    }
    const roleBreakdown = Array.from(roleMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Process daily activity
    type DailyRow = { timestamp: string; profile_id: string }
    const dailyRows = dailyData.data as DailyRow[] || []
    const dailyMap = new Map<string, { events: number; users: Set<string> }>()
    for (const row of dailyRows) {
      const date = new Date(row.timestamp).toISOString().split('T')[0]
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { events: 0, users: new Set() })
      }
      const day = dailyMap.get(date)!
      day.events++
      day.users.add(row.profile_id)
    }
    const dailyActivity = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        events: data.events,
        uniqueUsers: data.users.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Process hourly distribution
    type HourlyRow = { timestamp: string }
    const hourlyRows = hourlyData.data as HourlyRow[] || []
    const hourlyMap = new Map<number, number>()
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(i, 0)
    }
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

    // Fetch profiles for top users
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

    const totalCurrentCount = totalEventsCurrent.count || 0
    const totalPriorCount = totalEventsPrior.count || 0
    const hasData = totalCurrentCount > 0

    return NextResponse.json({
      success: true,
      hasData,
      range,
      metrics: {
        totalEvents: {
          current: totalCurrentCount,
          prior: totalPriorCount,
          delta: totalCurrentCount - totalPriorCount,
        },
        avgEventsPerDay: {
          current: Math.round(totalCurrentCount / (range === '30d' ? 30 : 7)),
          prior: Math.round(totalPriorCount / (range === '30d' ? 30 : 7)),
        },
        uniqueUsersInPeriod: new Set(userRows.map(r => r.profile_id)).size,
      },
      featureBreakdown,
      actionBreakdown,
      roleBreakdown,
      dailyActivity,
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
