// ─── Tenant Lifecycle Engine — Provisioning ───────────────────────────────────
// Creates tenant profiles with sensible defaults.
// Idempotent: calling twice returns the existing profile.

import type { CreateTenantInput, TenantProfile, Plan, TenantState } from '../types'
import { getPlan }              from '../plans'
import { eventBus }             from '../../core'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

function parseProfile(raw: any): TenantProfile {
  return {
    id:                raw.id,
    tenantId:          raw.tenantId,
    tenantType:        raw.tenantType,
    state:             raw.state as TenantState,
    plan:              raw.plan as Plan,
    trialEndsAt:       raw.trialEndsAt?.toISOString(),
    suspendedAt:       raw.suspendedAt?.toISOString(),
    suspensionType:    raw.suspensionType ?? undefined,
    suspensionReason:  raw.suspensionReason ?? undefined,
    gracePeriodEndsAt: raw.gracePeriodEndsAt?.toISOString(),
    activatedAt:       raw.activatedAt?.toISOString(),
    cancelledAt:       raw.cancelledAt?.toISOString(),
    archivedAt:        raw.archivedAt?.toISOString(),
    defaultLanguage:   raw.defaultLanguage,
    defaultCurrency:   raw.defaultCurrency,
    country:           raw.country,
    timezone:          raw.timezone,
    featureOverrides:  raw.featureOverrides  ? JSON.parse(raw.featureOverrides)  : undefined,
    tempPromotions:    raw.tempPromotions    ? JSON.parse(raw.tempPromotions)    : undefined,
    customLimits:      raw.customLimits      ? JSON.parse(raw.customLimits)      : undefined,
    createdAt:         raw.createdAt.toISOString(),
    updatedAt:         raw.updatedAt.toISOString(),
  }
}

export async function provision(input: CreateTenantInput): Promise<TenantProfile> {
  const prisma = await getPrisma()
  const plan   = input.plan ?? 'FREE'
  const def    = getPlan(plan)

  const startTrial  = input.startTrial ?? true
  const trialEndsAt = startTrial && def.trialDays > 0
    ? new Date(Date.now() + def.trialDays * 86400000)
    : null
  const initialState: TenantState = startTrial && def.trialDays > 0 ? 'TRIAL' : 'PENDING'

  const raw = await (prisma as any).tenantProfile.upsert({
    where:  { tenantId: input.tenantId },
    update: {},   // idempotent — don't overwrite existing profile
    create: {
      tenantId:        input.tenantId,
      tenantType:      input.tenantType ?? 'RESTAURANT',
      state:           initialState,
      plan,
      trialEndsAt,
      defaultLanguage: input.defaultLanguage ?? 'ar',
      defaultCurrency: input.defaultCurrency ?? 'MAD',
      country:         input.country ?? 'MA',
      timezone:        input.timezone ?? 'Africa/Casablanca',
      metadata:        input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })

  const profile = parseProfile(raw)

  // Publish provisioning event (non-blocking — eventBus.publish is sync fire-and-forget)
  eventBus.publish('TenantCreated', {
    tenantId: input.tenantId,
    tenantType: input.tenantType ?? 'RESTAURANT',
    plan,
    state: initialState,
  }, 'TenantProvisioning')

  if (initialState === 'TRIAL') {
    eventBus.publish('TenantTrialStarted', {
      tenantId: input.tenantId,
      trialEndsAt: trialEndsAt?.toISOString(),
      plan,
    }, 'TenantProvisioning')
  }

  return profile
}

export async function getProfile(tenantId: string): Promise<TenantProfile | null> {
  const prisma = await getPrisma()
  const raw    = await (prisma as any).tenantProfile.findUnique({ where: { tenantId } })
  return raw ? parseProfile(raw) : null
}

export async function ensureProfile(tenantId: string, tenantType?: string): Promise<TenantProfile> {
  const existing = await getProfile(tenantId)
  if (existing) return existing
  return provision({ tenantId, tenantType: (tenantType as any) ?? 'RESTAURANT', startTrial: false })
}

export async function listProfiles(filters?: { state?: string; plan?: string; tenantType?: string; page?: number; limit?: number }) {
  const prisma = await getPrisma()
  const where: Record<string, any> = {}
  if (filters?.state)      where.state      = filters.state
  if (filters?.plan)       where.plan       = filters.plan
  if (filters?.tenantType) where.tenantType = filters.tenantType

  const page  = filters?.page  ?? 1
  const limit = filters?.limit ?? 20

  const [items, total] = await Promise.all([
    (prisma as any).tenantProfile.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    (prisma as any).tenantProfile.count({ where }),
  ])

  return { profiles: items.map(parseProfile), total, page, limit }
}

export { parseProfile }
