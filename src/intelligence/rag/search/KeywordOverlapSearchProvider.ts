// ─── RAG Knowledge Layer — Default Search Provider ──────────────────────────
// Bag-of-words term-overlap scoring. NOT embeddings, NOT a call to any AI
// provider — a deliberately simple, dependency-free default that satisfies
// SemanticSearchProvider today and can be replaced by a real
// embedding-backed provider later without any caller changing (that's the
// entire point of the interface in types.ts).

import type { SemanticSearchProvider, SearchQuery, SearchResultItem, KnowledgeChunk } from '../types'

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9؀-ۿ]+/g) ?? [] // Latin + Arabic word chars
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1)
  return freq
}

// score = sum over query terms of (occurrences in chunk / chunk length) —
// a simple normalized term-frequency overlap, not TF-IDF (no corpus-wide
// document-frequency statistics tracked — out of scope for this sprint).
function scoreChunk(queryTerms: string[], chunk: KnowledgeChunk): number {
  const chunkTokens = tokenize(chunk.content)
  if (chunkTokens.length === 0) return 0
  const freq = termFrequencies(chunkTokens)

  let score = 0
  for (const term of queryTerms) {
    const count = freq.get(term) ?? 0
    if (count > 0) score += count / chunkTokens.length
  }
  return score
}

export const keywordOverlapSearchProvider: SemanticSearchProvider = {
  name: 'keyword-overlap-v1',
  search(query: SearchQuery, candidates: KnowledgeChunk[]): SearchResultItem[] {
    const queryTerms = [...new Set(tokenize(query.text))]
    if (queryTerms.length === 0) return []

    return candidates
      .map((chunk) => ({ chunk, score: scoreChunk(queryTerms, chunk) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
  },
}
