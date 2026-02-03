'use client'

import { useState } from 'react'
import {
  RetentionAnalysis,
  RetentionMetrics,
  ActiveCancellation,
  AtRiskCustomer,
  CohortData,
  RetentionCurvePoint,
  ChurnReasonBreakdown,
  CustomerSegmentRetention,
} from '@/lib/stripe'

interface RetentionDashboardProps {
  retentionAnalysis?: RetentionAnalysis
  onRefresh?: () => void
  isRefreshing?: boolean
}

type RetentionTab = 'overview' | 'active-cancellations' | 'at-risk' | 'cohorts' | 'segments'

// Helper function to safely format dates from JSON
function safeFormatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString()
  } catch {
    return '-'
  }
}

export default function RetentionDashboard({
  retentionAnalysis,
  onRefresh,
  isRefreshing = false,
}: RetentionDashboardProps) {
  const [activeTab, setActiveTab] = useState<RetentionTab>('overview')

  if (!retentionAnalysis) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Retention Data</h3>
        <p className="text-gray-400 mb-4">Click &quot;Refresh Revenue Data&quot; to load retention metrics.</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-black font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isRefreshing ? 'Syncing...' : 'Refresh Revenue Data'}
          </button>
        )}
      </div>
    )
  }

  const { metrics, activeCancellations, atRiskCustomers, cohortData, retentionCurve, churnReasons, segmentRetention } = retentionAnalysis

  const tabs: { id: RetentionTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'active-cancellations', label: 'Active Cancellations', count: activeCancellations?.length || 0 },
    { id: 'at-risk', label: 'At-Risk Customers', count: atRiskCustomers?.length || 0 },
    { id: 'cohorts', label: 'Cohort Analysis' },
    { id: 'segments', label: 'Segments' },
  ]

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-dark-border pb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-primary text-black'
                : 'bg-dark-surface text-gray-400 hover:text-white hover:bg-dark-border'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                activeTab === tab.id
                  ? 'bg-black/20 text-black'
                  : tab.id === 'at-risk' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && metrics && (
        <OverviewSection
          metrics={metrics}
          retentionCurve={retentionCurve || []}
          churnReasons={churnReasons || []}
        />
      )}

      {activeTab === 'active-cancellations' && (
        <ActiveCancellationsSection cancellations={activeCancellations || []} />
      )}

      {activeTab === 'at-risk' && (
        <AtRiskSection customers={atRiskCustomers || []} />
      )}

      {activeTab === 'cohorts' && (
        <CohortSection cohortData={cohortData || []} retentionCurve={retentionCurve || []} />
      )}

      {activeTab === 'segments' && (
        <SegmentsSection segments={segmentRetention || []} />
      )}
    </div>
  )
}

