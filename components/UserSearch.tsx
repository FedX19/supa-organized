'use client'

import { useState, useCallback, useMemo } from 'react'
import { Profile, UserProfile, RawDiagnosticData, searchUsers, getUserProfile } from '@/lib/supabase'

interface UserSearchProps {
  data: RawDiagnosticData
  onSelectUser: (profile: UserProfile) => void
}

type FilterType = 'all' | 'orgs' | 'players' | 'admins' | 'coaches' | 'parents' | 'unassigned'

interface FilterCard {
  id: FilterType
  label: string
  count: number
  icon: React.ReactNode
  color: string
  description: string
}

export default function UserSearch({ data, onSelectUser }: UserSearchProps) {
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  // Build lookup maps for categorizing users
  const userCategories = useMemo(() => {
    // Staff roles by profile
    const staffRoles = new Map<string, { orgId: string; role: string }[]>()
    data.staff.forEach(s => {
      const existing = staffRoles.get(s.profile_id) || []
      existing.push({ orgId: s.organization_id, role: s.role.toLowerCase() })
      staffRoles.set(s.profile_id, existing)
    })

    // Members by profile
    const memberOrgs = new Set<string>()
    data.members.forEach(m => memberOrgs.add(m.profile_id))

    // Guardians (parents)
    const guardians = new Set<string>()
    data.players.forEach(p => {
      if (p.guardian_profile_id) guardians.add(p.guardian_profile_id)
    })

    // Profiles in any org
    const profilesInOrgs = new Set([
      ...data.staff.map(s => s.profile_id),
      ...data.members.map(m => m.profile_id),
    ])

    // Categorize each profile
    const admins: Profile[] = []
    const coaches: Profile[] = []
    const parents: Profile[] = []
    const unassigned: Profile[] = []
    const allUsers: Profile[] = [...data.profiles]

    data.profiles.forEach(profile => {
      const roles = staffRoles.get(profile.id) || []
      const isGuardian = guardians.has(profile.id)
      const inOrg = profilesInOrgs.has(profile.id)

      // Check for admin/owner roles
      const isAdmin = roles.some(r =>
        r.role === 'admin' || r.role === 'owner' || r.role === 'platform_admin'
      )

      // Check for coach roles
      const isCoach = roles.some(r =>
        r.role.includes('coach') || r.role === 'assistant_coach'
      )

      if (isAdmin) admins.push(profile)
      if (isCoach) coaches.push(profile)
      if (isGuardian) parents.push(profile)
      if (!inOrg) unassigned.push(profile)
    })

    return {
      all: allUsers,
      admins,
      coaches,
      parents,
      unassigned,
      staffRoles,
      guardians,
    }
  }, [data])

  // Filter cards configuration
  const filterCards: FilterCard[] = useMemo(() => [
    {
      id: 'all',
      label: 'Total Users',
      count: data.profiles.length,
      description: 'All registered users',
      color: 'primary',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'orgs',
      label: 'Organizations',
      count: data.organizations.length,
      description: 'Teams & clubs',
      color: 'blue',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'players',
      label: 'Players',
      count: data.players.length,
      description: 'Registered athletes',
      color: 'green',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'admins',
      label: 'Admins',
      count: userCategories.admins.length,
      description: 'Organization admins',
      color: 'purple',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: 'coaches',
      label: 'Coaches',
      count: userCategories.coaches.length,
      description: 'Team coaches',
      color: 'orange',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      ),
    },
    {
      id: 'parents',
      label: 'Parents',
      count: userCategories.parents.length,
      description: 'Player guardians',
      color: 'pink',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'unassigned',
      label: 'No Team',
      count: userCategories.unassigned.length,
      description: 'Not in any org',
      color: 'gray',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ], [data, userCategories])

  // Get filtered results based on active filter and search query
  const filteredUsers = useMemo(() => {
    let users: Profile[] = []

    switch (activeFilter) {
      case 'all':
        users = userCategories.all
        break
      case 'admins':
        users = userCategories.admins
        break
      case 'coaches':
        users = userCategories.coaches
        break
      case 'parents':
        users = userCategories.parents
        break
      case 'unassigned':
        users = userCategories.unassigned
        break
      case 'orgs':
      case 'players':
        // These are handled differently - orgs and players are not profiles
        return []
    }

    // Apply search filter
    if (query.trim()) {
      const lowerQuery = query.toLowerCase()
      users = users.filter(u =>
        (u.full_name?.toLowerCase().includes(lowerQuery)) ||
        (u.email?.toLowerCase().includes(lowerQuery))
      )
    }

    return users.slice(0, 100) // Limit for performance
  }, [activeFilter, query, userCategories])

  // Get user's role badge
  const getUserRoleBadge = useCallback((profileId: string) => {
    const roles = userCategories.staffRoles.get(profileId) || []
    const isGuardian = userCategories.guardians.has(profileId)

    // Find primary role
    const adminRole = roles.find(r => r.role === 'admin' || r.role === 'owner')
    const coachRole = roles.find(r => r.role.includes('coach'))

    if (adminRole) {
      return <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">Admin</span>
    }
    if (coachRole) {
      return <span className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded">Coach</span>
    }
    if (isGuardian) {
      return <span className="px-2 py-0.5 text-xs bg-pink-500/20 text-pink-400 rounded">Parent</span>
    }
    if (roles.length > 0) {
      return <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">{roles[0].role}</span>
    }
    return <span className="px-2 py-0.5 text-xs bg-gray-500/20 text-gray-400 rounded">Member</span>
  }, [userCategories])

  const handleSelectUser = (profile: Profile) => {
    const userProfile = getUserProfile(data, profile.id)
    if (userProfile) {
      onSelectUser(userProfile)
    }
  }

  const colorClasses: Record<string, string> = {
    primary: 'bg-primary/20 text-primary border-primary/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }

  const activeColorClasses: Record<string, string> = {
    primary: 'bg-primary text-black border-primary',
    blue: 'bg-blue-500 text-white border-blue-500',
    green: 'bg-green-500 text-white border-green-500',
    purple: 'bg-purple-500 text-white border-purple-500',
    orange: 'bg-orange-500 text-white border-orange-500',
    pink: 'bg-pink-500 text-white border-pink-500',
    gray: 'bg-gray-500 text-white border-gray-500',
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Filter Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 md:gap-3">
        {filterCards.map((card) => (
          <button
            key={card.id}
            onClick={() => setActiveFilter(card.id)}
            className={`p-3 md:p-4 rounded-lg border transition-all text-left ${
              activeFilter === card.id
                ? activeColorClasses[card.color]
                : `${colorClasses[card.color]} hover:scale-[1.02]`
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={activeFilter === card.id ? '' : colorClasses[card.color].split(' ')[1]}>
                {card.icon}
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold">{card.count}</div>
            <div className="text-xs font-medium truncate">{card.label}</div>
            <div className="text-[10px] opacity-70 truncate hidden sm:block">{card.description}</div>
          </button>
        ))}
      </div>

      {/* Search Input - only show for user filters */}
      {activeFilter !== 'orgs' && activeFilter !== 'players' && (
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder={`Search ${filterCards.find(c => c.id === activeFilter)?.label.toLowerCase() || 'users'}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-dark-card border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {/* Results Table - Users */}
      {activeFilter !== 'orgs' && activeFilter !== 'players' && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-dark-surface border-b border-dark-border flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {filteredUsers.length} {filterCards.find(c => c.id === activeFilter)?.label.toLowerCase() || 'users'}
              {query && ` matching "${query}"`}
              {filteredUsers.length >= 100 && ' (showing first 100)'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border bg-dark-surface text-sm">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">User</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium hidden sm:table-cell">Email</th>
                  <th className="px-4 py-3 text-center text-gray-400 font-medium">Role</th>
                  <th className="px-4 py-3 text-right text-gray-400 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      {query ? `No users matching "${query}"` : 'No users in this category'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((profile) => (
                    <tr
                      key={profile.id}
                      onClick={() => handleSelectUser(profile)}
                      className="hover:bg-dark-surface cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-medium text-sm">
                              {(profile.full_name?.[0] || profile.email?.[0] || '?').toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate text-sm">
                              {profile.full_name || 'Unknown Name'}
                            </div>
                            <div className="text-xs text-gray-500 truncate sm:hidden">
                              {profile.email || 'No email'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm hidden sm:table-cell truncate max-w-[200px]">
                        {profile.email || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getUserRoleBadge(profile.id)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <svg className="w-4 h-4 text-gray-500 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Organizations List */}
      {activeFilter === 'orgs' && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-dark-surface border-b border-dark-border">
            <span className="text-sm text-gray-400">{data.organizations.length} organizations</span>
          </div>
          <div className="divide-y divide-dark-border max-h-[500px] overflow-y-auto">
            {data.organizations.map((org) => {
              const staffCount = data.staff.filter(s => s.organization_id === org.id).length
              const memberCount = data.members.filter(m => m.organization_id === org.id).length
              const playerCount = data.players.filter(p => p.organization_id === org.id).length

              return (
                <div key={org.id} className="px-4 py-3 hover:bg-dark-surface">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white">{org.name}</div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{staffCount} staff</span>
                      <span>{memberCount} members</span>
                      <span>{playerCount} players</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Players List */}
      {activeFilter === 'players' && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-dark-surface border-b border-dark-border">
            <span className="text-sm text-gray-400">{data.players.length} players</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border bg-dark-surface text-sm">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Player</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium hidden sm:table-cell">Guardian</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Organization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {data.players.slice(0, 100).map((player) => {
                  const guardian = player.guardian_profile_id
                    ? data.profiles.find(p => p.id === player.guardian_profile_id)
                    : null
                  const org = data.organizations.find(o => o.id === player.organization_id)

                  return (
                    <tr key={player.id} className="hover:bg-dark-surface">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-green-400 font-medium text-sm">
                              {player.player_name[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-white font-medium text-sm">{player.player_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm hidden sm:table-cell">
                        {guardian?.full_name || player.guardian_email || player.parent_email || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{org?.name || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {data.players.length > 100 && (
              <div className="px-4 py-3 text-center text-sm text-gray-500 border-t border-dark-border">
                Showing first 100 of {data.players.length} players
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// User Search Skeleton
export function UserSearchSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 md:gap-3">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="bg-dark-card border border-dark-border rounded-lg p-4">
            <div className="h-6 w-6 bg-dark-surface rounded mb-2" />
            <div className="h-6 w-12 bg-dark-surface rounded mb-1" />
            <div className="h-4 w-16 bg-dark-surface rounded" />
          </div>
        ))}
      </div>
      <div className="h-12 bg-dark-card rounded-lg" />
      <div className="bg-dark-card border border-dark-border rounded-lg">
        <div className="h-12 bg-dark-surface" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 border-t border-dark-border" />
        ))}
      </div>
    </div>
  )
}
