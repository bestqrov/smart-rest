import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { randomUUID } from 'crypto'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import { validateSeatQR } from '../middleware/validateSeatQR'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveMergeGroup(tableId: string): Promise<string[]> {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: { id: true, mergedIntoTableId: true, mergedTables: { select: { id: true } } }
  })
  if (!table) return [tableId]

  if (table.mergedIntoTableId) {
    return resolveMergeGroup(table.mergedIntoTableId)
  }

  return [table.id, ...table.mergedTables.map((t) => t.id)]
}

// ─── GET /api/tables — list tables with merge status ─────────────────────────

router.get('/api/tables', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId

    const tables = await prisma.table.findMany({
      where: { cafeId },
      orderBy: { tableNumber: 'asc' },
      select: {
        id: true,
        tableNumber: true,
        isActive: true,
        qrToken: true,
        capacity: true,
        displayType: true,
        mergedIntoTableId: true,
        mergedIntoTable: { select: { id: true, tableNumber: true } },
        mergedTables: { select: { id: true, tableNumber: true } },
        seats: {
          orderBy: { seatNumber: 'asc' },
          select: { id: true, seatNumber: true, qrToken: true }
        },
        _count: { select: { orders: { where: { isPaid: false, status: { notIn: ['CANCELLED', 'COMPLETED'] } } } } }
      }
    })

    return res.json(tables)
  } catch (err) {
    logger.error({ msg: 'GET /api/tables error', err })
    return res.status(500).json({ error: 'Failed to fetch tables' })
  }
})

// ─── PATCH /api/admin/tables/:id/activate — manager activates / deactivates ──
//
// Body: { activate: boolean }
// Requires admin token. A table with open orders cannot be deactivated.

router.patch('/api/admin/tables/:id/activate', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId  = req.admin!.cafeId
    const tableId = String(req.params.id)
    const { activate } = req.body as { activate: boolean }

    if (typeof activate !== 'boolean') {
      return res.status(400).json({ error: 'activate (boolean) is required' })
    }

    const table = await prisma.table.findUnique({ where: { id: tableId } })
    if (!table || table.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Table not found' })
    }

    // Prevent deactivating a table that has open orders
    if (!activate) {
      const openOrders = await prisma.order.count({
        where: { tableId, billStatus: { in: ['OPENED', 'BILL_REQUESTED'] } }
      })
      if (openOrders > 0) {
        return res.status(409).json({ error: 'Cannot deactivate a table with open orders' })
      }
    }

    const updated = await prisma.table.update({
      where: { id: tableId },
      data:  { isActive: activate },
      select: { id: true, tableNumber: true, isActive: true }
    })

    logger.info({ msg: activate ? 'table activated' : 'table deactivated', cafeId, tableId })
    return res.json(updated)
  } catch (err) {
    logger.error({ msg: 'PATCH /api/admin/tables/:id/activate error', err })
    return res.status(500).json({ error: 'Failed to update table status' })
  }
})

// ─── POST /api/tables/generate — bulk create tables + seats ──────────────────

router.post('/api/tables/generate', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { tableCount, seatsPerTable } = req.body as { tableCount: number; seatsPerTable: number }

    if (!tableCount || !seatsPerTable || tableCount < 1 || seatsPerTable < 1) {
      return res.status(400).json({ error: 'tableCount and seatsPerTable must be positive integers' })
    }
    if (tableCount > 100 || seatsPerTable > 20) {
      return res.status(400).json({ error: 'Max 100 tables, 20 seats per table' })
    }

    const existing = await prisma.table.findMany({
      where: { cafeId },
      select: { tableNumber: true },
      orderBy: { tableNumber: 'desc' },
      take: 1
    })
    const startFrom = existing.length > 0 ? existing[0].tableNumber + 1 : 1

    const created = await prisma.$transaction(async (tx) => {
      const tables = []
      for (let t = 0; t < tableCount; t++) {
        const tableNumber = startFrom + t
        const table = await tx.table.create({
          data: {
            cafeId,
            tableNumber,
            qrToken: randomUUID(),
            seats: {
              create: Array.from({ length: seatsPerTable }, (_, i) => ({
                seatNumber: i + 1,
                cafeId,
                qrToken: randomUUID()
              }))
            }
          },
          include: { seats: { orderBy: { seatNumber: 'asc' } } }
        })
        tables.push(table)
      }
      return tables
    })

    return res.status(201).json({
      message: `Created ${tableCount} tables with ${seatsPerTable} seats each`,
      tables: created
    })
  } catch (err) {
    logger.error({ msg: 'POST /api/tables/generate error', err })
    return res.status(500).json({ error: 'Failed to generate tables' })
  }
})

