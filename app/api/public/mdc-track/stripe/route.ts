import { NextRequest, NextResponse } from 'next/server'
import { insertAttributionEvents } from '@/lib/attribution/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Stripe → purchase_completed. Configure: checkout.session.completed, invoice.paid */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    let event: { type?: string; data?: { object?: Record<string, unknown> }; id?: string }
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
    }

    const type = event?.type || ''
    if (type !== 'checkout.session.completed' && type !== 'invoice.paid') {
      return NextResponse.json({ ok: true, ignored: true, type })
    }

    const obj = (event.data?.object || {}) as Record<string, unknown>
    const meta = (obj.metadata && typeof obj.metadata === 'object'
      ? (obj.metadata as Record<string, string>)
      : {}) as Record<string, string>

    const amount =
      typeof obj.amount_total === 'number'
        ? obj.amount_total / 100
        : typeof obj.amount_paid === 'number'
          ? obj.amount_paid / 100
          : undefined
    const currency =
      typeof obj.currency === 'string' ? obj.currency.toUpperCase() : undefined
    const plan = meta.plan || meta.sku || 'membership'
    const sessionId =
      meta.session_id ||
      meta.mdc_session_id ||
      (typeof obj.client_reference_id === 'string' ? obj.client_reference_id : undefined)

    const stableId = event.id ? stripeEventToUuid(event.id) : undefined

    const result = await insertAttributionEvents(
      [
        {
          id: stableId,
          property: 'unite',
          event_type: 'purchase_completed',
          path: meta.entry_path || meta.path || '/checkout',
          session_id: sessionId,
          source: meta.utm_source || 'stripe',
          medium: meta.utm_medium || 'payment',
          campaign: meta.utm_campaign,
          plan,
          sku: meta.sku || plan,
          amount,
          currency,
          meta: {
            plan,
            amount,
            currency,
            stripe_event_id: event.id,
            stripe_event_type: type,
          },
          is_bot: false,
        },
      ],
      { userAgent: 'stripe-webhook' }
    )

    return NextResponse.json({ ok: true, accepted: result.accepted, deduped: result.deduped, ids: result.ids })
  } catch (err) {
    console.error('[mdc-track/stripe]', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'error' }, { status: 500 })
  }
}

function stripeEventToUuid(stripeEventId: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x811c9dc5
  for (let i = 0; i < stripeEventId.length; i++) {
    const c = stripeEventId.charCodeAt(i)
    h1 ^= c
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= c + i
    h2 = Math.imul(h2, 0x01000193)
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  const a = hex(h1)
  const b = hex(h2)
  const c = hex(h1 ^ h2)
  const d = hex(~h1)
  return `${a.slice(0, 8)}-${b.slice(0, 4)}-4${b.slice(5, 8)}-a${c.slice(1, 4)}-${c.slice(4)}${d.slice(0, 4)}`
}
