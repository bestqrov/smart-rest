/**
 * Control test suite — Comptoir POS + Caisse (Tasks 1–8 end-to-end).
 * Run: npx ts-node --transpile-only scripts/controlTestComptoir.ts
 *
 * NOTE: staff/cafe discovery is done via direct Prisma queries rather than
 * GET /api/public/demo-staff — that route requires the request's `subdomain`
 * query param to literally equal env.DEMO_SUBDOMAIN, then looks up a cafe by
 * that same string as its actual subdomain. In this environment no seeded
 * cafe has subdomain "welcome" (the real demo cafes are "plage" /
 * "qa-restaurant"), so that lookup always 404s. Instead we resolve the real
 * demo cafe/staff directly here, then pass both `cafeId` (real id) and
 * `subdomain: DEMO_SUBDOMAIN` (the literal trigger string) to
 * POST /api/pos/shift — its demo-mode bypass branch checks `subdomain ===
 * DEMO_SUBDOMAIN` as a trigger, and separately resolves the cafe from the
 * explicit `cafeId` field when both are present.
 */

import dotenv from 'dotenv'
dotenv.config()

import fetch from 'node-fetch'
import jwt from 'jsonwebtoken'
import prisma from '../src/prisma'
import { runShiftOvertimeLock } from '../src/cron/shiftOvertimeLock'

