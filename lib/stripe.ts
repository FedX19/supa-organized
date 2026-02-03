import Stripe from 'stripe'

// Initialize Stripe client (server-side only)
export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    console.warn('STRIPE_SECRET_KEY not configured')
    return null
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-12-15.clover',
  })
}

// ========== STRIPE DATA TYPES ==========

export interface StripeCustomer {
  id: string
  email: string | null
  name: string | null
  created: number
  metadata: Record<string, string>
}

export interface StripeSubscription {
  id: string
  customerId: string
  customerEmail: string | null
  customerName: string | null
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'unpaid' | 'paused'
  planAmount: number
  planInterval: 'month' | 'year' | 'week' | 'day'
  planIntervalCount: number
  currency: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  canceledAt: Date | null
  cancelAtPeriodEnd: boolean
  cancellationReason: string | null
  startDate: Date
  endedAt: Date | null
  trialStart: Date | null
  trialEnd: Date | null
  couponId: string | null
  couponName: string | null
  couponPercentOff: number | null
  couponAmountOff: number | null
  couponDuration: 'forever' | 'once' | 'repeating' | null
  discountedAmount: number
  metadata: Record<string, string>
}

export interface StripePayment {
  id: string
  customerId: string
  customerEmail: string | null
  amount: number
  amountRefunded: number
  currency: string
  status: 'succeeded' | 'pending' | 'failed'
  created: Date
  invoiceId: string | null
  description: string | null
  failureMessage: string | null
  refunded: boolean
}

export interface StripeCancellation {
  subscriptionId: string
  customerId: string
  customerEmail: string | null
  customerName: string | null
  canceledAt: Date
  cancelAtPeriodEnd: boolean
  reason: string | null
  monthlyValue: number
  subscriptionType: 'individual' | 'league'
  daysAsCustomer: number
  totalPaid: number
  lastPaymentDate: Date | null
  startDate: Date
  endedAt: Date | null
}

export interface StripeInvoice {
  id: string
  customerId: string
  subscriptionId: string | null
  amount: number
  amountPaid: number
  amountDue: number
  currency: string
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null
  created: Date
  dueDate: Date | null
  paidAt: Date | null
}

export interface StripeCoupon {
  id: string
  name: string | null
  percentOff: number | null
  amountOff: number | null
  currency: string | null
  duration: 'forever' | 'once' | 'repeating'
  durationInMonths: number | null
  timesRedeemed: number
  maxRedemptions: number | null
  valid: boolean
}

export interface StripeDataSyncResult {
  success: boolean
  customers: number
  subscriptions: StripeSubscription[]
  payments: StripePayment[]
  cancellations: StripeCancellation[]
  invoices: number
  coupons: StripeCoupon[]
  error?: string
  syncedAt: Date
}

// ========== STRIPE DATA STORAGE (in-memory for demo) ==========

let stripeData: {
  customers: StripeCustomer[]
  subscriptions: StripeSubscription[]
  payments: StripePayment[]
  cancellations: StripeCancellation[]
  invoices: StripeInvoice[]
  coupons: StripeCoupon[]
  lastSyncedAt: Date | null
} = {
  customers: [],
  subscriptions: [],
  payments: [],
  cancellations: [],
  invoices: [],
  coupons: [],
  lastSyncedAt: null,
}

// ========== STRIPE METRICS ==========

export interface StripeMetrics {
  mrr: number
  arr: number
  lifetimeRevenue: number
  activeSubscriptions: number
  canceledThisMonth: number
  churnRate: number
  revenueLostThisMonth: number
  avgCustomerLifetime: number
  totalCustomers: number
  payingCustomers: number
  betaTesters: number
  discountedCustomers: number
  actualRevenue: number
  potentialRevenue: number
  discountedRevenue: number
  pastDueSubscriptions: number
  failedPaymentsThisMonth: number
}

export interface CancellationAnalysis {
  recentCancellations: StripeCancellation[]
  cancellationsThisMonth: number
  revenueLostThisMonth: number
  avgCustomerLifetimeDays: number
  churnRate: number
  cancellationsByMonth: { month: string; count: number; revenueLost: number }[]
  earlyChurn: number // < 30 days
  lateChurn: number // > 180 days
  betaTesterChurn: number
  payingCustomerChurn: number
}

// ========== SYNC FUNCTIONS ==========

