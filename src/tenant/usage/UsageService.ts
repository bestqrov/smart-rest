// ─── Tenant Lifecycle Engine — Usage Tracking ────────────────────────────────
// Tracks resource consumption per tenant per calendar month.
// Counts are additive increments — not absolute values (use syncCounts for absolutes).

import type { UsageSummary, UsageField, Plan } from '../types'
import { getPlan }                              from '../plans'
import { getProfile }                           from '../provisioning/ProvisioningService'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

function currentPeriod(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

async function getOrCreateSnapshot(tenantId: string, period = currentPeriod()) {
  const prisma = await getPrisma()
  return (prisma as any).tenantUsageSnapshot.upsert({
    where:  { tenantId_period: { tenantId, period } },
    update: {},
    create: { tenantId, period },
  })
}

// ─── Increment a counter ──────────────────────────────────────────────────────
export async function increment(
  tenantId: string,
  field: UsageField,
  amount = 1,
): Promise<void> {
  const prisma = await getPrisma()
  const period = currentPeriod()
  await getOrCreateSnapshot(tenantId, period)
  await (prisma as any).tenantUsageSnapshot.update({
    where: { tenantId_period: { tenantId, period } },
    data:  { [field]: { increment: amount } },
  })
}

// ─── Sync absolute counts (users, tables, QRs — from live queries) ────────────
export async function syncCounts(
  tenantId: string,
  counts: Partial<{
    userCount: number
    tableCount: number
    qrCount: number
    storageBytes: number
  }>,
): Promise<void> {
  const prisma = await getPrisma()
  const period = currentPeriod()
  await getOrCreateSnapshot(tenantId, period)
  await (prisma as any).tenantUsageSnapshot.update({
    where: { tenantId_period: { tenantId, period } },
    data:  counts,
  })
}

// ─── Get usage summary with limit percentages ─────────────────────────────────
export async function getUsageSummary(tenantId: string, period = currentPeriod()): Promise<UsageSummary> {
  const prisma  = await getPrisma()
  const profile = await getProfile(tenantId)
  const plan    = (profile?.plan ?? 'FREE') as Plan
  const def     = getPlan(plan)

  // Merge plan limits with any custom limits
  const customLimits = profile?.customLimits ?? {}
  const limits = { ...def.limits, ...customLimits }

  const snap = await (prisma as any).tenantUsageSnapshot.findUnique({
    where: { tenantId_period: { tenantId, period } },
  }) ?? {
    storageBytes: 0, aiRequests: 0, userCount: 0, tableCount: 0,
    qrCount: 0, reservations: 0, marketplaceOrders: 0, automations: 0,
  }

  const storageBytesLimit = limits.storageGb * 1024 * 1024 * 1024

  const pct = (used: number, limit: number) =>
    limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100))

  return {
    tenantId,
    period,
    storageBytes:      snap.storageBytes,
    storageGb:         snap.storageBytes / (1024 ** 3),
    aiRequests:        snap.aiRequests,
    userCount:         snap.userCount,
    tableCount:        snap.tableCount,
    qrCount:           snap.qrCount,
    reservations:      snap.reservations,
    marketplaceOrders: snap.marketplaceOrders,
    automations:       snap.automations,
    limits,
    percentages: {
      storage:          pct(snap.storageBytes,     storageBytesLimit),
      aiRequests:       pct(snap.aiRequests,        limits.aiRequestsPerMonth),
      users:            pct(snap.userCount,         limits.users),
      tables:           pct(snap.tableCount,        limits.tables),
      qrCodes:          pct(snap.qrCount,           limits.qrCodes),
      reservations:     pct(snap.reservations,      limits.reservationsPerMonth),
      marketplaceOrders:pct(snap.marketplaceOrders, limits.marketplaceOrdersPerMonth),
      automations:      pct(snap.automations,       limits.automationExecutionsPerMonth),
    },
  }
}

// ─── Check limit (returns true if within limits) ──────────────────────────────
export async function checkLimit(
  tenantId: string,
  field: UsageField,
): Promise<{ allowed: boolean; current: number; limit: number; percentage: number }> {
  const summary = await getUsageSummary(tenantId)
  const fieldMap: Record<UsageField, { current: number; limit: number }> = {
    aiRequests:        { current: summary.aiRequests,        limit: summary.limits.aiRequestsPerMonth },
    reservations:      { current: summary.reservations,      limit: summary.limits.reservationsPerMonth },
    marketplaceOrders: { current: summary.marketplaceOrders, limit: summary.limits.marketplaceOrdersPerMonth },
    automations:       { current: summary.automations,       limit: summary.limits.automationExecutionsPerMonth },
  }
  const { current, limit } = fieldMap[field]
  const percentage = limit <= 0 ? 100 : Math.min(100, Math.round((current / limit) * 100))
  return { allowed: limit <= 0 || current < limit, current, limit, percentage }
}

// ─── Usage history ────────────────────────────────────────────────────────────
export async function getUsageHistory(tenantId: string, months = 6) {
  const prisma = await getPrisma()
  const rows   = await (prisma as any).tenantUsageSnapshot.findMany({
    where:   { tenantId },
    orderBy: { period: 'desc' },
    take:    months,
  })
  return rows
}
