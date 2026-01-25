'use client'

import { useState, useMemo } from 'react'
import {
  AnalyticsData,
  AnalyticsSummary,
  RawDiagnosticData,
  DateRange,
  generateAnalyticsSummary,
  UserEngagement,
  exportToCSV,
} from '@/lib/supabase'

interface AnalyticsDashboardProps {
  analyticsData: AnalyticsData
  rawData: RawDiagnosticData
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
  isLoading: boolean
}

export default function AnalyticsDashboard({
  analyticsData,
  rawData,
  dateRange,
  onDateRangeChange,
  isLoading,
}: AnalyticsDashboardProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'orgs' | 'features' | 'dormant'>('overview')

  const summary = useMemo(() => {
    if (!analyticsData.hasTable || analyticsData.activities.length === 0) {
      return null
    }
    return generateAnalyticsSummary(analyticsData.activities, rawData, dateRange)
  }, [analyticsData, rawData, dateRange])

  const dateRangeOptions: { value: DateRange; label: string }[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ]

  const handleExportUsers = () => {
    if (!summary) return
    const csvData = exportToCSV(
      summary.topUsers.map(u => ({
        name: u.name,
        email: u.email,
        totalEvents: u.totalEvents,
        lastActive: u.lastActive?.toISOString() || 'Never',
        engagementLevel: u.engagementLevel,
      })),
      [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'totalEvents', label: 'Total Events' },
        { key: 'lastActive', label: 'Last Active' },
        { key: 'engagementLevel', label: 'Engagement Level' },
      ]
    )
    downloadCSV(csvData, 'user_engagement.csv')
  }

  const handleExportDormant = () => {
    if (!summary) return
    const csvData = exportToCSV(
      summary.dormantUsersList.map(u => ({
        name: u.name,
        email: u.email,
        lastActive: u.lastActive?.toISOString() || 'Never',
      })),
      [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'lastActive', label: 'Last Active' },
      ]
    )
    downloadCSV(csvData, 'dormant_users.csv')
  }

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Loading state
  if (isLoading) {
    return <AnalyticsSkeleton />
  }

  // Table doesn&apos;t exist
  if (!analyticsData.hasTable) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Analytics Table Not Found</h3>
          <p className="text-gray-400 mb-4 max-w-md mx-auto">
            The <code className="bg-dark-surface px-2 py-1 rounded text-primary">user_activity</code> table
            does not exist in your database yet.
          </p>
          <div className="bg-dark-surface rounded-lg p-4 max-w-lg mx-auto text-left">
            <p className="text-sm text-gray-400 mb-2">Create it with this SQL:</p>
            <pre className="text-xs text-green-400 font-mono overflow-x-auto">
{`CREATE TABLE user_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  organization_id UUID REFERENCES organizations(id),
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_user_activity_profile
  ON user_activity(profile_id);
CREATE INDEX idx_user_activity_timestamp
  ON user_activity(timestamp);`}
            </pre>
          </div>
        </div>
      </div>
    )
  }

  // No activity data
  if (analyticsData.activities.length === 0) {
    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Date Range Filter */}
        <div className="flex justify-end">
          <DateRangeSelector value={dateRange} onChange={onDateRangeChange} options={dateRangeOptions} />
        </div>

        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Activity Data Yet</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            The user_activity table exists but has no records for the selected time period.
            Activity data will appear here once users start interacting with your app.
          </p>
        </div>
      </div>
    )
  }

  // Main analytics view
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header with Date Range */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['overview', 'users', 'orgs', 'features', 'dormant'] as const).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                activeSection === section
                  ? 'bg-primary text-black'
                  : 'bg-dark-card border border-dark-border text-gray-400 hover:text-white'
              }`}
            >
              {section}
              {section === 'dormant' && summary && summary.dormantUsers > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  activeSection === section ? 'bg-black/20' : 'bg-red-500/20 text-red-400'
                }`}>
                  {summary.dormantUsers}
                </span>
              )}
            </button>
          ))}
        </div>
        <DateRangeSelector value={dateRange} onChange={onDateRangeChange} options={dateRangeOptions} />
      </div>

      {summary && (
        <>
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <OverviewSection summary={summary} />
          )}

          {/* Top Users Section */}
          {activeSection === 'users' && (
            <UsersSection users={summary.topUsers} onExport={handleExportUsers} />
          )}

          {/* Org Engagement Section */}
          {activeSection === 'orgs' && (
            <OrgsSection orgs={summary.orgEngagement} />
          )}

          {/* Feature Usage Section */}
          {activeSection === 'features' && (
            <FeaturesSection features={summary.topFeatures} />
          )}

          {/* Dormant Users Section */}
          {activeSection === 'dormant' && (
            <DormantSection users={summary.dormantUsersList} onExport={handleExportDormant} />
          )}
        </>
      )}
    </div>
  )
}

