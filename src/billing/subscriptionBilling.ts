// ─── Subscription billing — monthly invoices, payment, dunning ───────────────
// Owner decisions (2026-11-21):
//   • Two ways to pay: bank transfer (confirmed by superadmin) and card via
//     the PLATFORM's own Tap account — Tap stays off until the owner enables
//     it in Superadmin → الفوترة → إعدادات الدفع.
//   • Dunning: reminder at due+3d, second reminder at due+7d, suspension at
//     due+14d. Suspension locks the restaurant ADMIN dashboard only; the guest
//     menu and staff screens keep working. Paying lifts it immediately.
//
// Invoice = BillingInvoice with planId set. Amount = Cafe.monthlyFee (set at
// activation from lib/gulfPlans.ts, add-ons included), in the plan currency.
// Venue billing period is anchored on its activation date (Cafe.currentPeriodEnd).

import crypto from 'crypto'
import prisma from '../prisma'
import logger from '../logger'
import { sendEmail } from '../services/email'
import { sendMessage } from '../whatsapp/WhatsAppEngine'
import { encryptSecret, decryptSecret, isEncryptionConfigured } from '../payments/online/secretBox'
import { createCheckout, fetchStatus, testCredentials, looksLikeSecretKey, minorFactor } from '../payments/online/gateways'
import { recordInvoiceCommission } from '../affiliate/AgencyService'
import { planCurrencyFor } from '../../lib/gulfPlans'

export const DUE_DAYS       = 7
export const REMINDER1_DAYS = 3
export const REMINDER2_DAYS = 7
export const SUSPEND_DAYS   = 14
const DAY = 24 * 3600 * 1000

export class BillingError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) { super(message) }
}

// ─── Platform payment settings (bank + Tap), stored in SiteConfig ────────────

const SETTINGS_KEY = 'platformPayment'

export interface PlatformPaymentSettings {
  bankName:      string
  accountHolder: string
  iban:          string
  swift:         string
  instructions:  string
  tapEnabled:    boolean
  tapSecretEnc:  string
  tapSecretHint: string
}

const EMPTY: PlatformPaymentSettings = {
  bankName: '', accountHolder: '', iban: '', swift: '', instructions: '',
  tapEnabled: false, tapSecretEnc: '', tapSecretHint: '',
}

export async function getPlatformPaymentSettings(): Promise<PlatformPaymentSettings> {
  const row = await prisma.siteConfig.findUnique({ where: { key: SETTINGS_KEY } })
  return { ...EMPTY, ...((row?.value as Partial<PlatformPaymentSettings>) ?? {}) }
}

/** Public view — never exposes the encrypted key. */
export function publicSettings(s: PlatformPaymentSettings) {
  return {
    bankName: s.bankName, accountHolder: s.accountHolder, iban: s.iban, swift: s.swift, instructions: s.instructions,
    bankConfigured: !!(s.iban && s.accountHolder),
    cardEnabled:    s.tapEnabled && !!s.tapSecretEnc,
  }
}

export async function savePlatformPaymentSettings(input: {
  bankName?: string; accountHolder?: string; iban?: string; swift?: string; instructions?: string
  tapEnabled?: boolean; tapSecretKey?: string
}) {
  const cur  = await getPlatformPaymentSettings()
  const next = { ...cur }
  const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)
  if (input.bankName      !== undefined) next.bankName      = clip(input.bankName, 120)
  if (input.accountHolder !== undefined) next.accountHolder = clip(input.accountHolder, 120)
  if (input.iban          !== undefined) next.iban          = clip(input.iban, 40).replace(/\s+/g, '').toUpperCase()
  if (input.swift         !== undefined) next.swift         = clip(input.swift, 15).toUpperCase()
  if (input.instructions  !== undefined) next.instructions  = clip(input.instructions, 500)

  const key = String(input.tapSecretKey ?? '').trim()
  if (key) {
    if (!isEncryptionConfigured()) throw new BillingError('NO_ENCRYPTION', 'PAYMENT_ENCRYPTION_KEY missing', 503)
    if (!looksLikeSecretKey('TAP', key)) throw new BillingError('BAD_KEY_FORMAT', 'Not a Tap secret key')
    try { await testCredentials('TAP', key) } catch { throw new BillingError('KEY_REJECTED', 'Tap rejected this key') }
    next.tapSecretEnc  = encryptSecret(key)
    next.tapSecretHint = key.slice(-4)
  }
  if (input.tapEnabled !== undefined) {
    if (input.tapEnabled && !next.tapSecretEnc) throw new BillingError('NO_TAP_KEY', 'Add a Tap key before enabling card payments')
    next.tapEnabled = !!input.tapEnabled
  }

  await prisma.siteConfig.upsert({
    where:  { key: SETTINGS_KEY },
    update: { value: next as object },
    create: { key: SETTINGS_KEY, value: next as object },
  })
  return publicSettings(next)
}

