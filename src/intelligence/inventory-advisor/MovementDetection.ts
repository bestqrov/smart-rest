// ─── Smart Intelligence Inventory Advisor v1 — Movement Detection (K60) ────
// Slow-moving and fast-moving both reuse getStockItemMovement — only the
// sort direction differs, no separate calculation.

import { getStockItemMovement } from './ConsumptionRate'
import type { StockItemMovement } from './types'

export async function detectSlowMovingItems(tenantId: string, limit = 10, windowDays?: number): Promise<StockItemMovement[]> {
  const movement = await getStockItemMovement(tenantId, windowDays)
  return [...movement].sort((a, b) => a.avgDailyQty - b.avgDailyQty).slice(0, limit)
}

export async function detectFastMovingItems(tenantId: string, limit = 10, windowDays?: number): Promise<StockItemMovement[]> {
  const movement = await getStockItemMovement(tenantId, windowDays)
  return [...movement].sort((a, b) => b.avgDailyQty - a.avgDailyQty).slice(0, limit)
}
