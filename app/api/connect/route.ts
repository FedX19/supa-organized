import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

    // Get access token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
    }
    const token = authHeader.substring(7)

    // Create Supabase client and verify the user
    const supabase = createClient(ownSupabaseUrl, ownAnonKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
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
