import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { getCustomerClient } from '@/lib/customer-client'
import { requireAttributionAccess, AttributionAuthError } from '@/lib/attribution/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GameSpec = { table: string; time: string; actor: string; completed?: boolean }
const gameSpecs: Record<string, GameSpec[]> = {
  arcade: [
    { table: 'arcade_practice_sessions', time: 'created_at', actor: 'profile_id' },
    { table: 'arcade_zone_practice', time: 'created_at', actor: 'profile_id' },
    { table: 'arcade_ranked_rounds', time: 'completed_at', actor: 'profile_id', completed: true },
    { table: 'arcade_adult_practice', time: 'created_at', actor: 'profile_id' },
    { table: 'arcade_adult_ranked', time: 'completed_at', actor: 'profile_id', completed: true },
  ],
  fundy: [{ table: 'fundy_rounds', time: 'completed_at', actor: 'played_by_profile_id', completed: true }],
}

async function gameSummary(client: Awaited<ReturnType<typeof getCustomerClient>>, specs: GameSpec[], since: string) {
  const result = await Promise.all(specs.map(async (s) => {
    const people = new Set<string>()
    let rounds = 0
    for (let offset = 0; offset < 100000; offset += 1000) {
      let query = client.from(s.table).select(s.actor).gte(s.time, since).order(s.actor, { ascending: true }).range(offset, offset + 999)
      if (s.completed) query = query.not(s.time, 'is', null)
      const { data, error } = await query
      if (error) throw new Error('Game data unavailable: ' + s.table)
      for (const row of data ?? []) {
        rounds += 1
        const id = (row as unknown as Record<string, unknown>)[s.actor]
        if (typeof id === 'string') people.add(id)
      }
      if ((data?.length ?? 0) < 1000) break
      if (offset === 99000) throw new Error('Game data exceeds safe report limit')
    }
    return { table: s.table, completedRecords: rounds, actors: Array.from(people) }
  }))
  return { completedRecords: result.reduce((n, x) => n + x.completedRecords, 0),
    uniqueAccounts: new Set(result.flatMap(x => x.actors)).size,
    byMode: result.map(({ table, completedRecords }) => ({ mode: table.replace(/^arcade_/, ''), completedRecords })) }
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireAttributionAccess(request)
    const days = request.nextUrl.searchParams.get('days') === '7' ? 7 : 30
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const admin = createSupabaseAdminClient()
    // Never permit this API to read another user's linked database.
    const customer = await getCustomerClient(request)
    const [site, unite, arcade, fundy] = await Promise.all([
      admin.from('attribution_events').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('property', 'website').eq('event_type', 'page_view').eq('is_bot', false).gte('created_at', since),
      admin.from('attribution_events').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('property', 'unite').eq('event_type', 'page_view').eq('is_bot', false).gte('created_at', since),
      gameSummary(customer, gameSpecs.arcade, since),
      gameSummary(customer, gameSpecs.fundy, since),
    ])
    if (site.error || unite.error) throw new Error('Traffic analytics unavailable')
    return NextResponse.json({ ok: true, days, website: { pageViews: site.count ?? 0 },
      unite: { pageViews: unite.count ?? 0 }, arcade, fundy,
      caveat: 'Game data comes from saved UniteHQ records. Internal accounts remain included until internal account exclusions are configured.' })
  } catch (error) {
    const status = error instanceof AttributionAuthError ? error.status :
      error instanceof Error && error.message === 'No connection found' ? 404 : 503
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unavailable' }, { status })
  }
}
