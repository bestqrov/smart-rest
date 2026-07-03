// ─── Smart Intelligence Dashboard Integration — Layout Configuration (K57) ─
// A built-in default layout plus optional per-tenant overrides stored via
// K44's long-term Memory Engine (the K39 Knowledge Engine) — no new table.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import type { DashboardLayoutConfig } from './types'

const NAMESPACE = 'dashboard-layout'
const KEY = 'layout'

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutConfig = {
  id: 'default', name: 'Default Intelligence Dashboard',
  sections: [
    { id: 'overview',    title: 'Overview',    widgetIds: ['business-health-score', 'executive-kpis'] },
    { id: 'priorities',  title: 'Priorities',  widgetIds: ['top-priorities', 'critical-alerts'] },
    { id: 'growth',      title: 'Growth',      widgetIds: ['recommendations-summary', 'opportunities-summary'] },
    { id: 'automation',  title: 'Automation',  widgetIds: ['automation-advisor-summary'] },
    { id: 'inventory',   title: 'Inventory',   widgetIds: ['inventory-advisor-summary'] },
    { id: 'customers',   title: 'Customers',   widgetIds: ['customer-advisor-summary'] },
    { id: 'marketing',   title: 'Marketing',   widgetIds: ['marketing-advisor-summary'] },
    { id: 'reservations', title: 'Reservations', widgetIds: ['reservation-advisor-summary'] },
    { id: 'staff',       title: 'Staff',        widgetIds: ['staff-advisor-summary'] },
    { id: 'finance',     title: 'Finance',      widgetIds: ['financial-advisor-summary'] },
    { id: 'activity',    title: 'Activity',    widgetIds: ['notification-history'] },
  ],
}

function ensureLayoutNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'LONG_TERM', ttlMs: 0,
    description: 'Per-tenant Intelligence dashboard layout overrides',
  })
}

export async function getDashboardLayout(tenantId: string): Promise<DashboardLayoutConfig> {
  ensureLayoutNamespace()
  const raw = await recall(tenantId, NAMESPACE, KEY)
  if (typeof raw !== 'string') return DEFAULT_DASHBOARD_LAYOUT

  try {
    return JSON.parse(raw) as DashboardLayoutConfig
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT
  }
}

export async function setDashboardLayout(tenantId: string, layout: DashboardLayoutConfig): Promise<void> {
  ensureLayoutNamespace()
  await remember(tenantId, NAMESPACE, KEY, JSON.stringify(layout))
}
