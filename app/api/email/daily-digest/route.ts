import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'
import { createCustomerClient } from '@/lib/customer-client'
import { resolveIdentityGraph, applyLeagueFilter, USER_KIND_LABELS } from '@/lib/metrics/identity'
import { computeSignupMetrics } from '@/lib/metrics/signups'
import { computeCoachMetrics, COACH_STAGE_LABELS } from '@/lib/metrics/coaches'
import { computeRetentionMetrics } from '@/lib/metrics/retention'
import { computeFeatureMetrics, fetchActivity, allowedProfileIds } from '@/lib/metrics/features'
import { computeRevenueMetrics } from '@/lib/metrics/revenue'
import {
  renderDailyDigest,
  digestSubject,
  isDigestEmpty,
  DigestInput,
} from '@/lib/email-templates/daily-digest'
import { sendWeeklyReport } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Daily digest, intended to be hit by a Vercel cron.
 *
 * Auth: this runs unattended, so it cannot use the normal bearer-token path.
 * It authorises with CRON_SECRET and resolves the connection directly with the
 * service-role key. Without CRON_SECRET set, the route refuses to run rather
 * than defaulting open.
 *
 * `?dry=true` renders and returns the HTML without sending — use it to check
 * the numbers against the dashboard before trusting the mail.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured; refusing to run unauthenticated.' },
      { status: 500 }
    )
  }

  const provided =
    request.headers.get('authorization')?.replace('Bearer ', '') ??
    request.nextUrl.searchParams.get('secret')
  if (provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = request.nextUrl.searchParams.get('dry') === 'true'

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Unattended: pick the most recently updated connection.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: connection, error: connError } = await admin
      .from('user_connections')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (connError || !connection) {
      return NextResponse.json({ error: 'No connection configured' }, { status: 404 })
    }

    const decrypted = decrypt(connection.encrypted_key)
    if (!decrypted) {
      return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 })
    }

    const client = createCustomerClient(connection.supabase_url, decrypted)
    const now = new Date()
    const since24h = new Date(now.getTime() - 24 * 36e5)

    const graph = await resolveIdentityGraph(client)
    const visible = applyLeagueFilter(graph.users, false)

    const [activity, coaches] = await Promise.all([
      fetchActivity(client, since24h.toISOString()),
      computeCoachMetrics(client, { now, newSinceHours: 24 }),
    ])

    const signups = computeSignupMetrics(graph.users, {
      includeLeague: false,
      signInDataUnavailable: graph.signInDataUnavailable,
      now,
    })
    const retention = computeRetentionMetrics(graph.users, {
      includeLeague: false,
      signInDataUnavailable: graph.signInDataUnavailable,
      now,
    })
    const features = computeFeatureMetrics(activity.rows, {
      allowedProfileIds: allowedProfileIds(visible),
    })

    // Revenue is best-effort: a Stripe failure must not block the digest.
    let mrrCents: number | null = null
    const revenueWarnings: string[] = []
    try {
      const revenue = await computeRevenueMetrics(client)
      mrrCents = revenue.configured.direct || revenue.configured.platform
        ? revenue.totalMrrCents
        : null
      revenueWarnings.push(...revenue.warnings)
    } catch (err) {
      revenueWarnings.push(
        `Revenue unavailable: ${err instanceof Error ? err.message : 'unknown error'}`
      )
    }

    const newSignups = signups.recent
      .filter((s) => s.signedUpAt && new Date(s.signedUpAt) >= since24h)
      .map((s) => ({
        name: s.name,
        email: s.email,
        kind: USER_KIND_LABELS[s.kind] ?? s.kind,
      }))

    const input: DigestInput = {
      generatedAt: now,
      newSignups,
      newCoaches: coaches.newInWindow.map((c) => ({
        name: c.displayName,
        stage: COACH_STAGE_LABELS[c.stage],
        nextAction: c.nextAction,
        daysStalled: c.daysStalled,
      })),
      activeUsers7d: retention.active7d,
      activeUsers30d: retention.active30d,
      neverActivatedCount: signups.activation.neverSignedIn,
      slipping: retention.slipping.slice(0, 10).map((u) => ({
        name: u.name,
        email: u.email,
        detail: `Last seen ${u.daysSinceLastSignIn}d ago`,
      })),
      stalledCoaches: coaches.coaches
        .filter((c) => c.stage !== 'earning' && (c.daysStalled ?? 0) > 30)
        .map((c) => ({
          name: c.displayName,
          stage: COACH_STAGE_LABELS[c.stage],
          nextAction: c.nextAction,
          daysStalled: c.daysStalled,
        })),
      errorCount: features.errorCount,
      mrrCents,
      warnings: [...graph.warnings, ...coaches.warnings, ...revenueWarnings],
    }

    if (isDigestEmpty(input) && !dryRun) {
      return NextResponse.json({ success: true, sent: false, reason: 'Nothing to report' })
    }

    const html = renderDailyDigest(input)
    const subject = digestSubject(input)

    if (dryRun) {
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
    }

    await sendWeeklyReport(html, subject)
    return NextResponse.json({
      success: true,
      sent: true,
      subject,
      newSignups: input.newSignups.length,
      newCoaches: input.newCoaches.length,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
