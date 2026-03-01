'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Organization,
  UserConnection,
  AdoptionData,
  UsageData,
  ErrorsData,
} from '@/lib/supabase'

interface AnalyticsDashboardProps {
  connection: UserConnection
  organizations: { id: string; name: string }[]
  getValidAccessToken: () => Promise<string | null>
}

type TabType = 'adoption' | 'usage' | 'errors'
type RangeType = '7d' | '30d'

const ROLE_COLORS: Record<string, string> = {
  coach: '#22c55e',
  parent: '#3b82f6',
  admin: '#f59e0b',
  staff: '#8b5cf6',
  platform_admin: '#ef4444',
  unknown: '#6b7280',
}

const FEATURE_COLORS = [
  '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ef4444',
  '#14b8a6', '#f97316', '#06b6d4', '#ec4899', '#84cc16',
]

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function MetricCard({
  title,
  current,
  prior,
  delta,
  subtitle,
}: {
  title: string
  current: number | string | null
  prior?: number | null
  delta?: number | null
  subtitle?: string
}) {
  const displayValue = current === null ? '—' : current
  const showDelta = delta !== undefined && delta !== null

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-5">
      <h3 className="text-sm text-gray-400 mb-2">{title}</h3>
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-white">{displayValue}</span>
        {showDelta && (
          <span className={`text-sm font-medium ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      {prior !== undefined && prior !== null && (
        <p className="text-xs text-gray-500 mt-1">Prior period: {prior}</p>
      )}
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-gray-400">{message}</p>
    </div>
  )
}

// Adoption Tab Component
function AdoptionTab({
  data,
  isLoading,
}: {
  data: AdoptionData | null
  isLoading: boolean
}) {
  if (isLoading) return <LoadingSpinner />
  if (!data || !data.hasData) return <EmptyState message="No adoption data available for this organization" />

  const { metrics, sparkline, topCoaches, topParents } = data

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard
          title="Active Users"
          current={metrics.activeUsers.current}
          prior={metrics.activeUsers.prior}
          delta={metrics.activeUsers.delta}
        />
        <MetricCard
          title="Evaluations Submitted"
          current={metrics.evaluationsSubmitted.current}
          prior={metrics.evaluationsSubmitted.prior}
          delta={metrics.evaluationsSubmitted.delta}
          subtitle={`${metrics.evaluationsSubmitted.uniqueCoaches} coaches`}
        />
        <MetricCard
          title="Plans Generated"
          current={metrics.plansGenerated.current}
          prior={metrics.plansGenerated.prior}
          delta={metrics.plansGenerated.delta}
        />
        <MetricCard
          title="Plans Opened by Parents"
          current={metrics.plansOpenedByParents.current}
          prior={metrics.plansOpenedByParents.prior}
          delta={metrics.plansOpenedByParents.delta}
          subtitle={`${metrics.plansOpenedByParents.uniqueParents} parents`}
        />
        <MetricCard
          title="Open Rate"
          current={metrics.openRate.current !== null ? `${metrics.openRate.current}%` : null}
          delta={metrics.openRate.delta}
        />
      </div>

      {/* Sparkline Chart */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Daily Activity (14 days)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                stroke="#4b5563"
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="#4b5563" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="active_users" name="Active Users" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
              <Area type="monotone" dataKey="evaluations" name="Evaluations" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
              <Area type="monotone" dataKey="plans_generated" name="Plans Generated" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              <Area type="monotone" dataKey="plans_opened" name="Plans Opened" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Coaches and Parents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Coaches */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Top Coaches</h3>
          {topCoaches.length === 0 ? (
            <p className="text-gray-400 text-sm">No coach activity in this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="text-left text-xs text-gray-400 font-medium pb-2">Name</th>
                    <th className="text-right text-xs text-gray-400 font-medium pb-2">Evals</th>
                    <th className="text-right text-xs text-gray-400 font-medium pb-2">Plans</th>
                    <th className="text-right text-xs text-gray-400 font-medium pb-2">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {topCoaches.map((coach) => (
                    <tr key={coach.profile_id} className="border-b border-dark-border/50">
                      <td className="py-2">
                        <p className="text-white text-sm">{coach.full_name}</p>
                        <p className="text-gray-500 text-xs truncate max-w-[150px]">{coach.email}</p>
                      </td>
                      <td className="text-right text-white text-sm">{coach.evaluations_submitted}</td>
                      <td className="text-right text-white text-sm">{coach.plans_generated}</td>
                      <td className="text-right text-gray-400 text-xs">{formatDate(coach.last_active)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Parents */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Top Parents</h3>
          {topParents.length === 0 ? (
            <p className="text-gray-400 text-sm">No parent activity in this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="text-left text-xs text-gray-400 font-medium pb-2">Name</th>
                    <th className="text-right text-xs text-gray-400 font-medium pb-2">Plans Opened</th>
                    <th className="text-right text-xs text-gray-400 font-medium pb-2">First</th>
                    <th className="text-right text-xs text-gray-400 font-medium pb-2">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {topParents.map((parent) => (
                    <tr key={parent.profile_id} className="border-b border-dark-border/50">
                      <td className="py-2">
                        <p className="text-white text-sm">{parent.full_name}</p>
                        <p className="text-gray-500 text-xs truncate max-w-[150px]">{parent.email}</p>
                      </td>
                      <td className="text-right text-white text-sm">{parent.plans_opened}</td>
                      <td className="text-right text-gray-400 text-xs">{formatDate(parent.first_open)}</td>
                      <td className="text-right text-gray-400 text-xs">{formatDate(parent.last_open)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Usage Tab Component
function UsageTab({
  data,
  isLoading,
}: {
  data: UsageData | null
  isLoading: boolean
}) {
  if (isLoading) return <LoadingSpinner />
  if (!data || !data.hasData) return <EmptyState message="No usage data available for this organization" />

  const { metrics, featureBreakdown, actionBreakdown, roleBreakdown, dailyActivity, hourlyDistribution, topUsers } = data

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Events"
          current={metrics.totalEvents.current}
          prior={metrics.totalEvents.prior}
          delta={metrics.totalEvents.delta}
        />
        <MetricCard
          title="Avg Events/Day"
          current={metrics.avgEventsPerDay.current}
          prior={metrics.avgEventsPerDay.prior}
        />
        <MetricCard
          title="Unique Users"
          current={metrics.uniqueUsersInPeriod}
        />
      </div>

      {/* Daily Activity Chart */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Daily Activity (14 days)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                stroke="#4b5563"
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="#4b5563" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="events" name="Events" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
              <Area type="monotone" dataKey="uniqueUsers" name="Unique Users" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature and Role Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Breakdown */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Feature Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureBreakdown.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="#4b5563" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  stroke="#4b5563"
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Role Breakdown */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Role Breakdown</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <Pie
                  data={roleBreakdown}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                >
                  {roleBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={ROLE_COLORS[entry.name] || FEATURE_COLORS[index % FEATURE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {roleBreakdown.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: ROLE_COLORS[item.name] || '#6b7280' }}
                />
                <span className="text-sm text-gray-400">{item.name}: {item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Breakdown and Hourly Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action Breakdown */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Action Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actionBreakdown.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="#4b5563" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  stroke="#4b5563"
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Distribution */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Hourly Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h) => `${h}:00`}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  stroke="#4b5563"
                />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="#4b5563" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  labelFormatter={(h) => `${h}:00`}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Users */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Top Users by Activity</h3>
        {topUsers.length === 0 ? (
          <p className="text-gray-400 text-sm">No user activity in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Name</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Email</th>
                  <th className="text-right text-xs text-gray-400 font-medium pb-2">Events</th>
                  <th className="text-right text-xs text-gray-400 font-medium pb-2">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((user) => (
                  <tr key={user.profile_id} className="border-b border-dark-border/50">
                    <td className="py-2 text-white text-sm">{user.full_name}</td>
                    <td className="py-2 text-gray-400 text-sm truncate max-w-[200px]">{user.email}</td>
                    <td className="text-right text-white text-sm">{user.event_count}</td>
                    <td className="text-right text-gray-400 text-xs">{formatDateTime(user.last_active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Errors Tab Component
function ErrorsTab({
  data,
  isLoading,
}: {
  data: ErrorsData | null
  isLoading: boolean
}) {
  if (isLoading) return <LoadingSpinner />
  if (!data) return <EmptyState message="No error data available for this organization" />

  const { metrics, dailyErrorCounts, errorCodeBreakdown, errorRouteBreakdown, topErrorUsers, recentErrors } = data

  // Show empty state if there are no errors
  if (metrics.totalErrors.current === 0 && metrics.totalErrors.prior === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg className="w-16 h-16 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-green-400 text-lg font-medium">No errors in this period</p>
        <p className="text-gray-400 text-sm mt-1">Everything is running smoothly</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Errors"
          current={metrics.totalErrors.current}
          prior={metrics.totalErrors.prior}
          delta={metrics.totalErrors.delta}
        />
        <MetricCard
          title="Error Rate"
          current={`${metrics.errorRate.current}%`}
        />
        <MetricCard
          title="Users Affected"
          current={metrics.uniqueUsersAffected}
        />
      </div>

      {/* Daily Error Chart */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Daily Errors (14 days)</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyErrorCounts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                stroke="#4b5563"
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="#4b5563" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="count" name="Errors" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Error Code and Route Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error Code Breakdown */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Error Codes</h3>
          {errorCodeBreakdown.length === 0 ? (
            <p className="text-gray-400 text-sm">No error codes recorded</p>
          ) : (
            <div className="space-y-2">
              {errorCodeBreakdown.slice(0, 8).map((item) => (
                <div key={item.code} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300 font-mono">{item.code}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 bg-red-500/30 rounded-full w-24">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{
                          width: `${Math.min(100, (item.count / Math.max(...errorCodeBreakdown.map(e => e.count))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-white w-12 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Route Breakdown */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Top Error Routes</h3>
          {errorRouteBreakdown.length === 0 ? (
            <p className="text-gray-400 text-sm">No route errors recorded</p>
          ) : (
            <div className="space-y-2">
              {errorRouteBreakdown.slice(0, 8).map((item) => (
                <div key={item.route} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300 truncate max-w-[200px]">{item.route}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 bg-orange-500/30 rounded-full w-24">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{
                          width: `${Math.min(100, (item.count / Math.max(...errorRouteBreakdown.map(e => e.count))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-white w-12 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Users with Errors */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Users Most Affected</h3>
        {topErrorUsers.length === 0 ? (
          <p className="text-gray-400 text-sm">No user errors in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Name</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Email</th>
                  <th className="text-right text-xs text-gray-400 font-medium pb-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {topErrorUsers.map((user) => (
                  <tr key={user.profile_id} className="border-b border-dark-border/50">
                    <td className="py-2 text-white text-sm">{user.full_name}</td>
                    <td className="py-2 text-gray-400 text-sm truncate max-w-[200px]">{user.email}</td>
                    <td className="text-right text-red-400 text-sm font-medium">{user.error_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Errors */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Errors</h3>
        {recentErrors.length === 0 ? (
          <p className="text-gray-400 text-sm">No recent errors</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Time</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">User</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Error</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Route</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentErrors.slice(0, 10).map((error) => (
                  <tr key={error.id} className="border-b border-dark-border/50">
                    <td className="py-2 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(error.timestamp)}</td>
                    <td className="py-2 text-white text-sm">{error.full_name}</td>
                    <td className="py-2 text-red-400 text-sm font-mono">{error.error_code}</td>
                    <td className="py-2 text-gray-400 text-sm truncate max-w-[150px]">{error.route}</td>
                    <td className="py-2 text-gray-400 text-sm">{error.http_status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Main Component
export default function AnalyticsDashboard({
  connection,
  organizations,
  getValidAccessToken,
}: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('adoption')
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [range, setRange] = useState<RangeType>('7d')
  const [isLoading, setIsLoading] = useState(false)
  const [adoptionData, setAdoptionData] = useState<AdoptionData | null>(null)
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [errorsData, setErrorsData] = useState<ErrorsData | null>(null)

  // Auto-select first org
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id)
    }
  }, [organizations, selectedOrgId])

  // Fetch data for the active tab
  const fetchData = useCallback(async () => {
    if (!selectedOrgId) return

    setIsLoading(true)
    try {
      const token = await getValidAccessToken()
      if (!token) {
        console.error('No valid access token')
        return
      }
      const headers = { Authorization: `Bearer ${token}` }

      if (activeTab === 'adoption') {
        const res = await fetch(`/api/analytics/adoption?org_id=${selectedOrgId}&range=${range}`, { headers })
        if (res.ok) {
          const data = await res.json()
          setAdoptionData(data)
        }
      } else if (activeTab === 'usage') {
        const res = await fetch(`/api/analytics/usage?org_id=${selectedOrgId}&range=${range}`, { headers })
        if (res.ok) {
          const data = await res.json()
          setUsageData(data)
        }
      } else if (activeTab === 'errors') {
        const res = await fetch(`/api/analytics/errors?org_id=${selectedOrgId}&range=${range}`, { headers })
        if (res.ok) {
          const data = await res.json()
          setErrorsData(data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedOrgId, range, activeTab, getValidAccessToken])

  // Fetch data when tab, org, or range changes
  useEffect(() => {
    fetchData()
  }, [fetchData])

  const tabs: { id: TabType; label: string }[] = [
    { id: 'adoption', label: 'Adoption' },
    { id: 'usage', label: 'Usage' },
    { id: 'errors', label: 'Errors' },
  ]

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Org Selector */}
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>

          {/* Range Selector */}
          <div className="flex rounded-lg border border-dark-border overflow-hidden">
            <button
              onClick={() => setRange('7d')}
              className={`px-3 py-2 text-sm transition-colors ${
                range === '7d'
                  ? 'bg-primary text-black font-medium'
                  : 'bg-dark-card text-gray-400 hover:text-white'
              }`}
            >
              7 days
            </button>
            <button
              onClick={() => setRange('30d')}
              className={`px-3 py-2 text-sm transition-colors ${
                range === '30d'
                  ? 'bg-primary text-black font-medium'
                  : 'bg-dark-card text-gray-400 hover:text-white'
              }`}
            >
              30 days
            </button>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-dark-border">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'adoption' && (
          <AdoptionTab data={adoptionData} isLoading={isLoading} />
        )}
        {activeTab === 'usage' && (
          <UsageTab data={usageData} isLoading={isLoading} />
        )}
        {activeTab === 'errors' && (
          <ErrorsTab data={errorsData} isLoading={isLoading} />
        )}
      </div>
    </div>
  )
}
