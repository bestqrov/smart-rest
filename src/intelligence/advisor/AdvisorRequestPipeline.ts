// ─── Smart Intelligence Business Advisor — Request Pipeline (K46) ──────────
// Execution goes through K45's Agent Runtime — no second execution path.
// K40's AgentEventHandler returns void, so there is no plumbing yet for an
// agent to hand back generated text; response.content is always undefined
// until a future sprint extends that contract. That is intentional here:
// this pipeline proves the request can be built, dispatched, and audited,
// without generating any business advice.

import crypto from 'crypto'
import { publishStandardEvent, AuditService } from '../../core'
import { categorizeEvent } from '../EventCategoryRegistry'
import type { NormalizedIntelligenceEvent } from '../types'
import { runAgentNow, type RunAgentOptions } from '../runtime'
import { renderPrompt, type RenderedPrompt } from '../prompts'
import { getAdvisor } from './AdvisorRegistry'
import { getAdvisorSessionContext, appendAdvisorSessionTurn } from './AdvisorSessionContext'
import type { AdvisorRequest, AdvisorResponse, AdvisorResponseStatus } from './types'

function toResponseStatus(runtimeStatus: string): AdvisorResponseStatus {
  if (runtimeStatus === 'COMPLETED') return 'COMPLETED'
  if (runtimeStatus === 'TIMEOUT')   return 'TIMEOUT'
  if (runtimeStatus === 'SKIPPED')   return 'SKIPPED'
  return 'FAILED'
}

export async function processAdvisorRequest(
  request: AdvisorRequest, opts?: RunAgentOptions,
): Promise<AdvisorResponse> {
  const requestId = crypto.randomUUID()
  const createdAt = new Date()
  const def = getAdvisor(request.advisorId)

  if (!def) {
    return {
      requestId, advisorId: request.advisorId, tenantId: request.tenantId, sessionId: request.sessionId,
      status: 'SKIPPED', error: 'advisor not registered', createdAt,
    }
  }

  const session = await getAdvisorSessionContext(request.tenantId, def.id, request.sessionId)

  // Prompt preparation only — never executed here, an advisor agent's own
  // handle() decides whether/how to call the AI Provider Layer with it.
  let preparedPrompt: RenderedPrompt | undefined
  if (def.promptKey) {
    try {
      preparedPrompt = await renderPrompt(def.promptKey, request.tenantId, request.variables ?? {}, true)
    } catch {
      preparedPrompt = undefined
    }
  }

  publishStandardEvent('IntelAdvisorRequested', {
    tenantId: request.tenantId, resourceId: requestId, metadata: { advisorId: def.id, sessionId: request.sessionId },
  }, 'business-advisor')

  const event: NormalizedIntelligenceEvent = {
    eventId:    requestId,
    eventName:  'IntelAdvisorRequested',
    module:     categorizeEvent('IntelAdvisorRequested'),
    tenantId:   request.tenantId,
    actor:      request.performedBy,
    resourceId: def.id,
    source:     'business-advisor',
    timestamp:  createdAt,
    metadata:   { question: request.question, variables: request.variables ?? {}, sessionHistory: session.history, preparedPrompt },
    raw:        request,
  }

  const result = await runAgentNow(def.agentId, event, opts)
  const status = toResponseStatus(result.status)

  await appendAdvisorSessionTurn(request.tenantId, def.id, request.sessionId, {
    question: request.question, status, at: createdAt.toISOString(),
  })

  await AuditService.createAudit({
    module: 'INTELLIGENCE', entity: 'AdvisorRequest', entityId: requestId, action: 'ASK',
    performedBy: request.performedBy, metadata: { advisorId: def.id, tenantId: request.tenantId, status },
  }).catch(() => undefined)

  publishStandardEvent('IntelAdvisorResponded', {
    tenantId: request.tenantId, resourceId: requestId, metadata: { advisorId: def.id, status },
  }, 'business-advisor')

  return {
    requestId, advisorId: def.id, tenantId: request.tenantId, sessionId: request.sessionId,
    status, error: result.error ?? result.reason, createdAt,
  }
}
