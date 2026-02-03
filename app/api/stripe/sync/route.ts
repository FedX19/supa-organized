import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  syncStripeData,
  StripeSubscription,
  StripePayment,
  StripeCancellation,
  StripeCoupon,
  StripeMetrics,
  CancellationAnalysis,
  calculateRetentionAnalysis,
  RetentionAnalysis,
} from '@/lib/stripe'

// Create admin Supabase client for database operations
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

// Verify authentication
async function verifyAuth(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user.id
}

// Save synced data to database
async function saveToDatabase(data: {
  subscriptions: StripeSubscription[]
  payments: StripePayment[]
  cancellations: StripeCancellation[]
  coupons: StripeCoupon[]
}) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    console.error('Database not configured')
    return false
  }

  try {
    // Clear existing data and insert fresh data
    // Using transactions would be better but Supabase JS doesn't support them directly

    // Save subscriptions
    if (data.subscriptions.length > 0) {
      await supabase.from('stripe_subscriptions').delete().neq('id', '')

      const subsToInsert = data.subscriptions.map(sub => ({
        id: sub.id,
        customer_id: sub.customerId,
        customer_email: sub.customerEmail,
        customer_name: sub.customerName,
        status: sub.status,
        plan_amount: sub.planAmount,
        plan_interval: sub.planInterval,
        plan_interval_count: sub.planIntervalCount,
        currency: sub.currency,
        current_period_start: sub.currentPeriodStart?.toISOString(),
        current_period_end: sub.currentPeriodEnd?.toISOString(),
        canceled_at: sub.canceledAt?.toISOString() || null,
        cancel_at_period_end: sub.cancelAtPeriodEnd,
        cancellation_reason: sub.cancellationReason,
        start_date: sub.startDate?.toISOString(),
        ended_at: sub.endedAt?.toISOString() || null,
        trial_start: sub.trialStart?.toISOString() || null,
        trial_end: sub.trialEnd?.toISOString() || null,
        coupon_id: sub.couponId,
        coupon_name: sub.couponName,
        coupon_percent_off: sub.couponPercentOff,
        coupon_amount_off: sub.couponAmountOff,
        coupon_duration: sub.couponDuration,
        discounted_amount: sub.discountedAmount,
        metadata: sub.metadata,
        updated_at: new Date().toISOString(),
      }))

      // Insert in batches to avoid size limits
      const batchSize = 100
      for (let i = 0; i < subsToInsert.length; i += batchSize) {
        const batch = subsToInsert.slice(i, i + batchSize)
        const { error } = await supabase.from('stripe_subscriptions').insert(batch)
        if (error) {
          console.error('Error saving subscriptions batch:', error)
        }
      }
    }

    // Save payments
    if (data.payments.length > 0) {
      await supabase.from('stripe_payments').delete().neq('id', '')

      const paymentsToInsert = data.payments.map(p => ({
        id: p.id,
        customer_id: p.customerId,
        customer_email: p.customerEmail,
        amount: p.amount,
        amount_refunded: p.amountRefunded,
        currency: p.currency,
        status: p.status,
        created_at: p.created?.toISOString(),
        invoice_id: p.invoiceId,
        description: p.description,
        failure_message: p.failureMessage,
        refunded: p.refunded,
        synced_at: new Date().toISOString(),
      }))

      const batchSize = 100
      for (let i = 0; i < paymentsToInsert.length; i += batchSize) {
        const batch = paymentsToInsert.slice(i, i + batchSize)
        const { error } = await supabase.from('stripe_payments').insert(batch)
        if (error) {
          console.error('Error saving payments batch:', error)
        }
      }
    }

    // Save cancellations
    if (data.cancellations.length > 0) {
      await supabase.from('stripe_cancellations').delete().neq('subscription_id', '')

      const cancelsToInsert = data.cancellations.map(c => ({
        subscription_id: c.subscriptionId,
        customer_id: c.customerId,
        customer_email: c.customerEmail,
        customer_name: c.customerName,
        canceled_at: c.canceledAt?.toISOString(),
        cancel_at_period_end: c.cancelAtPeriodEnd,
        reason: c.reason,
        monthly_value: c.monthlyValue,
        subscription_type: c.subscriptionType,
        days_as_customer: c.daysAsCustomer,
        total_paid: c.totalPaid,
        last_payment_date: c.lastPaymentDate?.toISOString() || null,
        start_date: c.startDate?.toISOString(),
        ended_at: c.endedAt?.toISOString() || null,
        synced_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from('stripe_cancellations').insert(cancelsToInsert)
      if (error) {
        console.error('Error saving cancellations:', error)
      }
    }

    // Save coupons
    if (data.coupons.length > 0) {
      await supabase.from('stripe_coupons').delete().neq('id', '')

      const couponsToInsert = data.coupons.map(c => ({
        id: c.id,
        name: c.name,
        percent_off: c.percentOff,
        amount_off: c.amountOff,
        currency: c.currency,
        duration: c.duration,
        duration_in_months: c.durationInMonths,
        times_redeemed: c.timesRedeemed,
        max_redemptions: c.maxRedemptions,
        valid: c.valid,
        synced_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from('stripe_coupons').insert(couponsToInsert)
      if (error) {
        console.error('Error saving coupons:', error)
      }
    }

    // Update sync metadata
    await supabase.from('stripe_sync_metadata').upsert({
      id: 1,
      last_synced_at: new Date().toISOString(),
      subscriptions_count: data.subscriptions.length,
      payments_count: data.payments.length,
      cancellations_count: data.cancellations.length,
      coupons_count: data.coupons.length,
      sync_status: 'success',
      sync_error: null,
      updated_at: new Date().toISOString(),
    })

    console.log('Stripe data saved to database successfully')
    return true
  } catch (error) {
    console.error('Error saving to database:', error)

    // Update sync metadata with error
    await supabase.from('stripe_sync_metadata').upsert({
      id: 1,
      sync_status: 'error',
      sync_error: error instanceof Error ? error.message : 'Unknown error',
      updated_at: new Date().toISOString(),
    })

    return false
  }
}

// Load data from database
async function loadFromDatabase(): Promise<{
  subscriptions: StripeSubscription[]
  payments: StripePayment[]
  cancellations: StripeCancellation[]
  coupons: StripeCoupon[]
  lastSyncedAt: string | null
  hasData: boolean
} | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return null
  }

  try {
    // Get sync metadata first
    const { data: metadata } = await supabase
      .from('stripe_sync_metadata')
      .select('*')
      .eq('id', 1)
      .single()

    if (!metadata?.last_synced_at) {
      return { subscriptions: [], payments: [], cancellations: [], coupons: [], lastSyncedAt: null, hasData: false }
    }

    // Load all data
    const [subsResult, paymentsResult, cancelsResult, couponsResult] = await Promise.all([
      supabase.from('stripe_subscriptions').select('*'),
      supabase.from('stripe_payments').select('*'),
      supabase.from('stripe_cancellations').select('*'),
      supabase.from('stripe_coupons').select('*'),
    ])

    // Transform database rows back to our types
    const subscriptions: StripeSubscription[] = (subsResult.data || []).map(row => ({
      id: row.id,
      customerId: row.customer_id,
      customerEmail: row.customer_email,
      customerName: row.customer_name,
      status: row.status,
      planAmount: parseFloat(row.plan_amount) || 0,
      planInterval: row.plan_interval || 'month',
      planIntervalCount: row.plan_interval_count || 1,
      currency: row.currency || 'usd',
      currentPeriodStart: new Date(row.current_period_start),
      currentPeriodEnd: new Date(row.current_period_end),
      canceledAt: row.canceled_at ? new Date(row.canceled_at) : null,
      cancelAtPeriodEnd: row.cancel_at_period_end || false,
      cancellationReason: row.cancellation_reason,
      startDate: new Date(row.start_date),
      endedAt: row.ended_at ? new Date(row.ended_at) : null,
      trialStart: row.trial_start ? new Date(row.trial_start) : null,
      trialEnd: row.trial_end ? new Date(row.trial_end) : null,
      couponId: row.coupon_id,
      couponName: row.coupon_name,
      couponPercentOff: row.coupon_percent_off ? parseFloat(row.coupon_percent_off) : null,
      couponAmountOff: row.coupon_amount_off ? parseFloat(row.coupon_amount_off) : null,
      couponDuration: row.coupon_duration,
      discountedAmount: parseFloat(row.discounted_amount) || 0,
      metadata: row.metadata || {},
    }))

    const payments: StripePayment[] = (paymentsResult.data || []).map(row => ({
      id: row.id,
      customerId: row.customer_id,
      customerEmail: row.customer_email,
      amount: parseFloat(row.amount) || 0,
      amountRefunded: parseFloat(row.amount_refunded) || 0,
      currency: row.currency || 'usd',
      status: row.status,
      created: new Date(row.created_at),
      invoiceId: row.invoice_id,
      description: row.description,
      failureMessage: row.failure_message,
      refunded: row.refunded || false,
    }))

    const cancellations: StripeCancellation[] = (cancelsResult.data || []).map(row => ({
      subscriptionId: row.subscription_id,
      customerId: row.customer_id,
      customerEmail: row.customer_email,
      customerName: row.customer_name,
      canceledAt: new Date(row.canceled_at),
      cancelAtPeriodEnd: row.cancel_at_period_end || false,
      reason: row.reason,
      monthlyValue: parseFloat(row.monthly_value) || 0,
      subscriptionType: row.subscription_type || 'individual',
      daysAsCustomer: row.days_as_customer || 0,
      totalPaid: parseFloat(row.total_paid) || 0,
      lastPaymentDate: row.last_payment_date ? new Date(row.last_payment_date) : null,
      startDate: new Date(row.start_date),
      endedAt: row.ended_at ? new Date(row.ended_at) : null,
    }))

    const coupons: StripeCoupon[] = (couponsResult.data || []).map(row => ({
      id: row.id,
      name: row.name,
      percentOff: row.percent_off ? parseFloat(row.percent_off) : null,
      amountOff: row.amount_off ? parseFloat(row.amount_off) : null,
      currency: row.currency,
      duration: row.duration,
      durationInMonths: row.duration_in_months,
      timesRedeemed: row.times_redeemed || 0,
      maxRedemptions: row.max_redemptions,
      valid: row.valid ?? true,
    }))

    return {
      subscriptions,
      payments,
      cancellations,
      coupons,
      lastSyncedAt: metadata.last_synced_at,
      hasData: subscriptions.length > 0,
    }
  } catch (error) {
    console.error('Error loading from database:', error)
    return null
  }
}

// Calculate metrics from loaded data
function calculateMetrics(subscriptions: StripeSubscription[], payments: StripePayment[], cancellations: StripeCancellation[]): StripeMetrics {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const activeSubscriptions = subscriptions.filter(s => s.status === 'active')
  const pastDueSubscriptions = subscriptions.filter(s => s.status === 'past_due')

  const mrr = activeSubscriptions.reduce((sum, s) => sum + s.discountedAmount, 0)
  const arr = mrr * 12

  const lifetimeRevenue = payments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + (p.amount - p.amountRefunded), 0)

  const canceledThisMonth = cancellations.filter(
    c => c.canceledAt >= startOfMonth
  ).length

  const revenueLostThisMonth = cancellations
    .filter(c => c.canceledAt >= startOfMonth)
    .reduce((sum, c) => sum + c.monthlyValue, 0)

  const activeAtStartOfMonth = subscriptions.filter(s => {
    if (s.status === 'active') return true
    if (s.status === 'canceled' && s.canceledAt && s.canceledAt >= startOfMonth) return true
    return false
  }).length

  const churnRate = activeAtStartOfMonth > 0
    ? (canceledThisMonth / activeAtStartOfMonth) * 100
    : 0

  const avgCustomerLifetime = cancellations.length > 0
    ? cancellations.reduce((sum, c) => sum + c.daysAsCustomer, 0) / cancellations.length
    : 0

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

  const actualRevenue = activeSubscriptions.reduce((sum, s) => sum + s.discountedAmount, 0)
  const potentialRevenue = activeSubscriptions.reduce((sum, s) => sum + s.planAmount, 0)
  const discountedRevenue = potentialRevenue - actualRevenue

  const failedPaymentsThisMonth = payments.filter(
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
    totalCustomers: subscriptions.length,
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

// Calculate cancellation analysis
function calculateCancellationAnalysis(subscriptions: StripeSubscription[], cancellations: StripeCancellation[]): CancellationAnalysis {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const recentCancellations = [...cancellations]
    .sort((a, b) => b.canceledAt.getTime() - a.canceledAt.getTime())
    .slice(0, 50)

  const cancellationsThisMonth = cancellations.filter(
    c => c.canceledAt >= startOfMonth
  ).length

  const revenueLostThisMonth = cancellations
    .filter(c => c.canceledAt >= startOfMonth)
    .reduce((sum, c) => sum + c.monthlyValue, 0)

  const avgCustomerLifetimeDays = cancellations.length > 0
    ? cancellations.reduce((sum, c) => sum + c.daysAsCustomer, 0) / cancellations.length
    : 0

  const activeAtStartOfMonth = subscriptions.filter(s => {
    if (s.status === 'active') return true
    if (s.status === 'canceled' && s.canceledAt && s.canceledAt >= startOfMonth) return true
    return false
  }).length

  const churnRate = activeAtStartOfMonth > 0
    ? (cancellationsThisMonth / activeAtStartOfMonth) * 100
    : 0

  const cancellationsByMonth: { month: string; count: number; revenueLost: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)

    const monthCancellations = cancellations.filter(
      c => c.canceledAt >= monthDate && c.canceledAt < nextMonth
    )

    cancellationsByMonth.push({
      month: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      count: monthCancellations.length,
      revenueLost: monthCancellations.reduce((sum, c) => sum + c.monthlyValue, 0),
    })
  }

  const earlyChurn = cancellations.filter(c => c.daysAsCustomer < 30).length
  const lateChurn = cancellations.filter(c => c.daysAsCustomer > 180).length

  const canceledSubIds = new Set(cancellations.map(c => c.subscriptionId))
  const canceledSubs = subscriptions.filter(s => canceledSubIds.has(s.id))

  const betaTesterChurn = canceledSubs.filter(s =>
    s.couponPercentOff === 100 ||
    s.couponId?.toLowerCase().includes('beta')
  ).length

  const payingCustomerChurn = cancellations.length - betaTesterChurn

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

// POST /api/stripe/sync - Sync data from Stripe and save to database
export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Sync from Stripe API
    const result = await syncStripeData()

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 })
    }

    // Save to database for persistence
    const saved = await saveToDatabase({
      subscriptions: result.subscriptions || [],
      payments: result.payments || [],
      cancellations: result.cancellations || [],
      coupons: result.coupons || [],
    })

    if (!saved) {
      console.warn('Failed to save to database, data will not persist')
    }

    // Calculate metrics from fresh data
    const metrics = calculateMetrics(
      result.subscriptions || [],
      result.payments || [],
      result.cancellations || []
    )

    const cancellationAnalysis = calculateCancellationAnalysis(
      result.subscriptions || [],
      result.cancellations || []
    )

    // Calculate retention analysis
    const retentionAnalysis = calculateRetentionAnalysis(
      result.subscriptions || [],
      result.payments || [],
      result.cancellations || []
    )

    return NextResponse.json({
      success: true,
      syncResult: {
        subscriptions: result.subscriptions?.length || 0,
        payments: result.payments?.length || 0,
        cancellations: result.cancellations?.length || 0,
        coupons: result.coupons?.length || 0,
      },
      metrics,
      cancellationAnalysis,
      retentionAnalysis,
      lastSyncedAt: new Date().toISOString(),
      savedToDatabase: saved,
    })
  } catch (error) {
    console.error('Stripe sync error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

// GET /api/stripe/sync - Get stored Stripe data from database
export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Load from database
    const dbData = await loadFromDatabase()

    if (!dbData || !dbData.hasData) {
      return NextResponse.json({
        success: true,
        hasData: false,
        message: 'No Stripe data. Click "Refresh Revenue Data" to sync from Stripe.',
      })
    }

    // Calculate metrics from database data
    const metrics = calculateMetrics(
      dbData.subscriptions,
      dbData.payments,
      dbData.cancellations
    )

    const cancellationAnalysis = calculateCancellationAnalysis(
      dbData.subscriptions,
      dbData.cancellations
    )

    // Get filtered subscription lists
    const activeSubscriptions = dbData.subscriptions.filter(s => s.status === 'active')
    const canceledSubscriptions = dbData.subscriptions.filter(s => s.status === 'canceled')
    const pastDueSubscriptions = dbData.subscriptions.filter(s => s.status === 'past_due')
    const scheduledCancellations = dbData.subscriptions.filter(s => s.cancelAtPeriodEnd && s.status === 'active')

    const betaTesters = dbData.subscriptions.filter(s =>
      s.status === 'active' && (
        s.couponPercentOff === 100 ||
        s.couponId?.toLowerCase().includes('beta') ||
        (s.couponDuration === 'forever' && s.couponPercentOff && s.couponPercentOff >= 100)
      )
    )

    const failedPayments = dbData.payments.filter(p => p.status === 'failed')

    // Calculate coupon usage
    const couponUsage = new Map<string, { count: number; impact: number }>()
    for (const sub of dbData.subscriptions.filter(s => s.couponId && s.status === 'active')) {
      const existing = couponUsage.get(sub.couponId!) || { count: 0, impact: 0 }
      existing.count++
      existing.impact += sub.planAmount - sub.discountedAmount
      couponUsage.set(sub.couponId!, existing)
    }

    const couponUsageList = dbData.coupons.map(coupon => ({
      coupon,
      customerCount: couponUsage.get(coupon.id)?.count || 0,
      revenueImpact: couponUsage.get(coupon.id)?.impact || 0,
    })).filter(c => c.customerCount > 0)

    // Calculate retention analysis
    const retentionAnalysis = calculateRetentionAnalysis(
      dbData.subscriptions,
      dbData.payments,
      dbData.cancellations
    )

    return NextResponse.json({
      success: true,
      hasData: true,
      metrics,
      cancellationAnalysis,
      retentionAnalysis,
      activeSubscriptions,
      canceledSubscriptions,
      pastDueSubscriptions,
      scheduledCancellations,
      betaTesters,
      failedPayments,
      couponUsage: couponUsageList,
      lastSyncedAt: dbData.lastSyncedAt,
    })
  } catch (error) {
    console.error('Error fetching Stripe data:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
