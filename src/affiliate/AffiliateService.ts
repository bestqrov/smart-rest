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
import { recordInvoiceCommission } from './AgencyService'

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

// Commission recording + approve/pay moved to AgencyService (recurring ledger,
// AffiliateCommission). ReferralConversion is now the attribution record only.

// ─── Commission history + summary ──────────────────────────────────────────
export async function getCommissionHistory(affiliateId: string) {
  return prisma.affiliateCommission.findMany({ where: { affiliateId }, orderBy: { createdAt: 'desc' } })
}

export async function getAffiliateSummary(affiliateId: string) {
  const [referrals, rows] = await Promise.all([
    prisma.referralConversion.findMany({ where: { affiliateId }, select: { status: true } }),
    prisma.affiliateCommission.findMany({ where: { affiliateId }, select: { commissionAmount: true, status: true } }),
  ])
  const sum = (f: (r: typeof rows[number]) => boolean) => rows.filter(f).reduce((s, r) => s + r.commissionAmount, 0)
  return {
    totalReferrals:  referrals.length,
    totalConverted:  referrals.filter(r => r.status === 'CONVERTED').length,
    totalCommission: sum(() => true),
    pendingPayout:   sum(r => r.status === 'APPROVED'),
    paidOut:         sum(r => r.status === 'PAID'),
  }
}

// ─── Engine Init ────────────────────────────────────────────────────────────
// Subscribes to the existing billing platform's InvoicePaid event — the
// referred cafe's tenantId is the same id used as referredCafeId elsewhere
// in this codebase's billing integration (K7-K10 convention).
export function initAffiliateEngine(): void {
  // Platform-invoice payments (billing orchestrator). Today the real payment
  // path is superadmin payment-request confirm, which calls
  // recordInvoiceCommission directly; this keeps both paths on one function.
  eventBus.subscribe('InvoicePaid', async (event: any) => {
    try {
      const { tenantId, resourceId, metadata } = event.payload as { tenantId: string; resourceId?: string; metadata?: { total?: number; currency?: string } }
      if (!tenantId || !resourceId || !metadata?.total) return
      await recordInvoiceCommission({
        cafeId: tenantId, sourceKey: `platformInvoice:${resourceId}`,
        paidAmount: metadata.total, currency: metadata.currency ?? '',
      })
    } catch (err) {
      logger.error({ msg: '[AffiliateEngine] InvoicePaid handler failed', err })
    }
  })

  logger.info({ msg: '[AffiliateEngine] initialized — subscribed to InvoicePaid' })
}
