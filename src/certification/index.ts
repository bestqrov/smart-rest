// ─── SmartSuite Certification Engine — Public API ─────────────────────────────

// ── Engine ────────────────────────────────────────────────────────────────────
export { evaluate }                               from './engine/CertificationEngine'

// ── Profile management ────────────────────────────────────────────────────────
export { registerBuiltinProfiles }                from './profiles'
export { registerProfile, getProfile, getAllProfiles, hasProfile } from './profiles/ProfileRegistry'

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
