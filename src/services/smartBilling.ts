/**
 * Smart Subscription Engine
 *
 * Business model:
 *   After the 7-day silent trial the system analyses each café's weekly order
 *   volume and derives a monthly fee from their own menu prices.
 *
 *   ECONOMY  tier (<50 orders/week)
 *     monthly = avg(coffeePrice × 10,  sandwichPrice × 4)
 *     reading: "one coffee every 3 days  OR  one sandwich per week"
 *
 *   ADVANCED tier (≥50 orders/week)
 *     monthly = avg(coffeePrice × 30,  sandwichPrice × 12)
 *     reading: "one coffee daily  OR  three sandwiches per week"
 */

import prisma from '../prisma'
import logger from '../logger'

export type SubscriptionTier = 'ECONOMY' | 'ADVANCED'

export interface SmartSubscriptionResult {
  weeklyOrderCount: number
  tier:             SubscriptionTier
  coffeePrice:      number
  sandwichPrice:    number
  monthlyFee:       number
}

// ─── Price auto-detection ─────────────────────────────────────────────────────

const COFFEE_KEYWORDS   = ['coffee', 'café', 'cafe', 'قهوة', 'كافيه', 'espresso', 'latte', 'cappuccino', 'nescafe', 'مشروب', 'drinks']
const SANDWICH_KEYWORDS = ['sandwich', 'سندوتش', 'ساندويش', 'burger', 'برغر', 'panini', 'wrap', 'وجبة', 'meal', 'food', 'plat']

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some(k => lower.includes(k))
}

async function autoDetectRefPrices(cafeId: string): Promise<{ coffeePrice: number; sandwichPrice: number }> {
  const products = await prisma.product.findMany({
    where: { isAvailable: true, category: { cafeId } },
    select: { price: true, nameAr: true, nameEn: true, nameFr: true, category: { select: { nameAr: true, nameEn: true } } }
  })

  const coffeePrices:   number[] = []
  const sandwichPrices: number[] = []

  for (const p of products) {
    const text = [p.nameAr, p.nameEn, p.nameFr, p.category.nameAr, p.category.nameEn].join(' ')
    if (matchesKeywords(text, COFFEE_KEYWORDS))   coffeePrices.push(p.price)
    if (matchesKeywords(text, SANDWICH_KEYWORDS)) sandwichPrices.push(p.price)
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0

  // Fallback: if no coffee found → use median product price as proxy
  const allPrices = products.map(p => p.price).sort((a, b) => a - b)
  const median    = allPrices[Math.floor(allPrices.length / 2)] ?? 0

  return {
    coffeePrice:   coffeePrices.length   ? avg(coffeePrices)   : median * 0.4,
    sandwichPrice: sandwichPrices.length ? avg(sandwichPrices) : median
  }
}

// ─── Core calculation ─────────────────────────────────────────────────────────

function calcMonthlyFee(tier: SubscriptionTier, coffeePrice: number, sandwichPrice: number): number {
  if (tier === 'ECONOMY') {
    const optionA = coffeePrice   * 10   // one coffee every 3 days
    const optionB = sandwichPrice * 4    // one sandwich per week
    return parseFloat(((optionA + optionB) / 2).toFixed(2))
  }
  const optionA = coffeePrice   * 30   // one coffee daily
  const optionB = sandwichPrice * 12   // three sandwiches per week
  return parseFloat(((optionA + optionB) / 2).toFixed(2))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute (but do NOT persist) the smart subscription for a café.
 * Uses saved ref prices if present; otherwise auto-detects from menu.
 */
export async function computeSmartSubscription(cafeId: string): Promise<SmartSubscriptionResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [weeklyOrderCount, cafe] = await Promise.all([
    prisma.order.count({ where: { cafeId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { coffeeRefPrice: true, sandwichRefPrice: true }
    })
  ])

  let coffeePrice:   number
  let sandwichPrice: number

  if (cafe?.coffeeRefPrice && cafe.coffeeRefPrice > 0 && cafe?.sandwichRefPrice && cafe.sandwichRefPrice > 0) {
    coffeePrice   = cafe.coffeeRefPrice
    sandwichPrice = cafe.sandwichRefPrice
  } else {
    ;({ coffeePrice, sandwichPrice } = await autoDetectRefPrices(cafeId))
  }

  const tier       = weeklyOrderCount >= 50 ? 'ADVANCED' : 'ECONOMY'
  const monthlyFee = calcMonthlyFee(tier, coffeePrice, sandwichPrice)

  return { weeklyOrderCount, tier, coffeePrice, sandwichPrice, monthlyFee }
}

/**
 * Run smart subscription analysis for a single café and persist the result.
 */
export async function applySmartSubscription(cafeId: string): Promise<SmartSubscriptionResult> {
  const result = await computeSmartSubscription(cafeId)

  await prisma.cafe.update({
    where: { id: cafeId },
    data: {
      subscriptionTier: result.tier,
      monthlyFee:       result.monthlyFee,
      weeklyOrderCount: result.weeklyOrderCount,
      coffeeRefPrice:   result.coffeePrice,
      sandwichRefPrice: result.sandwichPrice,
      billingStatus:    'COLLECTING_DEBT'
    }
  })

  logger.info({
    msg:              'Smart subscription applied',
    cafeId,
    tier:             result.tier,
    monthlyFee:       result.monthlyFee,
    weeklyOrderCount: result.weeklyOrderCount
  })

  return result
}

/**
 * Sweep all cafes whose trial ended but haven't been analysed yet.
 * Called by the weekly cron and the manual superadmin trigger.
 * Returns the list of processed cafeIds.
 */
export async function runTrialEndSweep(): Promise<{ cafeId: string; result: SmartSubscriptionResult }[]> {
  const now = new Date()

  const expired = await prisma.cafe.findMany({
    where: {
      trialEndsAt:     { lte: now },
      isActive:        true,
      subscriptionTier: null        // not yet analysed
    },
    select: { id: true }
  })

  const results: { cafeId: string; result: SmartSubscriptionResult }[] = []

  for (const cafe of expired) {
    try {
      const result = await applySmartSubscription(cafe.id)
      results.push({ cafeId: cafe.id, result })
    } catch (err) {
      logger.error({ msg: 'runTrialEndSweep: failed for cafe', cafeId: cafe.id, err })
    }
  }

  logger.info({ msg: 'Trial-end sweep complete', processed: results.length })
  return results
}

/**
 * Returns cafes whose trial ends within the next N hours (default 24h).
 * Used by the n8n webhook to fire WhatsApp payment reminders.
 */
export async function getExpiringTrials(withinHours = 24) {
  const now     = new Date()
  const cutoff  = new Date(now.getTime() + withinHours * 60 * 60 * 1000)

  const cafes = await prisma.cafe.findMany({
    where: {
      trialEndsAt: { gt: now, lte: cutoff },
      isActive:    true
    },
    select: {
      id: true, name: true, businessName: true, subdomain: true,
      country: true, currency: true, trialEndsAt: true,
      subscriptionTier: true, monthlyFee: true,
      coffeeRefPrice: true, sandwichRefPrice: true,
      weeklyOrderCount: true
    }
  })

  // For cafes not yet analysed, compute on the fly (don't persist)
  return Promise.all(cafes.map(async (cafe) => {
    if (!cafe.subscriptionTier || !cafe.monthlyFee) {
      const preview = await computeSmartSubscription(cafe.id)
      return { ...cafe, ...preview, preview: true }
    }
    return { ...cafe, preview: false }
  }))
}
