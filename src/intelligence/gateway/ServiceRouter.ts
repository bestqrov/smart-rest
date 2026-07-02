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

export function getOperation(id: string): GatewayOperation | undefined {
  return operations.get(id)
}

export function getAllOperations(): GatewayOperation[] {
  return [...operations.values()]
}
