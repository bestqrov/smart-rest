// ─── Smart Intelligence Skill System — Invocation (K47) ────────────────────
// Reuses K45's Agent Runtime primitives directly (concurrency slots,
// timeout wrapper) instead of re-implementing them — this is the only
// invocation path for skills, keyed separately ("skill:<id>") so a skill
// and an agent never contend for the same concurrency slot by accident.

import { tryAcquire, release, withTimeout } from '../runtime'
import { getSkill, getCurrentSkillVersion, recordSkillInvocation } from './SkillRegistry'
import { checkSkillPermission } from './SkillPermissions'
import type { InvokeSkillOptions, SkillInvocationContext, SkillInvocationResult } from './types'

const DEFAULT_TIMEOUT_MS = 30_000

function concurrencyKey(skillId: string): string {
  return `skill:${skillId}`
}

export async function invokeSkill<TInput = unknown, TOutput = unknown>(
  skillId: string, input: TInput, ctx: SkillInvocationContext, opts: InvokeSkillOptions = {},
): Promise<SkillInvocationResult<TOutput>> {
  const start = Date.now()
  const version = opts.version ?? getCurrentSkillVersion(skillId)

  if (!version) {
    return { skillId, version: opts.version ?? 'unknown', status: 'FAILED', error: 'skill not registered', durationMs: 0 }
  }

  const def = getSkill(skillId, version)
  if (!def) {
    return { skillId, version, status: 'FAILED', error: `skill "${skillId}@${version}" not found`, durationMs: 0 }
  }

  const permissionCheck = checkSkillPermission(def.permission, ctx.callerId, ctx.tenantId)
  if (!permissionCheck.allowed) {
    return { skillId, version, status: 'DENIED', error: permissionCheck.reason, durationMs: Date.now() - start }
  }

  const slotKey = concurrencyKey(skillId)
  if (!tryAcquire(slotKey)) {
    return { skillId, version, status: 'FAILED', error: 'concurrency limit reached', durationMs: Date.now() - start }
  }

  try {
    const output = await withTimeout(def.handle(input, ctx), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS) as TOutput
    recordSkillInvocation(skillId, { success: true })
    return { skillId, version, status: 'COMPLETED', output, durationMs: Date.now() - start }
  } catch (err: any) {
    const message = err?.message ?? 'Unknown error'
    const isTimeout = typeof message === 'string' && message.startsWith('Agent run timed out')
    recordSkillInvocation(skillId, { success: false, error: message })
    return { skillId, version, status: isTimeout ? 'TIMEOUT' : 'FAILED', error: message, durationMs: Date.now() - start }
  } finally {
    release(slotKey)
  }
}
