'use client'

import { useState } from 'react'
import { UserConnection } from '@/lib/supabase'

interface ConnectionsPanelProps {
  connection: UserConnection | null
  onConnect: (data: { connectionName: string; supabaseUrl: string; serviceKey: string }) => Promise<void>
  onDisconnect: () => Promise<void>
  onTestConnection: () => Promise<boolean>
  isConnecting: boolean
  connectError: string
}

export default function ConnectionsPanel({
  connection,
  onConnect,
  onDisconnect,
  onTestConnection,
  isConnecting,
  connectError,
}: ConnectionsPanelProps) {
  const [connectionName, setConnectionName] = useState('My Supabase')
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [serviceKey, setServiceKey] = useState('')
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onConnect({
      connectionName: connectionName.trim() || 'My Supabase',
      supabaseUrl: supabaseUrl.trim(),
      serviceKey: serviceKey.trim(),
    })
    // Reset form on success
    if (!connectError) {
      setSupabaseUrl('')
      setServiceKey('')
      setConnectionName('My Supabase')
    }
  }

  const handleTest = async () => {
    setTestResult('testing')
    const success = await onTestConnection()
    setTestResult(success ? 'success' : 'failed')
    setTimeout(() => setTestResult('idle'), 3000)
  }

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect? Your credentials will be deleted.')) {
      await onDisconnect()
    }
  }

  // Connected state
  if (connection) {
    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Connection Status Card */}
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-green-500/30 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white">Connected</h3>
              <p className="text-green-400">Your Supabase database is connected and ready</p>
            </div>
            <div className={`w-3 h-3 rounded-full bg-green-500 animate-pulse`} />
          </div>
        </div>

        {/* Connection Details */}
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
            <h3 className="font-medium text-white">Connection Details</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Connection Name
                </label>
                <p className="text-white font-medium">{connection.connection_name}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Connected Since
                </label>
                <p className="text-white font-medium">
                  {new Date(connection.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Supabase URL
                </label>
                <p className="text-white font-mono text-sm bg-dark-surface px-3 py-2 rounded">
                  {connection.supabase_url}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border bg-dark-surface">
            <h3 className="font-medium text-white">Actions</h3>
          </div>
          <div className="p-4 flex flex-wrap gap-3">
            <button
              onClick={handleTest}
              disabled={testResult === 'testing'}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                testResult === 'success'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : testResult === 'failed'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-dark-surface border border-dark-border text-white hover:border-primary'
              }`}
            >
              {testResult === 'testing' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Testing...
                </>
              ) : testResult === 'success' ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Connection OK
                </>
              ) : testResult === 'failed' ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Test Failed
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Test Connection
                </>
              )}
            </button>

            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg font-medium border border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Disconnect
            </button>
          </div>
        </div>

        {/* Security Info */}
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h4 className="text-white font-medium">Security</h4>
              <p className="text-sm text-gray-400 mt-1">
                Your service role key is encrypted with AES-256 and stored securely.
                It is never exposed in client-side code.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Not connected - show form
  return (
    <div className="max-w-2xl animate-fadeIn">
      <div className="bg-dark-card border border-dark-border rounded-xl p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Connect Your Supabase</h2>
            <p className="text-gray-400">
              Enter your project credentials to get started
            </p>
          </div>
        </div>

        {connectError && (
          <div className="bg-red-900/20 border border-red-800/30 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
            {connectError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
              Connection Name (optional)
            </label>
            <input
              type="text"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              className="w-full bg-dark-surface border border-dark-border text-white placeholder-gray-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              placeholder="My Supabase"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
              Supabase URL
            </label>
            <input
              type="url"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full bg-dark-surface border border-dark-border text-white placeholder-gray-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              placeholder="https://your-project.supabase.co"
              required
            />
            <p className="text-gray-500 text-xs mt-1">Found in your Supabase project settings</p>
          </div>

          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
              Service Role Key
            </label>
            <input
              type="password"
              value={serviceKey}
              onChange={(e) => setServiceKey(e.target.value)}
              className="w-full bg-dark-surface border border-dark-border text-white placeholder-gray-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              required
            />
            <p className="text-gray-500 text-xs mt-1">
              Found in Project Settings &rarr; API &rarr; service_role key
            </p>
          </div>

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full bg-primary hover:bg-primary-hover text-black font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
        </form>

        {/* Security Note */}
        <div className="mt-6 p-4 bg-dark-surface rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="text-sm text-gray-300 font-medium">Your credentials are secure</p>
              <p className="text-xs text-gray-500 mt-1">
                We encrypt your service role key with AES-256 before storing it.
                All data access is read-only and limited to the connected database.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
