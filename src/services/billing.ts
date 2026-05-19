import { Prisma } from '@prisma/client'
import prisma from '../prisma'

// ─── Fee Tiers ────────────────────────────────────────────────────────────────

const MA_TIERS = [
  { max: 20,       fee: 1 },
  { max: 50,       fee: 3 },
  { max: 80,       fee: 5 },
  { max: 100,      fee: 7 },
  { max: 150,      fee: 10 },
  { max: Infinity, fee: 15 },
]

const GULF_TIERS = [
  { max: 10,       fee: 2 },
  { max: 25,       fee: 5 },
  { max: 40,       fee: 8 },
  { max: 50,       fee: 10 },
  { max: 75,       fee: 14 },
  { max: Infinity, fee: 20 },
]

const SOCIAL_FEE: Record<string, number> = { MA: 0.5, SA: 1.0, AE: 1.0 }

// ─── calculateContextualFee ───────────────────────────────────────────────────

export function calculateContextualFee(
  orderTotal: number,
  country: string,
  isSocialAction: boolean
): number {
  if (isSocialAction) return SOCIAL_FEE[country] ?? SOCIAL_FEE['MA']

  const tiers = ['SA', 'AE'].includes(country) ? GULF_TIERS : MA_TIERS
  for (const tier of tiers) {
    if (orderTotal < tier.max) return tier.fee
  }
  return tiers[tiers.length - 1].fee
}

// ─── applyOrderFee ────────────────────────────────────────────────────────────

export async function applyOrderFee(
  tx: Prisma.TransactionClient,
  cafeId: string,
  orderId: string,
  orderTotal: number,
  country: string,
  isSocialAction = false
): Promise<void> {
  const cafe = await tx.cafe.findUnique({
    where: { id: cafeId },
    select: { trialEndsAt: true, walletBalance: true, hasSocialShareAddon: true }
  })

  if (!cafe) throw new Error(`Cafe ${cafeId} not found`)

  if (cafe.trialEndsAt && new Date() < cafe.trialEndsAt) return
  if (isSocialAction && !cafe.hasSocialShareAddon) return

  const fee = calculateContextualFee(orderTotal, country, isSocialAction)
  const previousBalance = cafe.walletBalance
  const newBalance = previousBalance - fee

  await tx.cafe.update({
    where: { id: cafeId },
    data: { walletBalance: newBalance, billingStatus: 'COLLECTING_DEBT' }
  })

  await tx.walletLog.create({
    data: {
      cafeId,
      orderId: orderId || null,
      amount: -fee,
      type: isSocialAction ? 'DEBT_ACC_SOCIAL' : 'DEBT_ACC_ORDER',
      previousBalance,
      newBalance
    }
  })
}

// ─── computeCafeAOV ───────────────────────────────────────────────────────────

export async function computeCafeAOV(cafeId: string): Promise<{
  aov: number
  orderCount: number
}> {
  const result = await prisma.order.aggregate({
    where: { cafeId, status: 'COMPLETED' },
    _avg: { totalPrice: true },
    _count: { id: true }
  })

  return {
    aov: result._avg.totalPrice ?? 0,
    orderCount: result._count.id
  }
}

// ─── suggestBillingTiers ──────────────────────────────────────────────────────

export async function suggestBillingTiers(cafeId: string, country: string): Promise<void> {
  const { aov } = await computeCafeAOV(cafeId)
  await prisma.billingTier.deleteMany({ where: { cafeId } })

  const isGulf = ['SA', 'AE'].includes(country)
  const base = Math.max(aov * 0.3, isGulf ? 5 : 10)
  const scale = isGulf ? 1.8 : 1

  const tiers = [
    { min: 0,          max: base,       fee: scale * 1 },
    { min: base,       max: base * 2,   fee: scale * 2.5 },
    { min: base * 2,   max: base * 3.5, fee: scale * 4 },
    { min: base * 3.5, max: base * 5,   fee: scale * 6 },
    { min: base * 5,   max: base * 7,   fee: scale * 9 },
    { min: base * 7,   max: 99999,      fee: scale * 14 },
  ]

  await prisma.billingTier.createMany({
    data: tiers.map((t) => ({
      cafeId,
      country,
      minOrderValue: parseFloat(t.min.toFixed(2)),
      maxOrderValue: parseFloat(t.max.toFixed(2)),
      feeAmount:     parseFloat(t.fee.toFixed(2)),
      isSocialShareFee: false
    }))
  })
}
