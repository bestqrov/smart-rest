// ─── Cashier drawer — which paid orders belong to a cashier's shift ──────────
// Single definition used by live-summary AND shift close, so the number the
// cashier sees all day is the same one reconciled at clôture.
//
// An order counts for a cashier when THEY collected it during the shift
// (paidById + paidAt). Orders paid before paidById existed fall back to the
// old rule (rang by this cashier during the shift) so open shifts that span
// the deploy still reconcile.

import { Prisma } from '@prisma/client'

export function drawerOrdersWhere(cafeId: string, staffId: string, since: Date, cashOnly: boolean): Prisma.OrderWhereInput {
  return {
    cafeId,
    isPaid: true,
    ...(cashOnly ? { paymentMethod: 'CASH' as const } : {}),
    OR: [
      { paidById: staffId, paidAt: { gte: since } },
      {
        AND: [
          { OR: [{ paidById: { isSet: false } }, { paidById: null }] },
          { createdById: staffId, createdAt: { gte: since } },
        ],
      },
    ],
  }
}
