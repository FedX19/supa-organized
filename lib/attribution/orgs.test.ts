import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateOrgs, codeForOrg, orgOutreachUrl } from './orgs.ts'
import type { AttributionEvent } from './types.ts'

test('codes and links stay free of email', () => {
  const code = codeForOrg('little_league', 'Westfield Little League')
  assert.equal(code, 'll-westfield-little-league')
  const url = orgOutreachUrl(code, 'll-nov-2026', '/leagues')
  assert.equal(url, 'https://www.modern-day-coach.com/leagues?o=ll-westfield-little-league&c=ll-nov-2026')
  assert.equal(url.includes('@'), false)
})

test('visited orgs roll up pages, sessions, and clicks', () => {
  const events: AttributionEvent[] = [
    {
      id: '1',
      created_at: '2026-11-27T15:00:00.000Z',
      property: 'website',
      event_type: 'page_view',
      path: '/leagues',
      session_id: 's1',
      campaign: 'll-nov-2026',
      meta: { org_code: 'll-westfield' },
    },
    {
      id: '2',
      created_at: '2026-11-27T15:05:00.000Z',
      property: 'website',
      event_type: 'page_view',
      path: '/contact',
      session_id: 's1',
      meta: { org_code: 'll-westfield' },
    },
    {
      id: '3',
      created_at: '2026-11-27T15:06:00.000Z',
      property: 'website',
      event_type: 'cta_click',
      path: '/leagues',
      session_id: 's1',
      meta: { org_code: 'll-westfield', href: 'https://app.unite-hq.com/onboard/league' },
    },
    {
      id: '4',
      created_at: '2026-11-27T16:00:00.000Z',
      property: 'website',
      event_type: 'page_view',
      path: '/leagues',
      session_id: 'bot',
      is_bot: true,
      meta: { org_code: 'tb-eastside' },
    },
  ]
  const rows = aggregateOrgs(events.filter((e) => !e.is_bot), [
    {
      code: 'll-westfield',
      name: 'Westfield Little League',
      org_type: 'little_league',
      email: 'president@westfield.example',
      batch_date: '2026-11-27',
      campaign: 'll-nov-2026',
      path: '/leagues',
    },
    {
      code: 'tb-eastside',
      name: 'Eastside Elite',
      org_type: 'travel',
      email: 'info@eastside.example',
      batch_date: '2026-11-27',
      campaign: 'tb-nov-2026',
      path: '/leagues',
    },
  ])
  const west = rows.find((r) => r.code === 'll-westfield')
  const east = rows.find((r) => r.code === 'tb-eastside')
  assert.ok(west)
  assert.equal(west.visited, true)
  assert.equal(west.page_views, 2)
  assert.equal(west.sessions, 1)
  assert.deepEqual(west.pages, ['/contact', '/leagues'])
  assert.equal(west.clicked_signup, true)
  assert.equal(west.clicked_unite, true)
  assert.equal(west.in_registry, true)
  assert.ok(east)
  assert.equal(east.visited, false)
  assert.equal(rows[0]?.code, 'll-westfield')
})
