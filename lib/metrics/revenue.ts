import Stripe from 'stripe'
import { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll } from './fetch-all'

/**
 * Revenue across BOTH Stripe arrangements.
 *
 * The existing lib/stripe.ts builds one client from STRIPE_SECRET_KEY and calls
 * customers/subscriptions/charges.list() with no `stripeAccount` header. That
 * makes the entire coach marketplace structurally invisible — not a bug in a
 * query, a missing dimension.
 *
 * UniteHQ bills two different ways (per its CLAUDE.md, verified in code):
 *
 *  1. MDC Individual — billed DIRECTLY on STRIPE_SECRET_KEY. No connected
 *     account, no application fee. Price comes from
 *     organizations.marketplace_monthly_price_cents, not a Stripe Price object.
 *
 *  2. Coach marketplace — Stripe CONNECT on STRIPE_PLATFORM_SECRET_KEY. Each
 *     coach has their own account (consultant_workspaces.stripe_account_id);
 *     the platform takes 8%. Reading these requires passing { stripeAccount }
 *     per request.
 *
 * Both are handled here. Either can be absent without breaking the other.
 */

export interface AccountRevenue {
  /** null = the platform/direct account rather than a connected one. */
  stripeAccountId: string | null
  label: string
  activeSubscriptions: number
  mrrCents: number
  pastDue: number
  cancelingAtPeriodEnd: number
  failedPaymentsLast30d: number
  error?: string
}

export interface RevenueMetrics {
  direct: AccountRevenue | null
  connected: AccountRevenue[]
  totalMrrCents: number
  totalActiveSubscriptions: number
  /** Coach accounts we could not read. */
  unreadableAccounts: number
  configured: { direct: boolean; platform: boolean }
  warnings: string[]
}

function monthlyCents(sub: Stripe.Subscription): number {
  const item = sub.items?.data?.[0]
  const price = item?.price
  if (!price?.unit_amount) return 0
  const qty = item.quantity ?? 1
  const amount = price.unit_amount * qty
  switch (price.recurring?.interval) {
    case 'year':
      return Math.round(amount / 12)
    case 'week':
      return Math.round(amount * 4.333)
    case 'day':
      return Math.round(amount * 30)
    default:
      return amount
  }
}

async function summarizeAccount(
  stripe: Stripe,
  label: string,
  stripeAccountId: string | null
): Promise<AccountRevenue> {
  const opts: Stripe.RequestOptions | undefined = stripeAccountId
    ? { stripeAccount: stripeAccountId }
    : undefined

  const result: AccountRevenue = {
    stripeAccountId,
    label,
    activeSubscriptions: 0,
    mrrCents: 0,
    pastDue: 0,
    cancelingAtPeriodEnd: 0,
    failedPaymentsLast30d: 0,
  }

  try {
    // Subscriptions (status: all so past_due/canceled are visible).
    for await (const sub of stripe.subscriptions.list({ status: 'all', limit: 100 }, opts)) {
      if (sub.status === 'active' || sub.status === 'trialing') {
        result.activeSubscriptions++
        result.mrrCents += monthlyCents(sub)
        if (sub.cancel_at_period_end) result.cancelingAtPeriodEnd++
      } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
        result.pastDue++
      }
    }

    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 864e5) / 1000)
    for await (const charge of stripe.charges.list(
      { created: { gte: thirtyDaysAgo }, limit: 100 },
      opts
    )) {
      if (charge.status === 'failed') result.failedPaymentsLast30d++
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Unknown Stripe error'
  }

  return result
}

export async function computeRevenueMetrics(
  client: SupabaseClient,
  options: { maxConnectedAccounts?: number } = {}
): Promise<RevenueMetrics> {
  const warnings: string[] = []
  const directKey = process.env.STRIPE_SECRET_KEY
  const platformKey = process.env.STRIPE_PLATFORM_SECRET_KEY
  const maxConnected = options.maxConnectedAccounts ?? 50

  const configured = { direct: Boolean(directKey), platform: Boolean(platformKey) }

  if (!directKey) {
    warnings.push('STRIPE_SECRET_KEY is not set — MDC Individual revenue is unavailable.')
  }
  if (!platformKey) {
    warnings.push(
      'STRIPE_PLATFORM_SECRET_KEY is not set — coach marketplace (Connect) revenue is unavailable.'
    )
  }

  // 1. Direct billing (MDC Individual).
  let direct: AccountRevenue | null = null
  if (directKey) {
    const stripe = new Stripe(directKey, { apiVersion: '2025-12-15.clover' })
    direct = await summarizeAccount(stripe, 'MDC Individual (direct)', null)
    if (direct.error) warnings.push(`Direct account: ${direct.error}`)
  }

  // 2. Connect accounts, one per coach with a Stripe account.
  const connected: AccountRevenue[] = []
  let unreadableAccounts = 0

  if (platformKey) {
    const platform = new Stripe(platformKey, { apiVersion: '2025-12-15.clover' })
    const wsRes = await fetchAll<{
      display_name: string | null
      stripe_account_id: string | null
      stripe_charges_enabled: boolean | null
    }>(client, 'consultant_workspaces', {
      columns: 'id, display_name, stripe_account_id, stripe_charges_enabled',
    })
    if (wsRes.error) warnings.push(`consultant_workspaces: ${wsRes.error}`)

    const accounts = wsRes.rows
      .filter((w) => Boolean(w.stripe_account_id))
      .slice(0, maxConnected)

    if (wsRes.rows.filter((w) => w.stripe_account_id).length > maxConnected) {
      warnings.push(
        `More than ${maxConnected} connected accounts exist; only the first ${maxConnected} were read.`
      )
    }

    // Sequential on purpose: each account is a separate set of Stripe API calls
    // and parallelising all of them trips rate limits as coach count grows.
    for (const ws of accounts) {
      const summary = await summarizeAccount(
        platform,
        ws.display_name?.trim() || 'Unnamed coach',
        ws.stripe_account_id!
      )
      if (summary.error) unreadableAccounts++
      connected.push(summary)
    }
  }

  const totalMrrCents =
    (direct?.mrrCents ?? 0) + connected.reduce((sum, a) => sum + a.mrrCents, 0)
  const totalActiveSubscriptions =
    (direct?.activeSubscriptions ?? 0) +
    connected.reduce((sum, a) => sum + a.activeSubscriptions, 0)

  return {
    direct,
    connected,
    totalMrrCents,
    totalActiveSubscriptions,
    unreadableAccounts,
    configured,
    warnings,
  }
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
