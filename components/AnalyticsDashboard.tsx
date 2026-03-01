'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  AnalyticsData,
  RawDiagnosticData,
  DateRange,
  Organization,
  ActivityOverview,
  ActivityFeatureUsage,
  ActivityActionUsage,
  ActivityRoleUsage,
  ActivityDailyData,
  ActivityErrorSummary,
  ActivityErrorDetail,
  ActivityDrilldownData,
  ActivityUserDrilldown,
  RefreshActivityResult,
} from '@/lib/supabase'
import { ActivityEvent } from '@/components/UserActivityDetail'

interface AnalyticsDashboardProps {
  analyticsData: AnalyticsData
  rawData: RawDiagnosticData
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
  isLoading: boolean
  onFetchUserActivities?: (profileId: string) => Promise<ActivityEvent[]>
  onRefreshData?: () => Promise<RefreshActivityResult>
  isRefreshing?: boolean
  lastRefreshTime?: Date | null
}

type RangeOption = '7d' | '30d' | 'custom'
type DrilldownType = 'feature' | 'action' | 'user' | null

interface DrilldownState {
  type: DrilldownType
  value: string
  label: string
}

const ROLE_COLORS: Record<string, string> = {
  coach: '#f59e0b',
  parent: '#3b82f6',
  admin: '#10b981',
  staff: '#8b5cf6',
  unknown: '#6b7280',
}

const CHART_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#ec4899']

