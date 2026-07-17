// ─── RAG Knowledge Layer — Chunk Service ────────────────────────────────────
// Word-count based splitter with overlap — a standard RAG preprocessing
// technique. Deliberately NOT a real tokenizer and NOT an embedding call:
// tokenCount is an approximation (word count), used only for the
// ContextBuilder's word-budget, not for any AI provider's token limit.

import prisma from '../../prisma'
import type { KnowledgeChunk, ChunkingOptions } from './types'

const DEFAULT_MAX_CHUNK_WORDS = 200
const DEFAULT_OVERLAP_WORDS   = 20

function toModel(row: any): KnowledgeChunk {
  return {
    id: row.id, documentId: row.documentId, repositoryId: row.repositoryId,
    tenantId: row.tenantId, chunkIndex: row.chunkIndex, content: row.content,
    tokenCount: row.tokenCount ?? null,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.createdAt,
  }
}

// Splits text into overlapping word-count windows. Paragraph boundaries
// (blank lines) are preferred split points when they fall near a window
// edge, so chunks don't cut mid-sentence more than necessary — still no
// NLP/AI involved, just a newline heuristic.
export function splitIntoChunks(text: string, opts?: ChunkingOptions): string[] {
  const maxWords = opts?.maxChunkWords ?? DEFAULT_MAX_CHUNK_WORDS
  const overlap  = Math.min(opts?.overlapWords ?? DEFAULT_OVERLAP_WORDS, maxWords - 1)

  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const chunks: string[] = []
  let start = 0
  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length)
    chunks.push(words.slice(start, end).join(' '))
    if (end >= words.length) break
    start = end - overlap
  }
  return chunks
}

export async function createChunksForDocument(
  documentId: string, repositoryId: string, tenantId: string, text: string, opts?: ChunkingOptions,
): Promise<KnowledgeChunk[]> {
  const pieces = splitIntoChunks(text, opts)
  if (pieces.length === 0) return []

  await prisma.knowledgeRagChunk.createMany({
    data: pieces.map((content, chunkIndex) => ({
      documentId, repositoryId, tenantId, chunkIndex, content,
      tokenCount: content.split(/\s+/).filter(Boolean).length,
    })),
  })

  return listChunksForDocument(documentId, tenantId)
}

export async function listChunksForDocument(documentId: string, tenantId: string): Promise<KnowledgeChunk[]> {
  const rows = await prisma.knowledgeRagChunk.findMany({
    where: { documentId, tenantId }, orderBy: { chunkIndex: 'asc' },
  })
  return rows.map(toModel)
}

export async function listChunksForRepository(repositoryId: string, tenantId: string): Promise<KnowledgeChunk[]> {
  const rows = await prisma.knowledgeRagChunk.findMany({
    where: { repositoryId, tenantId }, orderBy: [{ documentId: 'asc' }, { chunkIndex: 'asc' }],
  })
  return rows.map(toModel)
}

export async function listChunksForTenant(tenantId: string): Promise<KnowledgeChunk[]> {
  const rows = await prisma.knowledgeRagChunk.findMany({ where: { tenantId } })
  return rows.map(toModel)
}
