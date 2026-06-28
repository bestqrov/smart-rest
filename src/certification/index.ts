// ─── SmartSuite Certification Engine — Public API ─────────────────────────────

// ── Engine ────────────────────────────────────────────────────────────────────
export { evaluate }                               from './engine/CertificationEngine'

// ── Profile management ────────────────────────────────────────────────────────
export { registerBuiltinProfiles }                from './profiles'
export {
  createProfile,
  registerProfile,
  getProfile,
  getAllProfiles,
  hasProfile,
}                                                 from './profiles/ProfileRegistry'

// ── Pack management ───────────────────────────────────────────────────────────
export { registerBuiltinPacks }                   from './packs'
export {
  registerPack,
  updatePack,
  removePack,
  getPack,
  getAllPacks,
  hasPack,
  resolveDependencies,
  getPackUsage,
  getProfilesUsingPack,
  getUnusedPacks,
  getRuleCoverage,
}                                                 from './packs/PackRegistry'

// ── Rule management ───────────────────────────────────────────────────────────
export { registerRule, registerRules, getRule, getRulesForProfile } from './rules/RuleRegistry'

// ── Scoring (for custom integrations) ────────────────────────────────────────
export { calculateScore, scoreBoolean, scoreNumber, scorePercentage } from './scoring/ScoringEngine'

// ── Evidence ──────────────────────────────────────────────────────────────────
export { persistEvidence, getEvidenceForResult, getEvidenceById } from './evidence/EvidenceStore'

// ── Persistence ───────────────────────────────────────────────────────────────
export * as CertificationService from './services/CertificationService'

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  CertificationLevel,
  CertificationStatus,
  CertificationResult,
  EvaluateOptions,
  ProfileDefinition,
  ProfileConfig,
  RulePack,
  PackRule,
  PackUsageStat,
  RuleCoverage,
  RuleDefinition,
  EvaluationType,
  Evidence,
  EvidenceInput,
  ScoringResult,
  CategoryBreakdown,
  RuleResult,
  Recommendation,
  RecommendationPriority,
  LevelThreshold,
  DataFetcher,
  RuleEvaluatorFn,
  RuleEvaluatorMap,
  EvaluationContext,
} from './types'
