'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DayPoint } from '@/lib/attribution/analytics'
import { ChartTooltip } from './ChartTooltip'

export function VisitsByDayChart({
  data,
  mode = 'both',
}: {
  data: DayPoint[]
  mode?: 'both' | 'website' | 'unite'
}) {
  if (data.length === 0) {
    return (
      <div className="grid h-64 place-items-center text-sm text-slate-500">
        Visits will group here by calendar day
      </div>
    )
  }
  const rows = data.map((d) => ({ ...d, name: d.label }))
  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={rows.length > 7 ? -28 : 0}
            textAnchor={rows.length > 7 ? 'end' : 'middle'}
            height={rows.length > 7 ? 52 : 28}
          />
          <YAxis allowDecimals={false} width={32} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(245,158,11,0.08)' }} />
          {mode === 'both' ? (
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} iconType="circle" />
          ) : null}
          {(mode === 'both' || mode === 'website') && (
            <Bar
              dataKey="website"
              name="MDC"
              stackId={mode === 'both' ? 'day' : undefined}
              fill="#2dd4bf"
              radius={mode === 'both' ? [0, 0, 0, 0] : [6, 6, 0, 0]}
              maxBarSize={48}
            />
          )}
          {(mode === 'both' || mode === 'unite') && (
            <Bar
              dataKey="unite"
              name="UniteHQ"
              stackId={mode === 'both' ? 'day' : undefined}
              fill="#818cf8"
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
