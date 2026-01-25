'use client'

import { UserProfile, RawDiagnosticData, getUserPermissionDiagnostic, UserPermissionDiagnostic } from '@/lib/supabase'
import { useMemo, useState } from 'react'

interface UserProfileViewProps {
  profile: UserProfile
  data: RawDiagnosticData
  onBack: () => void
  onViewDiagnostic: (diagnostic: UserPermissionDiagnostic) => void
}

export default function UserProfileView({ profile, data, onBack, onViewDiagnostic }: UserProfileViewProps) {
  const [copiedSql, setCopiedSql] = useState<string | null>(null)

  const diagnostic = useMemo(() => {
    return getUserPermissionDiagnostic(data, profile.id)
  }, [data, profile.id])

  const copyToClipboard = (sql: string, id: string) => {
    navigator.clipboard.writeText(sql)
    setCopiedSql(id)
    setTimeout(() => setCopiedSql(null), 2000)
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">{profile.fullName}</h2>
          <p className="text-gray-400">{profile.email}</p>
        </div>
        {diagnostic && diagnostic.issues.length > 0 && (
          <button
            onClick={() => onViewDiagnostic(diagnostic)}
            className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg flex items-center gap-2 hover:bg-amber-500/30 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {diagnostic.issues.length} Issue{diagnostic.issues.length !== 1 ? 's' : ''} Found
          </button>
        )}
      </div>

      {/* Profile ID */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Profile ID</span>
            <p className="text-white font-mono text-sm mt-1">{profile.id}</p>
          </div>
          <button
            onClick={() => copyToClipboard(profile.id, 'profile-id')}
            className="p-2 hover:bg-dark-surface rounded transition-colors"
            title="Copy ID"
          >
            {copiedSql === 'profile-id' ? (
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Organizations */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Organizations ({profile.organizations.length})
          </h3>
        </div>
        {profile.organizations.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            <p>Not a member of any organization</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-border">
            {profile.organizations.map((org) => (
              <div key={org.orgId} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-white">{org.orgName}</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {org.isStaff && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                          Staff: {org.staffRole}
                        </span>
                      )}
                      {org.isMember && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                          Member
                        </span>
                      )}
                      {org.isStaff && !org.isMember && (
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                          </svg>
                          Missing Membership
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-mono">{org.orgId.slice(0, 8)}...</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guardian Of Players */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Guardian of Players ({profile.guardiansOf.length})
          </h3>
        </div>
        {profile.guardiansOf.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            <p>Not a guardian of any players</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-border">
            {profile.guardiansOf.map((player) => (
              <div key={player.playerId} className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-white">{player.playerName}</h4>
                  <p className="text-sm text-gray-400">{player.orgName}</p>
                </div>
                <p className="text-xs text-gray-500 font-mono">{player.playerId.slice(0, 8)}...</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Access */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Teams in Organizations ({profile.teamMemberships.length})
          </h3>
        </div>
        {profile.teamMemberships.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            <p>No teams in associated organizations</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-border">
            {profile.teamMemberships.map((team) => (
              <div key={team.teamId} className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-white">{team.teamName}</h4>
                  <p className="text-sm text-gray-400">{team.orgName}</p>
                </div>
                <p className="text-xs text-gray-500 font-mono">{team.teamId.slice(0, 8)}...</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick SQL Reference */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            SQL Reference
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Query this user&apos;s staff records</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-dark-surface p-2 rounded text-green-400 font-mono overflow-x-auto">
                SELECT * FROM organization_staff WHERE profile_id = &apos;{profile.id}&apos;;
              </code>
              <button
                onClick={() => copyToClipboard(`SELECT * FROM organization_staff WHERE profile_id = '${profile.id}';`, 'sql-staff')}
                className="p-2 hover:bg-dark-surface rounded transition-colors flex-shrink-0"
              >
                {copiedSql === 'sql-staff' ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Query this user&apos;s member records</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-dark-surface p-2 rounded text-green-400 font-mono overflow-x-auto">
                SELECT * FROM organization_members WHERE profile_id = &apos;{profile.id}&apos;;
              </code>
              <button
                onClick={() => copyToClipboard(`SELECT * FROM organization_members WHERE profile_id = '${profile.id}';`, 'sql-member')}
                className="p-2 hover:bg-dark-surface rounded transition-colors flex-shrink-0"
              >
                {copiedSql === 'sql-member' ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