export default function AnalyticsDashboard({
  rawData,
  dateRange,
  onDateRangeChange,
  isLoading: parentLoading,
  isRefreshing = false,
}: AnalyticsDashboardProps) {
  // State
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [range, setRange] = useState<RangeOption>('7d')
  const [customDateFrom, setCustomDateFrom] = useState<string>('')
  const [customDateTo, setCustomDateTo] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('')

  // Data states
  const [overview, setOverview] = useState<ActivityOverview | null>(null)
  const [features, setFeatures] = useState<ActivityFeatureUsage[]>([])
  const [actions, setActions] = useState<ActivityActionUsage[]>([])
  const [roles, setRoles] = useState<ActivityRoleUsage[]>([])
  const [daily, setDaily] = useState<ActivityDailyData[]>([])
  const [errors, setErrors] = useState<ActivityErrorSummary[]>([])
  const [errorDetails, setErrorDetails] = useState<ActivityErrorDetail[]>([])
  const [showErrorDetails, setShowErrorDetails] = useState(false)

  // Loading states
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [featuresLoading, setFeaturesLoading] = useState(false)
  const [actionsLoading, setActionsLoading] = useState(false)
  const [rolesLoading, setRolesLoading] = useState(false)
  const [dailyLoading, setDailyLoading] = useState(false)
  const [errorsLoading, setErrorsLoading] = useState(false)

  // Error states
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [featuresError, setFeaturesError] = useState<string | null>(null)
  const [actionsError, setActionsError] = useState<string | null>(null)
  const [rolesError, setRolesError] = useState<string | null>(null)
  const [dailyError, setDailyError] = useState<string | null>(null)
  const [errorsError, setErrorsError] = useState<string | null>(null)

  // Drilldown state
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null)
  const [drilldownData, setDrilldownData] = useState<ActivityDrilldownData | ActivityUserDrilldown | null>(null)
  const [drilldownLoading, setDrilldownLoading] = useState(false)

  // Organizations from rawData
  const organizations = useMemo(() => rawData.organizations || [], [rawData.organizations])

  // Set default org when organizations load
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id)
    }
  }, [organizations, selectedOrgId])

  // API fetch helper
  const fetchMetric = useCallback(async (
    metric: string,
    params: Record<string, string> = {}
  ) => {
    const searchParams = new URLSearchParams({
      org_id: selectedOrgId,
      range,
      metric,
      ...params,
    })

    if (range === 'custom' && customDateFrom && customDateTo) {
      searchParams.set('date_from', customDateFrom)
      searchParams.set('date_to', customDateTo)
    }
    if (roleFilter) searchParams.set('role', roleFilter)
    if (eventTypeFilter) searchParams.set('event_type', eventTypeFilter)

    const response = await fetch(`/api/analytics/activity?${searchParams}`, {
      headers: {
        'Authorization': `Bearer ${await getAccessToken()}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch data')
    }

    return response.json()
  }, [selectedOrgId, range, customDateFrom, customDateTo, roleFilter, eventTypeFilter])

  // Get access token
  const getAccessToken = async (): Promise<string> => {
    const { createSupabaseClient } = await import('@/lib/supabase')
    const supabase = createSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  // Load overview data
  const loadOverview = useCallback(async () => {
    if (!selectedOrgId) return
    setOverviewLoading(true)
    setOverviewError(null)
    try {
      const data = await fetchMetric('overview')
      setOverview(data)
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : 'Failed to load overview')
    } finally {
      setOverviewLoading(false)
    }
  }, [selectedOrgId, fetchMetric])

  // Load features data
  const loadFeatures = useCallback(async () => {
    if (!selectedOrgId) return
    setFeaturesLoading(true)
    setFeaturesError(null)
    try {
      const data = await fetchMetric('features')
      setFeatures(data.features || [])
    } catch (error) {
      setFeaturesError(error instanceof Error ? error.message : 'Failed to load features')
    } finally {
      setFeaturesLoading(false)
    }
  }, [selectedOrgId, fetchMetric])

  // Load actions data
  const loadActions = useCallback(async () => {
    if (!selectedOrgId) return
    setActionsLoading(true)
    setActionsError(null)
    try {
      const data = await fetchMetric('actions')
      setActions(data.actions || [])
    } catch (error) {
      setActionsError(error instanceof Error ? error.message : 'Failed to load actions')
    } finally {
      setActionsLoading(false)
    }
  }, [selectedOrgId, fetchMetric])

  // Load roles data
  const loadRoles = useCallback(async () => {
    if (!selectedOrgId) return
    setRolesLoading(true)
    setRolesError(null)
    try {
      const data = await fetchMetric('roles')
      setRoles(data.roles || [])
    } catch (error) {
      setRolesError(error instanceof Error ? error.message : 'Failed to load roles')
    } finally {
      setRolesLoading(false)
    }
  }, [selectedOrgId, fetchMetric])

  // Load daily data
  const loadDaily = useCallback(async () => {
    if (!selectedOrgId) return
    setDailyLoading(true)
    setDailyError(null)
    try {
      const data = await fetchMetric('daily')
      setDaily(data.daily || [])
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Failed to load daily data')
    } finally {
      setDailyLoading(false)
    }
  }, [selectedOrgId, fetchMetric])

  // Load errors data
  const loadErrors = useCallback(async () => {
    if (!selectedOrgId) return
    setErrorsLoading(true)
    setErrorsError(null)
    try {
      const [errorsData, detailsData] = await Promise.all([
        fetchMetric('errors'),
        fetchMetric('error_detail'),
      ])
      setErrors(errorsData.errors || [])
      setErrorDetails(detailsData.error_details || [])
    } catch (error) {
      setErrorsError(error instanceof Error ? error.message : 'Failed to load errors')
    } finally {
      setErrorsLoading(false)
    }
  }, [selectedOrgId, fetchMetric])

  // Load all data when org or filters change
  useEffect(() => {
    if (selectedOrgId) {
      loadOverview()
      loadFeatures()
      loadActions()
      loadRoles()
      loadDaily()
      loadErrors()
    }
  }, [selectedOrgId, range, customDateFrom, customDateTo, roleFilter, eventTypeFilter, loadOverview, loadFeatures, loadActions, loadRoles, loadDaily, loadErrors])

  // Load drilldown data
  const openDrilldown = useCallback(async (type: DrilldownType, value: string, label: string) => {
    setDrilldown({ type, value, label })
    setDrilldownLoading(true)
    setDrilldownData(null)

    try {
      let data
      if (type === 'feature') {
        data = await fetchMetric('drilldown_feature', { feature: value })
      } else if (type === 'action') {
        data = await fetchMetric('drilldown_action', { action: value })
      } else if (type === 'user') {
        data = await fetchMetric('drilldown_user', { profile_id: value })
      }
      setDrilldownData(data)
    } catch (error) {
      console.error('Drilldown error:', error)
    } finally {
      setDrilldownLoading(false)
    }
  }, [fetchMetric])

  const closeDrilldown = useCallback(() => {
    setDrilldown(null)
    setDrilldownData(null)
  }, [])

  // Check if we have any data
  const hasData = overview && (overview.totalEvents7d > 0 || overview.totalEvents30d > 0)

  // Empty state
  if (!parentLoading && !overviewLoading && organizations.length > 0 && selectedOrgId && !hasData && !overviewError) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <Toolbar
          organizations={organizations}
          selectedOrgId={selectedOrgId}
          onOrgChange={setSelectedOrgId}
          range={range}
          onRangeChange={setRange}
          customDateFrom={customDateFrom}
          customDateTo={customDateTo}
          onCustomDateFromChange={setCustomDateFrom}
          onCustomDateToChange={setCustomDateTo}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          eventTypeFilter={eventTypeFilter}
          onEventTypeFilterChange={setEventTypeFilter}
        />
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toolbar */}
      <Toolbar
        organizations={organizations}
        selectedOrgId={selectedOrgId}
        onOrgChange={setSelectedOrgId}
        range={range}
        onRangeChange={setRange}
        customDateFrom={customDateFrom}
        customDateTo={customDateTo}
        onCustomDateFromChange={setCustomDateFrom}
        onCustomDateToChange={setCustomDateTo}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        eventTypeFilter={eventTypeFilter}
        onEventTypeFilterChange={setEventTypeFilter}
      />

      {/* Overview Cards */}
      <OverviewSection
        overview={overview}
        loading={overviewLoading}
        error={overviewError}
        onRetry={loadOverview}
      />

      {/* Daily Activity Chart */}
      <DailyChartSection
        daily={daily}
        loading={dailyLoading}
        error={dailyError}
        onRetry={loadDaily}
      />

      {/* Two Column Row: Features + Roles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FeaturesSection
          features={features}
          loading={featuresLoading}
          error={featuresError}
          onRetry={loadFeatures}
          onFeatureClick={(feature) => openDrilldown('feature', feature, feature)}
        />
        <RolesSection
          roles={roles}
          loading={rolesLoading}
          error={rolesError}
          onRetry={loadRoles}
        />
      </div>

      {/* Actions Table */}
      <ActionsSection
        actions={actions}
        loading={actionsLoading}
        error={actionsError}
        onRetry={loadActions}
        onActionClick={(action) => openDrilldown('action', action, action)}
      />

      {/* Error Dashboard */}
      <ErrorsSection
        errors={errors}
        errorDetails={errorDetails}
        showDetails={showErrorDetails}
        onToggleDetails={() => setShowErrorDetails(!showErrorDetails)}
        loading={errorsLoading}
        error={errorsError}
        onRetry={loadErrors}
        totalErrors={overview?.errors7d || 0}
        errorRate={overview?.errorRate7d || '0'}
      />

      {/* Drilldown Panel */}
      {drilldown && (
        <DrilldownPanel
          drilldown={drilldown}
          data={drilldownData}
          loading={drilldownLoading}
          onClose={closeDrilldown}
          onUserClick={(profileId, name) => openDrilldown('user', profileId, name)}
        />
      )}
    </div>
  )
}

// ========== TOOLBAR ==========
function Toolbar({
  organizations,
  selectedOrgId,
  onOrgChange,
  range,
  onRangeChange,
  customDateFrom,
  customDateTo,
  onCustomDateFromChange,
  onCustomDateToChange,
  roleFilter,
  onRoleFilterChange,
  eventTypeFilter,
  onEventTypeFilterChange,
}: {
  organizations: Organization[]
  selectedOrgId: string
  onOrgChange: (id: string) => void
  range: RangeOption
  onRangeChange: (range: RangeOption) => void
  customDateFrom: string
  customDateTo: string
  onCustomDateFromChange: (date: string) => void
  onCustomDateToChange: (date: string) => void
  roleFilter: string
  onRoleFilterChange: (role: string) => void
  eventTypeFilter: string
  onEventTypeFilterChange: (type: string) => void
}) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Org Selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Organization:</label>
          <select
            value={selectedOrgId}
            onChange={(e) => onOrgChange(e.target.value)}
            className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1 bg-background rounded-lg p-1">
          {(['7d', '30d', 'custom'] as RangeOption[]).map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                range === r
                  ? 'bg-primary text-black'
                  : 'text-gray-400 hover:text-white hover:bg-card-hover'
              }`}
            >
              {r === 'custom' ? 'Custom' : r}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs */}
        {range === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => onCustomDateFromChange(e.target.value)}
              className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => onCustomDateToChange(e.target.value)}
              className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {/* Role Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Role:</label>
          <select
            value={roleFilter}
            onChange={(e) => onRoleFilterChange(e.target.value)}
            className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Roles</option>
            <option value="coach">Coach</option>
            <option value="parent">Parent</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </div>

        {/* Event Type Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Event:</label>
          <select
            value={eventTypeFilter}
            onChange={(e) => onEventTypeFilterChange(e.target.value)}
            className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Types</option>
            <option value="context_loaded">Context Loaded</option>
            <option value="feature_used">Feature Used</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>
    </div>
  )
}

// ========== EMPTY STATE ==========
function EmptyState() {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-12 text-center">
      <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h3 className="text-2xl font-bold text-white mb-3">No Activity Data Yet</h3>
      <p className="text-gray-400 mb-6 max-w-lg mx-auto">
        Activity events will appear here once UniteHQ starts writing to the{' '}
        <code className="bg-background px-2 py-0.5 rounded text-primary">public.user_activity</code> table.
      </p>
      <div className="bg-background rounded-lg p-4 max-w-md mx-auto text-left">
        <p className="text-sm text-gray-400 mb-2">Expected event types:</p>
        <ul className="text-sm space-y-1">
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <code className="text-green-400">context_loaded</code>
            <span className="text-gray-500">- Page/view loaded</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
            <code className="text-blue-400">feature_used</code>
            <span className="text-gray-500">- Feature interaction</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-400 rounded-full"></span>
            <code className="text-red-400">error</code>
            <span className="text-gray-500">- Error occurred</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

// ========== OVERVIEW SECTION ==========
function OverviewSection({
  overview,
  loading,
  error,
  onRetry,
}: {
  overview: ActivityOverview | null
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (error) {
    return <ErrorCard message={error} onRetry={onRetry} />
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <MetricCard
        label="Active Users (7d)"
        value={overview?.activeUsers7d ?? '-'}
        loading={loading}
        color="primary"
      />
      <MetricCard
        label="Active Users (30d)"
        value={overview?.activeUsers30d ?? '-'}
        loading={loading}
        color="blue"
      />
      <MetricCard
        label="Total Events"
        value={overview?.totalEvents7d ?? '-'}
        loading={loading}
        color="green"
      />
      <MetricCard
        label="Total Errors"
        value={overview?.errors7d ?? '-'}
        loading={loading}
        color="red"
      />
      <MetricCard
        label="Error Rate"
        value={overview ? `${overview.errorRate7d}%` : '-'}
        loading={loading}
        color="orange"
      />
      <MetricCard
        label="Avg Events/User"
        value={overview?.avgEventsPerUser7d ?? '-'}
        loading={loading}
        color="purple"
      />
    </div>
  )
}

function MetricCard({
  label,
  value,
  loading,
  color,
}: {
  label: string
  value: string | number
  loading: boolean
  color: 'primary' | 'blue' | 'green' | 'red' | 'orange' | 'purple'
}) {
  const colorClasses = {
    primary: 'border-primary/30 text-primary',
    blue: 'border-blue-500/30 text-blue-400',
    green: 'border-green-500/30 text-green-400',
    red: 'border-red-500/30 text-red-400',
    orange: 'border-orange-500/30 text-orange-400',
    purple: 'border-purple-500/30 text-purple-400',
  }

  return (
    <div className={`bg-dark-card border ${colorClasses[color]} rounded-lg p-4`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {loading ? (
        <div className="h-8 bg-gray-700 rounded animate-pulse"></div>
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
    </div>
  )
}

// ========== DAILY CHART SECTION ==========
function DailyChartSection({
  daily,
  loading,
  error,
  onRetry,
}: {
  daily: ActivityDailyData[]
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (error) {
    return <ErrorCard message={error} onRetry={onRetry} />
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-bold text-white mb-4">Daily Activity</h3>
      {loading ? (
        <div className="h-64 bg-gray-700/50 rounded animate-pulse"></div>
      ) : daily.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          No daily data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={256}>
          <AreaChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#fff' }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="total_events"
              name="Total Events"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.3}
            />
            <Area
              type="monotone"
              dataKey="error_events"
              name="Errors"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ========== FEATURES SECTION ==========
function FeaturesSection({
  features,
  loading,
  error,
  onRetry,
  onFeatureClick,
}: {
  features: ActivityFeatureUsage[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onFeatureClick: (feature: string) => void
}) {
  if (error) {
    return <ErrorCard message={error} onRetry={onRetry} />
  }

  const chartData = features.slice(0, 10).map((f) => ({
    name: f.feature,
    events: f.event_count,
  }))

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-bold text-white mb-4">Favorite Features</h3>
      {loading ? (
        <div className="space-y-4">
          <div className="h-48 bg-gray-700/50 rounded animate-pulse"></div>
          <div className="h-32 bg-gray-700/50 rounded animate-pulse"></div>
        </div>
      ) : features.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-gray-400">
          No feature data available
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" />
              <YAxis type="category" dataKey="name" stroke="#9ca3af" width={100} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              />
              <Bar dataKey="events" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-dark-border">
                  <th className="text-left py-2">Feature</th>
                  <th className="text-right py-2">Events</th>
                  <th className="text-right py-2">Users</th>
                  <th className="text-right py-2">Coaches</th>
                  <th className="text-right py-2">Parents</th>
                </tr>
              </thead>
              <tbody>
                {features.slice(0, 10).map((f) => (
                  <tr
                    key={f.feature}
                    onClick={() => onFeatureClick(f.feature)}
                    className="border-b border-dark-border/50 hover:bg-card-hover cursor-pointer transition-colors"
                  >
                    <td className="py-2 text-white">{f.feature}</td>
                    <td className="py-2 text-right text-primary">{f.event_count}</td>
                    <td className="py-2 text-right text-gray-400">{f.unique_users}</td>
                    <td className="py-2 text-right text-gray-400">{f.by_role.coach}</td>
                    <td className="py-2 text-right text-gray-400">{f.by_role.parent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ========== ROLES SECTION ==========
function RolesSection({
  roles,
  loading,
  error,
  onRetry,
}: {
  roles: ActivityRoleUsage[]
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (error) {
    return <ErrorCard message={error} onRetry={onRetry} />
  }

  const pieData = roles.map((r) => ({
    name: r.viewer_role,
    value: r.event_count,
  }))

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-bold text-white mb-4">Role Breakdown</h3>
      {loading ? (
        <div className="space-y-4">
          <div className="h-48 bg-gray-700/50 rounded animate-pulse"></div>
          <div className="h-32 bg-gray-700/50 rounded animate-pulse"></div>
        </div>
      ) : roles.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-gray-400">
          No role data available
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={ROLE_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-dark-border">
                  <th className="text-left py-2">Role</th>
                  <th className="text-right py-2">Events</th>
                  <th className="text-right py-2">Users</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.viewer_role} className="border-b border-dark-border/50">
                    <td className="py-2">
                      <span
                        className="inline-flex items-center gap-2"
                        style={{ color: ROLE_COLORS[r.viewer_role] || '#9ca3af' }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: ROLE_COLORS[r.viewer_role] || '#9ca3af' }}
                        ></span>
                        {r.viewer_role}
                      </span>
                    </td>
                    <td className="py-2 text-right text-white">{r.event_count}</td>
                    <td className="py-2 text-right text-gray-400">{r.unique_users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ========== ACTIONS SECTION ==========
function ActionsSection({
  actions,
  loading,
  error,
  onRetry,
  onActionClick,
}: {
  actions: ActivityActionUsage[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onActionClick: (action: string) => void
}) {
  if (error) {
    return <ErrorCard message={error} onRetry={onRetry} />
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-bold text-white mb-4">Top Actions</h3>
      {loading ? (
        <div className="h-48 bg-gray-700/50 rounded animate-pulse"></div>
      ) : actions.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-gray-400">
          No action data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-dark-border">
                <th className="text-left py-2">Action</th>
                <th className="text-right py-2">Events</th>
                <th className="text-right py-2">Unique Users</th>
                <th className="text-right py-2">Errors</th>
                <th className="text-right py-2">Error Rate</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => {
                const errorRate = a.event_count > 0 ? ((a.error_count / a.event_count) * 100).toFixed(1) : '0.0'
                return (
                  <tr
                    key={a.action}
                    onClick={() => onActionClick(a.action)}
                    className="border-b border-dark-border/50 hover:bg-card-hover cursor-pointer transition-colors"
                  >
                    <td className="py-2 text-white">{a.action}</td>
                    <td className="py-2 text-right text-primary">{a.event_count}</td>
                    <td className="py-2 text-right text-gray-400">{a.unique_users}</td>
                    <td className="py-2 text-right text-red-400">{a.error_count}</td>
                    <td className="py-2 text-right">
                      <span className={parseFloat(errorRate) > 5 ? 'text-red-400' : 'text-gray-400'}>
                        {errorRate}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ========== ERRORS SECTION ==========
function ErrorsSection({
  errors,
  errorDetails,
  showDetails,
  onToggleDetails,
  loading,
  error,
  onRetry,
  totalErrors,
  errorRate,
}: {
  errors: ActivityErrorSummary[]
  errorDetails: ActivityErrorDetail[]
  showDetails: boolean
  onToggleDetails: () => void
  loading: boolean
  error: string | null
  onRetry: () => void
  totalErrors: number
  errorRate: string
}) {
  if (error) {
    return <ErrorCard message={error} onRetry={onRetry} />
  }

  const featuresAffected = new Set(errors.map((e) => e.feature)).size
  const mostCommonError = errors[0]?.error_code || '-'

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-bold text-white mb-4">Error Dashboard</h3>
      {loading ? (
        <div className="space-y-4">
          <div className="h-24 bg-gray-700/50 rounded animate-pulse"></div>
          <div className="h-48 bg-gray-700/50 rounded animate-pulse"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-gray-400">Total Errors</p>
              <p className="text-xl font-bold text-red-400">{totalErrors}</p>
            </div>
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-gray-400">Error Rate</p>
              <p className="text-xl font-bold text-orange-400">{errorRate}%</p>
            </div>
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-gray-400">Features Affected</p>
              <p className="text-xl font-bold text-yellow-400">{featuresAffected}</p>
            </div>
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-gray-400">Most Common</p>
              <p className="text-xl font-bold text-purple-400 truncate">{mostCommonError}</p>
            </div>
          </div>

          {/* Errors Table */}
          {errors.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No errors in the selected time range
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-dark-border">
                    <th className="text-left py-2">Feature</th>
                    <th className="text-left py-2">Error Code</th>
                    <th className="text-right py-2">Count</th>
                    <th className="text-right py-2">Users</th>
                    <th className="text-right py-2">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.slice(0, 10).map((e, i) => (
                    <tr key={`${e.feature}-${e.error_code}-${i}`} className="border-b border-dark-border/50">
                      <td className="py-2 text-white">{e.feature}</td>
                      <td className="py-2 text-red-400">{e.error_code}</td>
                      <td className="py-2 text-right text-white">{e.count}</td>
                      <td className="py-2 text-right text-gray-400">{e.unique_users}</td>
                      <td className="py-2 text-right text-gray-400">
                        {new Date(e.last_seen).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* View Recent Errors Button */}
          <button
            onClick={onToggleDetails}
            className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            {showDetails ? 'Hide Recent Errors' : 'View Recent Errors'}
          </button>

          {/* Error Details */}
          {showDetails && errorDetails.length > 0 && (
            <div className="mt-4 max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-dark-card">
                  <tr className="text-gray-400 border-b border-dark-border">
                    <th className="text-left py-2">Timestamp</th>
                    <th className="text-left py-2">Feature</th>
                    <th className="text-left py-2">Action</th>
                    <th className="text-left py-2">Error Code</th>
                    <th className="text-right py-2">Status</th>
                    <th className="text-left py-2">Route</th>
                  </tr>
                </thead>
                <tbody>
                  {errorDetails.map((e, i) => (
                    <tr key={`${e.timestamp}-${i}`} className="border-b border-dark-border/50">
                      <td className="py-1.5 text-gray-400">
                        {new Date(e.timestamp).toLocaleString()}
                      </td>
                      <td className="py-1.5 text-white">{e.feature}</td>
                      <td className="py-1.5 text-gray-400">{e.action || '-'}</td>
                      <td className="py-1.5 text-red-400">{e.error_code}</td>
                      <td className="py-1.5 text-right text-orange-400">{e.http_status || '-'}</td>
                      <td className="py-1.5 text-gray-500 truncate max-w-32">{e.route || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ========== DRILLDOWN PANEL ==========
function DrilldownPanel({
  drilldown,
  data,
  loading,
  onClose,
  onUserClick,
}: {
  drilldown: DrilldownState
  data: ActivityDrilldownData | ActivityUserDrilldown | null
  loading: boolean
  onClose: () => void
  onUserClick: (profileId: string, name: string) => void
}) {
  const isUserDrilldown = drilldown.type === 'user'
  const userData = isUserDrilldown ? (data as ActivityUserDrilldown) : null
  const featureActionData = !isUserDrilldown ? (data as ActivityDrilldownData) : null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-card border border-dark-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h3 className="text-lg font-bold text-white">
            Drilldown: {drilldown.label}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-4">
              <div className="h-32 bg-gray-700/50 rounded animate-pulse"></div>
              <div className="h-64 bg-gray-700/50 rounded animate-pulse"></div>
            </div>
          ) : isUserDrilldown && userData ? (
            // User Drilldown
            <div className="space-y-6">
              <div className="bg-background rounded-lg p-4">
                <h4 className="text-sm text-gray-400 mb-2">User Info</h4>
                <p className="text-white font-medium">{userData.profile?.full_name || 'Unknown'}</p>
                <p className="text-gray-400 text-sm">{userData.profile?.email || '-'}</p>
              </div>
              <div>
                <h4 className="text-sm text-gray-400 mb-2">Recent Events ({userData.events.length})</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {userData.events.map((e, i) => (
                    <div key={`${e.timestamp}-${i}`} className="bg-background rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className={e.event_type === 'error' ? 'text-red-400' : 'text-green-400'}>
                          {e.event_type}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {new Date(e.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-white">{e.feature}</div>
                      {e.action && <div className="text-gray-400 text-xs">Action: {e.action}</div>}
                      {e.error_code && <div className="text-red-400 text-xs">Error: {e.error_code}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : featureActionData ? (
            // Feature/Action Drilldown
            <div className="space-y-6">
              <div>
                <h4 className="text-sm text-gray-400 mb-2">Top Users</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-dark-border">
                        <th className="text-left py-2">#</th>
                        <th className="text-left py-2">Name</th>
                        <th className="text-left py-2">Email</th>
                        <th className="text-right py-2">Events</th>
                      </tr>
                    </thead>
                    <tbody>
                      {featureActionData.top_users.map((u, i) => (
                        <tr
                          key={u.profile_id}
                          onClick={() => onUserClick(u.profile_id, u.full_name)}
                          className="border-b border-dark-border/50 hover:bg-card-hover cursor-pointer transition-colors"
                        >
                          <td className="py-2 text-gray-400">{i + 1}</td>
                          <td className="py-2 text-white">{u.full_name}</td>
                          <td className="py-2 text-gray-400">{u.email || '-'}</td>
                          <td className="py-2 text-right text-primary">{u.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h4 className="text-sm text-gray-400 mb-2">Recent Events</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {featureActionData.recent_events.map((e, i) => (
                    <div key={`${e.timestamp}-${i}`} className="bg-background rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className={e.event_type === 'error' ? 'text-red-400' : 'text-green-400'}>
                          {e.event_type}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {new Date(e.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{e.viewer_role || 'unknown'}</span>
                        {e.route && <span className="truncate max-w-48">{e.route}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">No data available</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ========== ERROR CARD ==========
function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-red-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{message}</span>
        </div>
        <button
          onClick={onRetry}
          className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
