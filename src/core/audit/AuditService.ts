import prisma from '../../prisma'
import type {
  AuditEntry, CreateAuditInput, AuditFilter, PagedResult,
} from '../types'

// ─── Serialization helpers ────────────────────────────────────────────────────

function serialize(metadata?: Record<string, unknown>): string | undefined {
  return metadata ? JSON.stringify(metadata) : undefined
}

function deserialize(raw?: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined
  try { return JSON.parse(raw) } catch { return undefined }
}

function toEntry(row: any): AuditEntry {
  return {
    id:          row.id,
    module:      row.module,
    entity:      row.entity,
    entityId:    row.entityId,
    action:      row.action,
    performedBy: row.performedBy,
    timestamp:   row.timestamp,
    metadata:    deserialize(row.metadata),
    createdAt:   row.timestamp,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createAudit(input: CreateAuditInput): Promise<AuditEntry> {
  const row = await prisma.auditEntry.create({
    data: {
      module:      input.module,
      entity:      input.entity,
      entityId:    input.entityId,
      action:      input.action,
      performedBy: input.performedBy,
      metadata:    serialize(input.metadata),
    },
  })
  return toEntry(row)
}

export async function getAuditHistory(filter: AuditFilter = {}): Promise<PagedResult<AuditEntry>> {
  const page  = Math.max(1, filter.page  ?? 1)
  const limit = Math.min(200, filter.limit ?? 50)
  const skip  = (page - 1) * limit

  const where: any = {}
  if (filter.module)      where.module      = filter.module
  if (filter.entity)      where.entity      = filter.entity
  if (filter.entityId)    where.entityId    = filter.entityId
  if (filter.action)      where.action      = filter.action
  if (filter.performedBy) where.performedBy = filter.performedBy
  if (filter.from || filter.to) {
    where.timestamp = {}
    if (filter.from) where.timestamp.gte = filter.from
    if (filter.to)   where.timestamp.lte = filter.to
  }

  const [rows, total] = await Promise.all([
    prisma.auditEntry.findMany({ where, orderBy: { timestamp: 'desc' }, skip, take: limit }),
    prisma.auditEntry.count({ where }),
  ])

  return { items: rows.map(toEntry), total, page, pages: Math.ceil(total / limit), limit }
}

export async function filterByModule(
  module: string,
  options: Omit<AuditFilter, 'module'> = {},
): Promise<PagedResult<AuditEntry>> {
  return getAuditHistory({ ...options, module })
}

export async function filterByUser(
  performedBy: string,
  options: Omit<AuditFilter, 'performedBy'> = {},
): Promise<PagedResult<AuditEntry>> {
  return getAuditHistory({ ...options, performedBy })
}

export async function filterByEntity(
  entity: string,
  entityId: string,
  options: Omit<AuditFilter, 'entity' | 'entityId'> = {},
): Promise<PagedResult<AuditEntry>> {
  return getAuditHistory({ ...options, entity, entityId })
}
