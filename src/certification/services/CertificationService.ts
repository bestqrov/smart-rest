import prisma from '../../prisma'
import type { CertificationResult, CertificationStatus } from '../types'

// ─── Result serialization ─────────────────────────────────────────────────────

function toResult(row: any): CertificationResult {
  return {
    id:              row.id,
    tenantId:        row.tenantId,
    profile:         row.profile,
    version:         row.version,
    score:           row.score,
    maxScore:        row.maxScore,
    percentage:      row.percentage,
    level:           row.level,
    status:          row.status,
    evaluatedAt:     row.evaluatedAt,
    expiresAt:       row.expiresAt,
    ruleResults:     JSON.parse(row.ruleResults),
    evidenceIds:     row.evidenceIds ?? [],
    summary:         row.summary,
    recommendations: JSON.parse(row.recommendations),
    metadata:        row.metadata ? JSON.parse(row.metadata) : undefined,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getLatestResult(
  tenantId:  string,
  profileId: string,
): Promise<CertificationResult | null> {
  const row = await prisma.certificationResult.findFirst({
    where:   { tenantId, profile: profileId, status: { in: ['COMPLETED', 'EXPIRED'] } },
    orderBy: { evaluatedAt: 'desc' },
  })
  return row ? toResult(row) : null
}

export async function getResultById(id: string): Promise<CertificationResult | null> {
  const row = await prisma.certificationResult.findUnique({ where: { id } })
  return row ? toResult(row) : null
}

export async function getResultsForTenant(
  tenantId: string,
  limit = 10,
): Promise<CertificationResult[]> {
  const rows = await prisma.certificationResult.findMany({
    where:   { tenantId },
    orderBy: { evaluatedAt: 'desc' },
    take:    limit,
  })
  return rows.map(toResult)
}

export async function expireOldResults(profileId: string): Promise<number> {
  const now = new Date()
  const { count } = await prisma.certificationResult.updateMany({
    where: { profile: profileId, status: 'COMPLETED', expiresAt: { lt: now } },
    data:  { status: 'EXPIRED' },
  })
  return count
}

export async function markExpired(id: string): Promise<void> {
  await prisma.certificationResult.update({
    where: { id },
    data:  { status: 'EXPIRED' },
  })
}

export async function getStats(profileId?: string): Promise<{
  total:     number
  completed: number
  expired:   number
  byLevel:   Record<string, number>
}> {
  const where: any = {}
  if (profileId) where.profile = profileId

  const [total, byStatus, byLevel] = await Promise.all([
    prisma.certificationResult.count({ where }),
    prisma.certificationResult.groupBy({
      by:    ['status'],
      where,
      _count: { status: true },
    }),
    prisma.certificationResult.groupBy({
      by:    ['level'],
      where: { ...where, status: 'COMPLETED' },
      _count: { level: true },
    }),
  ])

  const statusMap = Object.fromEntries(byStatus.map(r => [r.status, r._count.status]))
  const levelMap  = Object.fromEntries(byLevel.map(r => [r.level, r._count.level]))

  return {
    total,
    completed: statusMap.COMPLETED ?? 0,
    expired:   statusMap.EXPIRED   ?? 0,
    byLevel:   levelMap,
  }
}
