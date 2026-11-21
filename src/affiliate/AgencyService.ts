// ─── Agency partner program ──────────────────────────────────────────────────
// Builds on AffiliateAccount / ReferralConversion (K28). What's new here:
//   • tier computed live from ACTIVE referred restaurants (AgencyTiers.ts)
//   • recurring commission ledger (AffiliateCommission), one row per paid
//     restaurant invoice, hooked into the REAL payment path
//     (superadmin payment-request confirm → BillingInvoice PAID)
//   • client perks applied at signup (fee discount, free menu setup flag)
//   • partner portal auth (email + password → JWT role "affiliate")
//
// "Active restaurant" = referred cafe that has paid at least once
// (ReferralConversion.status CONVERTED) and is currently Cafe.isActive.

import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import prisma from '../prisma'
import logger from '../logger'
import { JWT_SECRET } from '../config'
import { hashPassword, verifyPassword } from '../auth/hash'
import { publishStandardEvent } from '../core'
import {
  tierFor, nextTier, perksFor, CLIENT_DISCOUNT_PCT, FREE_MENU_SETUP_COUNT, type AgencyTier,
} from './AgencyTiers'

const round2 = (n: number) => Math.round(n * 100) / 100

// ─── Tier ────────────────────────────────────────────────────────────────────

export async function countActiveRestaurants(affiliateId: string): Promise<number> {
  const conversions = await prisma.referralConversion.findMany({
    where:  { affiliateId, status: 'CONVERTED' },
    select: { referredCafeId: true },
  })
  if (!conversions.length) return 0
  return prisma.cafe.count({ where: { id: { in: conversions.map(c => c.referredCafeId) }, isActive: true } })
}

export async function getAgencyTier(affiliateId: string) {
  const active = await countActiveRestaurants(affiliateId)
  const def    = tierFor(active)
  const next   = nextTier(def.tier)
  return {
    activeRestaurants: active,
    tier:              def.tier,
    ratePct:           def.ratePct,
    perks:             perksFor(def.tier),
    next: next ? { tier: next.tier, ratePct: next.ratePct, restaurantsNeeded: Math.max(0, next.minActive - active) } : null,
  }
}

// ─── Signup attribution ──────────────────────────────────────────────────────
// Best-effort: a bad/inactive code must never block a restaurant signup.

