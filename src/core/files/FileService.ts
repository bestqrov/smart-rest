import crypto from 'crypto'
import prisma from '../../prisma'
import { getProvider } from './providers/LocalProvider'
import type { StoredFile, StoreFileInput, FileProviderType } from '../types'

const DEFAULT_PROVIDER: FileProviderType = (process.env.FILE_PROVIDER as FileProviderType) ?? 'local'

// ─── Serialization ────────────────────────────────────────────────────────────

function serialize(m?: Record<string, unknown>): string | undefined {
  return m ? JSON.stringify(m) : undefined
}

function deserialize(raw?: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined
  try { return JSON.parse(raw) } catch { return undefined }
}

function toFile(row: any): StoredFile {
  return {
    id:           row.id,
    key:          row.key,
    originalName: row.originalName,
    mimeType:     row.mimeType,
    sizeBytes:    row.sizeBytes,
    provider:     row.provider as FileProviderType,
    bucket:       row.bucket ?? undefined,
    path:         row.path,
    url:          row.url ?? undefined,
    module:       row.module ?? undefined,
    entityId:     row.entityId ?? undefined,
    uploadedBy:   row.uploadedBy ?? undefined,
    metadata:     deserialize(row.metadata),
    createdAt:    row.createdAt,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function store(input: StoreFileInput): Promise<StoredFile> {
  const providerName = DEFAULT_PROVIDER
  const provider     = getProvider(providerName)

  const key  = input.key ?? `${Date.now()}-${crypto.randomUUID()}`
  const dest = await provider.store(key, input.buffer, input.mimeType)
  const url  = await provider.generatePublicUrl(key)

  const row = await (prisma as any).storedFile.create({
    data: {
      key:          key,
      originalName: input.originalName,
      mimeType:     input.mimeType,
      sizeBytes:    input.sizeBytes,
      provider:     providerName,
      path:         dest,
      url,
      module:       input.module,
      entityId:     input.entityId,
      uploadedBy:   input.uploadedBy,
      metadata:     serialize(input.metadata),
    },
  })
  return toFile(row)
}

export async function deleteFile(id: string): Promise<void> {
  const row = await (prisma as any).storedFile.findUnique({ where: { id } })
  if (!row) return
  await getProvider(row.provider).delete(row.key)
  await (prisma as any).storedFile.delete({ where: { id } })
}

export async function move(id: string, toKey: string): Promise<StoredFile> {
  const row = await (prisma as any).storedFile.findUniqueOrThrow({ where: { id } })
  const provider = getProvider(row.provider)
  const newPath  = await provider.move(row.key, toKey)
  const newUrl   = await provider.generatePublicUrl(toKey)

  const updated = await (prisma as any).storedFile.update({
    where: { id },
    data:  { key: toKey, path: newPath, url: newUrl },
  })
  return toFile(updated)
}

export async function getMetadata(id: string): Promise<StoredFile | null> {
  const row = await (prisma as any).storedFile.findUnique({ where: { id } })
  return row ? toFile(row) : null
}

export async function generatePublicUrl(id: string): Promise<string> {
  const row = await (prisma as any).storedFile.findUniqueOrThrow({ where: { id } })
  if (row.url) return row.url
  return getProvider(row.provider).generatePublicUrl(row.key)
}

export async function listByEntity(
  module: string,
  entityId: string,
): Promise<StoredFile[]> {
  const rows = await (prisma as any).storedFile.findMany({
    where: { module, entityId },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(toFile)
}
