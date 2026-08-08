'use client'

import { formatRelative } from '@/lib/attribution/format'

export function StatusBanner({
  eventCount,
  lastFetchedAt,
  error,
  migrationRequired,
  onRefresh,
}: {
  eventCount: number
  lastFetchedAt: string | null
  error: string | null
  migrationRequired?: boolean
  onRefresh: () => void
}) {
  const live = eventCount > 0 && !error
  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
        migrationRequired
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
          : error
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
            : live
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-teal-500/40 bg-teal-500/10 text-teal-200'
      }`}
    >
      <span className="font-semibold">
        {migrationRequired
          ? 'Run attribution SQL migrations in Supabase'
          : error
            ? `Error: ${error}`
            : live
              ? `Live · ${eventCount} event${eventCount === 1 ? '' : 's'} loaded`
              : 'Connected · waiting for traffic'}
      </span>
      {lastFetchedAt ? (
        <span className="text-xs opacity-80">Updated {formatRelative(lastFetchedAt)}</span>
      ) : null}
      <button
        type="button"
        onClick={onRefresh}
        className="ml-auto text-xs font-medium underline-offset-2 hover:underline"
      >
        Refresh
      </button>
    </div>
  )
}
