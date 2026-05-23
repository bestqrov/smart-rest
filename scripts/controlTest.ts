/**
 * Control test suite — verifies all major SaaS features end-to-end.
 * Run: npx ts-node --transpile-only scripts/controlTest.ts
 */

import dotenv from 'dotenv'
dotenv.config()   // load .env so JWT_SECRET + SUPERADMIN_SECRET match the server

import fetch from 'node-fetch'
import jwt from 'jsonwebtoken'

const SERVER        = process.env.SERVER_URL        || 'http://localhost:4000'
const JWT_SECRET    = process.env.JWT_SECRET        || 'test-secret'
const SA_SECRET     = process.env.SUPERADMIN_SECRET || 'ana123'

let passed = 0
let failed = 0

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✅  ${label}`)
    passed++
  } else {
    console.error(`  ❌  ${label}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${SERVER}${path}`, { headers })
  let body: any = {}
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}

async function post(path: string, data: any, headers: Record<string, string> = {}) {
  const res = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data),
  })
  let body: any = {}
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}

async function patch(path: string, data: any, headers: Record<string, string> = {}) {
  const res = await fetch(`${SERVER}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data),
  })
  let body: any = {}
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}

function saHeader() {
  return { 'x-superadmin-secret': SA_SECRET }
}

function adminToken(cafeId = 'test-cafe-id') {
  const token = jwt.sign({ userId: 'u1', cafeId, subdomain: 'test' }, JWT_SECRET, { expiresIn: '1h' })
  return { Authorization: `Bearer ${token}` }
}

// ─── Test sections ────────────────────────────────────────────────────────────

async function testHealth() {
  console.log('\n── Health ─────────────────────────────────────────────')
  const { status, body } = await get('/health')
  ok('GET /health returns 200', status === 200)
  ok('GET /health returns { ok: true }', body?.ok === true)
}

async function testSuperadminGuard() {
  console.log('\n── Superadmin auth guard ──────────────────────────────')
  const { status } = await get('/api/superadmin/overview')
  ok('No secret → 401', status === 401)

  const { status: s2 } = await get('/api/superadmin/overview', { 'x-superadmin-secret': 'wrong-secret' })
  ok('Wrong secret → 401', s2 === 401)

  const { status: s3, body } = await get('/api/superadmin/overview', saHeader())
  ok('Correct secret → 200', s3 === 200)
  ok('Overview has totalCafes', typeof body?.totalCafes === 'number')
}

async function testTenantsList() {
  console.log('\n── Superadmin tenants ─────────────────────────────────')
  const { status, body } = await get('/api/superadmin/tenants', saHeader())
  ok('GET /tenants → 200', status === 200)
  ok('Response has total + cafes array', typeof body?.total === 'number' && Array.isArray(body?.cafes))
}

async function testBillingOverview() {
  console.log('\n── Billing overview ───────────────────────────────────')
  const { status, body } = await get('/api/superadmin/billing/overview', saHeader())
  ok('GET /billing/overview → 200', status === 200)
  ok('Has mrr field', 'mrr' in (body ?? {}))
}

async function testFeatureFlags() {
  console.log('\n── Feature flags (PATCH /tenants/:id/features) ───────')

  // Get a real tenant first
  const { body: list } = await get('/api/superadmin/tenants?limit=1', saHeader())
  const cafe = list?.cafes?.[0]

  if (!cafe) {
    ok('Feature flag test skipped — no tenants in DB', true)
    return
  }

  // Empty body → 400
  const { status: s1, body: b1 } = await patch(
    `/api/superadmin/tenants/${cafe.id}/features`, {}, saHeader()
  )
  ok('Empty body → 400', s1 === 400, JSON.stringify(b1))

  // Valid flag
  const { status: s2, body: b2 } = await patch(
    `/api/superadmin/tenants/${cafe.id}/features`,
    { cashierPosEnabled: true },
    saHeader()
  )
  ok('Valid flag update → 200', s2 === 200, JSON.stringify(b2))
  ok('Response includes feature fields', b2?.cafe?.id === cafe.id)

  // Guard — no secret
  const { status: s3 } = await patch(
    `/api/superadmin/tenants/${cafe.id}/features`, { cashierPosEnabled: true }
  )
  ok('Missing secret → 401', s3 === 401)
}

