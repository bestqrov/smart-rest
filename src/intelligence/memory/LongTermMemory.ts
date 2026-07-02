// ─── Smart Intelligence Memory Engine — Long-Term Interface (K44) ──────────
// No second persisted store: long-term memory IS the K39 Knowledge Engine,
// addressed through a "memory:<namespace>:<key>" key namespace so it can't
// collide with facts recorded by other knowledge sources.

import { recordKnowledge, getKnowledge, getKnowledgeHistory } from '../knowledge'
import type { KnowledgeValue } from '../knowledge'

function memoryKey(namespace: string, key: string): string {
  return `memory:${namespace}:${key}`
}

export async function rememberLongTerm(tenantId: string, namespace: string, key: string, value: KnowledgeValue) {
  return recordKnowledge(tenantId, {
    key: memoryKey(namespace, key), value, sourceType: 'SYSTEM', sourceId: 'memory-engine',
  })
}

export async function recallLongTerm(tenantId: string, namespace: string, key: string) {
  const entry = await getKnowledge(tenantId, memoryKey(namespace, key))
  return entry ? entry.value : undefined
}

export async function recallLongTermHistory(tenantId: string, namespace: string, key: string) {
  const entries = await getKnowledgeHistory(tenantId, memoryKey(namespace, key))
  return entries.map(e => e.value)
}
