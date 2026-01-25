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

// Organization card for grid view
export interface OrganizationCard {
  id: string
  name: string
  staffCount: number
  memberCount: number
  playerCount: number
  totalPeople: number
}

// Member in organization detail view
export interface OrgMember {
  id: string
  profileId: string
  name: string
  email: string
  role: string
  kids: string[]
}

// Organization detail with members grouped by role
export interface OrganizationDetail {
  id: string
  name: string
  admins: OrgMember[]
  coaches: OrgMember[]
  staff: OrgMember[]
  members: OrgMember[]
  players: Array<{ id: string; name: string; guardianName: string; guardianEmail: string }>
}

// ========== DIAGNOSTIC TYPES ==========

// Full user profile with all relationships
export interface UserProfile {
  id: string
  fullName: string
  email: string
  organizations: UserOrgRelationship[]
  guardiansOf: PlayerGuardianship[]
  teamMemberships: TeamMembership[]
}

export interface UserOrgRelationship {
  orgId: string
  orgName: string
  isStaff: boolean
  isMember: boolean
  staffRole: string | null
  staffRecordId: string | null
  memberRecordId: string | null
}

export interface PlayerGuardianship {
  playerId: string
  playerName: string
  orgId: string
  orgName: string
}

export interface TeamMembership {
  teamId: string
  teamName: string
  orgId: string
  orgName: string
}

// Permission diagnostic types
export interface PermissionIssue {
  type: 'missing_member' | 'missing_staff' | 'orphan_player' | 'orphan_staff' | 'orphan_member' | 'missing_profile'
  severity: 'warning' | 'error'
  description: string
  impact: string
  sqlFix: string
  relatedIds: {
    profileId?: string
    orgId?: string
    playerId?: string
    staffId?: string
    memberId?: string
  }
}

export interface UserPermissionDiagnostic {
  profile: UserProfile
  issues: PermissionIssue[]
  orgChecks: OrgPermissionCheck[]
}

export interface OrgPermissionCheck {
  orgId: string
  orgName: string
  inOrganizationMembers: boolean
  inOrganizationStaff: boolean
  staffRole: string | null
  teamAccess: number
  issues: PermissionIssue[]
}

// Relationship viewer types
export interface TableRelationship {
  fromTable: string
  toTable: string
  fromColumn: string
  toColumn: string
  orphanCount: number
  orphanRecords: OrphanRecord[]
}

export interface OrphanRecord {
  id: string
  table: string
  missingForeignKey: string
  missingValue: string
  record: Record<string, unknown>
}

// Issue dashboard summary
export interface IssueSummary {
  totalIssues: number
  usersMissingMembership: number
  playersWithoutGuardians: number
  staffWithoutMembership: number
  orphanedStaffRecords: number
  orphanedMemberRecords: number
  orphanedPlayerRecords: number
  profilesWithNoOrg: number
}

export interface IssueDetail {
  category: string
  count: number
  description: string
  items: IssueItem[]
  batchSql: string
}

export interface IssueItem {
  id: string
  name: string
  email?: string
  orgName?: string
  details: string
  sqlFix: string
}

// Raw data types for diagnostics
export interface RawDiagnosticData {
  profiles: Profile[]
  organizations: Organization[]
  staff: OrganizationStaff[]
  members: OrganizationMember[]
  players: Player[]
  teams: Team[]
}

// Singleton Supabase client for browser
let browserClient: SupabaseClient | null = null

// Create Supabase client for SupaOrganized's own database (singleton for browser)
export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  // Return singleton in browser to preserve session
  if (typeof window !== 'undefined') {
    if (!browserClient) {
      browserClient = createClient(supabaseUrl, supabaseAnonKey)
    }
    return browserClient
  }

  // Create new client for server-side
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

