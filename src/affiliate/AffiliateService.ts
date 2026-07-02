// ─── Referral & Affiliate Platform (K28) ───────────────────────────────────
// Conversion detection reuses the existing billing platform's InvoicePaid
// event (BillingEvents.ts, K5/K11 event standardization) via eventBus — this
// module never watches payments directly, it reacts to the same event the
// billing module already publishes. Commission math is deliberately simple
// (single rate per affiliate); payout is "ready" (status + timestamps) but
// executing the transfer is left to the existing PaymentService/manual
// process, same posture as K23's "SMS-ready" and K26's un-integrated SMS.

import crypto from 'crypto'
import prisma from '../prisma'
import logger from '../logger'
import { eventBus, publishStandardEvent } from '../core'

export interface CreateAffiliateInput {
  name:            string
  email:           string
  phone?:          string
  commissionType?: 'PERCENT' | 'FIXED'
  commissionValue?: number
}

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase() // e.g. "A1B2C3D4"
}

// ─── Affiliate accounts ─────────────────────────────────────────────────────
export async function createAffiliate(input: CreateAffiliateInput) {
  let referralCode = generateReferralCode()
  // Extremely unlikely to collide, but guard anyway since it's @unique.
  while (await prisma.affiliateAccount.findUnique({ where: { referralCode } })) {
    referralCode = generateReferralCode()
  }

  const affiliate = await prisma.affiliateAccount.create({
    data: {
      name:  input.name,
      email: input.email,
      phone: input.phone,
      referralCode,
      commissionType:  input.commissionType ?? 'PERCENT',
      commissionValue: input.commissionValue ?? 10,
    },
  })

  publishStandardEvent('AffiliateCreated', {
    tenantId: affiliate.id, resourceId: affiliate.id, metadata: { referralCode },
  }, 'affiliate-engine')

  return affiliate
}

export async function getAffiliateByCode(referralCode: string) {
  return prisma.affiliateAccount.findUnique({ where: { referralCode } })
}

export async function listAffiliates(status?: string) {
  return prisma.affiliateAccount.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' } })
}

// ─── Referral tracking ──────────────────────────────────────────────────────
// One referral per referred cafe (first-touch attribution) — idempotent:
// calling this again for an already-tracked cafe is a no-op, not an error.
export async function trackReferral(referralCode: string, referredCafeId: string) {
  const existing = await prisma.referralConversion.findUnique({ where: { referredCafeId } })
  if (existing) return existing

  const affiliate = await getAffiliateByCode(referralCode)
  if (!affiliate || affiliate.status !== 'ACTIVE') throw new Error(`Referral code "${referralCode}" is invalid or inactive`)

  const referral = await prisma.referralConversion.create({
    data: { affiliateId: affiliate.id, referralCode, referredCafeId },
  })

  publishStandardEvent('ReferralTracked', {
    tenantId: affiliate.id, resourceId: referral.id, metadata: { referredCafeId, referralCode },
  }, 'affiliate-engine')

  return referral
}

// ─── Conversion + commission ────────────────────────────────────────────────
function calculateCommission(type: string, value: number, amount: number): number {
  return type === 'PERCENT' ? Math.round(amount * value) / 100 : value
}

export async function recordConversion(referredCafeId: string, invoiceAmount: number) {
  const referral = await prisma.referralConversion.findUnique({ where: { referredCafeId } })
  if (!referral || referral.status === 'CONVERTED') return referral

  const affiliate = await prisma.affiliateAccount.findUniqueOrThrow({ where: { id: referral.affiliateId } })
  const commissionAmount = calculateCommission(affiliate.commissionType, affiliate.commissionValue, invoiceAmount)

  const updated = await prisma.referralConversion.update({
    where: { referredCafeId },
    data:  { status: 'CONVERTED', convertedAt: new Date(), commissionAmount, commissionStatus: 'PENDING' },
  })

  publishStandardEvent('ReferralConverted', {
    tenantId: affiliate.id, resourceId: updated.id, metadata: { referredCafeId, invoiceAmount },
  }, 'affiliate-engine')
  publishStandardEvent('CommissionEarned', {
    tenantId: affiliate.id, resourceId: updated.id, metadata: { commissionAmount },
  }, 'affiliate-engine')

  return updated
}

// ─── Commission lifecycle (payout-ready) ───────────────────────────────────
export async function approveCommission(conversionId: string) {
  const conversion = await prisma.referralConversion.findUniqueOrThrow({ where: { id: conversionId } })
  if (conversion.commissionStatus !== 'PENDING') throw new Error(`Commission ${conversionId} is not PENDING`)

  const updated = await prisma.referralConversion.update({ where: { id: conversionId }, data: { commissionStatus: 'APPROVED' } })
  publishStandardEvent('CommissionApproved', { tenantId: conversion.affiliateId, resourceId: conversionId, metadata: {} }, 'affiliate-engine')
  return updated
}

export async function markCommissionPaid(conversionId: string) {
  const conversion = await prisma.referralConversion.findUniqueOrThrow({ where: { id: conversionId } })
  if (conversion.commissionStatus !== 'APPROVED') throw new Error(`Commission ${conversionId} is not APPROVED`)

  const updated = await prisma.referralConversion.update({
    where: { id: conversionId },
    data:  { commissionStatus: 'PAID', paidAt: new Date() },
  })
  publishStandardEvent('CommissionPaid', { tenantId: conversion.affiliateId, resourceId: conversionId, metadata: {} }, 'affiliate-engine')
  return updated
}

// ─── Commission history + summary ──────────────────────────────────────────
export async function getCommissionHistory(affiliateId: string) {
  return prisma.referralConversion.findMany({ where: { affiliateId }, orderBy: { createdAt: 'desc' } })
}

export async function getAffiliateSummary(affiliateId: string) {
  const rows = await prisma.referralConversion.findMany({ where: { affiliateId } })
  return {
    totalReferrals:  rows.length,
    totalConverted:  rows.filter(r => r.status === 'CONVERTED').length,
    totalCommission: rows.reduce((s, r) => s + (r.commissionAmount ?? 0), 0),
    pendingPayout:   rows.filter(r => r.commissionStatus === 'APPROVED').reduce((s, r) => s + (r.commissionAmount ?? 0), 0),
    paidOut:         rows.filter(r => r.commissionStatus === 'PAID').reduce((s, r) => s + (r.commissionAmount ?? 0), 0),
  }
}

// ─── Engine Init ────────────────────────────────────────────────────────────
// Subscribes to the existing billing platform's InvoicePaid event — the
// referred cafe's tenantId is the same id used as referredCafeId elsewhere
// in this codebase's billing integration (K7-K10 convention).
export function initAffiliateEngine(): void {
  eventBus.subscribe('InvoicePaid', async (event: any) => {
    try {
      const { tenantId, metadata } = event.payload as { tenantId: string; metadata?: { total?: number } }
      const amount = metadata?.total
      if (!tenantId || !amount) return
      await recordConversion(tenantId, amount)
    } catch (err) {
      logger.error({ msg: '[AffiliateEngine] InvoicePaid handler failed', err })
    }
  })

  logger.info({ msg: '[AffiliateEngine] initialized — subscribed to InvoicePaid' })
}
