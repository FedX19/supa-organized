'use client'

import Link from 'next/link'
import { AttributionShell } from '@/components/attribution/AttributionShell'
import { KpiCard } from '@/components/attribution/KpiCard'
import { StatusBanner } from '@/components/attribution/StatusBanner'
import { EventRow } from '@/components/attribution/EventRow'
import { TrafficAreaChart } from '@/components/attribution/charts/TrafficArea'
import { VisitsByDayChart } from '@/components/attribution/charts/VisitsByDay'
import { SourceBarsChart } from '@/components/attribution/charts/SourceBars'
import { FunnelChart } from '@/components/attribution/charts/Funnel'
import { LocationBarsChart } from '@/components/attribution/charts/LocationBars'
import { useAttributionSummary } from '@/lib/attribution/use-attribution'
import { formatShare } from '@/lib/attribution/analytics'
import { formatNumber } from '@/lib/attribution/format'
import { ClientWhen } from '@/components/attribution/ClientWhen'

function n(v: number) {
  return formatNumber(v)
}

export default function AttributionCommandCenter() {
  const { analytics: a, loading, error, eventCount, migrationRequired, lastFetchedAt, refresh } =
    useAttributionSummary()

  return (
    <AttributionShell activeNav="command">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-teal-300 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
              Command center
            </span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Hyros-style dual-property attribution for Modern Day Coach — MDC website + UniteHQ,
            stitched by first-touch source.
          </p>
        </div>
      </div>

      <StatusBanner
        eventCount={eventCount}
        lastFetchedAt={lastFetchedAt}
        error={error}
        migrationRequired={migrationRequired}
        onRefresh={() => void refresh()}
      />

      {loading && eventCount === 0 ? (
        <p className="text-slate-500 text-sm">Loading attribution…</p>
      ) : null}

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <PropertyHero
          title="modern-day-coach.com"
          subtitle="Marketing site"
          href="/attribution/website"
          accent="teal"
          stats={[
            { label: 'Page views', value: n(a.websiteViews) },
            { label: 'Sessions', value: n(a.websiteSessions) },
            { label: '→ UniteHQ clicks', value: n(a.ctaClicks) },
          ]}
        />
        <PropertyHero
          title="app.unite-hq.com"
          subtitle="Product · membership"
          href="/attribution/unite"
          accent="indigo"
          stats={[
            { label: 'App views', value: n(a.uniteViews) },
            { label: 'Sessions', value: n(a.uniteSessions) },
            { label: 'Purchases', value: n(a.purchases) },
          ]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total events" value={n(a.totalEvents)} hint="Both properties" tone="teal" />
        <KpiCard label="Unique sessions" value={n(a.uniqueSessions)} tone="indigo" />
        <KpiCard label="From X (Twitter)" value={n(a.fromX)} hint="Zero-spend channel" tone="amber" />
        <KpiCard label="Purchases" value={n(a.purchases)} tone="emerald" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Panel className="xl:col-span-3" title="Traffic over time" desc={a.viewerTimezone ? `MDC vs UniteHQ · times in ${a.viewerTimezone.replace(/_/g, " ")}` : "MDC vs UniteHQ"}>
          <TrafficAreaChart data={a.timeline} />
        </Panel>
        <Panel className="xl:col-span-2" title="Sources" desc="First-touch mix · X highlighted">
          <SourceBarsChart data={a.sources} />
        </Panel>
      </div>

      <Panel
        className="mt-4 border-amber-500/20"
        title="Visits by day"
        desc={a.viewerTimezone ? `Calendar day in ${a.viewerTimezone.replace(/_/g, " ")} — MDC + UniteHQ stacked` : "Which calendar day people visited — MDC + UniteHQ stacked"}
      >
        <VisitsByDayChart data={a.byDay} mode="both" />
        {a.byDay.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-card-border">
                  <th className="pb-2 font-medium">Day</th>
                  <th className="pb-2 text-right font-medium">MDC</th>
                  <th className="pb-2 text-right font-medium">UniteHQ</th>
                  <th className="pb-2 text-right font-medium">Sessions</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...a.byDay]
                  .reverse()
                  .slice(0, 14)
                  .map((d) => (
                    <tr key={d.day} className="border-b border-card-border/50">
                      <td className="py-2">
                        <span className="font-medium text-white">{d.label}</span>
                        <span className="ml-2 text-xs text-slate-500">{d.weekday}</span>
                      </td>
                      <td className="py-2 text-right tabular-nums text-teal-300">{d.website}</td>
                      <td className="py-2 text-right tabular-nums text-indigo-300">{d.unite}</td>
                      <td className="py-2 text-right tabular-nums text-slate-400">{d.sessions}</td>
                      <td className="py-2 text-right tabular-nums font-semibold text-white">
                        {d.total}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Cross-property funnel"
          desc="MDC → UniteHQ click → app → activate → buy"
          action={
            <Link href="/attribution/funnel" className="text-xs font-medium text-teal-300 hover:underline">
              Full funnel
            </Link>
          }
        >
          <FunnelChart steps={a.funnel} />
        </Panel>
        <Panel title="Where visitors are" desc="City / region from edge · timezone fallback">
          <LocationBarsChart data={a.locations} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Panel className="xl:col-span-3" title="Stitched journeys" desc="Same session across MDC → UniteHQ">
          <div className="space-y-3">
            {a.stitched.length === 0 ? (
              <p className="text-sm text-slate-500">
                Journeys appear as visitors hop from MDC into UniteHQ with UTMs.
              </p>
            ) : (
              a.stitched.slice(0, 8).map((j) => (
                <div
                  key={j.sessionId}
                  className="rounded-xl border border-card-border bg-background/40 px-3 py-3"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-card-border px-2 py-0.5 text-xs text-slate-300">
                      {j.source}
                    </span>
                    {j.purchased ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                        Purchase
                      </span>
                    ) : null}
                    {j.location ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                        {j.location}
                      </span>
                    ) : null}
                    <ClientWhen
                      iso={j.lastAt}
                      mode="clock-relative"
                      className="text-xs text-slate-500"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {j.websitePaths.map((p) => (
                      <span
                        key={`w-${p}`}
                        className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-teal-300"
                      >
                        {p}
                      </span>
                    ))}
                    {j.websitePaths.length && j.unitePaths.length ? (
                      <span className="text-slate-500">→</span>
                    ) : null}
                    {j.unitePaths.map((p) => (
                      <span
                        key={`u-${p}`}
                        className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-indigo-300"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
        <Panel
          className="xl:col-span-2"
          title="Live pulse"
          desc="Latest events both properties"
          action={
            <Link href="/attribution/live" className="text-xs text-slate-400 hover:text-white">
              Feed
            </Link>
          }
        >
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {a.recent.slice(0, 16).map((ev) => (
              <EventRow key={ev.id} event={ev} dense />
            ))}
            {a.recent.length === 0 ? (
              <li className="text-sm text-slate-500">No events yet — open Setup for beacon URL.</li>
            ) : null}
          </ul>
        </Panel>
      </div>

      {a.sources.some((s) => s.isX) ? (
        <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm">
          <p className="font-semibold text-white">
            X is carrying {formatShare(a.sources.find((s) => s.isX)!.share)} of tracked traffic
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Double down on threads with UTMs — free acquisition attributed end-to-end.
          </p>
        </div>
      ) : null}
    </AttributionShell>
  )
}

function PropertyHero({
  title,
  subtitle,
  href,
  stats,
  accent,
}: {
  title: string
  subtitle: string
  href: string
  stats: Array<{ label: string; value: string }>
  accent: 'teal' | 'indigo'
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        accent === 'teal' ? 'border-teal-500/25' : 'border-indigo-500/25'
      } bg-card`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b border-card-border px-4 py-3 ${
          accent === 'teal' ? 'bg-teal-500/10' : 'bg-indigo-500/10'
        }`}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{subtitle}</p>
          <p className="font-semibold text-white">{title}</p>
        </div>
        <Link
          href={href}
          className="rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-card-hover"
        >
          Explore →
        </Link>
      </div>
      <div className="grid grid-cols-3 divide-x divide-card-border">
        {stats.map((s) => (
          <div key={s.label} className="px-3 py-3 sm:px-4">
            <p className="text-[11px] text-slate-500">{s.label}</p>
            <p className="text-xl font-semibold text-white tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Panel({
  title,
  desc,
  children,
  className = '',
  action,
}: {
  title: string
  desc?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl border border-card-border bg-card shadow-lg ${className}`}>
      <div className="flex items-start justify-between gap-3 p-5 pb-0">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {desc ? <p className="text-sm text-slate-400">{desc}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
