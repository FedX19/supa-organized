'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  RealRevenueData,
  RealRevenueMetrics,
  IndividualMember,
  LeagueCoach,
  GrowthDataPoint,
  formatCurrency,
  getCurrentSeason,
  getNextSeasonDate,
  exportToCSV,
} from '@/lib/supabase'
import {
  StripeMetrics,
  StripeSubscription,
  StripeCancellation,
  StripePayment,
  CancellationAnalysis,
  StripeCoupon,
  StripeDataSyncResult,
  RetentionAnalysis,
} from '@/lib/stripe'
import RetentionDashboard from '@/components/RetentionDashboard'

interface RevenueDashboardProps {
  data: RealRevenueData
  onRefreshStripe?: () => Promise<{
    success: boolean
    syncResult?: StripeDataSyncResult
    metrics?: StripeMetrics
    cancellationAnalysis?: CancellationAnalysis
    error?: string
  }>
  stripeData?: {
    hasData: boolean
    metrics?: StripeMetrics
    cancellationAnalysis?: CancellationAnalysis
    retentionAnalysis?: RetentionAnalysis
    activeSubscriptions?: StripeSubscription[]
    canceledSubscriptions?: StripeSubscription[]
    pastDueSubscriptions?: StripeSubscription[]
    scheduledCancellations?: StripeSubscription[]
    betaTesters?: StripeSubscription[]
    failedPayments?: StripePayment[]
    couponUsage?: { coupon: StripeCoupon; customerCount: number; revenueImpact: number }[]
    lastSyncedAt?: string | null
  }
  isRefreshing?: boolean
}

type ActiveTab = 'overview' | 'retention' | 'individuals' | 'leagues' | 'cancellations' | 'at-risk' | 'beta-testers' | 'export'

// Helper function to safely format dates that may be strings from JSON
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

// Helper to ensure we have a valid Date object
function ensureDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return null
    return d
  } catch {
    return null
  }
}

