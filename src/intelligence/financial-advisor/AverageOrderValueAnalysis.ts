// ─── Smart Intelligence Financial Advisor v1 — Average Order Value (K65) ───
// Reuses services/billing.ts's computeCafeAOV directly — the exact
// existing, exported, tenant-scoped AOV calculation. No recomputation.

import { computeCafeAOV } from '../../services/billing'
import type { AverageOrderValue } from './types'

export async function getAverageOrderValue(tenantId: string): Promise<AverageOrderValue> {
  return computeCafeAOV(tenantId)
}
