# MDC ecosystem analytics — 2026-11-04

## Production properties
- MDC marketing: https://www.modern-day-coach.com
- UniteHQ: https://app.unite-hq.com
- MD Arcade: https://mdarcade.app
- Fundy Ball: https://fundyball.app

SupaOrganized is the analytics reporting service. `/attribution/ecosystem` uses the current user's encrypted UniteHQ database connection to read aggregate counts from the real saved games. No child names, player records, or scores are copied to SupaOrganized; aggregate counts only.

## Included
- Marketing/Unite page traffic, first-touch attribution and cross-site `mdc_sid` session bridge
- Server-side event deduplication by UUID; legacy event-pair deduplication in reports within five seconds of matching session/action/path
- Authenticated product statistics: actual UniteHQ account creation counts and current active `mdc_individual` memberships
- MD Arcade saved practice, Zone Hunter and completed ranked records (separate modes)
- Fundy Ball successfully completed rounds and distinct acting accounts
- Game `game_opened` events (the recorded opens are not authenticated conversions)
- Canonical `purchase_completed` is accepted only via verified Stripe webhook; client-supplied conversion events are rejected
- Bot and preview exclusion by server UA/origin; manual internal-testing exclusion `?mdc_internal=1` persists for that browser tab's origin/session

## Environment requirements
For accurate real visitor geolocation on the marketing site, set the *same* `MDC_TRACK_FORWARD_SECRET` in modern-day-coach and SupaOrganized production Vercel projects. The website proxy forwards visitor UA and Vercel visitor country/region/city only with that shared secret. Without it, report unknown geography rather than incorrectly treating the collector's Ashburn region as visitor location.

For verified purchase tracking, set `MDC_TRACK_STRIPE_WEBHOOK_SECRET` (or `STRIPE_WEBHOOK_SECRET`) to the Stripe endpoint signing secret in SupaOrganized production. Configure the Stripe webhook to POST `/api/public/mdc-track/stripe` and subscribe to `checkout.session.completed` and `invoice.paid`. Never use the secret in client-side code. The endpoint intentionally fails closed when missing; it never reports an unverified payment as revenue.

For game statistics, the logged-in SupaOrganized account must have its existing UniteHQ connection configured under Connections. This integration makes read-only aggregate queries and does not require another service-role key in Vercel.

## Developer/agent hygiene
- Production visits by coding agents should use `?mdc_internal=1` once per origin/browser tab (e.g. /, /login, game home). The setting is stored in sessionStorage, so it resets when the tab session ends. Preview `.vercel.app` hosts are automatically excluded by first-party trackers.
- Bots with recognizable user agents are flagged by the server. Automated full-browser traffic with normal Chrome UA is indistinguishable from genuine humans unless voluntarily tagged, so it must not be presented as 100% bot-proof.
- Do not automatically classify `chatgpt.com` referrals as bots: humans can legitimately click a ChatGPT recommendation.
- The game tables include founder/test accounts until an authenticated internal profile exclusion is added. Do not call all game activity external engagement until that is reconciled.

## Smoke tests
1. Verify all five Vercel preview deployments build successfully.
2. On a test visit from each production domain, verify only one event with its ID reaches `attribution_events`. A visit to MDC should preserve `mdc_sid` on outbound Unite link.
3. Verify `?mdc_internal=1` and preview domains do not appear in human metrics.
4. Verify /api/public/mdc-track GET returns 401 and bogus `purchase_completed` POST returns 403.
5. Verify a correctly signed Stripe fixture writes exactly one event and an invalid signature writes none.
6. Reconcile dashboard Fundy rounds and Arcade records with UniteHQ saved tables, and reconcile new accounts with `profiles.created_at` and active members with `profile_memberships`.
7. Spot-check one real Vercel visitor geolocation once a shared forward secret is present.

## Historical data
Raw historical events are retained. Reports apply conservative heuristics to legacy duplicates; previous incorrect Ashburn location values remain in historical rows and should not be treated as real visitors. Data cleanup must be explicit and reversible.
