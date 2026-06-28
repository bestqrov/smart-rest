import prisma from '../../../prisma'
import { scoreBoolean, scoreNumber } from '../../scoring/ScoringEngine'
import type { DataFetcher, RuleEvaluatorMap, EvidenceInput } from '../../types'
import { addDays } from '../../../core/utils/dates'

// ─── Data fetcher ─────────────────────────────────────────────────────────────
//
// Fetches all data needed by restaurant rule evaluators in a single pass.
// Called once per evaluation — result is passed to all evaluators.

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
    billingStatus:    cafe?.billingStatus     ?? 'SUSPENDED',
    weeklyOrderCount: cafe?.weeklyOrderCount  ?? 0,
    inventoryEnabled: cafe?.isSmartInventoryEnabled ?? false,
    isActive:         cafe?.isActive          ?? false,
    menuItemCount:    menuItemCount           ?? 0,
    categoryCount:    categoryCount           ?? 0,
    tableCount:       tableCount             ?? 0,
    staffCount:       staffCount             ?? 0,
    orderCount30d:    orderCount             ?? 0,
    qrOrderCount30d:  qrOrderCount           ?? 0,
    reservationCount30d: reservationCount    ?? 0,
    marketingCount:   marketingCount          ?? 0,
    loyaltyCount:     loyaltyCount           ?? 0,
  }
}

// ─── Rule evaluators ──────────────────────────────────────────────────────────

export const restaurantEvaluators: RuleEvaluatorMap = {

  MENU_ITEMS_COUNT: async (rule, data): Promise<EvidenceInput> =>
    scoreNumber(data.menuItemCount as number, rule.expectedValue as number, true),

  MENU_CATEGORIES: async (rule, data): Promise<EvidenceInput> =>
    scoreNumber(data.categoryCount as number, rule.expectedValue as number, false),

  TABLES_CONFIGURED: async (rule, data): Promise<EvidenceInput> =>
    scoreNumber(data.tableCount as number, rule.expectedValue as number, false),

  STAFF_REGISTERED: async (rule, data): Promise<EvidenceInput> =>
    scoreNumber(data.staffCount as number, rule.expectedValue as number, false),

  BILLING_ACTIVE: async (_rule, data): Promise<EvidenceInput> => {
    const active = ['COLLECTING_DEBT', 'GRACE_PERIOD'].includes(data.billingStatus as string)
    return scoreBoolean(active, true)
  },

  ORDERS_LAST_30_DAYS: async (rule, data): Promise<EvidenceInput> =>
    scoreNumber(data.orderCount30d as number, rule.expectedValue as number, true),

  WEEKLY_ORDER_VOLUME: async (rule, data): Promise<EvidenceInput> =>
    scoreNumber(data.weeklyOrderCount as number, rule.expectedValue as number, true),

  QR_ORDERS_ENABLED: async (_rule, data): Promise<EvidenceInput> =>
    scoreBoolean((data.qrOrderCount30d as number) > 0, true),

  RESERVATIONS_ACTIVE: async (_rule, data): Promise<EvidenceInput> =>
    scoreBoolean((data.reservationCount30d as number) > 0, true),

  MARKETING_CONFIGURED: async (_rule, data): Promise<EvidenceInput> =>
    scoreBoolean((data.marketingCount as number) > 0, true),

  LOYALTY_CUSTOMERS: async (_rule, data): Promise<EvidenceInput> =>
    scoreBoolean((data.loyaltyCount as number) > 0, true),

  INVENTORY_ACTIVE: async (_rule, data): Promise<EvidenceInput> =>
    scoreBoolean(data.inventoryEnabled as boolean, true),
}
