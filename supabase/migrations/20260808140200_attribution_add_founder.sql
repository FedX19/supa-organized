-- =============================================================================
-- Grant founder admin access to MDC Attribution workspace
-- Run AFTER 20260808140000_attribution_product.sql
-- Safe to re-run: ON CONFLICT DO NOTHING
-- =============================================================================

insert into public.attribution_workspace_members (workspace_id, user_id, role)
select w.id, '6d0e82e5-8123-4a00-a963-e1d8a5449de4'::uuid, 'admin'
from public.attribution_workspaces w
where w.slug = 'mdc'
on conflict (workspace_id, user_id) do nothing;
