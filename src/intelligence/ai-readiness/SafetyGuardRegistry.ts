// ─── Smart Intelligence AI Readiness — Safety Guard Interface (K58) ────────
// Same registry-of-definitions idiom as every other Intelligence module.
// Ships with zero built-in guards — a future sprint registers real content
// checks; this only defines the interface and runs whatever is registered.

import type { SafetyGuardDefinition, SafetyGuardInput, SafetyGuardResult } from './types'

const registry = new Map<string, SafetyGuardDefinition>()

export function registerSafetyGuard(guard: SafetyGuardDefinition): void {
  registry.set(guard.id, guard)
}

export function getAllSafetyGuards(): SafetyGuardDefinition[] {
  return [...registry.values()]
}

export async function runSafetyGuards(input: SafetyGuardInput): Promise<SafetyGuardResult[]> {
  const guards = getAllSafetyGuards()
  const results: SafetyGuardResult[] = []

  for (const guard of guards) {
    try {
      results.push(await guard.check(input))
    } catch (err: any) {
      results.push({ guardId: guard.id, status: 'FAIL', reason: err?.message ?? 'guard threw an error' })
    }
  }

  return results
}
