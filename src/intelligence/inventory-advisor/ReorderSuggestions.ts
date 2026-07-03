// ─── Smart Intelligence Inventory Advisor v1 — Reorder Suggestions (K60) ───
// Rule-based arithmetic over LowStockDetection + OutOfStockPrediction — no
// new detection, just a suggested quantity for what those two already found.

import { detectLowStockItems } from './LowStockDetection'
import { predictOutOfStock } from './OutOfStockPrediction'
import type { ReorderSuggestion } from './types'

// Reorder up to 3x the minimum threshold — simple, rule-based buffer.
const REORDER_TARGET_MULTIPLIER = 3

export async function getReorderSuggestions(tenantId: string): Promise<ReorderSuggestion[]> {
  const [lowStock, outOfStockSoon] = await Promise.all([
    detectLowStockItems(tenantId),
    predictOutOfStock(tenantId),
  ])

  const suggestions = new Map<string, ReorderSuggestion>()

  for (const item of lowStock) {
    suggestions.set(item.ingredientName, {
      ingredientName: item.ingredientName, currentQty: item.currentQty, unit: item.unit,
      minimumThreshold: item.minimumThreshold,
      suggestedReorderQty: Math.max(0, Math.round(item.minimumThreshold * REORDER_TARGET_MULTIPLIER - item.currentQty)),
      reason: 'LOW_STOCK',
    })
  }

  for (const prediction of outOfStockSoon) {
    if (suggestions.has(prediction.ingredientName)) continue
    suggestions.set(prediction.ingredientName, {
      ingredientName: prediction.ingredientName, currentQty: prediction.currentQty, unit: prediction.unit,
      minimumThreshold: 0,
      suggestedReorderQty: Math.max(0, Math.round(prediction.avgDailyQty * 7 - prediction.currentQty)), // ~1 week buffer
      reason: 'PREDICTED_OUT_OF_STOCK',
    })
  }

  return [...suggestions.values()]
}
