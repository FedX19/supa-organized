import { NextRequest } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'

/**
 * Resolves the caller's connected customer database.
 *
 * Every analytics route needs the same three steps: authenticate the caller
 * against SupaOrganized's own Supabase, look up their stored connection, and
 * decrypt the service-role key. This was duplicated in 7 routes; it lives here
 * now so auth behaviour can only ever change in one place.
 */

export class CustomerClientError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'CustomerClientError'
    this.status = status
  }
}

/**
 * The customer's Supabase, keyed with their service-role key.
 *
 * `persistSession: false` matters: this client is created per-request on the
 * server and must never try to write to storage.
 */
export function createCustomerClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function getCustomerClient(request: NextRequest): Promise<SupabaseClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new CustomerClientError('Server configuration error', 500)
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new CustomerClientError('Missing authorization token', 401)
  }
  const token = authHeader.substring(7)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user) {
    throw new CustomerClientError('Unauthorized', 401)
  }

  const { data: connection, error: connError } = await supabase
    .from('user_connections')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (connError || !connection) {
    throw new CustomerClientError('No connection found', 404)
  }

  const decrypted = decrypt(connection.encrypted_key)
  if (!decrypted) {
    throw new CustomerClientError('Failed to decrypt credentials', 500)
  }

  return createCustomerClient(connection.supabase_url, decrypted)
}

/** Maps a thrown error to an HTTP status, defaulting to 500. */
export function errorStatus(error: unknown): number {
  return error instanceof CustomerClientError ? error.status : 500
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}
