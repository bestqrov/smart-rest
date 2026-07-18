/**
 * Integration test for the CRM Core Shared Core sprint:
 * - app/admin/customers page + AdminSidebarNav + adminI18n wiring (static)
 * - CustomerService round-trip (search/tags/notes/favorites) against a
 *   synthetic CafeCustomer on a real, existing cafe (cleaned up after)
 *
 * Run: DATABASE_URL=... npx ts-node --transpile-only scripts/controlTestCrmCore.ts
 */
import * as CustomerService from '../src/customers/CustomerService'

let passed = 0, failed = 0
function ok(cond: boolean, label: string) {
  if (cond) { console.log(`  ✅  ${label}`); passed++ }
  else      { console.log(`  ❌  ${label}`); failed++ }
}

const TEST_PHONE = `+1000${Date.now().toString().slice(-9)}`

async function main() {
  const { default: prisma } = await import('../src/prisma')
  const fs = require('fs')
  const path = require('path')

  console.log('\n1. Static: page, nav, and i18n wiring')
  ok(fs.existsSync(path.join(__dirname, '../app/admin/customers/page.tsx')), 'app/admin/customers/page.tsx exists')

  const navSrc = fs.readFileSync(path.join(__dirname, '../app/admin/AdminSidebarNav.tsx'), 'utf8')
  ok(navSrc.includes("href: '/admin/customers'") && navSrc.includes("key: 'customers'"), 'AdminSidebarNav registers /admin/customers under key "customers"')

  const i18nSrc = fs.readFileSync(path.join(__dirname, '../lib/adminI18n.ts'), 'utf8')
  const customersKeyCount = (i18nSrc.match(/customers:\s*'/g) || []).length
  ok(customersKeyCount === 4, `adminI18n.ts defines the "customers" nav key in all 4 languages (found ${customersKeyCount})`)

  console.log('\n2. CustomerService round-trip against a real cafe (synthetic customer, cleaned up after)')
  const cafe = await (prisma as any).cafe.findFirst({ select: { id: true, subdomain: true } })
  if (!cafe) {
    console.log('  ℹ️  no Cafe documents exist — skipping live round-trip')
  } else {
    await (prisma as any).cafeCustomer.create({
      data: { cafeId: cafe.id, phone: TEST_PHONE, name: 'CRM Test Customer', visits: 1 },
    })

    const searchResult = await CustomerService.searchCustomers(cafe.id, { search: 'CRM Test Customer' })
    ok(searchResult.items.some((c: any) => c.phone === TEST_PHONE), 'searchCustomers finds the new customer by name')

    const tagged = await CustomerService.addTag(cafe.id, TEST_PHONE, 'vip')
    ok(tagged.tags.includes('vip'), 'addTag adds a tag')

    const untagged = await CustomerService.removeTag(cafe.id, TEST_PHONE, 'vip')
    ok(!untagged.tags.includes('vip'), 'removeTag removes it')

    const noted = await CustomerService.setNotes(cafe.id, TEST_PHONE, 'Allergic to peanuts')
    ok(noted.notes === 'Allergic to peanuts', 'setNotes persists the note')

    const faved = await CustomerService.addFavorite(cafe.id, TEST_PHONE, 'fake-product-id')
    ok(faved.favoriteProductIds.includes('fake-product-id'), 'addFavorite adds a favorite')

    const unfaved = await CustomerService.removeFavorite(cafe.id, TEST_PHONE, 'fake-product-id')
    ok(!unfaved.favoriteProductIds.includes('fake-product-id'), 'removeFavorite removes it')

    const profile = await CustomerService.getCustomerProfile(cafe.id, TEST_PHONE)
    ok(profile.customer.phone === TEST_PHONE && profile.loyaltyPoints === 0, 'getCustomerProfile returns identity + derived loyalty (0, no LoyaltyAccount yet)')

    await (prisma as any).cafeCustomer.deleteMany({ where: { cafeId: cafe.id, phone: TEST_PHONE } })
    console.log('  🧹  removed synthetic test customer')
  }

  await prisma.$disconnect()

  console.log(`\n${passed} passed, ${failed} failed`)
  console.log(failed === 0 ? 'INTEGRATION TEST: PASS' : 'INTEGRATION TEST: FAIL')
  if (failed > 0) process.exit(1)
}

main().catch(async (err) => {
  console.error('INTEGRATION TEST: ERROR', err)
  try {
    const { default: prisma } = await import('../src/prisma')
    await (prisma as any).cafeCustomer.deleteMany({ where: { phone: TEST_PHONE } })
  } catch {}
  process.exit(1)
})
