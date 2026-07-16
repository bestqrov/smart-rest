// ─── Smart Intelligence Knowledge Engine — Public API (K39) ────────────────

export type { KnowledgeSourceType, KnowledgeValue, KnowledgeFact, KnowledgeSourceDefinition } from './types'

export {
  registerKnowledgeSource,
  getKnowledgeSource,
  hasKnowledgeSource,
  getAllKnowledgeSources,
  getKnowledgeSourcesByType,
} from './KnowledgeSourceRegistry'

export {
  recordKnowledge,
  getKnowledge,
  getKnowledgeHistory,
  queryKnowledge,
  syncKnowledgeFromSources,
  registerDataHubKnowledgeSource,
} from './KnowledgeEngine'
