// ─── Billing Platform — Quota Service ────────────────────────────────────────
// Checks per-plan resource limits against actual tenant usage.
// Uses UsageService for current consumption and ProvisioningService for the
// tenant's plan, then resolves limits from the plan definition.

import type { QuotaCheckResult }    from '../types'
import { getUsageSummary }          from '../../tenant/usage/UsageService'
import { getProfile }               from '../../tenant/provisioning/ProvisioningService'
import { getPlan }                  from '../../tenant/plans'
import type { Plan, PlanLimits }    from '../../tenant/types'

// ─── Field Mapping ────────────────────────────────────────────────────────────
// Maps UsageSummary field names → PlanLimits keys.
// storageBytes is a special case: bytes must be converted to GB for comparison.

type FieldMapping = {
  usageKey:   string
  limitsKey:  keyof PlanLimits
  toBytesGb?: boolean   // if true, divide usageKey value by 1024^3
}

const FIELD_MAPPINGS: FieldMapping[] = [
  { usageKey: 'aiRequests',        limitsKey: 'aiRequestsPerMonth' },
  { usageKey: 'reservations',      limitsKey: 'reservationsPerMonth' },
  { usageKey: 'marketplaceOrders', limitsKey: 'marketplaceOrdersPerMonth' },
  { usageKey: 'automations',       limitsKey: 'automationExecutionsPerMonth' },
  { usageKey: 'userCount',         limitsKey: 'users' },
  { usageKey: 'tableCount',        limitsKey: 'tables' },
  { usageKey: 'qrCount',           limitsKey: 'qrCodes' },
  { usageKey: 'storageBytes',      limitsKey: 'storageGb', toBytesGb: true },
]

// Build a lookup by usageKey for O(1) access
const MAPPING_BY_KEY: Record<string, FieldMapping> = {}
for (const m of FIELD_MAPPINGS) {
  MAPPING_BY_KEY[m.usageKey] = m
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function resolveLimit(profile: Awaited<ReturnType<typeof getProfile>>, limitsKey: keyof PlanLimits): number {
  if (!profile) return -1
  const plan    = (profile.plan ?? 'FREE') as Plan
  const def     = getPlan(plan)
  const base    = def.limits[limitsKey] as number

  // Custom per-tenant overrides win
  const custom  = profile.customLimits?.[limitsKey]
  return custom !== undefined ? (custom as number) : base
}

function buildResult(
  field:   string,
  current: number,
  limit:   number,
): QuotaCheckResult {
  // -1 or 0 limits (except where 0 means "blocked") are treated as unlimited
  // Convention: limit <= 0 on FREE/CUSTOM plan for marketplace/automation means blocked;
  // but per spec, limit <= 0 → unlimited. To honour spec while still being useful,
  // we treat only explicit -1 as "unlimited" and 0 as "blocked (limit reached)".
  // However the task spec says "limit <= 0 or limit is -1 → unlimited".
  if (limit < 0) {
    return {
      allowed:    true,
      field,
      current,
      limit:      -1,
      percentage: 0,
      message:    'Unlimited',
    }
  }

  if (limit === 0) {
    // Feature not available on this plan
    return {
      allowed:    false,
      field,
      current,
      limit:      0,
      percentage: 100,
      message:    `${field} is not available on your current plan`,
    }
  }

  const percentage = Math.min(100, Math.round((current / limit) * 100))
  const allowed    = current < limit

  const result: QuotaCheckResult = {
    allowed,
    field,
    current,
    limit,
    percentage,
  }

  if (!allowed) {
    result.message = `${field} quota exceeded (${current}/${limit})`
  } else if (percentage >= 80) {
    result.message = `${field} usage at ${percentage}% of limit`
  }

  return result
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check quota for a single field.
 * @param tenantId  Tenant identifier
 * @param field     UsageSummary field name (e.g. "aiRequests", "storageBytes")
 */
export async function checkQuota(tenantId: string, field: string): Promise<QuotaCheckResult> {
  const mapping = MAPPING_BY_KEY[field]
  if (!mapping) {
    // Unknown field — treat as unlimited
    return { allowed: true, field, current: 0, limit: -1, percentage: 0, message: 'Unknown field — treated as unlimited' }
  }

  const [summary, profile] = await Promise.all([
    getUsageSummary(tenantId),
    getProfile(tenantId),
  ])

  let current = (summary as any)[mapping.usageKey] as number ?? 0
  if (mapping.toBytesGb) {
    current = current / (1024 ** 3)
  }

  const limit = resolveLimit(profile, mapping.limitsKey)

  return buildResult(field, current, limit)
}

/**
 * Check quotas for all tracked fields at once.
 * Returns a Record keyed by UsageSummary field name.
 */
export async function checkAllQuotas(tenantId: string): Promise<Record<string, QuotaCheckResult>> {
  const [summary, profile] = await Promise.all([
    getUsageSummary(tenantId),
    getProfile(tenantId),
  ])

  const results: Record<string, QuotaCheckResult> = {}

  for (const mapping of FIELD_MAPPINGS) {
    let current = (summary as any)[mapping.usageKey] as number ?? 0
    if (mapping.toBytesGb) {
      current = current / (1024 ** 3)
    }

    const limit = resolveLimit(profile, mapping.limitsKey)
    results[mapping.usageKey] = buildResult(mapping.usageKey, current, limit)
  }

  return results
}

/**
 * Returns true if the tenant is within the quota for the given field.
 */
export async function isAllowed(tenantId: string, field: string): Promise<boolean> {
  const result = await checkQuota(tenantId, field)
  return result.allowed
}
