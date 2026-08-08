'use client'

import { useCallback, useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import type { DualAnalytics } from './analytics'
import { emptyAnalytics } from './analytics'
import type { AttributionEvent } from './types'

async function getToken(): Promise<string | null> {
  const supabase = createSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token) return session.access_token
  const { data } = await supabase.auth.refreshSession()
  return data.session?.access_token ?? null
}

export function useAttributionSummary(pollMs = 5000) {
  const [analytics, setAnalytics] = useState<DualAnalytics>(emptyAnalytics())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [eventCount, setEventCount] = useState(0)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) {
        setError('Not signed in')
        setLoading(false)
        return
      }
      const res = await fetch('/api/attribution/summary?limit=500', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        setMigrationRequired(Boolean(data.migrationRequired))
        setLoading(false)
        return
      }
      setAnalytics(data.analytics)
      setEventCount(data.eventCount ?? 0)
      setError(null)
      setMigrationRequired(false)
      setLastFetchedAt(new Date().toISOString())
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), pollMs)
    return () => window.clearInterval(id)
  }, [refresh, pollMs])

  return { analytics, loading, error, eventCount, migrationRequired, lastFetchedAt, refresh }
}

export function useAttributionEvents(property?: 'website' | 'unite', pollMs = 5000) {
  const [events, setEvents] = useState<AttributionEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) {
        setError('Not signed in')
        setLoading(false)
        return
      }
      const qs = new URLSearchParams({ limit: '100' })
      if (property) qs.set('property', property)
      const res = await fetch(`/api/attribution/events?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        setLoading(false)
        return
      }
      setEvents(data.events ?? [])
      setError(null)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setLoading(false)
    }
  }, [property])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), pollMs)
    return () => window.clearInterval(id)
  }, [refresh, pollMs])

  return { events, loading, error, refresh }
}
