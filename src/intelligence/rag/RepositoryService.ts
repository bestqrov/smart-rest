// ─── RAG Knowledge Layer — Repository Service ───────────────────────────────

import prisma from '../../prisma'
import type { KnowledgeRepository, CreateRepositoryInput } from './types'

function toModel(row: any): KnowledgeRepository {
  return {
    id: row.id, tenantId: row.tenantId, name: row.name,
    description: row.description ?? null, isActive: row.isActive,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  }
}

export async function createRepository(input: CreateRepositoryInput): Promise<KnowledgeRepository> {
  const row = await prisma.knowledgeRagRepository.create({
    data: { tenantId: input.tenantId, name: input.name, description: input.description },
  })
  return toModel(row)
}

export async function getRepository(id: string, tenantId: string): Promise<KnowledgeRepository | null> {
  const row = await prisma.knowledgeRagRepository.findFirst({ where: { id, tenantId } })
  return row ? toModel(row) : null
}

export async function listRepositories(tenantId: string, opts?: { isActive?: boolean }): Promise<KnowledgeRepository[]> {
  const where: any = { tenantId }
  if (opts?.isActive !== undefined) where.isActive = opts.isActive
  const rows = await prisma.knowledgeRagRepository.findMany({ where, orderBy: { createdAt: 'desc' } })
  return rows.map(toModel)
}

export async function updateRepository(
  id: string, tenantId: string, input: Partial<{ name: string; description: string | null; isActive: boolean }>,
): Promise<KnowledgeRepository> {
  const existing = await getRepository(id, tenantId)
  if (!existing) throw new Error('Repository not found')
  const row = await prisma.knowledgeRagRepository.update({ where: { id }, data: input })
  return toModel(row)
}

// Deleting a repository cascades to its documents and chunks — Mongo has no
// FK cascade, so this is done explicitly and atomically via $transaction.
export async function deleteRepository(id: string, tenantId: string): Promise<void> {
  const existing = await getRepository(id, tenantId)
  if (!existing) throw new Error('Repository not found')
  await prisma.$transaction([
    prisma.knowledgeRagChunk.deleteMany({ where: { repositoryId: id } }),
    prisma.knowledgeRagDocument.deleteMany({ where: { repositoryId: id } }),
    prisma.knowledgeRagRepository.delete({ where: { id } }),
  ])
}