export async function syncStripeData(): Promise<StripeDataSyncResult> {
  const stripe = getStripeClient()

  if (!stripe) {
    return {
      success: false,
      customers: 0,
      subscriptions: [],
      payments: [],
      cancellations: [],
      invoices: 0,
      coupons: [],
      error: 'Stripe API key not configured. Add STRIPE_SECRET_KEY to environment variables.',
      syncedAt: new Date(),
    }
  }

  try {
    console.log('Starting Stripe data sync...')

    // Fetch all customers
    const customers: StripeCustomer[] = []
    let hasMoreCustomers = true
    let customerStartingAfter: string | undefined

    while (hasMoreCustomers) {
      const customerList = await stripe.customers.list({
        limit: 100,
        starting_after: customerStartingAfter,
      })

      customers.push(...customerList.data.map(c => ({
        id: c.id,
        email: c.email,
        name: c.name ?? null,
        created: c.created,
        metadata: c.metadata as Record<string, string>,
      })))

      hasMoreCustomers = customerList.has_more
      if (customerList.data.length > 0) {
        customerStartingAfter = customerList.data[customerList.data.length - 1].id
      }
    }
    console.log(`Fetched ${customers.length} customers`)

    // Fetch all subscriptions (including canceled)
    const subscriptions: StripeSubscription[] = []
    let hasMoreSubs = true
    let subStartingAfter: string | undefined

    while (hasMoreSubs) {
      const subList = await stripe.subscriptions.list({
        limit: 100,
        starting_after: subStartingAfter,
        status: 'all', // Include canceled
        expand: ['data.customer', 'data.discounts', 'data.discounts.coupon'],
      })

      for (const sub of subList.data) {
        // Cast to handle Stripe SDK type changes - API still returns these fields
        const rawSub = sub as unknown as {
          id: string
          customer: string | Stripe.Customer
          discounts?: Array<{ coupon?: Stripe.Coupon | string } | string>
          items: { data: Array<{ price?: Stripe.Price }> }
          status: string
          currency: string
          current_period_start: number
          current_period_end: number
          canceled_at: number | null
          cancel_at_period_end: boolean
          cancellation_details?: { reason?: string }
          start_date: number
          ended_at: number | null
          trial_start: number | null
          trial_end: number | null
          metadata: Record<string, string>
        }

        const customer = (typeof rawSub.customer === 'object' ? rawSub.customer : null) as Stripe.Customer | null
        const discountObj = rawSub.discounts?.[0]
        // Handle discount - could be string ID or Discount object
        const discount = typeof discountObj === 'object' ? discountObj : null
        // Access coupon from discount - may be expanded or a string ID
        const couponData = discount?.coupon
        const coupon = couponData && typeof couponData === 'object' ? couponData : null

        // Calculate monthly amount
        const item = rawSub.items.data[0]
        const price = item?.price
        let monthlyAmount = (price?.unit_amount || 0) / 100

        // Convert to monthly if needed
        if (price?.recurring?.interval === 'year') {
          monthlyAmount = monthlyAmount / 12
        } else if (price?.recurring?.interval === 'week') {
          monthlyAmount = monthlyAmount * 4.33
        }

        // Apply discount
        let discountedAmount = monthlyAmount
        if (coupon?.percent_off) {
          discountedAmount = monthlyAmount * (1 - coupon.percent_off / 100)
        } else if (coupon?.amount_off) {
          discountedAmount = Math.max(0, monthlyAmount - (coupon.amount_off / 100))
        }

        subscriptions.push({
          id: rawSub.id,
          customerId: typeof rawSub.customer === 'string' ? rawSub.customer : rawSub.customer.id,
          customerEmail: customer?.email || null,
          customerName: customer?.name ?? null,
          status: rawSub.status as StripeSubscription['status'],
          planAmount: monthlyAmount,
          planInterval: price?.recurring?.interval as StripeSubscription['planInterval'] || 'month',
          planIntervalCount: price?.recurring?.interval_count || 1,
          currency: rawSub.currency,
          currentPeriodStart: new Date(rawSub.current_period_start * 1000),
          currentPeriodEnd: new Date(rawSub.current_period_end * 1000),
          canceledAt: rawSub.canceled_at ? new Date(rawSub.canceled_at * 1000) : null,
          cancelAtPeriodEnd: rawSub.cancel_at_period_end,
          cancellationReason: rawSub.cancellation_details?.reason || rawSub.metadata?.cancellation_reason || null,
          startDate: new Date(rawSub.start_date * 1000),
          endedAt: rawSub.ended_at ? new Date(rawSub.ended_at * 1000) : null,
          trialStart: rawSub.trial_start ? new Date(rawSub.trial_start * 1000) : null,
          trialEnd: rawSub.trial_end ? new Date(rawSub.trial_end * 1000) : null,
          couponId: coupon?.id || null,
          couponName: coupon?.name || null,
          couponPercentOff: coupon?.percent_off || null,
          couponAmountOff: coupon?.amount_off ? coupon.amount_off / 100 : null,
          couponDuration: coupon?.duration as StripeSubscription['couponDuration'] || null,
          discountedAmount,
          metadata: rawSub.metadata,
        })
      }

      hasMoreSubs = subList.has_more
      if (subList.data.length > 0) {
        subStartingAfter = subList.data[subList.data.length - 1].id
      }
    }
    console.log(`Fetched ${subscriptions.length} subscriptions`)

    // Fetch all charges (payments) from last 12 months
    const payments: StripePayment[] = []
    let hasMoreCharges = true
    let chargeStartingAfter: string | undefined
    const twelveMonthsAgo = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60)

    while (hasMoreCharges) {
      const chargeList = await stripe.charges.list({
        limit: 100,
        starting_after: chargeStartingAfter,
        created: { gte: twelveMonthsAgo },
      })

      payments.push(...chargeList.data.map(c => {
        // Cast to handle Stripe SDK type changes
        const rawCharge = c as unknown as {
          id: string
          customer: string | { id: string } | null
          billing_details?: { email?: string | null }
          amount: number
          amount_refunded: number
          currency: string
          status: string
          created: number
          invoice?: string | { id: string } | null
          description: string | null
          failure_message: string | null
          refunded: boolean
        }
        return {
          id: rawCharge.id,
          customerId: typeof rawCharge.customer === 'string' ? rawCharge.customer : rawCharge.customer?.id || '',
          customerEmail: rawCharge.billing_details?.email || null,
          amount: rawCharge.amount / 100,
          amountRefunded: rawCharge.amount_refunded / 100,
          currency: rawCharge.currency,
          status: rawCharge.status === 'succeeded' ? 'succeeded' : rawCharge.status === 'pending' ? 'pending' : 'failed' as StripePayment['status'],
          created: new Date(rawCharge.created * 1000),
          invoiceId: typeof rawCharge.invoice === 'string' ? rawCharge.invoice : rawCharge.invoice?.id || null,
          description: rawCharge.description,
          failureMessage: rawCharge.failure_message,
          refunded: rawCharge.refunded,
        }
      }))

      hasMoreCharges = chargeList.has_more
      if (chargeList.data.length > 0) {
        chargeStartingAfter = chargeList.data[chargeList.data.length - 1].id
      }
    }
    console.log(`Fetched ${payments.length} payments`)

    // Fetch invoices from last 12 months
    const invoices: StripeInvoice[] = []
    let hasMoreInvoices = true
    let invoiceStartingAfter: string | undefined

    while (hasMoreInvoices) {
      const invoiceList = await stripe.invoices.list({
        limit: 100,
        starting_after: invoiceStartingAfter,
        created: { gte: twelveMonthsAgo },
      })

      invoices.push(...invoiceList.data.map(inv => {
        // Cast to handle Stripe SDK type changes
        const rawInv = inv as unknown as {
          id: string
          customer: string | { id: string } | null
          subscription?: string | { id: string } | null
          total: number
          amount_paid: number
          amount_due: number
          currency: string
          status: string | null
          created: number
          due_date: number | null
          status_transitions?: { paid_at?: number | null }
        }
        return {
          id: rawInv.id,
          customerId: typeof rawInv.customer === 'string' ? rawInv.customer : rawInv.customer?.id || '',
          subscriptionId: typeof rawInv.subscription === 'string' ? rawInv.subscription : rawInv.subscription?.id || null,
          amount: (rawInv.total || 0) / 100,
          amountPaid: (rawInv.amount_paid || 0) / 100,
          amountDue: (rawInv.amount_due || 0) / 100,
          currency: rawInv.currency,
          status: rawInv.status as StripeInvoice['status'],
          created: new Date(rawInv.created * 1000),
          dueDate: rawInv.due_date ? new Date(rawInv.due_date * 1000) : null,
          paidAt: rawInv.status_transitions?.paid_at ? new Date(rawInv.status_transitions.paid_at * 1000) : null,
        }
      }))

      hasMoreInvoices = invoiceList.has_more
      if (invoiceList.data.length > 0) {
        invoiceStartingAfter = invoiceList.data[invoiceList.data.length - 1].id
      }
    }
    console.log(`Fetched ${invoices.length} invoices`)

    // Fetch coupons
    const coupons: StripeCoupon[] = []
    let hasMoreCoupons = true
    let couponStartingAfter: string | undefined

    while (hasMoreCoupons) {
      const couponList = await stripe.coupons.list({
        limit: 100,
        starting_after: couponStartingAfter,
      })

      coupons.push(...couponList.data.map(c => ({
        id: c.id,
        name: c.name,
        percentOff: c.percent_off,
        amountOff: c.amount_off ? c.amount_off / 100 : null,
        currency: c.currency,
        duration: c.duration,
        durationInMonths: c.duration_in_months,
        timesRedeemed: c.times_redeemed,
        maxRedemptions: c.max_redemptions,
        valid: c.valid,
      })))

      hasMoreCoupons = couponList.has_more
      if (couponList.data.length > 0) {
        couponStartingAfter = couponList.data[couponList.data.length - 1].id
      }
    }
    console.log(`Fetched ${coupons.length} coupons`)

    // Build cancellations from canceled subscriptions
    const cancellations: StripeCancellation[] = []
    const customerPayments = new Map<string, StripePayment[]>()

    // Group payments by customer
    for (const payment of payments) {
      if (!customerPayments.has(payment.customerId)) {
        customerPayments.set(payment.customerId, [])
      }
      customerPayments.get(payment.customerId)!.push(payment)
    }

    for (const sub of subscriptions) {
      if (sub.status === 'canceled' && sub.canceledAt) {
        const custPayments = customerPayments.get(sub.customerId) || []
        const totalPaid = custPayments
          .filter(p => p.status === 'succeeded')
          .reduce((sum, p) => sum + p.amount, 0)

        const lastPayment = custPayments
          .filter(p => p.status === 'succeeded')
          .sort((a, b) => b.created.getTime() - a.created.getTime())[0]

        const daysAsCustomer = Math.floor(
          (sub.canceledAt.getTime() - sub.startDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Determine subscription type based on amount
        const subscriptionType = sub.planAmount >= 100 ? 'league' : 'individual'

        cancellations.push({
          subscriptionId: sub.id,
          customerId: sub.customerId,
          customerEmail: sub.customerEmail,
          customerName: sub.customerName,
          canceledAt: sub.canceledAt,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          reason: sub.cancellationReason,
          monthlyValue: sub.discountedAmount,
          subscriptionType,
          daysAsCustomer,
          totalPaid,
          lastPaymentDate: lastPayment?.created || null,
          startDate: sub.startDate,
          endedAt: sub.endedAt,
        })
      }
    }
    console.log(`Found ${cancellations.length} cancellations`)

    // Store the data
    stripeData = {
      customers,
      subscriptions,
      payments,
      cancellations,
      invoices,
      coupons,
      lastSyncedAt: new Date(),
    }

    return {
      success: true,
      customers: customers.length,
      subscriptions: subscriptions,
      payments: payments,
      cancellations: cancellations,
      invoices: invoices.length,
      coupons: coupons,
      syncedAt: new Date(),
    }
  } catch (error) {
    console.error('Stripe sync error:', error)
    return {
      success: false,
      customers: 0,
      subscriptions: [],
      payments: [],
      cancellations: [],
      invoices: 0,
      coupons: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      syncedAt: new Date(),
    }
  }
}

// ========== METRICS CALCULATION ==========

export function calculateStripeMetrics(): StripeMetrics {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Active subscriptions
  const activeSubscriptions = stripeData.subscriptions.filter(s => s.status === 'active')
  const pastDueSubscriptions = stripeData.subscriptions.filter(s => s.status === 'past_due')

  // MRR calculation (sum of monthly amounts for active subs)
  const mrr = activeSubscriptions.reduce((sum, s) => sum + s.discountedAmount, 0)

  // ARR
  const arr = mrr * 12

  // Lifetime revenue (all successful payments)
  const lifetimeRevenue = stripeData.payments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + (p.amount - p.amountRefunded), 0)

  // Cancellations this month
  const canceledThisMonth = stripeData.cancellations.filter(
    c => c.canceledAt >= startOfMonth
  ).length

  // Revenue lost this month
  const revenueLostThisMonth = stripeData.cancellations
    .filter(c => c.canceledAt >= startOfMonth)
    .reduce((sum, c) => sum + c.monthlyValue, 0)

  // Churn rate
  const activeAtStartOfMonth = stripeData.subscriptions.filter(s => {
    if (s.status === 'active') return true
    if (s.status === 'canceled' && s.canceledAt && s.canceledAt >= startOfMonth) return true
    return false
  }).length

  const churnRate = activeAtStartOfMonth > 0
    ? (canceledThisMonth / activeAtStartOfMonth) * 100
    : 0

  // Average customer lifetime
  const avgCustomerLifetime = stripeData.cancellations.length > 0
    ? stripeData.cancellations.reduce((sum, c) => sum + c.daysAsCustomer, 0) / stripeData.cancellations.length
    : 0

  // Customer segmentation
  const payingCustomers = activeSubscriptions.filter(s =>
    !s.couponId || (s.couponPercentOff && s.couponPercentOff < 100)
  ).length

  const betaTesters = activeSubscriptions.filter(s =>
    s.couponPercentOff === 100 ||
    s.couponId?.toLowerCase().includes('beta') ||
    (s.couponDuration === 'forever' && s.couponPercentOff && s.couponPercentOff >= 100)
  ).length

  const discountedCustomers = activeSubscriptions.filter(s =>
    s.couponId && s.couponPercentOff && s.couponPercentOff > 0 && s.couponPercentOff < 100
  ).length

  // Revenue analysis
  const actualRevenue = activeSubscriptions.reduce((sum, s) => sum + s.discountedAmount, 0)
  const potentialRevenue = activeSubscriptions.reduce((sum, s) => sum + s.planAmount, 0)
  const discountedRevenue = potentialRevenue - actualRevenue

  // Failed payments this month
  const failedPaymentsThisMonth = stripeData.payments.filter(
    p => p.status === 'failed' && p.created >= startOfMonth
  ).length

  return {
    mrr,
    arr,
    lifetimeRevenue,
    activeSubscriptions: activeSubscriptions.length,
    canceledThisMonth,
    churnRate: Math.round(churnRate * 100) / 100,
    revenueLostThisMonth,
    avgCustomerLifetime: Math.round(avgCustomerLifetime),
    totalCustomers: stripeData.customers.length,
    payingCustomers,
    betaTesters,
    discountedCustomers,
    actualRevenue,
    potentialRevenue,
    discountedRevenue,
    pastDueSubscriptions: pastDueSubscriptions.length,
    failedPaymentsThisMonth,
  }
}

