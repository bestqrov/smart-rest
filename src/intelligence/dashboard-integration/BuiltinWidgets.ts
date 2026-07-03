// ─── Smart Intelligence Dashboard Integration — Built-in Widgets (K57) ─────
// Every widget wraps an already-existing function — no recomputation, no
// duplicate dashboard service. Same "registerBuiltin*" idiom used
// throughout this module (K32/K42/K52/K53).

import { computeBusinessHealthScore } from '../business-advisor'
import {
  getExecutiveKpis, getTopPriorities, getCriticalAlerts,
  getRecommendationsSummary, getOpportunitiesSummary,
} from '../executive-dashboard'
import { getAutomationAdvisorSummary } from '../automation-advisor'
import { getIntelligenceNotificationHistory } from '../notification-advisor'
import { checkIntelligenceHealth } from '../observability'
import { getInventoryAdvisorSummary } from '../inventory-advisor'
import { getCustomerAdvisorSummary } from '../customer-advisor'
import { getMarketingAdvisorSummary } from '../marketing-advisor'
import { getReservationAdvisorSummary } from '../reservation-advisor'
import { registerWidget } from './WidgetRegistry'
import type { WidgetDefinition } from './types'

const BUILTIN_WIDGETS: WidgetDefinition[] = [
  {
    id: 'business-health-score', module: 'business-advisor', name: 'Business Health Score',
    type: 'stat', size: 'sm', visibleToRoles: ['admin'], tenantScoped: true,
    getData: (tenantId) => computeBusinessHealthScore(tenantId!),
  },
  {
    id: 'executive-kpis', module: 'executive-dashboard', name: 'Executive KPIs',
    type: 'table', size: 'lg', visibleToRoles: ['admin'], tenantScoped: true,
    getData: (tenantId) => getExecutiveKpis(tenantId!),
  },
  {
    id: 'top-priorities', module: 'executive-dashboard', name: 'Top Priorities',
    type: 'list', size: 'md', visibleToRoles: ['admin'], tenantScoped: true,
    getData: (tenantId) => getTopPriorities(tenantId!),
  },
  {
    id: 'critical-alerts', module: 'executive-dashboard', name: 'Critical Alerts',
    type: 'list', size: 'md', visibleToRoles: ['admin', 'staff'], tenantScoped: true,
    getData: (tenantId) => getCriticalAlerts(tenantId!),
  },
  {
    id: 'recommendations-summary', module: 'executive-dashboard', name: 'Recommendations Summary',
    type: 'stat', size: 'sm', visibleToRoles: ['admin'], tenantScoped: true,
    getData: (tenantId) => getRecommendationsSummary(tenantId!),
  },
  {
    id: 'opportunities-summary', module: 'executive-dashboard', name: 'Opportunities Summary',
    type: 'stat', size: 'sm', visibleToRoles: ['admin'], tenantScoped: true,
    getData: (tenantId) => getOpportunitiesSummary(tenantId!),
  },
  {
    id: 'automation-advisor-summary', module: 'automation-advisor', name: 'Automation Opportunities',
    type: 'list', size: 'md', visibleToRoles: ['admin'], tenantScoped: true,
    getData: (tenantId) => getAutomationAdvisorSummary(tenantId!),
  },
  {
    id: 'notification-history', module: 'notification-advisor', name: 'Recent Notifications',
    type: 'list', size: 'md', visibleToRoles: ['admin', 'staff'], tenantScoped: true,
    getData: (tenantId) => getIntelligenceNotificationHistory(tenantId!),
  },
  {
    id: 'intelligence-platform-health', module: 'observability', name: 'Intelligence Platform Health',
    type: 'stat', size: 'sm', visibleToRoles: ['system'], tenantScoped: false,
    getData: () => checkIntelligenceHealth(),
  },
  {
    id: 'inventory-advisor-summary', module: 'inventory-advisor', name: 'Inventory Advisor',
    type: 'list', size: 'md', visibleToRoles: ['admin', 'staff'], tenantScoped: true,
    getData: (tenantId) => getInventoryAdvisorSummary(tenantId!),
  },
  {
    id: 'customer-advisor-summary', module: 'customer-advisor', name: 'Customer Advisor',
    type: 'list', size: 'md', visibleToRoles: ['admin', 'staff'], tenantScoped: true,
    getData: (tenantId) => getCustomerAdvisorSummary(tenantId!),
  },
  {
    id: 'marketing-advisor-summary', module: 'marketing-advisor', name: 'Marketing Advisor',
    type: 'list', size: 'md', visibleToRoles: ['admin'], tenantScoped: true,
    getData: (tenantId) => getMarketingAdvisorSummary(tenantId!),
  },
  {
    id: 'reservation-advisor-summary', module: 'reservation-advisor', name: 'Reservation Advisor',
    type: 'list', size: 'md', visibleToRoles: ['admin', 'staff'], tenantScoped: true,
    getData: (tenantId) => getReservationAdvisorSummary(tenantId!),
  },
]

export function registerBuiltinIntelligenceWidgets(): void {
  for (const widget of BUILTIN_WIDGETS) {
    registerWidget(widget)
  }
}
