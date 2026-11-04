import { NextRequest, NextResponse } from 'next/server'
import {
  geoFromRequest,
  insertAttributionEvents,
  parseTrackBody,
} from '@/lib/attribution/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_ORIGINS = [
  'https://modern-day-coach.com',
  'https://www.modern-day-coach.com',
  'https://app.unite-hq.com',
  'https://unite-hq.com',
  'https://www.unite-hq.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
]

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin &&
    (ALLOWED_ORIGINS.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.unite-hq.com'))
      ? origin
      : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MDC-Forward-Secret',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  })
}

// Event history is available only through authenticated /api/attribution/events.
export async function GET() {
  return NextResponse.json({ ok: false, error: 'authentication_required' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request.headers.get('origin'))
  try {
    const forwardSecret = process.env.MDC_TRACK_FORWARD_SECRET
    if (forwardSecret) {
      const got = request.headers.get('x-mdc-forward-secret')
      if (got && got !== forwardSecret) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers })
      }
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400, headers })
    }

    const batch: unknown[] = Array.isArray((body as { events?: unknown })?.events)
      ? ((body as { events: unknown[] }).events as unknown[])
      : [body]

    const parsed = batch.map(parseTrackBody).filter(Boolean)
    if (parsed.length === 0) {
      return NextResponse.json({ ok: false, error: 'no events' }, { status: 400, headers })
    }

    const isVerifiedForward = Boolean(forwardSecret && request.headers.get('x-mdc-forward-secret') === forwardSecret)
    const unsafe = new Set(['purchase', 'paid', 'stripe_paid', 'purchase_completed', 'activate_membership'])
    if (!isVerifiedForward && parsed.some((e) => unsafe.has(String(e?.event_type || e?.type).toLowerCase()))) {
      return NextResponse.json({ ok: false, error: 'trusted_conversion_required' }, { status: 403, headers })
    }

    const edgeGeo = geoFromRequest(request.headers)
    const result = await insertAttributionEvents(parsed as never[], {
      edgeGeo,
      userAgent: request.headers.get('user-agent'),
      headers: request.headers,
    })

    if (result.accepted === 0 && result.ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'ingest_unavailable' }, { status: 503, headers })
    }
    return NextResponse.json(
      {
        ok: true,
        accepted: result.accepted,
        deduped: result.deduped,
        bots: result.bots,
        ids: result.ids,
      },
      { headers }
    )
  } catch (err) {
    console.error('[mdc-track]', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'error' },
      { status: 500, headers }
    )
  }
}
