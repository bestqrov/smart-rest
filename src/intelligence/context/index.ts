// ─── Smart Intelligence Context Engine — Public API (K33) ──────────────────

export type {
  IntelligenceContext, TenantContext, BranchContext, UserContext,
  BusinessContext, TimeContext, RequestContext, ResolveContextInput,
} from './types'

export { resolveContext } from './ContextResolver'
export { getContextForTenant } from './ContextAPI'
export { userContextFromAdmin, userContextFromStaff } from './UserContextFactory'
