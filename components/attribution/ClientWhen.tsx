'use client'

import { useEffect, useState } from 'react'
import { formatClock, formatRelative, formatWhen } from '@/lib/attribution/format'

export function ClientWhen({
  iso,
  mode = 'when',
  className,
}: {
  iso: string
  mode?: 'when' | 'clock' | 'relative' | 'clock-relative'
  className?: string
}) {
  const [label, setLabel] = useState(() => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  })

  useEffect(() => {
    const tick = () => {
      if (mode === 'when') setLabel(formatWhen(iso))
      else if (mode === 'clock') setLabel(formatClock(iso))
      else if (mode === 'relative') setLabel(formatRelative(iso))
      else setLabel(`${formatClock(iso)} · ${formatRelative(iso)}`)
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [iso, mode])

  return (
    <span className={className} title={formatWhen(iso)} suppressHydrationWarning>
      {label}
    </span>
  )
}
