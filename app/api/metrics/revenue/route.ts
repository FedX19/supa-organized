import { NextRequest, NextResponse } from 'next/server'
import { getCustomerClient, errorStatus, errorMessage } from '@/lib/customer-client'
import { computeRevenueMetrics } from '@/lib/metrics/revenue'

export const dynamic = 'force-dynamic'

/**
 * Separate from /overview because this makes live Stripe API calls — one set
 * per connected coach account. Kept isolated so a Stripe outage or a missing
 * key degrades one panel instead of the whole dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    const client = await getCustomerClient(request)
    const revenue = await computeRevenueMetrics(client)
    return NextResponse.json({ success: true, ...revenue })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: errorMessage(error) },
      { status: errorStatus(error) }
    )
  }
}
