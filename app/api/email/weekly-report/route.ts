import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'
import {
  queryLogins,
  queryActiveUsers,
  queryFunnel,
  queryTimeToOpen,
  queryFeatureBreakdown,
  queryErrors,
  queryParentEvents,
} from '@/lib/analytics-queries'
import { WeeklyReportData, OrgWeeklyStats, Alert, PlatformTotals } from '@/lib/email-types'
import { generateWeeklyReportHTML, generateWeeklyReportSubject } from '@/lib/email-templates/weekly-report'
import { sendWeeklyReport } from '@/lib/email'

function getWeekRanges() {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7))
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekEnd = now

  const priorStart = new Date(weekStart)
  priorStart.setUTCDate(priorStart.getUTCDate() - 7)
  const priorEnd = new Date(weekStart)

  return { weekStart, weekEnd, priorStart, priorEnd }
}

async function getCustomerClientFromBearer(request: NextRequest) {
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

async function getCustomerClientFromCron() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) throw new Error('Server configuration error')

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get first connection
  const { data: connection, error: connError } = await supabase
    .from('user_connections')
    .select('*')
    .limit(1)
    .single()

  if (connError || !connection) throw new Error('No connection found')

  const decrypted = decrypt(connection.encrypted_key)
  if (!decrypted) throw new Error('Failed to decrypt credentials')

  return createClient(connection.supabase_url, decrypted)
}

async function verifyUser(token: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return false

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  return !error && !!user
}

type AnyClient = { from: ReturnType<typeof createClient>['from'] }

async function processOrg(
  customerClient: AnyClient,
  org: { id: string; name: string; org_type?: string },
  currentStart: string,
  currentEnd: string,
  priorStart: string,
  priorEnd: string
): Promise<OrgWeeklyStats> {
  try {
    const [
      loginsCurrent,
      loginsPrior,
      activeUsersCurrent,
      activeUsersPrior,
      funnelCurrent,
      timeToOpen,
      features,
      errors,
      parentEvents,
    ] = await Promise.all([
      queryLogins(customerClient, org.id, currentStart, currentEnd),
      queryLogins(customerClient, org.id, priorStart, priorEnd),
      queryActiveUsers(customerClient, org.id, currentStart, currentEnd),
      queryActiveUsers(customerClient, org.id, priorStart, priorEnd),
      queryFunnel(customerClient, org.id, currentStart, currentEnd),
      queryTimeToOpen(customerClient, org.id, currentStart, currentEnd),
      queryFeatureBreakdown(customerClient, org.id, currentStart, currentEnd),
      queryErrors(customerClient, org.id, currentStart, currentEnd),
      queryParentEvents(customerClient, org.id, currentStart, currentEnd),
    ])

    const hasAnyActivity = loginsCurrent.uniqueLogins > 0 ||
      activeUsersCurrent.uniqueActiveUsers > 0

    return {
      orgId: org.id,
      orgName: org.name,
      orgType: org.org_type || 'unknown',
      logins: {
        current: loginsCurrent.uniqueLogins,
        prior: loginsPrior.uniqueLogins,
        byRole: loginsCurrent.byRole,
      },
      activeUsers: {
        current: activeUsersCurrent.uniqueActiveUsers,
        prior: activeUsersPrior.uniqueActiveUsers,
      },
      activityEvents: activeUsersCurrent.totalActivityEvents,
      funnel: {
        evaluationsSubmitted: funnelCurrent.evalsSubmitted,
        coachesWhoSubmitted: funnelCurrent.coachCount,
        plansGenerated: funnelCurrent.plansGenerated,
        parentOpens: funnelCurrent.parentOpens,
        uniqueParents: funnelCurrent.parentCount,
        openRate: funnelCurrent.openRate,
        medianHoursToOpen: timeToOpen.medianHours,
        p75HoursToOpen: timeToOpen.p75Hours,
        funnelBroken: funnelCurrent.funnelBroken,
      },
      topFeatures: features.slice(0, 5),
      errors: {
        total: errors.total,
        rate: errors.rate,
        topErrors: errors.topErrors,
      },
      isGhost: loginsCurrent.uniqueLogins === 0 && loginsPrior.uniqueLogins > 0,
      isCoachOnly: parentEvents === 0 && funnelCurrent.evalsSubmitted > 0,
      hasAnyActivity,
    }
  } catch (error) {
    console.error(`[weekly-report] Error processing org ${org.name}:`, error)
    return {
      orgId: org.id,
      orgName: org.name,
      orgType: org.org_type || 'unknown',
      logins: { current: 0, prior: 0, byRole: { platform_admin: 0, admin: 0, coach: 0, parent: 0, unknown: 0 } },
      activeUsers: { current: 0, prior: 0 },
      activityEvents: 0,
      funnel: {
        evaluationsSubmitted: 0, coachesWhoSubmitted: 0, plansGenerated: 0,
        parentOpens: 0, uniqueParents: 0, openRate: null,
        medianHoursToOpen: null, p75HoursToOpen: null, funnelBroken: false,
      },
      topFeatures: [],
      errors: { total: 0, rate: 0, topErrors: [] },
      isGhost: false,
      isCoachOnly: false,
      hasAnyActivity: false,
    }
  }
}

