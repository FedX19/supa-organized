'use client'

// Full logo with text (for login/signup pages and sidebar desktop)
export function FullLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 60"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SupaOrganized"
    >
      <rect x="4" y="10" width="16" height="20" rx="2" fill="#f59e0b" opacity="0.3"/>
      <rect x="12" y="15" width="16" height="20" rx="2" fill="#f59e0b" opacity="0.6"/>
      <rect x="20" y="20" width="16" height="20" rx="2" fill="#f59e0b"/>
      <circle cx="28" cy="30" r="3" fill="white"/>
      <text x="50" y="38" fontFamily="system-ui, -apple-system, sans-serif" fontSize="24" fontWeight="bold" fill="white">SupaOrganized</text>
    </svg>
  )
}

// Icon-only logo (for mobile sidebar and favicon)
export function IconLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 60"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SupaOrganized"
    >
      <rect x="8" y="15" width="20" height="25" rx="3" fill="#f59e0b" opacity="0.3"/>
      <rect x="16" y="20" width="20" height="25" rx="3" fill="#f59e0b" opacity="0.6"/>
      <rect x="24" y="25" width="20" height="25" rx="3" fill="#f59e0b"/>
      <circle cx="34" cy="37.5" r="4" fill="white"/>
      <path d="M 32 37.5 L 36 37.5 M 34 35.5 L 34 39.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// Responsive logo that switches between full and icon
export function ResponsiveLogo() {
  return (
    <>
      <FullLogo className="hidden sm:block w-44 h-11" />
      <IconLogo className="block sm:hidden w-10 h-10" />
    </>
  )
}
