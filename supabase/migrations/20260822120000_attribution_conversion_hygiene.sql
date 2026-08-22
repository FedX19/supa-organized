-- Additive conversion + ingest hygiene for MDC Track
-- Does NOT wipe attribution_events.

alter table public.attribution_events
  add column if not exists is_bot boolean not null default false,
  add column if not exists meta jsonb not null default '{}'::jsonb,
  add column if not exists term text;

comment on column public.attribution_events.is_bot is
  'Server-side bot/suspicious classification. Raw events kept; default UI excludes is_bot=true.';
comment on column public.attribution_events.meta is
  'Non-PII event props: form_type, label, href, plan, amount, currency, etc.';
comment on column public.attribution_events.term is
  'utm_term when present on landing URL.';

create index if not exists attribution_events_workspace_bot_idx
  on public.attribution_events (workspace_id, is_bot, created_at desc);

create index if not exists attribution_events_event_type_idx
  on public.attribution_events (workspace_id, event_type, created_at desc);

create index if not exists attribution_events_campaign_idx
  on public.attribution_events (workspace_id, campaign)
  where campaign is not null;
