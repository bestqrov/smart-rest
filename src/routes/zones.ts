import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'
import type { AssignTokenParams, TokenAssignmentResult } from '../types/zone-session'

const router = express.Router()

// ─── Admin: List zones ─────────────────────────────────────────────────────────
// GET /api/zones

router.get('/api/zones', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId

    const zones = await prisma.zone.findMany({
      where: { cafeId },
      orderBy: { name: 'asc' },
      include: {
        tables: {
          where: { isActive: true },
          select: { id: true, tableNumber: true, capacity: true, isActive: true }
        },
        _count: {
          select: {
            activeSessions: { where: { status: 'ACTIVE' } }
          }
        }
      }
    })

    return res.json(zones)
  } catch (err) {
    logger.error({ msg: 'GET /api/zones error', err })
    return res.status(500).json({ error: 'Failed to fetch zones' })
  }
})

// ─── Admin: Get single zone ────────────────────────────────────────────────────
// GET /api/zones/:zoneId

router.get('/api/zones/:zoneId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const zoneId = req.params.zoneId as string

    const zone = await prisma.zone.findFirst({
      where: { id: zoneId, cafeId },
      include: {
        tables: {
          where: { isActive: true },
          select: { id: true, tableNumber: true, capacity: true, isActive: true }
        },
        _count: {
          select: {
            activeSessions: { where: { status: 'ACTIVE' } }
          }
        }
      }
    })

    if (!zone) return res.status(404).json({ error: 'Zone not found' })
    return res.json(zone)
  } catch (err) {
    logger.error({ msg: 'GET /api/zones/:zoneId error', err })
    return res.status(500).json({ error: 'Failed to fetch zone' })
  }
})

// ─── Admin: Create zone ────────────────────────────────────────────────────────
// POST /api/zones
// Body: { name, displayType?, matchModeActive?, maxDynamicTokens? }

router.post('/api/zones', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { name, displayType, matchModeActive, maxDynamicTokens } = req.body as {
      name?: string
      displayType?: number
      matchModeActive?: boolean
      maxDynamicTokens?: number
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' })
    }

    const zone = await prisma.zone.create({
      data: {
        cafeId,
        name: name.trim(),
        displayType:      displayType      ?? 1,
        matchModeActive:  matchModeActive  ?? false,
        maxDynamicTokens: maxDynamicTokens ?? 50
      }
    })

    logger.info({ msg: 'Zone created', zoneId: zone.id, cafeId })
    return res.status(201).json(zone)
  } catch (err) {
    logger.error({ msg: 'POST /api/zones error', err })
    return res.status(500).json({ error: 'Failed to create zone' })
  }
})

// ─── Admin: Update zone ────────────────────────────────────────────────────────
// PATCH /api/zones/:zoneId
// Body: { name?, displayType?, matchModeActive?, maxDynamicTokens? }

router.patch('/api/zones/:zoneId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const zoneId = req.params.zoneId as string
    const { name, displayType, matchModeActive, maxDynamicTokens } = req.body as {
      name?: string
      displayType?: number
      matchModeActive?: boolean
      maxDynamicTokens?: number
    }

    const existing = await prisma.zone.findFirst({ where: { id: zoneId, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Zone not found' })

    const updated = await prisma.zone.update({
      where: { id: zoneId },
      data: {
        ...(name             !== undefined && { name: name.trim() }),
        ...(displayType      !== undefined && { displayType }),
        ...(matchModeActive  !== undefined && { matchModeActive }),
        ...(maxDynamicTokens !== undefined && { maxDynamicTokens })
      }
    })

    return res.json(updated)
  } catch (err) {
    logger.error({ msg: 'PATCH /api/zones/:zoneId error', err })
    return res.status(500).json({ error: 'Failed to update zone' })
  }
})

// ─── Admin: Toggle Match Mode ──────────────────────────────────────────────────
// POST /api/zones/:zoneId/match-mode
// Body: { active: boolean }

router.post('/api/zones/:zoneId/match-mode', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const zoneId = req.params.zoneId as string
    const { active } = req.body as { active?: boolean }

    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'active (boolean) is required' })
    }

    const existing = await prisma.zone.findFirst({ where: { id: zoneId, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Zone not found' })

    const zone = await prisma.zone.update({
      where: { id: zoneId },
      data: { matchModeActive: active }
    })

    logger.info({ msg: 'Match mode toggled', zoneId, matchModeActive: active, cafeId })
    return res.json({ zoneId: zone.id, matchModeActive: zone.matchModeActive })
  } catch (err) {
    logger.error({ msg: 'POST /api/zones/:zoneId/match-mode error', err })
    return res.status(500).json({ error: 'Failed to toggle match mode' })
  }
})

