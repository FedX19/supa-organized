'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  PlanFunnelResponse,
  FunnelStep,
  PlanBreakdownItem,
} from '@/lib/plan-funnel-types'

interface PlanFunnelDashboardProps {
  selectedOrgId: string
  range: '7d' | '30d'
  getValidAccessToken: () => Promise<string | null>
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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-gray-400">{message}</p>
    </div>
  )
}

function truncateId(id: string, len = 8): string {
  if (!id) return '—'
  return id.length > len ? `${id.slice(0, len)}...` : id
}

function relativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  return 'just now'
}

function FunnelStepCard({ step, isLast }: { step: FunnelStep; isLast: boolean }) {
  const dropoffColor = step.dropoff_pct === null ? 'text-gray-500' :
    step.dropoff_pct > 50 ? 'text-red-400' :
    step.dropoff_pct > 20 ? 'text-amber-400' : 'text-green-400'

  const arrowColor = step.dropoff_pct === null ? 'text-gray-600' :
    step.dropoff_pct > 50 ? 'text-red-400' :
    step.dropoff_pct > 20 ? 'text-amber-400' : 'text-green-400'

  return (
    <div className="flex flex-col items-center">
      <div
        className={`min-w-[140px] p-4 rounded-lg border text-center ${
          !step.has_data && step.step === 6
            ? 'border-dashed border-gray-600 bg-dark-card/50'
            : 'border-dark-border bg-dark-card'
        }`}
      >
        <p className="text-xs text-gray-500 mb-1">STEP {step.step}</p>
        <p className="text-sm font-medium text-white mb-2">{step.name}</p>
        <p className="text-2xl font-bold text-white">{step.count}</p>
        <p className="text-xs text-gray-400">{step.unique_users} parents</p>
        <p className="text-xs text-gray-600 mt-2">
          <span className="px-1.5 py-0.5 bg-dark-border rounded text-gray-500">
            {step.source}
          </span>
        </p>
        {step.note && (
          <p className="text-xs text-gray-500 mt-2 italic">{step.note}</p>
        )}
      </div>
      {!isLast && (
        <div className="flex flex-col items-center my-2">
          <svg className={`w-5 h-5 ${arrowColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          {step.dropoff_pct !== null && (
            <span className={`text-xs font-medium ${dropoffColor}`}>
              -{step.dropoff_pct.toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  title,
  value,
  subtitle,
  color = 'default',
  onClick,
}: {
  title: string
  value: string | number
  subtitle?: string
  color?: 'default' | 'green' | 'amber' | 'red'
  onClick?: () => void
}) {
  const colorClasses = {
    default: 'text-white',
    green: 'text-green-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  }

  return (
    <div
      className={`bg-dark-card border border-dark-border rounded-xl p-5 ${onClick ? 'cursor-pointer hover:border-primary/50' : ''}`}
      onClick={onClick}
    >
      <h3 className="text-sm text-gray-400 mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

function PlanStatusTable({
  plans,
  expanded,
  onToggleExpand,
}: {
  plans: PlanBreakdownItem[]
  expanded: string | null
  onToggleExpand: (planId: string) => void
}) {
  const [sortKey, setSortKey] = useState<'created_at' | 'reached_step'>('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = [...plans].sort((a, b) => {
    const aVal = sortKey === 'created_at' ? new Date(a.created_at).getTime() : a.reached_step
    const bVal = sortKey === 'created_at' ? new Date(b.created_at).getTime() : b.reached_step
    return sortAsc ? aVal - bVal : bVal - aVal
  })

  const handleSort = (key: 'created_at' | 'reached_step') => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-5 overflow-hidden">
      <h3 className="text-lg font-semibold text-white mb-4">Plan-by-Plan Status</h3>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-dark-border">
              <th className="text-left text-gray-400 font-medium pb-2">Parent Email</th>
              <th
                className="text-left text-gray-400 font-medium pb-2 cursor-pointer hover:text-white"
                onClick={() => handleSort('created_at')}
              >
                Created {sortKey === 'created_at' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="text-center text-gray-400 font-medium pb-2">Notified</th>
              <th className="text-center text-gray-400 font-medium pb-2">Emailed</th>
              <th className="text-center text-gray-400 font-medium pb-2">Delivered</th>
              <th className="text-center text-gray-400 font-medium pb-2">Read</th>
              <th className="text-center text-gray-400 font-medium pb-2">Viewed</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((plan) => {
              const rowClass = plan.reached_step >= 5 ? 'bg-green-500/5' :
                plan.reached_step <= 2 ? 'bg-red-500/5' : ''
              const isExpanded = expanded === plan.plan_id

              return (
                <>
                  <tr
                    key={plan.plan_id}
                    className={`border-b border-dark-border/50 cursor-pointer hover:bg-dark-border/30 ${rowClass}`}
                    onClick={() => onToggleExpand(plan.plan_id)}
                  >
                    <td className="py-2 text-white whitespace-nowrap max-w-[200px] truncate" title={plan.parent_email}>
                      {plan.parent_email || '—'}
                    </td>
                    <td className="py-2 text-gray-400 whitespace-nowrap">{relativeTime(plan.created_at)}</td>
                    <td className="py-2 text-center">{plan.steps.notified ? '✅' : '○'}</td>
                    <td className="py-2 text-center">{plan.steps.emailed ? '✅' : '○'}</td>
                    <td className="py-2 text-center">{plan.steps.delivered ? '✅' : '○'}</td>
                    <td className="py-2 text-center">{plan.steps.read ? '✅' : '○'}</td>
                    <td className="py-2 text-center">{plan.steps.viewed ? '✅' : '○'}</td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${plan.plan_id}-expanded`} className="bg-dark-border/20">
                      <td colSpan={7} className="py-3 px-4">
                        <div className="text-xs text-gray-400 space-y-1">
                          <p><strong>Plan ID:</strong> {plan.plan_id}</p>
                          <p><strong>Parent Email:</strong> {plan.parent_email || '—'}</p>
                          <p><strong>Created:</strong> {new Date(plan.created_at).toLocaleString()}</p>
                          <p><strong>Reached Step:</strong> {plan.reached_step} of 6</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
      {plans.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-4">No plans in this period</p>
      )}
    </div>
  )
}

function DrilldownPanel({
  title,
  color,
  children,
  defaultOpen = false,
}: {
  title: string
  color: 'amber' | 'red' | 'slate'
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const headerColors = {
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    slate: 'bg-dark-card border-dark-border text-gray-300',
  }

  return (
    <div className="border border-dark-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full px-4 py-3 flex items-center justify-between ${headerColors[color]}`}
      >
        <span className="font-medium">{title}</span>
        <svg
          className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-4 bg-dark-card">{children}</div>}
    </div>
  )
}

export default function PlanFunnelDashboard({
  selectedOrgId,
  range,
  getValidAccessToken,
}: PlanFunnelDashboardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PlanFunnelResponse | null>(null)
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!selectedOrgId) return

    setIsLoading(true)
    setError(null)

    try {
      const token = await getValidAccessToken()
      if (!token) {
        setError('No valid access token')
        return
      }

      const res = await fetch(`/api/plan-funnel?org_id=${selectedOrgId}&range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to fetch funnel data')
      }

      const result = await res.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [selectedOrgId, range, getValidAccessToken])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const conversionColor = (rate: number | null): 'green' | 'amber' | 'red' | 'default' => {
    if (rate === null) return 'default'
    if (rate >= 60) return 'green'
    if (rate >= 30) return 'amber'
    return 'red'
  }

  return (
    <div className="space-y-6 overflow-hidden">

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
          <p className="text-red-400">{error}</p>
          <button onClick={fetchData} className="text-red-400 hover:text-white text-sm">
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && <LoadingSpinner />}

      {/* Empty State */}
      {!isLoading && data && !data.hasData && (
        <EmptyState message="No plans found for this org in the selected period. Plans will appear here once coaches start generating them." />
      )}

      {/* Data Display */}
      {!isLoading && data && data.hasData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard
              title="Plans Created"
              value={data.summary.plansCreated}
              subtitle={`in the last ${range}`}
            />
            <SummaryCard
              title="Overall Conversion"
              value={data.summary.overallConversion !== null ? `${data.summary.overallConversion.toFixed(1)}%` : '—'}
              subtitle={`${data.funnel[5].unique_users} of ${data.funnel[0].unique_users} parents viewed their plan`}
              color={conversionColor(data.summary.overallConversion)}
            />
            <SummaryCard
              title="Email Failures"
              value={data.summary.emailFailures}
              subtitle={data.summary.emailFailures > 0 ? 'View details below' : 'All delivered'}
              color={data.summary.emailFailures > 0 ? 'red' : 'green'}
            />
          </div>

          {/* Funnel Visualization */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5 overflow-hidden">
            <h3 className="text-lg font-semibold text-white mb-4">Notification Funnel</h3>
            <div className="overflow-x-auto -mx-5 px-5 pb-2">
              <div className="flex gap-4 min-w-max">
                {data.funnel.map((step, i) => (
                  <FunnelStepCard key={step.step} step={step} isLast={i === data.funnel.length - 1} />
                ))}
              </div>
            </div>
          </div>

          {/* Plan Status Table */}
          <PlanStatusTable
            plans={data.planBreakdown}
            expanded={expandedPlan}
            onToggleExpand={(id) => setExpandedPlan(expandedPlan === id ? null : id)}
          />

          {/* Drilldown Panels */}
          <div className="space-y-4">
            {data.drilldown.failedEmails.length > 0 && (
              <DrilldownPanel title={`Failed Emails (${data.drilldown.failedEmails.length})`} color="red" defaultOpen>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead>
                      <tr className="border-b border-dark-border">
                        <th className="text-left text-gray-400 pb-2">Profile ID</th>
                        <th className="text-left text-gray-400 pb-2">Error</th>
                        <th className="text-left text-gray-400 pb-2">Created</th>
                        <th className="text-right text-gray-400 pb-2">Attempts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.drilldown.failedEmails.map((e) => (
                        <tr key={e.outbox_id} className="border-b border-dark-border/50">
                          <td className="py-2 text-gray-300" title={e.profile_id}>{truncateId(e.profile_id)}</td>
                          <td className="py-2 text-red-400 font-mono text-xs max-w-[150px] truncate">{e.last_error || '—'}</td>
                          <td className="py-2 text-gray-400 whitespace-nowrap">{relativeTime(e.created_at)}</td>
                          <td className="py-2 text-right text-gray-400">{e.attempts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DrilldownPanel>
            )}

            {data.drilldown.unreadNotifications.length > 0 && (
              <DrilldownPanel title={`Unread Notifications (${data.drilldown.unreadNotifications.length})`} color="amber">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[300px]">
                    <thead>
                      <tr className="border-b border-dark-border">
                        <th className="text-left text-gray-400 pb-2">Profile ID</th>
                        <th className="text-left text-gray-400 pb-2">Notified At</th>
                        <th className="text-right text-gray-400 pb-2">Days Unread</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.drilldown.unreadNotifications.map((n) => (
                        <tr key={n.notification_id} className="border-b border-dark-border/50">
                          <td className="py-2 text-gray-300" title={n.profile_id}>{truncateId(n.profile_id)}</td>
                          <td className="py-2 text-gray-400 whitespace-nowrap">{relativeTime(n.created_at)}</td>
                          <td className={`py-2 text-right ${n.days_unread > 7 ? 'text-red-400' : 'text-gray-400'}`}>
                            {n.days_unread}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DrilldownPanel>
            )}

            {data.drilldown.neverViewedPlans.length > 0 && (
              <DrilldownPanel title={`Plans Never Viewed (${data.drilldown.neverViewedPlans.length})`} color="slate">
                <p className="text-xs text-gray-500 mb-3">
                  Parents who received notification/email but never opened the plan
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[350px]">
                    <thead>
                      <tr className="border-b border-dark-border">
                        <th className="text-left text-gray-400 pb-2">Plan ID</th>
                        <th className="text-left text-gray-400 pb-2">Player ID</th>
                        <th className="text-left text-gray-400 pb-2">Created</th>
                        <th className="text-right text-gray-400 pb-2">Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.drilldown.neverViewedPlans.map((p) => (
                        <tr key={p.plan_id} className="border-b border-dark-border/50">
                          <td className="py-2 text-gray-300" title={p.plan_id}>{truncateId(p.plan_id)}</td>
                          <td className="py-2 text-gray-400" title={p.player_id}>{truncateId(p.player_id)}</td>
                          <td className="py-2 text-gray-400 whitespace-nowrap">{relativeTime(p.created_at)}</td>
                          <td className="py-2 text-right text-gray-400">{p.days_since_created}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DrilldownPanel>
            )}
          </div>
        </>
      )}
    </div>
  )
}
