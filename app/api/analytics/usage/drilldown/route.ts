import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'

type RangeType = '7d' | '30d'
type MetricType = 'logins' | 'active_users' | 'feature_events'

function getDateRange(range: RangeType) {
  const now = new Date()
  const days = range === '30d' ? 30 : 7
  const ms = days * 24 * 60 * 60 * 1000
  return {
    from: new Date(now.getTime() - ms).toISOString(),
    to: now.toISOString(),
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
    const metric = searchParams.get('metric') as MetricType

    if (!orgId) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }

    if (!metric || !['logins', 'active_users', 'feature_events'].includes(metric)) {
      return NextResponse.json({ error: 'metric must be logins, active_users, or feature_events' }, { status: 400 })
    }

    const customerClient = await getCustomerClient(request)
    const { from, to } = getDateRange(range)

    type UserData = { count: number; lastActive: Date }
    const userMap = new Map<string, UserData>()

    if (metric === 'logins') {
      // Users who logged in: auth/login events
      const { data } = await customerClient
        .from('user_activity')
        .select('profile_id, timestamp')
        .eq('organization_id', orgId)
        .gte('timestamp', from)
        .lt('timestamp', to)
        .contains('event_details', { feature: 'auth', action: 'login' })

      type Row = { profile_id: string; timestamp: string }
      const rows = (data as Row[] | null) || []
      for (const row of rows) {
        const ts = new Date(row.timestamp)
        if (!userMap.has(row.profile_id)) {
          userMap.set(row.profile_id, { count: 0, lastActive: ts })
        }
        const user = userMap.get(row.profile_id)!
        user.count++
        if (ts > user.lastActive) user.lastActive = ts
      }
    } else if (metric === 'active_users') {
      // Users who were active: org_context/load OR feature_used
      const [contextResult, featureResult] = await Promise.all([
        customerClient
          .from('user_activity')
          .select('profile_id, timestamp')
          .eq('organization_id', orgId)
          .gte('timestamp', from)
          .lt('timestamp', to)
          .contains('event_details', { feature: 'org_context', action: 'load' }),
        customerClient
          .from('user_activity')
          .select('profile_id, timestamp')
          .eq('organization_id', orgId)
          .eq('event_type', 'feature_used')
          .gte('timestamp', from)
          .lt('timestamp', to),
      ])

      type Row = { profile_id: string; timestamp: string }
      const contextRows = (contextResult.data as Row[] | null) || []
      const featureRows = (featureResult.data as Row[] | null) || []
      const allRows = [...contextRows, ...featureRows]

      for (const row of allRows) {
        const ts = new Date(row.timestamp)
        if (!userMap.has(row.profile_id)) {
          userMap.set(row.profile_id, { count: 0, lastActive: ts })
        }
        const user = userMap.get(row.profile_id)!
        user.count++
        if (ts > user.lastActive) user.lastActive = ts
      }
    } else {
      // feature_events: all feature_used events
      const { data } = await customerClient
        .from('user_activity')
        .select('profile_id, timestamp')
        .eq('organization_id', orgId)
        .eq('event_type', 'feature_used')
        .gte('timestamp', from)
        .lt('timestamp', to)

      type Row = { profile_id: string; timestamp: string }
      const rows = (data as Row[] | null) || []
      for (const row of rows) {
        const ts = new Date(row.timestamp)
        if (!userMap.has(row.profile_id)) {
          userMap.set(row.profile_id, { count: 0, lastActive: ts })
        }
        const user = userMap.get(row.profile_id)!
        user.count++
        if (ts > user.lastActive) user.lastActive = ts
      }
    }

    // Get top 20 users sorted by count
    const topUserIds = Array.from(userMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
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

    const users = topUserIds.map(id => {
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

    return NextResponse.json({
      success: true,
      metric,
      range,
      users,
    })
  } catch (error) {
    console.error('Drilldown API error:', error)
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
