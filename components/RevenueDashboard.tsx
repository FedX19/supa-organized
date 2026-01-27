'use client'

import { useState, useMemo } from 'react'
import {
  RevenueData,
  RevenueMetrics,
  PaymentDue,
  RevenueCancellation,
  RevenueSnapshot,
  calculateRevenueMetrics,
  getPaymentsDue,
  formatCurrency,
  getCurrentSeason,
  getNextSeasonDate,
  exportToCSV,
} from '@/lib/supabase'

interface RevenueDashboardProps {
  data: RevenueData
}

type ActiveTab = 'overview' | 'payments' | 'cancellations' | 'export'

export default function RevenueDashboard({ data }: RevenueDashboardProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')

  const metrics = useMemo(() => calculateRevenueMetrics(data), [data])
  const paymentsDue = useMemo(() => getPaymentsDue(data), [data])
  const currentSeason = getCurrentSeason()
  const nextSeasonDate = getNextSeasonDate()

  if (!data.hasData) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Revenue Data</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          Run the SQL schema from <code className="bg-dark-surface px-2 py-1 rounded text-primary">docs/revenue-schema.sql</code> to set up revenue tracking tables.
        </p>
      </div>
    )
  }

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'payments', label: 'Payments' },
    { id: 'cancellations', label: 'Cancellations' },
    { id: 'export', label: 'Export' },
  ]

  return (
    <div className="space-y-6 animate-fadeIn">
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
            {tab.id === 'payments' && paymentsDue.filter(p => p.status !== 'current').length > 0 && (
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                activeTab === tab.id
                  ? 'bg-black/20'
                  : 'bg-amber-500/20 text-amber-400'
              }`}>
                {paymentsDue.filter(p => p.status !== 'current').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <OverviewSection
          metrics={metrics}
          data={data}
          currentSeason={currentSeason}
          nextSeasonDate={nextSeasonDate}
        />
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <PaymentsSection paymentsDue={paymentsDue} />
      )}

      {/* Cancellations Tab */}
      {activeTab === 'cancellations' && (
        <CancellationsSection cancellations={data.cancellations} />
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <ExportSection data={data} metrics={metrics} />
      )}
    </div>
  )
}

// ========== OVERVIEW SECTION ==========
function OverviewSection({
  metrics,
  data,
  currentSeason,
  nextSeasonDate,
}: {
  metrics: RevenueMetrics
  data: RevenueData
  currentSeason: string
  nextSeasonDate: Date
}) {
  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="MRR"
          value={formatCurrency(metrics.mrr * 100)}
          change={metrics.mrrGrowth}
          icon={<DollarIcon />}
          color="green"
        />
        <MetricCard
          label="ARR"
          value={formatCurrency(metrics.arr * 100)}
          icon={<CalendarIcon />}
          color="blue"
        />
        <MetricCard
          label="Active Subscriptions"
          value={metrics.activeSubscriptions.toString()}
          change={metrics.userGrowth}
          icon={<UsersIcon />}
          color="primary"
        />
        <MetricCard
          label="Churn Rate"
          value={`${metrics.churnRate}%`}
          subtitle={`${metrics.churnedThisMonth} cancelled this month`}
          icon={<ChurnIcon />}
          color={metrics.churnRate > 5 ? 'red' : metrics.churnRate > 2 ? 'yellow' : 'green'}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SecondaryCard
          label="Total Lifetime Revenue"
          value={formatCurrency(metrics.totalRevenue * 100)}
        />
        <SecondaryCard
          label="Individual Members"
          value={metrics.individualCount.toString()}
          subtitle="$20/month each"
        />
        <SecondaryCard
          label="League Coaches"
          value={metrics.leagueCount.toString()}
          subtitle="$200/season each"
        />
        <SecondaryCard
          label="Current Season"
          value={currentSeason.charAt(0).toUpperCase() + currentSeason.slice(1)}
          subtitle={`Next: ${nextSeasonDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
        />
      </div>

      {/* Revenue Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart snapshots={data.snapshots} />
        <CustomerChart snapshots={data.snapshots} />
      </div>

      {/* Revenue Breakdown */}
      <RevenueBreakdown metrics={metrics} />
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
  icon: React.ReactNode
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
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
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
}: {
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-4">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  )
}

// ========== CHARTS ==========
function RevenueChart({ snapshots }: { snapshots: RevenueSnapshot[] }) {
  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  )

  const maxMrr = Math.max(...sortedSnapshots.map(s => s.mrr_cents))

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Revenue Trend (MRR)</h3>
      <div className="h-48 flex items-end gap-2">
        {sortedSnapshots.map((snapshot, index) => {
          const height = maxMrr > 0 ? (snapshot.mrr_cents / maxMrr) * 100 : 0
          const date = new Date(snapshot.snapshot_date)
          const month = date.toLocaleDateString('en-US', { month: 'short' })

          return (
            <div key={snapshot.id} className="flex-1 flex flex-col items-center group">
              <div className="w-full relative">
                <div
                  className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t transition-all hover:from-green-500 hover:to-green-300"
                  style={{ height: `${Math.max(height, 4)}%`, minHeight: '8px' }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {formatCurrency(snapshot.mrr_cents)}
                </div>
              </div>
              <span className="text-[10px] text-gray-500 mt-2 truncate w-full text-center">
                {month}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CustomerChart({ snapshots }: { snapshots: RevenueSnapshot[] }) {
  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  )

  const maxCustomers = Math.max(...sortedSnapshots.map(s => s.total_customers))

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Customer Growth</h3>
      <div className="h-48 flex items-end gap-2">
        {sortedSnapshots.map((snapshot) => {
          const height = maxCustomers > 0 ? (snapshot.total_customers / maxCustomers) * 100 : 0
          const date = new Date(snapshot.snapshot_date)
          const month = date.toLocaleDateString('en-US', { month: 'short' })

          return (
            <div key={snapshot.id} className="flex-1 flex flex-col items-center group">
              <div className="w-full relative">
                <div
                  className="w-full bg-gradient-to-t from-primary to-amber-400 rounded-t transition-all hover:from-amber-500 hover:to-yellow-300"
                  style={{ height: `${Math.max(height, 4)}%`, minHeight: '8px' }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {snapshot.total_customers} customers
                </div>
              </div>
              <span className="text-[10px] text-gray-500 mt-2 truncate w-full text-center">
                {month}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RevenueBreakdown({ metrics }: { metrics: RevenueMetrics }) {
  const individualRevenue = metrics.individualCount * 20
  const leagueRevenue = Math.round(metrics.leagueCount * 33.33) // $200/6 months
  const totalMonthly = individualRevenue + leagueRevenue

  const individualPercent = totalMonthly > 0 ? (individualRevenue / totalMonthly) * 100 : 0
  const leaguePercent = totalMonthly > 0 ? (leagueRevenue / totalMonthly) * 100 : 0

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Revenue Breakdown</h3>
      <div className="flex items-center gap-6">
        {/* Pie chart visualization */}
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
              strokeDasharray={`${individualPercent} ${100 - individualPercent}`}
              strokeDashoffset="0"
            />
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeDasharray={`${leaguePercent} ${100 - leaguePercent}`}
              strokeDashoffset={-individualPercent}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold">${totalMonthly}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-gray-300">Individual Members</span>
            </div>
            <span className="text-white font-medium">${individualRevenue}/mo</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-gray-300">League Coaches</span>
            </div>
            <span className="text-white font-medium">${leagueRevenue}/mo</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ========== PAYMENTS SECTION ==========
function PaymentsSection({ paymentsDue }: { paymentsDue: PaymentDue[] }) {
  const overdue = paymentsDue.filter(p => p.status === 'overdue')
  const atRisk = paymentsDue.filter(p => p.status === 'at_risk')
  const current = paymentsDue.filter(p => p.status === 'current')

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-400">{overdue.length}</div>
          <div className="text-sm text-gray-400">Overdue (35+ days)</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="text-2xl font-bold text-amber-400">{atRisk.length}</div>
          <div className="text-sm text-gray-400">At Risk (30-35 days)</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{current.length}</div>
          <div className="text-sm text-gray-400">Current</div>
        </div>
      </div>

      {/* Overdue Payments */}
      {overdue.length > 0 && (
        <PaymentTable title="Overdue Payments" payments={overdue} type="overdue" />
      )}

      {/* At Risk Payments */}
      {atRisk.length > 0 && (
        <PaymentTable title="At Risk Payments" payments={atRisk} type="at_risk" />
      )}

      {/* Current Payments */}
      <PaymentTable title="Current Payments" payments={current} type="current" />
    </div>
  )
}

function PaymentTable({
  title,
  payments,
  type,
}: {
  title: string
  payments: PaymentDue[]
  type: 'overdue' | 'at_risk' | 'current'
}) {
  const colorClasses = {
    overdue: 'border-red-500/30',
    at_risk: 'border-amber-500/30',
    current: 'border-dark-border',
  }

  return (
    <div className={`bg-dark-card border ${colorClasses[type]} rounded-lg overflow-hidden`}>
      <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
        <h3 className="font-medium text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border bg-dark-surface text-sm">
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Customer</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Type</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium">Amount</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium">Last Payment</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium">Days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {payments.map((payment) => (
              <tr key={payment.customer.id} className="hover:bg-dark-surface">
                <td className="px-4 py-3">
                  <div className="text-white font-medium">{payment.customer.full_name}</div>
                  <div className="text-xs text-gray-500">{payment.customer.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${
                    payment.customer.customer_type === 'league'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {payment.customer.customer_type === 'league' ? 'League' : 'Individual'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-white">
                  ${payment.amountDue}
                </td>
                <td className="px-4 py-3 text-right text-gray-400 text-sm">
                  {payment.lastPaymentDate
                    ? payment.lastPaymentDate.toLocaleDateString()
                    : 'Never'
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-medium ${
                    payment.status === 'overdue' ? 'text-red-400' :
                    payment.status === 'at_risk' ? 'text-amber-400' : 'text-gray-400'
                  }`}>
                    {payment.daysSincePayment === 999 ? '-' : `${payment.daysSincePayment}d`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && (
          <div className="p-8 text-center text-gray-400">No payments in this category</div>
        )}
      </div>
    </div>
  )
}

// ========== CANCELLATIONS SECTION ==========
function CancellationsSection({ cancellations }: { cancellations: RevenueCancellation[] }) {
  const sortedCancellations = [...cancellations].sort(
    (a, b) => new Date(b.cancelled_at).getTime() - new Date(a.cancelled_at).getTime()
  )

  const totalLost = cancellations.reduce((sum, c) => sum + (c.monthly_revenue_lost_cents || 0), 0) / 100

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Cancellation Summary</h3>
            <p className="text-gray-400 text-sm mt-1">Track why customers leave</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-red-400">${totalLost}/mo</div>
            <div className="text-sm text-gray-400">Revenue Lost</div>
          </div>
        </div>
      </div>

      {/* Cancellations Table */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white">Cancellation History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface text-sm">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Date</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Reason</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Monthly Lost</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Lifetime</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Total Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {sortedCancellations.map((cancellation) => (
                <tr key={cancellation.id} className="hover:bg-dark-surface">
                  <td className="px-4 py-3 text-white">
                    {new Date(cancellation.cancelled_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded ${
                      cancellation.reason_category === 'too_expensive' ? 'bg-red-500/20 text-red-400' :
                      cancellation.reason_category === 'not_using' ? 'bg-blue-500/20 text-blue-400' :
                      cancellation.reason_category === 'switching' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {cancellation.reason_category || 'Unknown'}
                    </span>
                    {cancellation.feedback && (
                      <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">{cancellation.feedback}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-red-400">
                    -{formatCurrency(cancellation.monthly_revenue_lost_cents || 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {cancellation.customer_lifetime_days || 0} days
                  </td>
                  <td className="px-4 py-3 text-right text-white">
                    {formatCurrency(cancellation.total_revenue_cents || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cancellations.length === 0 && (
            <div className="p-8 text-center text-gray-400">No cancellations recorded</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ========== EXPORT SECTION ==========
function ExportSection({ data, metrics }: { data: RevenueData; metrics: RevenueMetrics }) {
  const [exporting, setExporting] = useState<string | null>(null)

  const handleExport = (type: string) => {
    setExporting(type)

    let csvData: string
    let filename: string

    switch (type) {
      case 'customers':
        csvData = exportToCSV(
          data.customers.map(c => ({
            full_name: c.full_name,
            email: c.email,
            type: c.customer_type,
            organization: c.organization_name || '-',
            status: c.status,
            joined: new Date(c.created_at).toLocaleDateString(),
          })),
          [
            { key: 'full_name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'type', label: 'Type' },
            { key: 'organization', label: 'Organization' },
            { key: 'status', label: 'Status' },
            { key: 'joined', label: 'Joined' },
          ]
        )
        filename = 'customers.csv'
        break
      case 'payments':
        csvData = exportToCSV(
          data.payments.map(p => {
            const customer = data.customers.find(c => c.id === p.customer_id)
            return {
              customer_name: customer?.full_name || 'Unknown',
              customer_email: customer?.email || '-',
              amount: `$${p.amount_cents / 100}`,
              status: p.status,
              date: new Date(p.payment_date).toLocaleDateString(),
              method: p.payment_method || '-',
            }
          }),
          [
            { key: 'customer_name', label: 'Customer' },
            { key: 'customer_email', label: 'Email' },
            { key: 'amount', label: 'Amount' },
            { key: 'status', label: 'Status' },
            { key: 'date', label: 'Date' },
            { key: 'method', label: 'Method' },
          ]
        )
        filename = 'payments.csv'
        break
      case 'cancellations':
        csvData = exportToCSV(
          data.cancellations.map(c => {
            const customer = data.customers.find(cust => cust.id === c.customer_id)
            return {
              customer_name: customer?.full_name || 'Unknown',
              customer_email: customer?.email || '-',
              cancelled_date: new Date(c.cancelled_at).toLocaleDateString(),
              reason: c.reason_category || '-',
              feedback: c.feedback || '-',
              monthly_lost: `$${(c.monthly_revenue_lost_cents || 0) / 100}`,
              lifetime_days: c.customer_lifetime_days || 0,
              total_paid: `$${(c.total_revenue_cents || 0) / 100}`,
            }
          }),
          [
            { key: 'customer_name', label: 'Customer' },
            { key: 'customer_email', label: 'Email' },
            { key: 'cancelled_date', label: 'Cancelled' },
            { key: 'reason', label: 'Reason' },
            { key: 'feedback', label: 'Feedback' },
            { key: 'monthly_lost', label: 'Monthly Lost' },
            { key: 'lifetime_days', label: 'Lifetime (days)' },
            { key: 'total_paid', label: 'Total Paid' },
          ]
        )
        filename = 'cancellations.csv'
        break
      case 'metrics':
        csvData = exportToCSV(
          data.snapshots.map(s => ({
            date: s.snapshot_date,
            mrr: `$${s.mrr_cents / 100}`,
            arr: `$${s.arr_cents / 100}`,
            total_customers: s.total_customers,
            individual: s.individual_customers,
            league: s.league_customers,
            new_customers: s.new_customers,
            churned: s.churned_customers,
            churn_rate: `${s.churn_rate || 0}%`,
          })),
          [
            { key: 'date', label: 'Date' },
            { key: 'mrr', label: 'MRR' },
            { key: 'arr', label: 'ARR' },
            { key: 'total_customers', label: 'Total Customers' },
            { key: 'individual', label: 'Individual' },
            { key: 'league', label: 'League' },
            { key: 'new_customers', label: 'New' },
            { key: 'churned', label: 'Churned' },
            { key: 'churn_rate', label: 'Churn Rate' },
          ]
        )
        filename = 'revenue_metrics.csv'
        break
      default:
        return
    }

    // Download file
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

  const exportOptions = [
    { id: 'customers', label: 'All Customers', count: data.customers.length, icon: <UsersIcon /> },
    { id: 'payments', label: 'Payment History', count: data.payments.length, icon: <DollarIcon /> },
    { id: 'cancellations', label: 'Cancellations', count: data.cancellations.length, icon: <ChurnIcon /> },
    { id: 'metrics', label: 'Monthly Metrics', count: data.snapshots.length, icon: <CalendarIcon /> },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white">Export Revenue Data</h3>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {exportOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleExport(option.id)}
              disabled={exporting === option.id}
              className="flex items-center gap-3 p-4 bg-dark-surface border border-dark-border rounded-lg hover:border-primary/50 transition-colors text-left disabled:opacity-50"
            >
              <div className="text-gray-400">{option.icon}</div>
              <div className="flex-1">
                <div className="text-white font-medium">{option.label}</div>
                <div className="text-xs text-gray-500">{option.count} records</div>
              </div>
              {exporting === option.id ? (
                <svg className="w-5 h-5 text-green-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ========== ICONS ==========
function DollarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
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
