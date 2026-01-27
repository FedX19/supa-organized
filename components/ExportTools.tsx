'use client'

import { useState, useMemo } from 'react'
import { RawDiagnosticData, exportToCSV, generateUserExportSQL, detectOrganizationType, getOrgTypeDisplay, logAuditEvent } from '@/lib/supabase'

interface ExportToolsProps {
  data: RawDiagnosticData
}

type ExportType = 'profiles' | 'organizations' | 'staff' | 'members' | 'players' | 'teams' | 'all-users'

export default function ExportTools({ data }: ExportToolsProps) {
  const [copiedSql, setCopiedSql] = useState<string | null>(null)
  const [exportingType, setExportingType] = useState<ExportType | null>(null)

  // Create lookup maps for human-readable names
  const profileMap = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>()
    data.profiles.forEach(p => map.set(p.id, {
      name: p.full_name || 'Unknown',
      email: p.email || '-'
    }))
    return map
  }, [data.profiles])

  const orgMap = useMemo(() => {
    const map = new Map<string, string>()
    data.organizations.forEach(o => map.set(o.id, o.name))
    return map
  }, [data.organizations])

  // Count members+staff per org for type detection
  const memberCountByOrg = useMemo(() => {
    const counts = new Map<string, number>()
    data.members.forEach(m => {
      counts.set(m.organization_id, (counts.get(m.organization_id) || 0) + 1)
    })
    data.staff.forEach(s => {
      counts.set(s.organization_id, (counts.get(s.organization_id) || 0) + 1)
    })
    return counts
  }, [data.members, data.staff])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSql(id)
    setTimeout(() => setCopiedSql(null), 2000)
    // Log SQL copy
    logAuditEvent({
      actionType: 'copy_sql',
      actionCategory: 'export',
      targetType: 'sql',
      targetName: id,
      details: { length: text.length },
    })
  }

  const downloadCSV = (type: ExportType) => {
    setExportingType(type)

    let csvData: string
    let filename: string

    switch (type) {
      case 'profiles':
        csvData = exportToCSV(
          data.profiles.map(p => ({ ...p })),
          [
            { key: 'full_name', label: 'Full Name' },
            { key: 'email', label: 'Email' },
            { key: 'id', label: 'Profile ID' },
          ]
        )
        filename = 'profiles.csv'
        break
      case 'organizations':
        csvData = exportToCSV(
          data.organizations.map(o => {
            const totalPeople = memberCountByOrg.get(o.id) || 0
            const orgType = detectOrganizationType(o, totalPeople)
            const typeDisplay = getOrgTypeDisplay(orgType)
            return {
              name: o.name,
              type: typeDisplay.label,
              id: o.id,
            }
          }),
          [
            { key: 'name', label: 'Organization Name' },
            { key: 'type', label: 'Type' },
            { key: 'id', label: 'Organization ID' },
          ]
        )
        filename = 'organizations.csv'
        break
      case 'staff':
        // Export staff with human-readable names instead of UUIDs
        csvData = exportToCSV(
          data.staff.map(s => {
            const profile = profileMap.get(s.profile_id)
            return {
              staff_name: profile?.name || 'Unknown',
              staff_email: profile?.email || '-',
              organization: orgMap.get(s.organization_id) || 'Unknown Organization',
              role: s.role,
              profile_id: s.profile_id,
              organization_id: s.organization_id,
            }
          }),
          [
            { key: 'staff_name', label: 'Staff Name' },
            { key: 'staff_email', label: 'Email' },
            { key: 'organization', label: 'Organization' },
            { key: 'role', label: 'Role' },
            { key: 'profile_id', label: 'Profile ID' },
            { key: 'organization_id', label: 'Org ID' },
          ]
        )
        filename = 'organization_staff.csv'
        break
      case 'members':
        // Export members with human-readable names instead of UUIDs
        csvData = exportToCSV(
          data.members.map(m => {
            const profile = profileMap.get(m.profile_id)
            return {
              member_name: profile?.name || 'Unknown',
              member_email: profile?.email || '-',
              organization: orgMap.get(m.organization_id) || 'Unknown Organization',
              profile_id: m.profile_id,
              organization_id: m.organization_id,
            }
          }),
          [
            { key: 'member_name', label: 'Member Name' },
            { key: 'member_email', label: 'Email' },
            { key: 'organization', label: 'Organization' },
            { key: 'profile_id', label: 'Profile ID' },
            { key: 'organization_id', label: 'Org ID' },
          ]
        )
        filename = 'organization_members.csv'
        break
      case 'players':
        // Export players with human-readable guardian names
        csvData = exportToCSV(
          data.players.map(p => {
            const guardian = p.guardian_profile_id ? profileMap.get(p.guardian_profile_id) : null
            return {
              player_name: p.player_name,
              organization: orgMap.get(p.organization_id) || 'Unknown Organization',
              guardian_name: guardian?.name || '-',
              guardian_email: guardian?.email || p.guardian_email || p.parent_email || '-',
              organization_id: p.organization_id,
              guardian_profile_id: p.guardian_profile_id || '-',
            }
          }),
          [
            { key: 'player_name', label: 'Player Name' },
            { key: 'organization', label: 'Organization' },
            { key: 'guardian_name', label: 'Guardian Name' },
            { key: 'guardian_email', label: 'Guardian Email' },
            { key: 'organization_id', label: 'Org ID' },
            { key: 'guardian_profile_id', label: 'Guardian Profile ID' },
          ]
        )
        filename = 'players.csv'
        break
      case 'teams':
        // Export teams with organization names
        csvData = exportToCSV(
          data.teams.map(t => ({
            team_name: t.name,
            organization: orgMap.get(t.organization_id) || 'Unknown Organization',
            team_id: t.id,
            organization_id: t.organization_id,
          })),
          [
            { key: 'team_name', label: 'Team Name' },
            { key: 'organization', label: 'Organization' },
            { key: 'team_id', label: 'Team ID' },
            { key: 'organization_id', label: 'Org ID' },
          ]
        )
        filename = 'teams.csv'
        break
      case 'all-users':
        // Comprehensive user export with all roles and organizations
        csvData = exportAllUsersCSV(data, profileMap, orgMap)
        filename = 'all_users_comprehensive.csv'
        break
    }

    // Log CSV export
    logAuditEvent({
      actionType: 'export_csv',
      actionCategory: 'export',
      targetType: type,
      targetName: filename,
      details: { recordCount: csvData.split('\n').length - 1 },
    })

    // Create and download file
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setTimeout(() => setExportingType(null), 1000)
  }

  // Generate comprehensive user export
  function exportAllUsersCSV(
    data: RawDiagnosticData,
    profileMap: Map<string, { name: string; email: string }>,
    orgMap: Map<string, string>
  ): string {
    // Build staff roles by profile
    const staffRoles = new Map<string, { org: string; role: string }[]>()
    data.staff.forEach(s => {
      const existing = staffRoles.get(s.profile_id) || []
      existing.push({
        org: orgMap.get(s.organization_id) || 'Unknown',
        role: s.role
      })
      staffRoles.set(s.profile_id, existing)
    })

    // Build member orgs by profile
    const memberOrgs = new Map<string, string[]>()
    data.members.forEach(m => {
      const existing = memberOrgs.get(m.profile_id) || []
      const orgName = orgMap.get(m.organization_id) || 'Unknown'
      if (!existing.includes(orgName)) existing.push(orgName)
      memberOrgs.set(m.profile_id, existing)
    })

    // Build kids by guardian
    const kidsByGuardian = new Map<string, string[]>()
    data.players.forEach(p => {
      if (p.guardian_profile_id) {
        const existing = kidsByGuardian.get(p.guardian_profile_id) || []
        existing.push(p.player_name)
        kidsByGuardian.set(p.guardian_profile_id, existing)
      }
    })

    // Generate rows
    const rows = data.profiles.map(p => {
      const staff = staffRoles.get(p.id) || []
      const orgs = memberOrgs.get(p.id) || []
      const kids = kidsByGuardian.get(p.id) || []

      // Determine primary role
      let primaryRole = 'member'
      const adminRoles = staff.filter(s => ['admin', 'owner'].includes(s.role.toLowerCase()))
      const coachRoles = staff.filter(s => s.role.toLowerCase().includes('coach'))

      if (adminRoles.length > 0) primaryRole = 'admin'
      else if (coachRoles.length > 0) primaryRole = 'coach'
      else if (staff.length > 0) primaryRole = staff[0].role
      else if (kids.length > 0) primaryRole = 'parent'

      // Combine all org names (unique)
      const allOrgsSet = new Set([
        ...staff.map(s => s.org),
        ...orgs
      ])
      const allOrgs = Array.from(allOrgsSet)

      return {
        full_name: p.full_name || '-',
        email: p.email || '-',
        primary_role: primaryRole,
        organizations: allOrgs.join('; ') || 'None',
        staff_roles: staff.map(s => `${s.role} at ${s.org}`).join('; ') || '-',
        children: kids.join(', ') || '-',
        profile_id: p.id,
      }
    })

    return exportToCSV(rows, [
      { key: 'full_name', label: 'Full Name' },
      { key: 'email', label: 'Email' },
      { key: 'primary_role', label: 'Primary Role' },
      { key: 'organizations', label: 'Organizations' },
      { key: 'staff_roles', label: 'Staff Positions' },
      { key: 'children', label: 'Children' },
      { key: 'profile_id', label: 'Profile ID' },
    ])
  }

  const tables: { type: ExportType; label: string; count: number; description: string; icon: JSX.Element }[] = [
    {
      type: 'all-users',
      label: 'All Users (Comprehensive)',
      count: data.profiles.length,
      description: 'Names, roles, orgs & children',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      type: 'profiles',
      label: 'Profiles Only',
      count: data.profiles.length,
      description: 'Basic user info',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      type: 'organizations',
      label: 'Organizations',
      count: data.organizations.length,
      description: 'Org names & IDs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      type: 'staff',
      label: 'Staff Members',
      count: data.staff.length,
      description: 'Names, orgs & roles',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      type: 'members',
      label: 'Organization Members',
      count: data.members.length,
      description: 'Names & their orgs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      type: 'players',
      label: 'Players',
      count: data.players.length,
      description: 'Names, orgs & guardians',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      type: 'teams',
      label: 'Teams',
      count: data.teams.length,
      description: 'Names & orgs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      ),
    },
  ]

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* CSV Exports */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export to CSV (Human-Readable)
          </h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-400 mb-4">
            All exports include actual names instead of IDs. Download for Excel, Google Sheets, or other tools.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tables.map((table, index) => (
              <button
                key={table.type}
                onClick={() => downloadCSV(table.type)}
                disabled={exportingType === table.type}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors text-left disabled:opacity-50 ${
                  index === 0
                    ? 'bg-gradient-to-r from-primary/20 to-amber-500/10 border-2 border-primary/50 hover:border-primary'
                    : 'bg-dark-surface border border-dark-border hover:border-primary/50'
                }`}
              >
                <div className={index === 0 ? 'text-primary' : 'text-gray-400'}>{table.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-white font-medium text-sm truncate">{table.label}</div>
                    {index === 0 && (
                      <span className="text-[10px] bg-primary/30 text-primary px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{table.description}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{table.count} records</div>
                </div>
                {exportingType === table.type ? (
                  <svg className="w-5 h-5 text-green-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SQL Export Queries */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            SQL Export Queries
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-400">
            Copy these SQL queries to run directly in your Supabase SQL Editor for custom exports.
          </p>

          {/* User Export Query */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white">Export Users with Organizations & Roles</span>
              <button
                onClick={() => copyToClipboard(generateUserExportSQL(data), 'user-export')}
                className="px-3 py-1 bg-primary/20 text-primary text-sm rounded hover:bg-primary/30 transition-colors flex items-center gap-2"
              >
                {copiedSql === 'user-export' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="bg-dark-surface p-3 rounded text-xs text-green-400 font-mono overflow-x-auto border border-dark-border">
              {generateUserExportSQL(data)}
            </pre>
          </div>

          {/* Simple Select Queries */}
          <div className="grid md:grid-cols-2 gap-4">
            <SQLQueryCard
              title="All Profiles"
              query="SELECT * FROM profiles ORDER BY full_name;"
              copiedSql={copiedSql}
              onCopy={copyToClipboard}
              id="all-profiles"
            />
            <SQLQueryCard
              title="All Organizations"
              query="SELECT * FROM organizations ORDER BY name;"
              copiedSql={copiedSql}
              onCopy={copyToClipboard}
              id="all-orgs"
            />
            <SQLQueryCard
              title="Staff by Organization"
              query={`SELECT o.name as org, p.full_name, os.role
FROM organization_staff os
JOIN profiles p ON os.profile_id = p.id
JOIN organizations o ON os.organization_id = o.id
ORDER BY o.name, os.role, p.full_name;`}
              copiedSql={copiedSql}
              onCopy={copyToClipboard}
              id="staff-by-org"
            />
            <SQLQueryCard
              title="Players with Guardians"
              query={`SELECT pl.player_name, p.full_name as guardian, o.name as org
FROM players pl
LEFT JOIN profiles p ON pl.guardian_profile_id = p.id
JOIN organizations o ON pl.organization_id = o.id
ORDER BY o.name, pl.player_name;`}
              copiedSql={copiedSql}
              onCopy={copyToClipboard}
              id="players-guardians"
            />
          </div>
        </div>
      </div>

      {/* Data Summary */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Data Summary
          </h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {tables.map((table) => (
              <div key={table.type} className="text-center">
                <div className="text-3xl font-bold text-white">{table.count}</div>
                <div className="text-xs text-gray-400">{table.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface SQLQueryCardProps {
  title: string
  query: string
  copiedSql: string | null
  onCopy: (sql: string, id: string) => void
  id: string
}

function SQLQueryCard({ title, query, copiedSql, onCopy, id }: SQLQueryCardProps) {
  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white">{title}</span>
        <button
          onClick={() => onCopy(query, id)}
          className="p-1 hover:bg-dark-card rounded transition-colors"
        >
          {copiedSql === id ? (
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
      <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
        {query}
      </pre>
    </div>
  )
}