// ─── POST /api/tables/merge ───────────────────────────────────────────────────

router.post('/api/tables/merge', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { sourceTableIds, targetTableId } = req.body as {
      sourceTableIds: string[]
      targetTableId: string
    }

    if (!Array.isArray(sourceTableIds) || sourceTableIds.length === 0 || !targetTableId) {
      return res.status(400).json({ error: 'Required: sourceTableIds (array), targetTableId' })
    }
    if (sourceTableIds.includes(targetTableId)) {
      return res.status(400).json({ error: 'targetTableId must not appear in sourceTableIds' })
    }

    const allIds = [...new Set([...sourceTableIds, targetTableId])]
    const tables = await prisma.table.findMany({
      where: { id: { in: allIds }, cafeId },
      select: { id: true, tableNumber: true, mergedIntoTableId: true }
    })

    if (tables.length !== allIds.length) {
      return res.status(404).json({ error: 'One or more tables not found for this cafe' })
    }

    const target = tables.find((t) => t.id === targetTableId)!
    if (target.mergedIntoTableId) {
      return res.status(409).json({ error: 'Target table is itself merged into another table — unmerge first' })
    }

    const alreadyMerged = tables.filter((t) => sourceTableIds.includes(t.id) && t.mergedIntoTableId !== null)
    if (alreadyMerged.length > 0) {
      return res.status(409).json({
        error: `Tables ${alreadyMerged.map((t) => t.tableNumber).join(', ')} are already merged. Unmerge them first.`
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.table.updateMany({
        where: { id: { in: sourceTableIds }, cafeId },
        data: { mergedIntoTableId: targetTableId }
      })

      await tx.order.updateMany({
        where: {
          cafeId,
          tableId: { in: sourceTableIds },
          isPaid: false,
          status: { notIn: ['CANCELLED', 'COMPLETED'] }
        },
        data: { tableId: targetTableId }
      })
    })

    const sourceNumbers = tables
      .filter((t) => sourceTableIds.includes(t.id))
      .map((t) => t.tableNumber)

    const mergeGroupIds = [targetTableId, ...sourceTableIds]

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      const payload = {
        targetTableId,
        targetTableNumber: target.tableNumber,
        sourceTableIds,
        sourceTableNumbers: sourceNumbers,
        mergeGroupIds,
        message: `You are now connected with the group at Table ${target.tableNumber}`
      }

      for (const id of mergeGroupIds) {
        io.to(`table_room_${cafeId}_${id}`).emit('TABLES_MERGED', payload)
      }
      io.to(`room_${cafeId}`).emit('TABLES_MERGED', payload)
      io.to(`kds_room_${cafeId}`).emit('TABLES_MERGED', payload)
    }

    logger.info({ msg: 'Tables merged', cafeId, targetTableId, sourceTableIds })
    return res.json({
      message: `Tables ${sourceNumbers.join(', ')} merged into Table ${target.tableNumber}`,
      targetTableId,
      sourceTableIds
    })
  } catch (err) {
    logger.error({ msg: 'POST /api/tables/merge error', err })
    return res.status(500).json({ error: 'Table merge failed' })
  }
})

// ─── POST /api/tables/unmerge ─────────────────────────────────────────────────

router.post('/api/tables/unmerge', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { targetTableId } = req.body as { targetTableId: string }

    if (!targetTableId) return res.status(400).json({ error: 'targetTableId is required' })

    const target = await prisma.table.findUnique({
      where: { id: targetTableId },
      select: {
        id: true,
        tableNumber: true,
        cafeId: true,
        mergedTables: { select: { id: true, tableNumber: true } }
      }
    })

    if (!target || target.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Target table not found' })
    }
    if (target.mergedTables.length === 0) {
      return res.status(400).json({ error: 'No tables are merged into this table' })
    }

    const sourceIds = target.mergedTables.map((t) => t.id)
    const sourceNumbers = target.mergedTables.map((t) => t.tableNumber)
    const groupIds = [targetTableId, ...sourceIds]

    await prisma.table.updateMany({
      where: { id: { in: sourceIds }, cafeId },
      data: { mergedIntoTableId: null }
    })

    const io = req.app.get('io') as SocketIOServer | undefined
    if (io) {
      const payload = {
        targetTableId,
        targetTableNumber: target.tableNumber,
        sourceTableIds: sourceIds,
        sourceTableNumbers: sourceNumbers,
        message: 'Your table session has been separated. You now have an independent table.'
      }

      for (const id of groupIds) {
        io.to(`table_room_${cafeId}_${id}`).emit('TABLES_UNMERGED', payload)
      }
      io.to(`room_${cafeId}`).emit('TABLES_UNMERGED', payload)
      io.to(`kds_room_${cafeId}`).emit('TABLES_UNMERGED', payload)
    }

    logger.info({ msg: 'Tables unmerged', cafeId, targetTableId, sourceIds })
    return res.json({
      message: `Tables ${sourceNumbers.join(', ')} are now independent from Table ${target.tableNumber}`,
      targetTableId,
      sourceTableIds: sourceIds
    })
  } catch (err) {
    logger.error({ msg: 'POST /api/tables/unmerge error', err })
    return res.status(500).json({ error: 'Unmerge failed' })
  }
})

