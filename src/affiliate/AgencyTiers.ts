// ─── Agency partner tiers ────────────────────────────────────────────────────
// Owner-approved program (2026-11-17). Perks are cumulative: Gold includes the
// Silver perk, Platinum includes Gold + Silver.
//
//   tier      active restaurants   commission   perks
//   SILVER    1 – 5                25%          15% discount for the agency's clients
//   GOLD      6 – 15               30%          + free menu setup (first 3 restaurants at Gold)
//   PLATINUM  16+                  35%          + dedicated account manager + co-branding
//
// Commission is recurring on every invoice the restaurant pays, for as long as
// it keeps paying, and is computed on the amount ACTUALLY paid.

export type AgencyTier = 'SILVER' | 'GOLD' | 'PLATINUM'

export interface TierDef {
  tier:        AgencyTier
  minActive:   number
  maxActive:   number | null
  ratePct:     number
}

export const AGENCY_TIERS: TierDef[] = [
  { tier: 'SILVER',   minActive: 0,  maxActive: 5,    ratePct: 25 },
  { tier: 'GOLD',     minActive: 6,  maxActive: 15,   ratePct: 30 },
  { tier: 'PLATINUM', minActive: 16, maxActive: null, ratePct: 35 },
]

export const CLIENT_DISCOUNT_PCT    = 15
export const FREE_MENU_SETUP_COUNT  = 3

export function tierFor(activeRestaurants: number): TierDef {
  return [...AGENCY_TIERS].reverse().find(t => activeRestaurants >= t.minActive) ?? AGENCY_TIERS[0]
}

export function nextTier(current: AgencyTier): TierDef | null {
  const i = AGENCY_TIERS.findIndex(t => t.tier === current)
  return AGENCY_TIERS[i + 1] ?? null
}

export function perksFor(tier: AgencyTier) {
  const rank = AGENCY_TIERS.findIndex(t => t.tier === tier)
  return {
    clientDiscount:  true,          // all tiers
    freeMenuSetup:   rank >= 1,     // Gold+
    accountManager:  rank >= 2,     // Platinum
    coBranding:      rank >= 2,     // Platinum
  }
}
