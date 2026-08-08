'use client'

import { AttributionShell } from '@/components/attribution/AttributionShell'
import { KpiCard } from '@/components/attribution/KpiCard'
import { StatusBanner } from '@/components/attribution/StatusBanner'
import { EventRow } from '@/components/attribution/EventRow'
import { TrafficAreaChart } from '@/components/attribution/charts/TrafficArea'
import { VisitsByDayChart } from '@/components/attribution/charts/VisitsByDay'
import { SourceBarsChart } from '@/components/attribution/charts/SourceBars'
import { LocationBarsChart } from '@/components/attribution/charts/LocationBars'
import { useAttributionSummary } from '@/lib/attribution/use-attribution'
import { formatNumber } from '@/lib/attribution/format'

export default function AttributionUnitePage() {
  const { analytics: a, error, eventCount, migrationRequired, lastFetchedAt, refresh } =
    useAttributionSummary()
  const timeline = a.timeline.map((t) => ({ ...t, website: 0, total: t.unite }))
  const uniteSources = a.sources
    .map((s) => ({ ...s, website: 0, total: s.unite }))
    .filter((s) => s.unite > 0)
  const uniteEvents = a.recent.filter((e) => e.property === 'unite')
  const activateHits = a.funnel.find((s) => s.id === 'activate')?.count ?? 0

  return (
    <AttributionShell activeNav="unite">
      <h1 className="text-2xl font-semibold text-white mb-1">Unite HQ · app.unite-hq.com</h1>
      <p className="text-sm text-slate-400 mb-4">
        Product views, activation paths, purchases, visit day, and source of app traffic.
      </p>
      <StatusBanner
        eventCount={eventCount}
        lastFetchedAt={lastFetchedAt}
        error={error}
        migrationRequired={migrationRequired}
        onRefresh={() => void refresh()}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <KpiCard label="App page views" value={formatNumber(a.uniteViews)} tone="indigo" />
        <KpiCard label="App sessions" value={formatNumber(a.uniteSessions)} />
        <KpiCard label="Activate / membership" value={formatNumber(activateHits)} tone="amber" />
        <KpiCard label="Purchases" value={formatNumber(a.purchases)} tone="emerald" />
      </div>
      <div className="rounded-2xl border border-indigo-500/25 bg-card p-5 mb-4">
        <h3 className="font-semibold text-white mb-1">Visits by day</h3>
        <p className="text-sm text-slate-400 mb-3">Calendar days inside Unite HQ</p>
        <VisitsByDayChart
          data={a.byDay.map((d) => ({ ...d, website: 0, total: d.unite }))}
          mode="unite"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-5 mb-4">
        <div className="xl:col-span-3 rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold text-white mb-1">Hourly app traffic</h3>
          <p className="text-xs text-slate-500 mb-3">{a.viewerTimezone ? `Buckets use your timezone (${a.viewerTimezone.replace(/_/g, " ")})` : "Your local timezone"}</p>
          <TrafficAreaChart data={timeline} />
        </div>
        <div className="xl:col-span-2 rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold text-white mb-3">Sources into Unite</h3>
          <SourceBarsChart data={uniteSources.length ? uniteSources : a.sources} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold text-white mb-3">Locations</h3>
          <LocationBarsChart data={a.locations} />
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold text-white mb-3">Top app paths</h3>
          <table className="w-full text-sm">
            <tbody>
              {a.topPagesUnite.map((r) => (
                <tr key={r.path} className="border-b border-card-border/50">
                  <td className="py-2 font-mono text-xs text-indigo-300">{r.path}</td>
                  <td className="py-2 text-right tabular-nums text-white">{r.views}</td>
                </tr>
              ))}
              {a.topPagesUnite.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-500 text-sm">No Unite paths yet</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-2xl border border-indigo-500/25 bg-card p-5">
        <h3 className="font-semibold text-white mb-1">Recent Unite hits</h3>
        <p className="text-sm text-slate-400 mb-3">Time · location · source · path</p>
        <ul className="space-y-2">
          {uniteEvents.slice(0, 25).map((ev) => (
            <EventRow key={ev.id} event={ev} />
          ))}
          {uniteEvents.length === 0 ? (
            <li className="text-sm text-slate-500">Waiting for Unite app traffic…</li>
          ) : null}
        </ul>
      </div>
    </AttributionShell>
  )
}
