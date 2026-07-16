// ─── Smart Intelligence Inventory Advisor v1 — Contracts (K60) ─────────────
// Rule-based only, no LLM. Every detection reuses the same
// computeIngredientConsumption helper (ConsumptionRate.ts) — no ingredient
// usage is calculated more than once across low-stock/out-of-stock/
// slow-fast-moving/overstock/reorder.

export interface IngredientConsumption {
  ingredientName: string
  totalQty:       number   // over the window, grams/ml
  avgDailyQty:    number
}

export interface StockItemMovement {
  id:               string
  ingredientName:   string
  unit:             string
  currentQty:       number
  minimumThreshold: number
  isLow:            boolean
  avgDailyQty:      number
}

export interface OutOfStockPrediction {
  ingredientName:       string
  currentQty:           number
  unit:                 string
  avgDailyQty:          number
  daysUntilOutOfStock:  number
}

export interface OverstockItem {
  ingredientName:  string
  currentQty:      number
  unit:            string
  avgDailyQty:     number
  daysOfStockOnHand: number
}

export interface ReorderSuggestion {
  ingredientName:    string
  currentQty:        number
  unit:              string
  minimumThreshold:  number
  suggestedReorderQty: number
  reason:            'LOW_STOCK' | 'PREDICTED_OUT_OF_STOCK'
}

export interface InventoryAdvisorSummary {
  tenantId:         string
  lowStockItems:    number
  outOfStockSoon:   OutOfStockPrediction[]
  slowMovingItems:  StockItemMovement[]
  fastMovingItems:  StockItemMovement[]
  overstockItems:   OverstockItem[]
  reorderSuggestions: ReorderSuggestion[]
  openInventoryInsights: number
  generatedAt:      Date
}
