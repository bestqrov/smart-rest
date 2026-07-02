// ─── Smart Intelligence Core — Event Dispatcher (K30 Foundation) ───────────
// Single wildcard subscription to the existing core eventBus (same one used
// by every domain module's publishStandardEvent calls, K11 onward) — routes
// every platform event to whichever registered agents declared interest in
// it. This is the only eventBus.subscribe call in the module; agents never
// subscribe directly, so adding an agent never means adding another
// subscription (unlike analytics/events/EventSubscriber.ts, which
// subscribes per-event because it only cares about a fixed handful).

import { eventBus } from '../core'
import type { PlatformEvent } from '../core'
import logger from '../logger'
import { getAgentsForEvent } from './AgentRegistry'

let initialized = false

async function dispatch(event: PlatformEvent): Promise<void> {
  const agents = getAgentsForEvent(event.name)
  if (agents.length === 0) return

  await Promise.all(agents.map(async (agent) => {
    try {
      await agent.handle(event)
    } catch (err) {
      logger.error({ msg: '[Intelligence] agent handler failed', agentId: agent.id, event: event.name, err })
    }
  }))
}

export function initIntelligenceCore(): void {
  if (initialized) return
  eventBus.subscribe('*', dispatch)
  initialized = true
  logger.info({ msg: '[Intelligence] Core initialized — subscribed to all platform events' })
}
