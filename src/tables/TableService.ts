// ─── Tables Management (K14) ───────────────────────────────────────────────
// Table CRUD, merge/unmerge, and order-derived occupancy already exist in
// routes/tables.ts and routes/pos/tablesStatus.ts — reused, not duplicated.
// New here: the AVAILABLE/RESERVED/OCCUPIED/CLEANING status vocabulary
// (RESERVED/CLEANING aren't derivable from orders, so they're an explicit
// override), order-to-table transfer, and event emission.

import prisma from '../prisma'
import { publishStandardEvent } from '../core'

export type TableStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'CLEANING'
type ManualStatus = 'RESERVED' | 'CLEANING'

async function hasActiveOrder(tableId: string): Promise<boolean> {
  const count = await prisma.order.count({
    where: { tableId, billStatus: { in: ['OPENED', 'BILL_REQUESTED'] } },
  })
  return count > 0
}

// ─── Get table status ───────────────────────────────────────────────────────
// An active order always wins (OCCUPIED); otherwise falls back to the
// manual override, defaulting to AVAILABLE.
export async function getTableStatus(tableId: string, cafeId: string): Promise<TableStatus> {
  const table = await prisma.table.findFirst({ where: { id: tableId, cafeId } })
  if (!table) throw new Error(`Table ${tableId} not found for cafe ${cafeId}`)

  if (await hasActiveOrder(tableId)) return 'OCCUPIED'
  return (table.manualStatus as TableStatus) ?? 'AVAILABLE'
}

// ─── Set table status ────────────────────────────────────────────────────────
// Only RESERVED/CLEANING/AVAILABLE are settable manually — OCCUPIED is
// always derived from active orders and cannot be forced.
export async function setTableStatus(
  tableId: string,
  cafeId:  string,
  status:  ManualStatus | 'AVAILABLE',
): Promise<TableStatus> {
  const table = await prisma.table.findFirst({ where: { id: tableId, cafeId } })
  if (!table) throw new Error(`Table ${tableId} not found for cafe ${cafeId}`)

  if (await hasActiveOrder(tableId)) {
    throw new Error(`Table ${tableId} has an active order — cannot set manual status`)
  }

  await prisma.table.update({
    where: { id: tableId },
    data:  { manualStatus: status === 'AVAILABLE' ? null : status },
  })

  publishStandardEvent('TableStatusChanged', {
    tenantId: cafeId, resourceId: tableId, metadata: { status },
  }, 'tables')

  return status
}

// ─── Transfer an order to a different table ─────────────────────────────────
// Distinct from table merge (routes/tables.ts, structural/permanent): this
// moves a single order's bill to another table, one-off.
export async function transferOrder(orderId: string, cafeId: string, toTableId: string) {
  const [order, targetTable] = await Promise.all([
    prisma.order.findFirst({ where: { id: orderId, cafeId } }),
    prisma.table.findFirst({ where: { id: toTableId, cafeId } }),
  ])
  if (!order) throw new Error(`Order ${orderId} not found for cafe ${cafeId}`)
  if (!targetTable) throw new Error(`Table ${toTableId} not found for cafe ${cafeId}`)
  if (!targetTable.isActive) throw new Error(`Table ${toTableId} is inactive`)
  if (order.tableId === toTableId) return order

  const fromTableId = order.tableId
  const updated = await prisma.order.update({
    where: { id: orderId },
    data:  { tableId: toTableId },
  })

  publishStandardEvent('TableTransferred', {
    tenantId: cafeId, resourceId: orderId, metadata: { fromTableId, toTableId },
  }, 'tables')

  return updated
}
