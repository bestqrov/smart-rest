// ─── Smart Intelligence Observability — Health Check (K51) ─────────────────
// Shaped as ModuleHealth (ops/types) so it can be added directly into
// ops/health/HealthService.ts's existing Promise.all — the Intelligence
// module becomes one more entry in the platform's one health check API,
// not a second one.

import { getAllFrameworkAgents, getAgentHealth } from '../agents'
import { listSkillIds, getSkillHealth } from '../skills'
import { hasActiveProvider, listActiveProviders } from '../ai'
import type { ModuleHealth, HealthStatus } from '../../ops/types'

export async function checkIntelligenceHealth(): Promise<ModuleHealth> {
  const start = Date.now()
  try {
    const agents = getAllFrameworkAgents()
    const agentErrors = agents.filter(a => getAgentHealth(a.id)?.status === 'ERROR').length

    const skillIds = listSkillIds()
    const skillErrors = skillIds.filter(id => getSkillHealth(id)?.status === 'ERROR').length

    const providerCount = listActiveProviders().length
    const providerOk = hasActiveProvider()

    let status: HealthStatus = 'healthy'
    if (!providerOk) status = 'warning'
    if (agentErrors > 0 || skillErrors > 0) status = 'warning'
    if (agents.length > 0 && agentErrors === agents.length) status = 'critical'

    return {
      module: 'intelligence', label: 'Smart Intelligence',
      status, latencyMs: Date.now() - start,
      message: `${agents.length} agents (${agentErrors} errored), ${skillIds.length} skills (${skillErrors} errored), ${providerCount} active AI providers`,
      checkedAt: new Date(),
      details: { agentCount: agents.length, agentErrors, skillCount: skillIds.length, skillErrors, activeProviders: providerCount },
    }
  } catch (err) {
    return {
      module: 'intelligence', label: 'Smart Intelligence',
      status: 'unavailable', latencyMs: Date.now() - start,
      message: (err as Error).message, checkedAt: new Date(),
    }
  }
}