// ─── GET /api/qr/session — validate seat QR and return session data ──────────
// Called by the customer menu page (Next.js) via fetch on load.

router.get('/api/qr/session', validateSeatQR, (req: Request, res: Response) => {
  const session = req.seatSession!

  return res.json({
    cafeId:      session.cafeId,
    tableId:     session.tableId,
    tableNumber: session.tableNumber,
    seatId:      session.seatId,
    seatNumber:  session.seatNumber,
    billingTableId: session.billingTableId,
    isMerged:    session.isMerged,
    mergedIntoTableNumber: session.mergedIntoTableNumber ?? null
  })
})

// ─── POST /api/tables/sync — idempotent sync: GC excess, upsert missing ──────

router.post('/api/tables/sync', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    // Accept 'capacity' (new) or 'seatsPerTable' (legacy alias) — both set Table.capacity
    const body = req.body as { tableCount: number; capacity?: number; seatsPerTable?: number }
    const { tableCount } = body
    const capacity = body.capacity ?? body.seatsPerTable ?? 4

    if (!tableCount || tableCount < 1 || capacity < 1) {
      return res.status(400).json({ error: 'tableCount and capacity must be positive integers' })
    }
    if (tableCount > 100 || capacity > 20) {
      return res.status(400).json({ error: 'Max 100 tables, 20 seats capacity per table' })
    }

    // ── Pre-flight: identify tables to be removed ──────────────────────────
    const allTables = await prisma.table.findMany({
      where: { cafeId },
      select: { id: true, tableNumber: true }
    })

    const excessTableIds = allTables
      .filter(t => t.tableNumber > tableCount)
      .map(t => t.id)

    // ── Safety check: active unpaid orders on tables to be removed ─────────
    if (excessTableIds.length > 0) {
      const blocked = await prisma.order.findFirst({
        where: {
          cafeId,
          tableId: { in: excessTableIds },
          isPaid: false,
          status: { notIn: ['CANCELLED', 'COMPLETED'] }
        },
        select: { tableId: true }
      })
      if (blocked) {
        const tbl = allTables.find(t => t.id === blocked.tableId)
        return res.status(409).json({
          error: `Cannot reduce tables: Table ${tbl?.tableNumber} has an active unpaid order. Close it first.`
        })
      }
    }

    // ── Transaction: remove excess tables, upsert 1..tableCount ───────────
    const tables = await prisma.$transaction(async (tx) => {
      if (excessTableIds.length > 0) {
        // Expire active sessions on removed tables
        await tx.clientSession.updateMany({
          where: { tableId: { in: excessTableIds }, status: 'active' },
          data:  { status: 'expired' }
        })
        await tx.billRequest.deleteMany({ where: { tableId: { in: excessTableIds } } })
        await tx.waiterCall.deleteMany({ where: { tableId: { in: excessTableIds } } })
        await tx.order.updateMany({
          where: { cafeId, tableId: { in: excessTableIds } },
          data:  { tableId: null }
        })
        await tx.table.deleteMany({ where: { id: { in: excessTableIds }, cafeId } })
      }

      // Upsert tables 1..tableCount — set capacity, never touch Seat rows
      for (let tNum = 1; tNum <= tableCount; tNum++) {
        const existing = await tx.table.findFirst({
          where: { cafeId, tableNumber: tNum },
          select: { id: true }
        })
        if (existing) {
          await tx.table.update({
            where: { id: existing.id },
            data:  { capacity }
          })
        } else {
          await tx.table.create({
            data: { cafeId, tableNumber: tNum, qrToken: randomUUID(), capacity }
          })
        }
      }

      return tx.table.findMany({
        where: { cafeId },
        orderBy: { tableNumber: 'asc' },
        select: {
          id: true, tableNumber: true, isActive: true,
          qrToken: true, capacity: true, displayType: true,
          mergedIntoTableId: true,
          mergedIntoTable: { select: { id: true, tableNumber: true } },
          mergedTables:     { select: { id: true, tableNumber: true } },
          seats: { orderBy: { seatNumber: 'asc' }, select: { id: true, seatNumber: true, qrToken: true } }
        }
      })
    })

    logger.info({ msg: 'Tables synced (dynamic QR)', cafeId, tableCount, capacity })
    return res.json({ message: `Synced to ${tableCount} tables, capacity ${capacity}`, tables })
  } catch (err) {
    logger.error({ msg: 'POST /api/tables/sync error', err })
    return res.status(500).json({ error: 'Table sync failed' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ─── DYNAMIC QR — Single QR per Table, seats assigned at scan time ──────────
// ═══════════════════════════════════════════════════════════════════════════

const SESSION_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

// ─── Core: assign or resume a client session ─────────────────────────────────
// Race-condition safe: wraps in a retry loop with small jitter.
// Probability of two concurrent scans is near-zero in restaurant context,
// but the retry ensures correctness even then.

async function assignOrResumeSession(
  tableId:  string,
  cafeId:   string,
  capacity: number,
  deviceId: string
): Promise<{ session: any; isNew: boolean }> {
  const MAX_RETRIES = 3

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const now       = new Date()
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

      // 1. Check if this device already has an active session on this table
      const existing = await prisma.clientSession.findFirst({
        where: { tableId, deviceId, status: 'active', expiresAt: { gt: now } }
      })

      if (existing) {
        const resumed = await prisma.clientSession.update({
          where: { id: existing.id },
          data:  { lastActiveAt: now, expiresAt }
        })
        return { session: resumed, isNew: false }
      }

      // 2. Get all active seat numbers for this table
      const activeSessions = await prisma.clientSession.findMany({
        where: { tableId, status: 'active', expiresAt: { gt: now } },
        select: { seatNumber: true }
      })
      const occupied = new Set(activeSessions.map(s => s.seatNumber))

      // 3. Find next free seat (sequential 1..capacity)
      let assignedSeat: number | null = null
      for (let i = 1; i <= capacity; i++) {
        if (!occupied.has(i)) { assignedSeat = i; break }
      }

      if (assignedSeat === null) {
        throw Object.assign(new Error('TABLE_FULL'), { code: 'TABLE_FULL' })
      }

      // 4. Create new session
      const created = await prisma.clientSession.create({
        data: { cafeId, tableId, seatNumber: assignedSeat, deviceId, status: 'active', expiresAt, lastActiveAt: now }
      })

      return { session: created, isNew: true }
    } catch (err: any) {
      if (err.code === 'TABLE_FULL') throw err
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 40 + Math.random() * 80))
        continue
      }
      throw err
    }
  }
  throw new Error('SCAN_FAILED_RETRIES_EXHAUSTED')
}

