import type {
  RuleDefinition, EvidenceInput, ScoringResult, CategoryBreakdown,
} from '../types'

// ─── Deterministic scoring engine ────────────────────────────────────────────
//
// Same inputs → same outputs. No randomness, no side effects.
//
// Score per rule = evidence.score (0-1) × rule.weight
// Total = Σ earnedScores
// Max   = Σ rule.weight (enabled rules only)
// Pct   = total / max × 100

export function calculateScore(
  rules:     RuleDefinition[],
  evidences: Map<string, EvidenceInput>,
): ScoringResult {
  let totalScore     = 0
  let maxScore       = 0
  let passedRules    = 0
  let failedRules    = 0
  let requiredFailed = 0

  const categoryMap = new Map<string, { score: number; max: number; passed: number; total: number }>()

  for (const rule of rules) {
    const ev = evidences.get(rule.id)
    if (!ev) continue

    const earned = Math.min(1, Math.max(0, ev.score)) * rule.weight

    totalScore += earned
    maxScore   += rule.weight

    if (ev.passed) passedRules++
    else {
      failedRules++
      if (rule.required) requiredFailed++
    }

    if (!categoryMap.has(rule.category)) {
      categoryMap.set(rule.category, { score: 0, max: 0, passed: 0, total: 0 })
    }
    const cat = categoryMap.get(rule.category)!
    cat.score  += earned
    cat.max    += rule.weight
    cat.total  += 1
    if (ev.passed) cat.passed += 1
  }

  const percentage: number = maxScore > 0 ? (totalScore / maxScore) * 100 : 0

  const weightedBreakdown: Record<string, number> = {}
  const categoryBreakdown: CategoryBreakdown[]    = []

  for (const [cat, val] of categoryMap) {
    weightedBreakdown[cat] = val.max > 0 ? (val.score / val.max) * 100 : 0
    categoryBreakdown.push({
      category:    cat,
      score:       val.score,
      maxScore:    val.max,
      percentage:  val.max > 0 ? (val.score / val.max) * 100 : 0,
      passedCount: val.passed,
      totalCount:  val.total,
    })
  }

  return {
    totalScore:    parseFloat(totalScore.toFixed(4)),
    maxScore:      parseFloat(maxScore.toFixed(4)),
    percentage:    parseFloat(percentage.toFixed(2)),
    passedRules,
    failedRules,
    requiredFailed,
    weightedBreakdown,
    categoryBreakdown,
  }
}

// ─── Evidence scoring helpers (used by rule evaluators) ──────────────────────

export function scoreBoolean(value: boolean, expected = true): EvidenceInput {
  const passed = value === expected
  return { passed, score: passed ? 1 : 0, rawValue: value, expectedValue: expected }
}

export function scoreNumber(
  value:     number,
  expected:  number,
  softScale  = false,
): EvidenceInput {
  if (expected <= 0) return { passed: value > 0, score: value > 0 ? 1 : 0, rawValue: value, expectedValue: expected }
  const ratio  = value / expected
  const score  = softScale ? Math.min(1, ratio) : (value >= expected ? 1 : 0)
  const passed = value >= expected
  return { passed, score, rawValue: value, expectedValue: expected }
}

export function scorePercentage(value: number): EvidenceInput {
  const clamped = Math.min(100, Math.max(0, value))
  return {
    passed:        clamped >= 100,
    score:         clamped / 100,
    rawValue:      value,
    expectedValue: 100,
  }
}