// ─── Issuing invoices ────────────────────────────────────────────────────────

function addMonth(d: Date): Date { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x }

async function nextInvoiceNumber(): Promise<string> {
  const year  = new Date().getFullYear()
  const count = await prisma.billingInvoice.count({ where: { issuedAt: { gte: new Date(`${year}-01-01`) } } })
  return `INV-${year}-${String(count + 1).padStart(5, '0')}`
}

/** Issue the next invoice for one venue if its period has ended. Returns the invoice or null. */
export async function issueDueInvoiceFor(cafeId: string, now = new Date()) {
  const cafe = await prisma.cafe.findUnique({
    where:  { id: cafeId },
    select: { id: true, name: true, planId: true, isActive: true, monthlyFee: true, currency: true, currentPeriodEnd: true },
  })
  if (!cafe?.planId || !cafe.isActive || !(cafe.monthlyFee && cafe.monthlyFee > 0)) return null
  if (cafe.currentPeriodEnd && cafe.currentPeriodEnd > now) return null

  const periodStart = cafe.currentPeriodEnd ?? now
  const periodEnd   = addMonth(periodStart)

  // Claim the period first (atomic on the old value) so a double run can't bill twice.
  // Mongo: a field that was never written is "unset", which `null` doesn't match.
  const unsetOrNull = { OR: [{ currentPeriodEnd: { isSet: false } }, { currentPeriodEnd: null }] }
  const claim = await prisma.cafe.updateMany({
    where: { id: cafe.id, ...(cafe.currentPeriodEnd ? { currentPeriodEnd: cafe.currentPeriodEnd } : unsetOrNull) },
    data:  { currentPeriodEnd: periodEnd },
  })
  if (claim.count !== 1) return null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const inv = await prisma.billingInvoice.create({
        data: {
          cafeId:        cafe.id,
          invoiceNumber: await nextInvoiceNumber(),
          amount:        cafe.monthlyFee,
          currency:      planCurrencyFor(cafe.currency),
          planId:        cafe.planId,
          periodStart,
          periodEnd,
          dueAt:         new Date(now.getTime() + DUE_DAYS * DAY),
          payToken:      crypto.randomBytes(24).toString('base64url'),
          status:        'ISSUED',
        },
      })
      await notify(inv.id, 'issued')
      logger.info({ msg: 'Subscription invoice issued', cafeId: cafe.id, invoice: inv.invoiceNumber, amount: inv.amount, currency: inv.currency })
      return inv
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') continue // invoice number race — retry
      // Release the claimed period so the next run retries.
      await prisma.cafe.updateMany({ where: { id: cafe.id, currentPeriodEnd: periodEnd }, data: { currentPeriodEnd: cafe.currentPeriodEnd ?? null } })
      throw err
    }
  }
  return null
}

// ─── Paying ──────────────────────────────────────────────────────────────────

export async function markInvoicePaid(invoiceId: string, method: 'BANK_TRANSFER' | 'CARD', ref?: string) {
  const r = await prisma.billingInvoice.updateMany({
    where: { id: invoiceId, status: { in: ['ISSUED', 'PENDING_CONFIRMATION'] } },
    data:  { status: 'PAID', paidAt: new Date(), method, ...(ref ? { transferRef: ref } : {}) },
  })
  if (r.count !== 1) return false
  const inv = await prisma.billingInvoice.findUniqueOrThrow({ where: { id: invoiceId } })

  // Agency commission on what was actually paid (idempotent per invoice).
  await recordInvoiceCommission({ cafeId: inv.cafeId, sourceKey: `billingInvoice:${inv.id}`, paidAmount: inv.amount, currency: inv.currency })

  await refreshSuspension(inv.cafeId)

  await notify(inv.id, 'paid')
  logger.info({ msg: 'Subscription invoice paid', invoice: inv.invoiceNumber, method })
  return true
}

/** Lift the suspension when no invoice is 14+ days overdue any more (after pay or void). */
export async function refreshSuspension(cafeId: string) {
  const stillOverdue = await prisma.billingInvoice.count({
    where: { cafeId, status: 'ISSUED', planId: { not: null }, dueAt: { lt: new Date(Date.now() - SUSPEND_DAYS * DAY) } },
  })
  if (!stillOverdue) await prisma.cafe.update({ where: { id: cafeId }, data: { subscriptionSuspended: false } })
}

