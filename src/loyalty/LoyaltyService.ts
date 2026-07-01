// ─── Loyalty & Rewards (K20) ────────────────────────────────────────────────
// Points system, redemption, and transaction history (ledger) already exist
// in LoyaltyAccount + routes/loyalty.ts — reused, not duplicated. Genuinely
// missing: a reusable/callable earning rule (routes/orders.ts's award logic
// is inline and untouched — stable code), membership tiers, and a reward
// catalog. routes/loyalty.ts's redeem handler now delegates to
// redeemPoints() here so there's one implementation, not two.

import prisma from '../prisma'
import { publishStandardEvent } from '../core'

export type MembershipTier = 'BRONZE' | 'SILVER' | 'GOLD'

// Thresholds on lifetime points earned (never lowered by redemption).
const TIER_THRESHOLDS: { tier: MembershipTier; min: number }[] = [
  { tier: 'GOLD',   min: 2000 },
  { tier: 'SILVER', min: 500 },
  { tier: 'BRONZE', min: 0 },
]

export function getTier(lifetimePoints: number): MembershipTier {
  return TIER_THRESHOLDS.find(t => lifetimePoints >= t.min)!.tier
}

// Default earning rule: 10 currency units = 1 point, rounded down — same
// rate already hardcoded in routes/orders.ts's COMPLETED handler (reused
// as the canonical default here, not diverging from it).
export function calculateEarnedPoints(totalPrice: number): number {
  return Math.floor(totalPrice / 10)
}

async function getOrCreateAccount(cafeId: string, phone: string) {
  return prisma.loyaltyAccount.upsert({
    where:  { cafeId_phone: { cafeId, phone } },
    update: {},
    create: { cafeId, phone },
  })
}

// ─── Earn ───────────────────────────────────────────────────────────────────
export async function earnPoints(cafeId: string, phone: string, totalPrice: number, orderId?: string) {
  const points = calculateEarnedPoints(totalPrice)
  if (points <= 0) return getOrCreateAccount(cafeId, phone)

  const before = await getOrCreateAccount(cafeId, phone)
  const tierBefore = getTier(before.lifetimePoints)

  const updated = await prisma.loyaltyAccount.update({
    where: { cafeId_phone: { cafeId, phone } },
    data: {
      points:         { increment: points },
      lifetimePoints: { increment: points },
      ledger:         { push: { type: 'EARN', points, orderId: orderId ?? null, note: 'Order completed', createdAt: new Date() } },
    },
  })

  publishStandardEvent('LoyaltyPointsEarned', {
    tenantId: cafeId, resourceId: updated.id, metadata: { phone, points, orderId },
  }, 'loyalty')

  const tierAfter = getTier(updated.lifetimePoints)
  if (tierAfter !== tierBefore) {
    publishStandardEvent('LoyaltyTierChanged', {
      tenantId: cafeId, resourceId: updated.id, metadata: { phone, from: tierBefore, to: tierAfter },
    }, 'loyalty')
  }

  return updated
}

// ─── Redeem ───────────────────────────────────────────────────────────────────
// Same logic previously inline in routes/loyalty.ts POST /api/loyalty/redeem
// — that handler now calls this instead of duplicating it.
export async function redeemPoints(cafeId: string, phone: string, points: number, note = 'Redeemed at POS', orderId?: string) {
  if (!Number.isInteger(points) || points <= 0) throw new Error('points must be a positive integer')

  const account = await prisma.loyaltyAccount.findUnique({ where: { cafeId_phone: { cafeId, phone } } })
  if (!account || account.points < points) throw new Error('Insufficient loyalty points')

  const updated = await prisma.loyaltyAccount.update({
    where: { cafeId_phone: { cafeId, phone } },
    data: {
      points: { decrement: points },
      ledger: { push: { type: 'REDEEM', points: -points, orderId: orderId ?? null, note, createdAt: new Date() } },
    },
  })

  publishStandardEvent('LoyaltyPointsRedeemed', {
    tenantId: cafeId, resourceId: updated.id, metadata: { phone, points, note },
  }, 'loyalty')

  return updated
}

export async function getTierInfo(cafeId: string, phone: string) {
  const account = await prisma.loyaltyAccount.findUnique({ where: { cafeId_phone: { cafeId, phone } } })
  const lifetimePoints = account?.lifetimePoints ?? 0
  const tier = getTier(lifetimePoints)
  const next = TIER_THRESHOLDS.filter(t => t.min > lifetimePoints).sort((a, b) => a.min - b.min)[0]

  return {
    tier,
    lifetimePoints,
    currentPoints: account?.points ?? 0,
    nextTier: next ? { tier: next.tier, pointsNeeded: next.min - lifetimePoints } : null,
  }
}

// ─── Reward catalog ───────────────────────────────────────────────────────────
export async function listRewards(cafeId: string, activeOnly = true) {
  return prisma.loyaltyReward.findMany({
    where:   { cafeId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { pointsCost: 'asc' },
  })
}

export async function createReward(cafeId: string, input: { name: string; description?: string; pointsCost: number }) {
  if (input.pointsCost <= 0) throw new Error('pointsCost must be greater than 0')
  const reward = await prisma.loyaltyReward.create({
    data: { cafeId, name: input.name, description: input.description, pointsCost: input.pointsCost },
  })
  publishStandardEvent('LoyaltyRewardCreated', {
    tenantId: cafeId, resourceId: reward.id, metadata: { name: reward.name, pointsCost: reward.pointsCost },
  }, 'loyalty')
  return reward
}

export async function deactivateReward(cafeId: string, rewardId: string) {
  const reward = await prisma.loyaltyReward.findFirst({ where: { id: rewardId, cafeId } })
  if (!reward) throw new Error(`Reward ${rewardId} not found for cafe ${cafeId}`)
  return prisma.loyaltyReward.update({ where: { id: rewardId }, data: { isActive: false } })
}

// Redeems points against a catalog reward — thin wrapper over redeemPoints
// so the point-deduction logic isn't duplicated.
export async function redeemReward(cafeId: string, phone: string, rewardId: string) {
  const reward = await prisma.loyaltyReward.findFirst({ where: { id: rewardId, cafeId, isActive: true } })
  if (!reward) throw new Error(`Reward ${rewardId} not found or inactive for cafe ${cafeId}`)

  const account = await redeemPoints(cafeId, phone, reward.pointsCost, `Redeemed: ${reward.name}`)

  publishStandardEvent('LoyaltyRewardRedeemed', {
    tenantId: cafeId, resourceId: reward.id, metadata: { phone, rewardName: reward.name, pointsCost: reward.pointsCost },
  }, 'loyalty')

  return account
}