// Date Range Selector
function DateRangeSelector({
  value,
  onChange,
  options,
}: {
  value: DateRange
  onChange: (value: DateRange) => void
  options: { value: DateRange; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as DateRange)}
      className="bg-dark-card border border-dark-border text-white rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

// Overview Section
function OverviewSection({ summary }: { summary: AnalyticsSummary }) {
  return (
    <div className="space-y-6">
      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Events"
          value={summary.totalEvents.toLocaleString()}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
          color="primary"
        />
        <StatCard
          label="Active Users"
          value={summary.totalActiveUsers.toLocaleString()}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          color="green"
        />
        <StatCard
          label="Engagement Rate"
          value={`${summary.engagementRate}%`}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          color="blue"
        />
        <StatCard
          label="Dormant Users"
          value={summary.dormantUsers.toLocaleString()}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
          color="red"
        />
      </div>

      {/* Engagement Breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Engagement Breakdown</h3>
          <div className="space-y-3">
            <EngagementBar label="High" count={summary.highEngagement} total={summary.totalActiveUsers + summary.dormantUsers} color="green" />
            <EngagementBar label="Medium" count={summary.mediumEngagement} total={summary.totalActiveUsers + summary.dormantUsers} color="yellow" />
            <EngagementBar label="Low" count={summary.lowEngagement} total={summary.totalActiveUsers + summary.dormantUsers} color="orange" />
            <EngagementBar label="Dormant" count={summary.dormantUsers} total={summary.totalActiveUsers + summary.dormantUsers} color="red" />
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top Features</h3>
          <div className="space-y-3">
            {summary.topFeatures.slice(0, 5).map((feature) => (
              <div key={feature.eventType} className="flex items-center justify-between">
                <span className="text-gray-300 truncate flex-1">{formatEventType(feature.eventType)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">{feature.count.toLocaleString()}</span>
                  <span className="text-gray-500 text-sm w-12 text-right">{feature.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Users Section
function UsersSection({ users, onExport }: { users: UserEngagement[]; onExport: () => void }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-dark-border bg-dark-surface flex items-center justify-between">
        <h3 className="font-medium text-white">Most Active Users</h3>
        <button
          onClick={onExport}
          className="px-3 py-1 bg-primary/20 text-primary text-sm rounded hover:bg-primary/30 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border bg-dark-surface">
              <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">User</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium text-sm">Events</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium text-sm">Last Active</th>
              <th className="px-4 py-3 text-center text-gray-400 font-medium text-sm">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {users.map((user) => (
              <tr key={user.profileId} className="hover:bg-dark-surface">
                <td className="px-4 py-3">
                  <div className="text-white font-medium">{user.name}</div>
                  <div className="text-gray-500 text-sm">{user.email}</div>
                </td>
                <td className="px-4 py-3 text-right text-white">{user.totalEvents.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-400 text-sm">
                  {user.lastActive ? formatRelativeTime(user.lastActive) : 'Never'}
                </td>
                <td className="px-4 py-3 text-center">
                  <EngagementBadge level={user.engagementLevel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Orgs Section
function OrgsSection({ orgs }: { orgs: AnalyticsSummary['orgEngagement'] }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
        <h3 className="font-medium text-white">Organization Engagement</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border bg-dark-surface">
              <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Organization</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium text-sm">Total Events</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium text-sm">Active Users</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium text-sm">Avg Events/User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {orgs.map((org) => (
              <tr key={org.orgId} className="hover:bg-dark-surface">
                <td className="px-4 py-3 text-white font-medium">{org.orgName}</td>
                <td className="px-4 py-3 text-right text-white">{org.totalEvents.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-400">{org.activeUsers}</td>
                <td className="px-4 py-3 text-right text-gray-400">{org.avgEventsPerUser}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orgs.length === 0 && (
          <div className="p-8 text-center text-gray-400">No organization-specific activity data</div>
        )}
      </div>
    </div>
  )
}

// Features Section
function FeaturesSection({ features }: { features: AnalyticsSummary['topFeatures'] }) {
  const maxCount = Math.max(...features.map(f => f.count), 1)

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
        <h3 className="font-medium text-white">Feature Usage Breakdown</h3>
      </div>
      <div className="p-4 space-y-4">
        {features.map((feature) => (
          <div key={feature.eventType}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-300">{formatEventType(feature.eventType)}</span>
              <span className="text-white font-medium">{feature.count.toLocaleString()} ({feature.percentage}%)</span>
            </div>
            <div className="h-3 bg-dark-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-amber-400 rounded-full transition-all"
                style={{ width: `${(feature.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {features.length === 0 && (
          <div className="p-8 text-center text-gray-400">No feature usage data</div>
        )}
      </div>
    </div>
  )
}

// Dormant Section
function DormantSection({ users, onExport }: { users: UserEngagement[]; onExport: () => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-4">
        <div className="w-12 h-12 bg-red-500/30 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </div>
        <div>
          <h3 className="text-white font-semibold">{users.length} Dormant Users</h3>
          <p className="text-gray-400 text-sm">Users with no activity in the last 30 days</p>
        </div>
        <button
          onClick={onExport}
          className="ml-auto px-4 py-2 bg-primary hover:bg-primary-hover text-black font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export List
        </button>
      </div>

      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface">
                <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">User</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium text-sm">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {users.map((user) => (
                <tr key={user.profileId} className="hover:bg-dark-surface">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{user.name}</div>
                    <div className="text-gray-500 text-sm">{user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-sm">
                    {user.lastActive ? formatRelativeTime(user.lastActive) : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="p-8 text-center text-gray-400">No dormant users found</div>
          )}
        </div>
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: 'primary' | 'green' | 'blue' | 'red'
}) {
  const colorClasses = {
    primary: 'bg-primary/20 text-primary',
    green: 'bg-green-500/20 text-green-400',
    blue: 'bg-blue-500/20 text-blue-400',
    red: 'bg-red-500/20 text-red-400',
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-sm text-gray-400">{label}</div>
        </div>
      </div>
    </div>
  )
}

// Engagement Bar
function EngagementBar({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: 'green' | 'yellow' | 'orange' | 'red'
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0
  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-400 text-sm">{label}</span>
        <span className="text-white font-medium">{count}</span>
      </div>
      <div className="h-2 bg-dark-surface rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// Engagement Badge
function EngagementBadge({ level }: { level: UserEngagement['engagementLevel'] }) {
  const styles = {
    high: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-orange-500/20 text-orange-400',
    dormant: 'bg-red-500/20 text-red-400',
  }

  return (
    <span className={`px-2 py-1 text-xs rounded-full capitalize ${styles[level]}`}>
      {level}
    </span>
  )
}

// Helper: Format event type for display
function formatEventType(eventType: string): string {
  return eventType
    .replace(/_/g, ' ')
    .replace(/\./g, ' > ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Helper: Format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// Analytics Skeleton
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-end">
        <div className="h-10 w-40 bg-dark-card rounded-lg" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-dark-card border border-dark-border rounded-lg p-4 h-24" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-dark-card border border-dark-border rounded-lg h-64" />
        <div className="bg-dark-card border border-dark-border rounded-lg h-64" />
      </div>
    </div>
  )
}
