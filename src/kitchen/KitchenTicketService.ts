// ─── Kitchen Display System — Ticket Service (K12 Foundation) ──────────────
// API-first: a KitchenTicket tracks kitchen-side workflow independently of
// Order.status (untouched). One ticket per order, linked by orderId.

import prisma from '../prisma'
import logger from '../logger'
import { publishStandardEvent } from '../core'

export type KitchenTicketStatus =
  | 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED'

const ALLOWED_TRANSITIONS: Record<KitchenTicketStatus, KitchenTicketStatus[]> = {
  PENDING:   ['ACCEPTED', 'CANCELLED'],
  ACCEPTED:  ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY:     ['SERVED'],
  SERVED:    [],
  CANCELLED: [],
}

async function getTicketOrThrow(ticketId: string) {
  const ticket = await prisma.kitchenTicket.findUnique({ where: { id: ticketId } })
  if (!ticket) throw new Error(`Kitchen ticket ${ticketId} not found`)
  return ticket
}

function assertTransition(from: string, to: KitchenTicketStatus) {
  if (!ALLOWED_TRANSITIONS[from as KitchenTicketStatus]?.includes(to)) {
    throw new Error(`Invalid kitchen ticket transition: ${from} → ${to}`)
  }
}

// ─── Create ticket, linked to an existing order ────────────────────────────
export async function createTicket(orderId: string, cafeId: string, station?: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, cafeId } })
  if (!order) throw new Error(`Order ${orderId} not found for cafe ${cafeId}`)

  const existing = await prisma.kitchenTicket.findUnique({ where: { orderId } })
  if (existing) return existing // idempotent — one ticket per order

  return prisma.kitchenTicket.create({
    data: { orderId, cafeId, station, status: 'PENDING' },
  })
}

export async function getTicket(ticketId: string) {
  return prisma.kitchenTicket.findUnique({ where: { id: ticketId } })
}

export async function getTicketByOrder(orderId: string) {
  return prisma.kitchenTicket.findUnique({ where: { orderId } })
}

export async function listTickets(cafeId: string, status?: KitchenTicketStatus) {
  return prisma.kitchenTicket.findMany({
    where:   { cafeId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'asc' },
  })
}

export async function assignStation(ticketId: string, station: string) {
  await getTicketOrThrow(ticketId)
  return prisma.kitchenTicket.update({ where: { id: ticketId }, data: { station } })
}

// ─── Workflow transitions ───────────────────────────────────────────────────

export async function acceptTicket(ticketId: string) {
  const ticket = await getTicketOrThrow(ticketId)
  assertTransition(ticket.status, 'ACCEPTED')

  const updated = await prisma.kitchenTicket.update({
    where: { id: ticketId },
    data:  { status: 'ACCEPTED', acceptedAt: new Date() },
  })
  publishStandardEvent('KitchenOrderAccepted', {
    tenantId: ticket.cafeId, resourceId: ticket.orderId, metadata: { ticketId, station: ticket.station },
  }, 'kitchen')
  return updated
}

export async function startPreparing(ticketId: string) {
  const ticket = await getTicketOrThrow(ticketId)
  assertTransition(ticket.status, 'PREPARING')

  const updated = await prisma.kitchenTicket.update({
    where: { id: ticketId },
    data:  { status: 'PREPARING', preparingAt: new Date() },
  })
  publishStandardEvent('KitchenOrderPreparing', {
    tenantId: ticket.cafeId, resourceId: ticket.orderId, metadata: { ticketId, station: ticket.station },
  }, 'kitchen')
  return updated
}

export async function markReady(ticketId: string) {
  const ticket = await getTicketOrThrow(ticketId)
  assertTransition(ticket.status, 'READY')

  const updated = await prisma.kitchenTicket.update({
    where: { id: ticketId },
    data:  { status: 'READY', readyAt: new Date() },
  })
  publishStandardEvent('KitchenOrderReady', {
    tenantId: ticket.cafeId, resourceId: ticket.orderId, metadata: { ticketId, station: ticket.station },
  }, 'kitchen')
  return updated
}

export async function markServed(ticketId: string) {
  const ticket = await getTicketOrThrow(ticketId)
  assertTransition(ticket.status, 'SERVED')

  const updated = await prisma.kitchenTicket.update({
    where: { id: ticketId },
    data:  { status: 'SERVED', servedAt: new Date() },
  })
  publishStandardEvent('KitchenOrderServed', {
    tenantId: ticket.cafeId, resourceId: ticket.orderId, metadata: { ticketId, station: ticket.station },
  }, 'kitchen')
  return updated
}

export async function cancelTicket(ticketId: string) {
  const ticket = await getTicketOrThrow(ticketId)
  assertTransition(ticket.status, 'CANCELLED')

  return prisma.kitchenTicket.update({
    where: { id: ticketId },
    data:  { status: 'CANCELLED', cancelledAt: new Date() },
  })
}

// ─── Engine Init ────────────────────────────────────────────────────────────
// Subscribes to the existing OrderCreated platform event (from
// OrderCoreService) to auto-create a linked ticket — wires the kitchen
// workflow to the order lifecycle without touching order code.
export async function initKitchenEngine(): Promise<void> {
  const { eventBus } = await import('../core')

  eventBus.subscribe('OrderCreated', async (event: any) => {
    try {
      const { tenantId, resourceId } = event.payload as Record<string, any>
      if (!tenantId || !resourceId) return
      await createTicket(resourceId, tenantId)
    } catch (err) {
      logger.error({ msg: '[KitchenEngine] failed to auto-create ticket', err })
    }
  })

  logger.info({ msg: '[KitchenEngine] initialized — subscribed to OrderCreated' })
}
