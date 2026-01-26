'use client'

import { useState, useMemo } from 'react'
import { RawDiagnosticData, getIssueSummary, getIssueDetails, IssueDetail } from '@/lib/supabase'

interface IssueDashboardProps {
  data: RawDiagnosticData
}

// Layman's terms explanations for each issue type
const issueExplanations: Record<string, { title: string; whyItMatters: string; icon: string }> = {
  'Staff Missing Membership': {
    title: 'Staff Without Member Access',
    whyItMatters: 'These coaches/admins are in the staff list but not in the members list. This can cause them to be missing from team rosters, unable to receive notifications, or appear "invisible" in member directories. Think of it like being on the payroll but not having a badge to enter the building.',
    icon: '👤❌',
  },
  'Players Without Guardians': {
    title: 'Players Missing Parent/Guardian Link',
    whyItMatters: 'These players have no parent or guardian linked to their account. This means parents cannot view their child\'s schedule, receive notifications, or manage registrations. Emergency contacts may also be missing.',
    icon: '👶❓',
  },
  'Orphaned Staff Records': {
    title: 'Ghost Staff Accounts',
    whyItMatters: 'These staff records point to user accounts that no longer exist. This is like having an employee badge for someone who never existed. It clutters your database and could cause errors when the app tries to load this person\'s info.',
    icon: '👻',
  },
  'Orphaned Member Records': {
    title: 'Ghost Member Accounts',
    whyItMatters: 'These membership records point to user accounts that have been deleted. This wastes database space and can cause errors when generating reports or sending communications.',
    icon: '👻',
  },
  'Profiles Without Organization': {
    title: 'Users Without a Team/Organization',
    whyItMatters: 'These users created accounts but never joined any organization. They might be incomplete registrations, test accounts, or people who got stuck during signup. They can\'t access any team features.',
    icon: '🏠❌',
  },
}

export default function IssueDashboard({ data }: IssueDashboardProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [copiedSql, setCopiedSql] = useState<string | null>(null)

  const summary = useMemo(() => getIssueSummary(data), [data])
  const details = useMemo(() => getIssueDetails(data), [data])

  const copyToClipboard = (sql: string, id: string) => {
    navigator.clipboard.writeText(sql)
    setCopiedSql(id)
    setTimeout(() => setCopiedSql(null), 2000)
  }

  const hasIssues = summary.totalIssues > 0

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Summary Header */}
      <div className={`rounded-lg p-4 md:p-6 ${
        hasIssues
          ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30'
          : 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30'
      }`}>
        <div className="flex items-start gap-4">
          {hasIssues ? (
            <div className="w-12 h-12 md:w-16 md:h-16 bg-amber-500/30 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 md:w-8 md:h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          ) : (
            <div className="w-12 h-12 md:w-16 md:h-16 bg-green-500/30 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 md:w-8 md:h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-bold text-white">
              {hasIssues ? `${summary.totalIssues} Data Issues Found` : 'No Issues Detected'}
            </h2>
            <p className="text-gray-400 mt-1 text-sm md:text-base">
              {hasIssues
                ? 'These issues may cause problems like missing notifications, incomplete rosters, or users unable to access their teams. Review each category below to understand the impact.'
                : 'Your database relationships look healthy. All users are properly connected to their organizations.'}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats Grid - Friendly Labels */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Staff Without Member Access"
          description="Coaches/admins not in member list"
          value={summary.staffWithoutMembership}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
          color="amber"
        />
        <StatCard
          label="Players Without Parents"
          description="No guardian linked"
          value={summary.playersWithoutGuardians}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          color="orange"
        />
        <StatCard
          label="Ghost Records"
          description="Point to deleted users"
          value={summary.orphanedStaffRecords + summary.orphanedMemberRecords + summary.orphanedPlayerRecords}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          }
          color="red"
        />
        <StatCard
          label="Users Without Team"
          description="Incomplete signups"
          value={summary.profilesWithNoOrg}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="blue"
        />
      </div>

      {/* Issue Categories */}
      {details.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
            <h3 className="font-medium text-white">Issue Categories</h3>
          </div>
          <div className="divide-y divide-dark-border">
            {details.map((detail) => (
              <IssueCategory
                key={detail.category}
                detail={detail}
                isExpanded={expandedCategory === detail.category}
                onToggle={() => setExpandedCategory(
                  expandedCategory === detail.category ? null : detail.category
                )}
                copiedSql={copiedSql}
                onCopySql={copyToClipboard}
              />
            ))}
          </div>
        </div>
      )}

      {/* No Issues Message */}
      {details.length === 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">All Clear!</h3>
          <p className="text-gray-400">
            No data integrity issues were found in your database.
          </p>
        </div>
      )}
    </div>
  )
}

