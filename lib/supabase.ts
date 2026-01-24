import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Types for SupaOrganized's own database
export interface UserConnection {
  id: string
  user_id: string
  supabase_url: string
  encrypted_key: string
  connection_name: string
  created_at: string
  updated_at: string
}

// Types for customer's Supabase database (UniteHQ schema)
export interface Profile {
  id: string
  full_name: string | null
  email: string | null
}

export interface Organization {
  id: string
  name: string
}

export interface OrganizationStaff {
  id: string
  profile_id: string
  organization_id: string
  role: string
}

export interface OrganizationMember {
  id: string
  profile_id: string
  organization_id: string
}

export interface Player {
  id: string
  player_name: string
  organization_id: string
  guardian_profile_id: string | null
  parent_email: string | null
  guardian_email: string | null
}

export interface Team {
  id: string
  name: string
  organization_id: string
}

// Processed user row for display
export interface UserRow {
  id: string
  name: string
  email: string
  organization: string
  organizationId: string | null
  role: string
  kids: string[]
}

// Create Supabase client for SupaOrganized's own database
export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

// Create Supabase admin client (server-side only)
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

// Create a client for the customer's Supabase database
export function createCustomerSupabaseClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey)
}

// Fetch all data from customer's Supabase and process it
export async function fetchCustomerData(
  customerClient: SupabaseClient
): Promise<{
  users: UserRow[]
  totalUsers: number
  totalOrganizations: number
  totalPlayers: number
}> {
  // Fetch all tables in parallel
  const [profilesRes, orgsRes, staffRes, membersRes, playersRes] = await Promise.all([
    customerClient.from('profiles').select('*'),
    customerClient.from('organizations').select('*'),
    customerClient.from('organization_staff').select('*'),
    customerClient.from('organization_members').select('*'),
    customerClient.from('players').select('*'),
  ])

  const profiles: Profile[] = profilesRes.data || []
  const organizations: Organization[] = orgsRes.data || []
  const staff: OrganizationStaff[] = staffRes.data || []
  const members: OrganizationMember[] = membersRes.data || []
  const players: Player[] = playersRes.data || []

  // Build lookup maps
  const orgMap = new Map<string, string>()
  organizations.forEach(org => orgMap.set(org.id, org.name))

  // Staff map: profile_id -> array of {orgId, orgName, role}
  const staffMap = new Map<string, Array<{ orgId: string; orgName: string; role: string }>>()
  staff.forEach(s => {
    const orgName = orgMap.get(s.organization_id) || 'Unknown Org'
    const existing = staffMap.get(s.profile_id) || []
    existing.push({ orgId: s.organization_id, orgName, role: s.role })
    staffMap.set(s.profile_id, existing)
  })

  // Member map: profile_id -> array of {orgId, orgName}
  const memberMap = new Map<string, Array<{ orgId: string; orgName: string }>>()
  members.forEach(m => {
    const orgName = orgMap.get(m.organization_id) || 'Unknown Org'
    const existing = memberMap.get(m.profile_id) || []
    existing.push({ orgId: m.organization_id, orgName })
    memberMap.set(m.profile_id, existing)
  })

  // Kids map: guardian_profile_id -> array of player names
  const kidsMap = new Map<string, string[]>()
  players.forEach(p => {
    if (p.guardian_profile_id) {
      const existing = kidsMap.get(p.guardian_profile_id) || []
      existing.push(p.player_name)
      kidsMap.set(p.guardian_profile_id, existing)
    }
  })

  // Build user rows
  const userRows: UserRow[] = []
  let rowId = 0

  profiles.forEach(profile => {
    const staffOrgs = staffMap.get(profile.id) || []
    const memberOrgs = memberMap.get(profile.id) || []
    const kids = kidsMap.get(profile.id) || []

    // If profile is staff in any org, create a row per org
    if (staffOrgs.length > 0) {
      staffOrgs.forEach(s => {
        userRows.push({
          id: `${profile.id}-${rowId++}`,
          name: profile.full_name || '-',
          email: profile.email || '-',
          organization: s.orgName,
          organizationId: s.orgId,
          role: s.role,
          kids,
        })
      })
    }
    // If profile is a member (not staff) in any org
    else if (memberOrgs.length > 0) {
      memberOrgs.forEach(m => {
        userRows.push({
          id: `${profile.id}-${rowId++}`,
          name: profile.full_name || '-',
          email: profile.email || '-',
          organization: m.orgName,
          organizationId: m.orgId,
          role: 'member',
          kids,
        })
      })
    }
    // Profile not in any org
    else {
      userRows.push({
        id: `${profile.id}-${rowId++}`,
        name: profile.full_name || '-',
        email: profile.email || '-',
        organization: '-',
        organizationId: null,
        role: '-',
        kids,
      })
    }
  })

  return {
    users: userRows,
    totalUsers: profiles.length,
    totalOrganizations: organizations.length,
    totalPlayers: players.length,
  }
}

// Test connection to customer's Supabase
export async function testCustomerConnection(url: string, serviceRoleKey: string): Promise<boolean> {
  try {
    const client = createCustomerSupabaseClient(url, serviceRoleKey)
    // Try to fetch profiles to test connection
    const { error } = await client.from('profiles').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}