// ========== OVERVIEW SECTION ==========
function OverviewSection({
  metrics,
  retentionCurve,
  churnReasons,
}: {
  metrics: RetentionMetrics
  retentionCurve: RetentionCurvePoint[]
  churnReasons: ChurnReasonBreakdown[]
}) {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="30-Day Retention"
          value={`${metrics.retention30Day}%`}
          color={metrics.retention30Day >= 90 ? 'green' : metrics.retention30Day >= 70 ? 'yellow' : 'red'}
          icon={<RetentionIcon />}
        />
        <MetricCard
          label="Monthly Churn"
          value={`${metrics.monthlyChurnRate}%`}
          color={metrics.monthlyChurnRate <= 5 ? 'green' : metrics.monthlyChurnRate <= 10 ? 'yellow' : 'red'}
          icon={<ChurnIcon />}
        />
        <MetricCard
          label="Customers at Risk"
          value={metrics.customersAtRisk.toString()}
          subtitle={`$${metrics.revenueAtRisk.toFixed(0)}/mo at risk`}
          color={metrics.customersAtRisk === 0 ? 'green' : 'orange'}
          icon={<WarningIcon />}
        />
        <MetricCard
          label="Avg Customer Lifetime"
          value={`${metrics.avgCustomerLifetimeDays} days`}
          color="blue"
          icon={<CalendarIcon />}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SecondaryMetric label="90-Day Retention" value={`${metrics.retention90Day}%`} />
        <SecondaryMetric label="6-Month Retention" value={`${metrics.retention6Month}%`} />
        <SecondaryMetric label="12-Month Retention" value={`${metrics.retention12Month}%`} />
        <SecondaryMetric label="Avg LTV" value={`$${metrics.avgRevenuePerCustomer.toFixed(0)}`} />
      </div>

      {/* Retention Curve */}
      {retentionCurve.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Retention Curve</h3>
          <RetentionCurveChart data={retentionCurve} />
        </div>
      )}

      {/* Churn Reasons */}
      {churnReasons.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Churn Reasons</h3>
          <div className="space-y-3">
            {churnReasons.slice(0, 5).map((reason, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-gray-300">{reason.reason}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white font-medium">{reason.count}</span>
                  <span className="text-gray-500 text-sm">{reason.percentOfChurn}%</span>
                  <span className="text-red-400 text-sm">${reason.revenueImpact.toFixed(0)}/mo lost</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ========== ACTIVE CANCELLATIONS SECTION ==========
function ActiveCancellationsSection({ cancellations }: { cancellations: ActiveCancellation[] }) {
  if (cancellations.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Active Cancellations</h3>
        <p className="text-gray-400">All customers are in good standing. No pending cancellations.</p>
      </div>
    )
  }

  const totalRevenueLosing = cancellations.reduce((sum, c) => sum + (c.monthlyValue || 0), 0)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Active Cancellations</h3>
            <p className="text-gray-400 text-sm mt-1">
              Customers who have canceled but still have access
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-red-400">{cancellations.length}</div>
            <div className="text-sm text-gray-400">${totalRevenueLosing.toFixed(0)}/mo leaving</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface text-sm">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Customer</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Type</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">MRR Lost</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Access Ends</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Data Purge</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Lifetime</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Total Paid</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {cancellations.map((cancel) => (
                <tr key={cancel.subscriptionId} className="hover:bg-dark-surface">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{cancel.customerName || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{cancel.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded ${
                      cancel.subscriptionType === 'individual'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-primary/20 text-primary'
                    }`}>
                      {cancel.subscriptionType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-red-400 font-medium">
                    ${(cancel.monthlyValue || 0).toFixed(0)}/mo
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className={`font-medium ${
                      (cancel.daysUntilAccessEnds || 0) <= 7 ? 'text-red-400' : 'text-orange-400'
                    }`}>
                      {cancel.daysUntilAccessEnds || 0} days
                    </div>
                    <div className="text-xs text-gray-500">{safeFormatDate(cancel.currentPeriodEnd)}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-sm">
                    {cancel.daysUntilDataPurge || 0} days
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {cancel.customerLifetimeDays || 0} days
                  </td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    ${(cancel.totalRevenuePaid || 0).toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm max-w-[150px] truncate">
                    {cancel.cancellationReason || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ========== AT-RISK SECTION ==========
function AtRiskSection({ customers }: { customers: AtRiskCustomer[] }) {
  if (customers.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No At-Risk Customers</h3>
        <p className="text-gray-400">All customers appear healthy. No immediate churn risk detected.</p>
      </div>
    )
  }

  const totalRevenueAtRisk = customers.reduce((sum, c) => sum + (c.monthlyValue || 0), 0)
  const highRiskCount = customers.filter(c => c.riskLevel === 'high').length

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/30 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">At-Risk Customers</h3>
            <p className="text-gray-400 text-sm mt-1">
              Customers showing signs of potential churn
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-400">{customers.length}</div>
            <div className="text-sm text-gray-400">
              {highRiskCount} high risk • ${totalRevenueAtRisk.toFixed(0)}/mo at risk
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface text-sm">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Customer</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Risk Level</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">MRR</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Risk Factors</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Suggested Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {customers.map((customer) => (
                <tr key={customer.subscriptionId} className="hover:bg-dark-surface">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{customer.customerName || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{customer.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded font-medium ${
                      customer.riskLevel === 'high'
                        ? 'bg-red-500/20 text-red-400'
                        : customer.riskLevel === 'medium'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {customer.riskLevel?.toUpperCase()}
                    </span>
                    <div className="text-xs text-gray-500 mt-1">Score: {customer.riskScore}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    ${(customer.monthlyValue || 0).toFixed(0)}/mo
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {(customer.riskFactors || []).slice(0, 3).map((factor, i) => (
                        <div key={i} className="text-xs text-gray-400 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-orange-400" />
                          {factor}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {(customer.suggestedActions || []).slice(0, 2).map((action, i) => (
                        <button
                          key={i}
                          className="block text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ========== COHORT SECTION ==========
function CohortSection({
  cohortData,
  retentionCurve,
}: {
  cohortData: CohortData[]
  retentionCurve: RetentionCurvePoint[]
}) {
  if (cohortData.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Cohort Data</h3>
        <p className="text-gray-400">Not enough subscription data to generate cohort analysis.</p>
      </div>
    )
  }

  // Find the maximum number of months we have data for
  const maxMonths = Math.max(...cohortData.map(c => (c.retentionByMonth?.length || 1) - 1))

  return (
    <div className="space-y-6">
      {/* Retention Curve Chart */}
      {retentionCurve.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Overall Retention Curve</h3>
          <RetentionCurveChart data={retentionCurve} />
        </div>
      )}

      {/* Cohort Table */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white">Cohort Retention Table</h3>
          <p className="text-xs text-gray-500 mt-1">
            Percentage of customers still active X months after signup
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface text-sm">
                <th className="px-4 py-3 text-left text-gray-400 font-medium sticky left-0 bg-dark-surface">Cohort</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Signups</th>
                {Array.from({ length: Math.min(maxMonths + 1, 13) }, (_, i) => (
                  <th key={i} className="px-3 py-3 text-center text-gray-400 font-medium">
                    M{i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {cohortData.map((cohort, idx) => (
                <tr key={idx} className="hover:bg-dark-surface">
                  <td className="px-4 py-3 text-white font-medium sticky left-0 bg-dark-card">
                    {cohort.cohortMonth}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {cohort.signupCount}
                  </td>
                  {Array.from({ length: Math.min(maxMonths + 1, 13) }, (_, i) => {
                    const retention = cohort.retentionByMonth?.[i]
                    if (retention === undefined) {
                      return <td key={i} className="px-3 py-3 text-center text-gray-600">-</td>
                    }
                    return (
                      <td key={i} className="px-3 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          retention >= 90 ? 'bg-green-500/20 text-green-400' :
                          retention >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
                          retention >= 50 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {retention}%
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ========== SEGMENTS SECTION ==========
function SegmentsSection({ segments }: { segments: CustomerSegmentRetention[] }) {
  if (segments.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Segment Data</h3>
        <p className="text-gray-400">Not enough data to analyze customer segments.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Segment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {segments.map((segment, i) => (
          <div key={i} className="bg-dark-card border border-dark-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{segment.segmentName}</h3>
              <span className="px-3 py-1 text-sm rounded-full bg-primary/20 text-primary font-medium">
                {segment.count} customers
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-green-400">{segment.retentionRate}%</div>
                <div className="text-xs text-gray-500">Retention Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">{segment.churnRate}%</div>
                <div className="text-xs text-gray-500">Churn Rate</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">{segment.avgLifetimeDays} days</div>
                <div className="text-xs text-gray-500">Avg Lifetime</div>
              </div>
              <div>
                <div className="text-xl font-bold text-primary">${segment.avgLTV.toFixed(0)}</div>
                <div className="text-xs text-gray-500">Avg LTV</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white">Segment Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface text-sm">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Segment</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Count</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Retention</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Churn</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Avg Lifetime</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Avg LTV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {segments.map((segment, i) => (
                <tr key={i} className="hover:bg-dark-surface">
                  <td className="px-4 py-3 text-white font-medium">{segment.segmentName}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{segment.count}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${
                      segment.retentionRate >= 80 ? 'text-green-400' :
                      segment.retentionRate >= 60 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {segment.retentionRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${
                      segment.churnRate <= 20 ? 'text-green-400' :
                      segment.churnRate <= 40 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {segment.churnRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{segment.avgLifetimeDays} days</td>
                  <td className="px-4 py-3 text-right text-primary font-medium">${segment.avgLTV.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ========== RETENTION CURVE CHART ==========
function RetentionCurveChart({ data }: { data: RetentionCurvePoint[] }) {
  if (data.length === 0) return null

  const maxRetention = 100
  const chartHeight = 200
  const chartWidth = '100%'

  return (
    <div className="relative" style={{ height: chartHeight }}>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2">
        <span>100%</span>
        <span>75%</span>
        <span>50%</span>
        <span>25%</span>
        <span>0%</span>
      </div>

      {/* Chart area */}
      <div className="ml-10 h-full relative">
        {/* Grid lines */}
        <div className="absolute inset-0">
          {[0, 25, 50, 75, 100].map((val) => (
            <div
              key={val}
              className="absolute w-full border-t border-dark-border"
              style={{ top: `${100 - val}%` }}
            />
          ))}
        </div>

        {/* Data points and line */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {/* Line */}
          <polyline
            fill="none"
            stroke="#f97316"
            strokeWidth="2"
            points={data.map((point, i) => {
              const x = (i / Math.max(data.length - 1, 1)) * 100
              const y = 100 - point.retentionPercent
              return `${x}%,${y}%`
            }).join(' ')}
          />

          {/* Points */}
          {data.map((point, i) => {
            const x = (i / Math.max(data.length - 1, 1)) * 100
            const y = 100 - point.retentionPercent
            return (
              <circle
                key={i}
                cx={`${x}%`}
                cy={`${y}%`}
                r="4"
                fill="#f97316"
                className="hover:r-6 cursor-pointer"
              >
                <title>Month {point.monthsSinceSignup}: {point.retentionPercent}% ({point.customersRemaining}/{point.customersTotal})</title>
              </circle>
            )
          })}
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="ml-10 flex justify-between text-xs text-gray-500 mt-2">
        {data.map((point, i) => (
          <span key={i}>M{point.monthsSinceSignup}</span>
        ))}
      </div>
    </div>
  )
}

// ========== UI COMPONENTS ==========
function MetricCard({
  label,
  value,
  subtitle,
  color,
  icon,
}: {
  label: string
  value: string
  subtitle?: string
  color: 'green' | 'yellow' | 'red' | 'blue' | 'orange'
  icon: React.ReactNode
}) {
  const colorClasses = {
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }

  return (
    <div className={`bg-dark-card border rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="opacity-60">{icon}</div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  )
}

function SecondaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-4">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  )
}

// Icons
function RetentionIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function ChurnIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
