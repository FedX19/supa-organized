// Plan Funnel Types for SupaOrganized
// Read-only analytics derived from UniteHQ operational tables

export type RangeType = '7d' | '30d' | 'all'

export interface FunnelStep {
  step: number
  name: string
  source: 'generated_plans' | 'notifications' | 'email_outbox' | 'user_activity'
  count: number
  unique_users: number
  conversion_from_prior: number | null
  dropoff_pct: number | null
  has_data: boolean
  note?: string
}

export interface FunnelSummary {
  plansCreated: number
  notificationRate: number | null
  emailSendRate: number | null
  deliveryRate: number | null
  readRate: number | null
  viewRate: number | null
  overallConversion: number | null
  emailFailures: number
}

export interface PlanStepStatus {
  notified: boolean
  emailed: boolean
  delivered: boolean
  read: boolean
  viewed: boolean
}

export interface PlanBreakdownItem {
  plan_id: string
  player_id: string
  guardian_profile_id: string
  parent_email: string
  created_at: string
  reached_step: number
  steps: PlanStepStatus
}

export interface FailedEmail {
  outbox_id: string
  profile_id: string
  last_error: string | null
  created_at: string
  attempts: number
}

export interface UnreadNotification {
  notification_id: string
  profile_id: string
  created_at: string
  days_unread: number
}

export interface NeverViewedPlan {
  plan_id: string
  player_id: string
  created_at: string
  days_since_created: number
}

export interface FunnelDrilldown {
  failedEmails: FailedEmail[]
  unreadNotifications: UnreadNotification[]
  neverViewedPlans: NeverViewedPlan[]
}

export interface PlanFunnelResponse {
  org_id: string
  range: RangeType
  generatedAt: string
  hasData: boolean
  funnel: FunnelStep[]
  summary: FunnelSummary
  planBreakdown: PlanBreakdownItem[]
  drilldown: FunnelDrilldown
}

// Internal query result types
export interface PlanRow {
  plan_id: string
  player_id: string
  guardian_profile_id: string
  parent_email: string
  created_at: string
}

export interface NotificationRow {
  notification_id: string
  profile_id: string
  created_at: string
  plan_id: string | null
  read_at: string | null
}

export interface EmailRow {
  outbox_id: string
  profile_id: string
  created_at: string
  status: string
  plan_id: string | null
  sent_at: string | null
  last_error: string | null
  attempts: number
}

export interface ViewRow {
  profile_id: string
  plan_id: string | null
  timestamp: string
}
