import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'
import type {
  RangeType,
  PlanFunnelResponse,
  FunnelStep,
  PlanRow,
  NotificationRow,
  EmailRow,
  ViewRow,
  PlanBreakdownItem,
} from '@/lib/plan-funnel-types'

function getDateRange(range: RangeType): { from: Date; to: Date } {
  const now = new Date()
  if (range === 'all') {
    return { from: new Date(0), to: now }
  }
  const days = range === '30d' ? 30 : 7
  const ms = days * 24 * 60 * 60 * 1000
  return {
    from: new Date(now.getTime() - ms),
    to: now,
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
    const range = (searchParams.get('range') || '30d') as RangeType

    if (!orgId) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }

    const customerClient = await getCustomerClient(request)
    const { from, to } = getDateRange(range)
    const fromISO = from.toISOString()
    const toISO = to.toISOString()

    // Run all queries in parallel
    const [
      plansResult,
      notificationsResult,
      emailsResult,
      readNotificationsResult,
      viewsResult,
    ] = await Promise.all([
      // Step 1: Plans Created
      customerClient
        .from('generated_plans')
        .select('id, player_id, created_at')
        .eq('org_id', orgId)
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false })
        .limit(500),

      // Step 2: Notifications Created (plan-related)
      customerClient
        .from('notifications')
        .select('id, profile_id, created_at, data, read_at, type')
        .eq('organization_id', orgId)
        .or('type.ilike.%plan%,type.ilike.%player_plan%')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false })
        .limit(500),

      // Step 3 & 4: Emails Sent (plan-related)
      customerClient
        .from('email_outbox')
        .select('id, profile_id, created_at, status, payload, sent_at, last_error, attempts, template')
        .eq('organization_id', orgId)
        .or('template.ilike.%plan%,template.ilike.%player_plan%')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false })
        .limit(500),

      // Step 5: Read notifications
      customerClient
        .from('notifications')
        .select('id, profile_id, created_at, data, read_at')
        .eq('organization_id', orgId)
        .or('type.ilike.%plan%,type.ilike.%player_plan%')
        .not('read_at', 'is', null)
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('read_at', { ascending: false })
        .limit(500),

      // Step 6: Plan Views from user_activity
      customerClient
        .from('user_activity')
        .select('profile_id, event_details, timestamp')
        .eq('organization_id', orgId)
        .or('event_type.eq.player_plan_viewed,event_type.eq.player_plans/open,event_type.eq.feature_used')
        .gte('timestamp', fromISO)
        .lte('timestamp', toISO)
        .order('timestamp', { ascending: false })
        .limit(500),
    ])

    // Process Step 1: Plans
    type PlanDbRow = { id: string; player_id: string; created_at: string }
    const planRows: PlanRow[] = ((plansResult.data || []) as PlanDbRow[]).map(row => ({
      plan_id: row.id,
      player_id: row.player_id,
      guardian_profile_id: '',
      guardian_name: '',
      created_at: row.created_at,
    }))

    // Fetch player -> guardian profile mappings separately if we have plans
    const playerIds = Array.from(new Set(planRows.map(r => r.player_id)))
    if (playerIds.length > 0) {
      // First get the players with their guardian_profile_id
      const { data: playersData } = await customerClient
        .from('players')
        .select('id, guardian_profile_id')
        .in('id', playerIds)

      if (playersData) {
        // Build a map of player_id -> guardian_profile_id
        const playerToGuardian = new Map<string, string>()
        const guardianProfileIds: string[] = []
        for (const p of playersData) {
          if (p.guardian_profile_id) {
            playerToGuardian.set(p.id, p.guardian_profile_id)
            guardianProfileIds.push(p.guardian_profile_id)
          }
        }

        // Now fetch the profile names for those guardian_profile_ids
        if (guardianProfileIds.length > 0) {
          const { data: profilesData } = await customerClient
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', guardianProfileIds)

          if (profilesData) {
            const profileMap = new Map<string, { first_name: string | null; last_name: string | null }>()
            for (const profile of profilesData) {
              profileMap.set(profile.id, { first_name: profile.first_name, last_name: profile.last_name })
            }

            // Now populate the plan rows
            for (const plan of planRows) {
              const guardianId = playerToGuardian.get(plan.player_id)
              if (guardianId) {
                plan.guardian_profile_id = guardianId
                const profile = profileMap.get(guardianId)
                if (profile) {
                  const firstName = profile.first_name || ''
                  const lastName = profile.last_name || ''
                  plan.guardian_name = `${firstName} ${lastName}`.trim()
                }
              }
            }
          }
        }
      }
    }

    const planGuardians = new Set(planRows.map(r => r.guardian_profile_id).filter(Boolean))

    // Process Step 2: Notifications
    type NotifDbRow = { id: string; profile_id: string; created_at: string; data: Record<string, unknown> | null; read_at: string | null }
    const notifRows: NotificationRow[] = ((notificationsResult.data || []) as NotifDbRow[]).map(row => ({
      notification_id: row.id,
      profile_id: row.profile_id,
      created_at: row.created_at,
      plan_id: (row.data?.plan_id as string) || null,
      read_at: row.read_at,
    }))
    const notifProfiles = new Set(notifRows.map(r => r.profile_id))

    // Process Step 3 & 4: Emails
    type EmailDbRow = { id: string; profile_id: string; created_at: string; status: string; payload: Record<string, unknown> | null; sent_at: string | null; last_error: string | null; attempts: number }
    const emailRows: EmailRow[] = ((emailsResult.data || []) as EmailDbRow[]).map(row => ({
      outbox_id: row.id,
      profile_id: row.profile_id,
      created_at: row.created_at,
      status: row.status,
      plan_id: (row.payload?.plan_id as string) || null,
      sent_at: row.sent_at,
      last_error: row.last_error,
      attempts: row.attempts || 0,
    }))
    const sentEmails = emailRows.filter(e => e.status !== 'failed')
    const deliveredEmails = emailRows.filter(e => e.status === 'delivered')
    const failedEmails = emailRows.filter(e => e.status === 'failed')
    const emailProfiles = new Set(sentEmails.map(r => r.profile_id))
    const deliveredProfiles = new Set(deliveredEmails.map(r => r.profile_id))

    // Process Step 5: Read Notifications
    const readNotifRows: NotificationRow[] = ((readNotificationsResult.data || []) as NotifDbRow[]).map(row => ({
      notification_id: row.id,
      profile_id: row.profile_id,
      created_at: row.created_at,
      plan_id: (row.data?.plan_id as string) || null,
      read_at: row.read_at,
    }))
    const readProfiles = new Set(readNotifRows.map(r => r.profile_id))

    // Process Step 6: Views
    type ViewDbRow = { profile_id: string; event_details: Record<string, unknown> | null; timestamp: string }
    const allViewRows = (viewsResult.data || []) as ViewDbRow[]
    // Filter to only player_plans feature views
    const viewRows: ViewRow[] = allViewRows
      .filter(row => {
        const feature = row.event_details?.feature as string | undefined
        return feature === 'player_plans' || row.event_details?.action === 'open'
      })
      .map(row => ({
        profile_id: row.profile_id,
        plan_id: (row.event_details?.plan_id as string) || null,
        timestamp: row.timestamp,
      }))
    const viewProfiles = new Set(viewRows.map(r => r.profile_id))

    // Build funnel steps
    const funnel: FunnelStep[] = [
      {
        step: 1,
        name: 'Plans Created',
        source: 'generated_plans',
        count: planRows.length,
        unique_users: planGuardians.size,
        conversion_from_prior: null,
        dropoff_pct: null,
        has_data: planRows.length > 0,
      },
      {
        step: 2,
        name: 'Notified',
        source: 'notifications',
        count: notifRows.length,
        unique_users: notifProfiles.size,
        conversion_from_prior: planRows.length > 0 ? (notifRows.length / planRows.length) * 100 : null,
        dropoff_pct: planRows.length > 0 ? ((planRows.length - notifRows.length) / planRows.length) * 100 : null,
        has_data: notifRows.length > 0,
      },
      {
        step: 3,
        name: 'Email Sent',
        source: 'email_outbox',
        count: sentEmails.length,
        unique_users: emailProfiles.size,
        conversion_from_prior: notifRows.length > 0 ? (sentEmails.length / notifRows.length) * 100 : null,
        dropoff_pct: notifRows.length > 0 ? ((notifRows.length - sentEmails.length) / notifRows.length) * 100 : null,
        has_data: sentEmails.length > 0,
      },
      {
        step: 4,
        name: 'Email Delivered',
        source: 'email_outbox',
        count: deliveredEmails.length,
        unique_users: deliveredProfiles.size,
        conversion_from_prior: sentEmails.length > 0 ? (deliveredEmails.length / sentEmails.length) * 100 : null,
        dropoff_pct: sentEmails.length > 0 ? ((sentEmails.length - deliveredEmails.length) / sentEmails.length) * 100 : null,
        has_data: deliveredEmails.length > 0,
      },
      {
        step: 5,
        name: 'Notification Read',
        source: 'notifications',
        count: readNotifRows.length,
        unique_users: readProfiles.size,
        conversion_from_prior: notifProfiles.size > 0 ? (readProfiles.size / notifProfiles.size) * 100 : null,
        dropoff_pct: notifProfiles.size > 0 ? ((notifProfiles.size - readProfiles.size) / notifProfiles.size) * 100 : null,
        has_data: readNotifRows.length > 0,
      },
      {
        step: 6,
        name: 'Plan Viewed',
        source: 'user_activity',
        count: viewRows.length,
        unique_users: viewProfiles.size,
        conversion_from_prior: planGuardians.size > 0 ? (viewProfiles.size / planGuardians.size) * 100 : null,
        dropoff_pct: readProfiles.size > 0 ? ((readProfiles.size - viewProfiles.size) / readProfiles.size) * 100 : null,
        has_data: viewRows.length > 0,
        note: viewRows.length === 0 ? 'Will populate once UniteHQ logs player_plan_viewed events' : undefined,
      },
    ]

    // Summary metrics
    const summary = {
      plansCreated: planRows.length,
      notificationRate: planRows.length > 0 ? (notifRows.length / planRows.length) * 100 : null,
      emailSendRate: planRows.length > 0 ? (sentEmails.length / planRows.length) * 100 : null,
      deliveryRate: sentEmails.length > 0 ? (deliveredEmails.length / sentEmails.length) * 100 : null,
      readRate: notifProfiles.size > 0 ? (readProfiles.size / notifProfiles.size) * 100 : null,
      viewRate: planGuardians.size > 0 ? (viewProfiles.size / planGuardians.size) * 100 : null,
      overallConversion: planGuardians.size > 0 ? (viewProfiles.size / planGuardians.size) * 100 : null,
      emailFailures: failedEmails.length,
    }

    // Build per-plan breakdown
    const notifByPlanId = new Map<string, NotificationRow>()
    for (const n of notifRows) {
      if (n.plan_id) notifByPlanId.set(n.plan_id, n)
    }
    const emailByPlanId = new Map<string, EmailRow>()
    const deliveredByPlanId = new Map<string, EmailRow>()
    for (const e of emailRows) {
      if (e.plan_id) {
        emailByPlanId.set(e.plan_id, e)
        if (e.status === 'delivered') deliveredByPlanId.set(e.plan_id, e)
      }
    }
    const readByPlanId = new Map<string, NotificationRow>()
    for (const r of readNotifRows) {
      if (r.plan_id) readByPlanId.set(r.plan_id, r)
    }
    const viewByPlanId = new Map<string, ViewRow>()
    for (const v of viewRows) {
      if (v.plan_id) viewByPlanId.set(v.plan_id, v)
    }

    const planBreakdown: PlanBreakdownItem[] = planRows.slice(0, 100).map(plan => {
      const notified = notifByPlanId.has(plan.plan_id)
      const emailed = emailByPlanId.has(plan.plan_id)
      const delivered = deliveredByPlanId.has(plan.plan_id)
      const read = readByPlanId.has(plan.plan_id)
      const viewed = viewByPlanId.has(plan.plan_id)

      let reached_step = 1
      if (notified) reached_step = 2
      if (emailed) reached_step = 3
      if (delivered) reached_step = 4
      if (read) reached_step = 5
      if (viewed) reached_step = 6

      return {
        plan_id: plan.plan_id,
        player_id: plan.player_id,
        guardian_profile_id: plan.guardian_profile_id,
        guardian_name: plan.guardian_name,
        created_at: plan.created_at,
        reached_step,
        steps: { notified, emailed, delivered, read, viewed },
      }
    })

    // Drilldown data
    const now = new Date()
    const drilldown = {
      failedEmails: failedEmails.slice(0, 50).map(e => ({
        outbox_id: e.outbox_id,
        profile_id: e.profile_id,
        last_error: e.last_error,
        created_at: e.created_at,
        attempts: e.attempts,
      })),
      unreadNotifications: notifRows
        .filter(n => !n.read_at)
        .slice(0, 50)
        .map(n => ({
          notification_id: n.notification_id,
          profile_id: n.profile_id,
          created_at: n.created_at,
          days_unread: Math.floor((now.getTime() - new Date(n.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        })),
      neverViewedPlans: planBreakdown
        .filter(p => (p.steps.notified || p.steps.emailed) && !p.steps.viewed)
        .slice(0, 50)
        .map(p => ({
          plan_id: p.plan_id,
          player_id: p.player_id,
          created_at: p.created_at,
          days_since_created: Math.floor((now.getTime() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        })),
    }

    const response: PlanFunnelResponse = {
      org_id: orgId,
      range,
      generatedAt: new Date().toISOString(),
      hasData: planRows.length > 0,
      funnel,
      summary,
      planBreakdown,
      drilldown,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Plan Funnel API error:', error)
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