// Fetch organization-centric data for card grid view
export async function fetchOrganizationCards(
  customerClient: SupabaseClient
): Promise<{
  organizations: OrganizationCard[]
  totalUsers: number
  totalPlayers: number
}> {
  // Fetch all tables in parallel
  const [profilesRes, orgsRes, staffRes, membersRes, playersRes] = await Promise.all([
    customerClient.from('profiles').select('id'),
    customerClient.from('organizations').select('*'),
    customerClient.from('organization_staff').select('*'),
    customerClient.from('organization_members').select('*'),
    customerClient.from('players').select('*'),
  ])

  const profiles = profilesRes.data || []
  const organizations: Organization[] = orgsRes.data || []
  const staff: OrganizationStaff[] = staffRes.data || []
  const members: OrganizationMember[] = membersRes.data || []
  const players: Player[] = playersRes.data || []

  // Build org cards with counts
  const orgCards: OrganizationCard[] = organizations.map(org => {
    const orgStaff = staff.filter(s => s.organization_id === org.id)
    const orgMembers = members.filter(m => m.organization_id === org.id)
    const orgPlayers = players.filter(p => p.organization_id === org.id)

    return {
      id: org.id,
      name: org.name,
      staffCount: orgStaff.length,
      memberCount: orgMembers.length,
      playerCount: orgPlayers.length,
      totalPeople: orgStaff.length + orgMembers.length,
    }
  })

  // Sort by total people descending
  orgCards.sort((a, b) => b.totalPeople - a.totalPeople)

  return {
    organizations: orgCards,
    totalUsers: profiles.length,
    totalPlayers: players.length,
  }
}

// Fetch detailed organization data with members
export async function fetchOrganizationDetail(
  customerClient: SupabaseClient,
  orgId: string
): Promise<OrganizationDetail | null> {
  // Fetch org and related data
  const [orgRes, staffRes, membersRes, playersRes, profilesRes] = await Promise.all([
    customerClient.from('organizations').select('*').eq('id', orgId).single(),
    customerClient.from('organization_staff').select('*').eq('organization_id', orgId),
    customerClient.from('organization_members').select('*').eq('organization_id', orgId),
    customerClient.from('players').select('*').eq('organization_id', orgId),
    customerClient.from('profiles').select('*'),
  ])

  if (!orgRes.data) return null

  const org: Organization = orgRes.data
  const staff: OrganizationStaff[] = staffRes.data || []
  const orgMembers: OrganizationMember[] = membersRes.data || []
  const players: Player[] = playersRes.data || []
  const profiles: Profile[] = profilesRes.data || []

  // Build profile lookup
  const profileMap = new Map<string, Profile>()
  profiles.forEach(p => profileMap.set(p.id, p))

  // Build kids map
  const kidsMap = new Map<string, string[]>()
  players.forEach(p => {
    if (p.guardian_profile_id) {
      const existing = kidsMap.get(p.guardian_profile_id) || []
      existing.push(p.player_name)
      kidsMap.set(p.guardian_profile_id, existing)
    }
  })

  // Helper to create member object
  const createMember = (profileId: string, role: string): OrgMember => {
    const profile = profileMap.get(profileId)
    return {
      id: `${profileId}-${role}`,
      profileId,
      name: profile?.full_name || 'Unknown',
      email: profile?.email || '-',
      role,
      kids: kidsMap.get(profileId) || [],
    }
  }

  // Categorize staff by role
  const admins: OrgMember[] = []
  const coaches: OrgMember[] = []
  const otherStaff: OrgMember[] = []

  staff.forEach(s => {
    const member = createMember(s.profile_id, s.role)
    const roleLower = s.role.toLowerCase()
    if (roleLower === 'admin' || roleLower === 'owner') {
      admins.push(member)
    } else if (roleLower === 'coach' || roleLower === 'assistant_coach') {
      coaches.push(member)
    } else {
      otherStaff.push(member)
    }
  })

  // Regular members (not staff)
  const staffProfileIds = new Set(staff.map(s => s.profile_id))
  const regularMembers = orgMembers
    .filter(m => !staffProfileIds.has(m.profile_id))
    .map(m => createMember(m.profile_id, 'member'))

  // Players with guardian info
  const playersList = players.map(p => {
    const guardian = p.guardian_profile_id ? profileMap.get(p.guardian_profile_id) : null
    return {
      id: p.id,
      name: p.player_name,
      guardianName: guardian?.full_name || '-',
      guardianEmail: guardian?.email || p.guardian_email || p.parent_email || '-',
    }
  })

  return {
    id: org.id,
    name: org.name,
    admins,
    coaches,
    staff: otherStaff,
    members: regularMembers,
    players: playersList,
  }
}

