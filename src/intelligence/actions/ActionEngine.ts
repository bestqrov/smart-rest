// ─── Smart Intelligence Action Engine — Core (K37) ─────────────────────────
// Explicit execution only: enqueueAction stores intent (and, per the brief,
// never auto-runs it — not even for mode='AUTOMATIC'); runAction is the one
// function that actually calls an executor, and only ever in response to a
// direct call from other code (a future admin endpoint or an agent decision
// — neither exists yet). Reuses the existing NotificationService (core) for
// failure notifications instead of a new notification path.

import prisma from '../../prisma'
import { publishStandardEvent, NotificationService } from '../../core'
import { getActionExecutor } from './ActionRegistry'
import type { ActionExecutionMode } from './types'

// ─── Queue ──────────────────────────────────────────────────────────────────
export async function enqueueAction(
  tenantId:   string,
  executorId: string,
  input?:     Record<string, unknown>,
  mode:       ActionExecutionMode = 'MANUAL',
) {
  const executor = getActionExecutor(executorId)
  if (!executor) throw new Error(`Intelligence: action executor "${executorId}" is not registered`)

  const action = await prisma.action.create({
    data: {
      tenantId, executorId, mode,
      category: executor.category,
      status:   'QUEUED',
      input:    input ? JSON.stringify(input) : undefined,
    },
  })

  publishStandardEvent('IntelActionQueued', {
    tenantId, resourceId: action.id, metadata: { executorId, mode },
  }, 'action-engine')

  return action
}

// ─── Execution (explicit only — see file header) ───────────────────────────
export async function runAction(actionId: string) {
  const action = await prisma.action.findUniqueOrThrow({ where: { id: actionId } })
  if (action.status !== 'QUEUED') throw new Error(`Action ${actionId} is not QUEUED (status: ${action.status})`)

  const executor = getActionExecutor(action.executorId)
  if (!executor) throw new Error(`Intelligence: action executor "${action.executorId}" is not registered`)

  await prisma.action.update({ where: { id: actionId }, data: { status: 'RUNNING', startedAt: new Date() } })
  publishStandardEvent('IntelActionStarted', { tenantId: action.tenantId, resourceId: actionId, metadata: { executorId: action.executorId } }, 'action-engine')

  const input = action.input ? JSON.parse(action.input) : undefined

  try {
    const result = await executor.execute(action.tenantId, input)

    const updated = await prisma.action.update({
      where: { id: actionId },
      data: {
        status:        result.success ? 'COMPLETED' : 'FAILED',
        resultSuccess: result.success,
        resultMessage: result.message,
        resultData:    result.data ? JSON.stringify(result.data) : undefined,
        completedAt:   new Date(),
      },
    })

    publishStandardEvent(result.success ? 'IntelActionCompleted' : 'IntelActionFailed', {
      tenantId: action.tenantId, resourceId: actionId, metadata: { executorId: action.executorId, message: result.message },
    }, 'action-engine')

    if (!result.success) {
      await NotificationService.createNotification({
        level:    'ERROR',
        title:    `Action failed: ${executor.name}`,
        message:  result.message ?? 'No details provided.',
        module:   'INTELLIGENCE',
        entityId: actionId,
        targetId: action.tenantId,
      }).catch(() => undefined)
    }

    return updated
  } catch (err: any) {
    const updated = await prisma.action.update({
      where: { id: actionId },
      data:  { status: 'FAILED', resultSuccess: false, resultMessage: err.message ?? 'Unknown error', completedAt: new Date() },
    })
    publishStandardEvent('IntelActionFailed', {
      tenantId: action.tenantId, resourceId: actionId, metadata: { executorId: action.executorId, error: err.message },
    }, 'action-engine')
    return updated
  }
}

export async function cancelAction(actionId: string) {
  const action = await prisma.action.findUniqueOrThrow({ where: { id: actionId } })
  if (action.status !== 'QUEUED') throw new Error(`Cannot cancel action ${actionId} in status ${action.status}`)

  const updated = await prisma.action.update({ where: { id: actionId }, data: { status: 'CANCELLED' } })
  publishStandardEvent('IntelActionCancelled', { tenantId: action.tenantId, resourceId: actionId, metadata: {} }, 'action-engine')
  return updated
}

// ─── Read API ───────────────────────────────────────────────────────────────
export async function listActions(tenantId: string, status?: string) {
  return prisma.action.findMany({
    where:   { tenantId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getAction(id: string) {
  return prisma.action.findUnique({ where: { id } })
}