async function testImpersonation() {
  console.log('\n── Impersonation ──────────────────────────────────────')

  // Nonexistent id → 404
  const { status: s1 } = await post(
    '/api/superadmin/tenants/000000000000000000000000/impersonate', {}, saHeader()
  )
  ok('Unknown cafeId → 404', s1 === 404)

  // Get a real tenant
  const { body: list } = await get('/api/superadmin/tenants?limit=1', saHeader())
  const cafe = list?.cafes?.[0]
  if (!cafe) {
    ok('Impersonation test skipped — no tenants in DB', true)
    return
  }

  const { status: s2, body: b2 } = await post(
    `/api/superadmin/tenants/${cafe.id}/impersonate`, {}, saHeader()
  )

  // Either 200 with a token, or 404 if cafe has no admin user
  const validOutcome = s2 === 200 || s2 === 404
  ok('Impersonate returns 200 or 404 (no admin user)', validOutcome, `status=${s2}`)

  if (s2 === 200) {
    ok('Token present in response', typeof b2?.token === 'string')
    ok('expiresIn is 1h', b2?.expiresIn === '1h')
    // Verify the token is a valid JWT flagged with impersonated: true
    try {
      const decoded = jwt.verify(b2.token, JWT_SECRET) as any
      ok('Impersonated flag = true in JWT', decoded?.impersonated === true)
      ok('cafeId in JWT matches', decoded?.cafeId === cafe.id)
    } catch (e) {
      ok('JWT is valid and verifiable', false, String(e))
    }
  }
}

async function testLeadsAPI() {
  console.log('\n── Leads CRM API ──────────────────────────────────────')

  const { status: s1, body: b1 } = await get('/api/superadmin/leads', saHeader())
  ok('GET /leads → 200', s1 === 200)
  ok('Leads response has total + leads array', typeof b1?.total === 'number' && Array.isArray(b1?.leads))
  ok('Summary object present', b1?.summary != null)

  // No secret → 401
  const { status: s2 } = await get('/api/superadmin/leads')
  ok('GET /leads without secret → 401', s2 === 401)

  // Invalid status patch on fake id
  const { status: s3, body: b3 } = await patch(
    '/api/superadmin/leads/000000000000000000000000/status',
    { status: 'InvalidStatus' },
    saHeader()
  )
  ok('Invalid status value → 400', s3 === 400, JSON.stringify(b3))
}

async function testScraperJobStatus() {
  console.log('\n── Scraper job endpoint ───────────────────────────────')

  // Fake job id → 404
  const { status } = await get('/api/superadmin/scraper/jobs/nonexistent-job/status', saHeader())
  ok('Unknown jobId → 404', status === 404)

  // No secret → 401
  const { status: s2 } = await get('/api/superadmin/scraper/jobs/abc/status')
  ok('No secret → 401', s2 === 401)
}

async function testScraperRun() {
  console.log('\n── Scraper run (validation only) ──────────────────────')

  // Missing required fields → 400
  const { status: s1, body: b1 } = await post(
    '/api/superadmin/scraper/run', {}, saHeader()
  )
  ok('Empty body → 400', s1 === 400, JSON.stringify(b1))

  // Invalid platform → 400
  const { status: s2, body: b2 } = await post(
    '/api/superadmin/scraper/run',
    { city: 'Casablanca', country: 'MA', platform: 'twitter', limit: 5 },
    saHeader()
  )
  ok('Invalid platform → 400', s2 === 400, JSON.stringify(b2))

  // Valid request → 202 with jobId (async job started)
  const { status: s3, body: b3 } = await post(
    '/api/superadmin/scraper/run',
    { city: 'Casablanca', country: 'MA', platform: 'google', limit: 2 },
    saHeader()
  )
  ok('Valid scrape request → 202', s3 === 202, `status=${s3} body=${JSON.stringify(b3)}`)
  ok('Response has jobId', typeof b3?.jobId === 'string', JSON.stringify(b3))
}

