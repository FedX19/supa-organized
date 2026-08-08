'use client'

import { useEffect, useState } from 'react'
import { AttributionShell } from '@/components/attribution/AttributionShell'
import { createSupabaseClient } from '@/lib/supabase'

export default function AttributionSetupPage() {
  const [origin, setOrigin] = useState('')
  const [health, setHealth] = useState<{
    ok?: boolean
    last24h?: number
    collectPath?: string
    migrationRequired?: boolean
    error?: string
  } | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createSupabaseClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch('/api/attribution/health', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        })
        const data = await res.json()
        if (!cancelled) setHealth(data)
      } catch (err) {
        if (!cancelled) {
          setHealth({
            ok: false,
            error: err instanceof Error ? err.message : 'health check failed',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const collectUrl = origin
    ? `${origin}/api/public/mdc-track`
    : 'https://YOUR-SUPA-ORGANIZED-HOST/api/public/mdc-track'

  return (
    <AttributionShell activeNav="setup">
      <h1 className="text-2xl font-semibold text-white mb-1">Setup & cutover</h1>
      <p className="text-sm text-slate-400 mb-6 max-w-2xl">
        MDC Track lives inside SupaOrganized as a second product. Unite Ops is unchanged. You run
        the SQL migrations in Supabase; then point beacons at the collect URL below.
      </p>

      <Section title="1. Run SQL migrations (you do this)" tone="amber">
        <p className="text-sm text-slate-300 mb-3">
          In the <strong className="text-white">SupaOrganized</strong> Supabase project (not Unite
          HQ), run these files in order from the SQL editor or CLI:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300 font-mono">
          <li>supabase/migrations/20260808140000_attribution_product.sql</li>
          <li>
            supabase/migrations/20260808140100_attribution_add_founder_example.sql{' '}
            <span className="font-sans text-slate-500">(optional — member grant template)</span>
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Creates <code className="text-teal-300">attribution_workspaces</code>,{' '}
          <code className="text-teal-300">attribution_workspace_members</code>,{' '}
          <code className="text-teal-300">attribution_events</code> + RLS. Seeds workspace slug{' '}
          <code className="text-white">mdc</code>. Until you add a member row, any signed-in
          SupaOrganized user can open MDC Track (bootstrap). After the first member, only members.
        </p>
      </Section>

      <Section title="2. Collect endpoint (source of truth)" tone="teal">
        <p className="text-sm text-slate-300 mb-2">Public beacon URL (CORS allowlisted for MDC + Unite):</p>
        <code className="block break-all rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-3 text-sm text-teal-200">
          {collectUrl}
        </code>
        <ul className="mt-3 space-y-1 text-sm text-slate-400">
          <li>
            POST JSON body: single event or <code className="text-slate-300">{'{ events: [...] }'}</code>
          </li>
          <li>
            Fields: property, event_type, path, source, medium, campaign, session_id, device,
            source_label, timezone, locale
          </li>
          <li>City / region / country filled from Vercel edge headers server-side</li>
          <li>Non-PII only — no emails, names, or raw IPs stored</li>
        </ul>
        {health ? (
          <p
            className={`mt-3 text-sm ${
              health.migrationRequired || !health.ok ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {health.migrationRequired
              ? `Health: migrations needed — ${health.error || 'tables missing'}`
              : health.ok
                ? `Health OK · ${health.last24h ?? 0} events in last 24h`
                : `Health: ${health.error || 'not ready'}`}
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Checking health…</p>
        )}
      </Section>

      <Section title="3. modern-day-coach.com beacon" tone="teal">
        <p className="text-sm text-slate-300 mb-2">
          Site already ships <code className="text-white">AttributionTracker</code>. Point it at
          SupaOrganized when you are ready (or leave on Unite during dual-write):
        </p>
        <pre className="overflow-x-auto rounded-lg border border-card-border bg-background/60 p-3 text-xs text-slate-300">
{`# Vercel env on modern-day-coach
NEXT_PUBLIC_MDC_TRACK_URL=${collectUrl}`}
        </pre>
        <p className="mt-2 text-xs text-slate-500">
          Default today is <code className="text-slate-400">https://app.unite-hq.com/api/public/mdc-track</code>.
          Changing this env is the cutover switch for the marketing site.
        </p>
      </Section>

      <Section title="4. Unite HQ dual-write (optional, safe default)" tone="indigo">
        <p className="text-sm text-slate-300 mb-2">
          Unite keeps writing to its own <code className="text-white">mdc_tracking_events</code>.
          When you set the env below, it also fire-and-forgets a copy to SupaOrganized. If unset,
          Unite behaves exactly as today — no break.
        </p>
        <pre className="overflow-x-auto rounded-lg border border-card-border bg-background/60 p-3 text-xs text-slate-300">
{`# Vercel env on unitehq (optional)
MDC_SUPA_TRACK_URL=${collectUrl}
# Optional shared secret (must match SupaOrganized)
MDC_TRACK_FORWARD_SECRET=long-random-string

# Matching secret on SupaOrganized (optional)
MDC_TRACK_FORWARD_SECRET=long-random-string`}
        </pre>
      </Section>

      <Section title="5. Grant yourself permanent access" tone="default">
        <p className="text-sm text-slate-300 mb-2">
          After bootstrap, lock the product to your auth user (from Supabase Auth → Users → copy
          UUID):
        </p>
        <pre className="overflow-x-auto rounded-lg border border-card-border bg-background/60 p-3 text-xs text-slate-300">
{`insert into public.attribution_workspace_members (workspace_id, user_id, role)
select w.id, 'YOUR_AUTH_USER_UUID'::uuid, 'admin'
from public.attribution_workspaces w
where w.slug = 'mdc'
on conflict do nothing;`}
        </pre>
        <p className="mt-2 text-xs text-slate-500">
          Once any member exists, non-members get 403 on attribution APIs.
        </p>
      </Section>

      <Section title="Product map" tone="default">
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className="rounded-xl border border-card-border p-3">
            <p className="font-semibold text-primary">Unite Ops</p>
            <p className="text-slate-400 mt-1">/dashboard — Pulse, orgs, revenue, connections</p>
            <p className="text-xs text-slate-500 mt-2">Unchanged by this merge</p>
          </div>
          <div className="rounded-xl border border-teal-500/30 p-3">
            <p className="font-semibold text-teal-300">MDC Track</p>
            <p className="text-slate-400 mt-1">
              /attribution — command center, website, Unite, funnel, live, setup
            </p>
            <p className="text-xs text-slate-500 mt-2">New product via sidebar switcher</p>
          </div>
        </div>
      </Section>
    </AttributionShell>
  )
}

function Section({
  title,
  children,
  tone = 'default',
}: {
  title: string
  children: React.ReactNode
  tone?: 'default' | 'teal' | 'indigo' | 'amber'
}) {
  const border = {
    default: 'border-card-border',
    teal: 'border-teal-500/25',
    indigo: 'border-indigo-500/25',
    amber: 'border-amber-500/30',
  }[tone]
  return (
    <section className={`mb-4 rounded-2xl border ${border} bg-card p-5`}>
      <h2 className="text-base font-semibold text-white mb-3">{title}</h2>
      {children}
    </section>
  )
}
