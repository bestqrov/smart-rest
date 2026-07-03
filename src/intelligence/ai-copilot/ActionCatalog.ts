// ─── Smart Intelligence AI Copilot — Action Catalog (K69) ──────────────────
// Reuses K37's ActionRegistry directly — no second executor list. With
// zero business executors registered anywhere yet (verified — same
// Foundation-only state K54 found), this always returns null today; it
// becomes useful the moment a future sprint registers real executors.

import { getAllActionExecutors } from '../actions'
import type { ActionExecutorDefinition } from '../actions'

export function findMatchingExecutor(message: string): ActionExecutorDefinition | undefined {
  const lower = message.toLowerCase()
  return getAllActionExecutors().find(executor =>
    lower.includes(executor.id.toLowerCase()) ||
    lower.includes(executor.name.toLowerCase()) ||
    lower.includes(executor.category.toLowerCase()),
  )
}
