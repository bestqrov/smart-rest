// ─── Smart Intelligence API Gateway — Service Routing (K50) ────────────────
// One routing table mapping a service id to an already-existing
// Intelligence module's read/discovery function — no new listing logic,
// no duplicate endpoints for what each module already exposes internally.

import { getAllFrameworkAgents } from '../agents'
import { discoverSkills } from '../skills'
import { resolveCapabilitiesForTenant } from '../capabilities'
import { getAllWorkflows } from '../orchestrator'
import { listAdvisors } from '../advisor'
import { getAllRuntimeStats } from '../runtime'
import {
  checkIntelligenceHealth, getIntelligenceDashboardMetrics,
  getProviderPerformanceMetrics, getRecentIntelligenceErrors,
} from '../observability'
import { getBusinessInsightsSummary } from '../business-skills'
import { getUnifiedBusinessSummary } from '../business-advisor'
import { getAutomationAdvisorSummary } from '../automation-advisor'
import { getExecutiveDashboard } from '../executive-dashboard'
import { getIntelligenceNotificationHistory } from '../notification-advisor'
import { getIntelligenceOverview } from '../dashboard-integration'
import { checkAIReadiness } from '../ai-readiness'
import { getInventoryAdvisorSummary } from '../inventory-advisor'
import { getCustomerAdvisorSummary } from '../customer-advisor'
import { getMarketingAdvisorSummary } from '../marketing-advisor'
import { getReservationAdvisorSummary } from '../reservation-advisor'
import { getStaffAdvisorSummary } from '../staff-advisor'
import { getFinancialAdvisorSummary } from '../financial-advisor'
import { getExecutiveBriefing } from '../executive-ai-advisor'
import type { GatewayOperation } from './types'

const operations = new Map<string, GatewayOperation>()

function register(op: GatewayOperation): void {
  operations.set(op.id, op)
}

