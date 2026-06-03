/**
 * Nightly Cron Jobs — runs every day at 23:00
 *
 * 1. Anti-fraud cross-check: compare QR sessions vs printer logs, create FraudAlerts
 * 2. EOD WhatsApp report: send fraud + low-stock summary to each cafe owner
 * 3. Cleanup: expire QrScan records older than 24h
 */

import cron from 'node-cron'
import prisma from '../prisma'
import logger from '../logger'
import { sendDailyFraudReport } from '../routes/antiFraud'

// ─── Anti-fraud cross-check (also available on-demand via HTTP) ───────────────

export async function runAntiFraudCheck(cafeId: string): Promise<number> {
  const now     = new Date()
  const since   = new Date(now.getTime() - 2 * 60 * 60 * 1000)  // 2h window
  let   created = 0

  const activeSessions = await prisma.qrScan.findMany({
    where: { cafeId, scanTime: { gte: since }, activeDurationMin: { gte: 30 } }
  })

  const logs = await prisma.printerLog.findMany({
    where:  { cafeId, receivedAt: { gte: since } },
    select: { tableNumber: true }
  })
  const loggedTables = new Set(logs.map(l => l.tableNumber).filter(Boolean))

  for (const session of activeSessions) {
    if (!loggedTables.has(session.tableNumber)) {
      const alreadyFlagged = await prisma.fraudAlert.findFirst({
        where: { cafeId, tableNumber: session.tableNumber, detectedAt: { gte: since }, status: 'Pending' }
      })
      if (!alreadyFlagged) {
        const details =
          `Table ${session.tableNumber} was active on the QR menu for ` +
          `${session.activeDurationMin} min but no receipt was printed within 2 hours. ` +
          (session.hasOrder
            ? 'An order was placed via QR — no POS confirmation received.'
            : 'No QR order placed either (possible silent discard or off-system sale).')

        await prisma.fraudAlert.create({ data: { cafeId, tableNumber: session.tableNumber, details } })
        created++
        logger.warn({ msg: '[CRON] FraudAlert created', cafeId, tableNumber: session.tableNumber })
      }
    }
  }
  return created
}

// ─── Full nightly sweep ───────────────────────────────────────────────────────

async function runNightlyJobs(): Promise<void> {
  logger.info({ msg: '[CRON] Nightly jobs started' })

  // Fetch all active cafes
  const cafes = await prisma.cafe.findMany({
    where:  { isActive: true },
    select: { id: true, businessName: true, paymentConfig: true }
  })

  let totalAlerts = 0
  let reportsSent = 0

  for (const cafe of cafes) {
    try {
      // 1. Run anti-fraud check
      const alertCount = await runAntiFraudCheck(cafe.id)
      totalAlerts += alertCount

      // 2. Send EOD WhatsApp report if phone configured
      const pc    = cafe.paymentConfig as { whatsappNumber?: string } | null
      const phone = pc?.whatsappNumber
      if (phone) {
        await sendDailyFraudReport(cafe.id)
        reportsSent++
      }
    } catch (err) {
      logger.error({ msg: '[CRON] Nightly job failed for cafe', cafeId: cafe.id, err })
    }
  }

  // 3. Cleanup: remove QrScan records older than 24h
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const { count: qrScansCleared } = await prisma.qrScan.deleteMany({
    where: { scanTime: { lt: yesterday } }
  })

  // 4. Expire stale ClientSessions (dynamic QR — seats freed for next guests)
  const { count: sessionsExpired } = await prisma.clientSession.updateMany({
    where: { status: 'active', expiresAt: { lt: new Date() } },
    data:  { status: 'expired' }
  })

  logger.info({
    msg:             '[CRON] Nightly jobs completed',
    cafes:           cafes.length,
    totalAlerts,
    reportsSent,
    qrScansCleared,
    sessionsExpired,
  })
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export function startNightlyCron(): void {
  // Every day at 23:00 (server local time)
  cron.schedule('0 23 * * *', async () => {
    try {
      await runNightlyJobs()
    } catch (err) {
      logger.error({ msg: '[CRON] Nightly cron top-level failure', err })
    }
  })
  logger.info({ msg: '[CRON] Nightly cron registered (daily 23:00)' })
}
