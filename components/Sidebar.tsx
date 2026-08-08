'use client'

import Link from 'next/link'
import { FullLogo } from '@/components/Logo'

export type ProductId = 'ops' | 'attribution'

interface SidebarProps {
  userEmail: string
  onLogout: () => void
  activeView?: string
  connectionName?: string
  isOpen?: boolean
  onClose?: () => void
  /** Default ops — existing UniteHQ product */
  product?: ProductId
}

const opsNav = [
  {
    name: 'Pulse',
    view: 'pulse',
    href: '/dashboard?view=pulse',
    iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    name: 'Dashboard',
    view: 'dashboard',
    href: '/dashboard',
    iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    name: 'Analytics',
    view: 'analytics',
    href: '/dashboard?view=analytics',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    name: 'Revenue',
    view: 'revenue',
    href: '/dashboard?view=revenue',
    iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    name: 'Connections',
    view: 'connections',
    href: '/dashboard?view=connections',
    iconPath: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  },
] as const

const attributionNav = [
  {
    name: 'Command center',
    view: 'command',
    href: '/attribution',
    iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    name: 'MDC',
    view: 'website',
    href: '/attribution/website',
    iconPath: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  },
  {
    name: 'UniteHQ',
    view: 'unite',
    href: '/attribution/unite',
    iconPath: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    name: 'Funnel',
    view: 'funnel',
    href: '/attribution/funnel',
    iconPath: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z',
  },
  {
    name: 'Live feed',
    view: 'live',
    href: '/attribution/live',
    iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    name: 'Setup',
    view: 'setup',
    href: '/attribution/setup',
    iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  },
] as const

export function Sidebar({
  userEmail,
  onLogout,
  activeView,
  connectionName,
  isOpen = false,
  onClose,
  product = 'ops',
}: SidebarProps) {
  const navItems = product === 'attribution' ? attributionNav : opsNav

  const handleNavClick = () => {
    if (onClose) onClose()
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-sidebar min-h-screen flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6">
          <Link
            href={product === 'attribution' ? '/attribution' : '/dashboard'}
            className="flex items-center transition-transform hover:scale-[1.02]"
            onClick={handleNavClick}
          >
            <FullLogo className="w-44 h-11" />
          </Link>
        </div>

        {/* Product switcher — two products, one shell */}
        <div className="px-4 mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">
            Product
          </p>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-700 bg-slate-900/50 p-1">
            <Link
              href="/dashboard"
              onClick={handleNavClick}
              className={`rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors min-h-[40px] flex items-center justify-center ${
                product === 'ops'
                  ? 'bg-primary text-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              UniteHQ Ops
            </Link>
            <Link
              href="/attribution"
              onClick={handleNavClick}
              className={`rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors min-h-[40px] flex items-center justify-center ${
                product === 'attribution'
                  ? 'bg-teal-400 text-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              MDC Track
            </Link>
          </div>
        </div>

        {product === 'ops' && connectionName && (
          <div className="px-4 mb-4">
            <div className="bg-dark-surface border border-dark-border rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-gray-400 truncate">{connectionName}</span>
              </div>
            </div>
          </div>
        )}

        {product === 'attribution' && (
          <div className="px-4 mb-4">
            <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2">
              <p className="text-[11px] text-teal-200/90 leading-snug">
                modern-day-coach.com · app.unite-hq.com
              </p>
            </div>
          </div>
        )}

        <nav className="flex-1 px-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                activeView === item.view ||
                (!activeView && item.view === (product === 'ops' ? 'dashboard' : 'command'))
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={handleNavClick}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors min-h-[48px] ${
                      isActive
                        ? product === 'attribution'
                          ? 'bg-teal-400/10 text-teal-300'
                          : 'bg-primary/10 text-primary'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                    }`}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.iconPath} />
                    </svg>
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-slate-300 font-medium text-sm">
                {userEmail.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{userEmail}</p>
              <button
                onClick={() => {
                  onLogout()
                  if (onClose) onClose()
                }}
                className="text-xs text-slate-400 hover:text-primary transition-colors min-h-[32px]"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
      aria-label="Open menu"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  )
}
