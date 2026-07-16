// ─── Smart Intelligence Knowledge Engine — Core (K39) ──────────────────────
// recordKnowledge versions in place: the previous current row for
// (tenantId, key) is marked isCurrent=false, a new row is inserted with
// version+1 — one table, no separate history table (no duplicate storage).
// syncFromDataHub is the concrete reuse of K32's Data Hub as a knowledge
// source, registered like any other source.

import prisma from '../../prisma'
import { publishStandardEvent } from '../../core'
import { getTenantMetrics } from '../data'
import { registerKnowledgeSource, getAllKnowledgeSources } from './KnowledgeSourceRegistry'
import type { KnowledgeFact, KnowledgeValue } from './types'

function serializeValue(value: KnowledgeValue): string {
  return JSON.stringify(value)
}

function deserializeValue(raw: string): KnowledgeValue {
  try { return JSON.parse(raw) } catch { return null }
}

// ─── Record (versioned write) ──────────────────────────────────────────────
export async function recordKnowledge(tenantId: string, fact: KnowledgeFact) {
  const current = await prisma.knowledgeEntry.findFirst({
    where: { tenantId, key: fact.key, isCurrent: true },
  })

  if (current) {
    await prisma.knowledgeEntry.update({ where: { id: current.id }, data: { isCurrent: false } })
  }

  const entry = await prisma.knowledgeEntry.create({
    data: {
      tenantId,
      key:        fact.key,
      value:      serializeValue(fact.value),
      sourceType: fact.sourceType,
      sourceId:   fact.sourceId,
      confidence: fact.confidence,
      version:    (current?.version ?? 0) + 1,
      isCurrent:  true,
    },
  })

  publishStandardEvent('IntelKnowledgeRecorded', {
    tenantId, resourceId: entry.id, metadata: { key: fact.key, sourceType: fact.sourceType, version: entry.version },
  }, 'knowledge-engine')

  return entry
}

// ─── Retrieval API (tenant-isolated by construction — tenantId is required) ─
export async function getKnowledge(tenantId: string, key: string) {
  const entry = await prisma.knowledgeEntry.findFirst({ where: { tenantId, key, isCurrent: true } })
  if (!entry) return null
  return { ...entry, value: deserializeValue(entry.value) }
}

export async function getKnowledgeHistory(tenantId: string, key: string) {
  const entries = await prisma.knowledgeEntry.findMany({
    where: { tenantId, key }, orderBy: { version: 'desc' },
  })
  return entries.map(e => ({ ...e, value: deserializeValue(e.value) }))
}

export async function queryKnowledge(tenantId: string, keyPrefix?: string) {
  const entries = await prisma.knowledgeEntry.findMany({
    where: { tenantId, isCurrent: true, ...(keyPrefix ? { key: { startsWith: keyPrefix } } : {}) },
    orderBy: { key: 'asc' },
  })
  return entries.map(e => ({ ...e, value: deserializeValue(e.value) }))
}

// ─── Sync from all registered sources ──────────────────────────────────────
export async function syncKnowledgeFromSources(tenantId: string) {
  const sources = getAllKnowledgeSources()
  const recorded = []
  for (const source of sources) {
    const facts = await source.fetch(tenantId)
    for (const fact of facts) {
      recorded.push(await recordKnowledge(tenantId, fact))
    }
  }
  return recorded
}

// ─── Built-in Data Hub source (K32 reuse) ──────────────────────────────────
export function registerDataHubKnowledgeSource(): void {
  registerKnowledgeSource({
    id:   'data-hub',
    name: 'Data Hub Metrics',
    type: 'DATA_HUB',
    fetch: async (tenantId: string): Promise<KnowledgeFact[]> => {
      const metrics = await getTenantMetrics(tenantId)
      return metrics.map(m => ({
        key: m.key, value: m.value, sourceType: 'DATA_HUB', sourceId: m.module,
      }))
    },
  })
}
