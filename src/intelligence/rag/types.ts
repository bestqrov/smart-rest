// ─── RAG Knowledge Layer — Contracts ────────────────────────────────────────
// Foundation for a future retrieval-augmented-generation pipeline. This
// sprint is explicitly RAG-ready but NOT RAG-complete: no embeddings, no
// external AI provider calls anywhere in this module. SemanticSearchProvider
// is an interface specifically so a future embedding-backed implementation
// can be swapped in without touching RetrievalService or the REST API.
//
// Distinct from src/intelligence/knowledge/ (a versioned tenant fact store
// keyed by (tenantId, key) — not a document/chunk system).

export type DocumentSourceType = 'MANUAL' | 'UPLOAD' | 'URL' | 'SYSTEM'
export type DocumentStatus     = 'PENDING' | 'PROCESSED' | 'FAILED'

export interface KnowledgeRepository {
  id:          string
  tenantId:    string
  name:        string
  description: string | null
  isActive:    boolean
  createdAt:   Date
  updatedAt:   Date
}

export interface CreateRepositoryInput {
  tenantId:    string
  name:        string
  description?: string
}

export interface KnowledgeDocument {
  id:           string
  repositoryId: string
  tenantId:     string
  title:        string
  sourceType:   DocumentSourceType
  sourceRef:    string | null
  contentType:  string
  status:       DocumentStatus
  metadata:     Record<string, unknown> | undefined
  createdAt:    Date
  updatedAt:    Date
}

export interface CreateDocumentInput {
  repositoryId: string
  tenantId:     string
  title:        string
  content:      string             // raw text — chunked synchronously by DocumentService
  sourceType?:  DocumentSourceType
  sourceRef?:   string
  contentType?: string
  metadata?:    Record<string, unknown>
}

export interface KnowledgeChunk {
  id:           string
  documentId:   string
  repositoryId: string
  tenantId:     string
  chunkIndex:   number
  content:      string
  tokenCount:   number | null
  metadata:     Record<string, unknown> | undefined
  createdAt:    Date
}

export interface ChunkingOptions {
  maxChunkWords?:     number  // default 200 — approximate, word-count based (no real tokenizer, no AI)
  overlapWords?:       number  // default 20
}

// ─── Semantic Search abstraction ────────────────────────────────────────────

export interface SearchQuery {
  tenantId:      string
  repositoryId?: string        // scope to one repository; omit to search all of a tenant's repositories
  text:          string
  limit?:        number        // default 10
}

export interface SearchResultItem {
  chunk: KnowledgeChunk
  score: number                // provider-defined relevance score, higher = more relevant. Not a cosine
                                // similarity today (no embeddings) — see KeywordOverlapSearchProvider.
}

export interface SearchResult {
  query:   SearchQuery
  items:   SearchResultItem[]
  provider: string             // which SemanticSearchProvider produced this (for observability/debugging)
}

// The pluggable abstraction: today only KeywordOverlapSearchProvider (no AI,
// no embeddings) implements this. A future EmbeddingSearchProvider can
// implement the same interface and be swapped in via SEARCH_PROVIDER below
// without any caller (RetrievalService, REST API) changing.
export interface SemanticSearchProvider {
  readonly name: string
  search(query: SearchQuery, candidates: KnowledgeChunk[]): SearchResultItem[]
}

// ─── Retrieval Layer ─────────────────────────────────────────────────────────

export interface RetrievalOptions {
  limit?:          number   // max chunks to retrieve, default 10
  maxContextWords?: number   // context-builder budget, default 1000
}

export interface RetrievalResult {
  query:   SearchQuery
  chunks:  SearchResultItem[]     // ranked, already trimmed to the context budget
  context: string                 // assembled context text (ContextBuilder output)
  truncated: boolean               // true if not all matched chunks fit maxContextWords
}

// ─── Permission-aware queries ───────────────────────────────────────────────
// Mirrors src/intelligence/skills/SkillPermissions.ts's SkillPermission
// shape — same pattern, domain-specific type (Knowledge, not Skill).

export interface KnowledgeQueryPermission {
  tenantScoped:          boolean
  requiredCapabilities:  string[]
}

export interface KnowledgePermissionCheckResult {
  allowed: boolean
  reason?: string
}
