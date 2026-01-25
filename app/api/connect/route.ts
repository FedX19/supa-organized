import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encrypt } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  console.log('=== /api/connect called ===')

  try {
    const body = await request.json()
    const { supabaseUrl, serviceKey, connectionName } = body

    console.log('Received request:', {
      supabaseUrl,
      connectionName,
      serviceKeyLength: serviceKey?.length,
      serviceKeyPrefix: serviceKey?.substring(0, 20) + '...'
    })

    if (!supabaseUrl || !serviceKey) {
      console.log('Missing required fields')
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get environment variables
    const ownSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const ownAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const ownServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log('Environment check:', {
      hasOwnUrl: !!ownSupabaseUrl,
      hasOwnAnonKey: !!ownAnonKey,
      hasOwnServiceKey: !!ownServiceRoleKey,
    })

    if (!ownSupabaseUrl || !ownAnonKey || !ownServiceRoleKey) {
      console.log('Server configuration error - missing env vars')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Get access token from Authorization header
    const authHeader = request.headers.get('authorization')
    console.log('Auth header present:', !!authHeader, authHeader?.substring(0, 30))

    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Missing or invalid authorization header')
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
    }
    const token = authHeader.substring(7)
    console.log('Token extracted, length:', token.length)

    // Create Supabase client and verify the user
    console.log('Verifying user with SupaOrganized Supabase...')
    const supabase = createClient(ownSupabaseUrl, ownAnonKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError) {
      console.error('Auth verification failed:', authError)
      return NextResponse.json({ error: `Unauthorized - ${authError.message}` }, { status: 401 })
    }

    if (!user) {
      console.error('No user returned from auth verification')
      return NextResponse.json({ error: 'Unauthorized - No user found' }, { status: 401 })
    }

    console.log('User verified:', user.id, user.email)

    // Test connection to customer's Supabase (server-side)
    console.log('Testing customer Supabase connection...')
    console.log('Customer URL:', supabaseUrl)

    try {
      const customerClient = createClient(supabaseUrl, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
      console.log('Customer client created')

      // Use a simple query that should work on any Supabase - list tables
      // Service role key can query auth.users, so let's try that
      const { data: testData, error: testError } = await customerClient
        .from('profiles')
        .select('id')
        .limit(1)

      console.log('Connection test result:', {
        hasData: !!testData,
        dataLength: testData?.length,
        error: testError
      })

      if (testError) {
        // Check if it's a "table doesn't exist" error vs auth error
        const errorMsg = testError.message || 'Unknown error'
        console.error('Customer connection test failed:', testError)

        // If profiles table doesn't exist, try a different approach
        if (errorMsg.includes('does not exist') || errorMsg.includes('permission denied')) {
          console.log('Profiles table issue, trying alternative test...')

          // Try to query auth.users (service role should have access)
          const { error: authTestError } = await customerClient.auth.admin.listUsers({ perPage: 1 })

          if (authTestError) {
            console.error('Auth admin test also failed:', authTestError)
            return NextResponse.json(
              { error: `Connection failed: ${authTestError.message}. Make sure you're using the service_role key (not anon key).` },
              { status: 400 }
            )
          }
          console.log('Auth admin test succeeded - connection is valid')
        } else {
          return NextResponse.json(
            { error: `Connection test failed: ${errorMsg}` },
            { status: 400 }
          )
        }
      }

      console.log('Customer connection test PASSED')

    } catch (testErr) {
      const errorMessage = testErr instanceof Error ? testErr.message : String(testErr)
      console.error('Customer connection error (exception):', errorMessage, testErr)
      return NextResponse.json(
        { error: `Connection error: ${errorMessage}` },
        { status: 400 }
      )
    }

    // Encrypt the service key
    console.log('Encrypting service key...')
    const encryptedKey = encrypt(serviceKey)
    console.log('Service key encrypted, length:', encryptedKey.length)

    // Use service role client to bypass RLS for insert
    console.log('Saving connection to database...')
    const supabaseAdmin = createClient(ownSupabaseUrl, ownServiceRoleKey)

    // Delete existing connection if any
    const { error: deleteError } = await supabaseAdmin
      .from('user_connections')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.log('Delete existing connection result:', deleteError)
    }

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
      return NextResponse.json({ error: `Failed to save connection: ${error.message}` }, { status: 500 })
    }

    console.log('Connection saved successfully:', connection.id)
    return NextResponse.json({ connection })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Connect route error (outer catch):', errorMessage, error)
    return NextResponse.json({ error: `Server error: ${errorMessage}` }, { status: 500 })
  }
}
