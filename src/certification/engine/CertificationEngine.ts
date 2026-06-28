import crypto from 'crypto'
import logger  from '../../logger'
import { eventBus, AuditService, FeatureFlagService } from '../../core'
import { getProfile }          from '../profiles/ProfileRegistry'
import { getRulesForProfile }  from '../rules/RuleRegistry'
import { calculateScore }      from '../scoring/ScoringEngine'
import { persistEvidence }     from '../evidence/EvidenceStore'
import type {
  EvaluateOptions, CertificationResult, CertificationLevel,
  RuleResult, Recommendation, EvidenceInput, RuleDefinition,
} from '../types'

// ─── Level determination ──────────────────────────────────────────────────────

function determineLevel(percentage: number, thresholds: { level: CertificationLevel; minPercentage: number }[]): CertificationLevel {
  const sorted = [...thresholds].sort((a, b) => b.minPercentage - a.minPercentage)
  for (const t of sorted) {
    if (percentage >= t.minPercentage) return t.level
  }
  return 'NONE'
}

// ─── Summary generation ───────────────────────────────────────────────────────

function buildSummary(
  level:      CertificationLevel,
  percentage: number,
  passed:     number,
  total:      number,
): string {
  return `${level} certification — ${percentage.toFixed(1)}% (${passed}/${total} rules passed)`
}

// ─── Recommendation engine ────────────────────────────────────────────────────

function generateRecommendations(
  rules:     RuleDefinition[],
  evidences: Map<string, EvidenceInput>,
): Recommendation[] {
  const recs: Recommendation[] = []

  for (const rule of rules) {
    const ev = evidences.get(rule.id)
    if (!ev || ev.passed) continue

    const priority = rule.required
      ? 'HIGH'
      : rule.weight >= 15
        ? 'HIGH'
        : rule.weight >= 8
          ? 'MEDIUM'
          : 'LOW'

    recs.push({
      ruleId:      rule.id,
      category:    rule.category,
      priority,
      title:       rule.required
        ? `[Required] ${rule.title}`
        : rule.title,
      description: rule.description,
      action:      buildAction(rule.id),
    })
  }

  // Sort: HIGH first, then by weight descending
  return recs.sort((a, b) => {
    const pOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    const pDiff = pOrder[a.priority] - pOrder[b.priority]
    if (pDiff !== 0) return pDiff
    const ruleA = rules.find(r => r.id === a.ruleId)
    const ruleB = rules.find(r => r.id === b.ruleId)
    return (ruleB?.weight ?? 0) - (ruleA?.weight ?? 0)
  })
}

function buildAction(ruleId: string): string {
  const actions: Record<string, string> = {
    MENU_ITEMS_COUNT:     'Add at least 5 items to your menu',
    MENU_CATEGORIES:      'Create at least 2 menu categories',
    TABLES_CONFIGURED:    'Set up tables in the Floor Plan section',
    STAFF_REGISTERED:     'Add staff members in the Staff Management section',
    BILLING_ACTIVE:       'Contact support to reactivate your billing account',
    ORDERS_LAST_30_DAYS:  'Drive orders through QR codes or table service',
    WEEKLY_ORDER_VOLUME:  'Increase weekly order volume to at least 20 orders',
    QR_ORDERS_ENABLED:    'Print and deploy QR codes at tables',
    RESERVATIONS_ACTIVE:  'Enable and promote the reservation system',
    MARKETING_CONFIGURED: 'Run a marketing campaign through the Marketing Brain',
    LOYALTY_CUSTOMERS:    'Enable loyalty opt-in for returning customers',
    INVENTORY_ACTIVE:     'Request Smart Inventory activation from your account manager',
  }
  return actions[ruleId] ?? 'Review this item in your dashboard'
}

// ─── Main evaluate function ───────────────────────────────────────────────────

