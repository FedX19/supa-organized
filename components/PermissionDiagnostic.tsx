'use client'

import { useState } from 'react'
import { UserPermissionDiagnostic, PermissionIssue } from '@/lib/supabase'

interface PermissionDiagnosticProps {
  diagnostic: UserPermissionDiagnostic
  onBack: () => void
}

export default function PermissionDiagnostic({ diagnostic, onBack }: PermissionDiagnosticProps) {
  const [copiedSql, setCopiedSql] = useState<string | null>(null)
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null)

  const copyToClipboard = (sql: string, id: string) => {
    navigator.clipboard.writeText(sql)
    setCopiedSql(id)
    setTimeout(() => setCopiedSql(null), 2000)
  }

  const { profile, issues, orgChecks } = diagnostic

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
          <h2 className="text-2xl font-bold text-white">Permission Diagnostic</h2>
          <p className="text-gray-400">{profile.fullName} ({profile.email})</p>
        </div>
        {issues.length > 0 ? (
          <div className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg">
            {issues.length} Issue{issues.length !== 1 ? 's' : ''} Found
          </div>
        ) : (
          <div className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg">
            No Issues Found
          </div>
        )}
      </div>

      {/* Visual Permission Tree */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
          <h3 className="font-medium text-white">Permission Tree</h3>
        </div>
        <div className="p-4 font-mono text-sm">
          {/* User Root */}
          <div className="flex items-center gap-2 text-white">
            <span className="text-xl">👤</span>
            <span className="font-medium">{profile.fullName}</span>
          </div>

          {/* Organizations */}
          {orgChecks.map((org, orgIndex) => {
            const isLast = orgIndex === orgChecks.length - 1 && profile.guardiansOf.length === 0
            const hasIssues = org.issues.length > 0

            return (
              <div key={org.orgId} className="ml-4">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">{isLast ? '└──' : '├──'}</span>
                  <span className="text-xl">🏢</span>
                  <span className={hasIssues ? 'text-amber-400' : 'text-white'}>
                    {org.orgName}
                  </span>
                </div>

                {/* Org Details */}
                <div className={`ml-4 ${isLast ? 'ml-8' : ''}`}>
                  {/* Organization Members Check */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{org.issues.length > 0 || org.teamAccess > 0 ? '├──' : '└──'}</span>
                    {org.inOrganizationMembers ? (
                      <>
                        <span className="text-green-400">✅</span>
                        <span className="text-green-400">in organization_members</span>
                      </>
                    ) : (
                      <>
                        <span className="text-red-400">❌</span>
                        <span className="text-red-400">MISSING from organization_members</span>
                      </>
                    )}
                  </div>

                  {/* Organization Staff Check */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{org.teamAccess > 0 ? '├──' : '└──'}</span>
                    {org.inOrganizationStaff ? (
                      <>
                        <span className="text-green-400">✅</span>
                        <span className="text-green-400">in organization_staff (role: {org.staffRole})</span>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-400">⚪</span>
                        <span className="text-gray-400">not in organization_staff</span>
                      </>
                    )}
                  </div>

                  {/* Team Access */}
                  {org.teamAccess > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">└──</span>
                      <span className="text-green-400">✅</span>
                      <span className="text-green-400">has access to {org.teamAccess} team{org.teamAccess !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Guardian Of */}
          {profile.guardiansOf.length > 0 && (
            <div className="ml-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">└──</span>
                <span className="text-xl">⚽</span>
                <span className="text-white">Guardian of {profile.guardiansOf.length} player{profile.guardiansOf.length !== 1 ? 's' : ''}</span>
              </div>
              {profile.guardiansOf.map((player, idx) => (
                <div key={player.playerId} className="ml-8 flex items-center gap-2">
                  <span className="text-gray-600">{idx === profile.guardiansOf.length - 1 ? '└──' : '├──'}</span>
                  <span className="text-gray-300">{player.playerName}</span>
                  <span className="text-gray-500">({player.orgName})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Issues List */}
      {issues.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
            <h3 className="font-medium text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Issues Detected
            </h3>
          </div>
          <div className="divide-y divide-dark-border">
            {issues.map((issue, idx) => (
              <IssueCard
                key={idx}
                issue={issue}
                isExpanded={expandedIssue === `issue-${idx}`}
                onToggle={() => setExpandedIssue(expandedIssue === `issue-${idx}` ? null : `issue-${idx}`)}
                onCopySql={(sql) => copyToClipboard(sql, `issue-${idx}`)}
                isCopied={copiedSql === `issue-${idx}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Copy All SQL */}
      {issues.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-white">Batch SQL Fix</h3>
            <button
              onClick={() => copyToClipboard(issues.map(i => i.sqlFix).join('\n'), 'all-sql')}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-black font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {copiedSql === 'all-sql' ? (
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
                  Copy All SQL
                </>
              )}
            </button>
          </div>
          <pre className="bg-dark-surface p-3 rounded text-xs text-green-400 font-mono overflow-x-auto max-h-48 overflow-y-auto">
            {issues.map(i => i.sqlFix).join('\n')}
          </pre>
        </div>
      )}
    </div>
  )
}

interface IssueCardProps {
  issue: PermissionIssue
  isExpanded: boolean
  onToggle: () => void
  onCopySql: (sql: string) => void
  isCopied: boolean
}

function IssueCard({ issue, isExpanded, onToggle, onCopySql, isCopied }: IssueCardProps) {
  return (
    <div className="p-4">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-start gap-3"
      >
        <div className={`mt-0.5 ${issue.severity === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
          {issue.severity === 'error' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{issue.description}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              issue.severity === 'error'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}>
              {issue.severity}
            </span>
          </div>
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

      {isExpanded && (
        <div className="mt-4 ml-8 space-y-4">
          {/* Impact */}
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <span>💡</span>
              <span>What this might cause:</span>
            </div>
            <p className="text-gray-300 text-sm">{issue.impact}</p>
          </div>

          {/* SQL Fix */}
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <span>📋</span>
              <span>SQL to fix:</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-dark-surface p-3 rounded text-green-400 font-mono overflow-x-auto">
                {issue.sqlFix}
              </code>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCopySql(issue.sqlFix)
                }}
                className="p-2 hover:bg-dark-surface rounded transition-colors flex-shrink-0"
              >
                {isCopied ? (
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
        </div>
      )}
    </div>
  )
}
