// ─── Smart Intelligence Business Advisor — Public API (K46) ────────────────

export type {
  AdvisorCapability, AdvisorDefinition, AdvisorRequest, AdvisorResponse, AdvisorResponseStatus,
} from './types'

export {
  registerAdvisorCapability, hasAdvisorCapability, getAllAdvisorCapabilities,
} from './AdvisorCapabilityRegistry'

export {
  registerAdvisor, getAdvisor, hasAdvisor, getAllAdvisors, getAdvisorsByDomain, getAdvisorsByCapability,
} from './AdvisorRegistry'

export {
  getAdvisorSessionContext, appendAdvisorSessionTurn, type AdvisorSessionContext,
} from './AdvisorSessionContext'

export { processAdvisorRequest } from './AdvisorRequestPipeline'

export { askAdvisor, listAdvisors, findAdvisor, findAdvisorsByDomain, findAdvisorsByCapability } from './AdvisorAPI'
