// ─── Smart Intelligence API Gateway — Permission Checks (K50) ──────────────
// Route-level auth (requireSuperAdmin) is enforced by the Express layer,
// same as every other SuperAdmin route in this codebase. This is the
// second gate: an operation may declare requiredCapabilities (K49) that
// the caller must hold — reserved for future gateway operations, since
// none registered in K50 declare any.

import { validateCapabilitySet } from '../capabilities'
import type { GatewayOperation } from './types'

export interface PermissionGateResult {
  allowed: boolean
  reason?: string
}

export function checkOperationPermission(op: GatewayOperation, callerCapabilities: string[]): PermissionGateResult {
  if (!op.requiredCapabilities || op.requiredCapabilities.length === 0) {
    return { allowed: true }
  }

  const missing = op.requiredCapabilities.filter(c => !callerCapabilities.includes(c))
  if (missing.length > 0) {
    return { allowed: false, reason: `missing capabilities: ${missing.join(', ')}` }
  }

  // Capabilities the caller does hold must still be registered/compatible.
  const validation = validateCapabilitySet(op.requiredCapabilities)
  if (!validation.valid) {
    return { allowed: false, reason: validation.errors.join('; ') }
  }

  return { allowed: true }
}
