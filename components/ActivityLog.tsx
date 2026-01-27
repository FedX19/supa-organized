'use client'

import { useState, useMemo } from 'react'
import {
  AuditLogEntry,
  AuditLogFilters,
  AuditActionCategory,
  AuditActionType,
  fetchAuditLogs,
  getAuditLogStats,
  getActionTypeDisplay,
  getCategoryDisplay,
  exportAuditLogsToCSV,
} from '@/lib/supabase'

interface ActivityLogProps {
  refreshTrigger?: number
}

export default function ActivityLog({ refreshTrigger }: ActivityLogProps) {
  const [filters, setFilters] = useState<AuditLogFilters>({
    category: 'all',
    actionType: 'all',
    searchQuery: '',
  })
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)

  // Get logs with filters
  const logs = useMemo(() => fetchAuditLogs(filters), [filters, refreshTrigger])
  const stats = useMemo(() => getAuditLogStats(), [refreshTrigger])

  const categories: (AuditActionCategory | 'all')[] = [
    'all', 'connection', 'navigation', 'search', 'export', 'analytics', 'diagnostic', 'revenue', 'settings'
  ]

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const handleExport = () => {
    const csvData = exportAuditLogsToCSV(logs)
    const blob = new Blob([csvData], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Activity Log</h1>
          <p className="text-slate-400 mt-1">
            Track all actions in SupaOrganized
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={logs.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Total Actions</div>
          <div className="text-2xl font-bold text-white">{stats.totalLogs}</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Today</div>
          <div className="text-2xl font-bold text-primary">{stats.todayCount}</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Navigation</div>
          <div className="text-2xl font-bold text-blue-400">{stats.categoryCounts.navigation}</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Exports</div>
          <div className="text-2xl font-bold text-green-400">{stats.categoryCounts.export}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Category Filter */}
          <div className="flex-1">
            <label className="block text-sm text-slate-400 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => {
                const display = cat === 'all'
                  ? { label: 'All', color: 'text-slate-400', bgColor: 'bg-slate-500/20' }
                  : getCategoryDisplay(cat)
                const isActive = filters.category === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setFilters(f => ({ ...f, category: cat }))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? `${display.bgColor} ${display.color} ring-1 ring-current`
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {display.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Search */}
          <div className="lg:w-64">
            <label className="block text-sm text-slate-400 mb-2">Search</label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={filters.searchQuery || ''}
                onChange={e => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
                placeholder="Search actions..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-semibold text-white mb-2">No Activity Yet</h3>
            <p className="text-slate-400">
              Actions will appear here as you use SupaOrganized.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-card-border">
            {logs.slice(0, 100).map(log => {
              const actionDisplay = getActionTypeDisplay(log.action_type)
              const categoryDisplay = getCategoryDisplay(log.action_category)

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedEntry(selectedEntry?.id === log.id ? null : log)}
                  className="p-4 hover:bg-card-hover transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 ${categoryDisplay.bgColor} rounded-lg flex items-center justify-center text-lg flex-shrink-0`}>
                      {actionDisplay.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${actionDisplay.color}`}>
                          {actionDisplay.label}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${categoryDisplay.bgColor} ${categoryDisplay.color}`}>
                          {categoryDisplay.label}
                        </span>
                        {!log.success && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-500/20 text-red-400">
                            Failed
                          </span>
                        )}
                      </div>

                      {/* Target info */}
                      {(log.target_name || log.organization_name) && (
                        <div className="text-sm text-slate-400 mt-1">
                          {log.target_name && (
                            <span className="text-slate-300">{log.target_name}</span>
                          )}
                          {log.target_name && log.organization_name && (
                            <span className="mx-2">&middot;</span>
                          )}
                          {log.organization_name && (
                            <span>{log.organization_name}</span>
                          )}
                        </div>
                      )}

                      {/* Expanded details */}
                      {selectedEntry?.id === log.id && (
                        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg text-sm space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-slate-500">Action ID:</span>
                              <span className="text-slate-300 ml-2 font-mono text-xs">{log.id}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Timestamp:</span>
                              <span className="text-slate-300 ml-2">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            {log.target_id && (
                              <div>
                                <span className="text-slate-500">Target ID:</span>
                                <span className="text-slate-300 ml-2 font-mono text-xs">{log.target_id}</span>
                              </div>
                            )}
                            {log.organization_id && (
                              <div>
                                <span className="text-slate-500">Org ID:</span>
                                <span className="text-slate-300 ml-2 font-mono text-xs">{log.organization_id}</span>
                              </div>
                            )}
                          </div>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div>
                              <span className="text-slate-500 block mb-1">Details:</span>
                              <pre className="text-slate-300 bg-slate-900/50 p-2 rounded text-xs overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.error_message && (
                            <div>
                              <span className="text-slate-500">Error:</span>
                              <span className="text-red-400 ml-2">{log.error_message}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-sm text-slate-500 flex-shrink-0">
                      {formatTimestamp(log.timestamp)}
                    </div>

                    {/* Expand indicator */}
                    <svg
                      className={`w-5 h-5 text-slate-500 transition-transform ${selectedEntry?.id === log.id ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Show more indicator */}
        {logs.length > 100 && (
          <div className="px-4 py-3 bg-slate-800/50 text-center text-sm text-slate-400">
            Showing first 100 of {logs.length} entries
          </div>
        )}
      </div>
    </div>
  )
}
