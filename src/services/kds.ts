import { Server as SocketIOServer } from 'socket.io'
import { Prisma } from '@prisma/client'
import prisma from '../prisma'
import logger from '../logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KdsTicketItem {
  productId:   number
  productName: string // English for kitchen
  quantity:    number
  notes:       string | null
}

export interface KdsSeatGroup {
  seatId:             number | null
  seatNumber:         number | null
  physicalTableNumber: number  // the table the customer physically sat at
  items:              KdsTicketItem[]
}

export interface KdsTicket {
  orderId:           number
  cafeId:            number
  // Billing table (master of a merge group, or just the table)
  billingTableNumber: number
  // All physical tables involved (e.g. [5, 6, 7] when merged)
  physicalTableNumbers: number[]
  isMergedGroup:      boolean
  mergeLabel:         string  // e.g. "TABLE 5 [Merged with 6, 7]"
  seatGroups:         KdsSeatGroup[]
  totalPrice:         string
  createdAt:          Date
}

// ─── buildKdsTicket ───────────────────────────────────────────────────────────

export async function buildKdsTicket(orderId: number): Promise<KdsTicket | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      cafeId: true,
      tableId: true,
      originalTableId: true,
      seatId: true,
      seatNumber: true,
      totalPrice: true,
      createdAt: true,
      table: {
        select: {
          tableNumber: true,
          mergedIntoTableId: true,
          mergedIntoTable: { select: { tableNumber: true } },
          mergedTables: { select: { id: true, tableNumber: true } }
        }
      },
      items: {
        select: {
          quantity: true,
          notes: true,
          product: { select: { id: true, nameEn: true } }
        }
      }
    }
  })

  if (!order) return null

  const billingTable = order.table
  if (!billingTable) {
    logger.warn({ msg: 'KDS: order has no table', orderId })
    return null
  }

  // Determine the physical table of this specific order
  const physicalTableNumber =
    order.originalTableId
      ? (await prisma.table.findUnique({ where: { id: order.originalTableId }, select: { tableNumber: true } }))
          ?.tableNumber ?? billingTable.tableNumber
      : billingTable.tableNumber

  // All physical tables in the merge group
  const mergedChildren = billingTable.mergedTables.map((t) => t.tableNumber)
  const physicalTableNumbers = [billingTable.tableNumber, ...mergedChildren].sort((a, b) => a - b)
  const isMergedGroup = mergedChildren.length > 0

  const mergeLabel = isMergedGroup
    ? `TABLE ${billingTable.tableNumber} [Merged with ${mergedChildren.join(', ')}]`
    : `TABLE ${billingTable.tableNumber}`

  // Group items by seat
  const seatGroup: KdsSeatGroup = {
    seatId:              order.seatId,
    seatNumber:          order.seatNumber,
    physicalTableNumber,
    items: order.items.map((it) => ({
      productId:   it.product.id,
      productName: it.product.nameEn,
      quantity:    it.quantity,
      notes:       it.notes
    }))
  }

  return {
    orderId:              order.id,
    cafeId:               order.cafeId,
    billingTableNumber:   billingTable.tableNumber,
    physicalTableNumbers,
    isMergedGroup,
    mergeLabel,
    seatGroups:           [seatGroup],
    totalPrice:           (order.totalPrice as unknown as Prisma.Decimal).toString(),
    createdAt:            order.createdAt
  }
}

// ─── emitKdsTicket ────────────────────────────────────────────────────────────

export async function emitKdsTicket(io: SocketIOServer, orderId: number): Promise<void> {
  try {
    const ticket = await buildKdsTicket(orderId)
    if (!ticket) return

    // Format human-readable kitchen label
    const lines: string[] = []
    lines.push(`━━━ ${ticket.mergeLabel} ━━━`)

    for (const sg of ticket.seatGroups) {
      const seatLabel =
        sg.seatNumber !== null
          ? sg.physicalTableNumber !== ticket.billingTableNumber
            ? `Seat ${sg.seatNumber} (Table ${sg.physicalTableNumber})`
            : `Seat ${sg.seatNumber}`
          : `Table ${sg.physicalTableNumber}`

      for (const item of sg.items) {
        const notePart = item.notes ? ` [${item.notes}]` : ''
        lines.push(`  ${seatLabel}: ${item.quantity}× ${item.productName}${notePart}`)
      }
    }
    lines.push(`  Total: ${ticket.totalPrice}`)

    const enriched = { ...ticket, kitchenLabel: lines.join('\n') }

    io.to(`kds_room_${ticket.cafeId}`).emit('kds_new_order', enriched)
    io.to(`room_${ticket.cafeId}`).emit('new_order', {
      orderId: ticket.orderId,
      mergeLabel: ticket.mergeLabel,
      totalPrice: ticket.totalPrice
    })

    logger.debug({ msg: 'KDS ticket emitted', orderId, mergeLabel: ticket.mergeLabel })
  } catch (err) {
    logger.error({ msg: 'emitKdsTicket error', orderId, err })
  }
}

// ─── emitOrderStatusUpdate ────────────────────────────────────────────────────

export function emitOrderStatusUpdate(
  io: SocketIOServer,
  cafeId: number,
  orderId: number,
  status: string,
  tableId: number | null
): void {
  const payload = { orderId, status, tableId }
  io.to(`room_${cafeId}`).emit('order_status_updated', payload)
  io.to(`kds_room_${cafeId}`).emit('kds_order_updated', payload)
  if (tableId) {
    io.to(`table_room_${cafeId}_${tableId}`).emit('your_order_updated', payload)
  }
}
