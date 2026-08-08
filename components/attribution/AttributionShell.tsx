'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { Sidebar, MobileMenuButton } from '@/components/Sidebar'

export function AttributionShell({
  children,
  activeNav,
}: {
  children: React.ReactNode
  activeNav: string
}) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [ready, setReady] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      setUserEmail(session.user.email || 'user')
      setReady(true)
    })
  }, [router])

  const handleLogout = async () => {
    const supabase = createSupabaseClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        userEmail={userEmail}
        onLogout={handleLogout}
        product="attribution"
        activeView={activeNav}
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-card-border bg-background/90 px-4 py-3 backdrop-blur">
          <MobileMenuButton onClick={() => setMobileOpen(true)} />
          <span className="font-semibold text-white">MDC Track</span>
        </div>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
