import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    const { encrypted } = await request.json()

    if (!encrypted) {
      return NextResponse.json({ error: 'Missing encrypted data' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Get cookies for auth
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    const cookieString = allCookies.map(c => `${c.name}=${c.value}`).join('; ')

    // Create Supabase client with cookies
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Decrypt the data
    const decrypted = decrypt(encrypted)

    if (!decrypted) {
      return NextResponse.json({ error: 'Failed to decrypt' }, { status: 500 })
    }

    return NextResponse.json({ decrypted })
  } catch (error) {
    console.error('Decrypt error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
