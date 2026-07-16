// ─── Smart Intelligence Inventory Advisor v1 — Service (K60) ───────────────
// Combines every detector above plus K36's already-registered inventory
// insights (K52's InventoryInsightRule) into one summary. Cached via K44's
// short-term Memory Engine — same 5-minute pattern used throughout this
// module.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import { listInsights } from '../insights'
import { detectLowStockItems } from './LowStockDetection'
import { predictOutOfStock } from './OutOfStockPrediction'
import { detectSlowMovingItems, detectFastMovingItems } from './MovementDetection'
import { detectOverstockItems } from './OverstockDetection'
import { getReorderSuggestions } from './ReorderSuggestions'
import type { InventoryAdvisorSummary } from './types'

const NAMESPACE = 'inventory-advisor-dashboard'
const CACHE_TTL_MS = 5 * 60 * 1000

function ensureDashboardCacheNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: CACHE_TTL_MS,
    description: 'Cached Inventory Advisor summaries',
  })
}

export async function getInventoryAdvisorSummary(tenantId: string): Promise<InventoryAdvisorSummary> {
  ensureDashboardCacheNamespace()

  const cached = await recall(tenantId, NAMESPACE, 'summary')
  if (typeof cached === 'string') {
    try {
      const parsed = JSON.parse(cached) as InventoryAdvisorSummary
      return { ...parsed, generatedAt: new Date(parsed.generatedAt) }
    } catch { /* fall through to recompute */ }
  }

  const [lowStock, outOfStockSoon, slowMovingItems, fastMovingItems, overstockItems, reorderSuggestions, inventoryInsights] = await Promise.all([
    detectLowStockItems(tenantId),
    predictOutOfStock(tenantId),
    detectSlowMovingItems(tenantId),
    detectFastMovingItems(tenantId),
    detectOverstockItems(tenantId),
    getReorderSuggestions(tenantId),
    listInsights(tenantId, 'NEW', 'WARNING').then(rows => rows.filter(r => r.category === 'inventory')),
  ])

  const summary: InventoryAdvisorSummary = {
    tenantId, lowStockItems: lowStock.length, outOfStockSoon, slowMovingItems, fastMovingItems,
    overstockItems, reorderSuggestions, openInventoryInsights: inventoryInsights.length,
    generatedAt: new Date(),
  }

  await remember(tenantId, NAMESPACE, 'summary', JSON.stringify(summary))
  return summary
}
