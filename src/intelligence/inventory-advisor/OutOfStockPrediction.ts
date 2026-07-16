// ─── Smart Intelligence Inventory Advisor v1 — Out-of-Stock Prediction (K60) ─
// Rule-based: currentQty / avgDailyQty <= threshold days. Reuses
// getStockItemMovement — no second consumption calculation.

import { getStockItemMovement } from './ConsumptionRate'
import type { OutOfStockPrediction } from './types'

const CRITICAL_DAYS_THRESHOLD = 3

export async function predictOutOfStock(tenantId: string, windowDays?: number): Promise<OutOfStockPrediction[]> {
  const movement = await getStockItemMovement(tenantId, windowDays)

  return movement
    .filter(item => item.avgDailyQty > 0)
    .map(item => ({
      ingredientName: item.ingredientName, currentQty: item.currentQty, unit: item.unit,
      avgDailyQty: item.avgDailyQty,
      daysUntilOutOfStock: Math.round((item.currentQty / item.avgDailyQty) * 10) / 10,
    }))
    .filter(p => p.daysUntilOutOfStock <= CRITICAL_DAYS_THRESHOLD)
    .sort((a, b) => a.daysUntilOutOfStock - b.daysUntilOutOfStock)
}
