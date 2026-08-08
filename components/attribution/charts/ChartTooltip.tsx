export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      {label ? <p className="mb-1.5 font-medium text-slate-400">{label}</p> : null}
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.name)} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-400">{p.name}</span>
            <span className="ml-auto font-semibold text-white tabular-nums">{p.value ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
