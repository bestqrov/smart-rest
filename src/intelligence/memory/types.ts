// ─── Smart Intelligence Memory Engine — Contracts (K44) ────────────────────
// Two tiers, no vector store: short-term = ephemeral TTL cache (process
// memory, lost on restart); long-term = durable facts, delegated entirely
// to the K39 Knowledge Engine's versioned KnowledgeEntry table (no second
// persisted store).

export type MemoryTier = 'SHORT_TERM' | 'LONG_TERM' | 'BOTH'

export interface MemoryNamespaceDefinition {
  id:          string       // e.g. "agent-scratchpad", "session-context"
  tier:        MemoryTier
  ttlMs:       number       // short-term expiration; ignored for LONG_TERM-only namespaces
  description: string
}

export interface RememberOptions {
  ttlMs?: number   // overrides the namespace default for this write
}

export interface MemoryEntry<T = unknown> {
  namespace: string
  key:       string
  value:     T
  tier:      'SHORT_TERM' | 'LONG_TERM'
}
