# MDC Track (Attribution product)

Hyros-style dual-property tracking for **modern-day-coach.com** + **app.unite-hq.com**, shipped as a second product inside SupaOrganized.

| Product | Route | Status |
| --- | --- | --- |
| **Unite Ops** | `/dashboard` | Unchanged |
| **MDC Track** | `/attribution/*` | New |

## You run these migrations

In the **SupaOrganized** Supabase project (SQL editor or `supabase db push`), apply in order:

1. [`supabase/migrations/20260808140000_attribution_product.sql`](../supabase/migrations/20260808140000_attribution_product.sql) — tables, indexes, RLS, seed workspace `mdc`
2. [`supabase/migrations/20260808140100_attribution_add_founder_example.sql`](../supabase/migrations/20260808140100_attribution_add_founder_example.sql) — no-op template; uncomment to grant yourself admin after you have your `auth.users` UUID

Do **not** run these against Unite HQ’s Supabase. Unite keeps its own optional `mdc_tracking_events` bus.

### Tables created

- `attribution_workspaces` — product tenants (default slug `mdc`)
- `attribution_workspace_members` — who can open the UI/APIs
- `attribution_events` — non-PII hits (path, source, session, device, geo city/region/country, timezone)

### Access bootstrap

- **Zero members** on workspace `mdc` → any authenticated SupaOrganized user can use MDC Track.
- **One or more members** → only listed users (403 otherwise).

## Collect API

```
POST /api/public/mdc-track
GET  /api/public/mdc-track?limit=100   # recent non-PII feed
```

Authenticated product APIs (Bearer session token):

- `GET /api/attribution/summary`
- `GET /api/attribution/events?property=website|unite`
- `GET /api/attribution/health`

## Cutover without breaking live traffic

1. Deploy SupaOrganized with this branch.
2. Run migration `20260808140000`.
3. Confirm Setup page health is green and a test `POST` to `/api/public/mdc-track` returns `202`.
4. **Optional dual-write from Unite** (Unite still stores locally; copies to SupaOrganized):

   ```bash
   # unitehq Vercel env — only when ready
   MDC_SUPA_TRACK_URL=https://YOUR-SUPA-ORGANIZED-HOST/api/public/mdc-track
   MDC_TRACK_FORWARD_SECRET=optional-shared-secret
   ```

5. **Optional cutover for marketing site** (MDC):

   ```bash
   # modern-day-coach Vercel env
   NEXT_PUBLIC_MDC_TRACK_URL=https://YOUR-SUPA-ORGANIZED-HOST/api/public/mdc-track
   ```

If env vars are unset, existing Unite collect + MDC default URL keep working as before.

## Env (SupaOrganized)

Existing vars are enough for the product UI. Optional:

| Variable | Purpose |
| --- | --- |
| `MDC_TRACK_FORWARD_SECRET` | If set, dual-write requests that send `X-MDC-Forward-Secret` must match |

No new required secrets beyond existing Supabase service role (collect uses service role to insert, bypassing RLS).
