import { Prisma } from '@prisma/client'
import prisma from '../prisma'

// ─── Tier type ────────────────────────────────────────────────────────────────

type Tier = { max: number; fee: number }

// ─── Morocco ──────────────────────────────────────────────────────────────────
// Commission per order based on total value (MAD)

const MA_TIERS: Tier[] = [
  { max: 20,       fee: 0.50 },
  { max: 50,       fee: 3    },
  { max: 80,       fee: 5    },
  { max: 100,      fee: 7    },
  { max: 150,      fee: 10   },
  { max: Infinity, fee: 15   },
]

// ─── Gulf ─────────────────────────────────────────────────────────────────────

// Saudi Arabia (SAR) — 1 SAR ≈ 2.7 MAD
const SA_TIERS: Tier[] = [
  { max: 15,       fee: 1  },
  { max: 40,       fee: 3  },
  { max: 70,       fee: 6  },
  { max: 120,      fee: 10 },
  { max: 200,      fee: 15 },
  { max: Infinity, fee: 22 },
]

// UAE (AED) — 1 AED ≈ 2.9 MAD
const AE_TIERS: Tier[] = [
  { max: 15,       fee: 1  },
  { max: 40,       fee: 3  },
  { max: 80,       fee: 6  },
  { max: 130,      fee: 10 },
  { max: 200,      fee: 15 },
  { max: Infinity, fee: 22 },
]

// Kuwait (KWD) — 1 KWD ≈ 33 MAD — high purchasing power
const KW_TIERS: Tier[] = [
  { max: 1.5,      fee: 0.10 },
  { max: 4,        fee: 0.30 },
  { max: 8,        fee: 0.60 },
  { max: 15,       fee: 1.00 },
  { max: 25,       fee: 1.50 },
  { max: Infinity, fee: 2.50 },
]

// Qatar (QAR) — 1 QAR ≈ 2.8 MAD
const QA_TIERS: Tier[] = [
  { max: 15,       fee: 1  },
  { max: 40,       fee: 3  },
  { max: 70,       fee: 6  },
  { max: 120,      fee: 10 },
  { max: 200,      fee: 15 },
  { max: Infinity, fee: 22 },
]

// Bahrain (BHD) — 1 BHD ≈ 27 MAD
const BH_TIERS: Tier[] = [
  { max: 1.5,      fee: 0.10 },
  { max: 4,        fee: 0.30 },
  { max: 8,        fee: 0.60 },
  { max: 15,       fee: 1.00 },
  { max: 25,       fee: 1.80 },
  { max: Infinity, fee: 3.00 },
]

// Oman (OMR) — 1 OMR ≈ 26 MAD
const OM_TIERS: Tier[] = [
  { max: 1,        fee: 0.05 },
  { max: 3,        fee: 0.20 },
  { max: 6,        fee: 0.40 },
  { max: 10,       fee: 0.70 },
  { max: 18,       fee: 1.20 },
  { max: Infinity, fee: 2.00 },
]

// ─── North Africa ─────────────────────────────────────────────────────────────

// Algeria (DZD) — 1 MAD ≈ 36 DZD
const DZ_TIERS: Tier[] = [
  { max: 500,      fee: 15  },
  { max: 1200,     fee: 80  },
  { max: 2000,     fee: 150 },
  { max: 3000,     fee: 200 },
  { max: 5000,     fee: 300 },
  { max: Infinity, fee: 450 },
]

// Tunisia (TND) — 1 MAD ≈ 0.32 TND
const TN_TIERS: Tier[] = [
  { max: 5,        fee: 0.15 },
  { max: 15,       fee: 0.80 },
  { max: 25,       fee: 1.50 },
  { max: 40,       fee: 2.00 },
  { max: 70,       fee: 3.00 },
  { max: Infinity, fee: 5.00 },
]

// Egypt (EGP) — 1 MAD ≈ 5 EGP
const EG_TIERS: Tier[] = [
  { max: 50,       fee: 2  },
  { max: 150,      fee: 10 },
  { max: 250,      fee: 18 },
  { max: 400,      fee: 28 },
  { max: 600,      fee: 40 },
  { max: Infinity, fee: 60 },
]

// Libya (LYD) — 1 MAD ≈ 0.50 LYD
const LY_TIERS: Tier[] = [
  { max: 10,       fee: 0.30 },
  { max: 25,       fee: 1.50 },
  { max: 50,       fee: 3.00 },
  { max: 100,      fee: 5.00 },
  { max: Infinity, fee: 8.00 },
]

