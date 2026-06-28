// ─── SmartSuite Certification Engine — Types ──────────────────────────────────

// ── Certificate levels ────────────────────────────────────────────────────────

export type CertificationLevel =
  | 'NONE'
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'DIAMOND'

export type CertificationStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'

export type EvaluationType = 'BOOLEAN' | 'NUMBER' | 'PERCENTAGE' | 'CUSTOM'
export type RuleCategory    = string   // open string — profiles define their own categories
export type RecommendationPriority = 'HIGH' | 'MEDIUM' | 'LOW'

// ── Level threshold ───────────────────────────────────────────────────────────

export interface LevelThreshold {
  level:          CertificationLevel
  minPercentage:  number
  description:    string
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface ProfileDefinition {
  id:                string
  name:              string
  description:       string
  version:           string
  enabled:           boolean
  certificateLevels: LevelThreshold[]
  validityDays:      number
  dataFetcher:       DataFetcher
  ruleEvaluators:    RuleEvaluatorMap
}

export type DataFetcher = (tenantId: string) => Promise<Record<string, unknown>>

export type RuleEvaluatorFn = (
  rule:    RuleDefinition,
  data:    Record<string, unknown>,
  context: EvaluationContext,
) => Promise<EvidenceInput>

export type RuleEvaluatorMap = Record<string, RuleEvaluatorFn>

// ── Rule ──────────────────────────────────────────────────────────────────────

export interface RuleDefinition {
  id:             string
  profile:        string
  category:       RuleCategory
  title:          string
  description:    string
  weight:         number
  required:       boolean
  enabled:        boolean
  evaluationType: EvaluationType
  expectedValue?: unknown
  metadata?:      Record<string, unknown>
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export interface EvidenceInput {
  passed:         boolean
  score:          number        // 0–1 ratio applied to rule.weight
  rawValue:       unknown
  expectedValue?: unknown
  metadata?:      Record<string, unknown>
}

export interface Evidence extends EvidenceInput {
  id:        string
  resultId:  string
  ruleId:    string
  timestamp: Date
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export interface CategoryBreakdown {
  category:     RuleCategory
  score:        number
  maxScore:     number
  percentage:   number
  passedCount:  number
  totalCount:   number
}

export interface ScoringResult {
  totalScore:         number
  maxScore:           number
  percentage:         number
  passedRules:        number
  failedRules:        number
  requiredFailed:     number
  weightedBreakdown:  Record<string, number>
  categoryBreakdown:  CategoryBreakdown[]
}

// ── Rule result (inline in CertificationResult) ───────────────────────────────

export interface RuleResult {
  ruleId:       string
  profile:      string
  category:     RuleCategory
  title:        string
  required:     boolean
  weight:       number
  passed:       boolean
  earnedScore:  number
  rawValue:     unknown
  evidenceId:   string
}

// ── Recommendation ────────────────────────────────────────────────────────────

export interface Recommendation {
  ruleId?:     string
  category:    RuleCategory
  priority:    RecommendationPriority
  title:       string
  description: string
  action?:     string
}

// ── Evaluation context ────────────────────────────────────────────────────────

export interface EvaluationContext {
  tenantId:  string
  profileId: string
  data:      Record<string, unknown>
}

// ── Certification result ──────────────────────────────────────────────────────

export interface CertificationResult {
  id:              string
  tenantId:        string
  profile:         string
  version:         string
  score:           number
  maxScore:        number
  percentage:      number
  level:           CertificationLevel
  status:          CertificationStatus
  evaluatedAt:     Date
  expiresAt:       Date
  ruleResults:     RuleResult[]
  evidenceIds:     string[]
  summary:         string
  recommendations: Recommendation[]
  metadata?:       Record<string, unknown>
}

export interface EvaluateOptions {
  dryRun?:    boolean
  traceId?:   string
  metadata?:  Record<string, unknown>
}
