// ─── Smart Intelligence Data Hub — Validation (K32) ────────────────────────
// Guards malformed adapter output from reaching consumers — infrastructure,
// not business rules.

import type { NormalizedMetric } from './types'

export function isValidMetric(m: unknown): m is NormalizedMetric {
  if (!m || typeof m !== 'object') return false
  const v = m as Record<string, unknown>
  return (
    typeof v['key'] === 'string' && v['key'].length > 0 &&
    typeof v['module'] === 'string' && v['module'].length > 0 &&
    typeof v['tenantId'] === 'string' && v['tenantId'].length > 0 &&
    (v['value'] === null || ['number', 'string', 'boolean'].includes(typeof v['value'])) &&
    v['computedAt'] instanceof Date
  )
}

export function assertTenantId(tenantId: string): void {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('Intelligence Data Hub: tenantId is required for tenant-aware data access')
  }
}
