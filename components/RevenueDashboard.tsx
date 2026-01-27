'use client'

import { useState } from 'react'
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

interface RevenueDashboardProps {
  data: RealRevenueData
}

type ActiveTab = 'overview' | 'individuals' | 'leagues' | 'export'

export default function RevenueDashboard({ data }: RevenueDashboardProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
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
          {data.error ? (
            <>Error loading data: {data.error}</>
          ) : (
            <>No customers found. Make sure you have a &quot;Modern Day Coach&quot; organization for individual members, and staff in other organizations for league coaches.</>
          )}
        </p>
      </div>
    )
  }

  const tabs: { id: ActiveTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'individuals', label: 'Individual Members', count: data.individualMembers.length },
    { id: 'leagues', label: 'League Coaches', count: data.leagueCoaches.length },
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
            {tab.count !== undefined && (
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                activeTab === tab.id
                  ? 'bg-black/20'
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
          growthData={data.growthData}
          currentSeason={currentSeason}
          nextSeasonDate={nextSeasonDate}
        />
      )}

      {/* Individual Members Tab */}
      {activeTab === 'individuals' && (
        <IndividualsSection members={data.individualMembers} />
      )}

      {/* League Coaches Tab */}
      {activeTab === 'leagues' && (
        <LeaguesSection coaches={data.leagueCoaches} />
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <ExportSection data={data} />
      )}
    </div>
  )
}

// ========== OVERVIEW SECTION ==========
function OverviewSection({
  metrics,
  growthData,
  currentSeason,
  nextSeasonDate,
}: {
  metrics: RealRevenueMetrics
  growthData: GrowthDataPoint[]
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
          label="Total Customers"
          value={metrics.totalCustomers.toString()}
          change={metrics.userGrowth}
          icon={<UsersIcon />}
          color="primary"
        />
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(metrics.totalRevenue * 100)}
          subtitle="All-time"
          icon={<TrendIcon />}
          color="green"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SecondaryCard
          label="Individual MRR"
          value={formatCurrency(metrics.individualMRR * 100)}
          subtitle={`${metrics.individualMemberCount} @ $20/mo`}
        />
        <SecondaryCard
          label="League MRR"
          value={formatCurrency(metrics.leagueMRR * 100)}
          subtitle={`${metrics.leagueCoachCount} @ $33.33/mo`}
        />
        <SecondaryCard
          label="Modern Day Coach Members"
          value={metrics.individualMemberCount.toString()}
          subtitle="$20/month each"
        />
        <SecondaryCard
          label="League Coaches"
          value={metrics.leagueCoachCount.toString()}
          subtitle="$200/season each"
        />
      </div>

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

      {/* Revenue Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart growthData={growthData} />
        <CustomerChart growthData={growthData} />
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
                {/* Individual members (blue) */}
                <div
                  className="w-full bg-blue-500 rounded-b transition-all"
                  style={{
                    height: `${maxCustomers > 0 ? (point.individualCount / maxCustomers) * 100 : 0}%`,
                    minHeight: point.individualCount > 0 ? '4px' : '0px'
                  }}
                />
                {/* League coaches (amber) */}
                <div
                  className="w-full bg-primary rounded-t transition-all"
                  style={{
                    height: `${maxCustomers > 0 ? (point.leagueCount / maxCustomers) * 100 : 0}%`,
                    minHeight: point.leagueCount > 0 ? '4px' : '0px'
                  }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {point.totalCustomers} ({point.individualCount}+{point.leagueCount})
                </div>
              </div>
              <span className="text-[10px] text-gray-500 mt-2 truncate w-full text-center">
                {point.month}
              </span>
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span className="text-gray-400">Individual Members</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary" />
          <span className="text-gray-400">League Coaches</span>
        </div>
      </div>
    </div>
  )
}

