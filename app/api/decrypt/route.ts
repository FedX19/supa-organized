import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

    // Verify user is authenticated
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    })

    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id || null
    }

    if (!userId) {
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
