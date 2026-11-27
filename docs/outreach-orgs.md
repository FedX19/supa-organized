# Outreach orgs

Cold email to a league or travel team should use one clean link:

```
https://www.modern-day-coach.com/leagues?o=ll-westfield&c=ll-nov-2026
```

`o` is the org code. `c` is the batch. Do not put a name or email in the URL.

## Mint

From the modern-day-coach repo (the same script is in `scripts/mint-org-links.mjs` here):

```bash
node scripts/mint-org-links.mjs batch.csv --out links.csv
MDC_TRACK_FORWARD_SECRET=... node scripts/mint-org-links.mjs batch.csv --register
```

CSV header: `name,type,email,batch_date,campaign,path,code`

`type` is `little_league`, `travel`, or `other`. `--register` upserts the registry. It needs migration `supabase/migrations/20261127180000_outreach_orgs.sql` in the SupaOrganized Supabase project. Visits still store `o` before that migration; the Orgs page shows the code until a name is registered.

The secret is the existing `MDC_TRACK_FORWARD_SECRET` (already set on both Vercel projects). Do not commit it.

Our own agents add `mdc_agent=1` or the header `X-MDC-Actor: agent`. Those hits are kept and tagged `agent`, and they stay out of the default human totals.

## Dashboard

Open **MDC Track → Orgs** (`/attribution/orgs`).

Default is humans only. **Including bots** in the sidebar adds scanners, no-JS hits, headless browsers, monitors, and our agents.

Columns: org, type, email, batch, first visit, last visit, sessions, pages, signup click, UniteHQ click.

Signup is a `/contact` view, a partnership form submit, or a league onboard click. UniteHQ is a click whose destination contains `unite-hq.com`.
