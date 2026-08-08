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

export default function AttributionWebsitePage() {
  const { analytics: a, error, eventCount, migrationRequired, lastFetchedAt, refresh } =
    useAttributionSummary()
  const timeline = a.timeline.map((t) => ({ ...t, unite: 0, total: t.website }))
  const websiteSources = a.sources
    .map((s) => ({ ...s, unite: 0, total: s.website }))
    .filter((s) => s.website > 0)
  const siteEvents = a.recent.filter((e) => e.property !== 'unite')

  return (
    <AttributionShell activeNav="website">
      <h1 className="text-2xl font-semibold text-white mb-1">Website · modern-day-coach.com</h1>
      <p className="text-sm text-slate-400 mb-4">
        Pages, sources, visit day, time, and location for marketing traffic.
      </p>
      <StatusBanner
        eventCount={eventCount}
        lastFetchedAt={lastFetchedAt}
        error={error}
        migrationRequired={migrationRequired}
        onRefresh={() => void refresh()}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <KpiCard label="Page views" value={formatNumber(a.websiteViews)} tone="teal" />
        <KpiCard label="Sessions" value={formatNumber(a.websiteSessions)} />
        <KpiCard label="CTA → Unite" value={formatNumber(a.ctaClicks)} tone="amber" />
        <KpiCard label="From X" value={formatNumber(a.fromX)} tone="amber" />
      </div>
      <div className="rounded-2xl border border-amber-500/20 bg-card p-5 mb-4">
        <h3 className="font-semibold text-white mb-1">Visits by day</h3>
        <p className="text-sm text-slate-400 mb-3">{a.viewerTimezone ? `Calendar days in ${a.viewerTimezone.replace(/_/g, " ")}` : "Calendar days on the marketing site"}</p>
        <VisitsByDayChart
          data={a.byDay.map((d) => ({ ...d, unite: 0, total: d.website }))}
          mode="website"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-5 mb-4">
        <div className="xl:col-span-3 rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold text-white mb-1">Hourly traffic</h3>
          <p className="text-xs text-slate-500 mb-3">{a.viewerTimezone ? `Buckets use your timezone (${a.viewerTimezone.replace(/_/g, " ")})` : "Your local timezone"}</p>
          <TrafficAreaChart data={timeline} />
        </div>
        <div className="xl:col-span-2 rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold text-white mb-3">Sources</h3>
          <SourceBarsChart data={websiteSources.length ? websiteSources : a.sources} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold text-white mb-3">Locations</h3>
          <LocationBarsChart data={a.locations} />
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold text-white mb-3">Top pages</h3>
          <table className="w-full text-sm">
            <tbody>
              {a.topPagesWebsite.map((r) => (
                <tr key={r.path} className="border-b border-card-border/50">
                  <td className="py-2 font-mono text-xs text-teal-300">{r.path}</td>
                  <td className="py-2 text-right tabular-nums text-white">{r.views}</td>
                </tr>
              ))}
              {a.topPagesWebsite.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-500 text-sm">No pages yet</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-2xl border border-teal-500/25 bg-card p-5">
        <h3 className="font-semibold text-white mb-1">Recent website hits</h3>
        <p className="text-sm text-slate-400 mb-3">Time · location · source · page</p>
        <ul className="space-y-2">
          {siteEvents.slice(0, 25).map((ev) => (
            <EventRow key={ev.id} event={ev} />
          ))}
          {siteEvents.length === 0 ? (
            <li className="text-sm text-slate-500">Waiting for website traffic…</li>
          ) : null}
        </ul>
      </div>
    </AttributionShell>
  )
}
