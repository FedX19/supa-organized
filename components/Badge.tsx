'use client'

interface BadgeProps {
  variant: 'role' | 'status' | 'member'
  children: React.ReactNode
}

// Get role-specific colors
function getRoleColors(role: string): { bg: string; text: string; border: string } {
  const roleLower = role.toLowerCase()

  switch (roleLower) {
    case 'admin':
    case 'owner':
      return {
        bg: 'bg-red-900/20',
        text: 'text-red-400',
        border: 'border-red-800/30',
      }
    case 'coach':
      return {
        bg: 'bg-blue-900/20',
        text: 'text-blue-400',
        border: 'border-blue-800/30',
      }
    case 'manager':
      return {
        bg: 'bg-purple-900/20',
        text: 'text-purple-400',
        border: 'border-purple-800/30',
      }
    case 'staff':
      return {
        bg: 'bg-green-900/20',
        text: 'text-green-400',
        border: 'border-green-800/30',
      }
    default:
      return {
        bg: 'bg-slate-800',
        text: 'text-slate-400',
        border: 'border-slate-700',
      }
  }
}

export function Badge({ variant, children }: BadgeProps) {
  if (variant === 'status') {
    // Orange "ON" style badge
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase bg-primary/10 text-primary border border-primary/30">
        {children}
      </span>
    )
  }

  if (variant === 'member') {
    // Gray member badge
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase bg-slate-800 text-slate-400 border border-slate-700">
        {children}
      </span>
    )
  }

  // Role badge with dynamic colors
  const roleText = typeof children === 'string' ? children : 'member'
  const colors = getRoleColors(roleText)

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase ${colors.bg} ${colors.text} border ${colors.border}`}>
      {children}
    </span>
  )
}

export function RoleBadge({ role }: { role: string }) {
  if (role === '-' || role === 'member') {
    return <Badge variant="member">{role === '-' ? 'None' : 'Member'}</Badge>
  }
  return <Badge variant="role">{role}</Badge>
}
