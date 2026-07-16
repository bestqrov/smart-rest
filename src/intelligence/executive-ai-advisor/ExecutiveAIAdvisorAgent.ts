// ─── Smart Intelligence Executive AI Advisor v1 — Reactive Bridge (K66) ────
// One K40 framework agent (same reactive-agent idiom as K53/K60-K65's
// siblings) that keeps the cached executive briefing fresh. Pure
// aggregation only — this agent never runs a Recommendation Engine pass
// or creates new business data itself; every domain advisor's own agent
// already does that for its own module.

import { registerFrameworkAgent } from '../agents'
import { getExecutiveBriefing } from './ExecutiveAIAdvisorService'

const AGENT_ID = 'executive-ai-advisor-agent'

export function registerExecutiveAIAdvisorAgent(): void {
  registerFrameworkAgent({
    id: AGENT_ID, name: 'Executive AI Advisor Agent', module: 'executive-ai-advisor',
    events: ['OrderCompleted', 'PosOrderClosed'],
    capabilities: ['insight:read', 'recommendation:read'],
    permissions: { capabilities: ['insight:read', 'recommendation:read'] },
    handle: async (event) => {
      if (!event.tenantId) return
      await getExecutiveBriefing(event.tenantId)
    },
  })
}
