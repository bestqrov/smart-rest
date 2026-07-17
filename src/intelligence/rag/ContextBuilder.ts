// ─── RAG Knowledge Layer — Context Builder ──────────────────────────────────
// Assembles ranked search results into a single bounded context string —
// the piece a future prompt-assembly step (K48+, out of scope here) would
// hand to an LLM. Pure text assembly: no AI calls, no token-counting via a
// real tokenizer (word count is used as an approximation, consistent with
// ChunkService).
//
// Distinct from src/intelligence/context/ (K33 — tenant/business/user/time
// context composition for advisors, unrelated to chunk-to-prompt assembly).

import type { SearchResultItem } from './types'

export interface BuiltContext {
  text:      string
  chunkIds:  string[]
  wordCount: number
  truncated: boolean
}

export function buildContext(items: SearchResultItem[], maxWords = 1000): BuiltContext {
  const included: SearchResultItem[] = []
  let wordCount = 0
  let truncated = false

  for (const item of items) {
    const words = item.chunk.content.split(/\s+/).filter(Boolean).length
    if (wordCount + words > maxWords) {
      if (included.length === 0) {
        // Always include at least the single highest-ranked chunk, even if
        // it alone exceeds the budget — an empty context is worse than one
        // over-budget chunk.
        included.push(item)
        wordCount += words
      }
      truncated = true
      break
    }
    included.push(item)
    wordCount += words
  }

  const text = included
    .map((item, i) => `[${i + 1}] ${item.chunk.content}`)
    .join('\n\n')

  return { text, chunkIds: included.map((i) => i.chunk.id), wordCount, truncated }
}