// ─── POST /api/qr/scan ────────────────────────────────────────────────────────
// Called by the new table QR page on every load.
// Body: { tableToken: string, deviceId: string }
// Returns: { sessionId, seatNumber, tableId, tableNumber, cafeId, capacity, occupiedCount, isNew }

router.post('/api/qr/scan', async (req: Request, res: Response) => {
  try {
    const { tableToken, deviceId } = req.body as { tableToken?: string; deviceId?: string }

    if (!tableToken || !deviceId || typeof deviceId !== 'string' || deviceId.length < 8) {
      return res.status(400).json({ error: 'tableToken and deviceId (min 8 chars) are required' })
    }

    // Find table by its single QR token
    const table = await prisma.table.findUnique({
      where: { qrToken: tableToken },
      select: {
        id: true, cafeId: true, tableNumber: true, capacity: true, isActive: true,
        mergedIntoTableId: true,
        mergedIntoTable: { select: { id: true, tableNumber: true } }
      }
    })

    if (!table)           return res.status(404).json({ error: 'QR code not found' })
    if (!table.isActive)  return res.status(403).json({ error: 'This table is currently inactive' })

    // Check cafe is live
    const cafe = await prisma.cafe.findUnique({
      where: { id: table.cafeId },
      select: { isActive: true, subdomain: true }
    })
    if (!cafe?.isActive)  return res.status(403).json({ error: 'Venue is currently unavailable' })

    let result: { session: any; isNew: boolean }
    try {
      result = await assignOrResumeSession(table.id, table.cafeId, table.capacity, deviceId)
    } catch (err: any) {
      if (err.code === 'TABLE_FULL') {
        return res.status(409).json({
          error: 'Table is fully occupied',
          capacity: table.capacity,
          code: 'TABLE_FULL'
        })
      }
      throw err
    }

    // Count active sessions for this table (for UI display)
    const occupiedCount = await prisma.clientSession.count({
      where: { tableId: table.id, status: 'active', expiresAt: { gt: new Date() } }
    })

    const billingTable = table.mergedIntoTable ?? table

    logger.info({
      msg:        result.isNew ? 'seat assigned' : 'session resumed',
      cafeId:     table.cafeId,
      tableId:    table.id,
      tableNumber: table.tableNumber,
      seatNumber: result.session.seatNumber,
      deviceId:   deviceId.slice(0, 8) + '…',
    })

    return res.json({
      sessionId:    result.session.id,
      seatNumber:   result.session.seatNumber,
      tableId:      table.id,
      tableNumber:  table.tableNumber,
      cafeId:       table.cafeId,
      subdomain:    cafe.subdomain,
      capacity:     table.capacity,
      occupiedCount,
      isNew:        result.isNew,
      isMerged:     !!table.mergedIntoTableId,
      billingTableId:      billingTable.id,
      billingTableNumber:  billingTable.tableNumber,
    })
  } catch (err) {
    logger.error({ msg: 'POST /api/qr/scan error', err })
    return res.status(500).json({ error: 'Seat assignment failed' })
  }
})