function RevenueBreakdown({ metrics }: { metrics: RealRevenueMetrics }) {
  const totalMonthly = metrics.individualMRR + metrics.leagueMRR
  const individualPercent = totalMonthly > 0 ? (metrics.individualMRR / totalMonthly) * 100 : 0
  const leaguePercent = totalMonthly > 0 ? (metrics.leagueMRR / totalMonthly) * 100 : 0

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
            <span className="text-white font-bold">${Math.round(totalMonthly)}</span>
          </div>
        </div>

        {/* Legend */}
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
function IndividualsSection({ members }: { members: IndividualMember[] }) {
  const sortedMembers = [...members].sort((a, b) => b.totalRevenue - a.totalRevenue)
  const totalRevenue = members.reduce((sum, m) => sum + m.totalRevenue, 0)

  // Group by organization for summary
  const orgGroups = new Map<string, number>()
  members.forEach(m => {
    const orgName = m.organizationName || 'Unknown'
    orgGroups.set(orgName, (orgGroups.get(orgName) || 0) + 1)
  })

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Individual Members</h3>
            <p className="text-gray-400 text-sm mt-1">
              Members from INDIVIDUAL/OPERATIONS type organizations paying $20/month
            </p>
            {orgGroups.size > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {Array.from(orgGroups.entries()).map(([orgName, count]) => (
                  <span key={orgName} className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-300">
                    {orgName}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-400">{members.length}</div>
            <div className="text-sm text-gray-400">Total: ${totalRevenue}</div>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white">Member List</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface text-sm">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Name</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Organization</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Email</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Joined</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Months</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {sortedMembers.map((member) => (
                <tr key={member.id} className="hover:bg-dark-surface">
                  <td className="px-4 py-3 text-white font-medium">{member.name}</td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{member.organizationName || '-'}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{member.email}</td>
                  <td className="px-4 py-3 text-right text-gray-400 text-sm">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-blue-400 font-medium">{member.monthsActive}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    ${member.totalRevenue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {members.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No individual members found. Add members to INDIVIDUAL or OPERATIONS type organizations.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ========== LEAGUE COACHES SECTION ==========
function LeaguesSection({ coaches }: { coaches: LeagueCoach[] }) {
  const sortedCoaches = [...coaches].sort((a, b) => b.totalRevenue - a.totalRevenue)
  const totalRevenue = coaches.reduce((sum, c) => sum + c.totalRevenue, 0)

  // Group by organization
  const orgGroups = new Map<string, LeagueCoach[]>()
  coaches.forEach(coach => {
    const existing = orgGroups.get(coach.organizationName) || []
    existing.push(coach)
    orgGroups.set(coach.organizationName, existing)
  })

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">League Coaches</h3>
            <p className="text-gray-400 text-sm mt-1">Coaches in LEAGUE/ACADEMY type organizations paying $200/season</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{coaches.length}</div>
            <div className="text-sm text-gray-400">
              {orgGroups.size} orgs | Total: ${totalRevenue}
            </div>
          </div>
        </div>
      </div>

      {/* Organization Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from(orgGroups.entries()).slice(0, 8).map(([orgName, orgCoaches]) => (
          <div key={orgName} className="bg-dark-card border border-dark-border rounded-lg p-4">
            <div className="text-lg font-bold text-white">{orgCoaches.length}</div>
            <div className="text-sm text-gray-400 truncate" title={orgName}>{orgName}</div>
            <div className="text-xs text-primary mt-1">
              ${orgCoaches.reduce((sum, c) => sum + c.totalRevenue, 0)} revenue
            </div>
          </div>
        ))}
      </div>

      {/* Coaches Table */}
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
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Role</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Joined</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Seasons</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {sortedCoaches.map((coach) => (
                <tr key={coach.id} className="hover:bg-dark-surface">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{coach.name}</div>
                    <div className="text-xs text-gray-500">{coach.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{coach.organizationName}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded bg-primary/20 text-primary capitalize">
                      {coach.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-sm">
                    {new Date(coach.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-primary font-medium">{coach.seasonsActive}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    ${coach.totalRevenue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {coaches.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No league coaches found. Add staff/coaches to organizations other than &quot;Modern Day Coach&quot;.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ========== EXPORT SECTION ==========
function ExportSection({ data }: { data: RealRevenueData }) {
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
            organization: m.organizationName || '-',
            email: m.email,
            joined: new Date(m.joinedAt).toLocaleDateString(),
            months_active: m.monthsActive,
            total_revenue: `$${m.totalRevenue}`,
          })),
          [
            { key: 'name', label: 'Name' },
            { key: 'organization', label: 'Organization' },
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
            seasons_active: c.seasonsActive,
            total_revenue: `$${c.totalRevenue}`,
          })),
          [
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'organization', label: 'Organization' },
            { key: 'role', label: 'Role' },
            { key: 'joined', label: 'Joined' },
            { key: 'seasons_active', label: 'Seasons Active' },
            { key: 'total_revenue', label: 'Total Revenue' },
          ]
        )
        filename = 'league_coaches.csv'
        break
      case 'all_customers':
        const allCustomers = [
          ...data.individualMembers.map(m => ({
            name: m.name,
            email: m.email,
            type: 'Individual',
            organization: 'Modern Day Coach',
            joined: new Date(m.joinedAt).toLocaleDateString(),
            periods_active: m.monthsActive,
            total_revenue: `$${m.totalRevenue}`,
          })),
          ...data.leagueCoaches.map(c => ({
            name: c.name,
            email: c.email,
            type: 'League Coach',
            organization: c.organizationName,
            joined: new Date(c.joinedAt).toLocaleDateString(),
            periods_active: c.seasonsActive,
            total_revenue: `$${c.totalRevenue}`,
          })),
        ]
        csvData = exportToCSV(
          allCustomers,
          [
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'type', label: 'Type' },
            { key: 'organization', label: 'Organization' },
            { key: 'joined', label: 'Joined' },
            { key: 'periods_active', label: 'Periods Active' },
            { key: 'total_revenue', label: 'Total Revenue' },
          ]
        )
        filename = 'all_customers.csv'
        break
      case 'metrics':
        csvData = exportToCSV(
          data.growthData.map(g => ({
            date: g.date,
            month: g.month,
            mrr: `$${g.mrr.toFixed(2)}`,
            total_customers: g.totalCustomers,
            individual_count: g.individualCount,
            league_count: g.leagueCount,
            individual_revenue: `$${g.individualRevenue}`,
            league_revenue: `$${g.leagueRevenue.toFixed(2)}`,
          })),
          [
            { key: 'date', label: 'Date' },
            { key: 'month', label: 'Month' },
            { key: 'mrr', label: 'MRR' },
            { key: 'total_customers', label: 'Total Customers' },
            { key: 'individual_count', label: 'Individual Count' },
            { key: 'league_count', label: 'League Count' },
            { key: 'individual_revenue', label: 'Individual Revenue' },
            { key: 'league_revenue', label: 'League Revenue' },
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
    { id: 'individuals', label: 'Individual Members', count: data.individualMembers.length, icon: <UsersIcon />, color: 'blue' },
    { id: 'leagues', label: 'League Coaches', count: data.leagueCoaches.length, icon: <TeamIcon />, color: 'primary' },
    { id: 'all_customers', label: 'All Customers', count: data.individualMembers.length + data.leagueCoaches.length, icon: <AllUsersIcon />, color: 'green' },
    { id: 'metrics', label: 'Monthly Metrics', count: data.growthData.length, icon: <CalendarIcon />, color: 'purple' },
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

      {/* Summary Card */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Revenue Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Individual Members (Modern Day Coach)</span>
            <span className="text-white">{data.individualMembers.length} @ $20/mo = ${data.metrics.individualMRR}/mo</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">League Coaches (Other Orgs)</span>
            <span className="text-white">{data.leagueCoaches.length} @ $200/season = ${Math.round(data.metrics.leagueMRR)}/mo</span>
          </div>
          <div className="border-t border-dark-border pt-3 mt-3 flex justify-between font-medium">
            <span className="text-gray-300">Total MRR</span>
            <span className="text-primary">{formatCurrency(data.metrics.mrr * 100)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span className="text-gray-300">Total ARR</span>
            <span className="text-primary">{formatCurrency(data.metrics.arr * 100)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span className="text-gray-300">All-Time Revenue</span>
            <span className="text-green-400">{formatCurrency(data.metrics.totalRevenue * 100)}</span>
          </div>
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

function TrendIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function AllUsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}
