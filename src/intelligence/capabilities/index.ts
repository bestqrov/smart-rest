// ─── Smart Intelligence Capability Engine — Public API (K49) ───────────────

export type {
  CapabilityLifecycleStatus, CapabilityScope, CapabilityDefinition, CapabilityMetadata, CapabilityValidationResult,
} from './types'

export { hasCapabilityRegistered, getCapabilityStatus, setCapabilityStatus } from './CapabilityRegistry'

export { findDependentCapabilities } from './CapabilityDiscovery'

export { registerBuiltinAgentFrameworkCapabilities, validateSkillRequiredCapabilities } from './CapabilityIntegrations'

export * from './CapabilityAPI'
