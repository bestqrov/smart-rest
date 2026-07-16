// ─── Multi-Branch Operations (K18) ─────────────────────────────────────────
// Every domain model (Product, StockItem, Recipe, Staff, Order, ...) already
// scopes by cafeId, so branch-specific menu, inventory isolation, and staff
// assignment already exist by construction — nothing to change there. The
// one missing piece is grouping: linking multiple already-independent Cafe
// rows together as branches of one business. Same flat self-relation pattern
// already used for Table.mergedIntoTableId/mergedTables (routes/tables.ts).

import prisma from '../prisma'
import { publishStandardEvent } from '../core'
import { isFeatureAvailable } from '../tenant/services/FeatureResolutionService'

async function getCafeOrThrow(cafeId: string) {
  const cafe = await prisma.cafe.findUnique({ where: { id: cafeId } })
  if (!cafe) throw new Error(`Cafe ${cafeId} not found`)
  return cafe
}

// ─── Link an existing cafe as a branch of a parent ──────────────────────────
export async function addBranch(parentCafeId: string, branchCafeId: string, performedBy = 'system') {
  if (parentCafeId === branchCafeId) throw new Error('A cafe cannot be its own branch')

  const allowed = await isFeatureAvailable(parentCafeId, 'multiLocation')
  if (!allowed) throw new Error('Multi-location is not enabled on the parent cafe\'s plan')

  const [parent, branch] = await Promise.all([getCafeOrThrow(parentCafeId), getCafeOrThrow(branchCafeId)])

  if (parent.parentCafeId) {
    throw new Error('Parent cafe is itself a branch of another cafe — flatten the hierarchy first')
  }
  if (branch.parentCafeId) {
    throw new Error('Branch cafe already belongs to a different parent — remove it first')
  }
  const branchHasOwnBranches = await prisma.cafe.count({ where: { parentCafeId: branchCafeId } })
  if (branchHasOwnBranches > 0) {
    throw new Error('Branch cafe already has its own branches — flat hierarchy only')
  }

  await prisma.cafe.update({ where: { id: branchCafeId }, data: { parentCafeId } })

  publishStandardEvent('BranchAdded', {
    tenantId: parentCafeId, resourceId: branchCafeId, actor: performedBy, metadata: {},
  }, 'branches')

  return listBranches(parentCafeId)
}

// ─── Unlink a branch ─────────────────────────────────────────────────────────
export async function removeBranch(branchCafeId: string, performedBy = 'system') {
  const branch = await getCafeOrThrow(branchCafeId)
  if (!branch.parentCafeId) throw new Error('Cafe is not a branch of any parent')

  const parentCafeId = branch.parentCafeId
  await prisma.cafe.update({ where: { id: branchCafeId }, data: { parentCafeId: null } })

  publishStandardEvent('BranchRemoved', {
    tenantId: parentCafeId, resourceId: branchCafeId, actor: performedBy, metadata: {},
  }, 'branches')

  return true
}

// ─── List a branch group (parent + all branches) ────────────────────────────
export async function listBranches(parentCafeId: string) {
  const [parent, branches] = await Promise.all([
    prisma.cafe.findUnique({ where: { id: parentCafeId }, select: { id: true, name: true, subdomain: true, city: true } }),
    prisma.cafe.findMany({
      where:  { parentCafeId },
      select: { id: true, name: true, subdomain: true, city: true },
    }),
  ])
  if (!parent) throw new Error(`Cafe ${parentCafeId} not found`)
  return { parent, branches }
}

// ─── Branch group reporting ──────────────────────────────────────────────────
// Basic order-count/revenue rollup per branch + group total. Deliberately
// does not duplicate the fuller stats logic in routes/adminStats.ts (margins,
// weekly/monthly breakdowns) — that stays single-cafe and untouched; this is
// a thin new cross-branch aggregation using the same paid-order convention.
export interface BranchReportRow {
  cafeId:      string
  name:        string
  orderCount:  number
  revenue:     number
}

export async function getBranchGroupReport(
  parentCafeId: string,
  from?: Date,
  to?:   Date,
): Promise<{ branches: BranchReportRow[]; totalOrders: number; totalRevenue: number }> {
  const { parent, branches } = await listBranches(parentCafeId)
  const allCafes = [parent, ...branches]

  const dateFilter = (from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}

  const rows: BranchReportRow[] = await Promise.all(
    allCafes.map(async (cafe) => {
      const where = { cafeId: cafe.id, isPaid: true, ...dateFilter }
      const [orderCount, agg] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.aggregate({ where, _sum: { totalPrice: true } }),
      ])
      return { cafeId: cafe.id, name: cafe.name, orderCount, revenue: agg._sum.totalPrice ?? 0 }
    }),
  )

  return {
    branches:     rows,
    totalOrders:  rows.reduce((s, r) => s + r.orderCount, 0),
    totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
  }
}
