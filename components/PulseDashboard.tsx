'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserConnection } from '@/lib/supabase'

/**
 * The "what is happening right now" view.
 *
 * Design rule for this page: at the current scale (~7 genuinely active users)
 * NAMES BEAT PERCENTAGES. Every count links to the list of actual people
 * behind it, and any metric we cannot compute renders as "unknown" rather
 * than as a confident zero.
 */

interface Props {
  connection: UserConnection
  getValidAccessToken: () => Promise<string | null>
}

type KindCounts = Record<string, number>

interface SignupRow {
  profileId: string
  name: string
  email: string | null
  kind: string
  signedUpAt: string | null
  lastSignInAt: string | null
  hoursToFirstLogin: number | null
  neverActivated: boolean
}

interface CoachRow {
  workspaceId: string
  displayName: string
  signedUpAt: string | null
  stage: string
  nextAction: string
  daysStalled: number | null
  clientCount: number
  activeClientCount: number
  lifetimePaidCents: number
  monthlyPriceCents: number | null
  enabledToolCount: number
}

interface FeatureRow {
  key: string
  label: string
  status: 'instrumented' | 'not_instrumented' | 'retired'
  note?: string
  eventCount: number
  uniqueUsers: number
  lastUsedAt: string | null
  silent: boolean
}

interface OverviewPayload {
  success: boolean
  generatedAt: string
  includeLeague: boolean
  totals: {
    visibleUsers: number
    allUsers: number
    leagueLegacyExcluded: number
    byKind: KindCounts
  }
  signups: {
    windows: Array<{ label: string; total: number; byKind: KindCounts }>
    recent: SignupRow[]
    neverActivated: SignupRow[]
    activation: {
      totalAccounts: number
      everSignedIn: number
      neverSignedIn: number
      activationRate: number | null
      dataAvailable: boolean
    }
  }
  coaches: {
    coaches: CoachRow[]
    funnel: Array<{ stage: string; label: string; count: number; droppedHere: number }>
    totalCoaches: number
    newInWindow: CoachRow[]
  }
  retention: {
    dataAvailable: boolean
    active7d: number
    active30d: number
    active90d: number
    slipping: Array<{ name: string; email: string | null; daysSinceLastSignIn: number | null }>
    dormant: Array<{ name: string; email: string | null; daysSinceLastSignIn: number | null }>
    interpretationNote: string
  }
  features: {
    features: FeatureRow[]
    instrumentedCount: number
    notInstrumentedCount: number
    totalEvents: number
    errorCount: number
    coverageNote: string
  }
  warnings: string[]
}