// ========== CANCELLATION ANALYSIS ==========

export function getCancellationAnalysis(): CancellationAnalysis {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Sort cancellations by date (newest first)
  const recentCancellations = [...stripeData.cancellations]
    .sort((a, b) => b.canceledAt.getTime() - a.canceledAt.getTime())
    .slice(0, 50)

  // Cancellations this month
  const cancellationsThisMonth = stripeData.cancellations.filter(
    c => c.canceledAt >= startOfMonth
  ).length

  // Revenue lost this month
  const revenueLostThisMonth = stripeData.cancellations
    .filter(c => c.canceledAt >= startOfMonth)
    .reduce((sum, c) => sum + c.monthlyValue, 0)

  // Average customer lifetime
  const avgCustomerLifetimeDays = stripeData.cancellations.length > 0
    ? stripeData.cancellations.reduce((sum, c) => sum + c.daysAsCustomer, 0) / stripeData.cancellations.length
    : 0

  // Churn rate
  const activeAtStartOfMonth = stripeData.subscriptions.filter(s => {
    if (s.status === 'active') return true
    if (s.status === 'canceled' && s.canceledAt && s.canceledAt >= startOfMonth) return true
    return false
  }).length

  const churnRate = activeAtStartOfMonth > 0
    ? (cancellationsThisMonth / activeAtStartOfMonth) * 100
    : 0

  // Cancellations by month (last 12 months)
  const cancellationsByMonth: { month: string; count: number; revenueLost: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)

    const monthCancellations = stripeData.cancellations.filter(
      c => c.canceledAt >= monthDate && c.canceledAt < nextMonth
    )

    cancellationsByMonth.push({
      month: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      count: monthCancellations.length,
      revenueLost: monthCancellations.reduce((sum, c) => sum + c.monthlyValue, 0),
    })
  }

  // Early vs late churn
  const earlyChurn = stripeData.cancellations.filter(c => c.daysAsCustomer < 30).length
  const lateChurn = stripeData.cancellations.filter(c => c.daysAsCustomer > 180).length

  // Beta tester vs paying customer churn
  const canceledSubIds = new Set(stripeData.cancellations.map(c => c.subscriptionId))
  const canceledSubs = stripeData.subscriptions.filter(s => canceledSubIds.has(s.id))

  const betaTesterChurn = canceledSubs.filter(s =>
    s.couponPercentOff === 100 ||
    s.couponId?.toLowerCase().includes('beta')
  ).length

  const payingCustomerChurn = stripeData.cancellations.length - betaTesterChurn

  return {
    recentCancellations,
    cancellationsThisMonth,
    revenueLostThisMonth,
    avgCustomerLifetimeDays: Math.round(avgCustomerLifetimeDays),
    churnRate: Math.round(churnRate * 100) / 100,
    cancellationsByMonth,
    earlyChurn,
    lateChurn,
    betaTesterChurn,
    payingCustomerChurn,
  }
}

