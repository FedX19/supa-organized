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
 * Daily digest. Scheduled mail is off — the Monday weekly report is the only cron email.
 * Sends only when DAILY_DIGEST_ENABLED=true. `?dry=true` still renders HTML without sending.
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

  if (!dryRun && process.env.DAILY_DIGEST_ENABLED !== 'true') {
    return NextResponse.json({
      success: true,
      sent: false,
      reason: 'Daily digest is disabled. Weekly report is the only scheduled email.',
    })
  }

  return NextResponse.json({
    success: true,
    sent: false,
    reason: 'Daily digest handler on this branch no longer sends. Use the weekly report.',
  })
}
