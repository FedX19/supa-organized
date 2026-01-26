'use client'

import { useState, useCallback } from 'react'
import { Profile, UserProfile, RawDiagnosticData, searchUsers, getUserProfile } from '@/lib/supabase'

interface UserSearchProps {
  data: RawDiagnosticData
  onSelectUser: (profile: UserProfile) => void
}

export default function UserSearch({ data, onSelectUser }: UserSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = useCallback(() => {
    if (query.trim().length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }
    const found = searchUsers(data, query.trim())
    setResults(found.slice(0, 50)) // Limit to 50 results
    setHasSearched(true)
  }, [data, query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleSelectUser = (profile: Profile) => {
    const userProfile = getUserProfile(data, profile.id)
    if (userProfile) {
      onSelectUser(userProfile)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-3">
        <div className="relative flex-1">
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
            placeholder="Search by name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-10 pr-4 py-3 bg-dark-card border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-6 py-3 bg-primary hover:bg-primary-hover text-black font-medium rounded-lg transition-colors"
        >
          Search
        </button>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No users found matching &quot;{query}&quot;</p>
            </div>
          ) : (
            <div>
              <div className="px-4 py-3 bg-dark-surface border-b border-dark-border">
                <span className="text-sm text-gray-400">
                  Found {results.length} user{results.length !== 1 ? 's' : ''}
                  {results.length === 50 && ' (showing first 50)'}
                </span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {results.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => handleSelectUser(profile)}
                    className="w-full px-4 py-3 flex items-center gap-4 hover:bg-dark-surface transition-colors text-left border-b border-dark-border last:border-b-0"
                  >
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-medium">
                        {(profile.full_name?.[0] || profile.email?.[0] || '?').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">
                        {profile.full_name || 'Unknown Name'}
                      </div>
                      <div className="text-sm text-gray-400 truncate">
                        {profile.email || 'No email'}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      {!hasSearched && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-dark-card border border-dark-border rounded-lg p-4">
            <div className="text-3xl font-bold text-white">{data.profiles.length}</div>
            <div className="text-sm text-gray-400">Total Profiles</div>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-lg p-4">
            <div className="text-3xl font-bold text-white">{data.organizations.length}</div>
            <div className="text-sm text-gray-400">Organizations</div>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-lg p-4">
            <div className="text-3xl font-bold text-white">{data.players.length}</div>
            <div className="text-sm text-gray-400">Players</div>
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
      <div className="flex gap-3">
        <div className="flex-1 h-12 bg-dark-card rounded-lg" />
        <div className="w-24 h-12 bg-dark-card rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-dark-card border border-dark-border rounded-lg p-4">
            <div className="h-8 w-16 bg-dark-surface rounded mb-2" />
            <div className="h-4 w-24 bg-dark-surface rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
