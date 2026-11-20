// ─── Plan access — what a venue's subscription plan allows ───────────────────
// Plans/limits live in lib/gulfPlans.ts. Rules:
//   • No planId (free trial, or legacy per-order-commission venue) → everything
//     open, as the landing promises "7 days, every module unlocked".
//   • planId set → only that plan's features + paid add-ons.
// Every gated route returns 403 { code: 'PLAN_REQUIRED', feature, requiredPlan }
// so the admin UI can show "available on Pro" instead of a generic error.

import type { Request, Response, NextFunction } from 'express'
import prisma from '../prisma'
import {
  PLAN_FEATURES, requiredPlanFor, AI_VIDEOS_PER_MONTH,
  type PlanFeature, type PlanId,
} from '../../lib/gulfPlans'

export type GatedFeature = PlanFeature | 'aiVideo'

export interface PlanAccess {
  planId:     PlanId | null
  maxTables:  number | null
  features:   Record<GatedFeature, boolean>
  aiVideosPerMonth: number | null   // null = unlimited (trial / legacy)
}

const ALL: GatedFeature[] = ['loyalty', 'coupons', 'whatsappMarketing', 'aiMarketing', 'multiBranch', 'onlinePayment', 'aiVideo']

export async function getPlanAccess(cafeId: string): Promise<PlanAccess> {
  const cafe = await prisma.cafe.findUnique({
    where:  { id: cafeId },
    select: { planId: true, onlinePaymentAddon: true, aiVideoAddon: true },
  })
  const planId = (cafe?.planId && cafe.planId in PLAN_FEATURES ? cafe.planId : null) as PlanId | null

  if (!planId) {
    return {
      planId: null, maxTables: null, aiVideosPerMonth: null,
      features: Object.fromEntries(ALL.map(f => [f, true])) as Record<GatedFeature, boolean>,
    }
  }

  const def = PLAN_FEATURES[planId]
  const features = Object.fromEntries(ALL.map(f => [f, false])) as Record<GatedFeature, boolean>
  for (const f of def.features) features[f] = true
  if (def.addons.includes('onlinePayment') && cafe?.onlinePaymentAddon) features.onlinePayment = true
  features.aiVideo = !!cafe?.aiVideoAddon

  return { planId, maxTables: def.maxTables, features, aiVideosPerMonth: features.aiVideo ? AI_VIDEOS_PER_MONTH : 0 }
}

export function planRequiredBody(feature: GatedFeature) {
  return {
    error:        'This feature is not included in your plan',
    code:         'PLAN_REQUIRED',
    feature,
    requiredPlan: feature === 'aiVideo' ? 'ADDON' : requiredPlanFor(feature),
  }
}

/** Express guard for admin routes (expects authorizeAdmin to have run). */
export function requirePlanFeature(feature: GatedFeature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cafeId = req.admin?.cafeId
      if (!cafeId) return res.status(401).json({ error: 'Unauthorized' })
      const access = await getPlanAccess(cafeId)
      if (!access.features[feature]) return res.status(403).json(planRequiredBody(feature))
      return next()
    } catch {
      return res.status(500).json({ error: 'Plan check failed' })
    }
  }
}

/** Table cap check: would the venue have more than its plan allows? */
export async function tableLimitError(cafeId: string, resultingCount: number) {
  const access = await getPlanAccess(cafeId)
  if (access.maxTables != null && resultingCount > access.maxTables) {
    return { error: `Your plan allows up to ${access.maxTables} tables`, code: 'PLAN_TABLE_LIMIT', maxTables: access.maxTables, requiredPlan: 'PRO' }
  }
  return null
}
