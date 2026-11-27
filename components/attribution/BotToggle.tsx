'use client'

import { useEffect, useState } from 'react'

export const BOTS_KEY = 'mdc_show_bots'
export const BOTS_EVENT = 'mdc-bots-toggle'

export function readShowBots(): boolean {
  try {
    return sessionStorage.getItem(BOTS_KEY) === '1'
  } catch {
    return false
  }
}

export function BotToggle() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(readShowBots())
  }, [])

  const onClick = () => {
    const next = !show
    setShow(next)
    try {
      sessionStorage.setItem(BOTS_KEY, next ? '1' : '0')
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event(BOTS_EVENT))
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={show}
      className={`w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
        show
          ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
          : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:text-white'
      }`}
    >
      {show ? 'Including bots' : 'Humans only'}
      <span className="mt-0.5 block font-normal text-[11px] text-slate-500">
        {show ? 'Scanners, agents, and no-JS hits are in the totals.' : 'Bots stay in the feed when you turn this on.'}
      </span>
    </button>
  )
}
