// ─── Smart Intelligence Context Engine — Unified Resolver (K33) ────────────
// Composes context from existing services only:
//   - tenant   → FeatureResolutionService.resolveFeatures (tenant lifecycle
//                engine, K2) — the same function BranchService (K18) already
//                reuses for plan-feature checks.
//   - branch   → BranchService.listBranches (K18).
//   - business → Cafe row (no existing CafeService abstraction to reuse —
//                every route in this codebase queries Cafe directly).
//   - time     → analytics/aggregators/periods.resolvePeriod (existing
//                period-window math, not re-derived here).
//   - user     → caller-supplied, sourced from the existing
//                AdminTokenPayload/POSTokenPayload JWT shapes (middleware),
//                not re-authenticated here.

import prisma from '../../prisma'
import { resolveFeatures } from '../../tenant/services/FeatureResolutionService'
import { listBranches } from '../../branches/BranchService'
import { resolvePeriod } from '../../analytics/aggregators/periods'
import type {
  IntelligenceContext, TenantContext, BranchContext, BusinessContext, TimeContext, ResolveContextInput,
} from './types'

async function resolveTenantContext(cafeId: string): Promise<TenantContext> {
  const resolved = await resolveFeatures(cafeId)
  return {
    tenantId:    cafeId,
    plan:        resolved.plan,
    state:       resolved.state,
    trialEndsAt: undefined, // resolveFeatures doesn't surface it; avoid a second tenant-profile fetch here
    features:    resolved.features,
    limits:      resolved.limits,
  }
}

async function resolveBranchContext(cafeId: string): Promise<BranchContext> {
  const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { parentCafeId: true } })
  const parentCafeId = cafe?.parentCafeId ?? null

  try {
    const { branches } = await listBranches(parentCafeId ?? cafeId)
    const siblingCafeIds = branches.map(b => b.id).filter(id => id !== cafeId)
    return {
      cafeId,
      isBranch:   !!parentCafeId,
      isParent:   !parentCafeId && branches.length > 0,
      parentCafeId,
      siblingCafeIds,
    }
  } catch {
    // Cafe isn't part of any branch group — a normal, common case, not an error.
    return { cafeId, isBranch: false, isParent: false, parentCafeId: null, siblingCafeIds: [] }
  }
}

async function resolveBusinessContext(cafeId: string): Promise<BusinessContext> {
  const cafe = await prisma.cafe.findUniqueOrThrow({
    where: { id: cafeId },
    select: { name: true, country: true, currency: true, city: true },
  })
  return { cafeId, name: cafe.name, country: cafe.country, currency: cafe.currency, city: cafe.city }
}

function resolveTimeContext(periodType: ResolveContextInput['period']): TimeContext {
  return { now: new Date(), period: resolvePeriod(periodType ?? '30d') }
}

// ─── Unified resolver ────────────────────────────────────────────────────────
export async function resolveContext(input: ResolveContextInput): Promise<IntelligenceContext> {
  const [tenant, branch, business] = await Promise.all([
    resolveTenantContext(input.cafeId),
    resolveBranchContext(input.cafeId),
    resolveBusinessContext(input.cafeId),
  ])

  return {
    tenant,
    branch,
    business,
    time: resolveTimeContext(input.period),
    user: input.user ?? null,
    request: input.source ? { source: input.source, traceId: input.traceId, ip: input.ip } : null,
  }
}
