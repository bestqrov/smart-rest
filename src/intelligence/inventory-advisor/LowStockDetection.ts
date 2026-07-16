// ─── Smart Intelligence Inventory Advisor v1 — Low Stock Detection (K60) ───
// Reuses the existing StockItem.isLow flag — already maintained by
// services/inventoryDeduction.ts on every order — no recomputation.

import prisma from '../../prisma'

export async function detectLowStockItems(tenantId: string) {
  return prisma.stockItem.findMany({
    where: { cafeId: tenantId, isLow: true },
    orderBy: { currentQty: 'asc' },
  })
}
