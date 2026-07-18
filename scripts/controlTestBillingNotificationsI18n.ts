/**
 * Integration test for the Billing Notifications i18n fix:
 * BillingNotifications.ts previously hardcoded Arabic regardless of the
 * tenant's TenantProfile.defaultLanguage. Verifies notifications are now
 * generated in the tenant's actual configured language, and fail open to
 * Arabic when no TenantProfile exists (matches TenantProfile's own default).
 *
 * Self-cleaning — synthetic TenantProfile + notifications are deleted after.
 *
 * Run: DATABASE_URL=... npx ts-node --transpile-only scripts/controlTestBillingNotificationsI18n.ts
 */
import { notifyTrialEnding, notifySubscriptionRenewed } from '../src/billing/notifications/BillingNotifications'

let passed = 0, failed = 0
function ok(cond: boolean, label: string) {
  if (cond) { console.log(`  ✅  ${label}`); passed++ }
  else      { console.log(`  ❌  ${label}`); failed++ }
}

const TENANT_EN = `notif-test-en-${Date.now()}`
const TENANT_NONE = `notif-test-none-${Date.now()}`

async function main() {
  const { default: prisma } = await import('../src/prisma')

  console.log('\n1. Notification respects TenantProfile.defaultLanguage (English tenant)')
  await (prisma as any).tenantProfile.create({
    data: { tenantId: TENANT_EN, tenantType: 'RESTAURANT', state: 'ACTIVE', plan: 'FREE', defaultLanguage: 'en', defaultCurrency: 'USD', country: 'US' },
  })
  await notifyTrialEnding(TENANT_EN, 3)
  const enNotif = await (prisma as any).coreNotification.findFirst({ where: { targetId: TENANT_EN, module: 'BILLING' }, orderBy: { createdAt: 'desc' } })
  ok(!!enNotif, 'notification was created')
  ok(enNotif?.title === 'Your trial ends in 3 days', `title is in English (got: "${enNotif?.title}")`)
  ok(enNotif?.message?.includes('Upgrade your plan'), 'message is in English')

  console.log('\n2. Fails open to Arabic when no TenantProfile exists (matches TenantProfile\'s own default)')
  await notifySubscriptionRenewed(TENANT_NONE, 'STANDARD')
  const arNotif = await (prisma as any).coreNotification.findFirst({ where: { targetId: TENANT_NONE, module: 'BILLING' }, orderBy: { createdAt: 'desc' } })
  ok(!!arNotif, 'notification was still created despite no TenantProfile')
  ok(arNotif?.title === 'تم تجديد الاشتراك', `title falls back to Arabic (got: "${arNotif?.title}")`)

  console.log('\nCleanup')
  await (prisma as any).coreNotification.deleteMany({ where: { targetId: { in: [TENANT_EN, TENANT_NONE] } } })
  await (prisma as any).tenantProfile.deleteMany({ where: { tenantId: TENANT_EN } })
  console.log('  🧹  removed synthetic TenantProfile + notifications')

  await prisma.$disconnect()

  console.log(`\n${passed} passed, ${failed} failed`)
  console.log(failed === 0 ? 'INTEGRATION TEST: PASS' : 'INTEGRATION TEST: FAIL')
  if (failed > 0) process.exit(1)
}

main().catch(async (err) => {
  console.error('INTEGRATION TEST: ERROR', err)
  try {
    const { default: prisma } = await import('../src/prisma')
    await (prisma as any).coreNotification.deleteMany({ where: { targetId: { in: [TENANT_EN, TENANT_NONE] } } })
    await (prisma as any).tenantProfile.deleteMany({ where: { tenantId: TENANT_EN } })
  } catch {}
  process.exit(1)
})
