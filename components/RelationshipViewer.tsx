'use client'

import { useState } from 'react'
import { TableRelationship, RawDiagnosticData, getTableRelationships } from '@/lib/supabase'

interface RelationshipViewerProps {
  data: RawDiagnosticData
}

export default function RelationshipViewer({ data }: RelationshipViewerProps) {
  const [expandedRelation, setExpandedRelation] = useState<string | null>(null)
  const [copiedSql, setCopiedSql] = useState<string | null>(null)

  const relationships = getTableRelationships(data)
  const totalOrphans = relationships.reduce((sum, r) => sum + r.orphanCount, 0)

  const copyToClipboard = (sql: string, id: string) => {
    navigator.clipboard.writeText(sql)
    setCopiedSql(id)
    setTimeout(() => setCopiedSql(null), 2000)
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <div className="text-3xl font-bold text-white">{data.profiles.length}</div>
          <div className="text-sm text-gray-400">Profiles</div>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <div className="text-3xl font-bold text-white">{data.organizations.length}</div>
          <div className="text-sm text-gray-400">Organizations</div>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <div className="text-3xl font-bold text-white">{relationships.length}</div>
          <div className="text-sm text-gray-400">Relationships</div>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <div className={`text-3xl font-bold ${totalOrphans > 0 ? 'text-amber-400' : 'text-green-400'}`}>
            {totalOrphans}
          </div>
          <div className="text-sm text-gray-400">Orphan Records</div>
        </div>
      </div>

      {/* Schema Diagram */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white">Database Schema</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {/* Profiles Table */}
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium text-white">profiles</span>
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="text-primary">id (PK)</div>
                <div className="text-gray-400">full_name</div>
                <div className="text-gray-400">email</div>
              </div>
              <div className="mt-3 text-xs text-gray-500">{data.profiles.length} records</div>
            </div>

            {/* Organizations Table */}
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="font-medium text-white">organizations</span>
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="text-primary">id (PK)</div>
                <div className="text-gray-400">name</div>
              </div>
              <div className="mt-3 text-xs text-gray-500">{data.organizations.length} records</div>
            </div>

            {/* Organization Staff Table */}
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="font-medium text-white">organization_staff</span>
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="text-primary">id (PK)</div>
                <div className="text-blue-400">profile_id (FK)</div>
                <div className="text-green-400">organization_id (FK)</div>
                <div className="text-gray-400">role</div>
              </div>
              <div className="mt-3 text-xs text-gray-500">{data.staff.length} records</div>
            </div>

            {/* Organization Members Table */}
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-medium text-white">organization_members</span>
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="text-primary">id (PK)</div>
                <div className="text-blue-400">profile_id (FK)</div>
                <div className="text-green-400">organization_id (FK)</div>
              </div>
              <div className="mt-3 text-xs text-gray-500">{data.members.length} records</div>
            </div>

            {/* Players Table */}
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-white">players</span>
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="text-primary">id (PK)</div>
                <div className="text-gray-400">player_name</div>
                <div className="text-green-400">organization_id (FK)</div>
                <div className="text-blue-400">guardian_profile_id (FK)</div>
              </div>
              <div className="mt-3 text-xs text-gray-500">{data.players.length} records</div>
            </div>

            {/* Teams Table */}
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
                <span className="font-medium text-white">teams</span>
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="text-primary">id (PK)</div>
                <div className="text-gray-400">name</div>
                <div className="text-green-400">organization_id (FK)</div>
              </div>
              <div className="mt-3 text-xs text-gray-500">{data.teams.length} records</div>
            </div>
          </div>
        </div>
      </div>

      {/* Relationship Details */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white">Foreign Key Relationships</h3>
        </div>
        <div className="divide-y divide-dark-border">
          {relationships.map((rel, idx) => {
            const relId = `${rel.fromTable}-${rel.fromColumn}`
            const isExpanded = expandedRelation === relId
            const hasOrphans = rel.orphanCount > 0

            return (
              <div key={idx}>
                <button
                  onClick={() => setExpandedRelation(isExpanded ? null : relId)}
                  className="w-full px-4 py-3 flex items-center gap-4 hover:bg-dark-surface transition-colors text-left"
                >
                  <div className={`w-2 h-2 rounded-full ${hasOrphans ? 'bg-amber-400' : 'bg-green-400'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-white">
                      <span className="font-medium">{rel.fromTable}</span>
                      <span className="text-gray-500">.</span>
                      <span className="text-blue-400">{rel.fromColumn}</span>
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <span className="font-medium">{rel.toTable}</span>
                      <span className="text-gray-500">.</span>
                      <span className="text-primary">{rel.toColumn}</span>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${
                    hasOrphans
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    {hasOrphans ? `${rel.orphanCount} orphan${rel.orphanCount !== 1 ? 's' : ''}` : 'OK'}
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && rel.orphanCount > 0 && (
                  <div className="px-4 py-4 bg-dark-surface border-t border-dark-border">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-gray-400">
                        These records reference non-existent {rel.toTable} records:
                      </p>
                      <button
                        onClick={() => {
                          const sql = `DELETE FROM ${rel.fromTable} WHERE id IN (\n${rel.orphanRecords.map(r => `  '${r.id}'`).join(',\n')}\n);`
                          copyToClipboard(sql, relId)
                        }}
                        className="px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded hover:bg-red-500/30 transition-colors flex items-center gap-2"
                      >
                        {copiedSql === relId ? (
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
                            Copy DELETE SQL
                          </>
                        )}
                      </button>
                    </div>
                    <div className="bg-dark-card rounded border border-dark-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-dark-border">
                            <th className="px-3 py-2 text-left text-gray-400 font-medium">Record ID</th>
                            <th className="px-3 py-2 text-left text-gray-400 font-medium">Missing FK Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                          {rel.orphanRecords.slice(0, 10).map((orphan) => (
                            <tr key={orphan.id} className="hover:bg-dark-surface">
                              <td className="px-3 py-2 font-mono text-xs text-white">{orphan.id}</td>
                              <td className="px-3 py-2 font-mono text-xs text-red-400">{orphan.missingValue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {rel.orphanRecords.length > 10 && (
                        <div className="px-3 py-2 text-center text-xs text-gray-500 border-t border-dark-border">
                          ... and {rel.orphanRecords.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
