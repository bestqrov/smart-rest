import prisma from '../../prisma'
import type { FeatureFlag, FlagStatus, FlagScope, FlagContext } from '../types'

// ─── Default platform flags ───────────────────────────────────────────────────

const DEFAULT_FLAGS: Array<{
  key:         string
  name:        string
  description: string
  status:      FlagStatus
  scope:       FlagScope
}> = [
  { key: 'marketing_brain',       name: 'Marketing Brain',      description: 'AI-powered campaign generation',     status: 'enabled',     scope: 'global' },
  { key: 'ai_center',             name: 'AI Center',            description: 'AI provider management dashboard',   status: 'enabled',     scope: 'global' },
  { key: 'ai_jobs',               name: 'AI Jobs',              description: 'AI job queue infrastructure',        status: 'enabled',     scope: 'global' },
  { key: 'certification',         name: 'Certification',        description: 'Client certification module',        status: 'comingSoon',  scope: 'global' },
  { key: 'analytics',             name: 'Analytics',            description: 'Platform analytics dashboard',       status: 'comingSoon',  scope: 'global' },
  { key: 'marketplace',           name: 'Marketplace',          description: 'SmartSuite marketplace',             status: 'comingSoon',  scope: 'global' },
  { key: 'hotel_module',          name: 'SmartHotel',           description: 'Hotel management module',            status: 'comingSoon',  scope: 'global' },
  { key: 'clinic_module',         name: 'SmartClinic',          description: 'Clinic management module',           status: 'comingSoon',  scope: 'global' },
  { key: 'retail_module',         name: 'SmartRetail',          description: 'Retail management module',           status: 'comingSoon',  scope: 'global' },
  { key: 'whatsapp_integration',  name: 'WhatsApp Integration', description: 'WhatsApp messaging automation',      status: 'beta',        scope: 'global' },
  { key: 'automation',            name: 'Automation',           description: 'Workflow automation engine',         status: 'comingSoon',  scope: 'global' },
  { key: 'client_map',            name: 'Client Map',           description: 'Geographic client distribution map', status: 'comingSoon',  scope: 'global' },
]

// ─── Serialization ────────────────────────────────────────────────────────────

function toFlag(row: any): FeatureFlag {
  return {
    id:          row.id,
    key:         row.key,
    name:        row.name,
    description: row.description ?? undefined,
    status:      row.status as FlagStatus,
    scope:       row.scope  as FlagScope,
    targetIds:   row.targetIds ?? [],
    metadata:    row.metadata ? JSON.parse(row.metadata) : undefined,
    updatedAt:   row.updatedAt,
    createdAt:   row.createdAt,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check if a feature is enabled for the given context.
 * - Global flags: status must be 'enabled' or 'beta'
 * - Tenant-scoped flags: additionally checks targetIds includes tenantId
 * - Role-scoped flags: additionally checks targetIds includes role
 */
export async function isEnabled(key: string, ctx?: FlagContext): Promise<boolean> {
  const row = await (prisma as any).featureFlag.findUnique({ where: { key } })
  if (!row) return false

  if (row.status !== 'enabled' && row.status !== 'beta') return false

  if (row.scope === 'tenant' && ctx?.tenantId) {
    return (row.targetIds ?? []).includes(ctx.tenantId)
  }
  if (row.scope === 'role' && ctx?.role) {
    return (row.targetIds ?? []).includes(ctx.role)
  }

  return true
}

export async function getFlag(key: string): Promise<FeatureFlag | null> {
  const row = await (prisma as any).featureFlag.findUnique({ where: { key } })
  return row ? toFlag(row) : null
}

export async function getAllFlags(): Promise<FeatureFlag[]> {
  const rows = await (prisma as any).featureFlag.findMany({ orderBy: { key: 'asc' } })
  return rows.map(toFlag)
}

export async function setFlag(
  key:  string,
  patch: Partial<Pick<FeatureFlag, 'status' | 'scope' | 'targetIds' | 'description'>>,
): Promise<FeatureFlag> {
  const existing = await (prisma as any).featureFlag.findUnique({ where: { key } })
  const data: any = {}
  if (patch.status      !== undefined) data.status      = patch.status
  if (patch.scope       !== undefined) data.scope       = patch.scope
  if (patch.targetIds   !== undefined) data.targetIds   = patch.targetIds
  if (patch.description !== undefined) data.description = patch.description

  if (existing) {
    const row = await (prisma as any).featureFlag.update({ where: { key }, data })
    return toFlag(row)
  }
  throw new Error(`Feature flag "${key}" not found — use seedDefaultFlags() first`)
}

/**
 * Seed default platform flags (idempotent).
 * Safe to call on every server start.
 */
export async function seedDefaultFlags(): Promise<void> {
  for (const flag of DEFAULT_FLAGS) {
    await (prisma as any).featureFlag.upsert({
      where:  { key: flag.key },
      update: {},
      create: {
        key:         flag.key,
        name:        flag.name,
        description: flag.description,
        status:      flag.status,
        scope:       flag.scope,
        targetIds:   [],
      },
    })
  }
}
