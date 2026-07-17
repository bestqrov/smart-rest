/**
 * One-off: run the K48 Scheduler sweep once against the live shared DB to
 * confirm it executes without error post-backfill. Current data (5 fresh
 * TRIAL/ACTIVE subscriptions, trialEndsAt 14 days out) is not expected to
 * trigger any transition — this call is expected to be a safe no-op today,
 * proving the sweep runs cleanly against real data rather than exercising
 * mutations (which would require aged-out test data to trigger honestly).
 *
 * Run: DATABASE_URL=... npx ts-node --transpile-only scripts/verifySchedulerRun.ts
 */
import { runSubscriptionLifecycleSweep } from '../src/billing/scheduler/SubscriptionScheduler'

async function main() {
  const result = await runSubscriptionLifecycleSweep()
  console.log('Scheduler sweep result:', JSON.stringify(result, null, 2))
  const { default: prisma } = await import('../src/prisma')
  await prisma.$disconnect()
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('Scheduler sweep failed:', err); process.exit(1) })
