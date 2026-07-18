/**
 * Backfill BillingSubscription rows for every existing Cafe.
 *
 * Part of the Tenant Access Migration (Phase 1) — BillingSubscription is
 * becoming the platform's access-control authority, but almost no cafe has a
 * BillingSubscription row yet (subscription creation was never wired into
 * cafe signup until this migration's auto-provisioning hook in
 * src/tenant/index.ts). This script creates the missing historical rows so
 * isAccessAllowed()/isCafeAccessAllowed() (src/billing/subscriptions/
 * SubscriptionService.ts) have real data to check instead of fail-opening on
 * every existing tenant.
 *
 * SAFETY: this worktree only has access to the shared demo/staging database
 * (no isolated dev DB) — writes here are NOT something to run casually.
 * Defaults to --dry-run (reads + logs the proposed mapping, writes nothing).
 * Pass --commit to actually create rows. Never invoked automatically from
 * server boot, cron, or CI.
 *
 * Idempotent: a cafe with any existing BillingSubscription row (even a
 * terminal CANCELLED/EXPIRED one) is skipped, not touched — safe to re-run.
 *
 * Run:
 *   npx ts-node --transpile-only scripts/backfillBillingSubscriptions.ts            (dry-run)
 *   npx ts-node --transpile-only scripts/backfillBillingSubscriptions.ts --commit    (writes)
 */
import * as SubscriptionRepository from '../src/billing/subscriptions/SubscriptionRepository'
import * as PlanRepository from '../src/billing/plans/PlanRepository'
import type { SubscriptionStatus } from '../src/billing/subscriptions/SubscriptionTypes'

const BATCH_SIZE = 200
const DRY_RUN = !process.argv.includes('--commit')

function mapCafeToSubscription(cafe: {
  id: string
  isActive: boolean
  billingStatus: string
  gracePeriodEndsAt: Date | null
  trialEndsAt: Date | null
}): { status: SubscriptionStatus; trialEndsAt: Date | null; graceEndsAt: Date | null } {
  const now = new Date()

  if (!cafe.isActive) {
    return { status: 'SUSPENDED', trialEndsAt: null, graceEndsAt: null }
  }
  if (cafe.billingStatus === 'GRACE_PERIOD') {
    // Cafe.trialEndsAt can be stale/already-past even while billingStatus is
    // still GRACE_PERIOD (the old wallet model only acts on trial expiry via
    // a separate weekly cron, not immediately) — using a past date here would
    // make the new BillingSubscription Scheduler expire the tenant on its
    // very first run, blocking a cafe that's still Cafe.isActive=true today.
    // Phase 1's core safety goal is not changing existing behavior, so always
    // give backfilled trials a fresh future window instead of trusting a
    // possibly-stale historical field.
    const trialEndsAt = (cafe.trialEndsAt && cafe.trialEndsAt > now)
      ? cafe.trialEndsAt
      : new Date(now.getTime() + 14 * 86400000)
    return { status: 'TRIAL', trialEndsAt, graceEndsAt: null }
  }
  if (cafe.billingStatus === 'COLLECTING_DEBT') {
    return { status: 'ACTIVE', trialEndsAt: null, graceEndsAt: null }
  }
  if (cafe.billingStatus === 'PAST_DUE') {
    // Same defensive clamp as the TRIAL case above — don't backfill an
    // already-past graceEndsAt, which would make the Scheduler suspend the
    // tenant on its first run.
    const graceEndsAt = (cafe.gracePeriodEndsAt && cafe.gracePeriodEndsAt > now)
      ? cafe.gracePeriodEndsAt
      : new Date(now.getTime() + 7 * 86400000)
    return { status: 'GRACE_PERIOD', trialEndsAt: null, graceEndsAt }
  }
  // billingStatus === 'SUSPENDED', or any unrecognized value: fail-safe to SUSPENDED
  return { status: 'SUSPENDED', trialEndsAt: null, graceEndsAt: null }
}

async function main() {
  console.log(`\nBackfill BillingSubscriptions — mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'COMMIT (will write)'}\n`)

  const { default: prisma } = await import('../src/prisma')

  const defaultPlan = await PlanRepository.findDefault()
  if (!defaultPlan) {
    console.error('ABORT: no default BillingPlan exists (BillingPlan.isDefault=true). ' +
      'Both this backfill and the new CafeCreated auto-provisioning hook require one. ' +
      'Create a default plan via the SuperAdmin billing-plans UI first, then re-run.')
    process.exit(1)
  }
  console.log(`Using default plan: ${defaultPlan.code} (${defaultPlan.id})\n`)

  let created = 0, skipped = 0, errored = 0
  let cursor: string | undefined
  const summary: { cafeId: string; status: SubscriptionStatus }[] = []

  for (;;) {
    const cafes: any[] = await (prisma as any).cafe.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, isActive: true, billingStatus: true, gracePeriodEndsAt: true, trialEndsAt: true },
    })
    if (cafes.length === 0) break
    cursor = cafes[cafes.length - 1].id

    for (const cafe of cafes) {
      try {
        const existing = await SubscriptionRepository.findLatestByTenant(cafe.id)
        if (existing) {
          skipped++
          continue
        }

        const mapped = mapCafeToSubscription(cafe)
        summary.push({ cafeId: cafe.id, status: mapped.status })

        if (DRY_RUN) {
          created++
          continue
        }

        const sub = await SubscriptionRepository.create({
          tenantId:    cafe.id,
          planId:      defaultPlan.id,
          planCode:    defaultPlan.code,
          planName:    defaultPlan.name,
          status:      mapped.status,
          startDate:   new Date(),
          trialEndsAt: mapped.trialEndsAt ?? undefined,
          autoRenew:   true,
          notes:       `Backfilled from Cafe.billingStatus=${cafe.billingStatus} isActive=${cafe.isActive} on ${new Date().toISOString()}`,
        })
        // CreateSubscriptionInput has no graceEndsAt field (only update() does)
        // — set it in a follow-up write when the mapped status needs it.
        if (mapped.graceEndsAt) {
          await SubscriptionRepository.update(sub.id, { graceEndsAt: mapped.graceEndsAt })
        }
        // Deliberately NOT emitting SubscriptionCreated here — a mass backfill
        // firing "subscription created" notifications to every real tenant's
        // dashboard would be noisy and misleading. This is a data-repair
        // operation, not an organic subscription creation.
        created++
      } catch (err: any) {
        errored++
        console.error(`  ERROR cafe ${cafe.id}: ${err.message}`)
      }
    }
  }

  console.log(`\n${DRY_RUN ? 'Would create' : 'Created'}: ${created}  Skipped (already has a row): ${skipped}  Errored: ${errored}\n`)

  const byStatus: Record<string, number> = {}
  for (const s of summary) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
  console.log('Proposed status distribution:', byStatus)

  if (DRY_RUN) {
    console.log('\nThis was a dry run — no rows were written. Re-run with --commit to apply.')
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(1)
  })
