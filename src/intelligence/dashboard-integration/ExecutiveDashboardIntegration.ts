// ─── Smart Intelligence Dashboard Integration — Executive Integration (K57) ─
// Combines K55's single-call getExecutiveDashboard (unchanged) with the
// widget framework's role/layout filtering — the Intelligence overview
// endpoint's primary source, not a second aggregation.

import type { UserContext } from '../context'
import { getExecutiveDashboard, type ExecutiveDashboard } from '../executive-dashboard'
import { getAllWidgets } from './WidgetRegistry'
import { filterWidgetsForRole } from './WidgetVisibility'
import { getDashboardData } from './WidgetRefreshService'
import { getDashboardLayout } from './DashboardLayoutConfig'
import type { DashboardLayoutConfig, WidgetResult } from './types'

export interface IntelligenceOverview {
  tenantId:  string
  executive: ExecutiveDashboard
  layout:    DashboardLayoutConfig
  widgets:   WidgetResult[]
}

export async function getIntelligenceOverview(tenantId: string, role: UserContext['type'] = 'admin'): Promise<IntelligenceOverview> {
  const visibleWidgets = filterWidgetsForRole(getAllWidgets(), role)
  const widgetIds = visibleWidgets.map(w => w.id)

  const [executive, layout, widgets] = await Promise.all([
    getExecutiveDashboard(tenantId),
    getDashboardLayout(tenantId),
    getDashboardData(widgetIds, tenantId),
  ])

  return { tenantId, executive, layout, widgets }
}
