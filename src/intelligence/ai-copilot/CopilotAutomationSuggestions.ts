// ─── Smart Intelligence AI Copilot — Automation Suggestions (K70) ──────────
// Reuses K54's detectAutomationOpportunities/generateAutomationRecommendations
// directly — no second opportunity scan.

import { detectAutomationOpportunities, generateAutomationRecommendations } from '../automation-advisor'
import type { AutomationOpportunity, AutomationRecommendation } from '../automation-advisor'

export interface CopilotAutomationSuggestions {
  opportunities:   AutomationOpportunity[]
  recommendations: AutomationRecommendation[]
}

export async function suggestCopilotAutomations(tenantId: string): Promise<CopilotAutomationSuggestions> {
  const [opportunities, recommendations] = await Promise.all([
    detectAutomationOpportunities(tenantId),
    generateAutomationRecommendations(tenantId),
  ])
  return { opportunities, recommendations }
}
