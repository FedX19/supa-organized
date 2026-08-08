'use client'

import type { FunnelStep } from '@/lib/attribution/analytics'
import { formatShare } from '@/lib/attribution/analytics'

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((s) => s.count), 1)
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const width = Math.max(12, Math.round((step.count / max) * 100))
        return (
          <div key={step.id} className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    step.property === 'website' ? 'bg-teal-400' : 'bg-indigo-400'
                  }`}
                />
                <span className="font-medium text-white">{step.label}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                {step.rateFromPrev != null ? <span>{formatShare(step.rateFromPrev)} of prior</span> : null}
                <span className="font-semibold text-white tabular-nums">
                  {step.count.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  i === steps.length - 1
                    ? 'bg-emerald-400'
                    : step.property === 'website'
                      ? 'bg-teal-400'
                      : 'bg-indigo-400'
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
