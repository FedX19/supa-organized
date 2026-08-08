'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SourceRow } from '@/lib/attribution/analytics'
import { ChartTooltip } from './ChartTooltip'

export function SourceBarsChart({ data }: { data: SourceRow[] }) {
  const rows = data.slice(0, 8).map((s) => ({
    name: s.label.length > 18 ? `${s.label.slice(0, 16)}…` : s.label,
    website: s.website,
    unite: s.unite,
    isX: s.isX,
  }))
  if (rows.length === 0) {
    return <div className="grid h-64 place-items-center text-sm text-slate-500">No sources yet</div>
  }
  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 6" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="website" name="MDC" stackId="a" fill="#2dd4bf" />
          <Bar dataKey="unite" name="UniteHQ" stackId="a" radius={[0, 4, 4, 0]}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.isX ? '#fbbf24' : '#818cf8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