// ========== DIAGNOSTIC FUNCTIONS ==========

// Fetch all raw data for diagnostics
export async function fetchRawDiagnosticData(
  customerClient: SupabaseClient
): Promise<RawDiagnosticData> {
  const [profilesRes, orgsRes, staffRes, membersRes, playersRes, teamsRes] = await Promise.all([
    customerClient.from('profiles').select('*'),
    customerClient.from('organizations').select('*'),
    customerClient.from('organization_staff').select('*'),
    customerClient.from('organization_members').select('*'),
    customerClient.from('players').select('*'),
    customerClient.from('teams').select('*'),
  ])

  return {
    profiles: profilesRes.data || [],
    organizations: orgsRes.data || [],
    staff: staffRes.data || [],
    members: membersRes.data || [],
    players: playersRes.data || [],
    teams: teamsRes.data || [],
  }
}

// Search users by name or email
export function searchUsers(
  data: RawDiagnosticData,
  query: string
): Profile[] {
  const lowerQuery = query.toLowerCase()
  return data.profiles.filter(p =>
    (p.full_name?.toLowerCase().includes(lowerQuery)) ||
    (p.email?.toLowerCase().includes(lowerQuery))
  )
}

// Get full user profile with all relationships
export function getUserProfile(
  data: RawDiagnosticData,
  profileId: string
): UserProfile | null {
  const profile = data.profiles.find(p => p.id === profileId)
  if (!profile) return null

  // Build org map
  const orgMap = new Map<string, Organization>()
  data.organizations.forEach(org => orgMap.set(org.id, org))

  // Get all orgs this user is related to
  const staffRecords = data.staff.filter(s => s.profile_id === profileId)
  const memberRecords = data.members.filter(m => m.profile_id === profileId)

  // All unique org IDs
  const orgIds = new Set<string>([
    ...staffRecords.map(s => s.organization_id),
    ...memberRecords.map(m => m.organization_id),
  ])

  // Build org relationships
  const organizations: UserOrgRelationship[] = Array.from(orgIds).map(orgId => {
    const org = orgMap.get(orgId)
    const staffRecord = staffRecords.find(s => s.organization_id === orgId)
    const memberRecord = memberRecords.find(m => m.organization_id === orgId)

    return {
      orgId,
      orgName: org?.name || 'Unknown Organization',
      isStaff: !!staffRecord,
      isMember: !!memberRecord,
      staffRole: staffRecord?.role || null,
      staffRecordId: staffRecord?.id || null,
      memberRecordId: memberRecord?.id || null,
    }
  })

  // Get players this user is guardian of
  const guardiansOf: PlayerGuardianship[] = data.players
    .filter(p => p.guardian_profile_id === profileId)
    .map(p => ({
      playerId: p.id,
      playerName: p.player_name,
      orgId: p.organization_id,
      orgName: orgMap.get(p.organization_id)?.name || 'Unknown Organization',
    }))

  // Team memberships - for now just show teams from their orgs
  const teamMemberships: TeamMembership[] = data.teams
    .filter(t => orgIds.has(t.organization_id))
    .map(t => ({
      teamId: t.id,
      teamName: t.name,
      orgId: t.organization_id,
      orgName: orgMap.get(t.organization_id)?.name || 'Unknown Organization',
    }))

  return {
    id: profile.id,
    fullName: profile.full_name || 'Unknown',
    email: profile.email || '-',
    organizations,
    guardiansOf,
    teamMemberships,
  }
}

