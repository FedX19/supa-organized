import { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll } from './fetch-all'

/**
 * The coach funnel — "tell me when a new coach signs up, and where they stall".
 *
 * Derived from consultant_workspaces + consultant_clients. No instrumentation.
 *
 * ⚠️ JOIN KEY — verified on production, easy to get wrong:
 * `consultant_clients.organization_id` points at the coach's **client portal**
 * org (`business_type='consultant_client'`), NOT the admin org. Joining on
 * `admin_organization_id` — the intuitive guess — silently returns zero clients
 * for every coach forever.
 *
 * Production state at build time (2026-08-04): 4 signed up → 3 charges_enabled
 * → 2 listed → 1 with a client → 0 with revenue. No new coach since 2026-05-19.
 */

export type CoachStage =
  | 'signed_up'
  | 'connect_started'
  | 'can_take_payment'
  | 'listed'
  | 'has_client'
  | 'earning'

/** Ordered worst → best. A coach's stage is the furthest one they've reached. */
export const COACH_STAGES: CoachStage[] = [
  'signed_up',
  'connect_started',
  'can_take_payment',
  'listed',
  'has_client',
  'earning',
]

export const COACH_STAGE_LABELS: Record<CoachStage, string> = {
  signed_up: 'Signed up',
  connect_started: 'Started Stripe',
  can_take_payment: 'Can take payment',
  listed: 'Listing live',
  has_client: 'First client',
  earning: 'Earning',
}

/** What to actually do about a coach sitting at each stage. */
export const COACH_STAGE_NEXT_ACTION: Record<CoachStage, string> = {
  signed_up: 'Has not started Stripe onboarding — nudge them to set up payouts.',
  connect_started: 'Stripe started but not finished — they cannot get paid yet.',
  can_take_payment: 'Can take payment but listing is not public — help them publish.',
  listed: 'Listing is live with no clients yet — this is a demand problem.',
  has_client: 'Has a client but no revenue collected yet — check billing.',
  earning: 'Fully live and earning.',
}

export interface CoachRow {
  workspaceId: string
  ownerProfileId: string | null
  displayName: string
  signedUpAt: Date | null
  connectStarted: boolean
  chargesEnabled: boolean
  detailsSubmitted: boolean
  listed: boolean
  listedAt: Date | null
  monthlyPriceCents: number | null
  enabledToolCount: number
  clientCount: number
  activeClientCount: number
  lifetimePaidCents: number
  stage: CoachStage
  nextAction: string
  /** Days sitting at the current stage without progressing. */
  daysStalled: number | null
}

export interface CoachFunnelStep {
  stage: CoachStage
  label: string
  count: number
  /** Coaches who reached the previous step but not this one. */
  droppedHere: number
}

export interface CoachMetrics {
  coaches: CoachRow[]
  funnel: CoachFunnelStep[]
  totalCoaches: number
  newInWindow: CoachRow[]
  warnings: string[]
}

interface WorkspaceRow {
  id: string
  owner_profile_id: string | null
  admin_organization_id: string | null
  client_organization_id: string | null
  display_name: string | null
  created_at: string | null
  marketplace_public_listed: boolean | null
  marketplace_listed_at: string | null
  marketplace_monthly_price_cents: number | null
  enabled_tools: string[] | null
  stripe_account_id: string | null
  stripe_charges_enabled: boolean | null
  stripe_details_submitted: boolean | null
}

