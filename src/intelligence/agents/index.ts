// ─── Smart Intelligence Agent Framework — Public API (K40) ─────────────────
// Framework only — no actual AI agents ship here.

export type {
  AgentCapability, AgentPermission, AgentStatus, AgentHealth, AgentDefinition, AgentMessage,
} from './types'

export {
  registerFrameworkAgent,
  unregisterFrameworkAgent,
  getFrameworkAgent,
  getAllFrameworkAgents,
  setAgentStatus,
  pauseAgent,
  resumeAgent,
  stopAgent,
  getAgentHealth,
  hasCapability,
} from './AgentFrameworkRegistry'

export { sendAgentMessage } from './AgentCommunication'

export { getAgentExecutionContext } from './AgentExecutionContext'
export type { AgentExecutionContext } from './AgentExecutionContext'