// ─── Admin: Delete zone ────────────────────────────────────────────────────────
// DELETE /api/zones/:zoneId

router.delete('/api/zones/:zoneId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const zoneId = req.params.zoneId as string

    const existing = await prisma.zone.findFirst({ where: { id: zoneId, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Zone not found' })

    const activeCount = await prisma.activeSession.count({
      where: { zoneId, status: 'ACTIVE' }
    })

    if (activeCount > 0) {
      return res.status(409).json({
        error: 'ZONE_HAS_ACTIVE_SESSIONS',
        message: `Cannot delete zone with ${activeCount} active session(s). Close them first.`
      })
    }

    // Unlink tables from this zone before deletion
    await prisma.table.updateMany({
      where: { zoneId, cafeId },
      data: { zoneId: null }
    })

    await prisma.zone.delete({ where: { id: zoneId } })

    logger.info({ msg: 'Zone deleted', zoneId, cafeId })
    return res.json({ success: true })
  } catch (err) {
    logger.error({ msg: 'DELETE /api/zones/:zoneId error', err })
    return res.status(500).json({ error: 'Failed to delete zone' })
  }
})

// ─── Admin: Assign table to zone ──────────────────────────────────────────────
// POST /api/zones/:zoneId/tables/:tableId

router.post('/api/zones/:zoneId/tables/:tableId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const zoneId  = req.params.zoneId  as string
    const tableId = req.params.tableId as string

    const [zone, table] = await Promise.all([
      prisma.zone.findFirst({ where: { id: zoneId, cafeId } }),
      prisma.table.findFirst({ where: { id: tableId, cafeId } })
    ])

    if (!zone)  return res.status(404).json({ error: 'Zone not found' })
    if (!table) return res.status(404).json({ error: 'Table not found' })

    const updated = await prisma.table.update({
      where: { id: tableId },
      data: { zoneId },
      select: { id: true, tableNumber: true, zoneId: true }
    })

    return res.json(updated)
  } catch (err) {
    logger.error({ msg: 'POST /api/zones/:zoneId/tables/:tableId error', err })
    return res.status(500).json({ error: 'Failed to assign table to zone' })
  }
})

// ─── Admin: Active sessions for a zone ────────────────────────────────────────
// GET /api/zones/:zoneId/sessions

router.get('/api/zones/:zoneId/sessions', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const zoneId = req.params.zoneId as string

    const zone = await prisma.zone.findFirst({ where: { id: zoneId, cafeId } })
    if (!zone) return res.status(404).json({ error: 'Zone not found' })

    const sessions = await prisma.activeSession.findMany({
      where: { zoneId, cafeId, status: { in: ['ACTIVE', 'PENDING_PAYMENT'] } },
      orderBy: { tokenNumber: 'asc' },
      select: {
        id:            true,
        tokenNumber:   true,
        status:        true,
        createdAt:     true,
        updatedAt:     true,
        tableId:       true,
        table:         { select: { tableNumber: true } },
        _count:        { select: { orders: true } }
      }
    })

    return res.json({
      zone:     { id: zone.id, name: zone.name, matchModeActive: zone.matchModeActive, maxDynamicTokens: zone.maxDynamicTokens },
      sessions,
      total:    sessions.length
    })
  } catch (err) {
    logger.error({ msg: 'GET /api/zones/:zoneId/sessions error', err })
    return res.status(500).json({ error: 'Failed to fetch zone sessions' })
  }
})

