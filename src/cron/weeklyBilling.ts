import cron from 'node-cron'
import { Prisma } from '@prisma/client'
import prisma from '../prisma'
import logger from '../logger'
import { computeCafeAOV, suggestBillingTiers } from '../services/billing'

// ─── Weekly Billing Cron — Every Monday at 23:59 ──────────────────────────────

export function startWeeklyBillingCron(): void {
  // "59 23 * * 1" = 23:59 every Monday
  cron.schedule('59 23 * * 1', async () => {
    logger.info({ msg: '[CRON] Weekly billing job started' })

    try {
      const now = new Date()

      const cafes = await prisma.cafe.findMany({
        where: { trialEndsAt: { not: null } },
        select: {
          id: true,
          country: true,
          walletBalance: true,
          trialEndsAt: true,
          hasExtendedTrial: true,
          billingStatus: true,
          isActive: true
        }
      })

      for (const cafe of cafes) {
        if (!cafe.trialEndsAt) continue

        const trialEnded = now >= cafe.trialEndsAt
        const trialEndsThisWeek =
          !trialEnded &&
          cafe.trialEndsAt <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

        // ── Case 1: Active subscribed cafe with negative balance → SUSPEND ──
        if (trialEnded) {
          const balance = cafe.walletBalance as unknown as Prisma.Decimal
          if (balance.lessThan(0)) {
            await prisma.cafe.update({
              where: { id: cafe.id },
              data: { isActive: false, billingStatus: 'SUSPENDED' }
            })

            logger.warn({
              msg: '[CRON] Cafe suspended — negative balance',
              cafeId: cafe.id,
              balance: balance.toString()
            })

            // Emit invoice payload (caught by webhook consumers / WhatsApp)
            await emitInvoicePayload(cafe.id, balance)
          }
          continue
        }

        // ── Case 2: Trial ends within this week → AI package + halt ─────────
        if (trialEndsThisWeek) {
          await handleTrialExpiry(cafe.id, cafe.country)
        }
      }

      logger.info({ msg: '[CRON] Weekly billing job completed' })
    } catch (err) {
      logger.error({ msg: '[CRON] Weekly billing job failed', err })
    }
  })

  logger.info({ msg: '[CRON] Weekly billing cron registered (Mon 23:59)' })
}

// ─── handleTrialExpiry ────────────────────────────────────────────────────────

async function handleTrialExpiry(cafeId: number, country: string): Promise<void> {
  try {
    const { aov, orderCount } = await computeCafeAOV(cafeId)

    // Generate and persist AI-optimised billing tiers for this cafe
    await suggestBillingTiers(cafeId, country)

    // Flip cafe into a "pending decision" state — dashboard will render the
    // two action cards (accept AI package vs. pay $5 trial extension)
    await prisma.cafe.update({
      where: { id: cafeId },
      data: { billingStatus: 'GRACE_PERIOD' } // keeps QR active while owner decides
    })

    logger.info({
      msg: '[CRON] Trial expiry — AI package generated',
      cafeId,
      aov: aov.toString(),
      orderCount
    })
  } catch (err) {
    logger.error({ msg: '[CRON] handleTrialExpiry failed', cafeId, err })
  }
}

// ─── emitInvoicePayload ───────────────────────────────────────────────────────

// Builds a structured invoice payload and writes it to the DB log so that
// external webhook consumers (WhatsApp gateway, email, etc.) can pick it up.
async function emitInvoicePayload(cafeId: number, balance: Prisma.Decimal): Promise<void> {
  try {
    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { businessName: true, name: true, currency: true, subdomain: true }
    })
    if (!cafe) return

    const amountDue = balance.abs().toFixed(2)
    const invoiceRef = `INV-${cafeId}-${Date.now()}`

    // Log the suspension event as a wallet entry with amount 0 (informational)
    // Real webhook consumers should subscribe to the SUSPENDED billingStatus change
    logger.info({
      msg: '[INVOICE] Auto-generated weekly invoice',
      invoiceRef,
      cafeId,
      businessName: cafe.businessName || cafe.name,
      subdomain: cafe.subdomain,
      currency: cafe.currency,
      amountDue,
      settleUrl: `/api/finance/settle-debt`
    })
  } catch (err) {
    logger.error({ msg: '[CRON] emitInvoicePayload failed', cafeId, err })
  }
}
