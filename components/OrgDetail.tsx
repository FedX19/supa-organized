'use client'

import { OrganizationDetail, OrgMember } from '@/lib/supabase'
import { RoleBadge } from './Badge'

interface OrgDetailProps {
  org: OrganizationDetail
  searchQuery: string
  onBack: () => void
}

export function OrgDetailView({ org, searchQuery, onBack }: OrgDetailProps) {
  // Filter members by search query
  const filterMembers = (members: OrgMember[]) => {
    if (!searchQuery.trim()) return members
    const query = searchQuery.toLowerCase()
    return members.filter(
      m =>
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        m.role.toLowerCase().includes(query)
    )
  }

  const filterPlayers = (players: OrganizationDetail['players']) => {
    if (!searchQuery.trim()) return players
    const query = searchQuery.toLowerCase()
    return players.filter(
      p =>
        p.name.toLowerCase().includes(query) ||
        p.guardianName.toLowerCase().includes(query) ||
        p.guardianEmail.toLowerCase().includes(query)
    )
  }

  const filteredAdmins = filterMembers(org.admins)
  const filteredCoaches = filterMembers(org.coaches)
  const filteredStaff = filterMembers(org.staff)
  const filteredMembers = filterMembers(org.members)
  const filteredPlayers = filterPlayers(org.players)

  const totalFiltered =
    filteredAdmins.length +
    filteredCoaches.length +
    filteredStaff.length +
    filteredMembers.length +
    filteredPlayers.length

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back button and header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
          <svg
            className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Organizations</span>
        </button>
      </div>

      {/* Org header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
          <span className="text-primary font-bold text-2xl">
            {org.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">{org.name}</h2>
          <p className="text-slate-400">
            {org.admins.length + org.coaches.length + org.staff.length + org.members.length} members
            {' '}&middot;{' '}
            {org.players.length} players
          </p>
        </div>
      </div>

      {/* No results */}
      {searchQuery && totalFiltered === 0 && (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center">
          <svg className="w-12 h-12 text-slate-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-slate-400">No members match your search.</p>
        </div>
      )}

      {/* Admins & Owners */}
      {filteredAdmins.length > 0 && (
        <MemberSection
          title="Admins & Owners"
          members={filteredAdmins}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
          accentColor="red"
        />
      )}

      {/* Coaches */}
      {filteredCoaches.length > 0 && (
        <MemberSection
          title="Coaches"
          members={filteredCoaches}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          accentColor="blue"
        />
      )}

      {/* Other Staff */}
      {filteredStaff.length > 0 && (
        <MemberSection
          title="Staff"
          members={filteredStaff}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          accentColor="purple"
        />
      )}

      {/* Members */}
      {filteredMembers.length > 0 && (
        <MemberSection
          title="Members"
          members={filteredMembers}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          accentColor="slate"
        />
      )}

      {/* Players */}
      {filteredPlayers.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-card-border flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold">Players</h3>
            <span className="text-slate-500 text-sm">({filteredPlayers.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wide px-6 py-3">
                    Player Name
                  </th>
                  <th className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wide px-6 py-3">
                    Guardian
                  </th>
                  <th className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wide px-6 py-3">
                    Guardian Email
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map(player => (
                  <tr key={player.id} className="border-b border-card-border hover:bg-card-hover transition-colors">
                    <td className="px-6 py-3">
                      <span className="text-white font-medium">{player.name}</span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-slate-300">{player.guardianName}</span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-slate-400">{player.guardianEmail}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Member section component
function MemberSection({
  title,
  members,
  icon,
  accentColor,
}: {
  title: string
  members: OrgMember[]
  icon: React.ReactNode
  accentColor: 'red' | 'blue' | 'purple' | 'slate'
}) {
  const bgColors = {
    red: 'bg-red-900/20',
    blue: 'bg-blue-900/20',
    purple: 'bg-purple-900/20',
    slate: 'bg-slate-800',
  }
  const textColors = {
    red: 'text-red-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    slate: 'text-slate-400',
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-card-border flex items-center gap-3">
        <div className={`w-8 h-8 ${bgColors[accentColor]} rounded-lg flex items-center justify-center ${textColors[accentColor]}`}>
          {icon}
        </div>
        <h3 className="text-white font-semibold">{title}</h3>
        <span className="text-slate-500 text-sm">({members.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wide px-6 py-3">
                Name
              </th>
              <th className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wide px-6 py-3">
                Email
              </th>
              <th className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wide px-6 py-3">
                Role
              </th>
              <th className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wide px-6 py-3">
                Kids/Players
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member.id} className="border-b border-card-border hover:bg-card-hover transition-colors">
                <td className="px-6 py-3">
                  <span className="text-white font-medium">{member.name}</span>
                </td>
                <td className="px-6 py-3">
                  <span className="text-slate-300">{member.email}</span>
                </td>
                <td className="px-6 py-3">
                  <RoleBadge role={member.role} />
                </td>
                <td className="px-6 py-3">
                  {member.kids.length > 0 ? (
                    <span className="text-slate-300">{member.kids.join(', ')}</span>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Skeleton for org detail loading
export function OrgDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-slate-700 rounded-xl" />
        <div>
          <div className="h-7 bg-slate-700 rounded w-48 mb-2" />
          <div className="h-5 bg-slate-800 rounded w-32" />
        </div>
      </div>
      <div className="bg-card border border-card-border rounded-xl p-6">
        <div className="h-5 bg-slate-700 rounded w-24 mb-4" />
        <div className="space-y-3">
          <div className="h-12 bg-slate-800 rounded" />
          <div className="h-12 bg-slate-800 rounded" />
          <div className="h-12 bg-slate-800 rounded" />
        </div>
      </div>
    </div>
  )
}