function buildAlerts(orgs: OrgWeeklyStats[]): Alert[] {
  const alerts: Alert[] = []

  for (const org of orgs) {
    // Ghost org
    if (org.logins.current === 0 && org.logins.prior > 0) {
      alerts.push({
        orgId: org.orgId,
        orgName: org.orgName,
        severity: 'warning',
        message: `went dark — no logins this week (had ${org.logins.prior} last week)`,
      })
    }

    // Funnel broken
    if (org.funnel.plansGenerated > 0 && org.funnel.parentOpens === 0) {
      alerts.push({
        orgId: org.orgId,
        orgName: org.orgName,
        severity: 'critical',
        message: `${org.funnel.plansGenerated} plans generated, zero parent opens`,
      })
    }

    // Coach-only
    if (org.isCoachOnly) {
      alerts.push({
        orgId: org.orgId,
        orgName: org.orgName,
        severity: 'info',
        message: 'coaches are active but no parents engaged',
      })
    }

    // Slow adoption
    if (org.funnel.medianHoursToOpen !== null && org.funnel.medianHoursToOpen > 48) {
      alerts.push({
        orgId: org.orgId,
        orgName: org.orgName,
        severity: 'warning',
        message: `median time-to-open is ${org.funnel.medianHoursToOpen}h (target < 24h)`,
      })
    }

    // High error rate
    if (org.errors.rate > 5) {
      alerts.push({
        orgId: org.orgId,
        orgName: org.orgName,
        severity: 'critical',
        message: `${org.errors.rate}% error rate this week`,
      })
    }

    // Login without engagement
    if (org.logins.current > 3 && org.activeUsers.current < org.logins.current * 0.5) {
      const pct = Math.round((org.activeUsers.current / org.logins.current) * 100)
      alerts.push({
        orgId: org.orgId,
        orgName: org.orgName,
        severity: 'warning',
        message: `${org.logins.current} logins but only ${org.activeUsers.current} active users (${pct}% engagement after login)`,
      })
    }
  }

  // Sort: critical → warning → info
  const order = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => order[a.severity] - order[b.severity])

  return alerts
}