// Get permission diagnostic for a user
export function getUserPermissionDiagnostic(
  data: RawDiagnosticData,
  profileId: string
): UserPermissionDiagnostic | null {
  const profile = getUserProfile(data, profileId)
  if (!profile) return null

  const issues: PermissionIssue[] = []
  const orgChecks: OrgPermissionCheck[] = []

  // Build org map
  const orgMap = new Map<string, Organization>()
  data.organizations.forEach(org => orgMap.set(org.id, org))

  // Check each organization
  profile.organizations.forEach(orgRel => {
    const orgIssues: PermissionIssue[] = []

    // Staff without membership is a common issue
    if (orgRel.isStaff && !orgRel.isMember) {
      const issue: PermissionIssue = {
        type: 'missing_member',
        severity: 'warning',
        description: `Staff member missing from organization_members table`,
        impact: `User may not appear in member lists or have inconsistent permissions in ${orgRel.orgName}`,
        sqlFix: `INSERT INTO organization_members (profile_id, organization_id) VALUES ('${profileId}', '${orgRel.orgId}');`,
        relatedIds: { profileId, orgId: orgRel.orgId },
      }
      orgIssues.push(issue)
      issues.push(issue)
    }

    // Count teams in this org
    const teamsInOrg = data.teams.filter(t => t.organization_id === orgRel.orgId).length

    orgChecks.push({
      orgId: orgRel.orgId,
      orgName: orgRel.orgName,
      inOrganizationMembers: orgRel.isMember,
      inOrganizationStaff: orgRel.isStaff,
      staffRole: orgRel.staffRole,
      teamAccess: teamsInOrg,
      issues: orgIssues,
    })
  })

  // Check for guardian without org membership
  profile.guardiansOf.forEach(guardian => {
    const hasOrgAccess = profile.organizations.some(o => o.orgId === guardian.orgId)
    if (!hasOrgAccess) {
      const issue: PermissionIssue = {
        type: 'missing_member',
        severity: 'warning',
        description: `Guardian of player but not a member of the organization`,
        impact: `Cannot view ${guardian.playerName}'s data in ${guardian.orgName}`,
        sqlFix: `INSERT INTO organization_members (profile_id, organization_id) VALUES ('${profileId}', '${guardian.orgId}');`,
        relatedIds: { profileId, orgId: guardian.orgId, playerId: guardian.playerId },
      }
      issues.push(issue)
    }
  })

  return { profile, issues, orgChecks }
}

// Get issue summary for dashboard
export function getIssueSummary(data: RawDiagnosticData): IssueSummary {
  const profileIds = new Set(data.profiles.map(p => p.id))
  const orgIds = new Set(data.organizations.map(o => o.id))

  // Staff without membership
  const staffProfileOrgPairs = new Set(data.staff.map(s => `${s.profile_id}:${s.organization_id}`))
  const memberProfileOrgPairs = new Set(data.members.map(m => `${m.profile_id}:${m.organization_id}`))

  let staffWithoutMembership = 0
  staffProfileOrgPairs.forEach(pair => {
    if (!memberProfileOrgPairs.has(pair)) {
      staffWithoutMembership++
    }
  })

  // Players without guardians
  const playersWithoutGuardians = data.players.filter(p => !p.guardian_profile_id).length

  // Orphaned records (reference non-existent profiles or orgs)
  const orphanedStaffRecords = data.staff.filter(
    s => !profileIds.has(s.profile_id) || !orgIds.has(s.organization_id)
  ).length

  const orphanedMemberRecords = data.members.filter(
    m => !profileIds.has(m.profile_id) || !orgIds.has(m.organization_id)
  ).length

  const orphanedPlayerRecords = data.players.filter(
    p => !orgIds.has(p.organization_id) || (p.guardian_profile_id && !profileIds.has(p.guardian_profile_id))
  ).length

  // Profiles with no org association
  const profilesInOrgs = new Set([
    ...data.staff.map(s => s.profile_id),
    ...data.members.map(m => m.profile_id),
  ])
  const profilesWithNoOrg = data.profiles.filter(p => !profilesInOrgs.has(p.id)).length

  return {
    totalIssues: staffWithoutMembership + playersWithoutGuardians +
      orphanedStaffRecords + orphanedMemberRecords + orphanedPlayerRecords,
    usersMissingMembership: staffWithoutMembership,
    playersWithoutGuardians,
    staffWithoutMembership,
    orphanedStaffRecords,
    orphanedMemberRecords,
    orphanedPlayerRecords,
    profilesWithNoOrg,
  }
}