export async function attachReferralAtSignup(rawCode: unknown, cafeId: string): Promise<void> {
  const code = String(rawCode ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return
  try {
    const affiliate = await prisma.affiliateAccount.findUnique({ where: { referralCode: code } })
    if (!affiliate || affiliate.status !== 'ACTIVE') return
    const existing = await prisma.referralConversion.findUnique({ where: { referredCafeId: cafeId } })
    if (existing) return

    let freeMenuSetup = false
    if (affiliate.type === 'AGENCY') {
      const { perks } = await getAgencyTier(affiliate.id)
      if (perks.freeMenuSetup) {
        const used = await prisma.referralConversion.count({ where: { affiliateId: affiliate.id, freeMenuSetup: true } })
        freeMenuSetup = used < FREE_MENU_SETUP_COUNT
      }
    }

    const referral = await prisma.referralConversion.create({
      data: { affiliateId: affiliate.id, referralCode: code, referredCafeId: cafeId, freeMenuSetup },
    })
    await prisma.cafe.update({
      where: { id: cafeId },
      data:  {
        referredByAffiliateId: affiliate.id,
        partnerDiscountPct:    affiliate.type === 'AGENCY' ? CLIENT_DISCOUNT_PCT : 0,
      },
    })
    publishStandardEvent('ReferralTracked', {
      tenantId: affiliate.id, resourceId: referral.id, metadata: { referredCafeId: cafeId, referralCode: code, freeMenuSetup },
    }, 'affiliate-engine')
  } catch (err) {
    logger.error({ msg: 'Referral attach at signup failed (signup continues)', cafeId, err: (err as Error).message })
  }
}

// ─── Commission on a real payment ────────────────────────────────────────────
// Called after a restaurant's payment is confirmed. Idempotent on sourceKey.

export async function recordInvoiceCommission(input: {
  cafeId: string; sourceKey: string; paidAmount: number; currency: string
}): Promise<void> {
  try {
    if (!(input.paidAmount > 0)) return
    // App-level idempotency too — the @unique on sourceKey only exists after `prisma db push`.
    if (await prisma.affiliateCommission.findUnique({ where: { sourceKey: input.sourceKey }, select: { id: true } })) return
    const referral = await prisma.referralConversion.findUnique({ where: { referredCafeId: input.cafeId } })
    if (!referral || referral.status === 'REJECTED') return
    const affiliate = await prisma.affiliateAccount.findUnique({ where: { id: referral.affiliateId } })
    if (!affiliate || affiliate.status !== 'ACTIVE') return

    if (referral.status !== 'CONVERTED') {
      await prisma.referralConversion.update({
        where: { id: referral.id },
        data:  { status: 'CONVERTED', convertedAt: new Date() },
      })
    }

    let tier: AgencyTier | 'FLAT' = 'FLAT'
    let ratePct  = 0
    let amount   = 0
    if (affiliate.type === 'AGENCY') {
      const t = await getAgencyTier(affiliate.id)   // counts this restaurant now that it's CONVERTED
      tier    = t.tier
      ratePct = t.ratePct
      amount  = round2(input.paidAmount * ratePct / 100)
    } else {
      // Legacy single-rate affiliate — kept working, now also recurring.
      ratePct = affiliate.commissionType === 'PERCENT' ? affiliate.commissionValue : 0
      amount  = affiliate.commissionType === 'PERCENT'
        ? round2(input.paidAmount * affiliate.commissionValue / 100)
        : affiliate.commissionValue
    }
    if (amount <= 0) return

    try {
      const row = await prisma.affiliateCommission.create({
        data: {
          affiliateId:      affiliate.id,
          referredCafeId:   input.cafeId,
          sourceKey:        input.sourceKey,
          paidAmount:       input.paidAmount,
          currency:         input.currency,
          tier,
          ratePct,
          commissionAmount: amount,
        },
      })
      publishStandardEvent('CommissionEarned', {
        tenantId: affiliate.id, resourceId: row.id, metadata: { commissionAmount: amount, tier, cafeId: input.cafeId },
      }, 'affiliate-engine')
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') return // already recorded
      throw err
    }
  } catch (err) {
    // Never fail the payment confirmation because of a commission problem.
    logger.error({ msg: 'Agency commission recording failed', ...input, err: (err as Error).message })
  }
}

// ─── Commission lifecycle (superadmin) ───────────────────────────────────────

export async function setCommissionStatus(id: string, to: 'APPROVED' | 'PAID') {
  const from = to === 'APPROVED' ? 'PENDING' : 'APPROVED'
  const r = await prisma.affiliateCommission.updateMany({
    where: { id, status: from },
    data:  to === 'APPROVED' ? { status: to, approvedAt: new Date() } : { status: to, paidAt: new Date() },
  })
  if (r.count !== 1) throw new Error(`Commission is not ${from}`)
  publishStandardEvent(to === 'APPROVED' ? 'CommissionApproved' : 'CommissionPaid', { tenantId: id, resourceId: id, metadata: {} }, 'affiliate-engine')
}

// ─── Agency accounts ─────────────────────────────────────────────────────────

function tempPassword(): string {
  return crypto.randomBytes(9).toString('base64url') // 12 chars
}

export async function createAgency(input: { name: string; email: string; phone?: string }) {
  let referralCode = crypto.randomBytes(4).toString('hex').toUpperCase()
  while (await prisma.affiliateAccount.findUnique({ where: { referralCode } })) {
    referralCode = crypto.randomBytes(4).toString('hex').toUpperCase()
  }
  const password = tempPassword()
  const agency = await prisma.affiliateAccount.create({
    data: {
      name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: input.phone?.trim() || null,
      referralCode, type: 'AGENCY', passwordHash: await hashPassword(password),
    },
  })
  publishStandardEvent('AffiliateCreated', { tenantId: agency.id, resourceId: agency.id, metadata: { referralCode, type: 'AGENCY' } }, 'affiliate-engine')
  return { agency, temporaryPassword: password }
}

export async function resetAgencyPassword(id: string) {
  const password = tempPassword()
  await prisma.affiliateAccount.update({ where: { id }, data: { passwordHash: await hashPassword(password) } })
  return password
}

// ─── Partner portal auth ─────────────────────────────────────────────────────

const PARTNER_TOKEN_TTL = '7d'
let dummyHash: Promise<string> | null = null   // equalises timing for unknown emails

export async function partnerLogin(email: string, password: string): Promise<string | null> {
  const a = await prisma.affiliateAccount.findUnique({ where: { email: String(email).trim().toLowerCase() } })
  // Always run a compare so response time doesn't reveal whether the email exists.
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString('hex'))
  const ok = await verifyPassword(String(password), a?.passwordHash ?? await dummyHash)
  if (!a || !a.passwordHash || !ok || a.status !== 'ACTIVE') return null
  await prisma.affiliateAccount.update({ where: { id: a.id }, data: { lastLoginAt: new Date() } })
  return jwt.sign({ affiliateId: a.id, role: 'affiliate' }, JWT_SECRET, { expiresIn: PARTNER_TOKEN_TTL })
}

