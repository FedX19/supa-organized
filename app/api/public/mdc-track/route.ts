import { NextRequest, NextResponse } from 'next/server'
import {
  geoFromRequest,
  getDefaultWorkspaceId,
  insertAttributionEvents,
  listAttributionEvents,
  parseTrackBody,
} from '@/lib/attribution/events'
import { syncEventsFromUnite } from '@/lib/attribution/sync-from-unite'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_ORIGINS = [
  'https://modern-day-coach.com',
  'https://www.modern-day-coach.com',
  'https://app.unite-hq.com',
  'https://unite-hq.com',
  'https://www.unite-hq.com',
  'https://supa-organized.vercel.app',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
]

function corsHeaders(origin: string | null): HeadersInit {
  const allow =
    origin &&
    (ALLOWED_ORIGINS.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.grok-sandbox.com'))
  return {
    'Access-Control-Allow-Origin': allow && origin ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MDC-Forward-Secret',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 80
const rateMap = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || entry.resetAt <= now) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_MAX) return true
  entry.count += 1
  return false
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  })
}

/**
 * Public recent feed for live dashboards / dual-write checks.
 * Non-PII only. Prefer authenticated /api/attribution/events for the product UI.
 */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(request.headers.get('origin'))
  try {
    // Opportunistic backfill from Unite bus
    await syncEventsFromUnite(100)
    const limitRaw = request.nextUrl.searchParams.get('limit')
    const limit = limitRaw ? Number(limitRaw) : 100
    const events = await listAttributionEvents(Number.isFinite(limit) ? limit : 100)
    return NextResponse.json(
      { ok: true, live: true, count: events.length, events },
      { headers: { ...headers, 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        live: false,
        count: 0,
        events: [],
        error: err instanceof Error ? err.message : 'error',
      },
      { status: 500, headers }
    )
  }
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request.headers.get('origin'))
  const ip = clientIp(request)
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429, headers })
  }

  // Optional dual-write auth from Unite forwarder
  const forwardSecret = process.env.MDC_TRACK_FORWARD_SECRET
  const provided = request.headers.get('x-mdc-forward-secret')
  // If secret is configured AND a secret header is sent, require match.
  // Browser beacons never send this header — they always allowed.
  if (forwardSecret && provided && provided !== forwardSecret) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403, headers })
  }

  // Fail loudly if migrations not applied (workspace missing)
  try {
    const workspaceId = await getDefaultWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'attribution workspace missing — run supabase/migrations',
          migrationRequired: true,
        },
        { status: 503, headers }
      )
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'server_error',
        migrationRequired: true,
      },
      { status: 503, headers }
    )
  }

  const edgeGeo = geoFromRequest(request.headers)

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    try {
      const text = await request.text()
      body = text ? JSON.parse(text) : null
    } catch {
      body = null
    }
  }

  const items: unknown[] = Array.isArray((body as { events?: unknown })?.events)
    ? ((body as { events: unknown[] }).events as unknown[])
    : [body]

  const parsed = items.map(parseTrackBody).filter(Boolean) as NonNullable<
    ReturnType<typeof parseTrackBody>
  >[]

  if (parsed.length === 0) {
    return NextResponse.json({ ok: false, error: 'empty_body' }, { status: 400, headers })
  }

  try {
    const result = await insertAttributionEvents(parsed, edgeGeo)
    return NextResponse.json(
      { ok: true, accepted: result.accepted, ids: result.ids },
      { status: 202, headers }
    )
  } catch (err) {
    console.error('[mdc-track] post failed', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'error' },
      { status: 500, headers }
    )
  }
}
