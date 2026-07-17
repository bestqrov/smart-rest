// ─── RAG Knowledge Layer — Public API ───────────────────────────────────────
// Foundation for future retrieval-augmented generation. Explicitly RAG-ready,
// not RAG-complete: no embeddings, no external AI provider calls in this
// module. See types.ts for the full contract and the collision note re:
// src/intelligence/knowledge/ (K39 — an unrelated versioned fact store).

export type {
  DocumentSourceType, DocumentStatus, KnowledgeRepository, CreateRepositoryInput,
  KnowledgeDocument, CreateDocumentInput, KnowledgeChunk, ChunkingOptions,
  SearchQuery, SearchResultItem, SearchResult, SemanticSearchProvider,
  RetrievalOptions, RetrievalResult, KnowledgeQueryPermission, KnowledgePermissionCheckResult,
} from './types'

export {
  createRepository, getRepository, listRepositories, updateRepository, deleteRepository,
} from './RepositoryService'

export {
  createDocument, getDocument, getDocumentWithChunks, listDocuments, deleteDocument,
} from './DocumentService'

export {
  splitIntoChunks, listChunksForDocument, listChunksForRepository, listChunksForTenant,
} from './ChunkService'

export {
  registerSearchProvider, setActiveSearchProvider, getActiveSearchProvider, _resetSearchProviderRegistry,
} from './search/SearchProviderRegistry'

export { keywordOverlapSearchProvider } from './search/KeywordOverlapSearchProvider'

export { buildContext, type BuiltContext } from './ContextBuilder'

export { retrieve } from './RetrievalService'

export { checkKnowledgeQueryPermission } from './KnowledgePermissions'

export { recordKnowledgeAudit, getKnowledgeAuditHistory } from './KnowledgeAuditLog'
