'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient, createCustomerSupabaseClient, fetchCustomerData, UserRow, UserConnection } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { StatCard } from '@/components/StatCard'
import { RoleBadge } from '@/components/Badge'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [connection, setConnection] = useState<UserConnection | null>(null)

  // Connection form state
  const [connectionName, setConnectionName] = useState('My Supabase')
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [serviceKey, setServiceKey] = useState('')
  const [connectError, setConnectError] = useState('')
  const [connecting, setConnecting] = useState(false)

  // Data state
  const [users, setUsers] = useState<UserRow[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalOrgs, setTotalOrgs] = useState(0)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

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
        setAccessToken(session.access_token)

        // Load user's connection
        const { data: connections } = await supabase
          .from('user_connections')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (connections) {
          setConnection(connections)
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

  // Load customer data when connection exists
  useEffect(() => {
    async function loadData() {
      if (!connection || !accessToken) return

      setDataLoading(true)
      setDataError('')

      try {
        // Decrypt the key and create customer client
        const response = await fetch('/api/decrypt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ encrypted: connection.encrypted_key }),
        })

        if (!response.ok) {
          throw new Error('Failed to decrypt credentials')
        }

        const { decrypted } = await response.json()
        const customerClient = createCustomerSupabaseClient(connection.supabase_url, decrypted)
        const data = await fetchCustomerData(customerClient)

        setUsers(data.users)
        setTotalUsers(data.totalUsers)
        setTotalOrgs(data.totalOrganizations)
        setTotalPlayers(data.totalPlayers)
      } catch (error) {
        console.error('Data loading error:', error)
        setDataError('Failed to load data from your Supabase. Please check your connection.')
      } finally {
        setDataLoading(false)
      }
    }

    loadData()
  }, [connection, accessToken])

  // Handle connect form submission
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setConnectError('')
    setConnecting(true)

    try {
      // Send credentials to API (connection test happens server-side)
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          supabaseUrl,
          serviceKey,
          connectionName: connectionName || 'My Supabase',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save connection')
      }

      setConnection(data.connection)

      // Clear form
      setSupabaseUrl('')
      setServiceKey('')
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
      const response = await fetch('/api/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
      if (!response.ok) {
        throw new Error('Failed to disconnect')
      }

      setConnection(null)
      setUsers([])
      setTotalUsers(0)
      setTotalOrgs(0)
      setTotalPlayers(0)
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

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users

    const query = searchQuery.toLowerCase()
    return users.filter(user =>
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.organization.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    )
  }, [users, searchQuery])

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

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sidebar userEmail={user.email} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-1">
            SUPAORGANIZED
          </p>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        </div>

        {!connection ? (
          /* Connection Form */
          <div className="max-w-2xl">
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
                  <label htmlFor="connectionName" className="block text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
                    Connection Name (optional)
                  </label>
                  <input
                    id="connectionName"
                    type="text"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    className="w-full bg-card border border-card-border text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    placeholder="My Supabase"
                  />
                </div>

                <div>
                  <label htmlFor="supabaseUrl" className="block text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
                    Supabase URL
                  </label>
                  <input
                    id="supabaseUrl"
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
                  <label htmlFor="serviceKey" className="block text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
                    Service Role Key
                  </label>
                  <input
                    id="serviceKey"
                    type="password"
                    value={serviceKey}
                    onChange={(e) => setServiceKey(e.target.value)}
                    className="w-full bg-card border border-card-border text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    required
                  />
                  <p className="text-slate-500 text-xs mt-1">
                    Found in Project Settings → API → service_role key. Never share this publicly.
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
          <div className="space-y-6">
            {/* Connection Bar */}
            <div className="flex items-center justify-between bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
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

            {/* Search Bar */}
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-card border border-card-border text-white placeholder-slate-500 rounded-lg pl-12 pr-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="Search by name, email, or organization..."
              />
            </div>

            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 gap-6">
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
                label="Total Organizations"
                value={totalOrgs}
                icon={
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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

            {/* Data Table */}
            {dataLoading ? (
              <div className="bg-card border border-card-border rounded-xl p-12 flex items-center justify-center">
                <div className="flex items-center gap-3 text-slate-400">
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading data...
                </div>
              </div>
            ) : dataError ? (
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
            ) : filteredUsers.length === 0 ? (
              <div className="bg-card border border-card-border rounded-xl p-12">
                <div className="text-center">
                  <svg className="w-12 h-12 text-slate-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-slate-400">
                    {searchQuery ? 'No users match your search.' : 'No users found in your database.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-card-border">
                        <th className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wide px-6 py-4">
                          Name
                        </th>
                        <th className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wide px-6 py-4">
                          Email
                        </th>
                        <th className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wide px-6 py-4">
                          Organization
                        </th>
                        <th className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wide px-6 py-4">
                          Role
                        </th>
                        <th className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wide px-6 py-4">
                          Kids/Players
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="border-b border-card-border hover:bg-card-hover transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-white font-medium">{user.name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-slate-300">{user.email}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-slate-300">{user.organization}</span>
                          </td>
                          <td className="px-6 py-4">
                            <RoleBadge role={user.role} />
                          </td>
                          <td className="px-6 py-4">
                            {user.kids.length > 0 ? (
                              <span className="text-slate-300">{user.kids.join(', ')}</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-card-border px-6 py-4">
                  <p className="text-slate-500 text-sm">
                    Showing {filteredUsers.length} of {users.length} entries
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