export function verifyPartnerToken(header: unknown): string | null {
  const m = /^Bearer (.+)$/.exec(String(header ?? ''))
  if (!m) return null
  try {
    const p = jwt.verify(m[1], JWT_SECRET) as { affiliateId?: string; role?: string }
    return p.role === 'affiliate' && p.affiliateId ? p.affiliateId : null
  } catch { return null }
}

export async function changePartnerPassword(affiliateId: string, current: string, next: string) {
  const a = await prisma.affiliateAccount.findUnique({ where: { id: affiliateId } })
  if (!a?.passwordHash || !(await verifyPassword(current, a.passwordHash))) throw new Error('BAD_PASSWORD')
  if (String(next).length < 8) throw new Error('WEAK_PASSWORD')
  await prisma.affiliateAccount.update({ where: { id: affiliateId }, data: { passwordHash: await hashPassword(next) } })
}

// ─── Dashboard data (portal + superadmin detail) ─────────────────────────────

export async function getAgencyDashboard(affiliateId: string) {
  const a = await prisma.affiliateAccount.findUniqueOrThrow({ where: { id: affiliateId } })
  const [tier, referrals, commissions] = await Promise.all([
    getAgencyTier(affiliateId),
    prisma.referralConversion.findMany({ where: { affiliateId }, orderBy: { createdAt: 'desc' } }),
    prisma.affiliateCommission.findMany({ where: { affiliateId }, orderBy: { createdAt: 'desc' } }),
  ])
  const cafes = referrals.length
    ? await prisma.cafe.findMany({
        where:  { id: { in: referrals.map(r => r.referredCafeId) } },
        select: { id: true, name: true, subdomain: true, country: true, isActive: true },
      })
    : []
  const cafeMap = new Map(cafes.map(c => [c.id, c]))

  const sum = (rows: typeof commissions) => round2(rows.reduce((s, r) => s + r.commissionAmount, 0))
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  // Last 6 months of earned commission
  const months: { month: string; amount: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(monthStart); d.setMonth(d.getMonth() - i)
    const end = new Date(d); end.setMonth(end.getMonth() + 1)
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` // local month, not UTC
    months.push({ month: label, amount: sum(commissions.filter(c => c.createdAt >= d && c.createdAt < end)) })
  }

  return {
    agency: {
      id: a.id, name: a.name, email: a.email, phone: a.phone, type: a.type, status: a.status,
      referralCode: a.referralCode, accountManager: a.accountManager, coBrandName: a.coBrandName, createdAt: a.createdAt,
    },
    tier,
    totals: {
      referred:     referrals.length,
      thisMonth:    sum(commissions.filter(c => c.createdAt >= monthStart)),
      pending:      sum(commissions.filter(c => c.status === 'PENDING')),
      approved:     sum(commissions.filter(c => c.status === 'APPROVED')),
      paid:         sum(commissions.filter(c => c.status === 'PAID')),
      lifetime:     sum(commissions),
      currency:     commissions[0]?.currency ?? null,
    },
    months,
    restaurants: referrals.map(r => {
      const c    = cafeMap.get(r.referredCafeId)
      const rows = commissions.filter(x => x.referredCafeId === r.referredCafeId)
      return {
        cafeId:        r.referredCafeId,
        name:          c?.name ?? '—',
        country:       c?.country ?? null,
        isActive:      !!c?.isActive,
        status:        r.status,              // TRACKED (signed up) | CONVERTED (paying) | REJECTED
        freeMenuSetup: r.freeMenuSetup,
        joinedAt:      r.createdAt,
        totalPaid:     round2(rows.reduce((s, x) => s + x.paidAmount, 0)),
        commission:    sum(rows),
      }
    }),
    commissions: commissions.slice(0, 100).map(c => ({
      id: c.id, cafeName: cafeMap.get(c.referredCafeId)?.name ?? '—', paidAmount: c.paidAmount, currency: c.currency,
      tier: c.tier, ratePct: c.ratePct, commissionAmount: c.commissionAmount, status: c.status, createdAt: c.createdAt,
    })),
  }
}
