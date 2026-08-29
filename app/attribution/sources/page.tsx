'use client'

import { AttributionShell } from '@/components/attribution/AttributionShell'
import { KpiCard } from '@/components/attribution/KpiCard'
import { StatusBanner } from '@/components/attribution/StatusBanner'
import { SourceBarsChart } from '@/components/attribution/charts/SourceBars'
import { SourcesTable } from '@/components/attribution/SourcesTable'
import { useAttributionSummary } from '@/lib/attribution/use-attribution'
import { formatNumber } from '@/lib/attribution/format'

export default function AttributionSourcesPage() {
  const { analytics: a, error, eventCount, migrationRequired, lastFetchedAt, refresh } =
    useAttributionSummary()

  return (
    <AttributionShell activeNav="sources">
      <h1 className="text-2xl font-semibold text-white mb-1">Where visits come from</h1>
      <p className="text-sm text-slate-400 mb-4 max-w-2xl">
        First-touch channel + campaign. Cold email shows as Email · your campaign slug. Untagged
        links land in Direct.
      </p>
      <StatusBanner
        eventCount={eventCount}
        lastFetchedAt={lastFetchedAt}
        error={error}
        migrationRequired={migrationRequired}
        onRefresh={() => void refresh()}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <KpiCard label="Email" value={formatNumber(a.fromEmail)} hint="utm_source=email or medium=cold" tone="teal" />
        <KpiCard label="X" value={formatNumber(a.fromX)} hint="Zero-spend social" tone="amber" />
        <KpiCard label="Google" value={formatNumber(a.fromGoogle)} />
        <KpiCard label="Direct / unknown" value={formatNumber(a.fromDirect)} hint="No UTM on the landing URL" />
      </div>
      <div className="rounded-2xl border border-card-border bg-card p-5 mb-4">
        <h3 className="font-semibold text-white mb-1">Mix</h3>
        <p className="text-sm text-slate-400 mb-3">Channel · campaign when a campaign slug is present</p>
        <SourceBarsChart data={a.sources} />
      </div>
      <div className="rounded-2xl border border-sky-500/25 bg-card p-5">
        <h3 className="font-semibold text-white mb-1">Every source</h3>
        <p className="text-sm text-slate-400 mb-3">
          Paste UTM links from Setup → Cold email so new sequences get their own row.
        </p>
        <SourcesTable rows={a.sources} />
      </div>
    </AttributionShell>
  )
}
