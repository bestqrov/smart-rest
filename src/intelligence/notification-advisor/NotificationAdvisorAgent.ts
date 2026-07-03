// ─── Smart Intelligence Notification Advisor — Reactive Bridge (K56) ───────
// Registers one K40 framework agent that turns K36 Insight / K35
// Recommendation creation events into notifications via notify() — same
// "registerBuiltin*"/reactive-agent idiom as K53's business-advisor-agent.
// Rule-based mapping only, no AI.

import { registerFrameworkAgent } from '../agents'
import { getInsight } from '../insights'
import { getRecommendation } from '../recommendations'
import { notify } from './IntelligenceNotificationService'
import { priorityFromInsightSeverity, priorityFromRecommendationPriority } from './NotificationPriorityEngine'

const AGENT_ID = 'notification-advisor-agent'

export function registerNotificationAdvisorAgent(): void {
  registerFrameworkAgent({
    id: AGENT_ID, name: 'Notification Advisor Agent', module: 'notification-advisor',
    events: ['IntelInsightCreated', 'IntelRecommendationCreated'],
    capabilities: ['insight:read', 'recommendation:read'],
    permissions: { capabilities: ['insight:read', 'recommendation:read'] },
    handle: async (event) => {
      if (!event.tenantId) return

      if (event.eventName === 'IntelInsightCreated' && event.resourceId) {
        const insight = await getInsight(event.resourceId)
        if (!insight) return
        await notify({
          tenantId: event.tenantId, category: 'insight', priority: priorityFromInsightSeverity(insight.severity),
          title: insight.title, message: insight.description, module: insight.category, entityId: insight.id,
          dedupeKey: `insight:${insight.ruleId}`, groupKey: `insight:${insight.category}`,
        })
        return
      }

      if (event.eventName === 'IntelRecommendationCreated' && event.resourceId) {
        const recommendation = await getRecommendation(event.resourceId)
        if (!recommendation) return
        await notify({
          tenantId: event.tenantId, category: 'recommendation', priority: priorityFromRecommendationPriority(recommendation.priority),
          title: recommendation.title, message: recommendation.description, module: recommendation.category, entityId: recommendation.id,
          dedupeKey: `recommendation:${recommendation.ruleId}`, groupKey: `recommendation:${recommendation.category}`,
        })
      }
    },
  })
}
