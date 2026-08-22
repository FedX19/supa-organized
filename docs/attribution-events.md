# MDC Track — Event dictionary

Growth agents use this digest. Default Command / Funnel totals **exclude** `is_bot=true`. Use `?include_bots=1` to include.

## Collect

```
POST https://supa-organized.vercel.app/api/public/mdc-track
```

Single event or `{ "events": [ ... ] }`. Response: `{ ok, accepted, deduped, bots, ids }`.

### Shared fields

| Field | Notes |
| --- | --- |
| `property` | `website` (MDC) or `unite` (UniteHQ) |
| `event_type` | See below |
| `session_id` | Stitches MDC → UniteHQ |
| `id` / `event_id` | Client UUID — retries do not double-count |
| `source`, `medium`, `campaign`, `content`, `term` | UTMs from landing URL |
| `meta` | Non-PII: form_type, label, href, plan, amount |

## Event types

| Type | Fires when | Property |
| --- | --- | --- |
| `page_view` | Page load | website / unite |
| `cta_click` | Primary CTAs (Get Started, league, coach, membership) | website |
| `form_submit` | Successful coach/league form (same moment as email) | website · `meta.form_type` |
| `checkout_started` | Subscribe / activate on UniteHQ | unite |
| `purchase_completed` | Stripe webhook or paid success | unite |

## Hygiene

- `event_id` dedupe via upsert PK
- `is_bot` from UA + Ashburn/preview heuristics; raw kept
- Sources group `source::campaign` for email UTM attribution

## Stripe

```
POST /api/public/mdc-track/stripe
```

Events: `checkout.session.completed`, `invoice.paid`. Revenue MRR panel stays on separate Stripe sync.

## Migration

`supabase/migrations/20260822120000_attribution_conversion_hygiene.sql` — additive only (`is_bot`, `meta`, `term`).

## MDC site instrumentation

Marketing site already beacons `page_view` + Unite CTA clicks. Wire:

1. `form_submit` on partnership form success (`meta.form_type=coach|league`)
2. `cta_click` with `label` + `href` on primary CTAs
3. Optional server backup in `/api/partnership-request`

## Out of scope / TODO

- League bulk payment link events
- UniteHQ invite/seat_activated (wait for Usage tables)
