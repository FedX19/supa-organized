export type AttributionProperty = 'website' | 'unite' | 'email' | 'call'

/** Canonical event types growth agents should trust. Legacy aliases still accepted. */
export type AttributionEventType =
  | 'page_view'
  | 'cta_click'
  | 'cta_to_unite' // legacy — treated as cta_click toward UniteHQ
  | 'form_submit'
  | 'checkout_started'
  | 'activate_membership'
  | 'purchase'
  | 'purchase_completed'
  | 'visit_from_x'

export type AttributionEventMeta = {
  form_type?: 'coach' | 'league' | string
  label?: string
  href?: string
  page_path?: string
  org_name?: string
  plan?: string
  sku?: string
  amount?: number
  currency?: string
  [key: string]: unknown
}

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
  term?: string | null
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
  is_bot?: boolean
  meta?: AttributionEventMeta | null
}

export type AttributionEventInput = {
  property?: string
  event_type?: string
  /** Alias for event_type on older clients */
  type?: string
  path?: string
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
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
  /** Client-generated UUID for dedupe on retries */
  id?: string
  event_id?: string
  created_at?: string
  is_bot?: boolean
  meta?: AttributionEventMeta
  /** Convenience top-level fields folded into meta */
  label?: string
  href?: string
  form_type?: string
  plan?: string
  sku?: string
  amount?: number
  currency?: string
  org_name?: string
}
