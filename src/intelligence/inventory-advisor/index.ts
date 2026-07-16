// ─── Smart Intelligence Inventory Advisor v1 — Public API (K60) ────────────

export type {
  IngredientConsumption, StockItemMovement, OutOfStockPrediction, OverstockItem,
  ReorderSuggestion, InventoryAdvisorSummary,
} from './types'

export { computeIngredientConsumption, getStockItemMovement } from './ConsumptionRate'
export { detectLowStockItems } from './LowStockDetection'
export { predictOutOfStock } from './OutOfStockPrediction'
export { detectSlowMovingItems, detectFastMovingItems } from './MovementDetection'
export { detectOverstockItems } from './OverstockDetection'
export { getReorderSuggestions } from './ReorderSuggestions'
export { inventoryReorderRecommendationRule } from './ReorderRecommendationRule'
export { getInventoryAdvisorSummary } from './InventoryAdvisorService'
export { registerInventoryAdvisorAgent } from './InventoryAdvisorAgent'
