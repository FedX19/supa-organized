import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SupaOrganized - Master Your Supabase Users',
  description: 'Search and manage your Supabase users with ease. Connect your database and get instant insights into your users, organizations, and teams.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-background min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
