// ─── Smart Intelligence Inventory Advisor v1 — Overstock Detection (K60) ───
// Rule-based: currentQty / avgDailyQty > threshold days of stock on hand.
// Reuses getStockItemMovement — no second consumption calculation.

import { getStockItemMovement } from './ConsumptionRate'
import type { OverstockItem } from './types'

const OVERSTOCK_DAYS_THRESHOLD = 30

export async function detectOverstockItems(tenantId: string, windowDays?: number): Promise<OverstockItem[]> {
  const movement = await getStockItemMovement(tenantId, windowDays)

  return movement
    .filter(item => item.avgDailyQty > 0)
    .map(item => ({
      ingredientName: item.ingredientName, currentQty: item.currentQty, unit: item.unit,
      avgDailyQty: item.avgDailyQty,
      daysOfStockOnHand: Math.round(item.currentQty / item.avgDailyQty),
    }))
    .filter(o => o.daysOfStockOnHand > OVERSTOCK_DAYS_THRESHOLD)
    .sort((a, b) => b.daysOfStockOnHand - a.daysOfStockOnHand)
}
