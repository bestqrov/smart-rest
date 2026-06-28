import type { BackupRecord, BackupStatus } from '../types'

// ─── Map DB row → BackupRecord ────────────────────────────────────────────────

function toRecord(row: any): BackupRecord {
  return {
    id:           row.id,
    label:        row.label,
    status:       row.status as BackupStatus,
    sizeBytes:    row.sizeBytes ?? undefined,
    entities:     row.entities ? JSON.parse(row.entities) : {},
    triggeredBy:  row.triggeredBy,
    createdAt:    row.createdAt,
    completedAt:  row.completedAt ?? undefined,
    error:        row.error ?? undefined,
    metadata:     row.metadata ? JSON.parse(row.metadata) : undefined,
  }
}

// ─── Collect entity counts for the backup snapshot ───────────────────────────

async function collectEntityCounts(): Promise<Record<string, number>> {
  const { default: prisma } = await import('../../prisma')

  const [cafes, orders, staff, reservations, campaigns, aiJobs, certifications, loyaltyAccounts] =
    await Promise.all([
      prisma.cafe.count(),
      prisma.order.count(),
      prisma.staff.count(),
      prisma.reservation.count(),
      prisma.marketingCampaign.count(),
      prisma.aIJob.count(),
      (prisma as any).certificationResult.count(),
      (prisma as any).loyaltyAccount?.count?.() ?? Promise.resolve(0),
    ])

  return {
    cafes,
    orders,
    staff,
    reservations,
    marketingCampaigns: campaigns,
    aiJobs,
    certifications,
    loyaltyAccounts,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function triggerBackup(label: string, triggeredBy: string): Promise<BackupRecord> {
  const { default: prisma } = await import('../../prisma')

  // Create pending record
  const row = await (prisma as any).platformBackup.create({
    data: {
      label,
      status:      'running',
      triggeredBy,
      entities:    '{}',
    },
  })

  // Collect asynchronously — don't block response
  const id = row.id
  collectEntityCounts()
    .then(async counts => {
      const sizeEstimate = JSON.stringify(counts).length * 100   // rough byte estimate
      await (prisma as any).platformBackup.update({
        where: { id },
        data: {
          status:      'completed',
          entities:    JSON.stringify(counts),
          sizeBytes:   sizeEstimate,
          completedAt: new Date(),
        },
      })
    })
    .catch(async err => {
      await (prisma as any).platformBackup.update({
        where: { id },
        data: { status: 'failed', error: (err as Error).message, completedAt: new Date() },
      })
    })

  return toRecord(row)
}

export async function getBackupHistory(limit = 20): Promise<BackupRecord[]> {
  const { default: prisma } = await import('../../prisma')
  const rows = await (prisma as any).platformBackup.findMany({
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })
  return rows.map(toRecord)
}

export async function getBackup(id: string): Promise<BackupRecord | null> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).platformBackup.findUnique({ where: { id } })
  return row ? toRecord(row) : null
}

export async function deleteBackup(id: string): Promise<void> {
  const { default: prisma } = await import('../../prisma')
  await (prisma as any).platformBackup.delete({ where: { id } })
}
