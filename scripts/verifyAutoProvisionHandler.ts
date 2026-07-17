/**
 * One-off: verify the CafeCreated auto-provisioning handler logic itself is
 * correct, by firing a synthetic event through the real eventBus and
 * checking the resulting BillingSubscription — then deleting that synthetic
 * record immediately so the shared DB isn't left with test pollution.
 *
 * NOTE: this only proves the *handler* works. It does NOT prove real signups
 * trigger it — grep confirms nothing in src/routes/auth.ts (or anywhere else)
 * actually calls eventBus.publish('CafeCreated', ...). That's a pre-existing
 * gap shared with TenantProfile's identical auto-provisioning hook, not
 * something introduced by this change — see release-prep report.
 *
 * Run: DATABASE_URL=... npx ts-node --transpile-only scripts/verifyAutoProvisionHandler.ts
 */
import * as SubscriptionRepository from '../src/billing/subscriptions/SubscriptionRepository'

const TEST_TENANT_ID = `phase1-auto-provision-test-${Date.now()}`

async function main() {
  const { eventBus } = await import('../src/core')
  const { initTenantEngine } = await import('../src/tenant')

  await initTenantEngine()
  console.log(`subscriberCount after initTenantEngine(): ${eventBus.subscriberCount}`)
  console.log(`Publishing synthetic CafeCreated for tenantId=${TEST_TENANT_ID}...`)
  eventBus.publish('CafeCreated', { cafeId: TEST_TENANT_ID, language: 'ar', currency: 'MAD', country: 'MA' }, 'verify-script')

  // Handler is async/fire-and-forget inside eventBus.subscribe — give it time
  // for the first Prisma/MongoDB connection to establish (observed to take
  // longer than 2s on first connect against the shared Atlas cluster).
  await new Promise((r) => setTimeout(r, 10000))

  const sub = await SubscriptionRepository.findLatestByTenant(TEST_TENANT_ID)
  if (!sub) {
    console.log('❌  No BillingSubscription was created — auto-provisioning handler did not fire correctly.')
    process.exit(1)
  }

  console.log('✅  BillingSubscription created by the handler:')
  console.log(JSON.stringify(sub, null, 2))

  const correct = sub.status === 'TRIAL' && sub.tenantId === TEST_TENANT_ID && sub.planCode === 'STANDARD'
  console.log(`\nCorrectness check (status=TRIAL, tenantId matches, plan=STANDARD): ${correct ? 'PASS' : 'FAIL'}`)

  // Cleanup — this is a synthetic test record, not real tenant data.
  const { default: prisma } = await import('../src/prisma')
  await (prisma as any).billingSubscription.delete({ where: { id: sub.id } })
  console.log('🧹  Cleaned up synthetic test record.')
  await prisma.$disconnect()

  process.exit(correct ? 0 : 1)
}

main().catch((err) => { console.error(err); process.exit(1) })
