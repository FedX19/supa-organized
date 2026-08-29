'use client'

import type { SourceRow } from '@/lib/attribution/analytics'
import { formatNumber } from '@/lib/attribution/format'
import { formatShare } from '@/lib/attribution/analytics'

function toneFor(row: SourceRow): string {
  if (row.isEmail) return 'border-sky-500/30 bg-sky-500/10 text-sky-200'
  if (row.isX) return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  if (row.channel === 'google') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (row.channel === 'direct') return 'border-slate-600 bg-slate-800/60 text-slate-300'
  return 'border-card-border bg-card text-slate-300'
}

export function SourcesTable({
  rows,
  compact,
}: {
  rows: SourceRow[]
  compact?: boolean
}) {
  const list = compact ? rows.slice(0, 8) : rows
  if (list.length === 0) {
    return <p className="text-sm text-slate-500">No attributed visits yet.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr className="border-b border-card-border">
            <th className="pb-2 pr-3 font-medium">Channel</th>
            <th className="pb-2 pr-3 font-medium">Campaign</th>
            <th className="pb-2 pr-3 text-right font-medium">MDC</th>
            <th className="pb-2 pr-3 text-right font-medium">UniteHQ</th>
            <th className="pb-2 pr-3 text-right font-medium">Sessions</th>
            <th className="pb-2 pr-3 text-right font-medium">CTAs</th>
            <th className="pb-2 pr-3 text-right font-medium">Purchases</th>
            <th className="pb-2 text-right font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row) => (
            <tr key={row.key} className="border-b border-card-border/50">
              <td className="py-2 pr-3">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneFor(row)}`}>
                  {row.channel === 'x' ? 'X' : row.channel === 'email' ? 'Email' : row.channel}
                </span>
              </td>
              <td className="py-2 pr-3 text-slate-200">
                {row.campaign || <span className="text-slate-500">—</span>}
                {row.medium ? (
                  <span className="ml-2 text-[11px] text-slate-500">{row.medium}</span>
                ) : null}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-teal-300">{formatNumber(row.website)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-indigo-300">{formatNumber(row.unite)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-300">{formatNumber(row.sessions)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-300">{formatNumber(row.cta)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-emerald-300">{formatNumber(row.purchases)}</td>
              <td className="py-2 text-right tabular-nums text-white">{formatShare(row.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
