import express, { Request, Response } from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'
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
            qrToken: uuidv4(),
            seats: {
              create: Array.from({ length: seatsPerTable }, (_, i) => ({
                seatNumber: i + 1,
                cafeId,
                qrToken: uuidv4()
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

// ─── GET /:subdomain/t/:tableNumber/s/:seatNumber — Hybrid QR seat session ───

router.get('/:subdomain/t/:tableNumber/s/:seatNumber', validateSeatQR, (req: Request, res: Response) => {
  const session = req.seatSession!

  return res.json({
    cafeId:      session.cafeId,
    tableId:     session.tableId,
    tableNumber: session.tableNumber,
    seatId:      session.seatId,
    seatNumber:  session.seatNumber,
    billingTableId: session.billingTableId,
    isMerged:    session.isMerged,
    mergedIntoTableNumber: session.mergedIntoTableNumber ?? null,
    sessionHint: `T${session.tableNumber}-S${session.seatNumber}`
  })
})

export default router
