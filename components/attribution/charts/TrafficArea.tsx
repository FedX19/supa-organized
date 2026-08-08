'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TimelinePoint } from '@/lib/attribution/analytics'
import { ChartTooltip } from './ChartTooltip'

export function TrafficAreaChart({ data }: { data: TimelinePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-64 place-items-center text-sm text-slate-500">Waiting for traffic…</div>
    )
  }
  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fillWebsiteAttr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fillUniteAttr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis allowDecimals={false} width={32} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="website" name="MDC" stroke="#2dd4bf" fill="url(#fillWebsiteAttr)" strokeWidth={2} />
          <Area type="monotone" dataKey="unite" name="UniteHQ" stroke="#818cf8" fill="url(#fillUniteAttr)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
