// ─── Smart Intelligence Skill System — Public API (K47) ────────────────────

export type {
  SkillStatus, SkillHealth, SkillPermission, SkillMetadata, SkillHandler,
  SkillDefinition, SkillInvocationContext, SkillInvocationStatus, SkillInvocationResult,
  InvokeSkillOptions,
} from './types'

export {
  registerSkill, getSkill, getSkillMetadata, getAllSkillVersions, listSkillIds, listCurrentSkills,
  setCurrentSkillVersion, getCurrentSkillVersion, getSkillHealth, setSkillStatus,
} from './SkillRegistry'

export { discoverSkills, discoverSkillsByModule, discoverSkillsByCapability, searchSkills } from './SkillDiscovery'

export { resolveCallerCapabilities, checkSkillPermission, type PermissionCheckResult } from './SkillPermissions'

export { invokeSkill } from './SkillInvocationPipeline'
