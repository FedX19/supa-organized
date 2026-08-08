'use client'

import type { AttributionEvent } from '@/lib/attribution/types'
import { formatLocation, formatTimezone } from '@/lib/attribution/format'
import { ClientWhen } from './ClientWhen'

export function EventRow({ event, dense }: { event: AttributionEvent; dense?: boolean }) {
  const isUnite = event.property === 'unite'
  const location = formatLocation(event)

  return (
    <li
      className={`flex gap-3 rounded-xl border border-card-border bg-card/60 ${
        dense ? 'px-2.5 py-2' : 'px-3 py-3'
      }`}
    >
      <span
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
          isUnite ? 'bg-indigo-400' : 'bg-teal-400'
        }`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-medium text-white">
            {event.event_type}
            <span className="text-slate-500"> · </span>
            <span className={`font-mono text-xs ${isUnite ? 'text-indigo-300' : 'text-teal-300'}`}>
              {event.path || '/'}
            </span>
          </span>
          <span className="text-xs text-slate-500">
            {event.source_label || event.source || 'direct'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <ClientWhen
            iso={event.created_at}
            mode="clock-relative"
            className="tabular-nums font-medium text-sky-300"
          />
          <span title={formatTimezone(event.timezone)} className="text-amber-300/90">
            📍 {location}
          </span>
          <span className="text-slate-500">{event.device || 'desktop'}</span>
        </div>
        {!dense ? (
          <p className="text-[11px] text-slate-500">
            <ClientWhen iso={event.created_at} mode="when" />
          </p>
        ) : null}
      </div>
    </li>
  )
}