export default function RevenueDashboard({
  data,
  onRefreshStripe,
  stripeData,
  isRefreshing = false,
}: RevenueDashboardProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [showRefreshToast, setShowRefreshToast] = useState(false)
  const [refreshResult, setRefreshResult] = useState<{ success: boolean; message: string } | null>(null)
  const currentSeason = getCurrentSeason()
  const nextSeasonDate = getNextSeasonDate()

  const handleRefresh = useCallback(async () => {
    if (!onRefreshStripe || isRefreshing) return

    const result = await onRefreshStripe()
    setRefreshResult({
      success: result.success,
      message: result.success
        ? `Synced ${result.syncResult?.subscriptions || 0} subscriptions, ${result.syncResult?.cancellations || 0} cancellations`
        : result.error || 'Failed to sync',
    })
    setShowRefreshToast(true)
    setTimeout(() => setShowRefreshToast(false), 5000)
  }, [onRefreshStripe, isRefreshing])

  const formatLastSync = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  // Use Stripe data if available, otherwise fall back to estimated data
  const useStripeData = stripeData?.hasData && stripeData.metrics

  if (!data.hasData && !useStripeData) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Revenue Data</h3>
        <p className="text-gray-400 max-w-md mx-auto mb-4">
          {data.error || 'Click "Refresh Revenue Data" to sync from Stripe, or check your database connection.'}
        </p>
        {onRefreshStripe && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`px-4 py-2 rounded-lg font-medium ${
              isRefreshing
                ? 'bg-orange-500/50 text-orange-200 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {isRefreshing ? 'Syncing...' : 'Refresh Revenue Data'}
          </button>
        )}
      </div>
    )
  }

  const tabs: { id: ActiveTab; label: string; count?: number; alert?: boolean }[] = [
    { id: 'overview', label: 'Overview' },
    ...(useStripeData ? [
      {
        id: 'retention' as ActiveTab,
        label: 'Retention',
        count: stripeData?.retentionAnalysis?.atRiskCustomers?.length || 0,
        alert: (stripeData?.retentionAnalysis?.atRiskCustomers?.length || 0) > 0,
      },
    ] : []),
    { id: 'individuals', label: 'Individual Members', count: data.individualMembers.length },
    { id: 'leagues', label: 'League Coaches', count: data.leagueCoaches.length },
    ...(useStripeData ? [
      {
        id: 'cancellations' as ActiveTab,
        label: 'Cancellations',
        count: stripeData?.cancellationAnalysis?.cancellationsThisMonth || 0,
        alert: (stripeData?.cancellationAnalysis?.cancellationsThisMonth || 0) > 0,
      },
      {
        id: 'at-risk' as ActiveTab,
        label: 'At Risk',
        count: (stripeData?.pastDueSubscriptions?.length || 0) + (stripeData?.scheduledCancellations?.length || 0),
        alert: ((stripeData?.pastDueSubscriptions?.length || 0) + (stripeData?.scheduledCancellations?.length || 0)) > 0,
      },
      {
        id: 'beta-testers' as ActiveTab,
        label: 'Beta Testers',
        count: stripeData?.betaTesters?.length || 0,
      },
    ] : []),
    { id: 'export', label: 'Export' },
  ]

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Refresh Toast */}
      {showRefreshToast && refreshResult && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
          refreshResult.success ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <span className="text-white font-medium">{refreshResult.message}</span>
          <button onClick={() => setShowRefreshToast(false)} className="text-white/80 hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Refresh Button Row */}
      {onRefreshStripe && (
        <div className="flex items-center justify-between bg-dark-card border border-dark-border rounded-lg p-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                isRefreshing
                  ? 'bg-orange-500/50 text-orange-200 cursor-not-allowed'
                  : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
              }`}
            >
              {isRefreshing ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Syncing Stripe...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh Revenue Data</span>
                </>
              )}
            </button>
            <span className="text-sm text-gray-400">
              Last synced: {formatLastSync(stripeData?.lastSyncedAt)}
            </span>
          </div>
          {useStripeData && (
            <div className="hidden md:flex items-center gap-4 text-sm">
              <span className="text-green-400">
                {stripeData?.metrics?.activeSubscriptions || 0} active
              </span>
              {(stripeData?.metrics?.pastDueSubscriptions || 0) > 0 && (
                <span className="text-orange-400">
                  {stripeData?.metrics?.pastDueSubscriptions} past due
                </span>
              )}
              {(stripeData?.cancellationAnalysis?.cancellationsThisMonth || 0) > 0 && (
                <span className="text-red-400">
                  {stripeData?.cancellationAnalysis?.cancellationsThisMonth} canceled this month
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary text-black'
                : 'bg-dark-card border border-dark-border text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                activeTab === tab.id
                  ? 'bg-black/20'
                  : tab.alert
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-primary/20 text-primary'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <OverviewSection
          metrics={data.metrics}
          stripeMetrics={useStripeData ? stripeData.metrics : undefined}
          cancellationAnalysis={useStripeData ? stripeData.cancellationAnalysis : undefined}
          growthData={data.growthData}
          currentSeason={currentSeason}
          nextSeasonDate={nextSeasonDate}
        />
      )}

      {/* Retention Tab */}
      {activeTab === 'retention' && (
        <RetentionDashboard
          retentionAnalysis={stripeData?.retentionAnalysis}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      )}

      {/* Individual Members Tab */}
      {activeTab === 'individuals' && (
        <IndividualsSection
          members={data.individualMembers}
          subscriptions={useStripeData ? stripeData?.activeSubscriptions : undefined}
        />
      )}

      {/* League Coaches Tab */}
      {activeTab === 'leagues' && (
        <LeaguesSection
          coaches={data.leagueCoaches}
          subscriptions={useStripeData ? stripeData?.activeSubscriptions : undefined}
        />
      )}

      {/* Cancellations Tab */}
      {activeTab === 'cancellations' && (
        stripeData?.cancellationAnalysis ? (
          <CancellationsSection analysis={stripeData.cancellationAnalysis} />
        ) : (
          <EmptyStripeState
            title="No Cancellation Data"
            message="Click 'Refresh Revenue Data' to sync cancellation data from Stripe."
            onRefresh={onRefreshStripe}
            isRefreshing={isRefreshing}
          />
        )
      )}

      {/* At Risk Tab */}
      {activeTab === 'at-risk' && (
        stripeData?.hasData ? (
          <AtRiskSection
            pastDue={stripeData.pastDueSubscriptions || []}
            scheduledCancellations={stripeData.scheduledCancellations || []}
            failedPayments={stripeData.failedPayments || []}
          />
        ) : (
          <EmptyStripeState
            title="No At-Risk Data"
            message="Click 'Refresh Revenue Data' to sync subscription data from Stripe."
            onRefresh={onRefreshStripe}
            isRefreshing={isRefreshing}
          />
        )
      )}

      {/* Beta Testers Tab */}
      {activeTab === 'beta-testers' && (
        stripeData?.hasData ? (
          <BetaTestersSection
            betaTesters={stripeData.betaTesters || []}
            couponUsage={stripeData.couponUsage || []}
            metrics={stripeData.metrics}
          />
        ) : (
          <EmptyStripeState
            title="No Beta Tester Data"
            message="Click 'Refresh Revenue Data' to sync subscription data from Stripe."
            onRefresh={onRefreshStripe}
            isRefreshing={isRefreshing}
          />
        )
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <ExportSection data={data} stripeData={stripeData} />
      )}
    </div>
  )
}

