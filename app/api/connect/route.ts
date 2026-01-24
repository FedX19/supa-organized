import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { encrypt } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    const { supabaseUrl, serviceKey, connectionName } = await request.json()

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get environment variables
    const ownSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const ownAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const ownServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!ownSupabaseUrl || !ownAnonKey || !ownServiceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Get cookies for auth
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    const cookieString = allCookies.map(c => `${c.name}=${c.value}`).join('; ')

    // Create Supabase client with cookies
    const supabase = createClient(ownSupabaseUrl, ownAnonKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          cookie: cookieString,
        },
      },
    })

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Please log in again' }, { status: 401 })
    }

    // Test connection to customer's Supabase (server-side)
    try {
      const customerClient = createClient(supabaseUrl, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })

      // Try to query profiles table to verify connection
      const { error: testError } = await customerClient.from('profiles').select('id').limit(1)

      if (testError) {
        console.error('Customer connection test failed:', testError)
        return NextResponse.json(
          { error: `Connection test failed: ${testError.message}` },
          { status: 400 }
        )
      }
    } catch (testErr) {
      console.error('Customer connection error:', testErr)
      return NextResponse.json(
        { error: 'Could not connect to your Supabase. Please verify your URL and service role key.' },
        { status: 400 }
      )
    }

    // Encrypt the service key
    const encryptedKey = encrypt(serviceKey)

    // Use service role client to bypass RLS for insert
    const supabaseAdmin = createClient(ownSupabaseUrl, ownServiceRoleKey)

    // Delete existing connection if any
    await supabaseAdmin
      .from('user_connections')
      .delete()
      .eq('user_id', user.id)

    // Insert new connection
    const { data: connection, error } = await supabaseAdmin
      .from('user_connections')
      .insert({
        user_id: user.id,
        supabase_url: supabaseUrl,
        encrypted_key: encryptedKey,
        connection_name: connectionName || 'My Supabase',
      })
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 })
    }

    return NextResponse.json({ connection })
  } catch (error) {
    console.error('Connect error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
