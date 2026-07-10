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

  // 5. Purge expired refresh tokens
  const { count: refreshTokensPurged } = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  })

  // 6. Reset demo cafe staff — public demo accounts (e.g. "plage" used from
  // smartrestau.com/login) accumulate ad-hoc Staff rows as visitors try the
  // admin Staff page. Keep only the 3 fixed demo staff and clear their shift.
  const demoStaffReset = await resetDemoCafeStaff()

  // ─── Tenant Lifecycle maintenance ─────────────────────────────────────────
  try {
    const {
      notifyExpiringTrials,
      expireTrials,
      expireGracePeriods,
      cleanupExpiredPromotions,
    } = await import('../tenant')
    const [warned, expired, graceExpired, promosCleaned] = await Promise.all([
      notifyExpiringTrials(3),
      expireTrials(7),
      expireGracePeriods(),
      cleanupExpiredPromotions(),
    ])
    logger.info({ msg: '[CRON] Tenant lifecycle sweep', warned, expired: expired.length, graceExpired: graceExpired.length, promosCleaned })
  } catch (err) {
    logger.error({ msg: '[CRON] Tenant lifecycle sweep failed', err })
  }

  logger.info({
    msg:                 '[CRON] Nightly jobs completed',
    cafes:               cafes.length,
    totalAlerts,
    reportsSent,
    qrScansCleared,
    sessionsExpired,
    refreshTokensPurged,
    demoStaffReset,
  })
}

// ─── Demo cafe staff reset ─────────────────────────────────────────────────

const DEMO_STAFF_NAMES = ['Demo Cashier', 'Demo Supervisor', 'Demo Waiter']

export async function resetDemoCafeStaff(): Promise<number> {
  const demoCafes = await prisma.cafe.findMany({ where: { isDemo: true }, select: { id: true } })
  if (demoCafes.length === 0) return 0

  const cafeIds = demoCafes.map(c => c.id)

  const allStaff = await prisma.staff.findMany({
    where:   { cafeId: { in: cafeIds } },
    select:  { id: true, cafeId: true, name: true },
    orderBy: { createdAt: 'asc' },
  })

  // Staff bootstrapping races (concurrent demo logins) can create several
  // rows with the exact same canonical name — keep only the oldest per
  // (cafe, name); anything with a non-canonical name is stale too.
  const seen = new Set<string>()
  const staleIds: string[] = []
  for (const s of allStaff) {
    const key = `${s.cafeId}:${s.name}`
    const isCanonical = DEMO_STAFF_NAMES.includes(s.name)
    if (isCanonical && !seen.has(key)) { seen.add(key); continue }
    staleIds.push(s.id)
  }
  if (staleIds.length === 0) return 0

  // Required relations (CashierShift/WaiterShift) block deletion until cleared.
  // Optional references (Table.assignedWaiter, Order.createdBy/assignedWaiter)
  // are left as-is — fine for demo/history data.
  await prisma.cashierShift.deleteMany({ where: { staffId: { in: staleIds } } })
  await prisma.waiterShift.deleteMany({ where: { staffId: { in: staleIds } } })

  const { count: deleted } = await prisma.staff.deleteMany({
    where: { id: { in: staleIds } },
  })

  await prisma.staff.updateMany({
    where: { cafeId: { in: cafeIds }, name: { in: DEMO_STAFF_NAMES } },
    data:  { shiftStatus: 'OFF_DUTY', clockInTime: null },
  })

  if (deleted > 0) logger.info({ msg: '[CRON] Demo cafe staff reset', deleted, cafes: cafeIds.length })
  return deleted
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export function startNightlyCron(): ReturnType<typeof cron.schedule> {
  const task = cron.schedule('0 23 * * *', async () => {
    try {
      await runNightlyJobs()
    } catch (err) {
      logger.error({ msg: '[CRON] Nightly cron top-level failure', err })
    }
  })
  logger.info({ msg: '[CRON] Nightly cron registered (daily 23:00)' })
  return task
}
