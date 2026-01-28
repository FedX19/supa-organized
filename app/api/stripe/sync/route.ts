import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  syncStripeData,
  calculateStripeMetrics,
  getCancellationAnalysis,
  getActiveSubscriptions,
  getCanceledSubscriptions,
  getPastDueSubscriptions,
  getScheduledCancellations,
  getBetaTesters,
  getFailedPayments,
  getCouponUsage,
  getLastSyncTime,
  hasStripeData,
} from '@/lib/stripe'

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

// POST /api/stripe/sync - Sync data from Stripe
export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncStripeData()

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 })
    }

    // Calculate metrics after sync
    const metrics = calculateStripeMetrics()
    const cancellationAnalysis = getCancellationAnalysis()

    return NextResponse.json({
      success: true,
      syncResult: result,
      metrics,
      cancellationAnalysis,
      lastSyncedAt: getLastSyncTime(),
    })
  } catch (error) {
    console.error('Stripe sync error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

// GET /api/stripe/sync - Get current Stripe data (without syncing)
export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (!hasStripeData()) {
      return NextResponse.json({
        success: true,
        hasData: false,
        message: 'No Stripe data. Click "Refresh Revenue Data" to sync from Stripe.',
      })
    }

    const metrics = calculateStripeMetrics()
    const cancellationAnalysis = getCancellationAnalysis()
    const activeSubscriptions = getActiveSubscriptions()
    const canceledSubscriptions = getCanceledSubscriptions()
    const pastDueSubscriptions = getPastDueSubscriptions()
    const scheduledCancellations = getScheduledCancellations()
    const betaTesters = getBetaTesters()
    const failedPayments = getFailedPayments()
    const couponUsage = getCouponUsage()

    return NextResponse.json({
      success: true,
      hasData: true,
      metrics,
      cancellationAnalysis,
      activeSubscriptions,
      canceledSubscriptions,
      pastDueSubscriptions,
      scheduledCancellations,
      betaTesters,
      failedPayments,
      couponUsage,
      lastSyncedAt: getLastSyncTime(),
    })
  } catch (error) {
    console.error('Error fetching Stripe data:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
