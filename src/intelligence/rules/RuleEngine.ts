// ─── Smart Intelligence Rule Engine — Core (K41) ───────────────────────────
// evaluateRuleForTenant is the only path that actually fires a rule's
// action binding — and even then it only ever queues (K37's enqueueAction)
// or creates a PENDING decision (same shape K38's DecisionEngine writes,
// same 'IntelDecisionCreated' event) — never runs an action or approves a
// decision itself. testRule shares the exact same evaluation code path but
// never reaches either write, so a test can never trigger a real effect.

import prisma from '../../prisma'
import logger from '../../logger'
import { publishStandardEvent } from '../../core'
import { getTenantFeatureVector } from '../data'
import { enqueueAction } from '../actions'
import { getActiveRule } from './RuleRegistry'
import { evaluateConditionGroup } from './RuleEvaluator'
import type { EvaluationResult, FeatureVector, RuleActionBinding } from './types'
import type { StoredRule } from './RuleRegistry'

async function fireAction(tenantId: string, rule: StoredRule, binding: RuleActionBinding): Promise<void> {
  if (binding.type === 'ACTION') {
    if (!binding.executorId) return
    await enqueueAction(tenantId, binding.executorId, binding.input, 'MANUAL')
    return
  }

  if (binding.type === 'DECISION' && binding.decision) {
    const decision = await prisma.decision.create({
      data: {
        tenantId, ruleId: rule.key,
        category:    binding.decision.category,
        title:       binding.decision.title,
        description: binding.decision.description,
        priority:    binding.decision.priority,
        confidence:  binding.decision.confidence,
      },
    })
    publishStandardEvent('IntelDecisionCreated', {
      tenantId, resourceId: decision.id, metadata: { ruleId: rule.key, source: 'rule-engine' },
    }, 'rule-engine')
  }
}

// ─── Live evaluation (may fire the action binding) ─────────────────────────
export async function evaluateRuleForTenant(key: string, tenantId: string): Promise<EvaluationResult> {
  const rule = await getActiveRule(key, tenantId)
  if (!rule) return { matched: false, ruleKey: key, ruleVersion: 0, action: null }

  const features = await getTenantFeatureVector(tenantId)
  const matched  = evaluateConditionGroup(rule.conditions, features)

  if (matched) {
    publishStandardEvent('IntelRuleTriggered', {
      tenantId, resourceId: rule.id, metadata: { key, version: rule.version },
    }, 'rule-engine')

    try {
      await fireAction(tenantId, rule, rule.action)
    } catch (err) {
      logger.error({ msg: '[RuleEngine] action binding failed', key, tenantId, err })
    }
  }

  return { matched, ruleKey: key, ruleVersion: rule.version, action: matched ? rule.action : null }
}

// ─── Testing interface — never fires the action binding ────────────────────
export async function testRule(key: string, tenantId: string, sampleData?: FeatureVector): Promise<EvaluationResult> {
  const rule = await getActiveRule(key, tenantId)
  if (!rule) return { matched: false, ruleKey: key, ruleVersion: 0, action: null }

  const features = sampleData ?? await getTenantFeatureVector(tenantId)
  const matched  = evaluateConditionGroup(rule.conditions, features)

  return { matched, ruleKey: key, ruleVersion: rule.version, action: matched ? rule.action : null }
}
