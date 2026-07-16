// ─── Smart Intelligence Automation Advisor — Action Plan Generation (K54) ──
// Advisory preview only — describes what a human would need to do; does
// not register a Workflow (K48) or an ActionExecutor (K37).

import type { AutomationActionPlan, AutomationOpportunity } from './types'

export function generateActionPlan(opportunity: AutomationOpportunity): AutomationActionPlan {
  return {
    opportunity,
    steps: [
      { order: 1, description: `Review the ${opportunity.occurrences} recent "${opportunity.ruleId}" occurrences to confirm the pattern is consistent.` },
      { order: 2, description: `Register a K37 Action Executor for the "${opportunity.category}" category if one does not already exist.` },
      { order: 3, description: `Propose the automation for approval (creates a PENDING Decision — K38).` },
      { order: 4, description: `An authorized user reviews and approves the Decision.` },
      { order: 5, description: `executeDecision queues the linked Action — it still requires an explicit runAction call, never auto-run.` },
    ],
  }
}