const KIND_LABELS: Record<string, string> = {
  coach: 'Coaches',
  mdc_member: 'MDC members',
  staff: 'Staff',
  guardian: 'Parents',
  orphan: 'No profile',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysAgo(iso: string | null): string {
  if (!iso) return 'never'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d}d ago`
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-white font-semibold">{title}</h3>
        {subtitle && <p className="text-slate-400 text-xs mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'warn' | 'good'
}) {
  const toneClass =
    tone === 'warn' ? 'text-amber-400' : tone === 'good' ? 'text-emerald-400' : 'text-white'
  return (
    <div>
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
    </div>
  )
}

export default function PulseDashboard({ connection, getValidAccessToken }: Props) {
  const [data, setData] = useState<OverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeLeague, setIncludeLeague] = useState(false)
  const [showNeverActivated, setShowNeverActivated] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getValidAccessToken()
      if (!token) throw new Error('Session expired — please log in again.')

      const res = await fetch(`/api/metrics/overview?include_league=${includeLeague}&days=30`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load metrics')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }, [getValidAccessToken, includeLeague])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !data) {
    return <div className="text-slate-400 py-12 text-center">Loading pulse…</div>
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
        <p className="text-red-400 font-medium">{error}</p>
        <button
          onClick={() => void load()}
          className="mt-3 px-4 py-2 bg-primary hover:bg-primary-hover text-black font-medium rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const { totals, signups, coaches, retention, features } = data
  const activation = signups.activation

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-400 text-sm">
          {connection.connection_name} · generated {daysAgo(data.generatedAt)}
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={includeLeague}
            onChange={(e) => setIncludeLeague(e.target.checked)}
            className="rounded border-card-border bg-card"
          />
          Include retired league data
          {!includeLeague && totals.leagueLegacyExcluded > 0 && (
            <span className="text-slate-500">({totals.leagueLegacyExcluded} hidden)</span>
          )}
        </label>
      </div>

      {data.warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-amber-400 font-medium text-sm mb-2">Data quality notes</p>
          <ul className="text-amber-200/70 text-xs space-y-1 list-disc list-inside">
            {data.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Signups */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {signups.windows.map((w) => (
          <div key={w.label} className="bg-card border border-card-border rounded-xl p-5">
            <Metric label={w.label} value={w.total} hint="new signups" />
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(w.byKind)
                .filter(([, n]) => n > 0)
                .map(([kind, n]) => (
                  <span
                    key={kind}
                    className="text-xs px-2 py-1 rounded-full bg-card-hover text-slate-300"
                  >
                    {n} {KIND_LABELS[kind] ?? kind}
                  </span>
                ))}
              {w.total === 0 && <span className="text-xs text-slate-500">No signups</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Activation gap — the biggest number in the business */}
      <Card
        title="Activation gap"
        subtitle="Accounts that exist versus accounts that have ever been used."
      >
        {!activation.dataAvailable ? (
          <p className="text-amber-400 text-sm">
            Sign-in history unavailable — activation is <strong>unknown</strong>, not zero.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Metric label="Accounts" value={activation.totalAccounts} />
              <Metric label="Ever signed in" value={activation.everSignedIn} tone="good" />
              <Metric
                label="Never signed in"
                value={activation.neverSignedIn}
                tone={activation.neverSignedIn > 0 ? 'warn' : 'default'}
              />
              <Metric
                label="Activation rate"
                value={activation.activationRate === null ? '—' : `${activation.activationRate}%`}
                tone={
                  activation.activationRate !== null && activation.activationRate < 50
                    ? 'warn'
                    : 'good'
                }
              />
            </div>
            {signups.neverActivated.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowNeverActivated((v) => !v)}
                  className="text-primary text-sm hover:underline"
                >
                  {showNeverActivated ? 'Hide' : 'Show'} {signups.neverActivated.length} accounts
                  that never signed in
                </button>
                {showNeverActivated && (
                  <div className="mt-3 max-h-72 overflow-y-auto border border-card-border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-card-hover sticky top-0">
                        <tr className="text-left text-slate-400">
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Email</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Signed up</th>
                        </tr>
                      </thead>
                      <tbody>
                        {signups.neverActivated.map((u) => (
                          <tr key={u.profileId} className="border-t border-card-border">
                            <td className="px-3 py-2 text-white">{u.name}</td>
                            <td className="px-3 py-2 text-slate-400">{u.email ?? '—'}</td>
                            <td className="px-3 py-2 text-slate-400">
                              {KIND_LABELS[u.kind] ?? u.kind}
                            </td>
                            <td className="px-3 py-2 text-slate-400">{fmtDate(u.signedUpAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Coach funnel */}
      <Card
        title="Coach funnel"
        subtitle={`${coaches.totalCoaches} coach workspaces. Where each one is stuck.`}
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {coaches.funnel.map((step) => (
            <div
              key={step.stage}
              className="flex-1 min-w-[120px] bg-card-hover rounded-lg px-3 py-2"
            >
              <p className="text-2xl font-bold text-white">{step.count}</p>
              <p className="text-xs text-slate-400">{step.label}</p>
              {step.droppedHere > 0 && (
                <p className="text-xs text-amber-400 mt-1">−{step.droppedHere} dropped</p>
              )}
            </div>
          ))}
        </div>

        {coaches.coaches.length === 0 ? (
          <p className="text-slate-500 text-sm">No coach workspaces yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-card-border">
                  <th className="px-3 py-2 font-medium">Coach</th>
                  <th className="px-3 py-2 font-medium">Signed up</th>
                  <th className="px-3 py-2 font-medium">Clients</th>
                  <th className="px-3 py-2 font-medium">What&apos;s blocking them</th>
                </tr>
              </thead>
              <tbody>
                {coaches.coaches.map((c) => (
                  <tr key={c.workspaceId} className="border-b border-card-border/50">
                    <td className="px-3 py-2 text-white font-medium">{c.displayName}</td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                      {fmtDate(c.signedUpAt)}
                      {c.daysStalled !== null && c.daysStalled > 30 && (
                        <span className="block text-xs text-amber-400">
                          {c.daysStalled}d without progress
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {c.activeClientCount}
                      {c.clientCount !== c.activeClientCount && (
                        <span className="text-slate-500"> / {c.clientCount}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{c.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Who's actually using it */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Active users" subtitle={retention.interpretationNote}>
          {!retention.dataAvailable ? (
            <p className="text-amber-400 text-sm">Sign-in history unavailable.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <Metric label="Last 7d" value={retention.active7d} tone="good" />
                <Metric label="Last 30d" value={retention.active30d} />
                <Metric label="Last 90d" value={retention.active90d} />
              </div>
              {retention.slipping.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-2">
                    Slipping ({retention.slipping.length}) — active recently, quiet now
                  </p>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {retention.slipping.map((u, i) => (
                      <li key={i} className="text-sm text-slate-300 flex justify-between gap-2">
                        <span className="truncate">{u.name}</span>
                        <span className="text-slate-500 whitespace-nowrap">
                          {u.daysSinceLastSignIn}d ago
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Card>

        <Card title="Who they are" subtitle="Visible users by type, league excluded by default.">
          <div className="space-y-3">
            {Object.entries(totals.byKind)
              .filter(([, n]) => n > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([kind, n]) => (
                <div key={kind} className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm">{KIND_LABELS[kind] ?? kind}</span>
                  <span className="text-white font-semibold">{n}</span>
                </div>
              ))}
          </div>
          <p className="text-slate-500 text-xs mt-4">
            {totals.visibleUsers} shown of {totals.allUsers} total accounts.
          </p>
        </Card>
      </div>

      {/* Feature usage */}
      <Card title="What they're using" subtitle={features.coverageNote}>
        <div className="flex gap-4 mb-4 text-sm">
          <span className="text-slate-400">
            <strong className="text-white">{features.totalEvents.toLocaleString()}</strong> events
          </span>
          <span className="text-slate-400">
            <strong className={features.errorCount > 0 ? 'text-red-400' : 'text-white'}>
              {features.errorCount}
            </strong>{' '}
            errors
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-card-border">
                <th className="px-3 py-2 font-medium">Feature</th>
                <th className="px-3 py-2 font-medium">Events</th>
                <th className="px-3 py-2 font-medium">Users</th>
                <th className="px-3 py-2 font-medium">Last used</th>
              </tr>
            </thead>
            <tbody>
              {features.features.map((f) => (
                <tr key={f.key} className="border-b border-card-border/50">
                  <td className="px-3 py-2">
                    <span className="text-white">{f.label}</span>
                    {f.status === 'not_instrumented' && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                        not measured
                      </span>
                    )}
                    {f.status === 'retired' && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-400">
                        retired
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {f.status === 'not_instrumented' ? '—' : f.eventCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {f.status === 'not_instrumented' ? '—' : f.uniqueUsers}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {f.status === 'not_instrumented' ? '—' : daysAgo(f.lastUsedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
