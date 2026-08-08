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
import type { LocationRow } from '@/lib/attribution/analytics'
import { ChartTooltip } from './ChartTooltip'

const COLORS = ['#2dd4bf', '#818cf8', '#fbbf24', '#fb7185', '#34d399', '#fb923c']

export function LocationBarsChart({ data }: { data: LocationRow[] }) {
  const rows = data.slice(0, 8).map((l) => ({
    name: l.label.length > 22 ? `${l.label.slice(0, 20)}…` : l.label,
    count: l.count,
  }))
  if (rows.length === 0) {
    return (
      <div className="grid h-56 place-items-center text-sm text-slate-500">
        Location appears after live visits (city + timezone)
      </div>
    )
  }
  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 6" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Visits" radius={[0, 6, 6, 0]}>
            {rows.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
