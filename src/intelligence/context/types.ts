// ─── Smart Intelligence Context Engine — Contracts (K33) ───────────────────
// Every field here is sourced from an existing service — this module
// composes, it doesn't compute. No AI decisions or recommendations.

import type { Plan, TenantState, PlanFeatures, PlanLimits } from '../../tenant/types'
import type { Period, PeriodType } from '../../analytics/types'

export interface TenantContext {
  tenantId:    string
  plan:        Plan
  state:       TenantState
  trialEndsAt: string | undefined
  features:    PlanFeatures
  limits:      PlanLimits
}

export interface BranchContext {
  cafeId:         string
  isBranch:       boolean          // this cafe is a branch of another
  isParent:       boolean          // this cafe has branches of its own
  parentCafeId:   string | null
  siblingCafeIds: string[]         // other branches under the same parent (empty if standalone)
}

export interface UserContext {
  type:   'admin' | 'staff' | 'system'
  id:     string
  cafeId: string
  role?:  string                   // Staff.role (CASHIER | WAITER | SUPERVISOR) when type === 'staff'
}

export interface BusinessContext {
  cafeId:   string
  name:     string
  country:  string
  currency: string
  city:     string
}

export interface TimeContext {
  now:    Date
  period: Period
}

export interface RequestContext {
  source:   string           // matches the eventBus "source" convention used platform-wide
  traceId?: string
  ip?:      string
}

export interface IntelligenceContext {
  tenant:   TenantContext
  branch:   BranchContext
  user:     UserContext | null
  business: BusinessContext
  time:     TimeContext
  request:  RequestContext | null
}

export interface ResolveContextInput {
  cafeId:  string
  user?:   UserContext
  period?: PeriodType
  source?: string
  traceId?: string
  ip?:     string
}
