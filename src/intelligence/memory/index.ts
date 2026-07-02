// ─── Smart Intelligence Memory Engine — Public API (K44) ───────────────────

export type { MemoryTier, MemoryNamespaceDefinition, RememberOptions, MemoryEntry } from './types'

export {
  registerMemoryNamespace, getMemoryNamespace, hasMemoryNamespace, getAllMemoryNamespaces,
} from './MemoryRegistry'

export { remember, recall, forget } from './MemoryEngine'

export { recallLongTermHistory } from './LongTermMemory'

export { listShortTermKeys } from './ShortTermMemory'
