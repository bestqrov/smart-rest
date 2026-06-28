import prisma from '../../../prisma'
import { addDays } from '../../../core/utils/dates'
import type { DataFetcher } from '../../types'

// ─── Restaurant data fetcher ──────────────────────────────────────────────────
//
// Fetches all data needed by restaurant certification packs in one pass.
// Key names are conventions shared between this fetcher and pack evaluators.
// Called once per evaluate() — result is passed to all rule evaluators.

export const restaurantDataFetcher: DataFetcher = async (tenantId: string) => {
  const thirtyDaysAgo = addDays(new Date(), -30)

  const [cafe, menuItemCount, categoryCount, tableCount, staffCount,
         orderCount, qrOrderCount, reservationCount, marketingCount, loyaltyCount] =
    await Promise.all([
      (prisma as any).cafe.findUnique({
        where:  { id: tenantId },
        select: {
          billingStatus:           true,
          weeklyOrderCount:        true,
          isSmartInventoryEnabled: true,
          isActive:                true,
        },
      }),
      (prisma as any).menuItem.count({ where: { cafeId: tenantId } }),
      (prisma as any).menuCategory.count({ where: { cafeId: tenantId } }),
      (prisma as any).table.count({ where: { cafeId: tenantId } }),
      (prisma as any).staff.count({ where: { cafeId: tenantId } }),
      (prisma as any).order.count({
        where: { cafeId: tenantId, createdAt: { gte: thirtyDaysAgo } },
      }),
      (prisma as any).order.count({
        where: { cafeId: tenantId, source: 'QR', createdAt: { gte: thirtyDaysAgo } },
      }).catch(() => 0),
      (prisma as any).reservation?.count({
        where: { cafeId: tenantId, createdAt: { gte: thirtyDaysAgo } },
      }).catch(() => 0) ?? 0,
      (prisma as any).marketingGeneration?.count({
        where: { leadId: tenantId, status: 'COMPLETED' },
      }).catch(() => 0) ?? 0,
      (prisma as any).cafeCustomer?.count({
        where: { cafeId: tenantId, loyaltyOptIn: true },
      }).catch(() => 0) ?? 0,
    ])

  return {
    billingStatus:       cafe?.billingStatus            ?? 'SUSPENDED',
    weeklyOrderCount:    cafe?.weeklyOrderCount         ?? 0,
    inventoryEnabled:    cafe?.isSmartInventoryEnabled  ?? false,
    isActive:            cafe?.isActive                 ?? false,
    menuItemCount:       menuItemCount                  ?? 0,
    categoryCount:       categoryCount                  ?? 0,
    tableCount:          tableCount                     ?? 0,
    staffCount:          staffCount                     ?? 0,
    orderCount30d:       orderCount                     ?? 0,
    qrOrderCount30d:     qrOrderCount                   ?? 0,
    reservationCount30d: reservationCount               ?? 0,
    marketingCount:      marketingCount                 ?? 0,
    loyaltyCount:        loyaltyCount                   ?? 0,
  }
}
