// ─── Smart Intelligence Business Advisor — Session Context (K46) ───────────
// Composes K33's tenant/business context with a short-lived conversation
// history, stored through K44's Memory Engine (no new storage) under a
// dedicated "advisor-session" namespace — registered once here, not a new
// persisted table.

import { getContextForTenant, type IntelligenceContext } from '../context'
import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'

const NAMESPACE   = 'advisor-session'
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes of conversational continuity

export function ensureAdvisorSessionNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: SESSION_TTL_MS,
    description: 'Business Advisor conversation turns, ephemeral per session',
  })
}

interface SessionTurn {
  question: string
  content?: string
  status:   string
  at:       string
}

function sessionKey(advisorId: string, sessionId: string): string {
  return `${advisorId}:${sessionId}`
}

export interface AdvisorSessionContext {
  context: IntelligenceContext
  history: SessionTurn[]
}

export async function getAdvisorSessionContext(
  tenantId: string, advisorId: string, sessionId: string,
): Promise<AdvisorSessionContext> {
  ensureAdvisorSessionNamespace()

  const [context, raw] = await Promise.all([
    getContextForTenant(tenantId),
    recall(tenantId, NAMESPACE, sessionKey(advisorId, sessionId)),
  ])

  const history: SessionTurn[] = typeof raw === 'string' ? safeParse(raw) : []
  return { context, history }
}

export async function appendAdvisorSessionTurn(
  tenantId: string, advisorId: string, sessionId: string, turn: SessionTurn,
): Promise<void> {
  ensureAdvisorSessionNamespace()

  const key = sessionKey(advisorId, sessionId)
  const raw = await recall(tenantId, NAMESPACE, key)
  const history: SessionTurn[] = typeof raw === 'string' ? safeParse(raw) : []
  history.push(turn)

  await remember(tenantId, NAMESPACE, key, JSON.stringify(history.slice(-20)))
}

function safeParse(raw: string): SessionTurn[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
