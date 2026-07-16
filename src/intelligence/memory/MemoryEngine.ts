// ─── Smart Intelligence Memory Engine — Core (K44) ─────────────────────────
// Routes remember/recall/forget to the short-term cache and/or the K39
// Knowledge Engine based on the namespace's declared tier. Writes and
// forgets are audited (same AuditService pattern as K38/K43); reads are
// not, to avoid audit-log volume on hot paths.

import { AuditService } from '../../core'
import type { KnowledgeValue } from '../knowledge'
import { getMemoryNamespace } from './MemoryRegistry'
import { setShortTerm, getShortTerm, forgetShortTerm } from './ShortTermMemory'
import { rememberLongTerm, recallLongTerm } from './LongTermMemory'
import type { RememberOptions } from './types'

function requireNamespace(namespace: string) {
  const def = getMemoryNamespace(namespace)
  if (!def) throw new Error(`Intelligence: memory namespace "${namespace}" is not registered`)
  return def
}

export async function remember(
  tenantId: string, namespace: string, key: string, value: KnowledgeValue, opts: RememberOptions = {},
): Promise<void> {
  const def = requireNamespace(namespace)

  if (def.tier === 'SHORT_TERM' || def.tier === 'BOTH') {
    setShortTerm(tenantId, namespace, key, value, opts.ttlMs ?? def.ttlMs)
  }
  if (def.tier === 'LONG_TERM' || def.tier === 'BOTH') {
    await rememberLongTerm(tenantId, namespace, key, value)
  }

  await AuditService.createAudit({
    module: 'INTELLIGENCE', entity: 'Memory', entityId: `${namespace}:${key}`, action: 'REMEMBER',
    performedBy: 'memory-engine', metadata: { tenantId, tier: def.tier },
  }).catch(() => undefined)
}

export async function recall(tenantId: string, namespace: string, key: string): Promise<KnowledgeValue | undefined> {
  const def = requireNamespace(namespace)

  if (def.tier === 'SHORT_TERM' || def.tier === 'BOTH') {
    const cached = getShortTerm<KnowledgeValue>(tenantId, namespace, key)
    if (cached !== undefined) return cached
  }
  if (def.tier === 'LONG_TERM' || def.tier === 'BOTH') {
    return recallLongTerm(tenantId, namespace, key)
  }
  return undefined
}

export async function forget(tenantId: string, namespace: string, key: string): Promise<void> {
  requireNamespace(namespace)
  forgetShortTerm(tenantId, namespace, key)

  await AuditService.createAudit({
    module: 'INTELLIGENCE', entity: 'Memory', entityId: `${namespace}:${key}`, action: 'FORGET',
    performedBy: 'memory-engine', metadata: { tenantId },
  }).catch(() => undefined)
}