// ─── GET /api/qr/table-session/:sessionId ────────────────────────────────────
// Validates a stored sessionId on page reload. Returns fresh session data.

router.get('/api/qr/table-session/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const now = new Date()

    // MongoDB Prisma: use separate selects — include does not propagate relation types
    const session = await prisma.clientSession.findUnique({
      where:  { id: sessionId },
      select: { id: true, seatNumber: true, tableId: true, cafeId: true, status: true, expiresAt: true }
    })

    if (!session || session.status !== 'active' || session.expiresAt <= now) {
      return res.status(401).json({ error: 'Session expired or not found', code: 'SESSION_EXPIRED' })
    }

    const [table, cafe] = await Promise.all([
      prisma.table.findUnique({
        where:  { id: session.tableId },
        select: {
          id: true, tableNumber: true, isActive: true, capacity: true,
          mergedIntoTableId: true,
          mergedIntoTable: { select: { id: true, tableNumber: true } }
        }
      }),
      prisma.cafe.findUnique({
        where:  { id: session.cafeId },
        select: { isActive: true, subdomain: true }
      })
    ])

    if (!table?.isActive) return res.status(403).json({ error: 'Table is inactive' })
    if (!cafe?.isActive)  return res.status(403).json({ error: 'Venue is unavailable' })

    // Refresh TTL silently
    await prisma.clientSession.update({
      where: { id: sessionId },
      data:  { lastActiveAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) }
    })

    const billingTable = table.mergedIntoTable ?? table

    return res.json({
      sessionId:          session.id,
      seatNumber:         session.seatNumber,
      tableId:            session.tableId,
      tableNumber:        table.tableNumber,
      cafeId:             session.cafeId,
      subdomain:          cafe.subdomain,
      capacity:           table.capacity,
      isMerged:           !!table.mergedIntoTableId,
      billingTableId:     billingTable.id,
      billingTableNumber: billingTable.tableNumber,
    })
  } catch (err) {
    logger.error({ msg: 'GET /api/qr/table-session error', err })
    return res.status(500).json({ error: 'Session validation failed' })
  }
})

// ─── PATCH /api/qr/session/:sessionId/heartbeat ──────────────────────────────
// Client sends this every 5 min to keep session alive.

router.patch('/api/qr/session/:sessionId/heartbeat', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const now = new Date()

    const session = await prisma.clientSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, expiresAt: true }
    })

    if (!session || session.status !== 'active' || session.expiresAt <= now) {
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' })
    }

    await prisma.clientSession.update({
      where: { id: sessionId },
      data:  { lastActiveAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) }
    })

    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'heartbeat error', err })
    return res.status(500).json({ error: 'Heartbeat failed' })
  }
})