function buildPlatformTotals(orgs: OrgWeeklyStats[]): PlatformTotals {
  let loginsCurrent = 0, loginsPrior = 0
  let activeCurrent = 0, activePrior = 0
  let evalsCurrent = 0, evalsPrior = 0
  let plansCurrent = 0, plansPrior = 0
  let opensCurrent = 0, opensPrior = 0
  let totalErrors = 0, totalEvents = 0

  for (const org of orgs) {
    loginsCurrent += org.logins.current
    loginsPrior += org.logins.prior
    activeCurrent += org.activeUsers.current
    activePrior += org.activeUsers.prior
    evalsCurrent += org.funnel.evaluationsSubmitted
    plansCurrent += org.funnel.plansGenerated
    opensCurrent += org.funnel.parentOpens
    totalErrors += org.errors.total
    totalEvents += org.activityEvents
  }

  // Can't easily get prior funnel totals without per-org prior data, but we stored current only
  // Use 0 for prior since the org stats don't track prior funnel individually
  const platformOpenRate = plansCurrent > 0
    ? Math.round((opensCurrent / plansCurrent) * 100)
    : null

  const errorRate = totalEvents > 0
    ? Math.round((totalErrors / totalEvents) * 10000) / 100
    : 0

  return {
    totalLogins: { current: loginsCurrent, prior: loginsPrior, delta: loginsCurrent - loginsPrior },
    totalActiveUsers: { current: activeCurrent, prior: activePrior, delta: activeCurrent - activePrior },
    totalEvaluations: { current: evalsCurrent, prior: evalsPrior, delta: evalsCurrent - evalsPrior },
    totalPlansGenerated: { current: plansCurrent, prior: plansPrior, delta: plansCurrent - plansPrior },
    totalParentOpens: { current: opensCurrent, prior: opensPrior, delta: opensCurrent - opensPrior },
    platformOpenRate,
    totalErrors,
    errorRate,
  }
}

async function buildReportData(customerClient: AnyClient): Promise<WeeklyReportData> {
  const { weekStart, weekEnd, priorStart, priorEnd } = getWeekRanges()

  const currentStartISO = weekStart.toISOString()
  const currentEndISO = weekEnd.toISOString()
  const priorStartISO = priorStart.toISOString()
  const priorEndISO = priorEnd.toISOString()

  // Fetch all orgs
  const { data: orgs, error: orgsError } = await customerClient
    .from('organizations')
    .select('id, name, slug, org_type')
    .order('created_at', { ascending: true })

  if (orgsError || !orgs) {
    throw new Error('Failed to fetch organizations')
  }

  type OrgRow = { id: string; name: string; slug?: string; org_type?: string }
  const orgList = orgs as OrgRow[]

  console.log('[weekly-report] Processing', orgList.length, 'orgs')

  // Process all orgs in parallel
  const orgStats = await Promise.all(
    orgList.map(org => processOrg(
      customerClient, org,
      currentStartISO, currentEndISO,
      priorStartISO, priorEndISO
    ))
  )

  const alerts = buildAlerts(orgStats)
  const platform = buildPlatformTotals(orgStats)

  console.log('[weekly-report] Alerts:', alerts.length)

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    platform,
    orgs: orgStats,
    alerts,
  }
}

// GET: Preview JSON (authenticated users)
export async function GET(request: NextRequest) {
  try {
    const customerClient = await getCustomerClientFromBearer(request)
    const reportData = await buildReportData(customerClient)
    return NextResponse.json(reportData)
  } catch (error) {
    console.error('Weekly report GET error:', error)
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

// POST: Send email (cron or authenticated user)
export async function POST(request: NextRequest) {
  try {
    // Auth: cron secret OR valid Bearer token
    const cronSecret = request.headers.get('x-cron-secret')
    const bearerToken = request.headers.get('authorization')?.replace('Bearer ', '')
    const isValidCron = cronSecret === process.env.CRON_SECRET
    const isValidUser = bearerToken ? await verifyUser(bearerToken) : false

    if (!isValidCron && !isValidUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get customer client based on auth method
    let customerClient: AnyClient
    if (isValidUser && bearerToken) {
      customerClient = await getCustomerClientFromBearer(request)
    } else {
      customerClient = await getCustomerClientFromCron()
    }

    const reportData = await buildReportData(customerClient)
    const html = generateWeeklyReportHTML(reportData)
    const subject = generateWeeklyReportSubject(reportData)

    await sendWeeklyReport(html, subject)

    console.log('[weekly-report] Email sent to', process.env.FOUNDER_EMAIL)

    return NextResponse.json({
      success: true,
      orgsProcessed: reportData.orgs.length,
      alertCount: reportData.alerts.length,
    })
  } catch (error) {
    console.error('Weekly report POST error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
