import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SupaOrganized - Master Your Supabase Users',
  description: 'Search and manage your Supabase users with ease. Connect your database and get instant insights into your users, organizations, and teams.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SupaOrganized',
  },
  formatDetection: {
    telephone: false,
  },
  applicationName: 'SupaOrganized',
  keywords: ['supabase', 'database', 'users', 'management', 'admin', 'dashboard'],
  authors: [{ name: 'SupaOrganized' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#f59e0b',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SupaOrganized" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="bg-background min-h-screen antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  )
}
