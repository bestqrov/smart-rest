// ─── Smart Intelligence AI Chat Copilot Foundation — Contracts (K67) ───────
// Phase 3 begins here: unlike K52-K66 (rule-based only, no LLM), this
// module DOES call the AI Provider Layer — through K43's executePrompt,
// never directly — because generating a chat reply is the copilot's
// whole purpose. The boundary this sprint enforces is narrower:
// "Do NOT implement autonomous actions" — the copilot never calls K37's
// runAction/enqueueAction or K38's approveDecision/executeDecision; it
// only answers questions using already-computed advisor data.

export type CopilotIntent =
  | 'inventory' | 'customer' | 'marketing' | 'reservation'
  | 'staff' | 'financial' | 'business' | 'general'

export interface CopilotChatTurn {
  question: string
  content?: string
  status:   'COMPLETED' | 'FAILED' | 'DENIED'
  at:       string
}

export interface CopilotRequest {
  tenantId:    string
  sessionId:   string
  performedBy: string   // acting admin/staff id — audit trail, same field K43's executePrompt already requires
  message:     string
}

export interface CopilotResponse {
  sessionId:  string
  intent:     CopilotIntent
  status:     'COMPLETED' | 'FAILED' | 'DENIED'
  message?:   string
  reason?:    string   // set when status !== 'COMPLETED'
  generatedAt: Date
}