const SERVER = process.env.SERVER_URL || 'http://localhost:3000'
const DEMO_SUBDOMAIN = process.env.DEMO_SUBDOMAIN || 'welcome'
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
const TEST_PHONE = '+212600000001'

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

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${SERVER}${path}`, { headers })
  let body: any = {}
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── Setup ───────────────────────────────────────────────')

  const demoCafe = await prisma.cafe.findFirst({ where: { isDemo: true }, select: { id: true, subdomain: true } })
  if (!demoCafe) {
    console.error('Cannot continue: no demo cafe found (Cafe.isDemo = true). Seed one first.')
    process.exit(1)
  }
  const demoStaffRecord = await prisma.staff.findFirst({ where: { cafeId: demoCafe.id, isActive: true }, select: { id: true } })
  if (!demoStaffRecord) {
    console.error('Cannot continue: demo cafe has no active staff.')
    process.exit(1)
  }
  const demoStaffId = demoStaffRecord.id
  const cafeId = demoCafe.id
  console.log(`  using demo cafe ${cafeId} (subdomain: ${demoCafe.subdomain}), staff ${demoStaffId}`)

  // Clean up any shift left open by a previous run — not asserted, since a
  // 404 here is expected when there was nothing to close, but logged so a
  // genuine failure here doesn't masquerade as a misleading downstream error.
  const { status: precleanStatus } = await post('/api/pos/shift', { cafeId, subdomain: DEMO_SUBDOMAIN, action: 'close', demoStaffId, countedCash: 0 })
  console.log(`  (pre-run cleanup: close-any-open-shift → ${precleanStatus})`)

  console.log('\n── Login ───────────────────────────────────────────────')
  {
    const { status, body } = await post('/api/pos/shift', { cafeId, subdomain: DEMO_SUBDOMAIN, action: 'login', demoStaffId })
    ok('POST /api/pos/shift login → 200', status === 200, JSON.stringify(body))
    ok('login returns a token', typeof body?.token === 'string' && body.token.length > 0)
  }

  console.log('\n── Shift open/close ────────────────────────────────────')
  let shiftToken = ''
  let shiftId = ''
  {
    const plannedEndTime = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const { status, body } = await post('/api/pos/shift', {
      cafeId, subdomain: DEMO_SUBDOMAIN, action: 'open', demoStaffId,
      plannedEndTime, initialCash: 200,
    })
    ok('POST /api/pos/shift open → 201', status === 201, JSON.stringify(body))
    ok('shift.initialCash === 200', body?.shift?.initialCash === 200)
    ok('shift.plannedEndTime is truthy', !!body?.shift?.plannedEndTime)
    shiftToken = body?.token
    shiftId = body?.shift?.id

    const { status: s2 } = await post('/api/pos/shift', {
      cafeId, subdomain: DEMO_SUBDOMAIN, action: 'open', demoStaffId,
      plannedEndTime, initialCash: 200,
    })
    ok('Opening a second shift while one is open → 409', s2 === 409)
  }

  console.log('\n── POS customers ───────────────────────────────────────')
  const authHeader = { Authorization: `Bearer ${shiftToken}` }
  {
    const { status } = await post('/api/pos/customers', { phone: TEST_PHONE, name: 'Test Comptoir Client' }, authHeader)
    ok('POST /api/pos/customers → 201', status === 201)

    const { status: s2, body: b2 } = await get(`/api/pos/customers?search=${encodeURIComponent(TEST_PHONE)}`, authHeader)
    ok('GET /api/pos/customers?search= → 200', s2 === 200)
    ok('items contains the created customer', Array.isArray(b2?.items) && b2.items.some((c: any) => c.phone === TEST_PHONE))

    const { status: s3 } = await get(`/api/pos/customers?search=${encodeURIComponent(TEST_PHONE)}`)
    ok('GET /api/pos/customers without auth → 401', s3 === 401)
  }

  console.log('\n── Order with orderType ────────────────────────────────')
  let orderId = ''
  let productPrice = 0
  {
    const { status, body } = await get('/api/pos/menu', authHeader)
    ok('GET /api/pos/menu → 200', status === 200)

    const categories = body?.categories ?? []
    const category = categories.find((c: any) => Array.isArray(c.products) && c.products.length > 0)
    if (!category) {
      console.error('No category with at least one product found in demo menu — cannot continue.')
      process.exit(1)
    }
    const product = category.products[0]
    productPrice = product.price

    const { status: s2, body: b2 } = await post('/api/pos/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: 'CASH',
      customerPhone: TEST_PHONE,
      orderType: 'TAKEAWAY',
    }, authHeader)
    ok('POST /api/pos/orders → 201', s2 === 201, JSON.stringify(b2))
    ok('order.orderType === TAKEAWAY', b2?.order?.orderType === 'TAKEAWAY')
    orderId = b2?.order?.id

    const { status: s3, body: b3 } = await patch(`/api/pos/orders/${orderId}/checkout`, {
      paymentMethod: 'CASH', printReceipt: false,
    }, authHeader)
    ok('PATCH /api/pos/orders/:id/checkout → 200', s3 === 200, JSON.stringify(b3))
    ok('order.isPaid === true', b3?.order?.isPaid === true)
  }

  console.log('\n── Close shift, verify discrepancy math ────────────────')
  {
    const countedCash = 200 + productPrice
    const { status, body } = await post('/api/pos/shift', {
      cafeId, subdomain: DEMO_SUBDOMAIN, action: 'close', demoStaffId, countedCash,
    })
    ok('POST /api/pos/shift close → 200', status === 200, JSON.stringify(body))
    ok('shift.totalCollectedCash === product price', body?.shift?.totalCollectedCash === productPrice)
    ok('shift.discrepancy === 0', body?.shift?.discrepancy === 0)
  }

  console.log('\n── Overtime lock / admin unlock ─────────────────────────')
  {
    // Legitimate test setup: put the shift back into a state the cron's own
    // WHERE-clause should act on (OPEN, plannedEndTime > 1h in the past,
    // lockedAt null) — then let the real cron function do the locking.
    await prisma.cashierShift.update({
      where: { id: shiftId },
      data: { status: 'OPEN', lockedAt: null, plannedEndTime: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    })

    const cronResult = await runShiftOvertimeLock()
    ok('runShiftOvertimeLock() locked >= 1 shift', cronResult.locked >= 1, JSON.stringify(cronResult))

    const lockedShift = await prisma.cashierShift.findUnique({ where: { id: shiftId } })
    ok('shift.lockedAt is truthy after runShiftOvertimeLock()', !!lockedShift?.lockedAt)

    const { status } = await post('/api/pos/orders', {
      items: [], paymentMethod: 'CASH',
    }, authHeader)
    ok('POST /api/pos/orders on locked shift → 423', status === 423)

    const { status: s2 } = await patch(`/api/admin/shifts/${shiftId}/unlock`, {})
    ok('PATCH /api/admin/shifts/:id/unlock without admin token → 401', s2 === 401)

    const adminAuthHeader = { Authorization: `Bearer ${jwt.sign({ userId: 'u1', cafeId, subdomain: 'test' }, JWT_SECRET, { expiresIn: '1h' })}` }
    const { status: s3, body: b3 } = await patch(`/api/admin/shifts/${shiftId}/unlock`, {}, adminAuthHeader)
    ok('PATCH /api/admin/shifts/:id/unlock with admin token → 200', s3 === 200, JSON.stringify(b3))
    ok('unlock response shift.lockedAt === null', b3?.shift?.lockedAt === null)
  }

  console.log('\n── Cleanup ──────────────────────────────────────────────')
  try {
    if (orderId) {
      await prisma.orderItem.deleteMany({ where: { orderId } })
      await prisma.order.delete({ where: { id: orderId } })
    }
    if (shiftId) await prisma.cashierShift.delete({ where: { id: shiftId } })
    await prisma.cafeCustomer.deleteMany({ where: { cafeId, phone: TEST_PHONE } })
  } catch (err) {
    console.error('Cleanup failed (non-fatal):', err)
  }

  console.log('\n── Summary ──────────────────────────────────────────────')
  console.log(`  ${passed} passed, ${failed} failed`)
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error('Fatal error in control test:', err)
  await prisma.$disconnect()
  process.exit(1)
})
