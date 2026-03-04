export type OrgWeeklyStats = {
  orgId: string
  orgName: string
  orgType: string
  logins: {
    current: number
    prior: number
    byRole: { platform_admin: number; admin: number; coach: number; parent: number; unknown: number }
  }
  activeUsers: {
    current: number
    prior: number
  }
  activityEvents: number
  funnel: {
    evaluationsSubmitted: number
    coachesWhoSubmitted: number
    plansGenerated: number
    parentOpens: number
    uniqueParents: number
    openRate: number | null
    medianHoursToOpen: number | null
    p75HoursToOpen: number | null
    funnelBroken: boolean
  }
  topFeatures: Array<{ feature: string; event_count: number; unique_users: number }>
  errors: {
    total: number
    rate: number
    topErrors: Array<{ feature: string; error_code: string; count: number }>
  }
  isGhost: boolean
  isCoachOnly: boolean
  hasAnyActivity: boolean
}

export type Alert = {
  orgId: string
  orgName: string
  message: string
  severity: 'critical' | 'warning' | 'info'
}

export type PlatformTotals = {
  totalLogins: { current: number; prior: number; delta: number }
  totalActiveUsers: { current: number; prior: number; delta: number }
  totalEvaluations: { current: number; prior: number; delta: number }
  totalPlansGenerated: { current: number; prior: number; delta: number }
  totalParentOpens: { current: number; prior: number; delta: number }
  platformOpenRate: number | null
  totalErrors: number
  errorRate: number
}

export type WeeklyReportData = {
  weekStart: string
  weekEnd: string
  generatedAt: string
  platform: PlatformTotals
  orgs: OrgWeeklyStats[]
  alerts: Alert[]
}