interface StatCardProps {
  label: string
  description?: string
  value: number
  icon: React.ReactNode
  color: 'amber' | 'orange' | 'red' | 'blue' | 'green'
}

function StatCard({ label, description, value, icon, color }: StatCardProps) {
  const colorClasses = {
    amber: 'bg-amber-500/20 text-amber-400',
    orange: 'bg-orange-500/20 text-orange-400',
    red: 'bg-red-500/20 text-red-400',
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-3 md:p-4">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg flex-shrink-0 ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-xl md:text-2xl font-bold ${value > 0 ? 'text-white' : 'text-gray-500'}`}>
            {value}
          </div>
          <div className="text-xs text-gray-400 leading-tight">{label}</div>
          {description && value > 0 && (
            <div className="text-[10px] text-gray-500 mt-0.5 hidden sm:block">{description}</div>
          )}
        </div>
      </div>
    </div>
  )
}

interface IssueCategoryProps {
  detail: IssueDetail
  isExpanded: boolean
  onToggle: () => void
  copiedSql: string | null
  onCopySql: (sql: string, id: string) => void
}

function IssueCategory({ detail, isExpanded, onToggle, copiedSql, onCopySql }: IssueCategoryProps) {
  const [showAll, setShowAll] = useState(false)
  const displayItems = showAll ? detail.items : detail.items.slice(0, 5)
  const explanation = issueExplanations[detail.category]

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-center gap-3 md:gap-4 hover:bg-dark-surface transition-colors text-left"
      >
        <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-amber-400 font-bold text-sm md:text-base">{detail.count}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white text-sm md:text-base">
            {explanation?.title || detail.category}
          </h4>
          <p className="text-xs md:text-sm text-gray-400 truncate">{detail.description}</p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 py-4 bg-dark-surface border-t border-dark-border">
          {/* Layman's Terms Explanation */}
          {explanation && (
            <div className="mb-4 p-3 md:p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{explanation.icon}</span>
                <div>
                  <h5 className="text-blue-400 font-medium text-sm mb-1">Why This Matters</h5>
                  <p className="text-gray-300 text-sm leading-relaxed">{explanation.whyItMatters}</p>
                </div>
              </div>
            </div>
          )}
          {/* Batch SQL */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Batch SQL Fix</span>
              <button
                onClick={() => onCopySql(detail.batchSql, `batch-${detail.category}`)}
                className="px-3 py-1 bg-primary/20 text-primary text-sm rounded hover:bg-primary/30 transition-colors flex items-center gap-2"
              >
                {copiedSql === `batch-${detail.category}` ? (
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
                    Copy Batch SQL
                  </>
                )}
              </button>
            </div>
            <pre className="bg-dark-card p-3 rounded text-xs text-green-400 font-mono overflow-x-auto max-h-32 overflow-y-auto border border-dark-border">
              {detail.batchSql}
            </pre>
          </div>

          {/* Individual Items */}
          <div className="space-y-2">
            <span className="text-sm text-gray-400">Individual Records</span>
            <div className="bg-dark-card rounded border border-dark-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border bg-dark-surface">
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Name</th>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Details</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">SQL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {displayItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-dark-surface">
                      <td className="px-3 py-2">
                        <div className="text-white">{item.name}</div>
                        {item.email && <div className="text-xs text-gray-500">{item.email}</div>}
                        {item.orgName && <div className="text-xs text-gray-500">{item.orgName}</div>}
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{item.details}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => onCopySql(item.sqlFix, `item-${detail.category}-${idx}`)}
                          className="p-1 hover:bg-dark-surface rounded transition-colors"
                          title="Copy SQL"
                        >
                          {copiedSql === `item-${detail.category}-${idx}` ? (
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detail.items.length > 5 && (
                <div className="px-3 py-2 border-t border-dark-border">
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="text-sm text-primary hover:underline"
                  >
                    {showAll ? 'Show less' : `Show all ${detail.items.length} items`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
