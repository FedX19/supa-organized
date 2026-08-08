export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'teal' | 'indigo' | 'amber' | 'emerald'
}) {
  const bar = {
    default: 'from-slate-500 to-transparent',
    teal: 'from-teal-400 to-teal-400/10',
    indigo: 'from-indigo-400 to-indigo-400/10',
    amber: 'from-amber-400 to-amber-400/10',
    emerald: 'from-emerald-400 to-emerald-400/10',
  }[tone]
  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-lg">
      <div className={`h-1 w-full bg-gradient-to-r ${bar}`} />
      <div className="p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-white tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      </div>
    </div>
  )
}