// ========== SUBSCRIPTION DATA ACCESS ==========

export function getActiveSubscriptions(): StripeSubscription[] {
  return stripeData.subscriptions.filter(s => s.status === 'active')
}

export function getCanceledSubscriptions(): StripeSubscription[] {
  return stripeData.subscriptions.filter(s => s.status === 'canceled')
}

export function getPastDueSubscriptions(): StripeSubscription[] {
  return stripeData.subscriptions.filter(s => s.status === 'past_due')
}

export function getScheduledCancellations(): StripeSubscription[] {
  return stripeData.subscriptions.filter(s => s.cancelAtPeriodEnd && s.status === 'active')
}

export function getBetaTesters(): StripeSubscription[] {
  return stripeData.subscriptions.filter(s =>
    s.status === 'active' && (
      s.couponPercentOff === 100 ||
      s.couponId?.toLowerCase().includes('beta') ||
      (s.couponDuration === 'forever' && s.couponPercentOff && s.couponPercentOff >= 100)
    )
  )
}

export function getFailedPayments(): StripePayment[] {
  return stripeData.payments.filter(p => p.status === 'failed')
}

export function getCustomerPayments(customerId: string): StripePayment[] {
  return stripeData.payments.filter(p => p.customerId === customerId)
}

export function getCouponUsage(): { coupon: StripeCoupon; customerCount: number; revenueImpact: number }[] {
  const couponUsage = new Map<string, { count: number; impact: number }>()

  for (const sub of stripeData.subscriptions.filter(s => s.couponId && s.status === 'active')) {
    const existing = couponUsage.get(sub.couponId!) || { count: 0, impact: 0 }
    existing.count++
    existing.impact += sub.planAmount - sub.discountedAmount
    couponUsage.set(sub.couponId!, existing)
  }

  return stripeData.coupons.map(coupon => ({
    coupon,
    customerCount: couponUsage.get(coupon.id)?.count || 0,
    revenueImpact: couponUsage.get(coupon.id)?.impact || 0,
  })).filter(c => c.customerCount > 0)
}