// Mauritania (MRU)
const MR_TIERS: Tier[] = [
  { max: 100,      fee: 3  },
  { max: 300,      fee: 15 },
  { max: 600,      fee: 30 },
  { max: Infinity, fee: 50 },
]

// Jordan (JOD) — 1 JOD ≈ 14 MAD
const JO_TIERS: Tier[] = [
  { max: 2,        fee: 0.10 },
  { max: 5,        fee: 0.30 },
  { max: 10,       fee: 0.60 },
  { max: 20,       fee: 1.00 },
  { max: Infinity, fee: 1.80 },
]

// ─── Sub-Saharan Africa ───────────────────────────────────────────────────────

// West Africa XOF (Senegal, Côte d'Ivoire) — 1 MAD ≈ 60 XOF
const XOF_TIERS: Tier[] = [
  { max: 800,      fee: 25  },
  { max: 2000,     fee: 100 },
  { max: 4000,     fee: 200 },
  { max: 7000,     fee: 350 },
  { max: Infinity, fee: 600 },
]

// Central Africa XAF (Gabon, Cameroon)
const XAF_TIERS: Tier[] = [
  { max: 800,      fee: 25  },
  { max: 2000,     fee: 100 },
  { max: 4000,     fee: 200 },
  { max: 7000,     fee: 350 },
  { max: Infinity, fee: 550 },
]

// Kenya (KES) — 1 MAD ≈ 13 KES
const KE_TIERS: Tier[] = [
  { max: 200,      fee: 10  },
  { max: 500,      fee: 30  },
  { max: 1000,     fee: 60  },
  { max: 2000,     fee: 100 },
  { max: Infinity, fee: 180 },
]

// ─── Europe ───────────────────────────────────────────────────────────────────

// EUR (France, Spain, Belgium, Germany, Italy, Netherlands, Portugal...)
const EUR_TIERS: Tier[] = [
  { max: 5,        fee: 0.10 },
  { max: 12,       fee: 0.25 },
  { max: 25,       fee: 0.50 },
  { max: 50,       fee: 0.80 },
  { max: 100,      fee: 1.20 },
  { max: Infinity, fee: 2.00 },
]

// UK (GBP) — 1 GBP ≈ 12 MAD
const GB_TIERS: Tier[] = [
  { max: 4,        fee: 0.10 },
  { max: 10,       fee: 0.20 },
  { max: 20,       fee: 0.40 },
  { max: 40,       fee: 0.70 },
  { max: 80,       fee: 1.20 },
  { max: Infinity, fee: 2.00 },
]

// ─── Americas ─────────────────────────────────────────────────────────────────

// USA (USD)
const US_TIERS: Tier[] = [
  { max: 5,        fee: 0.10 },
  { max: 15,       fee: 0.25 },
  { max: 30,       fee: 0.50 },
  { max: 60,       fee: 0.80 },
  { max: Infinity, fee: 1.50 },
]

// ─── Country → Tiers map ──────────────────────────────────────────────────────

const COUNTRY_TIERS: Record<string, Tier[]> = {
  // Morocco
  MA: MA_TIERS,
  // Gulf
  SA: SA_TIERS,
  AE: AE_TIERS,
  KW: KW_TIERS,
  QA: QA_TIERS,
  BH: BH_TIERS,
  OM: OM_TIERS,
  // North Africa
  DZ: DZ_TIERS,
  TN: TN_TIERS,
  EG: EG_TIERS,
  LY: LY_TIERS,
  MR: MR_TIERS,
  JO: JO_TIERS,
  SY: EG_TIERS,   // Syria — similar purchasing power to Egypt
  IQ: EG_TIERS,   // Iraq  — approximate
  // Sub-Saharan Africa
  SN: XOF_TIERS,
  CI: XOF_TIERS,
  GA: XAF_TIERS,
  CM: XAF_TIERS,
  KE: KE_TIERS,
  // Europe (EUR)
  FR: EUR_TIERS,
  ES: EUR_TIERS,
  BE: EUR_TIERS,
  DE: EUR_TIERS,
  IT: EUR_TIERS,
  NL: EUR_TIERS,
  PT: EUR_TIERS,
  // UK
  GB: GB_TIERS,
  // Americas
  US: US_TIERS,
}

// ─── Social share fee per country ─────────────────────────────────────────────

