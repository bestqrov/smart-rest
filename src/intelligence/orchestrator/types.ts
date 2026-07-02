// ─── Smart Intelligence Orchestrator — Contracts (K48) ─────────────────────
// Workflows are declared data (steps + dependsOn), never generated — there
// is no planner here, only deterministic dependency resolution over an
// explicit step list. Each step routes to an already-existing engine; the
// orchestrator owns none of the actual work.

export type WorkflowStepKind = 'AGENT' | 'SKILL' | 'ACTION' | 'DECISION_EVALUATE' | 'DECISION_EXECUTE'

export interface WorkflowStepDefinition {
  id:         string             // unique within the workflow
  kind:       WorkflowStepKind
  targetId?:  string             // agentId | skillId | actionExecutorId | decisionId — unused for DECISION_EVALUATE
  dependsOn?: string[]           // ids of steps in the same workflow that must complete first
  input?:     Record<string, unknown>
}

export interface WorkflowDefinition {
  id:          string
  name:        string
  description: string
  steps:       WorkflowStepDefinition[]
}

export type WorkflowRunStatus  = 'RUNNING' | 'COMPLETED' | 'FAILED'
export type WorkflowStepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'

export interface WorkflowStepResult {
  stepId:      string
  status:      WorkflowStepStatus
  output?:     unknown
  error?:      string
  durationMs?: number
}

export interface WorkflowRunState {
  runId:        string
  workflowId:   string
  tenantId:     string
  status:       WorkflowRunStatus
  steps:        WorkflowStepResult[]
  startedAt:    Date
  completedAt?: Date
}

export interface ExecuteWorkflowContext {
  tenantId:    string
  performedBy: string
  callerId:    string   // used for SKILL steps' permission resolution (K47)
}
