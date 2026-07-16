// ─── Smart Intelligence Skill System — Permissions (K47) ───────────────────
// Resolves a caller's capabilities from whichever registry already knows
// it — K40's framework agents or K46's advisors — instead of skills
// keeping a third, parallel capability store.

import { getFrameworkAgent } from '../agents'
import { findAdvisor } from '../advisor'
import type { SkillPermission } from './types'

export function resolveCallerCapabilities(callerId: string): string[] {
  const agent   = getFrameworkAgent(callerId)
  const advisor = findAdvisor(callerId)
  const capabilities = new Set<string>([...(agent?.capabilities ?? []), ...(advisor?.capabilities ?? [])])
  return [...capabilities]
}

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}

export function checkSkillPermission(
  permission: SkillPermission, callerId: string, tenantId?: string,
): PermissionCheckResult {
  if (permission.tenantScoped && !tenantId) {
    return { allowed: false, reason: 'skill is tenant-scoped but no tenantId was provided' }
  }

  if (permission.requiredCapabilities.length > 0) {
    const held = resolveCallerCapabilities(callerId)
    const missing = permission.requiredCapabilities.filter(c => !held.includes(c))
    if (missing.length > 0) {
      return { allowed: false, reason: `caller "${callerId}" is missing capabilities: ${missing.join(', ')}` }
    }
  }

  return { allowed: true }
}
