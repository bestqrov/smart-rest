// ─── Billing Platform — Billing Usage Service ─────────────────────────────

import { increment, syncCounts, getUsageSummary } from '../../tenant/usage/UsageService'
import { checkQuota }                             from '../quotas/QuotaService'
import { emitQuotaExceeded }                      from '../events/BillingEvents'
import { notifyQuotaExceeded }                    from '../notifications/BillingNotifications'

export { getUsageSummary }

export async function trackUsage(
  tenantId: string,
  module:   string,
  field:    string,
  amount    = 1,
): Promise<{ allowed: boolean }> {
  await increment(tenantId, field as any, amount)

  const quota = await checkQuota(tenantId, field)
  if (!quota.allowed) {
    await emitQuotaExceeded({ tenantId, module, field, metadata: { current: quota.current, limit: quota.limit } as any }).catch(() => undefined)
    await notifyQuotaExceeded(tenantId, field, quota.current, quota.limit).catch(() => undefined)
    return { allowed: false }
  }
  return { allowed: true }
}

export async function syncAbsoluteCounts(
  tenantId: string,
  counts:   Parameters<typeof syncCounts>[1],
): Promise<void> {
  await syncCounts(tenantId, counts)
}