// ========== OVERVIEW SECTION ==========
function OverviewSection({
  metrics,
  stripeMetrics,
  cancellationAnalysis,
  growthData,
  currentSeason,
  nextSeasonDate,
}: {
  metrics: RealRevenueMetrics
  stripeMetrics?: StripeMetrics
  cancellationAnalysis?: CancellationAnalysis
  growthData: GrowthDataPoint[]
  currentSeason: string
  nextSeasonDate: Date
}) {
  // Use Stripe metrics if available
  const displayMetrics = stripeMetrics || {
    mrr: metrics.mrr,
    arr: metrics.arr,
    lifetimeRevenue: metrics.totalRevenue,
    activeSubscriptions: metrics.totalCustomers,
    canceledThisMonth: 0,
    churnRate: metrics.churnRate,
    revenueLostThisMonth: 0,
    avgCustomerLifetime: 0,
    totalCustomers: metrics.totalCustomers,
    payingCustomers: metrics.totalCustomers,
    betaTesters: 0,
    discountedCustomers: 0,
    actualRevenue: metrics.mrr,
    potentialRevenue: metrics.mrr,
    discountedRevenue: 0,
    pastDueSubscriptions: 0,
    failedPaymentsThisMonth: 0,
  }

  return (
    <div className="space-y-6">
      {/* Source Indicator */}
      {stripeMetrics && (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-gray-400">Live data from Stripe</span>
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="MRR"
          value={formatCurrency(displayMetrics.mrr * 100)}
          icon={<DollarIcon />}
          color="green"
        />
        <MetricCard
          label="ARR"
          value={formatCurrency(displayMetrics.arr * 100)}
          icon={<CalendarIcon />}
          color="blue"
        />
        <MetricCard
          label="Active Subscriptions"
          value={displayMetrics.activeSubscriptions.toString()}
          icon={<UsersIcon />}
          color="primary"
        />
        <MetricCard
          label="Lifetime Revenue"
          value={formatCurrency(displayMetrics.lifetimeRevenue * 100)}
          subtitle="All-time"
          icon={<TrendIcon />}
          color="green"
        />
      </div>

      {/* Churn & Cancellation Metrics */}
      {stripeMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Canceled This Month"
            value={displayMetrics.canceledThisMonth.toString()}
            color="red"
            icon={<CancelIcon />}
          />
          <MetricCard
            label="Revenue Lost"
            value={formatCurrency(displayMetrics.revenueLostThisMonth * 100)}
            subtitle="This month"
            color="red"
            icon={<TrendDownIcon />}
          />
          <MetricCard
            label="Churn Rate"
            value={`${displayMetrics.churnRate.toFixed(1)}%`}
            color={displayMetrics.churnRate > 5 ? 'red' : displayMetrics.churnRate > 2 ? 'yellow' : 'green'}
            icon={<ChurnIcon />}
          />
          <MetricCard
            label="Avg Customer Lifetime"
            value={`${displayMetrics.avgCustomerLifetime} days`}
            color="blue"
            icon={<CalendarIcon />}
          />
        </div>
      )}

      {/* Customer Segmentation */}
      {stripeMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SecondaryCard
            label="Paying Customers"
            value={displayMetrics.payingCustomers.toString()}
            subtitle="Full price"
          />
          <SecondaryCard
            label="Beta Testers"
            value={displayMetrics.betaTesters.toString()}
            subtitle="100% discount"
          />
          <SecondaryCard
            label="Discounted"
            value={displayMetrics.discountedCustomers.toString()}
            subtitle="Partial discount"
          />
          <SecondaryCard
            label="Past Due"
            value={displayMetrics.pastDueSubscriptions.toString()}
            subtitle="Payment failed"
            alert={displayMetrics.pastDueSubscriptions > 0}
          />
        </div>
      )}

      {/* Revenue Analysis (Stripe only) */}
      {stripeMetrics && displayMetrics.discountedRevenue > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Revenue Analysis</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xl font-bold text-green-400">${displayMetrics.actualRevenue.toFixed(0)}/mo</div>
              <div className="text-xs text-gray-500">Actual Revenue</div>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-400">${displayMetrics.potentialRevenue.toFixed(0)}/mo</div>
              <div className="text-xs text-gray-500">Potential Revenue</div>
            </div>
            <div>
              <div className="text-xl font-bold text-orange-400">${displayMetrics.discountedRevenue.toFixed(0)}/mo</div>
              <div className="text-xs text-gray-500">Being Discounted</div>
            </div>
          </div>
        </div>
      )}

      {/* Season Info */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Current Season</div>
            <div className="text-xl font-bold text-white capitalize">{currentSeason} Season</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Next Season Payment</div>
            <div className="text-xl font-bold text-primary">
              {nextSeasonDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart growthData={growthData} />
        {cancellationAnalysis && cancellationAnalysis.cancellationsByMonth.length > 0 ? (
          <CancellationChart data={cancellationAnalysis.cancellationsByMonth} />
        ) : (
          <CustomerChart growthData={growthData} />
        )}
      </div>

      {/* Revenue Breakdown */}
      <RevenueBreakdown metrics={metrics} stripeMetrics={stripeMetrics} />
    </div>
  )
}

// ========== CANCELLATIONS SECTION ==========
function CancellationsSection({ analysis }: { analysis: CancellationAnalysis }) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Cancellations This Month"
          value={analysis.cancellationsThisMonth.toString()}
          color="red"
          icon={<CancelIcon />}
        />
        <MetricCard
          label="Revenue Lost"
          value={formatCurrency(analysis.revenueLostThisMonth * 100)}
          subtitle="This month"
          color="red"
          icon={<TrendDownIcon />}
        />
        <MetricCard
          label="Avg Customer Lifetime"
          value={`${analysis.avgCustomerLifetimeDays} days`}
          color="blue"
          icon={<CalendarIcon />}
        />
        <MetricCard
          label="Churn Rate"
          value={`${analysis.churnRate.toFixed(1)}%`}
          color={analysis.churnRate > 5 ? 'red' : 'yellow'}
          icon={<ChurnIcon />}
        />
      </div>

      {/* Churn Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SecondaryCard
          label="Early Churn"
          value={analysis.earlyChurn.toString()}
          subtitle="< 30 days"
          alert={analysis.earlyChurn > 0}
        />
        <SecondaryCard
          label="Late Churn"
          value={analysis.lateChurn.toString()}
          subtitle="> 6 months"
        />
        <SecondaryCard
          label="Beta Tester Churn"
          value={analysis.betaTesterChurn.toString()}
          subtitle="Free accounts"
        />
        <SecondaryCard
          label="Paying Customer Churn"
          value={analysis.payingCustomerChurn.toString()}
          subtitle="Paid accounts"
          alert={analysis.payingCustomerChurn > 0}
        />
      </div>

      {/* Cancellation Chart */}
      <CancellationChart data={analysis.cancellationsByMonth} />

      {/* Recent Cancellations Table */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white">Recent Cancellations</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface text-sm">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Customer</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Type</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Canceled</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Days Active</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Monthly Value</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Total Paid</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {analysis.recentCancellations.slice(0, 20).map((cancel) => (
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
                  <td className="px-4 py-3 text-right text-gray-400 text-sm">
                    {safeFormatDate(cancel.canceledAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${(cancel.daysAsCustomer || 0) < 30 ? 'text-red-400' : 'text-gray-300'}`}>
                      {cancel.daysAsCustomer || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-red-400 font-medium">
                    ${(cancel.monthlyValue || 0).toFixed(0)}/mo
                  </td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    ${(cancel.totalPaid || 0).toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm max-w-[150px] truncate">
                    {cancel.reason || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {analysis.recentCancellations.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No cancellations found. Great news!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ========== AT RISK SECTION ==========
function AtRiskSection({
  pastDue,
  scheduledCancellations,
  failedPayments,
}: {
  pastDue: StripeSubscription[]
  scheduledCancellations: StripeSubscription[]
  failedPayments: StripePayment[]
}) {
  const totalAtRisk = pastDue.length + scheduledCancellations.length
  const atRiskRevenue = [...pastDue, ...scheduledCancellations].reduce((sum, s) => sum + s.discountedAmount, 0)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">At-Risk Customers</h3>
            <p className="text-gray-400 text-sm mt-1">
              Customers with payment issues or scheduled cancellations
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-400">{totalAtRisk}</div>
            <div className="text-sm text-gray-400">${atRiskRevenue.toFixed(0)}/mo at risk</div>
          </div>
        </div>
      </div>

      {/* Past Due Subscriptions */}
      {pastDue.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border bg-red-500/10">
            <h3 className="font-medium text-red-400">Past Due ({pastDue.length})</h3>
            <p className="text-xs text-gray-500">Payment failed - requires action</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border bg-dark-surface text-sm">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Customer</th>
                  <th className="px-4 py-3 text-right text-gray-400 font-medium">Amount</th>
                  <th className="px-4 py-3 text-right text-gray-400 font-medium">Period End</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Coupon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {pastDue.map((sub) => (
                  <tr key={sub.id} className="hover:bg-dark-surface">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{sub.customerName || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{sub.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-red-400 font-medium">
                      ${(sub.discountedAmount || 0).toFixed(0)}/mo
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-sm">
                      {safeFormatDate(sub.currentPeriodEnd)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {sub.couponName || sub.couponId || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scheduled Cancellations */}
      {scheduledCancellations.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border bg-orange-500/10">
            <h3 className="font-medium text-orange-400">Scheduled to Cancel ({scheduledCancellations.length})</h3>
            <p className="text-xs text-gray-500">Will cancel at end of billing period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border bg-dark-surface text-sm">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Customer</th>
                  <th className="px-4 py-3 text-right text-gray-400 font-medium">Amount</th>
                  <th className="px-4 py-3 text-right text-gray-400 font-medium">Cancels On</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Coupon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {scheduledCancellations.map((sub) => (
                  <tr key={sub.id} className="hover:bg-dark-surface">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{sub.customerName || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{sub.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-orange-400 font-medium">
                      ${(sub.discountedAmount || 0).toFixed(0)}/mo
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-sm">
                      {safeFormatDate(sub.currentPeriodEnd)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {sub.couponName || sub.couponId || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Failed Payments */}
      {failedPayments.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border bg-red-500/10">
            <h3 className="font-medium text-red-400">Failed Payments ({failedPayments.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border bg-dark-surface text-sm">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Customer</th>
                  <th className="px-4 py-3 text-right text-gray-400 font-medium">Amount</th>
                  <th className="px-4 py-3 text-right text-gray-400 font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {failedPayments.slice(0, 10).map((payment) => (
                  <tr key={payment.id} className="hover:bg-dark-surface">
                    <td className="px-4 py-3">
                      <div className="text-gray-300">{payment.customerEmail || 'Unknown'}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-red-400 font-medium">
                      ${(payment.amount || 0).toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-sm">
                      {safeFormatDate(payment.created)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm max-w-[200px] truncate">
                      {payment.failureMessage || 'Unknown reason'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalAtRisk === 0 && failedPayments.length === 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">All Clear!</h3>
          <p className="text-gray-400">No at-risk customers. All payments are healthy.</p>
        </div>
      )}
    </div>
  )
}

// ========== BETA TESTERS SECTION ==========
function BetaTestersSection({
  betaTesters,
  couponUsage,
  metrics,
}: {
  betaTesters: StripeSubscription[]
  couponUsage: { coupon: StripeCoupon; customerCount: number; revenueImpact: number }[]
  metrics?: StripeMetrics
}) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Beta Testers & Free Accounts</h3>
            <p className="text-gray-400 text-sm mt-1">
              Customers with 100% discount coupons
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-purple-400">{betaTesters.length}</div>
            <div className="text-sm text-gray-400">
              ${betaTesters.reduce((sum, b) => sum + b.planAmount, 0).toFixed(0)}/mo potential
            </div>
          </div>
        </div>
      </div>

      {/* Coupon Usage */}
      {couponUsage.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Coupon Usage</h3>
          <div className="space-y-3">
            {couponUsage.map(({ coupon, customerCount, revenueImpact }) => (
              <div key={coupon.id} className="flex items-center justify-between p-3 bg-dark-surface rounded-lg">
                <div>
                  <div className="text-white font-medium">{coupon.name || coupon.id}</div>
                  <div className="text-xs text-gray-500">
                    {coupon.percentOff ? `${coupon.percentOff}% off` : `$${coupon.amountOff} off`}
                    {coupon.duration !== 'once' && ` (${coupon.duration})`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-medium">{customerCount} customers</div>
                  <div className="text-xs text-orange-400">${revenueImpact.toFixed(0)}/mo impact</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Beta Testers Table */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white">Beta Tester List</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface text-sm">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Customer</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Coupon</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Plan Value</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Paying</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {betaTesters.map((sub) => (
                <tr key={sub.id} className="hover:bg-dark-surface">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{sub.customerName || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{sub.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400">
                      {sub.couponName || sub.couponId || 'Beta'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    ${(sub.planAmount || 0).toFixed(0)}/mo
                  </td>
                  <td className="px-4 py-3 text-right text-green-400 font-medium">
                    ${(sub.discountedAmount || 0).toFixed(0)}/mo
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-sm">
                    {safeFormatDate(sub.startDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {betaTesters.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No beta testers found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ========== EMPTY STATE FOR STRIPE DATA ==========
function EmptyStripeState({
  title,
  message,
  onRefresh,
  isRefreshing,
}: {
  title: string
  message: string
  onRefresh?: () => void
  isRefreshing?: boolean
}) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
      <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 mb-4">{message}</p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-black font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {isRefreshing ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Syncing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Revenue Data
            </>
          )}
        </button>
      )}
    </div>
  )
}

// ========== METRIC CARDS ==========
function MetricCard({
  label,
  value,
  change,
  subtitle,
  icon,
  color,
}: {
  label: string
  value: string
  change?: number
  subtitle?: string
  icon?: React.ReactNode
  color: 'green' | 'blue' | 'primary' | 'red' | 'yellow'
}) {
  const colorClasses = {
    green: 'bg-green-500/20 text-green-400',
    blue: 'bg-blue-500/20 text-blue-400',
    primary: 'bg-primary/20 text-primary',
    red: 'bg-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-4">
      <div className="flex items-start justify-between">
        {icon && (
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
        )}
        {change !== undefined && (
          <span className={`text-sm font-medium ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-gray-400">{label}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
      </div>
    </div>
  )
}

function SecondaryCard({
  label,
  value,
  subtitle,
  alert,
}: {
  label: string
  value: string
  subtitle?: string
  alert?: boolean
}) {
  return (
    <div className={`bg-dark-card border rounded-lg p-4 ${alert ? 'border-red-500/50' : 'border-dark-border'}`}>
      <div className={`text-xl font-bold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  )
}

// ========== CHARTS ==========
function RevenueChart({ growthData }: { growthData: GrowthDataPoint[] }) {
  const maxMrr = Math.max(...growthData.map(g => g.mrr), 1)

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Revenue Trend (MRR)</h3>
      <div className="h-48 flex items-end gap-2">
        {growthData.map((point, index) => {
          const height = (point.mrr / maxMrr) * 100
          return (
            <div key={index} className="flex-1 flex flex-col items-center group">
              <div className="w-full relative">
                <div
                  className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t transition-all hover:from-green-500 hover:to-green-300"
                  style={{ height: `${Math.max(height, 4)}%`, minHeight: '8px' }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {formatCurrency(point.mrr * 100)}
                </div>
              </div>
              <span className="text-[10px] text-gray-500 mt-2 truncate w-full text-center">
                {point.month}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CancellationChart({ data }: { data: { month: string; count: number; revenueLost: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Cancellations Over Time</h3>
      <div className="h-48 flex items-end gap-2">
        {data.map((point, index) => {
          const height = (point.count / maxCount) * 100
          return (
            <div key={index} className="flex-1 flex flex-col items-center group">
              <div className="w-full relative">
                <div
                  className="w-full bg-gradient-to-t from-red-600 to-red-400 rounded-t transition-all hover:from-red-500 hover:to-red-300"
                  style={{ height: `${Math.max(height, 4)}%`, minHeight: point.count > 0 ? '8px' : '4px' }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {point.count} (${point.revenueLost.toFixed(0)} lost)
                </div>
              </div>
              <span className="text-[10px] text-gray-500 mt-2 truncate w-full text-center">
                {point.month}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CustomerChart({ growthData }: { growthData: GrowthDataPoint[] }) {
  const maxCustomers = Math.max(...growthData.map(g => g.totalCustomers), 1)

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Customer Growth</h3>
      <div className="h-48 flex items-end gap-2">
        {growthData.map((point, index) => {
          const height = (point.totalCustomers / maxCustomers) * 100
          return (
            <div key={index} className="flex-1 flex flex-col items-center group">
              <div className="w-full relative flex flex-col-reverse">
                <div
                  className="w-full bg-blue-500 rounded-b transition-all"
                  style={{
                    height: `${maxCustomers > 0 ? (point.individualCount / maxCustomers) * 100 : 0}%`,
                    minHeight: point.individualCount > 0 ? '4px' : '0px'
                  }}
                />
                <div
                  className="w-full bg-primary rounded-t transition-all"
                  style={{
                    height: `${maxCustomers > 0 ? (point.leagueCount / maxCustomers) * 100 : 0}%`,
                    minHeight: point.leagueCount > 0 ? '4px' : '0px'
                  }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {point.totalCustomers}
                </div>
              </div>
              <span className="text-[10px] text-gray-500 mt-2 truncate w-full text-center">
                {point.month}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span className="text-gray-400">Individual</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary" />
          <span className="text-gray-400">League</span>
        </div>
      </div>
    </div>
  )
}

function RevenueBreakdown({ metrics, stripeMetrics }: { metrics: RealRevenueMetrics; stripeMetrics?: StripeMetrics }) {
  const totalMonthly = metrics.individualMRR + metrics.leagueMRR
  const individualPercent = totalMonthly > 0 ? (metrics.individualMRR / totalMonthly) * 100 : 0
  const leaguePercent = totalMonthly > 0 ? (metrics.leagueMRR / totalMonthly) * 100 : 0

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Revenue Breakdown</h3>
      <div className="flex items-center gap-6">
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
            <circle
              cx="18" cy="18" r="15.9155"
              fill="none" stroke="#3b82f6" strokeWidth="3"
              strokeDasharray={`${individualPercent} ${100 - individualPercent}`}
              strokeDashoffset="0"
            />
            <circle
              cx="18" cy="18" r="15.9155"
              fill="none" stroke="#f59e0b" strokeWidth="3"
              strokeDasharray={`${leaguePercent} ${100 - leaguePercent}`}
              strokeDashoffset={-individualPercent}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold">${Math.round(totalMonthly)}</span>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-gray-300">Individual Members</span>
            </div>
            <span className="text-white font-medium">${Math.round(metrics.individualMRR)}/mo</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-gray-300">League Coaches</span>
            </div>
            <span className="text-white font-medium">${Math.round(metrics.leagueMRR)}/mo</span>
          </div>
          <div className="border-t border-dark-border pt-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total MRR</span>
              <span className="text-white font-bold">{formatCurrency(metrics.mrr * 100)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ========== INDIVIDUAL MEMBERS SECTION ==========
function IndividualsSection({ members, subscriptions }: { members: IndividualMember[]; subscriptions?: StripeSubscription[] }) {
  const sortedMembers = [...members].sort((a, b) => b.totalRevenue - a.totalRevenue)
  const totalRevenue = members.reduce((sum, m) => sum + m.totalRevenue, 0)

  const getStripeStatus = (email: string): StripeSubscription | undefined => {
    return subscriptions?.find(s => s.customerEmail?.toLowerCase() === email.toLowerCase())
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Individual Members</h3>
            <p className="text-gray-400 text-sm mt-1">
              Members from INDIVIDUAL/OPERATIONS type organizations paying $20/month
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-400">{members.length}</div>
            <div className="text-sm text-gray-400">Total: ${totalRevenue}</div>
          </div>
        </div>
      </div>

      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white">Member List</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface text-sm">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Name</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Email</th>
                {subscriptions && <th className="px-4 py-3 text-center text-gray-400 font-medium">Status</th>}
                {subscriptions && <th className="px-4 py-3 text-left text-gray-400 font-medium">Coupon</th>}
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Joined</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {sortedMembers.map((member) => {
                const stripeSub = getStripeStatus(member.email)
                return (
                  <tr key={member.id} className="hover:bg-dark-surface">
                    <td className="px-4 py-3 text-white font-medium">{member.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{member.email}</td>
                    {subscriptions && (
                      <td className="px-4 py-3 text-center">
                        {stripeSub ? (
                          <StatusBadge status={stripeSub.status} />
                        ) : (
                          <span className="text-gray-500 text-xs">No subscription</span>
                        )}
                      </td>
                    )}
                    {subscriptions && (
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {stripeSub?.couponName || stripeSub?.couponId || '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-gray-400 text-sm">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      ${member.totalRevenue}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {members.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No individual members found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ========== LEAGUE COACHES SECTION ==========
function LeaguesSection({ coaches, subscriptions }: { coaches: LeagueCoach[]; subscriptions?: StripeSubscription[] }) {
  const sortedCoaches = [...coaches].sort((a, b) => b.totalRevenue - a.totalRevenue)
  const totalRevenue = coaches.reduce((sum, c) => sum + c.totalRevenue, 0)

  const getStripeStatus = (email: string): StripeSubscription | undefined => {
    return subscriptions?.find(s => s.customerEmail?.toLowerCase() === email.toLowerCase())
  }

  return (
    <div className="space-y-6">
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">League Coaches</h3>
            <p className="text-gray-400 text-sm mt-1">Coaches in LEAGUE/ACADEMY type organizations paying $200/season</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{coaches.length}</div>
            <div className="text-sm text-gray-400">Total: ${totalRevenue}</div>
          </div>
        </div>
      </div>

      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white">Coach List</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface text-sm">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Name</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Organization</th>
                {subscriptions && <th className="px-4 py-3 text-center text-gray-400 font-medium">Status</th>}
                {subscriptions && <th className="px-4 py-3 text-left text-gray-400 font-medium">Coupon</th>}
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Joined</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {sortedCoaches.map((coach) => {
                const stripeSub = getStripeStatus(coach.email)
                return (
                  <tr key={coach.id} className="hover:bg-dark-surface">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{coach.name}</div>
                      <div className="text-xs text-gray-500">{coach.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{coach.organizationName}</td>
                    {subscriptions && (
                      <td className="px-4 py-3 text-center">
                        {stripeSub ? (
                          <StatusBadge status={stripeSub.status} />
                        ) : (
                          <span className="text-gray-500 text-xs">No subscription</span>
                        )}
                      </td>
                    )}
                    {subscriptions && (
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {stripeSub?.couponName || stripeSub?.couponId || '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-gray-400 text-sm">
                      {new Date(coach.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      ${coach.totalRevenue}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {coaches.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No league coaches found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: StripeSubscription['status'] }) {
  const styles = {
    active: 'bg-green-500/20 text-green-400',
    past_due: 'bg-orange-500/20 text-orange-400',
    canceled: 'bg-red-500/20 text-red-400',
    trialing: 'bg-blue-500/20 text-blue-400',
    incomplete: 'bg-yellow-500/20 text-yellow-400',
    incomplete_expired: 'bg-red-500/20 text-red-400',
    unpaid: 'bg-red-500/20 text-red-400',
    paused: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <span className={`px-2 py-1 text-xs rounded capitalize ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ========== EXPORT SECTION ==========
function ExportSection({ data, stripeData }: { data: RealRevenueData; stripeData?: RevenueDashboardProps['stripeData'] }) {
  const [exporting, setExporting] = useState<string | null>(null)

  const handleExport = (type: string) => {
    setExporting(type)

    let csvData: string
    let filename: string

    switch (type) {
      case 'individuals':
        csvData = exportToCSV(
          data.individualMembers.map(m => ({
            name: m.name,
            email: m.email,
            joined: new Date(m.joinedAt).toLocaleDateString(),
            months_active: m.monthsActive,
            total_revenue: `$${m.totalRevenue}`,
          })),
          [
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'joined', label: 'Joined' },
            { key: 'months_active', label: 'Months Active' },
            { key: 'total_revenue', label: 'Total Revenue' },
          ]
        )
        filename = 'individual_members.csv'
        break
      case 'leagues':
        csvData = exportToCSV(
          data.leagueCoaches.map(c => ({
            name: c.name,
            email: c.email,
            organization: c.organizationName,
            role: c.role,
            joined: new Date(c.joinedAt).toLocaleDateString(),
            total_revenue: `$${c.totalRevenue}`,
          })),
          [
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'organization', label: 'Organization' },
            { key: 'role', label: 'Role' },
            { key: 'joined', label: 'Joined' },
            { key: 'total_revenue', label: 'Total Revenue' },
          ]
        )
        filename = 'league_coaches.csv'
        break
      default:
        setExporting(null)
        return
    }

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setTimeout(() => setExporting(null), 1000)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Export Data</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <ExportButton
          label="Individual Members"
          onClick={() => handleExport('individuals')}
          isExporting={exporting === 'individuals'}
        />
        <ExportButton
          label="League Coaches"
          onClick={() => handleExport('leagues')}
          isExporting={exporting === 'leagues'}
        />
      </div>
    </div>
  )
}

function ExportButton({ label, onClick, isExporting }: { label: string; onClick: () => void; isExporting: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={isExporting}
      className="flex items-center justify-center gap-2 p-4 bg-dark-card border border-dark-border rounded-lg hover:border-primary/50 transition-colors"
    >
      {isExporting ? (
        <svg className="w-5 h-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
      <span className="text-white">{label}</span>
    </button>
  )
}

// ========== ICONS ==========
function DollarIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function TrendIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

function TrendDownIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  )
}

function CancelIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ChurnIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
