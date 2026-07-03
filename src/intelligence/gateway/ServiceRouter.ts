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

export function getOperation(id: string): GatewayOperation | undefined {
  return operations.get(id)
}

export function getAllOperations(): GatewayOperation[] {
  return [...operations.values()]
}