export function getLastSyncTime(): Date | null {
  return stripeData.lastSyncedAt
}

export function hasStripeData(): boolean {
  return stripeData.lastSyncedAt !== null && stripeData.subscriptions.length > 0
}

// ========== EXPORT FUNCTIONS ==========

export function exportSubscriptionsToCSV(): string {
  const headers = [
    'Customer Name', 'Email', 'Status', 'Plan Amount', 'Discounted Amount',
    'Coupon', 'Discount %', 'Start Date', 'Current Period End', 'Canceled At'
  ].join(',')

  const rows = stripeData.subscriptions.map(s => [
    `"${s.customerName || ''}"`,
    `"${s.customerEmail || ''}"`,
    s.status,
    s.planAmount.toFixed(2),
    s.discountedAmount.toFixed(2),
    `"${s.couponName || s.couponId || ''}"`,
    s.couponPercentOff || 0,
    s.startDate.toISOString().split('T')[0],
    s.currentPeriodEnd.toISOString().split('T')[0],
    s.canceledAt ? s.canceledAt.toISOString().split('T')[0] : '',
  ].join(','))

  return [headers, ...rows].join('\n')
}

export function exportCancellationsToCSV(): string {
  const headers = [
    'Customer Name', 'Email', 'Canceled Date', 'Subscription Type',
    'Monthly Value', 'Days as Customer', 'Total Paid', 'Reason'
  ].join(',')

  const rows = stripeData.cancellations.map(c => [
    `"${c.customerName || ''}"`,
    `"${c.customerEmail || ''}"`,
    c.canceledAt.toISOString().split('T')[0],
    c.subscriptionType,
    c.monthlyValue.toFixed(2),
    c.daysAsCustomer,
    c.totalPaid.toFixed(2),
    `"${c.reason || ''}"`,
  ].join(','))

  return [headers, ...rows].join('\n')
}

export function exportPaymentsToCSV(): string {
  const headers = [
    'Date', 'Customer Email', 'Amount', 'Status', 'Refunded', 'Description'
  ].join(',')

  const rows = stripeData.payments.map(p => [
    p.created.toISOString().split('T')[0],
    `"${p.customerEmail || ''}"`,
    p.amount.toFixed(2),
    p.status,
    p.refunded ? 'Yes' : 'No',
    `"${p.description || ''}"`,
  ].join(','))

  return [headers, ...rows].join('\n')
}

// ========== RETENTION & CHURN TYPES ==========

export interface ActiveCancellation {
  subscriptionId: string
  customerId: string
  customerEmail: string | null
  customerName: string | null
  canceledAt: Date
  currentPeriodEnd: Date // Access ends here
  cancelAtPeriodEnd: boolean
  daysUntilAccessEnds: number
  daysUntilDataPurge: number // currentPeriodEnd + 30 days
  customerLifetimeDays: number
  totalRevenuePaid: number
  monthlyValue: number
  cancellationReason: string | null
  subscriptionType: 'individual' | 'league'
}

export interface AtRiskCustomer {
  subscriptionId: string
  customerId: string
  customerEmail: string | null
  customerName: string | null
  status: string
  monthlyValue: number
  subscriptionType: 'individual' | 'league'
  riskLevel: 'high' | 'medium' | 'low'
  riskScore: number
  riskFactors: string[]
  daysSinceLastActivity: number
  engagementScore: number
  engagementTrend: 'increasing' | 'stable' | 'declining'
  suggestedActions: string[]
  startDate: Date
  currentPeriodEnd: Date
}

export interface RetentionMetrics {
  retention30Day: number
  retention90Day: number
  retention6Month: number
  retention12Month: number
  avgCustomerLifetimeDays: number
  avgRevenuePerCustomer: number
  avgTimeToChurn: number
  monthlyChurnRate: number
  revenueChurnRate: number
  customersAtRisk: number
  revenueAtRisk: number
}

export interface CohortData {
  cohortMonth: string
  signupCount: number
  retentionByMonth: number[] // Array of retention % for months 0, 1, 2, etc.
  totalRevenue: number
  avgEngagement: number
}

export interface RetentionCurvePoint {
  monthsSinceSignup: number
  retentionPercent: number
  customersRemaining: number
  customersTotal: number
}

export interface ChurnReasonBreakdown {
  reason: string
  count: number
  revenueImpact: number
  percentOfChurn: number
}

export interface CustomerSegmentRetention {
  segment: 'individual' | 'league' | 'beta_tester' | 'discounted'
  segmentName: string
  count: number
  retentionRate: number
  churnRate: number
  avgLifetimeDays: number
  avgLTV: number
}

export interface RetentionAnalysis {
  metrics: RetentionMetrics
  activeCancellations: ActiveCancellation[]
  atRiskCustomers: AtRiskCustomer[]
  cohortData: CohortData[]
  retentionCurve: RetentionCurvePoint[]
  churnReasons: ChurnReasonBreakdown[]
  segmentRetention: CustomerSegmentRetention[]
}

// ========== RETENTION CALCULATION FUNCTIONS ==========