// Get detailed issue list by category
export function getIssueDetails(data: RawDiagnosticData): IssueDetail[] {
  const details: IssueDetail[] = []

  const profileMap = new Map<string, Profile>()
  data.profiles.forEach(p => profileMap.set(p.id, p))

  const orgMap = new Map<string, Organization>()
  data.organizations.forEach(o => orgMap.set(o.id, o))

  // 1. Staff without organization_members entry
  const staffProfileOrgPairs = new Map<string, { staffId: string; profileId: string; orgId: string; role: string }>()
  data.staff.forEach(s => {
    staffProfileOrgPairs.set(`${s.profile_id}:${s.organization_id}`, {
      staffId: s.id,
      profileId: s.profile_id,
      orgId: s.organization_id,
      role: s.role,
    })
  })

  const memberProfileOrgPairs = new Set(data.members.map(m => `${m.profile_id}:${m.organization_id}`))

  const missingMemberItems: IssueItem[] = []
  const missingMemberSqls: string[] = []

  staffProfileOrgPairs.forEach((staffInfo, pair) => {
    if (!memberProfileOrgPairs.has(pair)) {
      const profile = profileMap.get(staffInfo.profileId)
      const org = orgMap.get(staffInfo.orgId)
      missingMemberItems.push({
        id: staffInfo.staffId,
        name: profile?.full_name || 'Unknown',
        email: profile?.email || undefined,
        orgName: org?.name,
        details: `Staff (${staffInfo.role}) without organization_members entry`,
        sqlFix: `INSERT INTO organization_members (profile_id, organization_id) VALUES ('${staffInfo.profileId}', '${staffInfo.orgId}');`,
      })
      missingMemberSqls.push(`('${staffInfo.profileId}', '${staffInfo.orgId}')`)
    }
  })

  if (missingMemberItems.length > 0) {
    details.push({
      category: 'Staff Missing Membership',
      count: missingMemberItems.length,
      description: 'Staff members who are not in organization_members table',
      items: missingMemberItems,
      batchSql: `INSERT INTO organization_members (profile_id, organization_id) VALUES\n${missingMemberSqls.join(',\n')};`,
    })
  }

  // 2. Players without guardians
  const noGuardianPlayers = data.players.filter(p => !p.guardian_profile_id)
  if (noGuardianPlayers.length > 0) {
    details.push({
      category: 'Players Without Guardians',
      count: noGuardianPlayers.length,
      description: 'Players with no guardian_profile_id set',
      items: noGuardianPlayers.map(p => {
        const org = orgMap.get(p.organization_id)
        return {
          id: p.id,
          name: p.player_name,
          orgName: org?.name,
          details: `No guardian linked. Email: ${p.guardian_email || p.parent_email || 'none'}`,
          sqlFix: `-- Find the guardian profile by email and update:\n-- UPDATE players SET guardian_profile_id = '<profile_id>' WHERE id = '${p.id}';`,
        }
      }),
      batchSql: '-- Each player needs manual guardian lookup by email.\n-- See individual SQL statements above.',
    })
  }

  // 3. Orphaned staff records (profile doesn't exist)
  const profileIds = new Set(data.profiles.map(p => p.id))
  const orphanedStaff = data.staff.filter(s => !profileIds.has(s.profile_id))

  if (orphanedStaff.length > 0) {
    details.push({
      category: 'Orphaned Staff Records',
      count: orphanedStaff.length,
      description: 'Staff records referencing non-existent profiles',
      items: orphanedStaff.map(s => {
        const org = orgMap.get(s.organization_id)
        return {
          id: s.id,
          name: `Profile: ${s.profile_id}`,
          orgName: org?.name,
          details: `Role: ${s.role} - Profile ID does not exist`,
          sqlFix: `DELETE FROM organization_staff WHERE id = '${s.id}';`,
        }
      }),
      batchSql: `DELETE FROM organization_staff WHERE id IN (\n${orphanedStaff.map(s => `  '${s.id}'`).join(',\n')}\n);`,
    })
  }

  // 4. Orphaned member records
  const orphanedMembers = data.members.filter(m => !profileIds.has(m.profile_id))

  if (orphanedMembers.length > 0) {
    details.push({
      category: 'Orphaned Member Records',
      count: orphanedMembers.length,
      description: 'Member records referencing non-existent profiles',
      items: orphanedMembers.map(m => {
        const org = orgMap.get(m.organization_id)
        return {
          id: m.id,
          name: `Profile: ${m.profile_id}`,
          orgName: org?.name,
          details: `Profile ID does not exist in profiles table`,
          sqlFix: `DELETE FROM organization_members WHERE id = '${m.id}';`,
        }
      }),
      batchSql: `DELETE FROM organization_members WHERE id IN (\n${orphanedMembers.map(m => `  '${m.id}'`).join(',\n')}\n);`,
    })
  }

  // 5. Profiles with no org
  const profilesInOrgs = new Set([
    ...data.staff.map(s => s.profile_id),
    ...data.members.map(m => m.profile_id),
  ])
  const noOrgProfiles = data.profiles.filter(p => !profilesInOrgs.has(p.id))

  if (noOrgProfiles.length > 0) {
    details.push({
      category: 'Profiles Without Organization',
      count: noOrgProfiles.length,
      description: 'User profiles not associated with any organization',
      items: noOrgProfiles.map(p => ({
        id: p.id,
        name: p.full_name || 'Unknown',
        email: p.email || undefined,
        details: 'Not a member or staff of any organization',
        sqlFix: `-- Add to an organization:\n-- INSERT INTO organization_members (profile_id, organization_id) VALUES ('${p.id}', '<org_id>');`,
      })),
      batchSql: '-- Each profile needs manual organization assignment.\n-- See individual SQL statements above.',
    })
  }

  return details
}

