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
      activeUsersCurrent,
      activeUsersPrior,
      evalsCurrent,
      evalsPrior,
      plansCurrent,
      plansPrior,
      opensCurrent,
      opensPrior,
      sparklineData,
      coachData,
      parentData,
    ] = await Promise.all([
      // Q1 - Active Users Current
      customerClient
        .from('user_activity')
        .select('profile_id')
        .eq('organization_id', orgId)
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Q1 - Active Users Prior
      customerClient
        .from('user_activity')
        .select('profile_id')
        .eq('organization_id', orgId)
        .gte('timestamp', priorFrom.toISOString())
        .lte('timestamp', priorTo.toISOString()),

      // Q2 - Evaluations Current
      customerClient
        .from('user_activity')
        .select('id, profile_id')
        .eq('organization_id', orgId)
        .eq('event_details->>feature', 'evaluations')
        .eq('event_details->>action', 'submit')
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Q2 - Evaluations Prior
      customerClient
        .from('user_activity')
        .select('id, profile_id')
        .eq('organization_id', orgId)
        .eq('event_details->>feature', 'evaluations')
        .eq('event_details->>action', 'submit')
        .gte('timestamp', priorFrom.toISOString())
        .lte('timestamp', priorTo.toISOString()),

      // Q3 - Plans Generated Current
      customerClient
        .from('user_activity')
        .select('id')
        .eq('organization_id', orgId)
        .eq('event_details->>feature', 'player_plans')
        .eq('event_details->>action', 'generated')
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Q3 - Plans Generated Prior
      customerClient
        .from('user_activity')
        .select('id')
        .eq('organization_id', orgId)
        .eq('event_details->>feature', 'player_plans')
        .eq('event_details->>action', 'generated')
        .gte('timestamp', priorFrom.toISOString())
        .lte('timestamp', priorTo.toISOString()),

      // Q4 - Plans Opened by Parents Current
      customerClient
        .from('user_activity')
        .select('id, profile_id')
        .eq('organization_id', orgId)
        .eq('event_details->>feature', 'player_plans')
        .eq('event_details->>action', 'open')
        .eq('event_details->>viewer_role', 'parent')
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Q4 - Plans Opened by Parents Prior
      customerClient
        .from('user_activity')
        .select('id, profile_id')
        .eq('organization_id', orgId)
        .eq('event_details->>feature', 'player_plans')
        .eq('event_details->>action', 'open')
        .eq('event_details->>viewer_role', 'parent')
        .gte('timestamp', priorFrom.toISOString())
        .lte('timestamp', priorTo.toISOString()),

      // Q6 - Sparkline (last 14 days)
      customerClient
        .from('user_activity')
        .select('timestamp, profile_id, event_details')
        .eq('organization_id', orgId)
        .gte('timestamp', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),

      // Q7 - Top Coaches
      customerClient
        .from('user_activity')
        .select('profile_id, timestamp, event_details')
        .eq('organization_id', orgId)
        .in('event_details->>viewer_role', ['coach', 'admin', 'staff'])
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),

      // Q8 - Top Parents
      customerClient
        .from('user_activity')
        .select('profile_id, timestamp')
        .eq('organization_id', orgId)
        .eq('event_details->>feature', 'player_plans')
        .eq('event_details->>action', 'open')
        .eq('event_details->>viewer_role', 'parent')
        .gte('timestamp', from.toISOString())
        .lte('timestamp', to.toISOString()),
    ])

    // Process results
    type ActivityRow = { profile_id: string; timestamp?: string; event_details?: Record<string, unknown> }

    const activeUsersCurrentCount = new Set((activeUsersCurrent.data as ActivityRow[] || []).map(r => r.profile_id)).size
    const activeUsersPriorCount = new Set((activeUsersPrior.data as ActivityRow[] || []).map(r => r.profile_id)).size

    const evalsCurrentData = evalsCurrent.data as ActivityRow[] || []
    const evalsPriorData = evalsPrior.data as ActivityRow[] || []
    const evalsCurrentCount = evalsCurrentData.length
    const evalsPriorCount = evalsPriorData.length
    const uniqueCoaches = new Set(evalsCurrentData.map(r => r.profile_id)).size

    const plansCurrentCount = (plansCurrent.data || []).length
    const plansPriorCount = (plansPrior.data || []).length

    const opensCurrentData = opensCurrent.data as ActivityRow[] || []
    const opensPriorData = opensPrior.data as ActivityRow[] || []
    const opensCurrentCount = opensCurrentData.length
    const opensPriorCount = opensPriorData.length
    const uniqueParents = new Set(opensCurrentData.map(r => r.profile_id)).size

    // Calculate open rate
    const openRateCurrent = plansCurrentCount > 0 ? (opensCurrentCount / plansCurrentCount) * 100 : null
    const openRatePrior = plansPriorCount > 0 ? (opensPriorCount / plansPriorCount) * 100 : null
    const openRateDelta = openRateCurrent !== null && openRatePrior !== null
      ? openRateCurrent - openRatePrior : null

    // Process sparkline
    type SparklineRow = { timestamp: string; profile_id: string; event_details: Record<string, unknown> | null }
    const sparklineRows = sparklineData.data as SparklineRow[] || []
    const dailyMap = new Map<string, { active_users: Set<string>; evaluations: number; plans_generated: number; plans_opened: number }>()

    for (const row of sparklineRows) {
      const date = new Date(row.timestamp).toISOString().split('T')[0]
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { active_users: new Set(), evaluations: 0, plans_generated: 0, plans_opened: 0 })
      }
      const day = dailyMap.get(date)!
      day.active_users.add(row.profile_id)

      const details = row.event_details || {}
      const feature = details.feature as string
      const action = details.action as string
      const role = details.viewer_role as string

      if (feature === 'evaluations' && action === 'submit') {
        day.evaluations++
      }
      if (feature === 'player_plans' && action === 'generated') {
        day.plans_generated++
      }
      if (feature === 'player_plans' && action === 'open' && role === 'parent') {
        day.plans_opened++
      }
    }

    const sparkline = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        active_users: data.active_users.size,
        evaluations: data.evaluations,
        plans_generated: data.plans_generated,
        plans_opened: data.plans_opened,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Process top coaches
    type CoachRow = { profile_id: string; timestamp: string; event_details: Record<string, unknown> | null }
    const coachRows = coachData.data as CoachRow[] || []
    const coachMap = new Map<string, { evaluations: number; plans: number; lastActive: Date }>()

    for (const row of coachRows) {
      if (!coachMap.has(row.profile_id)) {
        coachMap.set(row.profile_id, { evaluations: 0, plans: 0, lastActive: new Date(row.timestamp) })
      }
      const coach = coachMap.get(row.profile_id)!
      const ts = new Date(row.timestamp)
      if (ts > coach.lastActive) coach.lastActive = ts

      const details = row.event_details || {}
      if (details.feature === 'evaluations' && details.action === 'submit') {
        coach.evaluations++
      }
      if (details.feature === 'player_plans' && details.action === 'generated') {
        coach.plans++
      }
    }

    const topCoachIds = Array.from(coachMap.entries())
      .sort((a, b) => b[1].evaluations - a[1].evaluations)
      .slice(0, 10)
      .map(([id]) => id)

    // Process top parents
    type ParentRow = { profile_id: string; timestamp: string }
    const parentRows = parentData.data as ParentRow[] || []
    const parentMap = new Map<string, { count: number; firstOpen: Date; lastOpen: Date }>()

    for (const row of parentRows) {
      const ts = new Date(row.timestamp)
      if (!parentMap.has(row.profile_id)) {
        parentMap.set(row.profile_id, { count: 0, firstOpen: ts, lastOpen: ts })
      }
      const parent = parentMap.get(row.profile_id)!
      parent.count++
      if (ts < parent.firstOpen) parent.firstOpen = ts
      if (ts > parent.lastOpen) parent.lastOpen = ts
    }

    const topParentIds = Array.from(parentMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([id]) => id)

    // Fetch profiles for coaches and parents
    const allProfileIds = Array.from(new Set([...topCoachIds, ...topParentIds]))
    type ProfileRow = { id: string; full_name: string | null; email: string | null }
    let profiles: ProfileRow[] = []

    if (allProfileIds.length > 0) {
      const { data: profileData } = await customerClient
        .from('profiles')
        .select('id, full_name, email')
        .in('id', allProfileIds)
      profiles = (profileData as ProfileRow[] | null) || []
    }

    const profileMap = new Map(profiles.map(p => [p.id, p]))

    const topCoaches = topCoachIds.map(id => {
      const coach = coachMap.get(id)!
      const profile = profileMap.get(id)
      return {
        profile_id: id,
        full_name: profile?.full_name || 'Unknown',
        email: profile?.email || '',
        evaluations_submitted: coach.evaluations,
        plans_generated: coach.plans,
        last_active: coach.lastActive.toISOString(),
      }
    })

    const topParents = topParentIds.map(id => {
      const parent = parentMap.get(id)!
      const profile = profileMap.get(id)
      return {
        profile_id: id,
        full_name: profile?.full_name || 'Unknown',
        email: profile?.email || '',
        plans_opened: parent.count,
        first_open: parent.firstOpen.toISOString(),
        last_open: parent.lastOpen.toISOString(),
      }
    })

    const hasData = activeUsersCurrentCount > 0 || evalsCurrentCount > 0 || plansCurrentCount > 0

    return NextResponse.json({
      success: true,
      hasData,
      range,
      metrics: {
        activeUsers: {
          current: activeUsersCurrentCount,
          prior: activeUsersPriorCount,
          delta: activeUsersCurrentCount - activeUsersPriorCount,
        },
        evaluationsSubmitted: {
          current: evalsCurrentCount,
          prior: evalsPriorCount,
          delta: evalsCurrentCount - evalsPriorCount,
          uniqueCoaches,
        },
        plansGenerated: {
          current: plansCurrentCount,
          prior: plansPriorCount,
          delta: plansCurrentCount - plansPriorCount,
        },
        plansOpenedByParents: {
          current: opensCurrentCount,
          prior: opensPriorCount,
          delta: opensCurrentCount - opensPriorCount,
          uniqueParents,
        },
        openRate: {
          current: openRateCurrent !== null ? Math.round(openRateCurrent * 10) / 10 : null,
          prior: openRatePrior !== null ? Math.round(openRatePrior * 10) / 10 : null,
          delta: openRateDelta !== null ? Math.round(openRateDelta * 10) / 10 : null,
        },
        medianTimeToOpen: {
          current: null, // Complex query - simplified for now
          unit: 'hours' as const,
        },
      },
      sparkline,
      topCoaches,
      topParents,
    })
  } catch (error) {
    console.error('Adoption API error:', error)
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