async function testSuppliersQuota() {
  console.log('\n── Suppliers quota endpoint ───────────────────────────')

  // No token → 401
  const { status: s1 } = await get('/api/restaurant/suppliers/quota')
  ok('No token → 401', s1 === 401)

  // Valid token (fake cafeId → 404 from DB)
  const { status: s2, body: b2 } = await get(
    '/api/restaurant/suppliers/quota', adminToken('000000000000000000000000')
  )
  ok('Unknown cafeId → 404', s2 === 404, JSON.stringify(b2))
}

async function testSuppliersSearch() {
  console.log('\n── Suppliers search validation ────────────────────────')

  // Missing fields → 400
  const { status: s1 } = await post(
    '/api/restaurant/suppliers/search', {}, adminToken('000000000000000000000000')
  )
  ok('Missing query/city → 400', s1 === 400)

  // Blocked keyword (restaurant) → 400
  const { status: s2, body: b2 } = await post(
    '/api/restaurant/suppliers/search',
    { query: 'best restaurant casablanca', city: 'Casablanca' },
    adminToken('000000000000000000000000')
  )
  ok('Restaurant keyword blocked → 400', s2 === 400, JSON.stringify(b2))

  // No supplier keyword → 400
  const { status: s3 } = await post(
    '/api/restaurant/suppliers/search',
    { query: 'random query', city: 'Casablanca' },
    adminToken('000000000000000000000000')
  )
  ok('Missing supplier keyword → 400', s3 === 400)

  // Valid query but fake cafeId → 404 (cafe not found)
  const { status: s4 } = await post(
    '/api/restaurant/suppliers/search',
    { query: 'grossiste alimentaire', city: 'Casablanca' },
    adminToken('000000000000000000000000')
  )
  ok('Valid query, unknown cafe → 404', s4 === 404)
}

async function testAdminAuthRoutes() {
  console.log('\n── Auth guard on admin routes ─────────────────────────')

  const { status: s1 } = await get('/api/admin/products')
  ok('GET /admin/products without token → 401', s1 === 401)

  const { status: s2 } = await get('/api/admin/cafe/wifi')
  ok('GET /admin/cafe/wifi without token → 401', s2 === 401)

  // POS orders has only POST + GET /table/:id — POST without token should 401
  const { status: s3 } = await post('/api/pos/orders', {})
  ok('POST /api/pos/orders without token → 401', s3 === 401)

  const { status: s4 } = await get('/api/pos/tables-status')
  ok('GET /api/pos/tables-status without token → 401', s4 === 401)
}

async function testNotFoundHandling() {
  console.log('\n── 404 / not found handling ───────────────────────────')
  // Non-existent API route should not crash (Next.js handles it as page, we just check it doesn't 500)
  const res = await fetch(`${SERVER}/api/nonexistent-route-xyz`)
  ok('Unknown API path → not 500', res.status !== 500, `got ${res.status}`)
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  Smart Resto — Control Test Suite`)
  console.log(`  Target: ${SERVER}`)
  console.log(`${'═'.repeat(56)}`)

  try {
    await testHealth()
    await testSuperadminGuard()
    await testTenantsList()
    await testBillingOverview()
    await testFeatureFlags()
    await testImpersonation()
    await testLeadsAPI()
    await testScraperJobStatus()
    await testScraperRun()
    await testSuppliersQuota()
    await testSuppliersSearch()
    await testAdminAuthRoutes()
    await testNotFoundHandling()
  } catch (err) {
    console.error('\n🔥 Unexpected error during test run:', err)
    failed++
  }

  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  console.log(`${'═'.repeat(56)}\n`)

  process.exit(failed > 0 ? 1 : 0)
}

main()
