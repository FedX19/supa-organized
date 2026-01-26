'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { FullLogo } from '@/components/Logo'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createSupabaseClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      router.push('/dashboard')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <FullLogo className="w-56 h-14 mx-auto" />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-card border border-card-border rounded-xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
          <p className="text-slate-400 mb-6">Start organizing your Supabase users today</p>

          {error && (
            <div className="bg-red-900/20 border border-red-800/30 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-card border border-card-border text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-card border border-card-border text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-card border border-card-border text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="Create a strong password"
                required
                minLength={6}
              />
              <p className="text-slate-500 text-xs mt-1">Must be at least 6 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover text-white font-semibold px-6 py-3 rounded-lg border border-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="text-slate-400 text-sm text-center mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:text-primary-light transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-slate-500 text-xs text-center mt-6">
          By creating an account, you agree to our{' '}
          <a href="#" className="text-slate-400 hover:text-white">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-slate-400 hover:text-white">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}