async function invoiceByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new BillingError('NOT_FOUND', 'Invoice not found', 404)
  const inv = await prisma.billingInvoice.findFirst({ where: { payToken: token } })
  if (!inv) throw new BillingError('NOT_FOUND', 'Invoice not found', 404)
  return inv
}

export async function getPublicInvoice(token: string) {
  const inv  = await invoiceByToken(token)
  const cafe = await prisma.cafe.findUnique({ where: { id: inv.cafeId }, select: { name: true } })
  const settings = publicSettings(await getPlatformPaymentSettings())
  return {
    invoiceNumber: inv.invoiceNumber, cafeName: cafe?.name ?? '', planId: inv.planId,
    amount: inv.amount, currency: inv.currency, status: inv.status,
    periodStart: inv.periodStart, periodEnd: inv.periodEnd, dueAt: inv.dueAt, paidAt: inv.paidAt,
    transferRef: inv.transferRef,
    payment: settings,
  }
}

export async function reportTransfer(token: string, reference: string) {
  const inv = await invoiceByToken(token)
  const ref = String(reference ?? '').trim().slice(0, 80)
  if (ref.length < 3) throw new BillingError('BAD_REF', 'Reference required')
  const r = await prisma.billingInvoice.updateMany({
    where: { id: inv.id, status: 'ISSUED' },
    data:  { status: 'PENDING_CONFIRMATION', transferRef: ref, transferReportedAt: new Date() },
  })
  if (r.count !== 1) throw new BillingError('NOT_PAYABLE', 'Invoice is not awaiting payment', 409)
  logger.info({ msg: 'Transfer reported', invoice: inv.invoiceNumber, ref })
  return { status: 'PENDING_CONFIRMATION' }
}

async function platformTapKey(): Promise<string> {
  const s = await getPlatformPaymentSettings()
  if (!s.tapEnabled || !s.tapSecretEnc) throw new BillingError('CARD_DISABLED', 'Card payment is not enabled', 400)
  return decryptSecret(s.tapSecretEnc)
}

export async function startCardPayment(token: string, origin: string) {
  const inv = await invoiceByToken(token)
  if (inv.status !== 'ISSUED') throw new BillingError('NOT_PAYABLE', 'Invoice is not awaiting payment', 409)
  const secretKey = await platformTapKey()
  const { providerRef, redirectUrl } = await createCheckout('TAP', {
    secretKey,
    amount:      inv.amount,
    currency:    inv.currency,
    payId:       inv.id,
    description: `SmartRestau ${inv.invoiceNumber}`,
    returnUrl:   `${origin}/billing/pay/${token}?check=1`,
    callbackUrl: `${origin}/api/billing/pay/${token}/callback`,
  })
  await prisma.billingInvoice.update({ where: { id: inv.id }, data: { tapChargeId: providerRef } })
  return { redirectUrl }
}

/** Re-fetch the Tap charge with the platform key; never trust callback bodies. */
export async function verifyCardPayment(token: string) {
  const inv = await invoiceByToken(token)
  if (inv.status === 'PAID') return { status: 'PAID' }
  if (!inv.tapChargeId) return { status: inv.status }
  const st = await fetchStatus('TAP', await platformTapKey(), inv.tapChargeId)
  if (!st.paid) return { status: st.failed ? 'FAILED' : inv.status }
  const tol = 1 / minorFactor(inv.currency)
  if (st.currency !== inv.currency.toUpperCase() || st.amount + tol < inv.amount) {
    logger.error({ msg: 'Subscription card payment amount/currency mismatch — not settling', invoice: inv.invoiceNumber, got: st })
    return { status: 'FAILED' }
  }
  await markInvoicePaid(inv.id, 'CARD', inv.tapChargeId)
  return { status: 'PAID' }
}

// ─── Notifications (email + WhatsApp, best-effort) ───────────────────────────

type NotifyKind = 'issued' | 'reminder1' | 'reminder2' | 'suspended' | 'paid'

