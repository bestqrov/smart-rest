// ─── Smart Intelligence AI Copilot — Workflow Monitoring (K70) ─────────────
// Thin pass-through to K48's own run tracking — no second run store.

import { getWorkflowRun, listWorkflowRuns } from '../orchestrator'

export function getCopilotWorkflowRun(runId: string) {
  return getWorkflowRun(runId)
}

export function getCopilotAutomationHistory(tenantId: string) {
  return listWorkflowRuns(tenantId)
}
