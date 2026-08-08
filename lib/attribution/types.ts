export type AttributionProperty = 'website' | 'unite' | 'email' | 'call'

export type AttributionEvent = {
  id: string
  workspace_id?: string
  created_at: string
  property: AttributionProperty | string
  event_type: string
  path?: string | null
  source?: string | null
  medium?: string | null
  campaign?: string | null
  content?: string | null
  referrer?: string | null
  landing_url?: string | null
  session_id?: string | null
  device?: string | null
  source_label?: string | null
  timezone?: string | null
  locale?: string | null
  country?: string | null
  region?: string | null
  city?: string | null
}

export type AttributionEventInput = {
  property?: string
  event_type?: string
  type?: string
  path?: string
  source?: string
  medium?: string
  campaign?: string
  content?: string
  referrer?: string
  landing_url?: string
  session_id?: string
  device?: string
  source_label?: string
  timezone?: string
  locale?: string
  country?: string
  region?: string
  city?: string
  id?: string
  created_at?: string
}
