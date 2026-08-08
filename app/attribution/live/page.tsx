'use client'

import { useMemo, useState } from 'react'
import { AttributionShell } from '@/components/attribution/AttributionShell'
import { StatusBanner } from '@/components/attribution/StatusBanner'
import { EventRow } from '@/components/attribution/EventRow'
import { useAttributionSummary } from '@/lib/attribution/use-attribution'
import { formatNumber } from '@/lib/attribution/format'

type Filter = 'all' | 'website' | 'unite' | 'x' | 'purchase'

export default function AttributionLivePage() {
  const { analytics: a, error, eventCount, migrationRequired, lastFetchedAt, refresh } =
    useAttributionSummary(3000)
  const [filter, setFilter] = useState<Filter>('all')

  const events = useMemo(() => {
    return a.recent.filter((ev) => {
      if (filter === 'website') return ev.property !== 'unite'
      if (filter === 'unite') return ev.property === 'unite'
      if (filter === 'purchase') return (ev.event_type || '').toLowerCase() === 'purchase'
      if (filter === 'x') {
        const s = `${ev.source || ''} ${ev.source_label || ''} ${ev.referrer || ''}`.toLowerCase()
        return s.includes('x') || s.includes('twitter') || s.includes('t.co')
      }
      return true
    })
  }, [a.recent, filter])

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'website', label: 'Website' },
    { id: 'unite', label: 'Unite' },
    { id: 'x', label: 'From X' },
    { id: 'purchase', label: 'Purchases' },
  ]

  return (
    <AttributionShell activeNav="live">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Live feed</h1>
          <p className="text-sm text-slate-400">
            Real-time non-PII hits from both properties · auto-refresh every 3s
          </p>
        </div>
        <p className="text-sm text-slate-500 tabular-nums">
          Showing {formatNumber(events.length)} of {formatNumber(a.recent.length)} loaded
        </p>
      </div>
      <StatusBanner
        eventCount={eventCount}
        lastFetchedAt={lastFetchedAt}
        error={error}
        migrationRequired={migrationRequired}
        onRefresh={() => void refresh()}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
              filter === c.id
                ? 'border-teal-400/50 bg-teal-400/15 text-teal-200'
                : 'border-card-border bg-card text-slate-400 hover:text-white'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-card-border bg-card p-4 sm:p-5">
        <ul className="space-y-2">
          {events.map((ev) => (
            <EventRow key={ev.id} event={ev} />
          ))}
          {events.length === 0 ? (
            <li className="py-8 text-center text-sm text-slate-500">
              No events match this filter yet. Open Setup to wire beacons, or visit the site with UTMs.
            </li>
          ) : null}
        </ul>
      </div>
    </AttributionShell>
  )
}
