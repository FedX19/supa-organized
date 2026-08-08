import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/supabase'

export class AttributionAuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AttributionAuthError'
    this.status = status
  }
}

/**
 * Authenticate SupaOrganized user and resolve MDC attribution workspace access.
 * Bootstrap: if workspace has zero members, any authenticated user is allowed.
 */
export async function requireAttributionAccess(request: NextRequest): Promise<{
  userId: string
  workspaceId: string
  email?: string
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AttributionAuthError('Server configuration error', 500)
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AttributionAuthError('Missing authorization token', 401)
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
    throw new AttributionAuthError('Unauthorized', 401)
  }

  const admin = createSupabaseAdminClient()
  const { data: workspace, error: wsErr } = await admin
    .from('attribution_workspaces')
    .select('id')
    .eq('slug', 'mdc')
    .maybeSingle()

  if (wsErr || !workspace?.id) {
    throw new AttributionAuthError(
      'Attribution workspace not configured — run supabase/migrations',
      503
    )
  }

  const workspaceId = workspace.id as string

  const { count, error: countErr } = await admin
    .from('attribution_workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  if (countErr) {
    throw new AttributionAuthError('Failed to check membership', 500)
  }

  if ((count ?? 0) > 0) {
    const { data: member } = await admin
      .from('attribution_workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!member) {
      throw new AttributionAuthError('Not a member of this attribution workspace', 403)
    }
  }
  // else bootstrap: any authenticated user may access until first member is added

  return { userId: user.id, workspaceId, email: user.email }
}