// Get table relationships and orphans
export function getTableRelationships(data: RawDiagnosticData): TableRelationship[] {
  const relationships: TableRelationship[] = []

  const profileIds = new Set(data.profiles.map(p => p.id))
  const orgIds = new Set(data.organizations.map(o => o.id))

  // organization_staff -> profiles
  const staffOrphanProfiles = data.staff.filter(s => !profileIds.has(s.profile_id))
  relationships.push({
    fromTable: 'organization_staff',
    toTable: 'profiles',
    fromColumn: 'profile_id',
    toColumn: 'id',
    orphanCount: staffOrphanProfiles.length,
    orphanRecords: staffOrphanProfiles.map(s => ({
      id: s.id,
      table: 'organization_staff',
      missingForeignKey: 'profile_id',
      missingValue: s.profile_id,
      record: s as unknown as Record<string, unknown>,
    })),
  })

  // organization_staff -> organizations
  const staffOrphanOrgs = data.staff.filter(s => !orgIds.has(s.organization_id))
  relationships.push({
    fromTable: 'organization_staff',
    toTable: 'organizations',
    fromColumn: 'organization_id',
    toColumn: 'id',
    orphanCount: staffOrphanOrgs.length,
    orphanRecords: staffOrphanOrgs.map(s => ({
      id: s.id,
      table: 'organization_staff',
      missingForeignKey: 'organization_id',
      missingValue: s.organization_id,
      record: s as unknown as Record<string, unknown>,
    })),
  })

  // organization_members -> profiles
  const memberOrphanProfiles = data.members.filter(m => !profileIds.has(m.profile_id))
  relationships.push({
    fromTable: 'organization_members',
    toTable: 'profiles',
    fromColumn: 'profile_id',
    toColumn: 'id',
    orphanCount: memberOrphanProfiles.length,
    orphanRecords: memberOrphanProfiles.map(m => ({
      id: m.id,
      table: 'organization_members',
      missingForeignKey: 'profile_id',
      missingValue: m.profile_id,
      record: m as unknown as Record<string, unknown>,
    })),
  })

  // organization_members -> organizations
  const memberOrphanOrgs = data.members.filter(m => !orgIds.has(m.organization_id))
  relationships.push({
    fromTable: 'organization_members',
    toTable: 'organizations',
    fromColumn: 'organization_id',
    toColumn: 'id',
    orphanCount: memberOrphanOrgs.length,
    orphanRecords: memberOrphanOrgs.map(m => ({
      id: m.id,
      table: 'organization_members',
      missingForeignKey: 'organization_id',
      missingValue: m.organization_id,
      record: m as unknown as Record<string, unknown>,
    })),
  })

  // players -> organizations
  const playerOrphanOrgs = data.players.filter(p => !orgIds.has(p.organization_id))
  relationships.push({
    fromTable: 'players',
    toTable: 'organizations',
    fromColumn: 'organization_id',
    toColumn: 'id',
    orphanCount: playerOrphanOrgs.length,
    orphanRecords: playerOrphanOrgs.map(p => ({
      id: p.id,
      table: 'players',
      missingForeignKey: 'organization_id',
      missingValue: p.organization_id,
      record: p as unknown as Record<string, unknown>,
    })),
  })

  // players -> profiles (guardian)
  const playerOrphanGuardians = data.players.filter(
    p => p.guardian_profile_id && !profileIds.has(p.guardian_profile_id)
  )
  relationships.push({
    fromTable: 'players',
    toTable: 'profiles',
    fromColumn: 'guardian_profile_id',
    toColumn: 'id',
    orphanCount: playerOrphanGuardians.length,
    orphanRecords: playerOrphanGuardians.map(p => ({
      id: p.id,
      table: 'players',
      missingForeignKey: 'guardian_profile_id',
      missingValue: p.guardian_profile_id!,
      record: p as unknown as Record<string, unknown>,
    })),
  })

  // teams -> organizations
  const teamOrphanOrgs = data.teams.filter(t => !orgIds.has(t.organization_id))
  relationships.push({
    fromTable: 'teams',
    toTable: 'organizations',
    fromColumn: 'organization_id',
    toColumn: 'id',
    orphanCount: teamOrphanOrgs.length,
    orphanRecords: teamOrphanOrgs.map(t => ({
      id: t.id,
      table: 'teams',
      missingForeignKey: 'organization_id',
      missingValue: t.organization_id,
      record: t as unknown as Record<string, unknown>,
    })),
  })

  return relationships
}

