'use client'

import { useState, useEffect, useMemo } from 'react'
import { UserEngagement, exportToCSV } from '@/lib/supabase'

// Activity event interface
export interface ActivityEvent {
  id: string
  event_type: string
  timestamp: string
  event_details?: Record<string, unknown> | null
  organization_name?: string | null
}

interface UserActivityDetailProps {
  user: UserEngagement
  isOpen: boolean
  onClose: () => void
  onFetchActivities: (profileId: string) => Promise<ActivityEvent[]>
}

// Event type icons mapping
const eventIcons: Record<string, string> = {
  login: '🔑',
  app_open: '📱',
  view_player: '👁️',
  view_video: '📹',
  view_plan: '📋',
  message_sent: '💬',
  profile_update: '✏️',
  team_view: '👥',
  schedule_view: '📅',
  payment: '💳',
  signup: '🎉',
  logout: '🚪',
}

const getEventIcon = (eventType: string): string => {
  const normalizedType = eventType.toLowerCase().replace(/[.-]/g, '_')
  return eventIcons[normalizedType] || '📊'
}

// Format event type for display
function formatEventType(eventType: string): string {
  return eventType
    .replace(/_/g, ' ')
    .replace(/\./g, ' > ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Format timestamp to relative time
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  // For older dates, show formatted date with time
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Group events by date section
function groupEventsByDate(events: ActivityEvent[]): Map<string, ActivityEvent[]> {
  const groups = new Map<string, ActivityEvent[]>()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  events.forEach(event => {
    const eventDate = new Date(event.timestamp)
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())

    let groupKey: string
    if (eventDay.getTime() === today.getTime()) {
      groupKey = 'Today'
    } else if (eventDay.getTime() === yesterday.getTime()) {
      groupKey = 'Yesterday'
    } else if (eventDay.getTime() > lastWeek.getTime()) {
      groupKey = 'Last 7 Days'
    } else {
      groupKey = eventDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(event)
  })

  return groups
}

// Render event details from JSONB
function renderEventDetails(details: Record<string, unknown> | null | undefined): React.ReactNode {
  if (!details || Object.keys(details).length === 0) return null

  const displayItems: { label: string; value: string }[] = []

  // Extract common fields
  if (details.player_name) displayItems.push({ label: 'Player', value: String(details.player_name) })
  if (details.video_title) displayItems.push({ label: 'Video', value: String(details.video_title) })
  if (details.plan_name) displayItems.push({ label: 'Plan', value: String(details.plan_name) })
  if (details.team_name) displayItems.push({ label: 'Team', value: String(details.team_name) })
  if (details.message_to) displayItems.push({ label: 'To', value: String(details.message_to) })
  if (details.device) displayItems.push({ label: 'Device', value: String(details.device) })
  if (details.duration_seconds) displayItems.push({ label: 'Duration', value: `${details.duration_seconds}s` })

  // Generic fallback for other fields
  Object.entries(details).forEach(([key, value]) => {
    if (!['player_name', 'video_title', 'plan_name', 'team_name', 'message_to', 'device', 'duration_seconds'].includes(key)) {
      if (typeof value === 'string' || typeof value === 'number') {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        displayItems.push({ label, value: String(value) })
      }
    }
  })

  if (displayItems.length === 0) return null

  return (
    <div className="mt-1 text-xs text-gray-500">
      {displayItems.slice(0, 3).map((item, i) => (
        <span key={i}>
          {i > 0 && ' • '}
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  )
}

export default function UserActivityDetail({
  user,
  isOpen,
  onClose,
  onFetchActivities,
}: UserActivityDetailProps) {
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  // Fetch activities when user changes
  useEffect(() => {
    if (isOpen && user) {
      setLoading(true)
      setError(null)
      onFetchActivities(user.profileId)
        .then(data => {
          setActivities(data)
          setLoading(false)
        })
        .catch(err => {
          setError(err.message || 'Failed to load activities')
          setLoading(false)
        })
    }
  }, [isOpen, user, onFetchActivities])

  // Get unique event types for filter
  const eventTypes = useMemo(() => {
    const types = new Set(activities.map(a => a.event_type))
    return Array.from(types).sort()
  }, [activities])

  // Filter activities
  const filteredActivities = useMemo(() => {
    if (filterType === 'all') return activities
    return activities.filter(a => a.event_type === filterType)
  }, [activities, filterType])

  // Group filtered activities by date
  const groupedActivities = useMemo(() => {
    return groupEventsByDate(filteredActivities)
  }, [filteredActivities])

  // Export to CSV
  const handleExport = () => {
    const csvData = exportToCSV(
      filteredActivities.map(a => ({
        event_type: a.event_type,
        timestamp: a.timestamp,
        organization: a.organization_name || '',
        details: a.event_details ? JSON.stringify(a.event_details) : '',
      })),
      [
        { key: 'event_type', label: 'Event Type' },
        { key: 'timestamp', label: 'Timestamp' },
        { key: 'organization', label: 'Organization' },
        { key: 'details', label: 'Details' },
      ]
    )

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${user.name.replace(/\s+/g, '_')}_activity.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Calculate date range
  const dateRange = activities.length > 0
    ? {
        start: new Date(activities[activities.length - 1].timestamp),
        end: new Date(activities[0].timestamp),
      }
    : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-dark-card border-l border-dark-border shadow-2xl z-50 flex flex-col animate-slideInRight">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border bg-dark-surface">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{user.name}</h2>
              <p className="text-gray-400 text-sm truncate">{user.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full font-medium">
                  {user.totalEvents} events
                </span>
                {dateRange && (
                  <span className="text-gray-500 text-xs">
                    {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-dark-surface rounded-lg transition-colors ml-4"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="px-6 py-3 border-b border-dark-border bg-dark-surface/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-dark-card border border-dark-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
            >
              <option value="all">All Events</option>
              {eventTypes.map(type => (
                <option key={type} value={type}>
                  {getEventIcon(type)} {formatEventType(type)}
                </option>
              ))}
            </select>
            <span className="text-gray-500 text-sm">
              Showing {filteredActivities.length} events
            </span>
          </div>
          <button
            onClick={handleExport}
            disabled={filteredActivities.length === 0}
            className="px-3 py-2 bg-primary/20 text-primary text-sm rounded-lg hover:bg-primary/30 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-3 text-slate-400">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading activities...
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-red-400">{error}</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📭</span>
              </div>
              <h3 className="text-white font-medium mb-1">No Activity Found</h3>
              <p className="text-gray-400 text-sm">
                {filterType === 'all'
                  ? 'This user has no recorded activity.'
                  : `No "${formatEventType(filterType)}" events found.`}
              </p>
            </div>
          ) : (
            <div className="p-4">
              {Array.from(groupedActivities.entries()).map(([dateGroup, events]) => (
                <div key={dateGroup} className="mb-6">
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 sticky top-0 bg-dark-card py-2">
                    {dateGroup}
                  </h3>
                  <div className="space-y-3">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="bg-dark-surface border border-dark-border rounded-lg p-3 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl flex-shrink-0">
                            {getEventIcon(event.event_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-white font-medium">
                                {formatEventType(event.event_type)}
                              </span>
                              <span className="text-gray-500 text-xs whitespace-nowrap">
                                {formatRelativeTime(new Date(event.timestamp))}
                              </span>
                            </div>
                            {event.organization_name && (
                              <div className="text-sm text-gray-400 mt-0.5">
                                {event.organization_name}
                              </div>
                            )}
                            {renderEventDetails(event.event_details)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slideInRight {
          animation: slideInRight 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
