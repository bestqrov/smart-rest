// ─── Smart Intelligence Event Hub — Event Dispatcher (K30 + K31) ───────────
// Single wildcard subscription to the existing core eventBus (same one used
// by every domain module's publishStandardEvent calls, K11 onward) — routes
// every platform event to whichever registered agents declared interest in
// it. This is the only eventBus.subscribe call in the module; agents never
// subscribe directly, so adding an agent never means adding another
// subscription (unlike analytics/events/EventSubscriber.ts, which
// subscribes per-event because it only cares about a fixed handful).
//
// K31 adds normalization (every event reaches agents in one consistent
// shape regardless of how the publisher called eventBus.publish) and a
// best-effort persistence hook (never blocks agent dispatch on write failure).

import { eventBus } from '../core'
import type { PlatformEvent } from '../core'
import logger from '../logger'
import { getAgentsForEvent } from './AgentRegistry'
import { normalizeEvent } from './EventNormalizer'
import { persistEvent } from './EventPersistence'
import { registerBuiltinDataAdapters } from './data/adapters'
import { registerDataHubKnowledgeSource } from './knowledge/KnowledgeEngine'
import { initAIProviderBridge } from './ai/AIProviderBridge'
import { registerBusinessSkillsPack } from './business-skills'
import { registerBusinessAdvisorV1 } from './business-advisor'
import { registerNotificationAdvisorAgent } from './notification-advisor'
import { registerBuiltinIntelligenceWidgets } from './dashboard-integration'
import { registerInventoryAdvisorAgent } from './inventory-advisor'
import { registerCustomerAdvisorAgent } from './customer-advisor'

let initialized = false

export async function dispatch(event: PlatformEvent): Promise<void> {
  const normalized = normalizeEvent(event)

  // Best-effort: a persistence failure must never block agent notification.
  persistEvent(normalized).catch(() => undefined)

  const agents = getAgentsForEvent(normalized.eventName)
  if (agents.length === 0) return

  await Promise.all(agents.map(async (agent) => {
    try {
      await agent.handle(normalized)
    } catch (err) {
      logger.error({ msg: '[Intelligence] agent handler failed', agentId: agent.id, event: normalized.eventName, err })
    }
  }))
}

export function initIntelligenceCore(): void {
  if (initialized) return
  eventBus.subscribe('*', dispatch)
  registerBuiltinDataAdapters()
  registerDataHubKnowledgeSource()
  initAIProviderBridge()
  registerBusinessSkillsPack()
  registerBusinessAdvisorV1()
  registerNotificationAdvisorAgent()
  registerInventoryAdvisorAgent()
  registerCustomerAdvisorAgent()
  registerBuiltinIntelligenceWidgets()
  initialized = true
  logger.info({ msg: '[Intelligence] Core initialized — subscribed to all platform events, data adapters + knowledge sources + AI provider bridge + business skills pack + business advisor v1 + notification advisor + inventory advisor + customer advisor + dashboard widgets registered' })
}
