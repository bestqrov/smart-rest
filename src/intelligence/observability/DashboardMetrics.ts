// ─── Smart Intelligence Observability — Dashboard Metrics (K51) ────────────
// One snapshot combining counts already exposed by each module's own
// discovery/list functions — no new counting logic per module.

import { getAllFrameworkAgents, getAgentHealth } from '../agents'
import { listSkillIds, getSkillHealth } from '../skills'
import { listCapabilities } from '../capabilities'
import { getAllWorkflows } from '../orchestrator'
import { listAdvisors } from '../advisor'
import { hasActiveProvider, listActiveProviders } from '../ai'
import type { IntelligenceDashboardMetrics } from './types'

export function getIntelligenceDashboardMetrics(): IntelligenceDashboardMetrics {
  const agents = getAllFrameworkAgents()
  const skillIds = listSkillIds()
  const capabilities = listCapabilities()

  return {
    agents: {
      total:  agents.length,
      active: agents.filter(a => getAgentHealth(a.id)?.status === 'ACTIVE').length,
      error:  agents.filter(a => getAgentHealth(a.id)?.status === 'ERROR').length,
    },
    skills: {
      total: skillIds.length,
      error: skillIds.filter(id => getSkillHealth(id)?.status === 'ERROR').length,
    },
    capabilities: {
      total:  capabilities.length,
      active: capabilities.filter(c => c.status === 'ACTIVE').length,
    },
    workflows:   { total: getAllWorkflows().length },
    advisors:    { total: listAdvisors().length },
    providers:   { active: listActiveProviders().length, hasActive: hasActiveProvider() },
    generatedAt: new Date(),
  }
}