interface ClientRow {
  organization_id: string | null
  status: string | null
  subscription_status: string | null
  lifetime_paid_cents: number | null
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function resolveStage(row: {
  connectStarted: boolean
  chargesEnabled: boolean
  listed: boolean
  clientCount: number
  lifetimePaidCents: number
}): CoachStage {
  if (row.lifetimePaidCents > 0) return 'earning'
  if (row.clientCount > 0) return 'has_client'
  if (row.listed) return 'listed'
  if (row.chargesEnabled) return 'can_take_payment'
  if (row.connectStarted) return 'connect_started'
  return 'signed_up'
}

export async function computeCoachMetrics(
  client: SupabaseClient,
  options: { now?: Date; newSinceHours?: number } = {}
): Promise<CoachMetrics> {
  const now = options.now ?? new Date()
  const newSinceHours = options.newSinceHours ?? 24 * 7
  const warnings: string[] = []

  const [workspacesRes, clientsRes] = await Promise.all([
    fetchAll<WorkspaceRow>(client, 'consultant_workspaces', {
      columns:
        'id, owner_profile_id, admin_organization_id, client_organization_id, display_name, created_at, marketplace_public_listed, marketplace_listed_at, marketplace_monthly_price_cents, enabled_tools, stripe_account_id, stripe_charges_enabled, stripe_details_submitted',
      orderBy: 'created_at',
    }),
    fetchAll<ClientRow>(client, 'consultant_clients', {
      columns: 'id, organization_id, status, subscription_status, lifetime_paid_cents',
    }),
  ])

  if (workspacesRes.error) warnings.push(`consultant_workspaces: ${workspacesRes.error}`)
  if (clientsRes.error) warnings.push(`consultant_clients: ${clientsRes.error}`)

  // Index clients by the CLIENT PORTAL org id — see the join-key note above.
  const clientsByPortalOrg = new Map<string, ClientRow[]>()
  for (const c of clientsRes.rows) {
    if (!c.organization_id) continue
    const list = clientsByPortalOrg.get(c.organization_id) ?? []
    list.push(c)
    clientsByPortalOrg.set(c.organization_id, list)
  }

  const coaches: CoachRow[] = workspacesRes.rows.map((w) => {
    const portalClients = w.client_organization_id
      ? (clientsByPortalOrg.get(w.client_organization_id) ?? [])
      : []

    const activeClientCount = portalClients.filter(
      (c) => c.subscription_status === 'active' || c.status === 'active'
    ).length
    const lifetimePaidCents = portalClients.reduce(
      (sum, c) => sum + (c.lifetime_paid_cents ?? 0),
      0
    )

    const connectStarted = Boolean(w.stripe_account_id)
    const chargesEnabled = Boolean(w.stripe_charges_enabled)
    const listed = Boolean(w.marketplace_public_listed)
    const signedUpAt = toDate(w.created_at)

    const stage = resolveStage({
      connectStarted,
      chargesEnabled,
      listed,
      clientCount: portalClients.length,
      lifetimePaidCents,
    })

    // Time since the last thing that moved them forward.
    const lastProgressAt = toDate(w.marketplace_listed_at) ?? signedUpAt
    const daysStalled =
      stage === 'earning' || !lastProgressAt
        ? null
        : Math.floor((now.getTime() - lastProgressAt.getTime()) / 864e5)

    return {
      workspaceId: w.id,
      ownerProfileId: w.owner_profile_id,
      displayName: w.display_name?.trim() || '(unnamed workspace)',
      signedUpAt,
      connectStarted,
      chargesEnabled,
      detailsSubmitted: Boolean(w.stripe_details_submitted),
      listed,
      listedAt: toDate(w.marketplace_listed_at),
      monthlyPriceCents: w.marketplace_monthly_price_cents,
      enabledToolCount: w.enabled_tools?.length ?? 0,
      clientCount: portalClients.length,
      activeClientCount,
      lifetimePaidCents,
      stage,
      nextAction: COACH_STAGE_NEXT_ACTION[stage],
      daysStalled,
    }
  })

  // A coach counts toward a step if they reached it OR anything beyond it.
  const reachedAtLeast = (c: CoachRow, stage: CoachStage) =>
    COACH_STAGES.indexOf(c.stage) >= COACH_STAGES.indexOf(stage)

  const funnel: CoachFunnelStep[] = COACH_STAGES.map((stage, i) => {
    const count = coaches.filter((c) => reachedAtLeast(c, stage)).length
    const prevCount =
      i === 0 ? count : coaches.filter((c) => reachedAtLeast(c, COACH_STAGES[i - 1])).length
    return {
      stage,
      label: COACH_STAGE_LABELS[stage],
      count,
      droppedHere: Math.max(0, prevCount - count),
    }
  })

  const newSince = new Date(now.getTime() - newSinceHours * 36e5)
  const newInWindow = coaches
    .filter((c) => c.signedUpAt && c.signedUpAt >= newSince)
    .sort((a, b) => (b.signedUpAt?.getTime() ?? 0) - (a.signedUpAt?.getTime() ?? 0))

  coaches.sort((a, b) => (b.signedUpAt?.getTime() ?? 0) - (a.signedUpAt?.getTime() ?? 0))

  return { coaches, funnel, totalCoaches: coaches.length, newInWindow, warnings }
}