// Export data to CSV format
export function exportToCSV(
  data: Record<string, unknown>[],
  columns: { key: string; label: string }[]
): string {
  const header = columns.map(c => c.label).join(',')
  const rows = data.map(row =>
    columns.map(c => {
      const value = row[c.key]
      if (value === null || value === undefined) return ''
      const strValue = String(value)
      // Escape quotes and wrap in quotes if contains comma
      if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
        return `"${strValue.replace(/"/g, '""')}"`
      }
      return strValue
    }).join(',')
  )
  return [header, ...rows].join('\n')
}

// Generate SQL for exporting users
export function generateUserExportSQL(data: RawDiagnosticData): string {
  return `-- Export all users with their organizations and roles
SELECT
  p.id,
  p.full_name,
  p.email,
  o.name as organization_name,
  COALESCE(os.role, 'member') as role,
  CASE WHEN os.id IS NOT NULL THEN 'Yes' ELSE 'No' END as is_staff,
  CASE WHEN om.id IS NOT NULL THEN 'Yes' ELSE 'No' END as is_member
FROM profiles p
LEFT JOIN organization_members om ON p.id = om.profile_id
LEFT JOIN organization_staff os ON p.id = os.profile_id AND om.organization_id = os.organization_id
LEFT JOIN organizations o ON COALESCE(om.organization_id, os.organization_id) = o.id
ORDER BY p.full_name, o.name;`
}
