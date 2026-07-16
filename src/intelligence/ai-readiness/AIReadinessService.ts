// ─── Smart Intelligence AI Readiness — Service (K58) ────────────────────────
// Combines every check above into one report. Cached via K44's short-term
// Memory Engine (same 5-minute pattern used throughout this module) —
// still never calls an LLM.

import { registerMemoryNamespace, hasMemoryNamespace, remember, recall } from '../memory'
import { checkProviderAvailability } from './ProviderAvailability'
import { checkPromptReadiness } from './PromptReadiness'
import { checkContextCompleteness } from './ContextCompleteness'
import { checkAICapability } from './CapabilityValidation'
import { runSafetyGuards } from './SafetyGuardRegistry'
import { decideAIExecutionPolicy } from './AIExecutionPolicy'
import type { AIReadinessOptions, AIReadinessReport } from './types'

const NAMESPACE = 'ai-readiness'
const CACHE_TTL_MS = 5 * 60 * 1000

function ensureReadinessCacheNamespace(): void {
  if (hasMemoryNamespace(NAMESPACE)) return
  registerMemoryNamespace({
    id: NAMESPACE, tier: 'SHORT_TERM', ttlMs: CACHE_TTL_MS,
    description: 'Cached AI Readiness reports',
  })
}

function cacheKey(opts: AIReadinessOptions): string {
  return JSON.stringify({ promptKey: opts.promptKey, providerId: opts.providerId, modelId: opts.modelId })
}

export async function checkAIReadiness(tenantId: string, opts: AIReadinessOptions = {}): Promise<AIReadinessReport> {
  ensureReadinessCacheNamespace()

  const key = cacheKey(opts)
  const cached = await recall(tenantId, NAMESPACE, key)
  if (typeof cached === 'string') {
    try {
      const parsed = JSON.parse(cached) as AIReadinessReport
      return { ...parsed, generatedAt: new Date(parsed.generatedAt) }
    } catch { /* fall through to recompute */ }
  }

  const [provider, context, capability, prompt] = await Promise.all([
    Promise.resolve(checkProviderAvailability(opts.providerId, opts.modelId)),
    checkContextCompleteness(tenantId),
    checkAICapability(tenantId),
    opts.promptKey ? checkPromptReadiness(tenantId, opts.promptKey, opts.variables ?? {}) : Promise.resolve(undefined),
  ])

  const safetyGuards = await runSafetyGuards({ tenantId, promptKey: opts.promptKey })
  const policy = decideAIExecutionPolicy({ provider, prompt, context, capability, safetyGuards })

  const report: AIReadinessReport = {
    tenantId, provider, prompt, context, capability, safetyGuards, policy, generatedAt: new Date(),
  }

  await remember(tenantId, NAMESPACE, key, JSON.stringify(report))
  return report
}
