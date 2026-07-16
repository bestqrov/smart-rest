// ─── Smart Intelligence AI Copilot — Action Intent Detection (K69) ─────────
// Rule-based verb detection, deterministic and free — distinguishes "do
// this" from "tell me about this" before anything else runs.

const ACTION_VERBS = [
  'reorder', 'send', 'create', 'approve', 'execute', 'run', 'apply',
  'start', 'cancel', 'schedule', 'queue', 'trigger', 'do ', 'please do',
]

export function isActionRequest(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return ACTION_VERBS.some(verb => lower.startsWith(verb) || lower.includes(` ${verb}`))
}
