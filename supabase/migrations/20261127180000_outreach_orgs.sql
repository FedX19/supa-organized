-- Outreach org registry for MDC Track.
-- Run in the SupaOrganized Supabase project after the earlier attribution migrations.
-- Safe to re-run. Does not wipe attribution_events except known wiring-probe rows.

create table if not exists public.attribution_orgs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.attribution_workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  org_type text not null check (org_type in ('little_league', 'travel', 'other')),
  email text,
  batch_date date,
  campaign text,
  path text not null default '/leagues',
  created_at timestamptz not null default now(),
  constraint attribution_orgs_code_format check (code ~ '^[a-z0-9][a-z0-9-]{0,40}$'),
  unique (workspace_id, code)
);

comment on table public.attribution_orgs is
  'Which outreach link code belongs to which league or travel organization. Email is the inbox we wrote to, not a site visitor.';
comment on column public.attribution_orgs.email is
  'Outreach recipient. Never collected from modern-day-coach.com traffic.';

create index if not exists attribution_orgs_workspace_idx
  on public.attribution_orgs (workspace_id, name);

create index if not exists attribution_events_org_code_idx
  on public.attribution_events (workspace_id, ((meta->>'org_code')))
  where meta ? 'org_code';

alter table public.attribution_orgs enable row level security;

drop policy if exists attribution_orgs_select on public.attribution_orgs;
create policy attribution_orgs_select
  on public.attribution_orgs
  for select
  to authenticated
  using (
    public.is_attribution_workspace_member(workspace_id)
    or not exists (
      select 1 from public.attribution_workspace_members m
      where m.workspace_id = attribution_orgs.workspace_id
    )
  );

-- Service role inserts from /api/attribution/orgs. No client write policy.

-- Wiring probes sent while confirming the collect path. Not real visits.
delete from public.attribution_events
where campaign = 'agent-wiring-probe'
   or campaign like 'mdc-test-%'
   or id in (
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222',
     '44444444-4444-4444-8444-444444444444',
     '55555555-5555-4555-8555-555555555555',
     '66666666-6666-4666-8666-666666666666'
   );
