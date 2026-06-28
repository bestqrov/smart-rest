import type {
  MarketplaceOrder, CreateOrderInput, AddItemInput, OrderFilter, OrderPage, OrderStatus,
} from '../types'
import { assertTransition, isEditableStatus } from '../workflow/OrderWorkflow'
import { addItem, removeItem, getOrderItems } from '../order-items/OrderItemService'
import { calculateOrderTotals }               from '../services/OrderTotalsService'
import {
  emitOrderCreated,
  emitOrderSubmitted,
  emitOrderCancelled,
} from '../events/MarketplaceEvents'
import { AuditService } from '../../core'

// ─── Order number generator ───────────────────────────────────────────────────

async function generateOrderNumber(prisma: any): Promise<string> {
  const year  = new Date().getFullYear()
  const count = await prisma.marketplaceOrder.count()
  const seq   = String(count + 1).padStart(5, '0')
  return `MO-${year}-${seq}`
}

// ─── Map row → type ───────────────────────────────────────────────────────────

function toOrder(row: any): MarketplaceOrder {
  return {
    id:          row.id,
    orderNumber: row.orderNumber,
    tenantId:    row.tenantId,
    module:      row.module,
    status:      row.status as OrderStatus,
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

// ─── Recalculate + persist totals ────────────────────────────────────────────

async function refreshTotals(orderId: string): Promise<void> {
  const { default: prisma } = await import('../../prisma')
  const items  = await getOrderItems(orderId)
  const totals = calculateOrderTotals(items)
  await (prisma as any).marketplaceOrder.update({
    where: { id: orderId },
    data:  totals,
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createOrder(input: CreateOrderInput): Promise<MarketplaceOrder> {
  const { default: prisma } = await import('../../prisma')

  const orderNumber = await generateOrderNumber(prisma)
  const row = await (prisma as any).marketplaceOrder.create({
    data: {
      orderNumber,
      tenantId:    input.tenantId,
      module:      input.module,
      status:      'DRAFT',
      requestedBy: input.requestedBy,
      supplierId:  input.supplierId ?? null,
      currency:    input.currency   ?? 'MAD',
      notes:       input.notes      ?? null,
    },
  })

  const order = toOrder(row)
  emitOrderCreated(order.id, order.orderNumber, order.tenantId, order.module)
  return order
}

export async function addItemToOrder(orderId: string, input: AddItemInput) {
  const order = await getOrder(orderId)
  if (!order) throw new Error(`Order not found: ${orderId}`)
  if (!isEditableStatus(order.status)) {
    throw new Error(`Cannot modify order in status ${order.status}`)
  }

  const item = await addItem(orderId, input)
  await refreshTotals(orderId)
  return item
}

export async function removeItemFromOrder(orderId: string, itemId: string): Promise<void> {
  const order = await getOrder(orderId)
  if (!order) throw new Error(`Order not found: ${orderId}`)
  if (!isEditableStatus(order.status)) {
    throw new Error(`Cannot modify order in status ${order.status}`)
  }

  await removeItem(itemId)
  await refreshTotals(orderId)
}

export async function submitOrder(orderId: string): Promise<MarketplaceOrder> {
  const { default: prisma } = await import('../../prisma')

  const order = await getOrder(orderId)
  if (!order) throw new Error(`Order not found: ${orderId}`)
  assertTransition(order.status, 'SUBMITTED')

  const items = await getOrderItems(orderId)
  if (items.length === 0) throw new Error('Cannot submit an order with no items')

  const row = await (prisma as any).marketplaceOrder.update({
    where: { id: orderId },
    data:  { status: 'SUBMITTED' },
  })

  const updated = toOrder(row)
  AuditService.createAudit({
    module:      'marketplace',
    entity:      'Order',
    entityId:    orderId,
    action:      'ORDER_SUBMITTED',
    performedBy: order.requestedBy,
    metadata:    { orderNumber: order.orderNumber },
  }).catch(() => undefined)
  emitOrderSubmitted(orderId, order.orderNumber, order.tenantId)

  return updated
}

export async function cancelOrder(orderId: string, cancelledBy: string): Promise<MarketplaceOrder> {
  const { default: prisma } = await import('../../prisma')

  const order = await getOrder(orderId)
  if (!order) throw new Error(`Order not found: ${orderId}`)
  assertTransition(order.status, 'CANCELLED')

  const row = await (prisma as any).marketplaceOrder.update({
    where: { id: orderId },
    data:  { status: 'CANCELLED' },
  })

  const updated = toOrder(row)
  AuditService.createAudit({
    module:      'marketplace',
    entity:      'Order',
    entityId:    orderId,
    action:      'ORDER_CANCELLED',
    performedBy: cancelledBy,
    metadata:    { orderNumber: order.orderNumber },
  }).catch(() => undefined)
  emitOrderCancelled(orderId, order.orderNumber, order.tenantId, cancelledBy)

  return updated
}

export async function getOrder(id: string): Promise<MarketplaceOrder | null> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).marketplaceOrder.findUnique({ where: { id } })
  return row ? toOrder(row) : null
}

export async function getOrderByNumber(orderNumber: string): Promise<MarketplaceOrder | null> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).marketplaceOrder.findUnique({ where: { orderNumber } })
  return row ? toOrder(row) : null
}

export async function getOrders(filter: OrderFilter = {}): Promise<OrderPage> {
  const { default: prisma } = await import('../../prisma')

  const page  = Math.max(1, filter.page  ?? 1)
  const limit = Math.min(100, filter.limit ?? 20)
  const skip  = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (filter.tenantId)   where['tenantId']   = filter.tenantId
  if (filter.module)     where['module']     = filter.module
  if (filter.status)     where['status']     = filter.status
  if (filter.supplierId) where['supplierId'] = filter.supplierId

  const [rows, total] = await Promise.all([
    (prisma as any).marketplaceOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take:    limit,
    }),
    (prisma as any).marketplaceOrder.count({ where }),
  ])

  return {
    orders: rows.map(toOrder),
    total,
    page,
    pages:  Math.ceil(total / limit),
  }
}

export async function calculateTotals(orderId: string): Promise<void> {
  await refreshTotals(orderId)
}