// ─── Admin: Force-close a session ─────────────────────────────────────────────
// POST /api/zones/sessions/:sessionId/close

router.post('/api/zones/sessions/:sessionId/close', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId    = req.admin!.cafeId
    const sessionId = req.params.sessionId as string

    const session = await prisma.activeSession.findFirst({
      where: { id: sessionId, cafeId }
    })
    if (!session) return res.status(404).json({ error: 'Session not found' })

    const updated = await prisma.activeSession.update({
      where: { id: sessionId },
      data: { status: 'PAID' }
    })

    logger.info({ msg: 'Session force-closed by admin', sessionId, cafeId })
    return res.json({ success: true, status: updated.status })
  } catch (err) {
    logger.error({ msg: 'POST /api/zones/sessions/:sessionId/close error', err })
    return res.status(500).json({ error: 'Failed to close session' })
  }
})

// ─── Scan helpers ─────────────────────────────────────────────────────────────

type ScanPayload = {
  sessionId:   string
  zoneName:    string
  tokenNumber: number
  tableId:     string | null
  status:      string
  resumed:     boolean
}

// Wraps token creation in a Prisma transaction and retries on write conflict.
// Guarantees atomicity: count + create happen in the same MongoDB session.
// maxRetries=3 covers the rare burst of simultaneous scans at the same zone.
async function createTokenAtomic(
  zoneId:         string,
  cafeId:         string,
  tableId:        string | null,
  userIdentifier: string,
  maxTokens:      number,
  scope:          'zone' | 'table',
  maxRetries = 3
): Promise<{ id: string; tokenNumber: number }> {
  let lastErr: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const session = await prisma.$transaction(async (tx) => {
        // Count occupancy within the transaction (atomic read)
        const occupancyWhere =
          scope === 'zone'
            ? { zoneId,  status: { in: ['ACTIVE' as const, 'PENDING_PAYMENT' as const] } }
            : { tableId, status: { in: ['ACTIVE' as const, 'PENDING_PAYMENT' as const] } }

        const occupied = await tx.activeSession.count({ where: occupancyWhere })

        if (occupied >= maxTokens) throw Object.assign(new Error('CAPACITY_FULL'), { code: 'CAPACITY_FULL' })

        // Next sequential token within the same scope
        const scopeWhere = scope === 'zone' ? { zoneId } : { tableId }
        const last = await tx.activeSession.findFirst({
          where:   scopeWhere,
          orderBy: { tokenNumber: 'desc' },
          select:  { tokenNumber: true }
        })
        const tokenNumber = (last?.tokenNumber ?? 0) + 1

        return tx.activeSession.create({
          data: { cafeId, zoneId, tableId, tokenNumber, userIdentifier, status: 'ACTIVE' },
          select: { id: true, tokenNumber: true }
        })
      })

      return session
    } catch (err: any) {
      // Propagate capacity errors immediately — no point retrying
      if (err?.code === 'CAPACITY_FULL') throw err

      lastErr = err

      if (attempt < maxRetries) {
        // Exponential back-off: 50 ms, 100 ms, 200 ms
        await new Promise(r => setTimeout(r, 50 * Math.pow(2, attempt)))
      }
    }
  }

  throw lastErr
}

// ─── Public: Scan zone/table QR — assign dynamic token ────────────────────────
// POST /api/zones/scan
// Body: { zoneId: string, userIdentifier: string, tableId?: string }
// No auth — called by the customer's browser on QR scan.
//
// Match Mode ON  → row-chair token scoped to the whole zone (tableId ignored)
// Match Mode OFF → seat token scoped to the specific table (tableId required)

