'use client'

import Link from 'next/link'
import { FullLogo, IconLogo } from '@/components/Logo'

interface SidebarProps {
  userEmail: string
  onLogout: () => void
  activeView?: string
  connectionName?: string
}

export function Sidebar({ userEmail, onLogout, activeView, connectionName }: SidebarProps) {
  const navItems = [
    {
      name: 'Dashboard',
      view: 'dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Analytics',
      view: 'analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: 'Connections',
      view: 'connections',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
  ]

  return (
    <div className="w-64 bg-sidebar min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-4 sm:p-6">
        <Link href="/dashboard" className="flex items-center justify-center sm:justify-start transition-transform hover:scale-[1.02]">
          <FullLogo className="hidden sm:block w-44 h-11" />
          <IconLogo className="block sm:hidden w-10 h-10" />
        </Link>
      </div>

      {/* Connection indicator */}
      {connectionName && (
        <div className="px-4 mb-4">
          <div className="bg-dark-surface border border-dark-border rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-400 truncate">{connectionName}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeView === item.view || (!activeView && item.view === 'dashboard')
            return (
              <li key={item.name}>
                <Link
                  href={`/dashboard${item.view !== 'dashboard' ? `?view=${item.view}` : ''}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User profile */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
            <span className="text-slate-300 font-medium text-sm">
              {userEmail.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{userEmail}</p>
            <button
              onClick={onLogout}
              className="text-xs text-slate-400 hover:text-primary transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
