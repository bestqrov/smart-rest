import { Server as SocketIOServer } from 'socket.io'
import prisma from '../prisma'
import logger from '../logger'

export interface KdsTicketItem {
  productId:   string
  productName: string
  quantity:    number
  notes:       string | null
}

export interface KdsSeatGroup {
  seatId:              string | null
  seatNumber:          number | null
  physicalTableNumber: number
  items:               KdsTicketItem[]
}

export interface KdsTicket {
  orderId:              string
  cafeId:               string
  billingTableNumber:   number
  physicalTableNumbers: number[]
  isMergedGroup:        boolean
  mergeLabel:           string
  seatGroups:           KdsSeatGroup[]
  totalPrice:           string
  createdAt:            Date
}

// ─── buildKdsTicket ───────────────────────────────────────────────────────────

export async function buildKdsTicket(orderId: string): Promise<KdsTicket | null> {
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

  const physicalTableNumber = order.originalTableId
    ? (await prisma.table.findUnique({ where: { id: order.originalTableId }, select: { tableNumber: true } }))
        ?.tableNumber ?? billingTable.tableNumber
    : billingTable.tableNumber

  const mergedChildren = billingTable.mergedTables.map((t) => t.tableNumber)
  const physicalTableNumbers = [billingTable.tableNumber, ...mergedChildren].sort((a, b) => a - b)
  const isMergedGroup = mergedChildren.length > 0

  const mergeLabel = isMergedGroup
    ? `TABLE ${billingTable.tableNumber} [Merged with ${mergedChildren.join(', ')}]`
    : `TABLE ${billingTable.tableNumber}`

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
    totalPrice:           String(order.totalPrice),
    createdAt:            order.createdAt
  }
}

// ─── emitKdsTicket ────────────────────────────────────────────────────────────

export async function emitKdsTicket(io: SocketIOServer, orderId: string): Promise<void> {
  try {
    const ticket = await buildKdsTicket(orderId)
    if (!ticket) return

    const lines: string[] = [`━━━ ${ticket.mergeLabel} ━━━`]
    for (const sg of ticket.seatGroups) {
      const seatLabel = sg.seatNumber !== null
        ? sg.physicalTableNumber !== ticket.billingTableNumber
          ? `Seat ${sg.seatNumber} (Table ${sg.physicalTableNumber})`
          : `Seat ${sg.seatNumber}`
        : `Table ${sg.physicalTableNumber}`

      for (const item of sg.items) {
        lines.push(`  ${seatLabel}: ${item.quantity}× ${item.productName}${item.notes ? ` [${item.notes}]` : ''}`)
      }
    }
    lines.push(`  Total: ${ticket.totalPrice}`)

    const enriched = { ...ticket, kitchenLabel: lines.join('\n') }
    io.to(`kds_room_${ticket.cafeId}`).emit('kds_new_order', enriched)
    io.to(`room_${ticket.cafeId}`).emit('new_order', {
      orderId: ticket.orderId, mergeLabel: ticket.mergeLabel, totalPrice: ticket.totalPrice
    })
  } catch (err) {
    logger.error({ msg: 'emitKdsTicket error', orderId, err })
  }
}

// ─── emitOrderStatusUpdate ────────────────────────────────────────────────────
// Broadcasts an order status change to all relevant rooms.
//
// Room targeting per status (multi-tenant: all rooms are scoped to cafeId):
//   room_{cafeId}        → admin dashboard + POS waiter
//   kds_room_{cafeId}    → kitchen display
//   table_room_*         → customer device (PREPARING / DELIVERED only)
//
// Extra event when status = DELIVERED (kitchen done):
//   waiter_order_ready → emitted to room_{cafeId} so POS waiter shows a badge

export function emitOrderStatusUpdate(
  io: SocketIOServer,
  cafeId: string,
  orderId: string,
  status: string,
  tableId: string | null
): void {
  const payload = { orderId, status, tableId }

  io.to(`room_${cafeId}`).emit('order_status_updated', payload)
  io.to(`kds_room_${cafeId}`).emit('kds_order_updated', payload)

  // Notify customer for every meaningful lifecycle change
  if (tableId && ['PREPARING', 'READY', 'DELIVERED'].includes(status)) {
    io.to(`table_room_${cafeId}_${tableId}`).emit('your_order_updated', payload)
  }

  // Alert waiter when kitchen marks order READY or DELIVERED
  if (status === 'READY' || status === 'DELIVERED') {
    io.to(`room_${cafeId}`).emit('waiter_order_ready', { orderId, tableId })
  }
}
