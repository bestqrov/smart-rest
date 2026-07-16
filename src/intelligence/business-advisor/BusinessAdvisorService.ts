// ─── Business Advisor v1 — Service Registration (K53) ──────────────────────
// Registers the actual "business-advisor" AdvisorDefinition K46 shipped
// zero of (Foundation only) — ties it to a minimal K40 framework agent so
// the object model is complete, while the real content (unified summary,
// health score, issues, opportunities) is delivered through direct calls
// to getUnifiedBusinessSummary, not through the agent's void-returning
// handle(). Same "registerBuiltin*" idiom as K32/K42/K52.

import { registerFrameworkAgent } from '../agents'
import { registerAdvisorCapability, registerAdvisor, hasAdvisor } from '../advisor'
import { runRecommendationEngine, registerRecommendationRule, hasRecommendationRule } from '../recommendations'
import { BUILTIN_OPPORTUNITY_RULES } from './OpportunityRules'

const AGENT_ID = 'business-advisor-agent'
const ADVISOR_ID = 'business-advisor'

function registerBuiltinOpportunityRules(): void {
  for (const rule of BUILTIN_OPPORTUNITY_RULES) {
    if (!hasRecommendationRule(rule.id)) registerRecommendationRule(rule)
  }
}

function registerBusinessAdvisorAgent(): void {
  registerFrameworkAgent({
    id: AGENT_ID, name: 'Business Advisor Agent', module: 'business-advisor',
    events: ['OrderCompleted', 'ReviewSubmitted', 'StockLow', 'ReservationNoShow'],
    capabilities: ['recommendation:read', 'recommendation:create', 'insight:read'],
    permissions: { capabilities: ['recommendation:read', 'recommendation:create', 'insight:read'] },
    handle: async (event) => {
      if (!event.tenantId) return
      await runRecommendationEngine(event.tenantId)
    },
  })
}

function registerBusinessAdvisor(): void {
  registerAdvisorCapability('business:summary',    'Unified business summary (health score, issues, opportunities)')
  registerAdvisorCapability('business:health-score', 'Daily business health score')

  if (!hasAdvisor(ADVISOR_ID)) {
    registerAdvisor({
      id: ADVISOR_ID, name: 'Business Advisor', domain: 'business-summary',
      capabilities: ['business:summary', 'business:health-score'],
      agentId: AGENT_ID,
    })
  }
}

export function registerBusinessAdvisorV1(): void {
  registerBuiltinOpportunityRules()
  registerBusinessAdvisorAgent()
  registerBusinessAdvisor()
}

export { getUnifiedBusinessSummary } from './UnifiedBusinessSummary'
export { computeBusinessHealthScore } from './BusinessHealthScore'
export { detectPriorityIssues } from './PriorityIssueDetection'
export { detectOpportunities } from './OpportunityDetection'
export { getRecommendedNextActions } from './NextActions'
