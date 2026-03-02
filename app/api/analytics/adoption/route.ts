import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'
import {
  queryLogins,
  queryActiveUsers,
  queryFunnel,
  queryTimeToOpen,
  queryDailyBreakdown,
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

    // Run all metrics in parallel using shared query helpers
    const [
      loginsCurrent,
      loginsPrior,
      activeUsersCurrent,
      activeUsersPrior,
      funnelCurrent,
      funnelPrior,
      timeToOpen,
      sparklineData,
      coachData,
      parentData,
    ] = await Promise.all([
      queryLogins(customerClient, orgId, fromISO, toISO),
      queryLogins(customerClient, orgId, priorFromISO, priorToISO),
      queryActiveUsers(customerClient, orgId, fromISO, toISO),
      queryActiveUsers(customerClient, orgId, priorFromISO, priorToISO),
      queryFunnel(customerClient, orgId, fromISO, toISO),
      queryFunnel(customerClient, orgId, priorFromISO, priorToISO),
      queryTimeToOpen(customerClient, orgId, fromISO, toISO),
      queryDailyBreakdown(
        customerClient,
        orgId,
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        new Date().toISOString()
      ),
      // Top coaches (evals + plans by coach-role users)
      customerClient
        .from('user_activity')
        .select('profile_id, timestamp, event_details')
        .eq('organization_id', orgId)
        .gte('timestamp', fromISO)
        .lt('timestamp', toISO),
      // Top parents (plan opens)
      customerClient
        .from('user_activity')
        .select('profile_id, timestamp')
        .eq('organization_id', orgId)
        .gte('timestamp', fromISO)
        .lt('timestamp', toISO)
        .contains('event_details', { feature: 'player_plans', action: 'open', viewer_role: 'parent' }),
    ])

    // Open rate
    const openRateCurrent = funnelCurrent.openRate
    const openRatePrior = funnelPrior.openRate
    const openRateDelta = openRateCurrent !== null && openRatePrior !== null
      ? Math.round((openRateCurrent - openRatePrior) * 10) / 10 : null

    // Process sparkline - map daily breakdown to adoption sparkline format
    const sparkline = sparklineData.map(d => ({
      date: d.date,
      logins: d.logins,
      active_users: d.active_users,
      evaluations: d.evals,
      plans_generated: d.plans_generated,
      plans_opened: d.parent_opens,
    }))

    // Process top coaches
    type CoachRow = { profile_id: string; timestamp: string; event_details: Record<string, unknown> | null }
    const coachRows = coachData.data as CoachRow[] || []
    const coachMap = new Map<string, { evaluations: number; plans: number; lastActive: Date }>()

    for (const row of coachRows) {
      const details = row.event_details || {}
      const feature = details.feature as string
      const action = details.action as string
      const isCoachAction =
        (feature === 'evaluations' && action === 'submit') ||
        (feature === 'player_plans' && action === 'generated')
      if (!isCoachAction) continue

      if (!coachMap.has(row.profile_id)) {
        coachMap.set(row.profile_id, { evaluations: 0, plans: 0, lastActive: new Date(row.timestamp) })
      }
      const coach = coachMap.get(row.profile_id)!
      const ts = new Date(row.timestamp)
      if (ts > coach.lastActive) coach.lastActive = ts
      if (feature === 'evaluations' && action === 'submit') coach.evaluations++
      if (feature === 'player_plans' && action === 'generated') coach.plans++
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

    // Fetch profiles
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

    const hasData = loginsCurrent.uniqueLogins > 0 || activeUsersCurrent.uniqueActiveUsers > 0 ||
      funnelCurrent.evalsSubmitted > 0 || funnelCurrent.plansGenerated > 0

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
        evaluationsSubmitted: {
          current: funnelCurrent.evalsSubmitted,
          prior: funnelPrior.evalsSubmitted,
          delta: funnelCurrent.evalsSubmitted - funnelPrior.evalsSubmitted,
          uniqueCoaches: funnelCurrent.coachCount,
        },
        plansGenerated: {
          current: funnelCurrent.plansGenerated,
          prior: funnelPrior.plansGenerated,
          delta: funnelCurrent.plansGenerated - funnelPrior.plansGenerated,
        },
        plansOpenedByParents: {
          current: funnelCurrent.parentOpens,
          prior: funnelPrior.parentOpens,
          delta: funnelCurrent.parentOpens - funnelPrior.parentOpens,
          uniqueParents: funnelCurrent.parentCount,
        },
        openRate: {
          current: openRateCurrent,
          prior: openRatePrior,
          delta: openRateDelta,
        },
        medianTimeToOpen: {
          medianHours: timeToOpen.medianHours,
          p75Hours: timeToOpen.p75Hours,
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
