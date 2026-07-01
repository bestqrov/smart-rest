// ─── Billing Platform — Settings Service ───────────────────────────────────
// Typed wrapper around the existing RuntimeConfig key/value store, scoped to
// the "billing" settings category. Read/update endpoints are already exposed
// generically at GET/PATCH /api/superadmin/ops/runtime(/:key).

import { getAllSettings, getSetting, updateSetting } from '../../ops/runtime/RuntimeConfig'
import type { RuntimeSetting } from '../../ops/types'

export async function getTrialDurationDays(): Promise<number> {
  return getSetting<number>('billing.trial_duration_days')
}

export async function getGracePeriodDays(): Promise<number> {
  return getSetting<number>('billing.grace_period_days')
}

export async function getDefaultAutoRenew(): Promise<boolean> {
  return getSetting<boolean>('billing.default_auto_renew')
}

export async function getBillingCurrency(): Promise<string> {
  return getSetting<string>('billing.currency')
}

export async function getInvoicePrefix(): Promise<string> {
  return getSetting<string>('billing.invoice_prefix')
}

export async function getWebhookSecret(): Promise<string> {
  return getSetting<string>('billing.webhook_secret')
}

export async function getAllBillingSettings(): Promise<RuntimeSetting[]> {
  const all = await getAllSettings()
  return all.filter(s => s.category === 'billing')
}

export async function updateBillingSetting(
  key: string,
  value: unknown,
  updatedBy = 'system',
): Promise<RuntimeSetting> {
  if (!key.startsWith('billing.')) throw new Error(`BillingSettingsService: "${key}" is not a billing setting`)
  return updateSetting(key, value, updatedBy)
}
