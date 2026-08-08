-- =============================================================================
-- MDC Attribution product (Hyros-style dual-property tracking)
-- Run in SupaOrganized's Supabase project (NOT Unite HQ).
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS patterns.
-- =============================================================================

-- Workspaces (default: Modern Day Coach)
create table if not exists public.attribution_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Modern Day Coach',
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- Who can open the Attribution product UI/APIs
create table if not exists public.attribution_workspace_members (
  workspace_id uuid not null references public.attribution_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists attribution_workspace_members_user_id_idx
  on public.attribution_workspace_members (user_id);

-- Durable non-PII tracking events (website + Unite HQ)
create table if not exists public.attribution_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.attribution_workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  property text not null check (property in ('website', 'unite', 'email', 'call')),
  event_type text not null,
  path text,
  source text,
  medium text,
  campaign text,
  content text,
  referrer text,
  landing_url text,
  session_id text,
  device text,
  source_label text,
  timezone text,
  locale text,
  country text,
  region text,
  city text
);

create index if not exists attribution_events_workspace_created_idx
  on public.attribution_events (workspace_id, created_at desc);

create index if not exists attribution_events_workspace_property_idx
  on public.attribution_events (workspace_id, property, created_at desc);

create index if not exists attribution_events_source_idx
  on public.attribution_events (workspace_id, source);

create index if not exists attribution_events_session_idx
  on public.attribution_events (session_id);

create index if not exists attribution_events_day_idx
  on public.attribution_events (workspace_id, ((created_at at time zone 'UTC')::date));

-- Seed default workspace
insert into public.attribution_workspaces (name, slug)
values ('Modern Day Coach', 'mdc')
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.attribution_workspaces enable row level security;
alter table public.attribution_workspace_members enable row level security;
alter table public.attribution_events enable row level security;

-- Helpers: membership check (security definer so RLS on members doesn't recurse badly)
create or replace function public.is_attribution_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attribution_workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_attribution_workspace_member(uuid) from public;
grant execute on function public.is_attribution_workspace_member(uuid) to authenticated;

-- Workspaces: members can read; also allow read of slug=mdc to any authenticated user
-- when the workspace has ZERO members (bootstrap so founders aren't locked out).
drop policy if exists attribution_workspaces_select on public.attribution_workspaces;
create policy attribution_workspaces_select
  on public.attribution_workspaces
  for select
  to authenticated
  using (
    public.is_attribution_workspace_member(id)
    or (
      slug = 'mdc'
      and not exists (
        select 1 from public.attribution_workspace_members m where m.workspace_id = id
      )
    )
  );

-- Members table: users see own rows; admins of workspace see all (via membership)
drop policy if exists attribution_workspace_members_select on public.attribution_workspace_members;
create policy attribution_workspace_members_select
  on public.attribution_workspace_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_attribution_workspace_member(workspace_id)
  );

-- Events: members can select; bootstrap open when no members on that workspace
drop policy if exists attribution_events_select on public.attribution_events;
create policy attribution_events_select
  on public.attribution_events
  for select
  to authenticated
  using (
    public.is_attribution_workspace_member(workspace_id)
    or not exists (
      select 1 from public.attribution_workspace_members m
      where m.workspace_id = attribution_events.workspace_id
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated clients.
-- Public collect API uses the service role key (bypasses RLS).

comment on table public.attribution_events is
  'Hyros-style non-PII attribution events for modern-day-coach.com + Unite HQ';
comment on table public.attribution_workspaces is
  'Attribution product workspaces inside SupaOrganized';