router.post('/api/zones/scan', async (req: Request, res: Response) => {
  try {
    const { zoneId, userIdentifier, tableId } = req.body as {
      zoneId?:        string
      userIdentifier?: string
      tableId?:       string
    }

    if (!zoneId || !userIdentifier || typeof userIdentifier !== 'string' || userIdentifier.length < 8) {
      return res.status(400).json({ error: 'zoneId and userIdentifier (min 8 chars) are required' })
    }

    // ── 1. Resolve zone ───────────────────────────────────────────────────────

    const zone = await prisma.zone.findUnique({
      where:  { id: zoneId },
      select: { id: true, cafeId: true, name: true, matchModeActive: true, maxDynamicTokens: true }
    })

    if (!zone) return res.status(404).json({ error: 'Zone not found' })

    // ── 2. Re-identify returning device — never double-assign ─────────────────
    //    Look for any non-PAID session from this device in this zone

    const existing = await prisma.activeSession.findFirst({
      where:  { zoneId: zone.id, userIdentifier, status: { in: ['ACTIVE', 'PENDING_PAYMENT'] } },
      select: { id: true, tokenNumber: true, tableId: true, status: true }
    })

    if (existing) {
      const payload: ScanPayload = {
        sessionId:   existing.id,
        zoneName:    zone.name,
        tokenNumber: existing.tokenNumber,
        tableId:     existing.tableId,
        status:      existing.status,
        resumed:     true
      }
      return res.json(payload)
    }

    // ── 3A. MATCH MODE ON — zone-scoped row-chair token ───────────────────────

    if (zone.matchModeActive) {
      let created: { id: string; tokenNumber: number }

      try {
        created = await createTokenAtomic(
          zone.id, zone.cafeId,
          null,           // tableId = null in Match Mode
          userIdentifier,
          zone.maxDynamicTokens,
          'zone'
        )
      } catch (err: any) {
        if (err?.code === 'CAPACITY_FULL') {
          return res.status(409).json({
            error:   'ZONE_FULL',
            message: `Zone "${zone.name}" is full (${zone.maxDynamicTokens} seats). Please wait for availability.`
          })
        }
        throw err
      }

      logger.info({ msg: 'Match-mode token assigned', sessionId: created.id, tokenNumber: created.tokenNumber, zoneId: zone.id })

      const payload: ScanPayload = {
        sessionId:   created.id,
        zoneName:    zone.name,
        tokenNumber: created.tokenNumber,
        tableId:     null,
        status:      'ACTIVE',
        resumed:     false
      }
      return res.status(201).json(payload)
    }

    // ── 3B. NORMAL MODE — table-scoped seat token ─────────────────────────────

    if (!tableId) {
      return res.status(400).json({ error: 'tableId is required when Match Mode is OFF' })
    }

    const table = await prisma.table.findFirst({
      where:  { id: tableId, zoneId: zone.id, cafeId: zone.cafeId, isActive: true },
      select: { id: true, tableNumber: true, capacity: true }
    })

    if (!table) {
      return res.status(404).json({ error: 'Table not found in this zone or is inactive' })
    }

    let created: { id: string; tokenNumber: number }

    try {
      created = await createTokenAtomic(
        zone.id, zone.cafeId,
        table.id,
        userIdentifier,
        table.capacity,   // capacity cap per table, not per zone
        'table'
      )
    } catch (err: any) {
      if (err?.code === 'CAPACITY_FULL') {
        return res.status(409).json({
          error:   'TABLE_FULL',
          message: `Table #${table.tableNumber} is full (${table.capacity} seats). Ask staff for assistance.`
        })
      }
      throw err
    }

    logger.info({ msg: 'Normal-mode seat token assigned', sessionId: created.id, tokenNumber: created.tokenNumber, tableId: table.id })

    const payload: ScanPayload = {
      sessionId:   created.id,
      zoneName:    zone.name,
      tokenNumber: created.tokenNumber,
      tableId:     table.id,
      status:      'ACTIVE',
      resumed:     false
    }
    return res.status(201).json(payload)

  } catch (err) {
    logger.error({ msg: 'POST /api/zones/scan error', err })
    return res.status(500).json({ error: 'Failed to assign token' })
  }
})

// ─── Public: Update session status ────────────────────────────────────────────
// PATCH /api/zones/sessions/:sessionId/status
// Body: { userIdentifier: string, status: 'PENDING_PAYMENT' | 'PAID' }