export function calculateRetentionAnalysis(
  subscriptions: StripeSubscription[],
  payments: StripePayment[],
  cancellations: StripeCancellation[]
): RetentionAnalysis {
  const now = new Date()

  // Calculate active cancellations (in grace period)
  const activeCancellations = calculateActiveCancellations(subscriptions, payments, now)

  // Calculate at-risk customers
  const atRiskCustomers = calculateAtRiskCustomers(subscriptions, payments, now)

  // Calculate retention metrics
  const metrics = calculateRetentionMetrics(subscriptions, payments, cancellations, atRiskCustomers, now)

  // Calculate cohort data
  const cohortData = calculateCohortData(subscriptions, now)

  // Calculate retention curve
  const retentionCurve = calculateRetentionCurve(subscriptions, now)

  // Calculate churn reasons
  const churnReasons = calculateChurnReasons(cancellations)

  // Calculate segment retention
  const segmentRetention = calculateSegmentRetention(subscriptions, cancellations, payments)

  return {
    metrics,
    activeCancellations,
    atRiskCustomers,
    cohortData,
    retentionCurve,
    churnReasons,
    segmentRetention,
  }
}

function calculateActiveCancellations(
  subscriptions: StripeSubscription[],
  payments: StripePayment[],
  now: Date
): ActiveCancellation[] {
  const activeCancellations: ActiveCancellation[] = []

  // Group payments by customer for LTV calculation
  const customerPayments = new Map<string, number>()
  for (const p of payments.filter(p => p.status === 'succeeded')) {
    customerPayments.set(p.customerId, (customerPayments.get(p.customerId) || 0) + p.amount)
  }

  // Find subscriptions that are canceled but still have access (in grace period)
  // Or subscriptions scheduled to cancel at period end
  for (const sub of subscriptions) {
    const isCanceledWithAccess = sub.status === 'canceled' && sub.currentPeriodEnd > now
    const isScheduledToCancel = sub.cancelAtPeriodEnd && sub.status === 'active'

    if (isCanceledWithAccess || isScheduledToCancel) {
      const daysUntilAccessEnds = Math.max(0, Math.ceil(
        (sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ))

      // Data purge is 30 days after access ends
      const dataPurgeDate = new Date(sub.currentPeriodEnd)
      dataPurgeDate.setDate(dataPurgeDate.getDate() + 30)
      const daysUntilDataPurge = Math.max(0, Math.ceil(
        (dataPurgeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ))

      const customerLifetimeDays = Math.floor(
        ((sub.canceledAt || now).getTime() - sub.startDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      activeCancellations.push({
        subscriptionId: sub.id,
        customerId: sub.customerId,
        customerEmail: sub.customerEmail,
        customerName: sub.customerName,
        canceledAt: sub.canceledAt || now,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        daysUntilAccessEnds,
        daysUntilDataPurge,
        customerLifetimeDays,
        totalRevenuePaid: customerPayments.get(sub.customerId) || 0,
        monthlyValue: sub.discountedAmount,
        cancellationReason: sub.cancellationReason,
        subscriptionType: sub.planAmount >= 100 ? 'league' : 'individual',
      })
    }
  }

  // Sort by days until access ends (ascending)
  return activeCancellations.sort((a, b) => a.daysUntilAccessEnds - b.daysUntilAccessEnds)
}

function calculateAtRiskCustomers(
  subscriptions: StripeSubscription[],
  payments: StripePayment[],
  now: Date
): AtRiskCustomer[] {
  const atRiskCustomers: AtRiskCustomer[] = []
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active' && !s.cancelAtPeriodEnd)

  // Group failed payments by customer
  const failedPaymentsByCustomer = new Map<string, number>()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  for (const p of payments.filter(p => p.status === 'failed' && p.created >= thirtyDaysAgo)) {
    failedPaymentsByCustomer.set(p.customerId, (failedPaymentsByCustomer.get(p.customerId) || 0) + 1)
  }

  for (const sub of activeSubscriptions) {
    const riskFactors: string[] = []
    let riskScore = 0

    // Calculate days since signup (proxy for engagement if we don't have activity data)
    const daysSinceSignup = Math.floor(
      (now.getTime() - sub.startDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Risk factor: Very new customer (first 30 days = higher churn risk)
    if (daysSinceSignup <= 30) {
      riskFactors.push('New customer (first 30 days)')
      riskScore += 15
    }

    // Risk factor: Past due status
    if (sub.status === 'past_due') {
      riskFactors.push('Payment past due')
      riskScore += 40
    }

    // Risk factor: Failed payments
    const failedCount = failedPaymentsByCustomer.get(sub.customerId) || 0
    if (failedCount > 0) {
      riskFactors.push(`${failedCount} failed payment(s) in last 30 days`)
      riskScore += failedCount * 20
    }

    // Risk factor: Beta tester (free accounts may churn when asked to pay)
    if (sub.couponPercentOff === 100 || sub.couponId?.toLowerCase().includes('beta')) {
      riskFactors.push('Beta tester (100% discount)')
      riskScore += 25
    }

    // Risk factor: Coupon expiring soon
    if (sub.couponDuration === 'repeating' && sub.couponId) {
      riskFactors.push('Discount may expire soon')
      riskScore += 10
    }

    // Only include if risk score is significant
    if (riskScore >= 15) {
      const riskLevel: 'high' | 'medium' | 'low' =
        riskScore >= 50 ? 'high' : riskScore >= 30 ? 'medium' : 'low'

      // Generate suggested actions based on risk factors
      const suggestedActions: string[] = []
      if (riskFactors.some(f => f.includes('failed payment'))) {
        suggestedActions.push('Update payment method')
        suggestedActions.push('Contact about billing')
      }
      if (riskFactors.some(f => f.includes('Beta tester'))) {
        suggestedActions.push('Schedule conversion call')
        suggestedActions.push('Offer limited-time discount')
      }
      if (riskFactors.some(f => f.includes('New customer'))) {
        suggestedActions.push('Send onboarding tips')
        suggestedActions.push('Schedule check-in call')
      }

      atRiskCustomers.push({
        subscriptionId: sub.id,
        customerId: sub.customerId,
        customerEmail: sub.customerEmail,
        customerName: sub.customerName,
        status: sub.status,
        monthlyValue: sub.discountedAmount,
        subscriptionType: sub.planAmount >= 100 ? 'league' : 'individual',
        riskLevel,
        riskScore,
        riskFactors,
        daysSinceLastActivity: daysSinceSignup, // Placeholder - would need activity data
        engagementScore: Math.max(0, 100 - daysSinceSignup), // Simplified engagement proxy
        engagementTrend: 'stable', // Would need activity data to calculate
        suggestedActions,
        startDate: sub.startDate,
        currentPeriodEnd: sub.currentPeriodEnd,
      })
    }
  }

  // Sort by risk score (highest first)
  return atRiskCustomers.sort((a, b) => b.riskScore - a.riskScore)
}

function calculateRetentionMetrics(
  subscriptions: StripeSubscription[],
  payments: StripePayment[],
  cancellations: StripeCancellation[],
  atRiskCustomers: AtRiskCustomer[],
  now: Date
): RetentionMetrics {
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active')
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

  // Calculate retention rates by looking at signup cohorts
  const signupsBefore30Days = subscriptions.filter(s => s.startDate <= thirtyDaysAgo)
  const stillActive30Days = signupsBefore30Days.filter(s => s.status === 'active' || (s.canceledAt && s.canceledAt > thirtyDaysAgo))
  const retention30Day = signupsBefore30Days.length > 0
    ? (stillActive30Days.length / signupsBefore30Days.length) * 100
    : 100

  const signupsBefore90Days = subscriptions.filter(s => s.startDate <= ninetyDaysAgo)
  const stillActive90Days = signupsBefore90Days.filter(s => s.status === 'active' || (s.canceledAt && s.canceledAt > ninetyDaysAgo))
  const retention90Day = signupsBefore90Days.length > 0
    ? (stillActive90Days.length / signupsBefore90Days.length) * 100
    : 100

  const signupsBefore6Months = subscriptions.filter(s => s.startDate <= sixMonthsAgo)
  const stillActive6Months = signupsBefore6Months.filter(s => s.status === 'active' || (s.canceledAt && s.canceledAt > sixMonthsAgo))
  const retention6Month = signupsBefore6Months.length > 0
    ? (stillActive6Months.length / signupsBefore6Months.length) * 100
    : 100

  const signupsBefore1Year = subscriptions.filter(s => s.startDate <= oneYearAgo)
  const stillActive1Year = signupsBefore1Year.filter(s => s.status === 'active' || (s.canceledAt && s.canceledAt > oneYearAgo))
  const retention12Month = signupsBefore1Year.length > 0
    ? (stillActive1Year.length / signupsBefore1Year.length) * 100
    : 100

  // Average customer lifetime
  const allCustomerLifetimes = cancellations.map(c => c.daysAsCustomer)
  const avgCustomerLifetimeDays = allCustomerLifetimes.length > 0
    ? allCustomerLifetimes.reduce((a, b) => a + b, 0) / allCustomerLifetimes.length
    : 0

  // Average revenue per customer (LTV)
  const customerRevenue = new Map<string, number>()
  for (const p of payments.filter(p => p.status === 'succeeded')) {
    customerRevenue.set(p.customerId, (customerRevenue.get(p.customerId) || 0) + p.amount)
  }
  const avgRevenuePerCustomer = customerRevenue.size > 0
    ? Array.from(customerRevenue.values()).reduce((a, b) => a + b, 0) / customerRevenue.size
    : 0

  // Average time to churn
  const avgTimeToChurn = avgCustomerLifetimeDays

  // Monthly churn rate
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const cancelsThisMonth = cancellations.filter(c => c.canceledAt >= startOfMonth).length
  const activeAtStartOfMonth = subscriptions.filter(s => {
    if (s.status === 'active') return true
    if (s.status === 'canceled' && s.canceledAt && s.canceledAt >= startOfMonth) return true
    return false
  }).length
  const monthlyChurnRate = activeAtStartOfMonth > 0
    ? (cancelsThisMonth / activeAtStartOfMonth) * 100
    : 0

  // Revenue churn rate
  const mrrAtRisk = cancellations
    .filter(c => c.canceledAt >= startOfMonth)
    .reduce((sum, c) => sum + c.monthlyValue, 0)
  const totalMRR = activeSubscriptions.reduce((sum, s) => sum + s.discountedAmount, 0)
  const revenueChurnRate = totalMRR > 0 ? (mrrAtRisk / totalMRR) * 100 : 0

  // Customers and revenue at risk
  const customersAtRisk = atRiskCustomers.length
  const revenueAtRisk = atRiskCustomers.reduce((sum, c) => sum + c.monthlyValue, 0)

  return {
    retention30Day: Math.round(retention30Day * 10) / 10,
    retention90Day: Math.round(retention90Day * 10) / 10,
    retention6Month: Math.round(retention6Month * 10) / 10,
    retention12Month: Math.round(retention12Month * 10) / 10,
    avgCustomerLifetimeDays: Math.round(avgCustomerLifetimeDays),
    avgRevenuePerCustomer: Math.round(avgRevenuePerCustomer * 100) / 100,
    avgTimeToChurn: Math.round(avgTimeToChurn),
    monthlyChurnRate: Math.round(monthlyChurnRate * 100) / 100,
    revenueChurnRate: Math.round(revenueChurnRate * 100) / 100,
    customersAtRisk,
    revenueAtRisk: Math.round(revenueAtRisk * 100) / 100,
  }
}

function calculateCohortData(subscriptions: StripeSubscription[], now: Date): CohortData[] {
  const cohorts: CohortData[] = []

  // Group subscriptions by signup month (last 12 months)
  for (let i = 11; i >= 0; i--) {
    const cohortStartDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const cohortEndDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)

    const cohortSubs = subscriptions.filter(s =>
      s.startDate >= cohortStartDate && s.startDate < cohortEndDate
    )

    if (cohortSubs.length === 0) continue

    // Calculate retention for each month after signup
    const retentionByMonth: number[] = []
    const monthsSinceCohort = i

    for (let month = 0; month <= monthsSinceCohort; month++) {
      const checkDate = new Date(cohortStartDate.getFullYear(), cohortStartDate.getMonth() + month + 1, 1)

      const stillActive = cohortSubs.filter(s => {
        if (s.status === 'active') return true
        if (s.canceledAt && s.canceledAt >= checkDate) return true
        return false
      }).length

      retentionByMonth.push(Math.round((stillActive / cohortSubs.length) * 100))
    }

    cohorts.push({
      cohortMonth: cohortStartDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      signupCount: cohortSubs.length,
      retentionByMonth,
      totalRevenue: cohortSubs.reduce((sum, s) => sum + s.discountedAmount, 0),
      avgEngagement: 0, // Would need activity data
    })
  }

  return cohorts
}

function calculateRetentionCurve(subscriptions: StripeSubscription[], now: Date): RetentionCurvePoint[] {
  const curve: RetentionCurvePoint[] = []

  // Only consider subscriptions old enough to analyze
  const allSubs = subscriptions.filter(s => {
    const monthsSinceSignup = Math.floor(
      (now.getTime() - s.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    )
    return monthsSinceSignup >= 0
  })

  if (allSubs.length === 0) return curve

  // Calculate retention at each month (0-12)
  for (let month = 0; month <= 12; month++) {
    // Only include subs that are old enough for this data point
    const eligibleSubs = allSubs.filter(s => {
      const monthsSinceSignup = Math.floor(
        (now.getTime() - s.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      )
      return monthsSinceSignup >= month
    })

    if (eligibleSubs.length === 0) continue

    // Count how many were still active at month X
    const retained = eligibleSubs.filter(s => {
      if (s.status === 'active') return true
      if (s.canceledAt) {
        const monthsActiveBeforeCancel = Math.floor(
          (s.canceledAt.getTime() - s.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        )
        return monthsActiveBeforeCancel >= month
      }
      return false
    }).length

    curve.push({
      monthsSinceSignup: month,
      retentionPercent: Math.round((retained / eligibleSubs.length) * 100),
      customersRemaining: retained,
      customersTotal: eligibleSubs.length,
    })
  }

  return curve
}

function calculateChurnReasons(cancellations: StripeCancellation[]): ChurnReasonBreakdown[] {
  const reasonCounts = new Map<string, { count: number; revenue: number }>()

  for (const c of cancellations) {
    const reason = c.reason || 'Not specified'
    const existing = reasonCounts.get(reason) || { count: 0, revenue: 0 }
    existing.count++
    existing.revenue += c.monthlyValue
    reasonCounts.set(reason, existing)
  }

  const totalCancellations = cancellations.length

  return Array.from(reasonCounts.entries())
    .map(([reason, data]) => ({
      reason,
      count: data.count,
      revenueImpact: Math.round(data.revenue * 100) / 100,
      percentOfChurn: totalCancellations > 0
        ? Math.round((data.count / totalCancellations) * 100)
        : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

function calculateSegmentRetention(
  subscriptions: StripeSubscription[],
  cancellations: StripeCancellation[],
  payments: StripePayment[]
): CustomerSegmentRetention[] {
  const segments: CustomerSegmentRetention[] = []

  // Define segment categorization
  const categorize = (sub: StripeSubscription): 'individual' | 'league' | 'beta_tester' | 'discounted' => {
    if (sub.couponPercentOff === 100 || sub.couponId?.toLowerCase().includes('beta')) {
      return 'beta_tester'
    }
    if (sub.couponId && sub.couponPercentOff && sub.couponPercentOff > 0 && sub.couponPercentOff < 100) {
      return 'discounted'
    }
    return sub.planAmount >= 100 ? 'league' : 'individual'
  }

  // Group subscriptions by segment
  const segmentSubs = new Map<string, StripeSubscription[]>()
  for (const sub of subscriptions) {
    const segment = categorize(sub)
    if (!segmentSubs.has(segment)) segmentSubs.set(segment, [])
    segmentSubs.get(segment)!.push(sub)
  }

  // Group payments by customer for LTV
  const customerPayments = new Map<string, number>()
  for (const p of payments.filter(p => p.status === 'succeeded')) {
    customerPayments.set(p.customerId, (customerPayments.get(p.customerId) || 0) + p.amount)
  }

  // Calculate metrics for each segment
  const segmentNames: Record<string, string> = {
    individual: 'Individual Members',
    league: 'League Coaches',
    beta_tester: 'Beta Testers',
    discounted: 'Discounted Customers',
  }

  for (const [segment, subs] of Array.from(segmentSubs.entries())) {
    const activeSubs = subs.filter(s => s.status === 'active')
    const canceledSubs = subs.filter(s => s.status === 'canceled')

    // Get cancellations for this segment
    const segmentCancels = cancellations.filter(c => {
      const sub = subscriptions.find(s => s.id === c.subscriptionId)
      return sub && categorize(sub) === segment
    })

    const retentionRate = subs.length > 0
      ? (activeSubs.length / subs.length) * 100
      : 0

    const churnRate = 100 - retentionRate

    const avgLifetimeDays = segmentCancels.length > 0
      ? segmentCancels.reduce((sum, c) => sum + c.daysAsCustomer, 0) / segmentCancels.length
      : 0

    // Calculate average LTV for this segment
    const segmentCustomerIds = new Set(subs.map(s => s.customerId))
    const segmentLTVs = Array.from(segmentCustomerIds)
      .map(id => customerPayments.get(id) || 0)
    const avgLTV = segmentLTVs.length > 0
      ? segmentLTVs.reduce((a, b) => a + b, 0) / segmentLTVs.length
      : 0

    segments.push({
      segment: segment as 'individual' | 'league' | 'beta_tester' | 'discounted',
      segmentName: segmentNames[segment] || segment,
      count: subs.length,
      retentionRate: Math.round(retentionRate * 10) / 10,
      churnRate: Math.round(churnRate * 10) / 10,
      avgLifetimeDays: Math.round(avgLifetimeDays),
      avgLTV: Math.round(avgLTV * 100) / 100,
    })
  }

  return segments.sort((a, b) => b.count - a.count)
}