async function notify(invoiceId: string, kind: NotifyKind) {
  try {
    const inv  = await prisma.billingInvoice.findUniqueOrThrow({ where: { id: invoiceId } })
    const cafe = await prisma.cafe.findUniqueOrThrow({
      where: { id: inv.cafeId }, select: { id: true, name: true, ownerPhone: true, ownerEmail: true, users: { select: { email: true }, take: 1 } },
    })
    const base   = process.env.FRONTEND_URL ?? 'https://smartrestau.com'
    const link   = `${base}/billing/pay/${inv.payToken}`
    const amount = `${inv.amount.toLocaleString('en-US')} ${inv.currency}`
    const due    = inv.dueAt ? inv.dueAt.toISOString().slice(0, 10) : ''
    const lines: Record<NotifyKind, { subject: string; body: string }> = {
      issued:    { subject: `فاتورة اشتراك SmartRestau ${inv.invoiceNumber}`, body: `مرحباً ${cafe.name}،\nفاتورة اشتراكك لهذا الشهر: ${amount}.\nآخر أجل للدفع: ${due}.\nالدفع والتفاصيل: ${link}` },
      reminder1: { subject: `تذكير: فاتورة ${inv.invoiceNumber} متأخرة`, body: `مرحباً ${cafe.name}،\nلم نستلم بعد دفعة فاتورتك ${inv.invoiceNumber} (${amount}) التي استحقت في ${due}.\nادفع الآن: ${link}` },
      reminder2: { subject: `تذكير ثانٍ: فاتورة ${inv.invoiceNumber}`, body: `مرحباً ${cafe.name}،\nفاتورتك ${inv.invoiceNumber} (${amount}) متأخرة منذ أسبوع. سيتم إيقاف لوحة التحكم مؤقتاً بعد 7 أيام إذا لم يتم الدفع.\nادفع الآن: ${link}` },
      suspended: { subject: `تم إيقاف لوحة التحكم مؤقتاً — ${cafe.name}`, body: `مرحباً ${cafe.name}،\nتم إيقاف لوحة التحكم مؤقتاً بسبب عدم دفع الفاتورة ${inv.invoiceNumber} (${amount}). قائمة الطعام والطلبات للزبائن ما زالت تعمل.\nبمجرد الدفع يُعاد التفعيل فوراً: ${link}` },
      paid:      { subject: `تم استلام الدفعة — ${inv.invoiceNumber}`, body: `شكراً ${cafe.name}! تم استلام دفعة الفاتورة ${inv.invoiceNumber} (${amount}).` },
    }
    const { subject, body } = lines[kind]
    const email = cafe.ownerEmail || cafe.users[0]?.email
    if (email && !email.endsWith('@whatsapp.smartmenu.ma')) {
      await sendEmail(email, subject, `<div dir="rtl" style="font-family:sans-serif;white-space:pre-line">${body.replace(link, `<a href="${link}">${link}</a>`)}</div>`).catch(() => null)
    }
    if (cafe.ownerPhone) await sendMessage(cafe.id, cafe.ownerPhone, body, { templateKey: `billing:${kind}:${inv.id}` }).catch(() => null)
  } catch (err) {
    logger.warn({ msg: 'Billing notification failed', invoiceId, kind, err: (err as Error).message })
  }
}

// ─── Daily cycle: issue + dunning ────────────────────────────────────────────

export async function runBillingCycle(now = new Date()) {
  const stats = { issued: 0, reminder1: 0, reminder2: 0, suspended: 0 }

  const due = await prisma.cafe.findMany({
    where:  { planId: { not: null }, isActive: true, monthlyFee: { gt: 0 }, OR: [{ currentPeriodEnd: { isSet: false } }, { currentPeriodEnd: null }, { currentPeriodEnd: { lte: now } }] },
    select: { id: true },
  })
  for (const c of due) {
    try { if (await issueDueInvoiceFor(c.id, now)) stats.issued++ } catch (err) { logger.error({ msg: 'Invoice issue failed', cafeId: c.id, err }) }
  }

  const open = await prisma.billingInvoice.findMany({
    where:  { status: 'ISSUED', planId: { not: null }, dueAt: { lt: now } },
    select: { id: true, cafeId: true, dueAt: true, reminder1At: true, reminder2At: true, suspendedAt: true },
  })
  for (const inv of open) {
    const late = now.getTime() - inv.dueAt!.getTime()
    if (late >= SUSPEND_DAYS * DAY && !inv.suspendedAt) {
      await prisma.billingInvoice.update({ where: { id: inv.id }, data: { suspendedAt: now } })
      await prisma.cafe.update({ where: { id: inv.cafeId }, data: { subscriptionSuspended: true } })
      await notify(inv.id, 'suspended'); stats.suspended++
    } else if (late >= REMINDER2_DAYS * DAY && !inv.reminder2At) {
      await prisma.billingInvoice.update({ where: { id: inv.id }, data: { reminder2At: now } })
      await notify(inv.id, 'reminder2'); stats.reminder2++
    } else if (late >= REMINDER1_DAYS * DAY && !inv.reminder1At) {
      await prisma.billingInvoice.update({ where: { id: inv.id }, data: { reminder1At: now } })
      await notify(inv.id, 'reminder1'); stats.reminder1++
    }
  }
  logger.info({ msg: '[BillingCycle] done', ...stats })
  return stats
}
