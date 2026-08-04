/**
 * Organization type detection.
 *
 * Replaces `detectOrganizationType` in lib/supabase.ts, which read
 * `org.type || org.organization_type` — NEITHER COLUMN EXISTS. Every org fell
 * through to guessing from its name, which mislabelled real coach portals as
 * "LEAGUE".
 *
 * Verified taxonomy on production (2026-08-04), 14 orgs:
 *   business_type=consultant_admin        org_type=organization   (4)
 *   business_type=consultant_client       org_type=organization   (4)
 *   business_type=league                  org_type=league         (2)
 *   business_type=league                  org_type=organization   (1)  ← East Chatham
 *   business_type=individual              org_type=academy        (1)  ← modern-day-coach
 *   business_type=player_development_team org_type=organization   (1)  ← mdc-individual
 *   business_type=NULL                    org_type=academy        (1)  ← next-level-academy
 *
 * Two things this proves, and why the precedence below is what it is:
 *  1. `org_type` alone is wrong — East Chatham is a league with
 *     org_type='organization'. So business_type must win.
 *  2. business_type can be NULL, so org_type is still needed as a fallback.
 */

export type OrgCategory =
  | 'coach_workspace'
  | 'coach_portal'
  | 'player_development_team'
  | 'mdc_academy'
  | 'league'
  | 'unknown'

export interface OrgTypeInput {
  name?: string | null
  business_type?: string | null
  org_type?: string | null
}

const BUSINESS_TYPE_MAP: Record<string, OrgCategory> = {
  consultant_admin: 'coach_workspace',
  consultant_client: 'coach_portal',
  player_development_team: 'player_development_team',
  individual: 'mdc_academy',
  league: 'league',
}

const ORG_TYPE_FALLBACK_MAP: Record<string, OrgCategory> = {
  league: 'league',
  academy: 'mdc_academy',
  // 'organization' is deliberately absent — it is the generic default on
  // orgs of every category, so it carries no information.
}

export function detectOrgCategory(org: OrgTypeInput): OrgCategory {
  const businessType = (org.business_type ?? '').toLowerCase().trim()
  if (businessType && BUSINESS_TYPE_MAP[businessType]) {
    return BUSINESS_TYPE_MAP[businessType]
  }

  const orgType = (org.org_type ?? '').toLowerCase().trim()
  if (orgType && ORG_TYPE_FALLBACK_MAP[orgType]) {
    return ORG_TYPE_FALLBACK_MAP[orgType]
  }

  // Deliberately NOT guessing from the name. The old implementation defaulted
  // unknown orgs to 'league', which is how coach portals ended up labelled as
  // leagues. An honest 'unknown' is better than a confident wrong answer.
  return 'unknown'
}

export function isLeagueOrg(org: OrgTypeInput): boolean {
  return detectOrgCategory(org) === 'league'
}

export interface OrgCategoryDisplay {
  label: string
  color: string
  bgColor: string
  /** True for the deprecated league product. */
  deprecated: boolean
}

export function getOrgCategoryDisplay(category: OrgCategory): OrgCategoryDisplay {
  switch (category) {
    case 'coach_workspace':
      return {
        label: 'COACH',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20',
        deprecated: false,
      }
    case 'coach_portal':
      return {
        label: 'COACH PORTAL',
        color: 'text-teal-400',
        bgColor: 'bg-teal-500/20',
        deprecated: false,
      }
    case 'player_development_team':
      return {
        label: 'TEAM',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        deprecated: false,
      }
    case 'mdc_academy':
      return {
        label: 'ACADEMY',
        color: 'text-violet-400',
        bgColor: 'bg-violet-500/20',
        deprecated: false,
      }
    case 'league':
      return {
        label: 'LEAGUE (retired)',
        color: 'text-zinc-400',
        bgColor: 'bg-zinc-500/20',
        deprecated: true,
      }
    default:
      return {
        label: 'UNKNOWN',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        deprecated: false,
      }
  }
}
