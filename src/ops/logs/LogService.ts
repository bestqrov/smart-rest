import type { PlatformLogEntry, LogFilter, LogPage, LogSeverity, LogSource } from '../types'

// ─── Map AuditEntry → PlatformLogEntry ───────────────────────────────────────

function auditToLog(row: any): PlatformLogEntry {
  const isError = (row.action as string).includes('FAIL') || (row.action as string).includes('ERROR')
  const isWarn  = (row.action as string).includes('SUSPEND') || (row.action as string).includes('OVERDUE')

  const severity: LogSeverity = isError ? 'error' : isWarn ? 'warn' : 'info'

  // Infer source from module
  const sourceMap: Record<string, LogSource> = {
    ai:            'ai',
    billing:       'billing',
    certification: 'certification',
    analytics:     'analytics',
  }
  const source: LogSource = sourceMap[row.module] ?? 'audit'

  let metadata: Record<string, unknown> | undefined
  if (row.metadata) {
    try { metadata = JSON.parse(row.metadata) } catch { /* skip */ }
  }

  return {
    id:           row.id,
    module:       row.module,
    severity,
    message:      `[${row.action}] ${row.entity} ${row.entityId}`,
    entity:       row.entity,
    entityId:     row.entityId,
    performedBy:  row.performedBy,
    timestamp:    row.timestamp,
    metadata,
    source,
  }
}

// ─── Public: query platform logs (via AuditEntry) ─────────────────────────────

export async function getLogs(filter: LogFilter = {}): Promise<LogPage> {
  const { default: prisma } = await import('../../prisma')

  const page  = Math.max(1, filter.page  ?? 1)
  const limit = Math.min(200, filter.limit ?? 50)
  const skip  = (page - 1) * limit

  // Build Prisma where clause
  const where: Record<string, unknown> = {}

  if (filter.module)   where['module'] = filter.module
  if (filter.from || filter.to) {
    where['timestamp'] = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to   ? { lte: filter.to }   : {}),
    }
  }

  if (filter.search) {
    where['OR'] = [
      { action:      { contains: filter.search, mode: 'insensitive' } },
      { entity:      { contains: filter.search, mode: 'insensitive' } },
      { entityId:    { contains: filter.search, mode: 'insensitive' } },
      { performedBy: { contains: filter.search, mode: 'insensitive' } },
    ]
  }

  // Severity maps to action pattern
  if (filter.severity === 'error') {
    where['OR'] = [
      { action: { contains: 'FAIL' } },
      { action: { contains: 'ERROR' } },
    ]
  } else if (filter.severity === 'warn') {
    where['OR'] = [
      { action: { contains: 'SUSPEND' } },
      { action: { contains: 'OVERDUE' } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.auditEntry.findMany({
      where:   where as any,
      orderBy: { timestamp: 'desc' },
      skip,
      take:    limit,
    }),
    prisma.auditEntry.count({ where: where as any }),
  ])

  return {
    entries: rows.map(auditToLog),
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function getLogModules(): Promise<string[]> {
  const { default: prisma } = await import('../../prisma')
  const rows = await prisma.auditEntry.groupBy({
    by: ['module'],
    orderBy: { _count: { module: 'desc' } },
  })
  return rows.map((r: any) => r.module)
}
