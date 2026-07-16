// ─── Smart Intelligence Financial Advisor v1 — Shared Metrics (K65) ────────
// The two shared queries every detector below reuses — no duplicate
// Order/Expense aggregation across the module's bullets. Aggregated in
// JS, same "no groupBy on Mongo" convention K52/K60-K64 already use.

import prisma from '../../prisma'

const DEFAULT_WINDOW_DAYS = 30

function since(windowDays: number): Date {
  return new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
}

export interface RevenueRow {
  totalPrice: number
  createdAt:  Date
}

export interface ExpenseRow {
  amount:   number
  category: string
  date:     Date
}

// isPaid: true — the single revenue definition this module uses, same
// convention K52's RevenueInsightRule already uses (the codebase has
// three inconsistent ones across adminStats.ts/adminExpenses.ts/
// services/billing.ts; this module deliberately picks one).
export async function fetchRevenue(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<RevenueRow[]> {
  return prisma.order.findMany({
    where:  { cafeId: tenantId, isPaid: true, createdAt: { gte: since(windowDays) } },
    select: { totalPrice: true, createdAt: true },
  })
}

export async function fetchExpenses(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<ExpenseRow[]> {
  return prisma.expense.findMany({
    where:  { cafeId: tenantId, date: { gte: since(windowDays) } },
    select: { amount: true, category: true, date: true },
  })
}

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}
