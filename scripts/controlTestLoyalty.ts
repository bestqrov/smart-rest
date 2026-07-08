/**
 * Integration coverage for the Loyalty Program: configurable earning rate,
 * the orders.ts lifetimePoints bug fix, tier thresholds, the public profile
 * routes, and the reward-eligibility WhatsApp trigger (event-level, not
 * actual message delivery — this repo's WhatsApp send silently no-ops
 * without Evolution API configured, so we assert the event fires instead).
 *
 * Run against a live dev server:
 *   npx ts-node --transpile-only scripts/controlTestLoyalty.ts
 */
import 'dotenv/config'
import prisma from '../src/prisma'
import { eventBus } from '../src/core'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
let passed = 0, failed = 0

function ok(cond: boolean, label: string) {
  if (cond) { console.log(`  ✅  ${label}`); passed++ }
  else      { console.log(`  ❌  ${label}`); failed++ }
}

async function json(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, opts)
  const data = await res.json().catch(() => null)
  return { res, data }
}

async function main() {
  console.log('\n── Setup ───────────────────────────────────────────────')
  const adminEmail = process.env.TEST_ADMIN_EMAIL ?? 'plage@demo.com'
  const adminPass  = process.env.TEST_ADMIN_PASSWORD ?? 'demo1234'
  const testPhone  = `+212600${Math.floor(100000 + Math.random() * 899999)}`

  const { res: loginRes, data: login } = await json('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPass }),
  })
  ok(loginRes.status === 200, 'admin login → 200')
  const token = login.token as string
  const cafeId = login.cafeId as string
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  console.log('\n── Settings ──────────────────────────────────────────────')
  const { res: getRes, data: originalSettings } = await json('/api/loyalty/settings', { headers: auth })
  ok(getRes.status === 200, 'GET /api/loyalty/settings → 200')
  ok(typeof originalSettings.pointsPerCurrency === 'number', 'settings include pointsPerCurrency')

  const { res: patchRes, data: patched } = await json('/api/loyalty/settings', {
    method: 'PATCH', headers: auth, body: JSON.stringify({ pointsPerCurrency: 5, silverThreshold: 20, goldThreshold: 100 }),
  })
  ok(patchRes.status === 200, 'PATCH /api/loyalty/settings → 200')
  ok(patched.pointsPerCurrency === 5, 'pointsPerCurrency updated to 5')

  console.log('\n── Earning uses the new configurable rate ───────────────')
  const { earnPoints } = await import('../src/loyalty/LoyaltyService')
  const before = await prisma.loyaltyAccount.findUnique({ where: { cafeId_phone: { cafeId, phone: testPhone } } })
  ok(!before, 'test phone has no prior loyalty account')

  await earnPoints(cafeId, testPhone, 50, 'test-order-1') // 50 / 5 = 10 points
  const afterFirst = await prisma.loyaltyAccount.findUnique({ where: { cafeId_phone: { cafeId, phone: testPhone } } })
  ok(afterFirst?.points === 10, 'earnPoints uses the configured rate (50 / 5 = 10 points)')
  ok(afterFirst?.lifetimePoints === 10, 'lifetimePoints incremented alongside points (bug fix verified)')

  console.log('\n── Tier crosses the configured Silver threshold ─────────')
  await earnPoints(cafeId, testPhone, 50, 'test-order-2') // +10 points = 20 total, threshold is 20
  const { getTierInfo } = await import('../src/loyalty/LoyaltyService')
  const tierInfo = await getTierInfo(cafeId, testPhone)
  ok(tierInfo.tier === 'SILVER', `tier is SILVER at the configured 20-point threshold (got ${tierInfo.tier})`)

  console.log('\n── Reward-eligibility event fires ───────────────────────')
  let eventFired = false
  eventBus.subscribe('LoyaltyRewardEligible', async (event: any) => {
    if (event.payload.metadata.phone === testPhone) eventFired = true
  })
  const { createReward } = await import('../src/loyalty/LoyaltyService')
  await createReward(cafeId, { name: 'Test Control Reward', pointsCost: 25 })
  await earnPoints(cafeId, testPhone, 50, 'test-order-3') // +10 = 30 total, crosses the 25-point reward
  await new Promise(r => setTimeout(r, 100)) // let the async event handler run
  ok(eventFired, 'LoyaltyRewardEligible event fires when crossing a reward threshold')

  console.log('\n── Public self-service profile ───────────────────────────')
  const { data: cafeRow } = { data: await prisma.cafe.findUnique({ where: { id: cafeId }, select: { subdomain: true } }) }
  const subdomain = cafeRow!.subdomain

  const { res: getProfileRes, data: profileData } = await json(`/api/public/loyalty/${subdomain}/${encodeURIComponent(testPhone)}`)
  ok(getProfileRes.status === 200, 'GET public loyalty profile → 200')
  ok(profileData.currentPoints === 30, 'public profile shows correct currentPoints')
  ok(profileData.tier === 'SILVER', 'public profile shows correct tier')

  const { res: patchProfileRes, data: patchedProfile } = await json(`/api/public/loyalty/${subdomain}/${encodeURIComponent(testPhone)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Control Test Customer', instagramHandle: '@controltest' }),
  })
  ok(patchProfileRes.status === 200, 'PATCH public loyalty profile → 200')
  ok(patchedProfile.customer.name === 'Control Test Customer', 'profile name saved')
  ok(patchedProfile.customer.instagramHandle === '@controltest', 'profile Instagram handle saved')

  console.log('\n── Cleanup ──────────────────────────────────────────────')
  await prisma.loyaltyAccount.deleteMany({ where: { cafeId, phone: testPhone } })
  await prisma.cafeCustomer.deleteMany({ where: { cafeId, phone: testPhone } })
  await prisma.loyaltyReward.deleteMany({ where: { cafeId, name: 'Test Control Reward' } })
  await prisma.cafe.update({
    where: { id: cafeId },
    data: {
      loyaltyPointsPerCurrency:   originalSettings.pointsPerCurrency,
      loyaltyTierSilverThreshold: originalSettings.silverThreshold,
      loyaltyTierGoldThreshold:   originalSettings.goldThreshold,
    },
  })
  console.log('  cleaned up test account, customer, reward, and reverted settings')

  console.log('\n── Summary ──────────────────────────────────────────────')
  console.log(`  ${passed} passed, ${failed} failed`)
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
