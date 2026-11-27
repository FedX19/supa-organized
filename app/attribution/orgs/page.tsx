'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AttributionShell } from '@/components/attribution/AttributionShell'
import { KpiCard } from '@/components/attribution/KpiCard'
import { StatusBanner } from '@/components/attribution/StatusBanner'
import { BOTS_EVENT, readShowBots } from '@/components/attribution/BotToggle'
import { createSupabaseClient } from '@/lib/supabase'
import { formatNumber } from '@/lib/attribution/format'
import { ClientWhen } from '@/components/attribution/ClientWhen'

type OrgRow = {
  code: string
  name: string
  org_type: 'little_league' | 'travel' | 'other'
  email: string | null
  batch_date: string | null
  campaign: string | null
  path: string
  in_registry: boolean
  visited: boolean
  first_visit: string | null
  last_visit: string | null
  page_views: number
  sessions: number
  pages: string[]
  clicked_signup: boolean
  clicked_unite: boolean
  url: string | null
}

type Filter = 'all' | 'little_league' | 'travel' | 'visited' | 'waiting'

const TYPE_LABEL: Record<OrgRow['org_type'], string> = {
  little_league: 'Little League',
  travel: 'Travel',
  other: 'Other',
}

async function authHeader(): Promise<HeadersInit | null> {
  const supabase = createSupabaseClient()
  const { data: sessionData } = await supabase.auth.getSession()
  let token = sessionData.session?.access_token
  if (!token) {
    const refreshed = await supabase.auth.refreshSession()
    token = refreshed.data.session?.access_token
  }
  if (!token) return null
  return { Authorization: `Bearer ${token}` }
}

export default function AttributionOrgsPage() {
  const [rows, setRows] = useState<OrgRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null)
  const [includeBots, setIncludeBots] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const refresh = useCallback(async () => {
    try {
      const headers = await authHeader()
      if (!headers) {
        setError('Not signed in')
        setLoading(false)
        return
      }
      const showBots = readShowBots()
      setIncludeBots(showBots)
      const res = await fetch(`/api/attribution/orgs?include_bots=${showBots ? '1' : '0'}`, {
        headers,
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        setMigrationRequired(Boolean(data.migrationRequired))
        setLoading(false)
        return
      }
      setRows(data.rows || [])
      setMigrationRequired(Boolean(data.migrationRequired))
      setError(null)
      setLastFetchedAt(new Date().toISOString())
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onToggle = () => void refresh()
    window.addEventListener(BOTS_EVENT, onToggle)
    return () => window.removeEventListener(BOTS_EVENT, onToggle)
  }, [refresh])

  const visible = useMemo(() => {
    return rows.filter((row) => {
      if (filter === 'little_league') return row.org_type === 'little_league'
      if (filter === 'travel') return row.org_type === 'travel'
      if (filter === 'visited') return row.visited
      if (filter === 'waiting') return row.in_registry && !row.visited
      return true
    })
  }, [rows, filter])

  const emailed = rows.filter((r) => r.in_registry).length
  const visited = rows.filter((r) => r.visited).length
  const signups = rows.filter((r) => r.clicked_signup).length
  const unite = rows.filter((r) => r.clicked_unite).length

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'little_league', label: 'Little League' },
    { id: 'travel', label: 'Travel' },
    { id: 'visited', label: 'Visited' },
    { id: 'waiting', label: 'No visit yet' },
  ]

  return (
    <AttributionShell activeNav="orgs">
      <h1 className="text-2xl font-semibold text-white mb-1">Orgs we emailed</h1>
      <p className="text-sm text-slate-400 mb-4 max-w-2xl">
        Each outreach link is <span className="text-slate-300">?o=org-code&amp;c=campaign</span>.
        This view compares the registry with real visits. {includeBots ? 'Bots are included.' : 'Humans only.'}
      </p>
      <StatusBanner
        eventCount={visited}
        lastFetchedAt={lastFetchedAt}
        error={error}
        migrationRequired={migrationRequired}
        onRefresh={() => void refresh()}
      />
      {migrationRequired ? (
        <p className="mb-4 text-sm text-amber-200">
          Visits still show by code. Run{' '}
          <code className="text-amber-100">supabase/migrations/20261127180000_outreach_orgs.sql</code>{' '}
          so names, emails, and batch dates can be stored.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <KpiCard label="Orgs emailed" value={formatNumber(emailed)} hint="Rows in the registry" tone="teal" />
        <KpiCard
          label="Orgs that visited"
          value={formatNumber(visited)}
          hint={emailed ? `${Math.round((visited / emailed) * 100)}% of the registry` : 'Human page views with an org code'}
          tone="indigo"
        />
        <KpiCard label="Clicked signup" value={formatNumber(signups)} hint="Contact, form, or league onboard" tone="amber" />
        <KpiCard label="Clicked UniteHQ" value={formatNumber(unite)} hint="Left for unite-hq.com" tone="emerald" />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium min-h-[36px] ${
              filter === chip.id
                ? 'border-teal-400/50 bg-teal-400/15 text-teal-200'
                : 'border-card-border bg-card text-slate-400 hover:text-white'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-card-border bg-card">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-b border-card-border">
              <th className="px-4 py-3 font-medium">Org</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Batch</th>
              <th className="px-3 py-3 font-medium">First</th>
              <th className="px-3 py-3 font-medium">Last</th>
              <th className="px-3 py-3 text-right font-medium">Sessions</th>
              <th className="px-3 py-3 font-medium">Pages</th>
              <th className="px-3 py-3 font-medium">Signup</th>
              <th className="px-3 py-3 font-medium">UniteHQ</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-slate-500">
                  Loading orgs…
                </td>
              </tr>
            ) : null}
            {!loading && visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-slate-400">
                  No orgs yet. Mint links with{' '}
                  <code className="text-slate-200">node scripts/mint-org-links.mjs batch.csv --register</code>{' '}
                  from the modern-day-coach repo.
                </td>
              </tr>
            ) : null}
            {visible.map((row) => (
              <tr key={row.code} className="border-b border-card-border/60 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{row.name}</div>
                  <div className="text-xs text-slate-500">{row.email || 'No email stored'}</div>
                  <div className="mt-1 font-mono text-[11px] text-teal-300/90">o={row.code}</div>
                </td>
                <td className="px-3 py-3 text-slate-300">{TYPE_LABEL[row.org_type]}</td>
                <td className="px-3 py-3 text-slate-400">
                  <div>{row.batch_date || '—'}</div>
                  <div className="text-[11px] text-slate-500">{row.campaign || ''}</div>
                </td>
                <td className="px-3 py-3 text-slate-300">
                  {row.first_visit ? <ClientWhen iso={row.first_visit} mode="when" /> : '—'}
                </td>
                <td className="px-3 py-3 text-slate-300">
                  {row.last_visit ? <ClientWhen iso={row.last_visit} mode="when" /> : '—'}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-white">
                  {row.visited ? row.sessions : '—'}
                  {row.visited ? (
                    <div className="text-[11px] text-slate-500">{row.page_views} views</div>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-xs text-slate-400">
                  {row.pages.length ? row.pages.join(', ') : '—'}
                </td>
                <td className="px-3 py-3">{row.clicked_signup ? 'Yes' : '—'}</td>
                <td className="px-3 py-3">{row.clicked_unite ? 'Yes' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AttributionShell>
  )
}
