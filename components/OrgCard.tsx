'use client'

import { OrganizationCard, getOrgTypeDisplay } from '@/lib/supabase'

interface OrgCardProps {
  org: OrganizationCard
  onClick: () => void
}

export function OrgCard({ org, onClick }: OrgCardProps) {
  const typeDisplay = getOrgTypeDisplay(org.type)

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-card-border rounded-xl p-6 hover:border-primary/50 hover:bg-card-hover transition-all duration-200 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <span className="text-primary font-bold text-lg">
              {org.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg group-hover:text-primary transition-colors">
              {org.name}
            </h3>
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${typeDisplay.bgColor} ${typeDisplay.color}`}>
              {typeDisplay.label}
            </span>
          </div>
        </div>
        <svg
          className="w-5 h-5 text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-background/50 rounded-lg">
          <p className="text-2xl font-bold text-white">{org.staffCount}</p>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Staff</p>
        </div>
        <div className="text-center p-3 bg-background/50 rounded-lg">
          <p className="text-2xl font-bold text-white">{org.memberCount}</p>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Members</p>
        </div>
        <div className="text-center p-3 bg-background/50 rounded-lg">
          <p className="text-2xl font-bold text-primary">{org.playerCount}</p>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Players</p>
        </div>
      </div>
    </button>
  )
}

// Skeleton loader for org cards
export function OrgCardSkeleton() {
  return (
    <div className="bg-card border border-card-border rounded-xl p-6 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 bg-slate-700 rounded-xl" />
        <div className="flex-1">
          <div className="h-5 bg-slate-700 rounded w-32 mb-2" />
          <div className="h-4 bg-slate-800 rounded w-20" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-background/50 rounded-lg">
          <div className="h-8 bg-slate-700 rounded w-8 mx-auto mb-2" />
          <div className="h-3 bg-slate-800 rounded w-12 mx-auto" />
        </div>
        <div className="p-3 bg-background/50 rounded-lg">
          <div className="h-8 bg-slate-700 rounded w-8 mx-auto mb-2" />
          <div className="h-3 bg-slate-800 rounded w-12 mx-auto" />
        </div>
        <div className="p-3 bg-background/50 rounded-lg">
          <div className="h-8 bg-slate-700 rounded w-8 mx-auto mb-2" />
          <div className="h-3 bg-slate-800 rounded w-12 mx-auto" />
        </div>
      </div>
    </div>
  )
}
