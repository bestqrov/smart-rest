import prisma from '../../prisma'
import type {
  Notification, NotificationLevel,
  CreateNotificationInput, NotificationFilter, PagedResult,
} from '../types'

// ─── Serialization helpers ────────────────────────────────────────────────────

function serialize(m?: Record<string, unknown>): string | undefined {
  return m ? JSON.stringify(m) : undefined
}

function deserialize(raw?: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined
  try { return JSON.parse(raw) } catch { return undefined }
}

function toNotif(row: any): Notification {
  return {
    id:        row.id,
    level:     row.level as NotificationLevel,
    title:     row.title,
    message:   row.message,
    module:    row.module ?? undefined,
    entityId:  row.entityId ?? undefined,
    targetId:  row.targetId ?? undefined,
    read:      row.read,
    metadata:  deserialize(row.metadata),
    createdAt: row.createdAt,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification> {
  const row = await (prisma as any).coreNotification.create({
    data: {
      level:    input.level,
      title:    input.title,
      message:  input.message,
      module:   input.module,
      entityId: input.entityId,
      targetId: input.targetId,
      metadata: serialize(input.metadata),
    },
  })
  return toNotif(row)
}

export async function getNotifications(
  targetId: string,
  filter: NotificationFilter = {},
): Promise<PagedResult<Notification>> {
  const page  = Math.max(1, filter.page  ?? 1)
  const limit = Math.min(200, filter.limit ?? 50)
  const skip  = (page - 1) * limit

  const where: any = { targetId }
  if (filter.level  !== undefined) where.level  = filter.level
  if (filter.module !== undefined) where.module = filter.module
  if (filter.read   !== undefined) where.read   = filter.read
  if (filter.from || filter.to) {
    where.createdAt = {}
    if (filter.from) where.createdAt.gte = filter.from
    if (filter.to)   where.createdAt.lte = filter.to
  }

  const [rows, total] = await Promise.all([
    (prisma as any).coreNotification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    (prisma as any).coreNotification.count({ where }),
  ])

  return { items: rows.map(toNotif), total, page, pages: Math.ceil(total / limit), limit }
}

export async function markRead(id: string): Promise<void> {
  await (prisma as any).coreNotification.update({
    where: { id },
    data:  { read: true },
  })
}

export async function markAllRead(targetId: string): Promise<void> {
  await (prisma as any).coreNotification.updateMany({
    where: { targetId, read: false },
    data:  { read: true },
  })
}

export async function countUnread(targetId: string): Promise<number> {
  return (prisma as any).coreNotification.count({ where: { targetId, read: false } })
}

export async function deleteNotification(id: string): Promise<void> {
  await (prisma as any).coreNotification.delete({ where: { id } })
}
