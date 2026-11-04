'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createSupabaseClient } from '@/lib/supabase'
import { AttributionShell } from '@/components/attribution/AttributionShell'

type Game = { opens: number; completedRecords: number; uniqueAccounts: number; byMode: { mode: string; completedRecords: number }[] }
type Report = { days: number; website: { pageViews: number }; unite: { pageViews: number }; arcade: Game; fundy: Game; caveat: string }
const format = (x: number) => x.toLocaleString('en-US')
export default function EcosystemPage() {
  const [days, setDays] = useState<7 | 30>(30)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await createSupabaseClient().auth.getSession()
      if (!session) throw new Error('Please sign in')
      const res = await fetch('/api/attribution/ecosystem?days=' + days, { cache: 'no-store',
        headers: { Authorization: 'Bearer ' + session.access_token } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Report unavailable')
      setReport(json as Report); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Report unavailable') }
    finally { setLoading(false) }
  }, [days])
  useEffect(() => { void refresh() }, [refresh])
  const cards = report ? [
    { name: 'MDC Website', detail: 'Recorded page views', value: report.website.pageViews, url: '/attribution/website', color: 'text-teal-300' },
    { name: 'UniteHQ', detail: 'Recorded page views', value: report.unite.pageViews, url: '/attribution/unite', color: 'text-indigo-300' },
    { name: 'MD Arcade', detail: 'Saved game records', value: report.arcade.completedRecords, url: '#arcade', color: 'text-orange-300' },
    { name: 'Fundy Ball', detail: 'Completed rounds', value: report.fundy.completedRecords, url: '#fundy', color: 'text-emerald-300' },
  ] : []
  return <AttributionShell activeNav="ecosystem">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div><h1 className="text-3xl font-semibold text-white">MDC Ecosystem</h1>
        <p className="text-slate-400 text-sm mt-1">Four connected products. Real saved gameplay and recorded traffic in one place.</p></div>
      <div className="flex gap-2">
        {[7,30].map(n => <button key={n} onClick={() => setDays(n as 7 | 30)} className={`rounded-lg px-3 py-2 text-sm border ${days === n ? 'bg-teal-400 text-slate-950 border-teal-400' : 'border-slate-700 text-slate-300'}`}>{n} days</button>)}
        <button onClick={() => void refresh()} className="border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300">Refresh</button>
      </div>
    </div>
    {loading && <p className="text-slate-400 mb-4" role="status">Updating report…</p>}
    {error && <p role="alert" className="text-amber-300 mb-4">{error}. Check that the UniteHQ connection is configured in SupaOrganized.</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
      {cards.map(c => <Link href={c.url} key={c.name} className="rounded-2xl bg-card border border-card-border p-5 hover:border-teal-500/50">
        <p className="text-slate-400 text-sm">{c.name}</p>
        <p className={`text-3xl font-semibold mt-2 ${c.color}`}>{format(c.value)}</p>
        <p className="text-xs text-slate-500 mt-1">{c.detail}</p>
      </Link>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      {report && (['arcade','fundy'] as const).map(k => <section key={k} id={k} className="rounded-2xl bg-card border border-card-border p-5">
        <h2 className="font-semibold text-white text-xl">{k === 'arcade' ? 'MD Arcade' : 'Fundy Ball'}</h2>
        <div className="mt-3 flex flex-wrap gap-5 text-sm"><p className="text-slate-400"><strong className="text-white">{format(report[k].opens)}</strong> recorded opens</p><p className="text-slate-400"><strong className="text-white">{format(report[k].uniqueAccounts)}</strong> distinct playing accounts</p></div>
        <div className="mt-4 space-y-3">{report[k].byMode.map(mode => <div key={mode.mode} className="flex justify-between gap-4 border-b border-card-border pb-2 text-sm"><span className="text-slate-300">{mode.mode.replaceAll('_',' ')}</span><span className="font-medium text-white">{format(mode.completedRecords)}</span></div>)}</div>
      </section>)}
    </div>
    {report && <p className="mt-6 text-xs text-slate-500">{report.caveat} Website and UniteHQ counts are recorded events, not deduplicated humans. Geographic and historical counts require cleanup before use in marketing decisions.</p>}
  </AttributionShell>
}
