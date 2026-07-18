/**
 * One-off: verify every Cafe now has a BillingSubscription after the
 * release-prep backfill --commit run. Read-only.
 *
 * Run: DATABASE_URL=... npx ts-node --transpile-only scripts/postBackfillVerify.ts
 */
import * as SubscriptionRepository from '../src/billing/subscriptions/SubscriptionRepository'

async function main() {
  const { default: prisma } = await import('../src/prisma')

  const cafes = await (prisma as any).cafe.findMany({ select: { id: true, subdomain: true, isActive: true } })
  console.log(`Total cafes: ${cafes.length}\n`)

  let withSub = 0, without = 0
  for (const cafe of cafes) {
    const sub = await SubscriptionRepository.findLatestByTenant(cafe.id)
    if (sub) {
      withSub++
      console.log(`  ✅  ${cafe.subdomain} (${cafe.id}) → BillingSubscription ${sub.id} status=${sub.status} plan=${sub.planCode}`)
    } else {
      without++
      console.log(`  ❌  ${cafe.subdomain} (${cafe.id}) → NO BillingSubscription`)
    }
  }

  console.log(`\n${withSub}/${cafes.length} cafes have a BillingSubscription, ${without} do not.`)
  await prisma.$disconnect()
  process.exit(without > 0 ? 1 : 0)
}

main().catch((err) => { console.error(err); process.exit(1) })
