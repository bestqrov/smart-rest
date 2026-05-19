import { Prisma } from '@prisma/client'
import prisma from '../prisma'

// ─── Fee Tiers ────────────────────────────────────────────────────────────────

// Morocco (MAD) — ordered from lowest to highest max
const MA_TIERS = [
  { max: 20,       fee: new Prisma.Decimal('1.00') },
  { max: 50,       fee: new Prisma.Decimal('3.00') },
  { max: 80,       fee: new Prisma.Decimal('5.00') },
  { max: 100,      fee: new Prisma.Decimal('7.00') },
  { max: 150,      fee: new Prisma.Decimal('10.00') },
  { max: Infinity, fee: new Prisma.Decimal('15.00') },
]

// Gulf (SAR / AED) — proportionally scaled
const GULF_TIERS = [
  { max: 10,       fee: new Prisma.Decimal('2.00') },
  { max: 25,       fee: new Prisma.Decimal('5.00') },
  { max: 40,       fee: new Prisma.Decimal('8.00') },
  { max: 50,       fee: new Prisma.Decimal('10.00') },
  { max: 75,       fee: new Prisma.Decimal('14.00') },
  { max: Infinity, fee: new Prisma.Decimal('20.00') },
]

// Social share flat fees per country
const SOCIAL_FEE: Record<string, Prisma.Decimal> = {
  MA: new Prisma.Decimal('0.50'),
  SA: new Prisma.Decimal('1.00'),
  AE: new Prisma.Decimal('1.00'),
}

// ─── calculateContextualFee ───────────────────────────────────────────────────

export function calculateContextualFee(
  orderTotal: Prisma.Decimal,
  country: string,
  isSocialAction: boolean
): Prisma.Decimal {
  if (isSocialAction) {
    return SOCIAL_FEE[country] ?? SOCIAL_FEE['MA']
  }

  const tiers = ['SA', 'AE'].includes(country) ? GULF_TIERS : MA_TIERS
  const total = orderTotal.toNumber()

  for (const tier of tiers) {
    if (total < tier.max) return tier.fee
  }

  return tiers[tiers.length - 1].fee
}

// ─── applyOrderFee ────────────────────────────────────────────────────────────

// Deducts the contextual fee from the cafe wallet inside a prisma transaction.
// Returns silently if the cafe is still within its grace period.
export async function applyOrderFee(
  tx: Prisma.TransactionClient,
  cafeId: number,
  orderId: number,
  orderTotal: Prisma.Decimal,
  country: string,
  isSocialAction = false
): Promise<void> {
  const cafe = await tx.cafe.findUnique({
    where: { id: cafeId },
    select: { trialEndsAt: true, walletBalance: true, hasSocialShareAddon: true }
  })

  if (!cafe) throw new Error(`Cafe ${cafeId} not found`)

  // Grace period — no fee
  if (cafe.trialEndsAt && new Date() < cafe.trialEndsAt) return

  // Social action requires the add-on to be active
  if (isSocialAction && !cafe.hasSocialShareAddon) return

  const fee = calculateContextualFee(orderTotal, country, isSocialAction)
  const previousBalance = cafe.walletBalance as unknown as Prisma.Decimal
  const newBalance = previousBalance.sub(fee)

  await tx.cafe.update({
    where: { id: cafeId },
    data: { walletBalance: newBalance, billingStatus: 'COLLECTING_DEBT' }
  })

  await tx.walletLog.create({
    data: {
      cafeId,
      orderId: orderId > 0 ? orderId : null,
      amount: fee.neg(),
      type: isSocialAction ? 'DEBT_ACC_SOCIAL' : 'DEBT_ACC_ORDER',
      previousBalance,
      newBalance
    }
  })
}

// ─── computeCafeAOV ───────────────────────────────────────────────────────────

export async function computeCafeAOV(cafeId: number): Promise<{
  aov: Prisma.Decimal
  orderCount: number
}> {
  const result = await prisma.order.aggregate({
    where: { cafeId, status: 'COMPLETED' },
    _avg: { totalPrice: true },
    _count: { id: true }
  })

  return {
    aov: result._avg.totalPrice
      ? new Prisma.Decimal(result._avg.totalPrice.toString())
      : new Prisma.Decimal('0.00'),
    orderCount: result._count.id
  }
}

// ─── suggestBillingTiers ──────────────────────────────────────────────────────

// Generates an AI-tuned billing tier set based on the cafe's historical AOV.
// Tiers are stored with cafeId so they override the national defaults.
export async function suggestBillingTiers(cafeId: number, country: string): Promise<void> {
  const { aov } = await computeCafeAOV(cafeId)
  const aovNum = aov.toNumber()

  // Delete any existing cafe-specific tiers before regenerating
  await prisma.billingTier.deleteMany({ where: { cafeId } })

  const isGulf = ['SA', 'AE'].includes(country)

  // Scale tiers around the cafe's actual AOV
  const base = Math.max(aovNum * 0.3, isGulf ? 5 : 10)
  const scale = isGulf ? 1.8 : 1

  const tiers = [
    { min: 0,          max: base,          fee: scale * 1 },
    { min: base,       max: base * 2,      fee: scale * 2.5 },
    { min: base * 2,   max: base * 3.5,    fee: scale * 4 },
    { min: base * 3.5, max: base * 5,      fee: scale * 6 },
    { min: base * 5,   max: base * 7,      fee: scale * 9 },
    { min: base * 7,   max: 99999,         fee: scale * 14 },
  ]

  await prisma.billingTier.createMany({
    data: tiers.map((t) => ({
      cafeId,
      country,
      minOrderValue: new Prisma.Decimal(t.min.toFixed(2)),
      maxOrderValue: new Prisma.Decimal(t.max.toFixed(2)),
      feeAmount:     new Prisma.Decimal(t.fee.toFixed(2)),
      isSocialShareFee: false
    }))
  })
}
