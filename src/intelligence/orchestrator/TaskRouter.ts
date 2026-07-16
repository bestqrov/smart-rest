// ─── Smart Intelligence Orchestrator — Task Routing (K48) ──────────────────
// Routes a single workflow step to the one existing engine that already
// owns that kind of work — no new execution logic, no bypassing the
// "never auto-run" boundaries K37/K38 already enforce (ACTION steps only
// enqueue, DECISION_EXECUTE only queues the linked action, same as calling
// those engines directly).

import crypto from 'crypto'
import { categorizeEvent } from '../EventCategoryRegistry'
import type { NormalizedIntelligenceEvent } from '../types'
import { runAgentNow } from '../runtime'
import { invokeSkill } from '../skills'
import { enqueueAction } from '../actions'
import { evaluateDecisions, executeDecision } from '../decisions'
import type { ExecuteWorkflowContext, WorkflowStepDefinition } from './types'

function dispatchEvent(tenantId: string, stepId: string, targetId: string | undefined, input: Record<string, unknown> | undefined): NormalizedIntelligenceEvent {
  return {
    eventId:    crypto.randomUUID(),
    eventName:  'IntelWorkflowStepDispatched',
    module:     categorizeEvent('IntelWorkflowStepDispatched'),
    tenantId,
    actor:      'workflow-orchestrator',
    resourceId: targetId ?? stepId,
    source:     'workflow-orchestrator',
    timestamp:  new Date(),
    metadata:   { stepId, input: input ?? {} },
    raw:        null,
  }
}

export async function routeStep(step: WorkflowStepDefinition, ctx: ExecuteWorkflowContext): Promise<unknown> {
  switch (step.kind) {
    case 'AGENT': {
      if (!step.targetId) throw new Error(`Intelligence: workflow step "${step.id}" (AGENT) requires targetId`)
      const event = dispatchEvent(ctx.tenantId, step.id, step.targetId, step.input)
      return runAgentNow(step.targetId, event)
    }
    case 'SKILL': {
      if (!step.targetId) throw new Error(`Intelligence: workflow step "${step.id}" (SKILL) requires targetId`)
      return invokeSkill(step.targetId, step.input, { tenantId: ctx.tenantId, callerId: ctx.callerId })
    }
    case 'ACTION': {
      if (!step.targetId) throw new Error(`Intelligence: workflow step "${step.id}" (ACTION) requires targetId`)
      return enqueueAction(ctx.tenantId, step.targetId, step.input, 'MANUAL')
    }
    case 'DECISION_EVALUATE': {
      return evaluateDecisions(ctx.tenantId, ctx.performedBy)
    }
    case 'DECISION_EXECUTE': {
      if (!step.targetId) throw new Error(`Intelligence: workflow step "${step.id}" (DECISION_EXECUTE) requires targetId`)
      return executeDecision(step.targetId, ctx.performedBy)
    }
    default: {
      const exhaustive: never = step.kind
      throw new Error(`Intelligence: unknown workflow step kind "${exhaustive}"`)
    }
  }
}
