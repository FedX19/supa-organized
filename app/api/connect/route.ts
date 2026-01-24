import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encrypt } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    const { supabaseUrl, serviceKey, connectionName } = await request.json()

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get current user from cookie/session
    const supabaseUrl_own = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl_own || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Create client with anon key to get user from cookie
    const supabaseAnon = createClient(supabaseUrl_own, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: request.headers.get('authorization') || '',
          cookie: request.headers.get('cookie') || '',
        },
      },
    })

    // Get user from the auth header/cookie
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user } } = await supabaseAnon.auth.getUser(token)
      userId = user?.id || null
    }

    if (!userId) {
      // Try to get user from cookie
      const cookieHeader = request.headers.get('cookie') || ''
      const supabaseCookie = cookieHeader.split(';').find(c => c.trim().startsWith('sb-'))

      if (supabaseCookie) {
        // Parse the auth token from cookie
        const { data: { user } } = await supabaseAnon.auth.getUser()
        userId = user?.id || null
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Encrypt the service key
    const encryptedKey = encrypt(serviceKey)

    // Use service role client to bypass RLS for insert
    const supabaseAdmin = createClient(supabaseUrl_own, serviceRoleKey)

    // Delete existing connection if any
    await supabaseAdmin
      .from('user_connections')
      .delete()
      .eq('user_id', userId)

    // Insert new connection
    const { data: connection, error } = await supabaseAdmin
      .from('user_connections')
      .insert({
        user_id: userId,
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
