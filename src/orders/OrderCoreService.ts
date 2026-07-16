// ─── Order Management Core (K11) ───────────────────────────────────────────
// Channel-agnostic order lifecycle: create, get, update, cancel, complete.
// Built on the same Order/OrderItem models as the POS and QR ordering flows
// — order creation/item handling here delegates to the existing
// PosOrderService primitives (openOrder/addItem/closeOrder) instead of
// re-implementing them, so there is one source of truth for order math and
// payment delegation.

import prisma from '../prisma'
import { publishStandardEvent } from '../core'
import { openOrder, addItem, closeOrder, type AddItemInput } from '../pos/PosOrderService'

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
type OrderPaymentMethod = 'CASH' | 'CARD' | 'ONLINE'

export interface CreateOrderInput {
  cafeId:         string
  orderType?:     OrderType
  tableId?:       string
  customerPhone?: string
  staffId?:       string
  paymentMethod:  OrderPaymentMethod
  items:          AddItemInput[]
}

export interface UpdateOrderInput {
  tableId?:       string
  customerPhone?: string
  orderType?:     OrderType
}

function orderInclude() {
  return { items: true } as const
}

async function getOrderOrThrow(orderId: string, cafeId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, cafeId }, include: orderInclude() })
  if (!order) throw new Error(`Order ${orderId} not found for cafe ${cafeId}`)
  return order
}

// ─── 1. Create order ─────────────────────────────────────────────────────────
export async function createOrder(input: CreateOrderInput) {
  if (input.items.length === 0) throw new Error('Order must have at least one item')

  const order = await openOrder({
    cafeId:        input.cafeId,
    tableId:       input.tableId,
    customerPhone: input.customerPhone,
    staffId:       input.staffId,
    paymentMethod: input.paymentMethod,
  })

  if (input.orderType) {
    await prisma.order.update({ where: { id: order.id }, data: { orderType: input.orderType } })
  }

  for (const item of input.items) {
    await addItem(order.id, input.cafeId, item)
  }

  const created = await getOrderOrThrow(order.id, input.cafeId)

  publishStandardEvent('OrderCreated', {
    tenantId:   input.cafeId,
    resourceId: order.id,
    actor:      input.staffId,
    metadata:   { orderType: input.orderType ?? 'DINE_IN', tableId: input.tableId, itemCount: input.items.length },
  }, 'order-core')

  return created
}

// ─── 2. Get order ─────────────────────────────────────────────────────────────
export async function getOrder(orderId: string, cafeId: string) {
  return prisma.order.findFirst({ where: { id: orderId, cafeId }, include: orderInclude() })
}

// ─── 3. Update order ──────────────────────────────────────────────────────────
// Non-item fields only — item mutations go through PosOrderService's
// addItem/updateItemQuantity/removeItem, which already keep totals in sync.
export async function updateOrder(orderId: string, cafeId: string, patch: UpdateOrderInput) {
  await getOrderOrThrow(orderId, cafeId)

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      tableId:       patch.tableId,
      customerPhone: patch.customerPhone,
      orderType:     patch.orderType,
    },
    include: orderInclude(),
  })

  publishStandardEvent('OrderUpdated', {
    tenantId:   cafeId,
    resourceId: orderId,
    metadata:   { ...patch },
  }, 'order-core')

  return updated
}

// ─── 4. Cancel order ──────────────────────────────────────────────────────────
export async function cancelOrder(orderId: string, cafeId: string, reason?: string, staffId?: string) {
  const order = await getOrderOrThrow(orderId, cafeId)
  if (order.status === 'COMPLETED') throw new Error('Cannot cancel a completed order')
  if (order.status === 'CANCELLED') throw new Error('Order is already cancelled')

  const updated = await prisma.order.update({
    where:   { id: orderId },
    data:    { status: 'CANCELLED' },
    include: orderInclude(),
  })

  publishStandardEvent('OrderCancelled', {
    tenantId:   cafeId,
    resourceId: orderId,
    actor:      staffId,
    metadata:   { reason },
  }, 'order-core')

  return updated
}

// ─── 5. Complete order ────────────────────────────────────────────────────────
// Delegates entirely to PosOrderService.closeOrder for totals + payment
// capture (existing Billing/Payment engine); only adds the OrderCompleted event.
export async function completeOrder(
  orderId: string,
  cafeId:  string,
  input:   { paymentMethod?: OrderPaymentMethod; staffId?: string; printReceipt?: boolean } = {},
) {
  const updated = await closeOrder(orderId, cafeId, input)

  publishStandardEvent('OrderCompleted', {
    tenantId:   cafeId,
    resourceId: orderId,
    actor:      input.staffId,
    metadata:   { totalPrice: updated.totalPrice },
  }, 'order-core')

  return updated
}
