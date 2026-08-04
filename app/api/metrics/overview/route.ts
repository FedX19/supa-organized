import { NextRequest, NextResponse } from 'next/server'
import { getCustomerClient, errorStatus, errorMessage } from '@/lib/customer-client'
import { resolveIdentityGraph, applyLeagueFilter, UserKind } from '@/lib/metrics/identity'
import { computeSignupMetrics } from '@/lib/metrics/signups'
import { computeCoachMetrics } from '@/lib/metrics/coaches'
import { computeRetentionMetrics } from '@/lib/metrics/retention'
import { computeFeatureMetrics, fetchActivity, allowedProfileIds } from '@/lib/metrics/features'

export const dynamic = 'force-dynamic'

/**
 * One call that powers the whole dashboard.
 *
 * Revenue is deliberately NOT here — it makes live Stripe API calls per
 * connected account and would make this route slow and failure-prone. It has
 * its own endpoint so the page renders instantly and revenue fills in after.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    // League orgs are the retired product and are excluded by default.
    const includeLeague = params.get('include_league') === 'true'
    const days = Math.min(Math.max(Number(params.get('days') ?? 30), 1), 365)

    const client = await getCustomerClient(request)
    const now = new Date()
    const since = new Date(now.getTime() - days * 864e5)

    const graph = await resolveIdentityGraph(client)
    const visibleUsers = applyLeagueFilter(graph.users, includeLeague)

    const [activity, coaches] = await Promise.all([
      fetchActivity(client, since.toISOString()),
      computeCoachMetrics(client, { now }),
    ])

    const signups = computeSignupMetrics(graph.users, {
      includeLeague,
      signInDataUnavailable: graph.signInDataUnavailable,
      now,
    })

    const retention = computeRetentionMetrics(graph.users, {
      includeLeague,
      signInDataUnavailable: graph.signInDataUnavailable,
      unavailableReason: graph.signInUnavailableReason,
      now,
    })

    const features = computeFeatureMetrics(activity.rows, {
      allowedProfileIds: includeLeague ? undefined : allowedProfileIds(visibleUsers),
      warnings: activity.error ? [`user_activity: ${activity.error}`] : [],
    })

    const kindCounts = visibleUsers.reduce<Record<UserKind, number>>(
      (acc, u) => {
        acc[u.kind]++
        return acc
      },
      { coach: 0, mdc_member: 0, staff: 0, guardian: 0, orphan: 0 }
    )

    const leagueLegacyCount = graph.users.filter((u) => u.isLeagueLegacy).length

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      rangeDays: days,
      includeLeague,
      totals: {
        visibleUsers: visibleUsers.length,
        allUsers: graph.users.length,
        leagueLegacyExcluded: includeLeague ? 0 : leagueLegacyCount,
        byKind: kindCounts,
      },
      signups,
      coaches,
      retention,
      features,
      warnings: [
        ...graph.warnings,
        ...coaches.warnings,
        ...features.warnings,
        ...(activity.truncated ? ['user_activity results were truncated.'] : []),
      ],
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: errorMessage(error) },
      { status: errorStatus(error) }
    )
  }
}
