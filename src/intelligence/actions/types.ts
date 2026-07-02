// ─── Smart Intelligence Action Engine — Contracts (K37) ────────────────────
// An executor is registered infrastructure — it defines HOW an action could
// run. Nothing in this module decides WHEN to run one automatically; every
// execution is an explicit call to runAction(). "mode" records intent only.

export type ActionExecutionMode = 'MANUAL' | 'AUTOMATIC'
export type ActionStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface ActionResult {
  success:  boolean
  message?: string
  data?:    Record<string, unknown>
}

export interface ActionExecutorDefinition {
  id:       string
  name:     string
  category: string
  execute:  (tenantId: string, input?: Record<string, unknown>) => Promise<ActionResult>
}
