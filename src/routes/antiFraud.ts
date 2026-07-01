/**
 * Anti-Fraud & Inventory Routes
 *
 * POST /api/v1/integrations/print-spy-receiver   ingest POS Bridge receipt
 * POST /api/v1/integrations/qr-heartbeat         QR menu session ping (tracks activity)
 * GET  /api/v1/analytics/anti-fraud-check        run cross-check + return alerts
 * GET  /api/v1/analytics/fraud-alerts            list fraud alerts for dashboard
 * PATCH /api/v1/analytics/fraud-alerts/:id       update alert status (Reviewed/Dismissed)
 * GET  /api/v1/stock                             list stock items
 * PUT  /api/v1/stock/:id                         update stock item (restock / threshold)
 * POST /api/v1/notifications/daily-fraud-report  build + send WhatsApp EOD report
 */

import express, { Request, Response } from 'express'
import type { Server as SocketIOServer } from 'socket.io'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

// ─── Normalise product name for fuzzy matching ────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s\-_'.]/g, '')
}

// ─── Send Evolution API WhatsApp message ─────────────────────────────────────
// Exported (K23) so FeedbackService can reuse it for multi-channel delivery
// instead of duplicating the Evolution API call. No behavior change.

export async function sendWhatsApp(to: string, message: string): Promise<void> {
  const base     = process.env.EVOLUTION_API_URL
  const instance = process.env.EVOLUTION_INSTANCE
  const apiKey   = process.env.EVOLUTION_API_KEY

  if (!base || !instance || !apiKey) {
    logger.warn({ msg: 'Evolution API not configured — skipping WhatsApp send' })
    return
  }

  const number = to.replace(/\D/g, '')
  await fetch(`${base}/message/sendText/${instance}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body:    JSON.stringify({ number, text: message })
  })
}

// ─── Deduct ingredients from stock ───────────────────────────────────────────

async function deductIngredients(
  cafeId:        string,
  soldItems:     { name: string; qty: number }[],
  lowAlerts:     { ingredientName: string; currentQty: number; minimumThreshold: number }[],
): Promise<void> {
  const recipes = await prisma.recipe.findMany({
    where:  { cafeId, costingMode: 'Smart_Costing' },
    include: { product: { select: { nameEn: true, nameAr: true, nameFr: true } } }
  })

  for (const sold of soldItems) {
    // Fuzzy match sold item name against recipe product names
    const recipe = recipes.find(r =>
      norm(r.product.nameEn) === norm(sold.name) ||
      norm(r.product.nameAr) === norm(sold.name) ||
      norm(r.product.nameFr) === norm(sold.name)
    )
    if (!recipe) continue

    const ingrs = recipe.ingredients as { ingredientName: string; quantityGramsOrMl: number }[]

    for (const ingr of ingrs) {
      const deductQty = ingr.quantityGramsOrMl * sold.qty

      const stock = await prisma.stockItem.findUnique({
        where: { cafeId_ingredientName: { cafeId, ingredientName: ingr.ingredientName } }
      })
      if (!stock) continue

      const newQty = Math.max(0, stock.currentQty - deductQty)
      const isLow  = newQty <= stock.minimumThreshold

      await prisma.stockItem.update({
        where: { id: stock.id },
        data:  { currentQty: newQty, isLow, updatedAt: new Date() }
      })

      if (isLow && !stock.isLow) {
        // Transition to low — record for WhatsApp alert
        lowAlerts.push({
          ingredientName:    ingr.ingredientName,
          currentQty:        newQty,
          minimumThreshold:  stock.minimumThreshold,
        })
        logger.warn({ msg: 'Stock low', cafeId, ingredientName: ingr.ingredientName, newQty })
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/integrations/print-spy-receiver
//  Called by pos-bridge.js whenever a receipt is intercepted.
//  Body: { cafeId, tableNumber?, items: [{name, price, qty}], totalPrice }
//  Auth: pos-bridge sends x-pos-token (matches POSBRIDGE_SECRET env var)
// ════════════════════════════════════════════════════════════════════════════

router.post('/api/v1/integrations/print-spy-receiver', async (req: Request, res: Response) => {
  try {
    const token  = req.headers['x-pos-token'] as string | undefined
    const secret = process.env.POSBRIDGE_SECRET
    if (secret && token !== secret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { cafeId, tableNumber, items, totalPrice } = req.body as {
      cafeId:       string
      tableNumber?: number
      items:        { name: string; price: number; qty: number }[]
      totalPrice:   number
    }

    if (!cafeId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'cafeId and items[] required' })
    }

    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { isActive: true, paymentConfig: true, businessName: true }
    })
    if (!cafe?.isActive) return res.status(404).json({ error: 'Cafe not found' })

    // 1. Persist printer log
    await prisma.printerLog.create({
      data: { cafeId, tableNumber: tableNumber ?? null, items, totalPrice }
    })

    // 2. Smart Costing — deduct stock
    const lowAlerts: { ingredientName: string; currentQty: number; minimumThreshold: number }[] = []
    await deductIngredients(cafeId, items.map(i => ({ name: i.name, qty: i.qty })), lowAlerts)

    // 3. Low-stock WhatsApp alert
    if (lowAlerts.length > 0) {
      const pc     = cafe.paymentConfig as { whatsappNumber?: string } | null
      const phone  = pc?.whatsappNumber
      if (phone) {
        const lines = lowAlerts
          .map(a => `  • ${a.ingredientName}: ${a.currentQty.toFixed(0)} units remaining (min: ${a.minimumThreshold})`)
          .join('\n')
        const msg = `⚠️ Smart Resto — Restock Alert\n*${cafe.businessName}*\n\nLow stock detected:\n${lines}\n\nPlease restock immediately.`
        await sendWhatsApp(phone, msg).catch(err =>
          logger.warn({ msg: 'Low-stock WhatsApp failed', err })
        )
      }
    }

    return res.json({ ok: true, lowAlerts: lowAlerts.map(a => a.ingredientName) })

  } catch (err) {
    logger.error({ msg: 'print-spy-receiver error', err })
    return res.status(500).json({ error: 'Failed to process print log' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/integrations/qr-heartbeat
//  Called by the QR menu every 2 min to update session duration.
//  Public (authenticated by tableToken only).
//  Body: { tableToken, hasOrder? }
// ════════════════════════════════════════════════════════════════════════════

router.post('/api/v1/integrations/qr-heartbeat', async (req: Request, res: Response) => {
  try {
    const { tableToken, hasOrder = false } = req.body as {
      tableToken?: string
      hasOrder?:   boolean
    }
    if (!tableToken) return res.status(400).json({ error: 'tableToken required' })

    const table = await prisma.table.findUnique({
      where:  { qrToken: tableToken },
      select: { id: true, cafeId: true, tableNumber: true, isActive: true }
    })
    if (!table || !table.isActive) return res.status(404).json({ error: 'Invalid token' })

    const now          = new Date()
    const windowStart  = new Date(now.getTime() - 2 * 60 * 60 * 1000)  // 2h window

    // Find or create scan record for this table in this session
    const existing = await prisma.qrScan.findFirst({
      where: {
        cafeId:      table.cafeId,
        tableNumber: table.tableNumber,
        scanTime:    { gte: windowStart },
      }
    })

    if (existing) {
      const diffMin = Math.round((now.getTime() - existing.scanTime.getTime()) / 60_000)
      await prisma.qrScan.update({
        where: { id: existing.id },
        data: {
          lastActiveAt:     now,
          activeDurationMin: diffMin,
          hasOrder:          existing.hasOrder || hasOrder,
        }
      })
    } else {
      await prisma.qrScan.create({
        data: {
          cafeId:      table.cafeId,
          tableNumber: table.tableNumber,
          tableToken,
          hasOrder,
        }
      })
    }

    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'qr-heartbeat error', err })
    return res.status(500).json({ error: 'Heartbeat failed' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/analytics/anti-fraud-check
//  Compares QR scan sessions against printer logs.
//  Creates FraudAlert records for suspicious tables.
//  Admin auth required. Returns new + existing alerts.
// ════════════════════════════════════════════════════════════════════════════

router.get('/api/v1/analytics/anti-fraud-check', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId   = req.admin!.cafeId
    const now      = new Date()
    // Analysis window: last 2 hours
    const windowMs = 2 * 60 * 60 * 1000
    const since    = new Date(now.getTime() - windowMs)

    // All QR sessions in the window that were active ≥ 30 min
    const activeSessions = await prisma.qrScan.findMany({
      where: {
        cafeId,
        scanTime:          { gte: since },
        activeDurationMin: { gte: 30 },
      }
    })

    // All printer logs in the window grouped by tableNumber
    const logs = await prisma.printerLog.findMany({
      where: { cafeId, receivedAt: { gte: since } },
      select: { tableNumber: true, receivedAt: true }
    })
    const loggedTables = new Set(logs.map(l => l.tableNumber).filter(Boolean))

    const newAlerts: typeof activeSessions = []

    for (const session of activeSessions) {
      // Table was browsing ≥ 30 min but no receipt printed for that table
      if (!loggedTables.has(session.tableNumber)) {
        // Check we haven't already raised this alert recently
        const alreadyFlagged = await prisma.fraudAlert.findFirst({
          where: {
            cafeId,
            tableNumber: session.tableNumber,
            detectedAt:  { gte: since },
            status:      'Pending',
          }
        })
        if (!alreadyFlagged) {
          const details =
            `Table ${session.tableNumber} was active on the QR menu for ` +
            `${session.activeDurationMin} min (since ${session.scanTime.toISOString()}) ` +
            `but no receipt was printed by the POS within the last 2 hours. ` +
            `${session.hasOrder ? 'An order was placed via QR — no POS confirmation received.' : 'No order was placed either (possible silent discard).'}`

          await prisma.fraudAlert.create({
            data: { cafeId, tableNumber: session.tableNumber, details }
          })
          newAlerts.push(session)
          logger.warn({ msg: 'FraudAlert created', cafeId, tableNumber: session.tableNumber })
        }
      }
    }

    const allAlerts = await prisma.fraudAlert.findMany({
      where:   { cafeId, status: 'Pending' },
      orderBy: { detectedAt: 'desc' },
    })

    return res.json({
      newAlertsCount: newAlerts.length,
      pendingAlerts:  allAlerts,
    })

  } catch (err) {
    logger.error({ msg: 'anti-fraud-check error', err })
    return res.status(500).json({ error: 'Anti-fraud check failed' })
  }
})

// ─── GET /api/v1/analytics/fraud-alerts ──────────────────────────────────────

router.get('/api/v1/analytics/fraud-alerts', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const status = req.query.status as string | undefined

    const alerts = await prisma.fraudAlert.findMany({
      where:   { cafeId, ...(status ? { status } : {}) },
      orderBy: { detectedAt: 'desc' },
      take:    100,
    })
    return res.json(alerts)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch alerts' })
  }
})

// ─── PATCH /api/v1/analytics/fraud-alerts/:id ────────────────────────────────

router.patch('/api/v1/analytics/fraud-alerts/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id     = req.params.id as string
    const { status } = req.body as { status?: string }

    if (!['Reviewed', 'Dismissed', 'Pending'].includes(status ?? '')) {
      return res.status(400).json({ error: 'status must be Reviewed | Dismissed | Pending' })
    }

    const alert = await prisma.fraudAlert.findFirst({ where: { id, cafeId } })
    if (!alert) return res.status(404).json({ error: 'Alert not found' })

    const updated = await prisma.fraudAlert.update({
      where: { id },
      data:  { status: status!, resolvedAt: status !== 'Pending' ? new Date() : null }
    })
    return res.json(updated)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update alert' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/stock
// ════════════════════════════════════════════════════════════════════════════

router.get('/api/v1/stock', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const items  = await prisma.stockItem.findMany({
      where:   { cafeId },
      orderBy: [{ isLow: 'desc' }, { ingredientName: 'asc' }]
    })
    return res.json(items)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch stock' })
  }
})

// ─── PUT /api/v1/stock/:id ────────────────────────────────────────────────────

router.put('/api/v1/stock/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const id     = req.params.id as string
    const { currentQty, minimumThreshold, costPerUnit, unit } = req.body as {
      currentQty?:       number
      minimumThreshold?: number
      costPerUnit?:      number
      unit?:             string
    }

    const item = await prisma.stockItem.findFirst({ where: { id, cafeId } })
    if (!item) return res.status(404).json({ error: 'Stock item not found' })

    const newQty  = currentQty       ?? item.currentQty
    const minThr  = minimumThreshold ?? item.minimumThreshold
    const isLow   = newQty <= minThr

    const updated = await prisma.stockItem.update({
      where: { id },
      data: {
        currentQty:       newQty,
        minimumThreshold: minThr,
        costPerUnit:      costPerUnit ?? item.costPerUnit,
        unit:             unit        ?? item.unit,
        isLow,
        lastRestockedAt:  currentQty !== undefined && currentQty > item.currentQty ? new Date() : item.lastRestockedAt,
      }
    })
    return res.json(updated)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update stock item' })
  }
})

// ─── POST /api/v1/stock — create a new stock item ────────────────────────────

router.post('/api/v1/stock', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { ingredientName, unit = 'g', currentQty = 0, minimumThreshold = 0, costPerUnit = 0 } = req.body as {
      ingredientName?:   string
      unit?:             string
      currentQty?:       number
      minimumThreshold?: number
      costPerUnit?:      number
    }
    if (!ingredientName?.trim()) return res.status(400).json({ error: 'ingredientName required' })

    const item = await prisma.stockItem.create({
      data: { cafeId, ingredientName: ingredientName.trim(), unit, currentQty, minimumThreshold, costPerUnit, isLow: currentQty <= minimumThreshold }
    })
    return res.status(201).json(item)
  } catch (err) {
    logger.error({ msg: 'POST /api/v1/stock error', err })
    return res.status(500).json({ error: 'Failed to create stock item' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/notifications/daily-fraud-report
//  Builds a human-readable EOD summary and sends it via Evolution API.
//  Called by the nightly cron OR triggered manually by admin.
// ════════════════════════════════════════════════════════════════════════════

export async function sendDailyFraudReport(cafeId: string): Promise<string> {
  const cafe = await prisma.cafe.findUnique({
    where:  { id: cafeId },
    select: { businessName: true, paymentConfig: true, isActive: true }
  })
  if (!cafe) throw new Error('Cafe not found')

  const pc    = cafe.paymentConfig as { whatsappNumber?: string } | null
  const phone = pc?.whatsappNumber
  if (!phone) throw new Error('WhatsApp number not configured in Settings → Payments')

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Fraud alerts created today
  const fraudAlerts = await prisma.fraudAlert.findMany({
    where:   { cafeId, detectedAt: { gte: todayStart } },
    orderBy: { detectedAt: 'asc' }
  })

  // Low-stock items
  const lowStock = await prisma.stockItem.findMany({
    where:   { cafeId, isLow: true },
    orderBy: { currentQty: 'asc' }
  })

  // Build message
  const date    = todayStart.toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })
  const lines: string[] = []

  lines.push(`🛡️ *Smart Resto — Rapport de sécurité*`)
  lines.push(`*${cafe.businessName}* — ${date}`)
  lines.push('')

  if (fraudAlerts.length === 0 && lowStock.length === 0) {
    lines.push('✅ Aucune anomalie détectée aujourd\'hui. Bonne journée !')
  } else {
    if (fraudAlerts.length > 0) {
      lines.push(`⚠️ *${fraudAlerts.length} activité(s) suspecte(s) détectée(s):*`)
      for (const alert of fraudAlerts) {
        const time = alert.detectedAt.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })
        lines.push(`  • Table ${alert.tableNumber} — ${time}`)
        lines.push(`    _${alert.details.slice(0, 120)}..._`)
      }
      lines.push('')
    }

    if (lowStock.length > 0) {
      lines.push(`📦 *${lowStock.length} ingrédient(s) en stock bas:*`)
      for (const item of lowStock) {
        lines.push(`  • ${item.ingredientName}: ${item.currentQty.toFixed(0)} ${item.unit} restants`)
      }
      lines.push('')
    }

    lines.push('⚡ Connectez-vous au tableau de bord pour plus de détails.')
  }

  const message = lines.join('\n')
  await sendWhatsApp(phone, message)
  logger.info({ msg: 'Daily fraud report sent', cafeId, fraudCount: fraudAlerts.length, lowStockCount: lowStock.length })
  return message
}

// HTTP endpoint — admin-triggered or called from n8n
router.post('/api/v1/notifications/daily-fraud-report', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const message = await sendDailyFraudReport(req.admin!.cafeId)
    return res.json({ ok: true, message })
  } catch (err) {
    logger.error({ msg: 'daily-fraud-report error', err })
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Report failed' })
  }
})

// ─── GET /api/v1/analytics/printer-logs ──────────────────────────────────────

router.get('/api/v1/analytics/printer-logs', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const limit  = Math.min(Number(req.query.limit ?? 50), 200)
    const since  = req.query.since ? new Date(req.query.since as string) : new Date(Date.now() - 24 * 3600_000)

    const logs = await prisma.printerLog.findMany({
      where:   { cafeId, receivedAt: { gte: since } },
      orderBy: { receivedAt: 'desc' },
      take:    limit,
    })
    return res.json(logs)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch logs' })
  }
})

export default router
