import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-card-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span className="text-white font-bold text-xl">SupaOrganized</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-slate-400 hover:text-white transition-colors font-medium"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="bg-primary hover:bg-primary-hover text-white font-semibold px-6 py-2.5 rounded-lg border border-primary-hover transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-4xl mx-auto">
          <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-4">
            SUPAORGANIZED
          </p>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Master Your Supabase Users
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Connect your Supabase database and instantly search, view, and manage all your users,
            organizations, teams, and players in one beautiful dashboard.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="bg-primary hover:bg-primary-hover text-white font-semibold px-8 py-3 rounded-lg border border-primary-hover transition-colors text-lg"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="text-slate-300 hover:text-white border border-slate-700 hover:bg-slate-800 font-medium px-6 py-3 rounded-lg transition-colors"
            >
              Log In
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mt-24">
          {/* Feature 1 */}
          <div className="bg-card border border-card-border rounded-xl p-6">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Instant Search</h3>
            <p className="text-slate-400">
              Search through all your users by name, email, or organization.
              Find anyone in milliseconds with our powerful search engine.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-card border border-card-border rounded-xl p-6">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">See Relationships</h3>
            <p className="text-slate-400">
              Understand your data at a glance. See which organizations users belong to,
              their roles, and their connected players or kids.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-card border border-card-border rounded-xl p-6">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Secure & Private</h3>
            <p className="text-slate-400">
              Your Supabase credentials are encrypted with AES-256 encryption.
              We never store your data - it stays in your database.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 text-center">
          <div className="bg-card border border-card-border rounded-xl p-12 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to organize your Supabase?
            </h2>
            <p className="text-slate-400 mb-8">
              Get started in under 2 minutes. Connect your database and start exploring.
            </p>
            <Link
              href="/signup"
              className="inline-block bg-primary hover:bg-primary-hover text-white font-semibold px-8 py-3 rounded-lg border border-primary-hover transition-colors text-lg"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-card-border mt-24">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} SupaOrganized. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
              Privacy
            </a>
            <a href="#" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
