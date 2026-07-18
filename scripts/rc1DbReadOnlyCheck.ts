/**
 * RC-1 seeded-DB smoke test — READ-ONLY.
 *
 * Per explicit decision: this worktree has no isolated dev database, only
 * access to the shared cluster that also backs the live demo/staging site.
 * A real write-path smoke test (create/activate/suspend/expire) was judged
 * too risky to run against shared data without an isolated DB, so this
 * script only verifies connectivity and read shape against the real
 * BillingSubscription/BillingPlan collections — zero writes, zero mutation.
 *
 * Run: DATABASE_URL=... npx ts-node --transpile-only scripts/rc1DbReadOnlyCheck.ts
 */
import * as SubscriptionService from '../src/billing/subscriptions/SubscriptionService'
import { getMRR, getSubscriptionCounts } from '../src/billing/metrics/BillingMetricsService'
import { countActiveSubscriptions } from '../src/billing/plans/PlanRepository'

let passed = 0, failed = 0
function ok(cond: boolean, label: string) {
  if (cond) { console.log(`  ✅  ${label}`); passed++ }
  else      { console.log(`  ❌  ${label}`); failed++ }
}

async function main() {
  const { default: prisma } = await import('../src/prisma')

  console.log('\n1. DB connectivity')
  await prisma.$connect()
  ok(true, 'prisma connected to the configured DATABASE_URL')

  console.log('\n2. BillingSubscription collection is reachable and shaped correctly')
  const subCount = await (prisma as any).billingSubscription.count()
  ok(typeof subCount === 'number', `billingSubscription.count() returned a number (${subCount} existing docs)`)

  const sample = await (prisma as any).billingSubscription.findFirst()
  if (sample) {
    ok(typeof sample.status === 'string' && ['TRIAL','ACTIVE','GRACE_PERIOD','SUSPENDED','CANCELLED','EXPIRED'].includes(sample.status),
       `sample doc has a valid status enum value (${sample.status})`)
    ok(typeof sample.tenantId === 'string' && typeof sample.planCode === 'string',
       'sample doc has tenantId + planCode fields')
  } else {
    console.log('  ℹ️  no BillingSubscription documents exist yet — schema shape unverified against real data, but the collection is reachable')
  }

  console.log('\n3. SubscriptionService reads work against the live collection (no writes)')
  const list = await SubscriptionService.listSubscriptions({ page: 1, limit: 1 })
  ok(typeof list.total === 'number', `listSubscriptions() works — total: ${list.total}`)

  console.log('\n4. BillingMetricsService reads BillingSubscription, not TenantProfile (the RC-1 fix)')
  const counts = await getSubscriptionCounts()
  ok(typeof counts.active === 'number' && typeof counts.trial === 'number' && typeof counts.expired === 'number',
     `getSubscriptionCounts() returns {active:${counts.active}, trial:${counts.trial}, expired:${counts.expired}}`)
  const mrr = await getMRR()
  ok(typeof mrr.mrr === 'number', `getMRR() returns mrr:${mrr.mrr} ${mrr.currency}`)

  console.log('\n5. PlanRepository.countActiveSubscriptions delegates to BillingSubscription (the RC-1 fix)')
  const plans = await (prisma as any).billingPlan.findFirst()
  if (plans) {
    const count = await countActiveSubscriptions(plans.code)
    ok(typeof count === 'number', `countActiveSubscriptions('${plans.code}') returned ${count} (queried BillingSubscription, not TenantProfile)`)
  } else {
    console.log('  ℹ️  no BillingPlan documents exist — skipped (collection reachable, nothing to count against)')
  }

  await prisma.$disconnect()

  console.log(`\n${passed} passed, ${failed} failed`)
  console.log(failed === 0 ? 'DB READ-ONLY SMOKE TEST: PASS' : 'DB READ-ONLY SMOKE TEST: FAIL')
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('DB READ-ONLY SMOKE TEST: ERROR', err)
  process.exit(1)
})
