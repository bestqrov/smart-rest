/**
 * Integration test: Hotel business-type fix.
 *
 * Covers two bugs reported by the user:
 * 1. businessType/hotelServiceMode chosen at signup were discarded — never
 *    persisted onto Cafe, so onboarding always re-asked and defaulted to
 *    CAFE. Verifies the Cafe.businessType / Cafe.hotelServiceMode fields
 *    round-trip through Prisma correctly.
 * 2. The Hotel starter-menu catalog was nearly identical to a regular
 *    restaurant (2 room-service items, rest reused verbatim). Verifies
 *    getProductCatalog()/resolveSelectedProducts() now return genuinely
 *    different, mode-aware content for ROOM_SERVICE / ON_SITE / BOTH.
 *
 * All test data is created and cleaned up by this script — nothing is left
 * behind in the shared database.
 *
 * Run: DATABASE_URL=... npx ts-node --transpile-only scripts/controlTestHotelBusinessType.ts
 */
import { getProductCatalog, resolveSelectedProducts } from '../src/onboarding/ProductCatalog'

let passed = 0, failed = 0
function ok(cond: boolean, label: string) {
  if (cond) { console.log(`  ✅  ${label}`); passed++ }
  else      { console.log(`  ❌  ${label}`); failed++ }
}

const RUN_ID = Date.now()
const SUBDOMAIN = `hotel-test-${RUN_ID}`

async function main() {
  const { default: prisma } = await import('../src/prisma')

  console.log('\n1. Product catalog is mode-aware for HOTEL')
  const roomService = getProductCatalog('MA', 'HOTEL', 'ROOM_SERVICE')
  const onSite       = getProductCatalog('MA', 'HOTEL', 'ON_SITE')
  const both          = getProductCatalog('MA', 'HOTEL', 'BOTH')
  const legacy         = getProductCatalog('MA', 'HOTEL') // no mode → legacy fallback

  ok(roomService.length > 0, 'ROOM_SERVICE mode returns categories')
  ok(onSite.length > 0, 'ON_SITE mode returns categories')
  ok(roomService.every(c => c.key.startsWith('room-service') || c.key === 'minibar-snacks' || c.key === 'late-night'), 'ROOM_SERVICE categories are all in-room (no on-site-only categories leak in)')
  const roomServiceKeys = new Set(roomService.map(c => c.key))
  ok(onSite.every(c => !roomServiceKeys.has(c.key)), 'ON_SITE categories are all on-site (no room-service categories leak in)')
  ok(both.length === roomService.length + onSite.length, 'BOTH mode is the exact union of ROOM_SERVICE + ON_SITE')
  ok(legacy.length === both.length, 'Legacy accounts (no saved hotelServiceMode) fall back to the full combined catalog, not an empty one')
  ok(roomService.reduce((n, c) => n + c.products.length, 0) > 15, 'ROOM_SERVICE catalog is substantially richer than the old 2-item stub')

  const cafeCatalog = getProductCatalog('MA', 'CAFE')
  const hotelOnSiteNames = new Set(onSite.flatMap(c => c.products.map(p => p.nameEn)))
  const cafeNames = new Set(cafeCatalog.flatMap(c => c.products.map(p => p.nameEn)))
  const overlap = [...hotelOnSiteNames].filter(n => cafeNames.has(n))
  ok(overlap.length < hotelOnSiteNames.size, 'Hotel on-site menu is not just a verbatim copy of the Café catalog')

  console.log('\n2. resolveSelectedProducts respects hotelServiceMode')
  const roomServiceCategoryKey = roomService[0]!.key
  const resolvedForRoomMode = resolveSelectedProducts('MA', 'HOTEL', [{ categoryKey: roomServiceCategoryKey, productKeys: [roomService[0]!.products[0]!.key] }], 'ROOM_SERVICE')
  const resolvedForOnSiteMode = resolveSelectedProducts('MA', 'HOTEL', [{ categoryKey: roomServiceCategoryKey, productKeys: [roomService[0]!.products[0]!.key] }], 'ON_SITE')
  ok(resolvedForRoomMode.length === 1, 'a room-service category resolves under ROOM_SERVICE mode')
  ok(resolvedForOnSiteMode.length === 0, 'the same room-service category does NOT resolve under ON_SITE mode (catalogs are properly isolated)')

  console.log('\n3. Cafe.businessType / Cafe.hotelServiceMode persist correctly via Prisma')
  const cafe = await prisma.cafe.create({
    data: {
      name: 'Hotel Test Cafe', businessName: 'Hotel Test Cafe',
      subdomain: SUBDOMAIN, country: 'MA', currency: 'MAD',
      businessType: 'HOTEL', hotelServiceMode: 'BOTH',
      trialEndsAt: new Date(Date.now() + 7 * 86400000),
      billingStatus: 'GRACE_PERIOD', isActive: true,
    },
  })

  try {
    const reread = await prisma.cafe.findUnique({ where: { id: cafe.id }, select: { businessType: true, hotelServiceMode: true } })
    ok(reread?.businessType === 'HOTEL', 'businessType persisted as HOTEL')
    ok(reread?.hotelServiceMode === 'BOTH', 'hotelServiceMode persisted as BOTH')

    const nonHotel = await prisma.cafe.create({
      data: {
        name: 'Non-Hotel Test Cafe', businessName: 'Non-Hotel Test Cafe',
        subdomain: `${SUBDOMAIN}-restaurant`, country: 'MA', currency: 'MAD',
        businessType: 'RESTAURANT',
        trialEndsAt: new Date(Date.now() + 7 * 86400000),
        billingStatus: 'GRACE_PERIOD', isActive: true,
      },
    })
    try {
      const rereadNonHotel = await prisma.cafe.findUnique({ where: { id: nonHotel.id }, select: { businessType: true, hotelServiceMode: true } })
      ok(rereadNonHotel?.businessType === 'RESTAURANT', 'businessType persisted as RESTAURANT for a non-hotel cafe')
      ok(rereadNonHotel?.hotelServiceMode === null, 'hotelServiceMode stays null for a non-hotel cafe')
    } finally {
      await prisma.cafe.delete({ where: { id: nonHotel.id } })
    }
  } finally {
    await prisma.cafe.delete({ where: { id: cafe.id } })
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  console.log(failed === 0 ? 'INTEGRATION TEST: PASS' : 'INTEGRATION TEST: FAIL')
  await prisma.$disconnect()
  if (failed > 0) process.exit(1)
}

main().catch(async (err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
