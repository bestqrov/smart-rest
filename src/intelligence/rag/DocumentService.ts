// ─── RAG Knowledge Layer — Document Service ─────────────────────────────────
// Chunking is synchronous today (no queue/worker) — status is set straight
// to PROCESSED or FAILED in the same request. PENDING exists in the status
// enum for a future async ingestion pipeline (e.g. large file uploads) but
// nothing produces it yet — documented, not silently unreachable.

import prisma from '../../prisma'
import { getRepository } from './RepositoryService'
import { createChunksForDocument, listChunksForDocument } from './ChunkService'
import { recordKnowledgeAudit } from './KnowledgeAuditLog'
import type { KnowledgeDocument, CreateDocumentInput, ChunkingOptions } from './types'

function toModel(row: any): KnowledgeDocument {
  return {
    id: row.id, repositoryId: row.repositoryId, tenantId: row.tenantId,
    title: row.title, sourceType: row.sourceType, sourceRef: row.sourceRef ?? null,
    contentType: row.contentType, status: row.status,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  }
}

export async function createDocument(
  input: CreateDocumentInput, performedBy: string, chunkingOpts?: ChunkingOptions,
): Promise<KnowledgeDocument> {
  const repo = await getRepository(input.repositoryId, input.tenantId)
  if (!repo) throw new Error('Repository not found')

  const row = await prisma.knowledgeRagDocument.create({
    data: {
      repositoryId: input.repositoryId, tenantId: input.tenantId, title: input.title,
      sourceType: input.sourceType ?? 'MANUAL', sourceRef: input.sourceRef,
      contentType: input.contentType ?? 'text/plain',
      status: 'PENDING',
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  })

  try {
    await createChunksForDocument(row.id, input.repositoryId, input.tenantId, input.content, chunkingOpts)
    const processed = await prisma.knowledgeRagDocument.update({ where: { id: row.id }, data: { status: 'PROCESSED' } })
    await recordKnowledgeAudit('CREATE_DOCUMENT', row.id, input.tenantId, performedBy, { title: input.title, repositoryId: input.repositoryId })
    return toModel(processed)
  } catch (err) {
    await prisma.knowledgeRagDocument.update({ where: { id: row.id }, data: { status: 'FAILED' } })
    throw err
  }
}

export async function getDocument(id: string, tenantId: string): Promise<KnowledgeDocument | null> {
  const row = await prisma.knowledgeRagDocument.findFirst({ where: { id, tenantId } })
  return row ? toModel(row) : null
}

export async function getDocumentWithChunks(id: string, tenantId: string) {
  const doc = await getDocument(id, tenantId)
  if (!doc) return null
  const chunks = await listChunksForDocument(id, tenantId)
  return { document: doc, chunks }
}

export async function listDocuments(repositoryId: string, tenantId: string): Promise<KnowledgeDocument[]> {
  const rows = await prisma.knowledgeRagDocument.findMany({
    where: { repositoryId, tenantId }, orderBy: { createdAt: 'desc' },
  })
  return rows.map(toModel)
}

export async function deleteDocument(id: string, tenantId: string, performedBy: string): Promise<void> {
  const doc = await getDocument(id, tenantId)
  if (!doc) throw new Error('Document not found')
  await prisma.$transaction([
    prisma.knowledgeRagChunk.deleteMany({ where: { documentId: id } }),
    prisma.knowledgeRagDocument.delete({ where: { id } }),
  ])
  await recordKnowledgeAudit('DELETE_DOCUMENT', id, tenantId, performedBy, { title: doc.title })
}
