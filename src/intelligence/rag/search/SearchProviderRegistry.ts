// ─── RAG Knowledge Layer — Search Provider Registry ─────────────────────────
// Same Map-based registry idiom as KnowledgeSourceRegistry (K39) and
// DataAdapterRegistry (K32) — one active provider by default
// (keywordOverlapSearchProvider), swappable for a future embedding-backed
// provider without changing RetrievalService.

import { keywordOverlapSearchProvider } from './KeywordOverlapSearchProvider'
import type { SemanticSearchProvider } from '../types'

const providers = new Map<string, SemanticSearchProvider>()
let activeProviderName = keywordOverlapSearchProvider.name

providers.set(keywordOverlapSearchProvider.name, keywordOverlapSearchProvider)

export function registerSearchProvider(provider: SemanticSearchProvider): void {
  providers.set(provider.name, provider)
}

export function setActiveSearchProvider(name: string): void {
  if (!providers.has(name)) throw new Error(`Unknown search provider "${name}"`)
  activeProviderName = name
}

export function getActiveSearchProvider(): SemanticSearchProvider {
  const provider = providers.get(activeProviderName)
  if (!provider) throw new Error(`Active search provider "${activeProviderName}" is not registered`)
  return provider
}

// Test-only reset, matching KnowledgeSourceRegistry's _resetKnowledgeSourceRegistry convention.
export function _resetSearchProviderRegistry(): void {
  providers.clear()
  providers.set(keywordOverlapSearchProvider.name, keywordOverlapSearchProvider)
  activeProviderName = keywordOverlapSearchProvider.name
}
