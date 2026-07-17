// ─── RAG Knowledge Layer — Permissions ──────────────────────────────────────
// Two independent layers, not one:
//  1. Tenant scoping — the load-bearing check for the REST API (human admin
//     callers). Enforced structurally: every service function in this module
//     requires a tenantId and every Prisma query filters by it, so
//     cross-tenant access is impossible regardless of capability checks.
//  2. Capability check — for programmatic callers (K40 agents / K46
//     advisors), mirroring skills/SkillPermissions.ts's checkSkillPermission
//     shape exactly. Reuses resolveCallerCapabilities rather than keeping a
//     second capability store — a human admin's userId will simply resolve
//     to no capabilities here, which is expected (capability gating doesn't
//     apply to REST callers, tenant scoping does).

import { resolveCallerCapabilities } from '../skills'
import type { KnowledgeQueryPermission, KnowledgePermissionCheckResult } from './types'

export function checkKnowledgeQueryPermission(
  permission: KnowledgeQueryPermission, callerId: string, tenantId?: string,
): KnowledgePermissionCheckResult {
  if (permission.tenantScoped && !tenantId) {
    return { allowed: false, reason: 'query is tenant-scoped but no tenantId was provided' }
  }

  if (permission.requiredCapabilities.length > 0) {
    const held = resolveCallerCapabilities(callerId)
    const missing = permission.requiredCapabilities.filter((c) => !held.includes(c))
    if (missing.length > 0) {
      return { allowed: false, reason: `caller "${callerId}" is missing capabilities: ${missing.join(', ')}` }
    }
  }

  return { allowed: true }
}
