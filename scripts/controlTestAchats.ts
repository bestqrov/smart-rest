/**
 * Integration coverage for the Requisition → PO → Invoice → Payment chain
 * and the achats report endpoint. Run against a live dev server:
 *   npx ts-node --transpile-only scripts/controlTestAchats.ts
 *
 * NOTES:
 *  - Login is POST /api/auth/login with { email, password } (no subdomain
 *    needed in the request — the route derives it from the user's cafe and
 *    returns it in the response).
 *  - /api/v1/inventory/* and /api/admin/achats/report are gated behind
 *    Cafe.isSmartInventoryEnabled, which defaults to false on the demo cafe.
 *    This script flips it on via a direct Prisma update before the run and
 *    restores its original value afterwards (in a finally block).
 *  - The script creates its own supplier/requisition/PO/invoice/payments and
 *    deletes everything it created at the end, so it is safely re-runnable.
 */
import 'dotenv/config'
import prisma from '../src/prisma'

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

// IDs created along the way — used for cleanup in the finally block.
let cafeId: string | null = null
let originalInventoryFlag: boolean | null = null
let createdSupplierId: string | null = null
let requisitionId: string | null = null
let purchaseOrderId: string | null = null
let invoiceId: string | null = null

async function main() {
  console.log('\n── Setup ───────────────────────────────────────────────')
  const adminEmail = process.env.TEST_ADMIN_EMAIL ?? 'plage@demo.com'
  const adminPass  = process.env.TEST_ADMIN_PASSWORD ?? 'demo1234'

  const { res: loginRes, data: login } = await json('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPass }),
  })
  ok(loginRes.status === 200, 'admin login → 200')
  const token = login?.token as string
  cafeId = login?.cafeId as string
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  if (!token || !cafeId) {
    console.error('Cannot continue without a valid token/cafeId — aborting.')
    console.log(`\n  ${passed} passed, ${failed} failed`)
    await prisma.$disconnect()
    process.exit(1)
  }

  // Flip the isSmartInventoryEnabled gate on for the duration of the run —
  // /api/v1/inventory/* and the achats report route 403 otherwise.
  const cafeBefore = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { isSmartInventoryEnabled: true } })
  originalInventoryFlag = cafeBefore?.isSmartInventoryEnabled ?? false
  if (!originalInventoryFlag) {
    await prisma.cafe.update({ where: { id: cafeId }, data: { isSmartInventoryEnabled: true } })
  }

  console.log('\n── Requisition → PO ─────────────────────────────────────')
  const { res: reqRes, data: req } = await json('/api/v1/requisitions', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ itemName: 'Test Ingredient', quantity: 3, requestedBy: 'Control Test' }),
  })
  ok(reqRes.status === 201, 'POST /api/v1/requisitions → 201')
  requisitionId = req?.id ?? null

  await json(`/api/v1/requisitions/${req.id}`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ status: 'approved' }),
  })

  let { data: suppliers } = await json('/api/v1/inventory/suppliers', { headers: auth })
  if (!Array.isArray(suppliers) || suppliers.length === 0) {
    // Fresh cafe with no suppliers yet — create one dedicated to this test run
    // (tracked for cleanup) rather than failing the assertion below.
    const { data: newSupplier } = await json('/api/v1/inventory/suppliers', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ name: 'Control Test Supplier' }),
    })
    createdSupplierId = newSupplier?.id ?? null
    ;({ data: suppliers } = await json('/api/v1/inventory/suppliers', { headers: auth }))
  }
  ok(Array.isArray(suppliers) && suppliers.length > 0, 'at least one supplier exists for the test cafe')
  const supplierId = suppliers[0].id

  const { res: poRes, data: po } = await json('/api/v1/inventory/purchase-orders', {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      supplierId, requisitionId: req.id,
      items: [{ stockItemName: 'Test Ingredient', unit: 'kg', quantityOrdered: 3, unitCost: 10 }],
    }),
  })
  ok(poRes.status === 201, 'POST /api/v1/inventory/purchase-orders (linked) → 201')
  ok(po.requisitionId === req.id, 'PO.requisitionId matches the requisition')
  purchaseOrderId = po?.id ?? null

  const { data: reqAfterOrder } = await json(`/api/v1/requisitions?status=ordered`, { headers: auth })
  ok(reqAfterOrder.items.some((r: any) => r.id === req.id), 'linked requisition moved to status=ordered')

  console.log('\n── PO → Invoice (auto-created on receive) ───────────────')
  const { res: receiveRes, data: received } = await json(`/api/v1/inventory/purchase-orders/${po.id}`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ status: 'received' }),
  })
  ok(receiveRes.status === 200, 'PATCH purchase-order status=received → 200')
  void received

  const { data: invoices } = await json('/api/v1/invoices', { headers: auth })
  const autoInvoice = invoices.items.find((i: any) => i.purchaseOrderId === po.id)
  ok(!!autoInvoice, 'SupplierInvoice auto-created with purchaseOrderId set')
  ok(autoInvoice.amount === po.totalCost, 'auto-invoice amount matches PO totalCost')
  ok(autoInvoice.status === 'unpaid', 'auto-invoice starts unpaid')
  invoiceId = autoInvoice?.id ?? null

  const { data: reqAfterReceive } = await json(`/api/v1/requisitions?status=received`, { headers: auth })
  ok(reqAfterReceive.items.some((r: any) => r.id === req.id), 'linked requisition moved to status=received')

  console.log('\n── Invoice → Payment (partial then full) ────────────────')
  const halfAmount = autoInvoice.amount / 2
  const { res: pay1Res, data: pay1 } = await json(`/api/v1/invoices/${autoInvoice.id}/payments`, {
    method: 'POST', headers: auth, body: JSON.stringify({ amount: halfAmount, method: 'cash' }),
  })
  ok(pay1Res.status === 201, 'POST payment (partial) → 201')
  ok(pay1.status === 'partial', 'invoice status becomes partial after half-payment')

  const { res: pay2Res, data: pay2 } = await json(`/api/v1/invoices/${autoInvoice.id}/payments`, {
    method: 'POST', headers: auth, body: JSON.stringify({ amount: halfAmount, method: 'cash' }),
  })
  ok(pay2Res.status === 201, 'POST payment (remainder) → 201')
  ok(pay2.status === 'paid', 'invoice status becomes paid after full payment')

  const { data: paymentsList } = await json(`/api/v1/invoices/${autoInvoice.id}/payments`, { headers: auth })
  ok(paymentsList.items.length === 2, 'both payments recorded in payment history')

  console.log('\n── Achats report ─────────────────────────────────────────')
  const { res: reportRes, data: report } = await json('/api/admin/achats/report?period=month', { headers: auth })
  ok(reportRes.status === 200, 'GET /api/admin/achats/report → 200')
  ok(typeof report.aging.total === 'number', 'report includes aging total')
  ok(Array.isArray(report.spendTrend), 'report includes spendTrend array')
  ok(Array.isArray(report.topSuppliers), 'report includes topSuppliers array')
  ok(Array.isArray(report.upcomingDue), 'report includes upcomingDue array')
  ok(typeof report.pending.pendingRequisitions === 'number', 'report includes pending pipeline counts')

  console.log('\n── Summary ──────────────────────────────────────────────')
  console.log(`  ${passed} passed, ${failed} failed`)
}

async function cleanup() {
  console.log('\n── Cleanup ──────────────────────────────────────────────')
  try {
    if (invoiceId) {
      await prisma.supplierPayment.deleteMany({ where: { invoiceId } })
      await prisma.supplierInvoice.delete({ where: { id: invoiceId } }).catch(() => {})
    }
    if (purchaseOrderId) {
      await prisma.purchaseOrder.delete({ where: { id: purchaseOrderId } }).catch(() => {})
    }
    if (requisitionId) {
      await prisma.purchaseRequisition.delete({ where: { id: requisitionId } }).catch(() => {})
    }
    if (createdSupplierId) {
      await prisma.inventorySupplier.delete({ where: { id: createdSupplierId } }).catch(() => {})
    }
    if (cafeId && originalInventoryFlag === false) {
      // Restore the gate to its original (disabled) state.
      await prisma.cafe.update({ where: { id: cafeId }, data: { isSmartInventoryEnabled: false } }).catch(() => {})
    }
  } catch (err) {
    console.error('Cleanup failed (non-fatal):', err)
  }
}

main()
  .catch(err => { console.error(err); failed++ })
  .finally(async () => {
    await cleanup()
    await prisma.$disconnect()
    process.exit(failed > 0 ? 1 : 0)
  })
