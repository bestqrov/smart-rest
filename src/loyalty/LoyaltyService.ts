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

// Thresholds are now per-cafe (Cafe.loyaltyTierSilverThreshold /
// loyaltyTierGoldThreshold), configurable via the Settings tab in
// /admin/loyalty. This function takes them as parameters instead of a
// hardcoded array so callers stay explicit about which cafe's config
// they're using.
export function getTier(lifetimePoints: number, silverThreshold: number, goldThreshold: number): MembershipTier {
  if (lifetimePoints >= goldThreshold)   return 'GOLD'
  if (lifetimePoints >= silverThreshold) return 'SILVER'
  return 'BRONZE'
}

// Earning rule: `pointsPerCurrency` currency units = 1 point, rounded down.
// Now per-cafe (Cafe.loyaltyPointsPerCurrency, default 10), configurable via
// the Settings tab in /admin/loyalty — was previously a hardcoded `10` here
// AND separately hardcoded again (and never kept in sync) in
// routes/orders.ts, which is the bug Task 3 fixes.
export function calculateEarnedPoints(totalPrice: number, pointsPerCurrency: number): number {
  return Math.floor(totalPrice / pointsPerCurrency)
}

async function getLoyaltyConfig(cafeId: string) {
  const cafe = await prisma.cafe.findUnique({
    where:  { id: cafeId },
    select: { loyaltyPointsPerCurrency: true, loyaltyTierSilverThreshold: true, loyaltyTierGoldThreshold: true },
  })
  return {
    pointsPerCurrency: cafe?.loyaltyPointsPerCurrency ?? 10,
    silverThreshold:   cafe?.loyaltyTierSilverThreshold ?? 500,
    goldThreshold:     cafe?.loyaltyTierGoldThreshold ?? 2000,
  }
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
  const config = await getLoyaltyConfig(cafeId)
  const points = calculateEarnedPoints(totalPrice, config.pointsPerCurrency)
  if (points <= 0) return getOrCreateAccount(cafeId, phone)

  const before = await getOrCreateAccount(cafeId, phone)
  const tierBefore = getTier(before.lifetimePoints, config.silverThreshold, config.goldThreshold)

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

  const tierAfter = getTier(updated.lifetimePoints, config.silverThreshold, config.goldThreshold)
  if (tierAfter !== tierBefore) {
    publishStandardEvent('LoyaltyTierChanged', {
      tenantId: cafeId, resourceId: updated.id, metadata: { phone, from: tierBefore, to: tierAfter },
    }, 'loyalty')
  }

  // Newly-eligible rewards: active rewards whose pointsCost the customer just
  // crossed with this earn (was below before.points, now at or above the new
  // balance). WhatsAppEngine listens for this event and sends one message
  // covering every reward that became reachable in this single earn.
  const activeRewards = await prisma.loyaltyReward.findMany({ where: { cafeId, isActive: true } })
  const newlyEligible = activeRewards.filter(r => before.points < r.pointsCost && r.pointsCost <= updated.points)
  if (newlyEligible.length > 0) {
    publishStandardEvent('LoyaltyRewardEligible', {
      tenantId: cafeId, resourceId: updated.id,
      metadata: { phone, rewardNames: newlyEligible.map(r => r.name), currentPoints: updated.points },
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
  const [account, config] = await Promise.all([
    prisma.loyaltyAccount.findUnique({ where: { cafeId_phone: { cafeId, phone } } }),
    getLoyaltyConfig(cafeId),
  ])
  const lifetimePoints = account?.lifetimePoints ?? 0
  const tier = getTier(lifetimePoints, config.silverThreshold, config.goldThreshold)

  const thresholds: { tier: MembershipTier; min: number }[] = [
    { tier: 'GOLD',   min: config.goldThreshold },
    { tier: 'SILVER', min: config.silverThreshold },
  ]
  const next = thresholds.filter(t => t.min > lifetimePoints).sort((a, b) => a.min - b.min)[0]

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
