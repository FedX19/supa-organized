'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  createSupabaseClient,
  createCustomerSupabaseClient,
  fetchOrganizationCards,
  fetchOrganizationDetail,
  fetchRawDiagnosticData,
  getIssueSummary,
  OrganizationCard,
  OrganizationDetail,
  UserConnection,
  RawDiagnosticData,
  UserProfile,
  UserPermissionDiagnostic,
} from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { StatCard } from '@/components/StatCard'
import { OrgCard, OrgCardSkeleton } from '@/components/OrgCard'
import { OrgDetailView, OrgDetailSkeleton } from '@/components/OrgDetail'
import UserSearch, { UserSearchSkeleton } from '@/components/UserSearch'
import UserProfileView from '@/components/UserProfileView'
import PermissionDiagnostic from '@/components/PermissionDiagnostic'
import RelationshipViewer from '@/components/RelationshipViewer'
import IssueDashboard from '@/components/IssueDashboard'
import ExportTools from '@/components/ExportTools'

type Tab = 'organizations' | 'users' | 'issues' | 'relationships' | 'export'
type OrgView = 'grid' | 'detail'
type UserView = 'search' | 'profile' | 'diagnostic'

const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
  {
    id: 'organizations',
    label: 'Organizations',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Users',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    id: 'issues',
    label: 'Issues',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    id: 'relationships',
    label: 'Schema',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
  },
  {
    id: 'export',
    label: 'Export',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [connection, setConnection] = useState<UserConnection | null>(null)

  // Connection form state
  const [connectionName, setConnectionName] = useState('My Supabase')
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [serviceKey, setServiceKey] = useState('')
  const [connectError, setConnectError] = useState('')
  const [connecting, setConnecting] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('organizations')

  // Organization data state
  const [organizations, setOrganizations] = useState<OrganizationCard[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')

  // Raw diagnostic data
  const [rawData, setRawData] = useState<RawDiagnosticData | null>(null)
  const [issueCount, setIssueCount] = useState(0)

  // Organization view state
  const [orgView, setOrgView] = useState<OrgView>('grid')
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [orgDetail, setOrgDetail] = useState<OrganizationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // User view state
  const [userView, setUserView] = useState<UserView>('search')
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null)
  const [userDiagnostic, setUserDiagnostic] = useState<UserPermissionDiagnostic | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Get fresh access token with automatic refresh
  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const supabase = createSupabaseClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        return null
      }

      const expiresAt = session.expires_at
      const now = Math.floor(Date.now() / 1000)
      const isExpired = expiresAt ? now >= expiresAt - 60 : false

      if (isExpired) {
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError || !newSession) {
          return null
        }
        return newSession.access_token
      }

      return session.access_token
    } catch {
      return null
    }
  }, [])

  // Check authentication and load connection
  useEffect(() => {
    async function init() {
      try {
        const supabase = createSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          router.push('/login')
          return
        }

        setUser({ id: session.user.id, email: session.user.email || '' })

        const { data: existingConnection } = await supabase
          .from('user_connections')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (existingConnection) {
          setConnection(existingConnection)
        }
      } catch (error) {
        console.error('Init error:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  // Load all data when connection exists
  useEffect(() => {
    async function loadData() {
      if (!connection) return

      setDataLoading(true)
      setDataError('')

      try {
        const token = await getValidAccessToken()
        if (!token) {
          throw new Error('Session expired')
        }

        const response = await fetch('/api/decrypt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ encrypted: connection.encrypted_key }),
        })

        if (!response.ok) {
          const errData = await response.json()
          throw new Error(errData.error || 'Failed to decrypt credentials')
        }

        const { decrypted } = await response.json()
        const customerClient = createCustomerSupabaseClient(connection.supabase_url, decrypted)

        // Load org cards and raw data in parallel
        const [orgData, diagnosticData] = await Promise.all([
          fetchOrganizationCards(customerClient),
          fetchRawDiagnosticData(customerClient),
        ])

        setOrganizations(orgData.organizations)
        setTotalUsers(orgData.totalUsers)
        setTotalPlayers(orgData.totalPlayers)
        setRawData(diagnosticData)

        // Calculate issue count
        const summary = getIssueSummary(diagnosticData)
        setIssueCount(summary.totalIssues)
      } catch (error) {
        console.error('Data loading error:', error)
        setDataError(error instanceof Error ? error.message : 'Failed to load data')
      } finally {
        setDataLoading(false)
      }
    }

    loadData()
  }, [connection, getValidAccessToken])

  // Load org detail when selected
  useEffect(() => {
    async function loadOrgDetail() {
      if (!selectedOrgId || !connection) return

      setDetailLoading(true)

      try {
        const token = await getValidAccessToken()
        if (!token) throw new Error('Session expired')

        const response = await fetch('/api/decrypt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ encrypted: connection.encrypted_key }),
        })

        if (!response.ok) throw new Error('Failed to decrypt')

        const { decrypted } = await response.json()
        const customerClient = createCustomerSupabaseClient(connection.supabase_url, decrypted)
        const detail = await fetchOrganizationDetail(customerClient, selectedOrgId)

        setOrgDetail(detail)
      } catch (error) {
        console.error('Detail loading error:', error)
      } finally {
        setDetailLoading(false)
      }
    }

    loadOrgDetail()
  }, [selectedOrgId, connection, getValidAccessToken])

  // Handle connect form submission
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setConnectError('')
    setConnecting(true)

    try {
      const token = await getValidAccessToken()
      if (!token) {
        setConnectError('Session expired. Please log in again.')
        router.push('/login')
        return
      }

      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          supabaseUrl: supabaseUrl.trim(),
          serviceKey: serviceKey.trim(),
          connectionName: connectionName.trim() || 'My Supabase',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`)
      }

      setConnection(data.connection)
      setSupabaseUrl('')
      setServiceKey('')
      setConnectionName('My Supabase')
    } catch (error) {
      console.error('Connect error:', error)
      setConnectError(error instanceof Error ? error.message : 'Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect? Your credentials will be deleted.')) {
      return
    }

    try {
      const token = await getValidAccessToken()
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/disconnect', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect')
      }

      setConnection(null)
      setOrganizations([])
      setTotalUsers(0)
      setTotalPlayers(0)
      setRawData(null)
      setIssueCount(0)
      setOrgView('grid')
      setSelectedOrgId(null)
      setOrgDetail(null)
      setActiveTab('organizations')
    } catch (error) {
      console.error('Disconnect error:', error)
    }
  }

  // Handle logout
  const handleLogout = async () => {
    const supabase = createSupabaseClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Handle org card click
  const handleOrgClick = (orgId: string) => {
    setSelectedOrgId(orgId)
    setOrgView('detail')
    setSearchQuery('')
  }

  // Handle back to org grid
  const handleBackToOrgGrid = () => {
    setOrgView('grid')
    setSelectedOrgId(null)
    setOrgDetail(null)
    setSearchQuery('')
  }

  // Handle user profile selection
  const handleSelectUser = (profile: UserProfile) => {
    setSelectedUserProfile(profile)
    setUserView('profile')
  }

  // Handle view diagnostic
  const handleViewDiagnostic = (diagnostic: UserPermissionDiagnostic) => {
    setUserDiagnostic(diagnostic)
    setUserView('diagnostic')
  }

  // Handle back from user profile
  const handleBackFromProfile = () => {
    setUserView('search')
    setSelectedUserProfile(null)
  }

  // Handle back from diagnostic
  const handleBackFromDiagnostic = () => {
    setUserView('profile')
    setUserDiagnostic(null)
  }

  // Handle tab change
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    setSearchQuery('')
    // Reset sub-views when changing tabs
    if (tab === 'organizations') {
      setOrgView('grid')
      setSelectedOrgId(null)
      setOrgDetail(null)
    }
    if (tab === 'users') {
      setUserView('search')
      setSelectedUserProfile(null)
      setUserDiagnostic(null)
    }
  }

  // Filter organizations by search
  const filteredOrgs = searchQuery.trim()
    ? organizations.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : organizations

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </div>
      </div>
    )
  }

  if (!user) return null

  // Get tab title
  const getTabTitle = () => {
    if (activeTab === 'organizations') {
      return orgView === 'detail' ? 'Organization Details' : 'Organizations'
    }
    if (activeTab === 'users') {
      if (userView === 'diagnostic') return 'Permission Diagnostic'
      if (userView === 'profile') return 'User Profile'
      return 'User Search'
    }
    return tabs.find(t => t.id === activeTab)?.label || ''
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar userEmail={user.email} onLogout={handleLogout} />

      <div className="flex-1 p-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-1">
            SUPAORGANIZED - READ-ONLY DIAGNOSTIC PANEL
          </p>
          <h1 className="text-3xl font-bold text-white">{getTabTitle()}</h1>
        </div>

        {!connection ? (
          /* Connection Form */
          <div className="max-w-2xl animate-fadeIn">
            <div className="bg-card border border-card-border rounded-xl p-8">
              <h2 className="text-2xl font-bold text-white mb-2">Connect Your Supabase</h2>
              <p className="text-slate-400 mb-6">
                Enter your Supabase project URL and service role key to get started.
                Your credentials are encrypted and stored securely.
              </p>

              {connectError && (
                <div className="bg-red-900/20 border border-red-800/30 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
                  {connectError}
                </div>
              )}

              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
                    Connection Name (optional)
                  </label>
                  <input
                    type="text"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    className="w-full bg-card border border-card-border text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    placeholder="My Supabase"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
                    Supabase URL
                  </label>
                  <input
                    type="url"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full bg-card border border-card-border text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    placeholder="https://your-project.supabase.co"
                    required
                  />
                  <p className="text-slate-500 text-xs mt-1">Found in your Supabase project settings</p>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
                    Service Role Key
                  </label>
                  <input
                    type="password"
                    value={serviceKey}
                    onChange={(e) => setServiceKey(e.target.value)}
                    className="w-full bg-card border border-card-border text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    required
                  />
                  <p className="text-slate-500 text-xs mt-1">
                    Found in Project Settings &rarr; API &rarr; service_role key
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={connecting}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-semibold px-6 py-3 rounded-lg border border-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {connecting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Connected Dashboard */
          <div className="space-y-6 animate-fadeIn">
            {/* Connection Bar */}
            <div className="flex items-center justify-between bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-white font-medium">{connection.connection_name}</span>
                <span className="text-slate-500 text-sm truncate max-w-xs">{connection.supabase_url}</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-slate-400 hover:text-red-400 text-sm transition-colors"
              >
                Disconnect
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-primary text-black'
                      : 'bg-card border border-card-border text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.id === 'issues' && issueCount > 0 && (
                    <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                      activeTab === tab.id
                        ? 'bg-black/20 text-black'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {issueCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search Bar (only for org grid and user search) */}
            {((activeTab === 'organizations' && orgView === 'grid') ||
              (activeTab === 'users' && userView === 'search')) && (
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-card border border-card-border text-white placeholder-slate-500 rounded-lg pl-12 pr-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder={activeTab === 'organizations' ? 'Search organizations...' : 'Search users by name or email...'}
                />
              </div>
            )}

            {/* Content */}
            {dataLoading ? (
              /* Loading skeleton */
              activeTab === 'organizations' ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <OrgCardSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <UserSearchSkeleton />
              )
            ) : dataError ? (
              /* Error state */
              <div className="bg-card border border-card-border rounded-xl p-8">
                <div className="text-center">
                  <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-red-400 mb-4">{dataError}</p>
                  <button
                    onClick={handleDisconnect}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    Try reconnecting
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Organizations Tab */}
                {activeTab === 'organizations' && (
                  <>
                    {orgView === 'grid' ? (
                      <>
                        {/* Stats Cards */}
                        <div className="grid md:grid-cols-3 gap-6">
                          <StatCard
                            label="Organizations"
                            value={organizations.length}
                            icon={
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            }
                          />
                          <StatCard
                            label="Total Users"
                            value={totalUsers}
                            icon={
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                              </svg>
                            }
                          />
                          <StatCard
                            label="Total Players"
                            value={totalPlayers}
                            icon={
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            }
                          />
                        </div>

                        {/* Organization Grid */}
                        {filteredOrgs.length === 0 ? (
                          <div className="bg-card border border-card-border rounded-xl p-12">
                            <div className="text-center">
                              <svg className="w-12 h-12 text-slate-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              <p className="text-slate-400">
                                {searchQuery ? 'No organizations match your search.' : 'No organizations found.'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredOrgs.map((org, index) => (
                              <div
                                key={org.id}
                                className="animate-slideUp"
                                style={{ animationDelay: `${index * 50}ms` }}
                              >
                                <OrgCard org={org} onClick={() => handleOrgClick(org.id)} />
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      /* Organization Detail View */
                      detailLoading ? (
                        <OrgDetailSkeleton />
                      ) : orgDetail ? (
                        <OrgDetailView
                          org={orgDetail}
                          searchQuery={searchQuery}
                          onBack={handleBackToOrgGrid}
                        />
                      ) : (
                        <div className="text-center text-slate-400">Organization not found</div>
                      )
                    )}
                  </>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && rawData && (
                  <>
                    {userView === 'search' && (
                      <UserSearch data={rawData} onSelectUser={handleSelectUser} />
                    )}
                    {userView === 'profile' && selectedUserProfile && (
                      <UserProfileView
                        profile={selectedUserProfile}
                        data={rawData}
                        onBack={handleBackFromProfile}
                        onViewDiagnostic={handleViewDiagnostic}
                      />
                    )}
                    {userView === 'diagnostic' && userDiagnostic && (
                      <PermissionDiagnostic
                        diagnostic={userDiagnostic}
                        onBack={handleBackFromDiagnostic}
                      />
                    )}
                  </>
                )}

                {/* Issues Tab */}
                {activeTab === 'issues' && rawData && (
                  <IssueDashboard data={rawData} />
                )}

                {/* Relationships Tab */}
                {activeTab === 'relationships' && rawData && (
                  <RelationshipViewer data={rawData} />
                )}

                {/* Export Tab */}
                {activeTab === 'export' && rawData && (
                  <ExportTools data={rawData} />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
