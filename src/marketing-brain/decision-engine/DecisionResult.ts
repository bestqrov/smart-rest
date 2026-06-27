import type { IMessageTemplate }  from '../models/MessageTemplate'
import type { IAIRule }           from '../models/AIRule'
import type { IScenario }         from '../models/Scenario'
import type { IFollowupSequence } from '../models/FollowupSequence'

// ─── Decision step ────────────────────────────────────────────────────────────

/** Which component of the decision this step represents. */
export type DecisionDimension =
  | 'SCENARIO'    // which scenario was matched
  | 'PERSONA'     // which persona was selected / inferred
  | 'TEMPLATE'    // which message template was chosen
  | 'AI_RULES'    // which AI rules were applied
  | 'FOLLOWUP'    // which follow-up sequence was selected
  | 'VARIABLES'   // which variable values were resolved

/**
 * One atomic step in the decision process.
 * Together they form a human-readable audit trail.
 */
export interface DecisionStep {
  dimension:     DecisionDimension
  /** Slug, code, or descriptive label of the selected item. */
  selected:      string
  /** Human-readable explanation of why this item was chosen. */
  reason:        string
  /** Raw numeric score before normalization. -1 if not score-based. */
  rawScore:      number
  /** 0 = exact match, 1–3 = progressive fallback levels. undefined = N/A. */
  fallbackLevel?: number
  /** Other candidates that were considered but not chosen. */
  alternatives:  string[]
}

// ─── Score breakdown ──────────────────────────────────────────────────────────

/**
 * Dimension-level breakdown of the final confidence score.
 * Weights: template 40, variables 25, rules 20, scenario 15 (sum = 100).
 */
export interface ScoreBreakdown {
  /** Template match quality: 0–40. */
  template:  number
  /** Variable completeness: 0–25. */
  variables: number
  /** AI rules coverage: 0–20. */
  rules:     number
  /** Scenario resolution: 0–15. */
  scenario:  number
  /** Sum of all dimensions: 0–100. */
  total:     number
}

// ─── Reasoning trail ──────────────────────────────────────────────────────────

/**
 * Full, human-readable audit trail of every decision the engine made.
 * Useful for debugging, explaining to operators, and future training data.
 */
export interface ReasoningTrail {
  /** One-sentence summary of the overall decision outcome. */
  summary:        string
  /** Per-dimension decisions, in processing order. */
  steps:          DecisionStep[]
  /** Normalized score contributions by dimension. */
  scoreBreakdown: ScoreBreakdown
}

// ─── DecisionResult ───────────────────────────────────────────────────────────

/**
 * The complete, deterministic output of a Decision Engine run.
 *
 * Guarantee: the same DecisionContext always produces the same DecisionResult.
 *
 * Check errors[] first — if non-empty, selectedTemplate will be null and the
 * result is unusable. Warnings[] are non-blocking informational notes.
 */
export interface DecisionResult {
  /** Best-matching message template, or null if none was found. */
  selectedTemplate:         IMessageTemplate  | null
  /** All AI rules that apply to this context, sorted: hard first, then priority desc. */
  selectedAIRules:          IAIRule[]
  /** All {{key}} placeholders resolved to final string values. */
  selectedVariables:        Record<string, string>
  /** The scenario document matched by the trigger, or null. */
  selectedScenario:         IScenario         | null
  /** Best-matching follow-up sequence, or null if none exists for this scenario. */
  selectedFollowupSequence: IFollowupSequence | null
  /** Overall match quality: 0 = failed / worst-case fallback, 100 = perfect. */
  confidenceScore:          number
  /** Full audit trail — what was selected, from what pool, and why. */
  reasoning:                ReasoningTrail
  /** Non-blocking issues: missing optional vars, soft fallbacks, etc. */
  warnings:                 string[]
  /** Blocking issues that prevented a usable result. */
  errors:                   string[]
}