const SOCIAL_FEE: Record<string, number> = {
  MA: 0.50,
  SA: 1.00, AE: 1.00, KW: 0.10, QA: 1.00, BH: 0.10, OM: 0.05,
  DZ: 15,   TN: 0.15, EG: 2,    LY: 0.30, MR: 3,    JO: 0.10,
  SN: 25,   CI: 25,   GA: 25,   CM: 25,   KE: 10,
  FR: 0.05, ES: 0.05, BE: 0.05, DE: 0.05, IT: 0.05, NL: 0.05, PT: 0.05,
  GB: 0.05,
  US: 0.05,
}

// ─── calculateContextualFee ───────────────────────────────────────────────────

export function calculateContextualFee(
  orderTotal:    number,
  country:       string,
  isSocialAction: boolean,
  itemCount = 1
): number {
  if (isSocialAction) return SOCIAL_FEE[country] ?? SOCIAL_FEE['MA']

  const tiers = COUNTRY_TIERS[country] ?? MA_TIERS
  let fee = tiers[tiers.length - 1].fee
  for (const tier of tiers) {
    if (orderTotal < tier.max) { fee = tier.fee; break }
  }

  // 5% discount when the order has 2 or more items
  if (itemCount >= 2) fee = parseFloat((fee * 0.95).toFixed(2))

  return fee
}

// ─── applyOrderFee ────────────────────────────────────────────────────────────

export async function applyOrderFee(
  tx:             Prisma.TransactionClient,
  cafeId:         string,
  orderId:        string,
  orderTotal:     number,
  country:        string,
  isSocialAction = false,
  itemCount = 1
): Promise<void> {
  const cafe = await tx.cafe.findUnique({
    where:  { id: cafeId },
    select: { trialEndsAt: true, walletBalance: true, hasSocialShareAddon: true }
  })

  if (!cafe) throw new Error(`Cafe ${cafeId} not found`)

  if (cafe.trialEndsAt && new Date() < cafe.trialEndsAt) return
  if (isSocialAction && !cafe.hasSocialShareAddon) return

  const fee             = calculateContextualFee(orderTotal, country, isSocialAction, itemCount)
  const previousBalance = cafe.walletBalance
  const newBalance      = previousBalance - fee

  await tx.cafe.update({
    where: { id: cafeId },
    data:  { walletBalance: newBalance, billingStatus: 'COLLECTING_DEBT' }
  })

  await tx.walletLog.create({
    data: {
      cafeId,
      orderId:         orderId || null,
      amount:          -fee,
      type:            isSocialAction ? 'DEBT_ACC_SOCIAL' : 'DEBT_ACC_ORDER',
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
    _avg:   { totalPrice: true },
    _count: { id: true }
  })

  return {
    aov:        result._avg.totalPrice ?? 0,
    orderCount: result._count.id
  }
}

// ─── suggestBillingTiers ──────────────────────────────────────────────────────

export async function suggestBillingTiers(cafeId: string, country: string): Promise<void> {
  const { aov } = await computeCafeAOV(cafeId)
  await prisma.billingTier.deleteMany({ where: { cafeId } })

  const tiers = COUNTRY_TIERS[country] ?? MA_TIERS
  const base  = Math.max(aov * 0.3, tiers[0].fee * 10)

  const derived = [
    { min: 0,          max: base,       fee: tiers[0].fee },
    { min: base,       max: base * 2,   fee: tiers[1]?.fee ?? tiers[0].fee },
    { min: base * 2,   max: base * 3.5, fee: tiers[2]?.fee ?? tiers[0].fee },
    { min: base * 3.5, max: base * 5,   fee: tiers[3]?.fee ?? tiers[0].fee },
    { min: base * 5,   max: base * 7,   fee: tiers[4]?.fee ?? tiers[0].fee },
    { min: base * 7,   max: 99999,      fee: tiers[5]?.fee ?? tiers[0].fee },
  ]

  await prisma.billingTier.createMany({
    data: derived.map((t) => ({
      cafeId,
      country,
      minOrderValue:    parseFloat(t.min.toFixed(2)),
      maxOrderValue:    parseFloat(t.max.toFixed(2)),
      feeAmount:        parseFloat(t.fee.toFixed(2)),
      isSocialShareFee: false
    }))
  })
}

// ─── Export tiers for display (landing page / superadmin) ────────────────────

export { COUNTRY_TIERS, MA_TIERS, SA_TIERS, AE_TIERS, EUR_TIERS }