export async function evaluate(
  tenantId:  string,
  profileId: string,
  options:   EvaluateOptions = {},
): Promise<CertificationResult> {
  const traceId = options.traceId ?? crypto.randomUUID()
  const log = (msg: string, extra?: object) =>
    logger.info({ msg: `[Certification] ${msg}`, tenantId, profileId, traceId, ...extra })

  // ── 1. Feature flag guard ─────────────────────────────────────────────────
  const flagEnabled = await FeatureFlagService.isEnabled('certification', { tenantId })
  if (!flagEnabled) {
    throw new Error(`Certification is disabled for tenant "${tenantId}"`)
  }

  log('evaluation started')
  eventBus.publish('CertificationStarted' as any, { tenantId, profileId, traceId }, 'certification')

  // ── 2. Load profile + rules ───────────────────────────────────────────────
  const profile = getProfile(profileId)
  if (!profile.enabled) throw new Error(`Profile "${profileId}" is disabled`)

  const rules = getRulesForProfile(profileId)
  if (rules.length === 0) throw new Error(`No enabled rules found for profile "${profileId}"`)

  log('rules loaded', { count: rules.length })

  // ── 3. Fetch tenant data ──────────────────────────────────────────────────
  const data = await profile.dataFetcher(tenantId)

  // ── 4. Evaluate rules → collect evidences ─────────────────────────────────
  const evidences = new Map<string, EvidenceInput>()

  for (const rule of rules) {
    const evaluator = profile.ruleEvaluators[rule.id]
    if (!evaluator) {
      logger.warn({ msg: '[Certification] missing evaluator', ruleId: rule.id })
      evidences.set(rule.id, { passed: false, score: 0, rawValue: null, metadata: { skipped: true } })
      continue
    }

    try {
      const ev = await evaluator(rule, data, { tenantId, profileId, data })
      evidences.set(rule.id, ev)
    } catch (err) {
      logger.error({ msg: '[Certification] evaluator threw', ruleId: rule.id, err })
      evidences.set(rule.id, { passed: false, score: 0, rawValue: null, metadata: { error: String(err) } })
    }
  }

  // ── 5. Scoring ────────────────────────────────────────────────────────────
  const scoring  = calculateScore(rules, evidences)
  const level    = determineLevel(scoring.percentage, profile.certificateLevels)
  const summary  = buildSummary(level, scoring.percentage, scoring.passedRules, rules.length)
  const recs     = generateRecommendations(rules, evidences)

  log('scored', { percentage: scoring.percentage, level })

  // ── 6. Persist evidence records ───────────────────────────────────────────
  //   Create a placeholder result ID for evidence linking
  const resultId    = crypto.randomUUID()
  const evidenceIds: string[] = []
  const ruleResults: RuleResult[] = []

  if (!options.dryRun) {
    for (const rule of rules) {
      const ev = evidences.get(rule.id)!
      const persisted = await persistEvidence(resultId, rule.id, ev)
      evidenceIds.push(persisted.id)
      ruleResults.push({
        ruleId:      rule.id,
        profile:     rule.profile,
        category:    rule.category,
        title:       rule.title,
        required:    rule.required,
        weight:      rule.weight,
        passed:      ev.passed,
        earnedScore: Math.min(1, ev.score) * rule.weight,
        rawValue:    ev.rawValue,
        evidenceId:  persisted.id,
      })
    }
  }

  // ── 7. Persist certification result ──────────────────────────────────────
  const evaluatedAt = new Date()
  const expiresAt   = new Date(evaluatedAt.getTime() + profile.validityDays * 86_400_000)

  const result: CertificationResult = {
    id:              resultId,
    tenantId,
    profile:         profileId,
    version:         profile.version,
    score:           scoring.totalScore,
    maxScore:        scoring.maxScore,
    percentage:      scoring.percentage,
    level,
    status:          'COMPLETED',
    evaluatedAt,
    expiresAt,
    ruleResults,
    evidenceIds,
    summary,
    recommendations: recs,
    metadata:        options.metadata,
  }

  if (!options.dryRun) {
    await (await import('../../prisma')).default.certificationResult.create({
      data: {
        id:              resultId,
        tenantId,
        profile:         profileId,
        version:         profile.version,
        score:           scoring.totalScore,
        maxScore:        scoring.maxScore,
        percentage:      scoring.percentage,
        level,
        status:          'COMPLETED',
        evaluatedAt,
        expiresAt,
        ruleResults:     JSON.stringify(ruleResults),
        evidenceIds,
        summary,
        recommendations: JSON.stringify(recs),
        metadata:        options.metadata ? JSON.stringify(options.metadata) : undefined,
      },
    })

    await AuditService.createAudit({
      module:      'certification',
      entity:      'CertificationResult',
      entityId:    resultId,
      action:      'CERTIFICATION_COMPLETED',
      performedBy: 'system',
      metadata:    { tenantId, profileId, level, percentage: scoring.percentage, traceId },
    })

    eventBus.publish('CertificationCompleted' as any, {
      tenantId, profileId, resultId, level, percentage: scoring.percentage, traceId,
    }, 'certification')
  }

  log('evaluation completed', { level, percentage: scoring.percentage, dryRun: options.dryRun ?? false })
  return result
}
