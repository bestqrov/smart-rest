// ─── Gulf subscription plans (owner-approved pricing, 2026-11-20) ───────────
// Single source for the landing pricing table and superadmin activation.
// Local prices are FIXED, rounded psychological prices — not live FX.
// Yearly = 10 × monthly ("2 months free").
//
// Only list features that exist in the product today. Not built yet (do NOT
// advertise until they are): AI marketing videos, GPS table verification,
// per-station kitchen routing (kitchen/bar/desserts), plan limit enforcement.

export type PlanId = 'STARTER' | 'PRO' | 'ENTERPRISE'
export type PlanCurrency = 'USD' | 'SAR' | 'AED' | 'OMR'
export const PLAN_CURRENCIES: PlanCurrency[] = ['USD', 'SAR', 'AED', 'OMR']

export interface GulfPlan {
  id:       PlanId
  monthly:  Record<PlanCurrency, number>
  yearly:   Record<PlanCurrency, number>
  popular?: boolean
}

export const GULF_PLANS: GulfPlan[] = [
  { id: 'STARTER',    monthly: { USD: 49,  SAR: 185, AED: 180, OMR: 19 }, yearly: { USD: 490,  SAR: 1850, AED: 1800, OMR: 190 } },
  { id: 'PRO',        monthly: { USD: 99,  SAR: 375, AED: 365, OMR: 38 }, yearly: { USD: 990,  SAR: 3750, AED: 3650, OMR: 380 }, popular: true },
  { id: 'ENTERPRISE', monthly: { USD: 199, SAR: 750, AED: 730, OMR: 77 }, yearly: { USD: 1990, SAR: 7500, AED: 7300, OMR: 770 } },
]

/** Currency a venue is billed in: its own if it's a plan currency, else USD. */
export function planCurrencyFor(cafeCurrency: string | null | undefined): PlanCurrency {
  const c = String(cafeCurrency ?? '').toUpperCase()
  return (PLAN_CURRENCIES as string[]).includes(c) ? (c as PlanCurrency) : 'USD'
}

export function planPrice(id: PlanId, currency: PlanCurrency, cycle: 'monthly' | 'yearly'): number {
  const p = GULF_PLANS.find(x => x.id === id)
  if (!p) throw new Error(`Unknown plan ${id}`)
  return p[cycle][currency]
}
