'use client'

import { AttributionShell } from '@/components/attribution/AttributionShell'
import { KpiCard } from '@/components/attribution/KpiCard'
import { StatusBanner } from '@/components/attribution/StatusBanner'
import { FunnelChart } from '@/components/attribution/charts/Funnel'
import { SourceBarsChart } from '@/components/attribution/charts/SourceBars'
import { ClientWhen } from '@/components/attribution/ClientWhen'
import { useAttributionSummary } from '@/lib/attribution/use-attribution'
import { formatShare } from '@/lib/attribution/analytics'
import { formatNumber } from '@/lib/attribution/format'

export default function AttributionFunnelPage() {
  const { analytics: a, error, eventCount, migrationRequired, lastFetchedAt, refresh } =
    useAttributionSummary()
  const purchaseStep = a.funnel.find((s) => s.id === 'purchase')
  const topToPurchase = purchaseStep?.rateFromTop ?? 0
  const xShare = a.sources.find((s) => s.isX)?.share ?? 0

  return (
    <AttributionShell activeNav="funnel">
      <h1 className="text-2xl font-semibold text-white mb-1">Cross-property funnel</h1>
      <p className="text-sm text-slate-400 mb-4">
        MDC → CTA → UniteHQ → activate / membership → purchase. Sessions stitch by first-touch
        source (including free X traffic).
      </p>
      <StatusBanner
        eventCount={eventCount}
        lastFetchedAt={lastFetchedAt}
        error={error}
        migrationRequired={migrationRequired}
        onRefresh={() => void refresh()}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <KpiCard label="Top of funnel" value={formatNumber(a.websiteViews)} hint="MDC views" tone="teal" />
        <KpiCard label="CTA → UniteHQ" value={formatNumber(a.ctaClicks)} tone="amber" />
        <KpiCard label="Purchases" value={formatNumber(a.purchases)} tone="emerald" />
        <KpiCard
          label="Site → buy rate"
          value={formatShare(topToPurchase)}
          hint="Of website page views"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold text-white mb-1">Full funnel</h3>
          <p className="text-sm text-slate-400 mb-4">Step conversion vs previous · share of top</p>
          <FunnelChart steps={a.funnel} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-card-border">
                  <th className="pb-2 text-left font-medium">Step</th>
                  <th className="pb-2 text-right font-medium">Count</th>
                  <th className="pb-2 text-right font-medium">Of prior</th>
                  <th className="pb-2 text-right font-medium">Of top</th>
                </tr>
              </thead>
              <tbody>
                {a.funnel.map((s) => (
                  <tr key={s.id} className="border-b border-card-border/50">
                    <td className="py-2 text-white">
                      <span
                        className={`mr-2 inline-block h-2 w-2 rounded-full ${
                          s.property === 'website' ? 'bg-teal-400' : 'bg-indigo-400'
                        }`}
                      />
                      {s.label}
                    </td>
                    <td className="py-2 text-right tabular-nums text-white">{s.count}</td>
                    <td className="py-2 text-right tabular-nums text-slate-400">
                      {s.rateFromPrev == null ? '—' : formatShare(s.rateFromPrev)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-400">
                      {formatShare(s.rateFromTop)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold text-white mb-1">Sources feeding the funnel</h3>
          <p className="text-sm text-slate-400 mb-3">
            X share: <span className="text-amber-300 font-medium">{formatShare(xShare)}</span>
          </p>
          <SourceBarsChart data={a.sources} />
          <ul className="mt-4 space-y-2 text-sm">
            {a.sources.slice(0, 6).map((s) => (
              <li
                key={s.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-card-border px-3 py-2"
              >
                <span className={s.isX ? 'text-amber-300 font-medium' : 'text-slate-300'}>
                  {s.label}
                </span>
                <span className="tabular-nums text-slate-400">
                  {s.total} hits · {s.purchases} buys · {formatShare(s.share)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-card-border bg-card p-5">
        <h3 className="font-semibold text-white mb-1">Stitched journeys</h3>
        <p className="text-sm text-slate-400 mb-4">
          Same browser session across MDC site → UniteHQ (UTM first-touch preserved)
        </p>
        <div className="space-y-3">
          {a.stitched.length === 0 ? (
            <p className="text-sm text-slate-500">
              Journeys appear once visitors hop from modern-day-coach.com into UniteHQ with the same
              session / UTM payload.
            </p>
          ) : (
            a.stitched.map((j) => (
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
                  <ClientWhen iso={j.firstAt} mode="when" className="text-xs text-slate-500" />
                  <span className="text-xs text-slate-600">→</span>
                  <ClientWhen iso={j.lastAt} mode="clock-relative" className="text-xs text-slate-500" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {j.websitePaths.map((p) => (
                    <span
                      key={`w-${j.sessionId}-${p}`}
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
                      key={`u-${j.sessionId}-${p}`}
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
      </div>
    </AttributionShell>
  )
}