// ─── PATCH /api/qr/session/:sessionId/complete ───────────────────────────────
// Mark session done when bill is paid (frees the seat for the next guest).

router.patch('/api/qr/session/:sessionId/complete', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string

    const session = await prisma.clientSession.findUnique({
      where: { id: sessionId },
      select: { id: true, cafeId: true, tableId: true, status: true }
    })

    if (!session) return res.status(404).json({ error: 'Session not found' })

    await prisma.clientSession.update({
      where: { id: sessionId },
      data:  { status: 'completed', lastActiveAt: new Date() }
    })

    logger.info({ msg: 'session completed', sessionId, tableId: session.tableId })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'complete session error', err })
    return res.status(500).json({ error: 'Failed to complete session' })
  }
})

// ─── GET /api/admin/tables/:tableId/sessions ─────────────────────────────────
// Admin: see who's currently sitting at a table (active sessions).

router.get('/api/admin/tables/:tableId/sessions', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const tableId = req.params.tableId as string

    const table = await prisma.table.findUnique({ where: { id: tableId }, select: { cafeId: true, capacity: true } })
    if (!table || table.cafeId !== cafeId) return res.status(404).json({ error: 'Table not found' })

    const sessions = await prisma.clientSession.findMany({
      where: { tableId, status: 'active', expiresAt: { gt: new Date() } },
      select: { id: true, seatNumber: true, createdAt: true, lastActiveAt: true, expiresAt: true },
      orderBy: { seatNumber: 'asc' }
    })

    return res.json({
      tableId,
      capacity:     table.capacity,
      activeCount:  sessions.length,
      vacantCount:  table.capacity - sessions.length,
      seats: Array.from({ length: table.capacity }, (_, i) => {
        const s = sessions.find(x => x.seatNumber === i + 1)
        return {
          seatNumber: i + 1,
          status:     s ? 'occupied' : 'vacant',
          sessionId:  s?.id ?? null,
          since:      s?.createdAt ?? null,
          lastActive: s?.lastActiveAt ?? null,
        }
      })
    })
  } catch (err) {
    logger.error({ msg: 'GET sessions error', err })
    return res.status(500).json({ error: 'Failed to fetch sessions' })
  }
})

// ─── PATCH /api/admin/tables/:id — update capacity and/or displayType ────────
// Allows the admin to change a table's seat capacity or QR holder style
// without regenerating the entire table layout.

router.patch('/api/admin/tables/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId  = req.admin!.cafeId
    const tableId = String(req.params.id)
    const { capacity, displayType } = req.body as { capacity?: number; displayType?: number }

    if (capacity === undefined && displayType === undefined) {
      return res.status(400).json({ error: 'Provide at least one of: capacity, displayType' })
    }
    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1 || capacity > 20)) {
      return res.status(400).json({ error: 'capacity must be an integer between 1 and 20' })
    }
    if (displayType !== undefined && ![1, 2, 3, 4].includes(displayType)) {
      return res.status(400).json({ error: 'displayType must be 1 (card), 2 (tent), 3 (stand), or 4 (acrylic)' })
    }

    const table = await prisma.table.findUnique({ where: { id: tableId }, select: { cafeId: true } })
    if (!table || table.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Table not found' })
    }

    const updated = await prisma.table.update({
      where: { id: tableId },
      data:  {
        ...(capacity    !== undefined && { capacity }),
        ...(displayType !== undefined && { displayType }),
      },
      select: { id: true, tableNumber: true, capacity: true, displayType: true }
    })

    logger.info({ msg: 'table updated', cafeId, tableId, capacity, displayType })
    return res.json(updated)
  } catch (err) {
    logger.error({ msg: 'PATCH /api/admin/tables/:id error', err })
    return res.status(500).json({ error: 'Failed to update table' })
  }
})

// ─── POST /api/admin/sessions/cleanup — expire stale sessions ────────────────
// Safe to call from a nightly cron (also exposed as an admin endpoint for
// manual triggering from the dashboard).

router.post('/api/admin/sessions/cleanup', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { count } = await prisma.clientSession.updateMany({
      where: { cafeId, status: 'active', expiresAt: { lt: new Date() } },
      data:  { status: 'expired' }
    })
    logger.info({ msg: 'sessions cleaned up', cafeId, expired: count })
    return res.json({ expired: count })
  } catch (err) {
    logger.error({ msg: 'POST /api/admin/sessions/cleanup error', err })
    return res.status(500).json({ error: 'Cleanup failed' })
  }
})

export default router
