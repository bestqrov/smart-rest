// ─── Billing Platform — Usage Limit Enforcement ────────────────────────────
// Enforcement layer on top of the existing QuotaService / BillingUsageService.
// Covers: users/staff, tables (branches), QR codes (QR menus), reservations,
// AI requests and storage — every one of these already has a plan limit and
// a usage counter; this module adds the "block the action" behaviour that
// was missing (trackUsage only warns after incrementing).

import { checkQuota, checkAllQuotas } from '../quotas/QuotaService'
import { trackUsage }                 from '../usage/BillingUsageService'
import { logUsageReset }              from '../audit/BillingAuditService'
import type { QuotaCheckResult }      from '../types'

export class UsageLimitError extends Error {
  constructor(
    public readonly field:   string,
    public readonly current: number,
    public readonly limit:   number,
  ) {
    super(`Usage limit exceeded for "${field}" (${current}/${limit})`)
    this.name = 'UsageLimitError'
  }
}

export interface RemainingQuota {
  field:     string
  current:   number
  limit:     number
  remaining: number
}

function toRemaining(result: QuotaCheckResult): RemainingQuota {
  return {
    field:     result.field,
    current:   result.current,
    limit:     result.limit,
    remaining: result.limit < 0 ? -1 : Math.max(0, result.limit - result.current),
  }
}

// ─── Checks (delegate to QuotaService — no duplicated limit logic) ────────
export async function checkLimit(tenantId: string, field: string): Promise<QuotaCheckResult> {
  return checkQuota(tenantId, field)
}

export async function checkAllLimits(tenantId: string): Promise<Record<string, QuotaCheckResult>> {
  return checkAllQuotas(tenantId)
}

// ─── Remaining quota ────────────────────────────────────────────────────────
export async function getRemainingQuota(tenantId: string, field: string): Promise<RemainingQuota> {
  return toRemaining(await checkQuota(tenantId, field))
}

export async function getAllRemainingQuotas(tenantId: string): Promise<Record<string, RemainingQuota>> {
  const all = await checkAllQuotas(tenantId)
  const remaining: Record<string, RemainingQuota> = {}
  for (const [field, result] of Object.entries(all)) {
    remaining[field] = toRemaining(result)
  }
  return remaining
}

// ─── Enforcement — throws a clear, typed error when the limit is reached ──
export async function enforceLimit(tenantId: string, field: string): Promise<void> {
  const result = await checkQuota(tenantId, field)
  if (!result.allowed) {
    throw new UsageLimitError(field, result.current, result.limit)
  }
}

// Pre-checks the limit (blocking) before incrementing via the existing
// BillingUsageService.trackUsage — reuses trackUsage as-is, doesn't duplicate it.
export async function enforceAndTrack(
  tenantId: string,
  module:   string,
  field:    string,
  amount = 1,
): Promise<void> {
  await enforceLimit(tenantId, field)
  await trackUsage(tenantId, module, field, amount)
}

// ─── Reset usage counters (admin only) ─────────────────────────────────────
async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

function currentPeriod(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function resetUsageCounters(tenantId: string, performedBy: string): Promise<void> {
  const prisma = await getPrisma()
  const period = currentPeriod()
  await (prisma as any).tenantUsageSnapshot.upsert({
    where:  { tenantId_period: { tenantId, period } },
    update: {
      aiRequests: 0, userCount: 0, tableCount: 0, qrCount: 0,
      reservations: 0, marketplaceOrders: 0, automations: 0,
      certificates: 0, storageBytes: 0,
    },
    create: { tenantId, period },
  })
  await logUsageReset(tenantId, performedBy, { period })
}
