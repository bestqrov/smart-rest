// ─── Smart Intelligence Dashboard Integration — Public API (K57) ───────────

export type { WidgetType, WidgetSize, WidgetDefinition, DashboardLayoutSection, DashboardLayoutConfig, WidgetResult } from './types'

export { registerWidget, getWidget, getAllWidgets, getWidgetsByModule } from './WidgetRegistry'

export { filterWidgetsForRole } from './WidgetVisibility'

export { resolveDashboardTenantId } from './TenantBranchFiltering'

export { getWidgetData, refreshWidget, getDashboardData } from './WidgetRefreshService'

export { registerBuiltinIntelligenceWidgets } from './BuiltinWidgets'

export { DEFAULT_DASHBOARD_LAYOUT, getDashboardLayout, setDashboardLayout } from './DashboardLayoutConfig'

export { getIntelligenceOverview, type IntelligenceOverview } from './ExecutiveDashboardIntegration'
