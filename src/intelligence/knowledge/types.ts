// ─── Smart Intelligence Knowledge Engine — Contracts (K39) ─────────────────
// A durable, versioned fact store — not a vector DB, not RAG. Retrieval is
// by (tenantId, key), never by similarity.

export type KnowledgeSourceType = 'MANUAL' | 'DATA_HUB' | 'INSIGHT' | 'DECISION' | 'SYSTEM'

export type KnowledgeValue = string | number | boolean | null

export interface KnowledgeFact {
  key:         string             // namespaced, e.g. "billing.mrr", "business.peakHours"
  value:       KnowledgeValue
  sourceType:  KnowledgeSourceType
  sourceId?:   string
  confidence?: number
}

// A source is a pull-based contributor of facts, reusing an existing
// Intelligence service (e.g. the Data Hub) — same shape as
// DataAdapterDefinition (K32) applied to knowledge instead of raw metrics.
export interface KnowledgeSourceDefinition {
  id:    string
  name:  string
  type:  KnowledgeSourceType
  fetch: (tenantId: string) => Promise<KnowledgeFact[]>
}