router.patch('/api/zones/sessions/:sessionId/status', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const { userIdentifier, status } = req.body as {
      userIdentifier?: string
      status?: string
    }

    const allowed = ['PENDING_PAYMENT', 'PAID']
    if (!userIdentifier || !status || !allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` })
    }

    const session = await prisma.activeSession.findFirst({
      where: { id: sessionId, userIdentifier }
    })
    if (!session) return res.status(404).json({ error: 'Session not found or userIdentifier mismatch' })

    const updated = await prisma.activeSession.update({
      where: { id: sessionId },
      data: { status: status as 'PENDING_PAYMENT' | 'PAID' }
    })

    return res.json({ activeSessionId: updated.id, status: updated.status })
  } catch (err) {
    logger.error({ msg: 'PATCH /api/zones/sessions/:sessionId/status error', err })
    return res.status(500).json({ error: 'Failed to update session status' })
  }
})

// ─── Admin: All active sessions grouped by zone (waiter grid) ─────────────────
// GET /api/zones/sessions/active?cafeId=xxx
// Called by ZoneSessionGrid on mount.

router.get('/api/zones/sessions/active', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId

    const zones = await prisma.zone.findMany({
      where:   { cafeId },
      orderBy: { name: 'asc' },
      select: {
        id:   true,
        name: true,
        activeSessions: {
          where:   { cafeId, status: { in: ['ACTIVE', 'PENDING_PAYMENT'] } },
          orderBy: { tokenNumber: 'asc' },
          select: {
            id:          true,
            tokenNumber: true,
            status:      true,
            tableId:     true,
            createdAt:   true,
            _count:      { select: { orders: true } }
          }
        }
      }
    })

    const result = zones
      .filter(z => z.activeSessions.length > 0)
      .map(z => ({
        zoneId:   z.id,
        zoneName: z.name,
        sessions: z.activeSessions.map(s => ({
          id:          s.id,
          tokenNumber: s.tokenNumber,
          status:      s.status,
          zoneId:      z.id,
          zoneName:    z.name,
          tableId:     s.tableId,
          orderCount:  s._count.orders,
          createdAt:   s.createdAt.toISOString()
        }))
      }))

    return res.json(result)
  } catch (err) {
    logger.error({ msg: 'GET /api/zones/sessions/active error', err })
    return res.status(500).json({ error: 'Failed to fetch active sessions' })
  }
})

// ─── Admin: Mark zone-session order as served (waiter tablet action) ───────────
// POST /api/zones/sessions/mark-served
// Body: { cafeId, orderId, activeSessionId }
// Emits waiter_mark_served → handled by socket which does READY → DELIVERED
// and emits flash_dismiss to the client device.

router.post('/api/zones/sessions/mark-served', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId         = req.admin!.cafeId
    const { orderId, activeSessionId } = req.body as {
      orderId?:         string
      activeSessionId?: string
    }

    if (!orderId || !activeSessionId) {
      return res.status(400).json({ error: 'orderId and activeSessionId are required' })
    }

    const order = await prisma.order.findFirst({
      where:  { id: orderId, cafeId },
      select: { status: true, activeSessionId: true }
    })

    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.status !== 'READY') {
      return res.status(409).json({ error: 'Order must be in READY status', currentStatus: order.status })
    }
    if (order.activeSessionId !== activeSessionId) {
      return res.status(400).json({ error: 'activeSessionId mismatch' })
    }

    // The heavy lifting (DB update + socket emit) lives in the socket handler.
    // Here we just do the DB write so the REST path also works for non-socket clients.
    await prisma.order.update({
      where: { id: orderId },
      data:  { status: 'DELIVERED', preparedAt: new Date() }
    })

    logger.info({ msg: 'Order marked served via REST', orderId, activeSessionId, cafeId })
    return res.json({ success: true, orderId, status: 'DELIVERED' })
  } catch (err) {
    logger.error({ msg: 'POST /api/zones/sessions/mark-served error', err })
    return res.status(500).json({ error: 'Failed to mark as served' })
  }
})

export default router
