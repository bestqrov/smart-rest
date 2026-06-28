import type { SecurityOverview } from '../types'

// ─── Security score calculation ───────────────────────────────────────────────

function calculateScore(params: {
  pendingFraud:  number
  recentAlerts:  number
  activeModules: number  // how many core modules are up
}): number {
  let score = 100

  // Deduct for unreviewed fraud alerts
  if (params.pendingFraud > 0)  score -= Math.min(20, params.pendingFraud * 2)
  // Deduct for high recent alert volume
  if (params.recentAlerts > 10) score -= Math.min(15, params.recentAlerts - 10)

  return Math.max(0, score)
}

// ─── Public: security overview ────────────────────────────────────────────────

export async function getSecurityOverview(): Promise<SecurityOverview> {
  const { default: prisma } = await import('../../prisma')

  const now      = new Date()
  const last24h  = new Date(now.getTime() - 86_400_000)
  const last7d   = new Date(now.getTime() - 7 * 86_400_000)
  const lastHour = new Date(now.getTime() - 3_600_000)

  const [
    activeSessions,
    fraudTotal,
    fraudPending,
    fraudRecent,
    auditLast24h,
    auditLast7d,
    auditByModule,
  ] = await Promise.all([
    (prisma as any).activeSession?.count?.() ?? Promise.resolve(0),
    prisma.fraudAlert.count(),
    prisma.fraudAlert.count({ where: { status: 'Pending' } }),
    prisma.fraudAlert.count({ where: { detectedAt: { gte: lastHour } } }),
    prisma.auditEntry.count({ where: { timestamp: { gte: last24h } } }),
    prisma.auditEntry.count({ where: { timestamp: { gte: last7d } } }),
    prisma.auditEntry.groupBy({
      by: ['module'],
      _count: { module: true },
      where: { timestamp: { gte: last7d } },
      orderBy: { _count: { module: 'desc' } },
      take: 5,
    }),
  ])

  const topModules = (auditByModule as any[]).map(r => ({
    module: r.module,
    count:  r._count.module,
  }))

  const suspiciousPatterns: string[] = []
  if (fraudPending > 5)  suspiciousPatterns.push(`${fraudPending} unreviewed fraud alerts`)
  if (fraudRecent  > 0)  suspiciousPatterns.push(`${fraudRecent} fraud alert(s) in the last hour`)
  if (auditLast24h > 500) suspiciousPatterns.push(`High audit volume: ${auditLast24h} actions in 24h`)

  const securityScore = calculateScore({
    pendingFraud:  fraudPending,
    recentAlerts:  fraudRecent,
    activeModules: 7,
  })

  return {
    activeSessions,
    fraudAlerts: {
      pending: fraudPending,
      total:   fraudTotal,
      recent:  fraudRecent,
    },
    auditActivity: {
      last24h:    auditLast24h,
      last7d:     auditLast7d,
      topModules,
    },
    suspiciousPatterns,
    securityScore,
    generatedAt: now,
  }
}
