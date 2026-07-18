/**
 * Tenant Access Migration (Phase 1) — READ-ONLY live-DB check.
 *
 * Same safety posture as scripts/rc1DbReadOnlyCheck.ts: this worktree only
 * has access to the shared demo/staging cluster (no isolated dev DB), so
 * this script performs zero writes — it verifies the fail-open access-check
 * behavior against real data and confirms the default-plan precondition
 * that both the backfill script and the new CafeCreated auto-provisioning
 * hook depend on.
 *
 * Run: DATABASE_URL=... npx ts-node --transpile-only scripts/phase1DbReadOnlyCheck.ts
 */
import * as SubscriptionService from '../src/billing/subscriptions/SubscriptionService'
import * as PlanRepository from '../src/billing/plans/PlanRepository'

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

  console.log('\n2. BillingSubscription collection reachable')
  const subCount = await (prisma as any).billingSubscription.count()
  ok(typeof subCount === 'number', `billingSubscription.count() returned a number (${subCount} existing docs)`)

  console.log('\n3. Default BillingPlan precondition (required by backfill + auto-provisioning)')
  const defaultPlan = await PlanRepository.findDefault()
  if (!defaultPlan) {
    console.log('  ❌  PlanRepository.findDefault() returned null — LOUD FAILURE:')
    console.log('      Both scripts/backfillBillingSubscriptions.ts and the new CafeCreated')
    console.log('      auto-provisioning hook (src/tenant/index.ts) will silently no-op for')
    console.log('      every cafe/new signup until a BillingPlan with isDefault=true exists.')
    console.log('      Create one via the SuperAdmin billing-plans UI before relying on Phase 1.')
    failed++
  } else {
    ok(true, `default plan exists: ${defaultPlan.code} (${defaultPlan.id})`)
  }

  console.log('\n4. Fail-open access check against real data (zero writes)')
  const sampleCafe = await (prisma as any).cafe.findFirst({ select: { id: true, isActive: true } })
  if (sampleCafe) {
    const existing = await SubscriptionService.getSubscriptionByTenant(sampleCafe.id)
    const allowed = await SubscriptionService.isAccessAllowed(sampleCafe.id)
    if (!existing) {
      ok(allowed === true, `isAccessAllowed('${sampleCafe.id}') returns true for a cafe with no BillingSubscription row yet (fail-open confirmed against real data)`)
    } else {
      console.log(`  ℹ️  sampled cafe ${sampleCafe.id} already has a BillingSubscription (status=${existing.status}) — fail-open path not exercised by this cafe, but isAccessAllowed executed without error (result: ${allowed})`)
      passed++
    }
  } else {
    console.log('  ℹ️  no Cafe documents exist — fail-open check skipped (nothing to sample)')
  }

  await prisma.$disconnect()

  console.log(`\n${passed} passed, ${failed} failed`)
  console.log(failed === 0 ? 'PHASE 1 DB READ-ONLY CHECK: PASS' : 'PHASE 1 DB READ-ONLY CHECK: FAIL')
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('PHASE 1 DB READ-ONLY CHECK: ERROR', err)
  process.exit(1)
})