register({ id: 'agents',         version: 'v1', summary: 'List registered Agent Framework agents (K40)', path: '/agents',         handler: () => getAllFrameworkAgents() })
register({ id: 'skills',         version: 'v1', summary: 'Discover current-version Skills (K47)',         path: '/skills',         handler: () => discoverSkills() })
register({ id: 'capabilities',   version: 'v1', summary: 'Resolve active Capabilities for a tenant (K49)', path: '/capabilities',  handler: (ctx) => resolveCapabilitiesForTenant(ctx.tenantId) })
register({ id: 'workflows',      version: 'v1', summary: 'List registered Orchestrator workflows (K48)',  path: '/workflows',      handler: () => getAllWorkflows() })
register({ id: 'advisors',       version: 'v1', summary: 'List registered Business Advisors (K46)',       path: '/advisors',       handler: () => listAdvisors() })
register({ id: 'runtime-stats',  version: 'v1', summary: 'Agent Runtime execution stats (K45)',           path: '/runtime-stats',  handler: () => getAllRuntimeStats() })
register({ id: 'health',         version: 'v1', summary: 'Intelligence module health (K51)',               path: '/health',         handler: () => checkIntelligenceHealth() })
register({ id: 'dashboard',      version: 'v1', summary: 'Intelligence dashboard metrics snapshot (K51)',   path: '/dashboard',      handler: () => getIntelligenceDashboardMetrics() })
register({ id: 'provider-performance', version: 'v1', summary: 'AI provider performance over a time window (K51)', path: '/provider-performance', handler: () => getProviderPerformanceMetrics() })
register({ id: 'errors',         version: 'v1', summary: 'Recent aggregated Intelligence errors (K51)',     path: '/errors',         handler: () => getRecentIntelligenceErrors() })
register({
  id: 'business-insights', version: 'v1', summary: 'Business Skills Pack insights dashboard summary (K52)', path: '/business-insights',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the business-insights service')
    return getBusinessInsightsSummary(ctx.tenantId)
  },
})
register({
  id: 'business-advisor', version: 'v1', summary: 'Business Advisor v1 unified summary (K53)', path: '/business-advisor',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the business-advisor service')
    return getUnifiedBusinessSummary(ctx.tenantId)
  },
})
register({
  id: 'automation-advisor', version: 'v1', summary: 'Automation Advisor summary — opportunities, readiness, pending approvals (K54)', path: '/automation-advisor',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the automation-advisor service')
    return getAutomationAdvisorSummary(ctx.tenantId)
  },
})
register({
  id: 'executive-dashboard', version: 'v1', summary: 'Executive Dashboard — health, KPIs, priorities, alerts, timeline (K55)', path: '/executive-dashboard',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the executive-dashboard service')
    return getExecutiveDashboard(ctx.tenantId)
  },
})
register({
  id: 'notifications', version: 'v1', summary: 'Intelligence notification history for a tenant (K56)', path: '/notifications',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the notifications service')
    return getIntelligenceNotificationHistory(ctx.tenantId)
  },
})
register({
  id: 'intelligence-overview', version: 'v1', summary: 'Combined Executive Dashboard + widget bundle for a tenant (K57)', path: '/intelligence-overview',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the intelligence-overview service')
    return getIntelligenceOverview(ctx.tenantId)
  },
})
register({
  id: 'ai-readiness', version: 'v1', summary: 'AI Readiness report — provider/prompt/context/capability checks, never invokes an LLM (K58)', path: '/ai-readiness',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the ai-readiness service')
    return checkAIReadiness(ctx.tenantId, {
      promptKey:  ctx.query['promptKey'],
      providerId: ctx.query['providerId'],
      modelId:    ctx.query['modelId'],
    })
  },
})
register({
  id: 'inventory-advisor', version: 'v1', summary: 'Inventory Advisor — low/out-of-stock, slow/fast movers, overstock, reorder suggestions (K60)', path: '/inventory-advisor',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the inventory-advisor service')
    return getInventoryAdvisorSummary(ctx.tenantId)
  },
})
register({
  id: 'customer-advisor', version: 'v1', summary: 'Customer Advisor — segments, churn risk, LTV, retention actions (K61)', path: '/customer-advisor',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the customer-advisor service')
    return getCustomerAdvisorSummary(ctx.tenantId)
  },
})
register({
  id: 'marketing-advisor', version: 'v1', summary: 'Marketing Advisor — channel performance, best posting times, ROI estimates, promotions, targeting (K62)', path: '/marketing-advisor',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the marketing-advisor service')
    return getMarketingAdvisorSummary(ctx.tenantId)
  },
})
register({
  id: 'reservation-advisor', version: 'v1', summary: 'Reservation Advisor — trend, peak prediction, no-show/cancellation analysis, table utilization (K63)', path: '/reservation-advisor',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the reservation-advisor service')
    return getReservationAdvisorSummary(ctx.tenantId)
  },
})
register({
  id: 'staff-advisor', version: 'v1', summary: 'Staff Advisor — performance, productivity, workload, peak staffing, overtime, attendance, training (K64)', path: '/staff-advisor',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the staff-advisor service')
    return getStaffAdvisorSummary(ctx.tenantId)
  },
})
register({
  id: 'financial-advisor', version: 'v1', summary: 'Financial Advisor — revenue, profit, expenses, cash flow, AOV, margins, cost optimization, health score (K65)', path: '/financial-advisor',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the financial-advisor service')
    return getFinancialAdvisorSummary(ctx.tenantId)
  },
})
register({
  id: 'executive-ai-advisor', version: 'v1', summary: 'Executive AI Advisor — unified health score, top priorities, critical alerts, cross-module opportunities/risks, action plan (K66)', path: '/executive-ai-advisor',
  handler: (ctx) => {
    if (!ctx.tenantId) throw new Error('tenantId query parameter is required for the executive-ai-advisor service')
    return getExecutiveBriefing(ctx.tenantId)
  },
})

export function getOperation(id: string): GatewayOperation | undefined {
  return operations.get(id)
}

export function getAllOperations(): GatewayOperation[] {
  return [...operations.values()]
}
