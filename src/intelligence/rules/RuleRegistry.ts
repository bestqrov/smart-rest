// ─── Smart Intelligence Rule Engine — Registry (K41) ───────────────────────
// Persisted, unlike the other Intelligence registries (which hold code) —
// this holds data, so it needs to survive restarts and support versioning +
// tenant overrides. Same versioning shape as KnowledgeEntry (K39): mark the
// previous current row isCurrent=false, insert version+1.

import prisma from '../../prisma'
import { publishStandardEvent } from '../../core'
import type { RuleConditionGroup, RuleActionBinding, RuleDefinitionInput } from './types'

function serialize<T>(v: T): string { return JSON.stringify(v) }
function deserialize<T>(raw: string): T { return JSON.parse(raw) as T }

export interface StoredRule {
  id:         string
  key:        string
  tenantId:   string | null
  name:       string
  category:   string
  version:    number
  isActive:   boolean
  conditions: RuleConditionGroup
  action:     RuleActionBinding
}

function toStoredRule(row: {
  id: string; key: string; tenantId: string | null; name: string; category: string
  version: number; isActive: boolean; conditions: string; actionConfig: string
}): StoredRule {
  return {
    id: row.id, key: row.key, tenantId: row.tenantId, name: row.name, category: row.category,
    version: row.version, isActive: row.isActive,
    conditions: deserialize<RuleConditionGroup>(row.conditions),
    action:     deserialize<RuleActionBinding>(row.actionConfig),
  }
}

// ─── Define (versioned write) — tenantId=null defines/updates the platform ──
// default; a non-null tenantId defines a tenant-specific override.
export async function defineRule(input: RuleDefinitionInput, tenantId: string | null = null) {
  const current = await prisma.intelRule.findFirst({
    where: { key: input.key, tenantId, isCurrent: true },
  })

  if (current) {
    await prisma.intelRule.update({ where: { id: current.id }, data: { isCurrent: false } })
  }

  const row = await prisma.intelRule.create({
    data: {
      key: input.key, tenantId,
      name:     input.name,
      category: input.category,
      version:  (current?.version ?? 0) + 1,
      isCurrent: true,
      isActive:  input.isActive ?? true,
      conditions:   serialize(input.conditions),
      actionType:   input.action.type,
      actionConfig: serialize(input.action),
    },
  })

  publishStandardEvent('IntelRuleDefined', {
    tenantId: tenantId ?? 'platform', resourceId: row.id, metadata: { key: input.key, version: row.version },
  }, 'rule-engine')

  return toStoredRule(row)
}

// ─── Resolve the active rule for a tenant — tenant override wins over the ──
// platform default, matching the same fallback convention used elsewhere
// in this codebase (e.g. tenant.customLimits over plan defaults).
export async function getActiveRule(key: string, tenantId: string): Promise<StoredRule | null> {
  const override = await prisma.intelRule.findFirst({ where: { key, tenantId, isCurrent: true, isActive: true } })
  if (override) return toStoredRule(override)

  const platformDefault = await prisma.intelRule.findFirst({ where: { key, tenantId: null, isCurrent: true, isActive: true } })
  return platformDefault ? toStoredRule(platformDefault) : null
}

export async function getRuleHistory(key: string, tenantId: string | null = null) {
  const rows = await prisma.intelRule.findMany({ where: { key, tenantId }, orderBy: { version: 'desc' } })
  return rows.map(toStoredRule)
}

export async function listRules(tenantId: string | null = null, category?: string) {
  const rows = await prisma.intelRule.findMany({
    where: { tenantId, isCurrent: true, ...(category ? { category } : {}) },
    orderBy: { key: 'asc' },
  })
  return rows.map(toStoredRule)
}
