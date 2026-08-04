import type { MarketplaceOrder, OrderStatus } from '../types'
import { assertTransition }  from '../workflow/OrderWorkflow'
import { getOrder }          from '../orders/OrderService'
import { getOrderItems }     from '../order-items/OrderItemService'
import { reserveStock, releaseReservation } from '../inventory/InventoryService'
import logger from '../../logger'
import {
  emitOrderApproved,
  emitOrderRejected,
  emitOrderFulfilled,
} from '../events/MarketplaceEvents'
import { AuditService, NotificationService } from '../../core'

// ─── Internal: persist status change ─────────────────────────────────────────

async function setStatus(
  orderId:     string,
  status:      OrderStatus,
  performedBy: string,
  extra?:      Record<string, unknown>,
): Promise<MarketplaceOrder> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).marketplaceOrder.update({
    where: { id: orderId },
    data:  { status, ...extra },
  })
  return {
    id:          row.id,
    orderNumber: row.orderNumber,
    tenantId:    row.tenantId,
    module:      row.module,
    status:      row.status,
    requestedBy: row.requestedBy,
    approvedBy:  row.approvedBy ?? undefined,
    supplierId:  row.supplierId ?? undefined,
    currency:    row.currency,
    subtotal:    row.subtotal,
    discount:    row.discount,
    tax:         row.tax,
    total:       row.total,
    notes:       row.notes ?? undefined,
    createdAt:   row.createdAt,
    updatedAt:   row.updatedAt,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

// SuperAdmin: move SUBMITTED → UNDER_REVIEW
export async function markUnderReview(orderId: string, reviewedBy: string): Promise<MarketplaceOrder> {
  const order = await getOrder(orderId)
  if (!order) throw new Error(`Order not found: ${orderId}`)
  assertTransition(order.status, 'UNDER_REVIEW')

  const updated = await setStatus(orderId, 'UNDER_REVIEW', reviewedBy)

  AuditService.createAudit({
    module:      'marketplace',
    entity:      'Order',
    entityId:    orderId,
    action:      'ORDER_UNDER_REVIEW',
    performedBy: reviewedBy,
    metadata:    { orderNumber: order.orderNumber },
  }).catch(() => undefined)

  return updated
}

// SuperAdmin: approve → reserve inventory
export async function approveOrder(orderId: string, approvedBy: string): Promise<MarketplaceOrder> {
  const order = await getOrder(orderId)
  if (!order) throw new Error(`Order not found: ${orderId}`)
  assertTransition(order.status, 'APPROVED')

  // Reserve stock for each item
  const items = await getOrderItems(orderId)
  const reservationErrors: string[] = []

  for (const item of items) {
    try {
      await reserveStock(item.productId, item.quantity)
    } catch (err: any) {
      reservationErrors.push(`${item.sku}: ${err.message}`)
    }
  }

  if (reservationErrors.length > 0) {
    throw new Error(`Insufficient stock:\n${reservationErrors.join('\n')}`)
  }

  const updated = await setStatus(orderId, 'APPROVED', approvedBy, { approvedBy })

  AuditService.createAudit({
    module:      'marketplace',
    entity:      'Order',
    entityId:    orderId,
    action:      'ORDER_APPROVED',
    performedBy: approvedBy,
    metadata:    { orderNumber: order.orderNumber, total: order.total },
  }).catch(() => undefined)

  // Notify the requester
  NotificationService.createNotification({
    level:    'SUCCESS',
    title:    'Order Approved',
    message:  `Your order ${order.orderNumber} has been approved.`,
    module:   'marketplace',
    entityId: orderId,
    targetId: order.requestedBy,
    metadata: { orderNumber: order.orderNumber, total: order.total, currency: order.currency },
  }).catch(() => undefined)

  emitOrderApproved(orderId, order.orderNumber, order.tenantId, approvedBy)
  return updated
}

// SuperAdmin: reject → no inventory change
export async function rejectOrder(
  orderId:    string,
  rejectedBy: string,
  reason?:    string,
): Promise<MarketplaceOrder> {
  const order = await getOrder(orderId)
  if (!order) throw new Error(`Order not found: ${orderId}`)
  assertTransition(order.status, 'REJECTED')

  const updated = await setStatus(orderId, 'REJECTED', rejectedBy)

  AuditService.createAudit({
    module:      'marketplace',
    entity:      'Order',
    entityId:    orderId,
    action:      'ORDER_REJECTED',
    performedBy: rejectedBy,
    metadata:    { orderNumber: order.orderNumber, reason },
  }).catch(() => undefined)

  NotificationService.createNotification({
    level:    'WARNING',
    title:    'Order Rejected',
    message:  `Your order ${order.orderNumber} has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
    module:   'marketplace',
    entityId: orderId,
    targetId: order.requestedBy,
    metadata: { orderNumber: order.orderNumber, reason },
  }).catch(() => undefined)

  emitOrderRejected(orderId, order.orderNumber, order.tenantId, rejectedBy, reason)
  return updated
}

// SuperAdmin: mark FULFILLED → deduct reservation (already reserved, mark as consumed)
export async function fulfillOrder(orderId: string, fulfilledBy: string): Promise<MarketplaceOrder> {
  const order = await getOrder(orderId)
  if (!order) throw new Error(`Order not found: ${orderId}`)
  assertTransition(order.status, 'FULFILLED')

  // Release reservations and deduct from physical stock
  const items = await getOrderItems(orderId)
  for (const item of items) {
    // Release the reservation (it was reserved on approve)
    await releaseReservation(item.productId, item.quantity).catch(err =>
      logger.error({ msg: 'fulfillOrder: releaseReservation failed', orderId, productId: item.productId, err })
    )
    // Deduct from stock
    const { adjustStock } = await import('../inventory/InventoryService')
    await adjustStock(item.productId, { delta: -item.quantity, reason: `Fulfilled order ${order.orderNumber}` }).catch(err =>
      logger.error({ msg: 'fulfillOrder: adjustStock failed', orderId, productId: item.productId, err })
    )
  }

  const updated = await setStatus(orderId, 'FULFILLED', fulfilledBy)

  AuditService.createAudit({
    module:      'marketplace',
    entity:      'Order',
    entityId:    orderId,
    action:      'ORDER_FULFILLED',
    performedBy: fulfilledBy,
    metadata:    { orderNumber: order.orderNumber },
  }).catch(() => undefined)

  NotificationService.createNotification({
    level:    'INFO',
    title:    'Order Fulfilled',
    message:  `Your order ${order.orderNumber} has been fulfilled.`,
    module:   'marketplace',
    entityId: orderId,
    targetId: order.requestedBy,
    metadata: { orderNumber: order.orderNumber },
  }).catch(() => undefined)

  emitOrderFulfilled(orderId, order.orderNumber, order.tenantId, fulfilledBy)
  return updated
}

// Cancel with inventory release (if already approved)
export async function cancelApprovedOrder(orderId: string, cancelledBy: string): Promise<void> {
  const order = await getOrder(orderId)
  if (!order) throw new Error(`Order not found: ${orderId}`)

  if (order.status === 'APPROVED') {
    const items = await getOrderItems(orderId)
    for (const item of items) {
      await releaseReservation(item.productId, item.quantity).catch(err =>
        logger.error({ msg: 'cancelApprovedOrder: releaseReservation failed', orderId, productId: item.productId, err })
      )
    }
  }
}
