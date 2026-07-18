/**
 * Integration test for the Audit Logs Shared Core sprint:
 * - AuditService round-trip (create → filter by module/entity/performedBy)
 * - menuAdmin.ts route-level adoption (profile/payment-config/wifi/staff
 *   create/deactivate/pin-change all now call AuditService)
 * - New generic SuperAdmin viewer route (src/routes/auditLogsSA.ts) wired
 *   into server.ts, and the "Activity Log" page it fills in
 *
 * Self-cleaning — all test audit rows are deleted at the end.
 *
 * Run: DATABASE_URL=... npx ts-node --transpile-only scripts/controlTestAuditLogs.ts
 */
import { AuditService } from '../src/core'

let passed = 0, failed = 0
function ok(cond: boolean, label: string) {
  if (cond) { console.log(`  ✅  ${label}`); passed++ }
  else      { console.log(`  ❌  ${label}`); failed++ }
}

const TEST_MODULE = `TEST_AUDIT_${Date.now()}`
const createdIds: string[] = []

async function main() {
  console.log('\n1. AuditService round-trip')
  const entry = await AuditService.createAudit({
    module: TEST_MODULE, entity: 'TestEntity', entityId: 'test-entity-1',
    action: 'TEST_ACTION', performedBy: 'test-user', metadata: { foo: 'bar' },
  })
  createdIds.push(entry.id)
  ok(!!entry.id, 'createAudit returns an id')
  ok(entry.module === TEST_MODULE, 'module round-trips')
  ok(entry.metadata?.foo === 'bar', 'metadata round-trips through JSON serialize/deserialize')

  const byModule = await AuditService.getAuditHistory({ module: TEST_MODULE })
  ok(byModule.items.length === 1 && byModule.items[0].id === entry.id, 'getAuditHistory filters by module')

  const byEntity = await AuditService.filterByEntity('TestEntity', 'test-entity-1')
  ok(byEntity.items.some(e => e.id === entry.id), 'filterByEntity finds the entry')

  const byUser = await AuditService.filterByUser('test-user')
  ok(byUser.items.some(e => e.id === entry.id), 'filterByUser finds the entry')

  console.log('\n2. menuAdmin.ts route-level adoption (static check — confirms the calls exist in source)')
  const fs = require('fs')
  const path = require('path')
  const menuAdminSrc = fs.readFileSync(path.join(__dirname, '../src/routes/menuAdmin.ts'), 'utf8')
  ok(menuAdminSrc.includes("auditSettings('UPDATE_PROFILE'"), 'PUT /api/admin/cafe/profile logs UPDATE_PROFILE')
  ok(menuAdminSrc.includes("auditSettings('UPDATE_PAYMENT_CONFIG'"), 'PUT /api/admin/cafe/payment-config logs UPDATE_PAYMENT_CONFIG (no credential values)')
  ok(menuAdminSrc.includes("auditSettings('UPDATE_WIFI'"), 'PUT /api/admin/cafe/wifi logs UPDATE_WIFI (no password value)')
  ok(menuAdminSrc.includes("action: 'CREATE', performedBy: req.admin!.userId"), 'POST /api/admin/staff logs CREATE')
  ok(menuAdminSrc.includes("action: 'DEACTIVATE'"), 'DELETE /api/admin/staff/:id logs DEACTIVATE')
  ok(menuAdminSrc.includes("action: 'PIN_CHANGE'"), 'PATCH /api/admin/staff/:id/pin logs PIN_CHANGE (no PIN value)')
  ok(!/action:\s*'PIN_CHANGE'[^}]*pinCode/.test(menuAdminSrc), 'PIN_CHANGE audit call does not include the raw pinCode value')

  console.log('\n3. Generic SuperAdmin audit-logs route wired into server.ts')
  const serverSrc = fs.readFileSync(path.join(__dirname, '../src/server.ts'), 'utf8')
  ok(serverSrc.includes('auditLogsSARouter'), 'server.ts imports auditLogsSARouter')
  ok(/app\.use\(auditLogsSARouter\)/.test(serverSrc), 'server.ts registers auditLogsSARouter')

  const routeSrc = fs.readFileSync(path.join(__dirname, '../src/routes/auditLogsSA.ts'), 'utf8')
  ok(routeSrc.includes("/api/superadmin/audit-logs'"), 'GET /api/superadmin/audit-logs route exists')
  ok(routeSrc.includes("/api/superadmin/audit-logs/modules'"), 'GET /api/superadmin/audit-logs/modules route exists')
  ok(routeSrc.includes('requireSuperAdmin'), 'audit-logs routes are gated by requireSuperAdmin')

  console.log('\n4. Activity Log viewer page fills the known dead nav link')
  const fs2 = require('fs')
  ok(fs2.existsSync(path.join(__dirname, '../app/superadmin/activity/page.tsx')), 'app/superadmin/activity/page.tsx now exists (was a dead nav link per the prior audit)')

  console.log('\nCleanup')
  const { default: prisma } = await import('../src/prisma')
  await (prisma as any).auditEntry.deleteMany({ where: { id: { in: createdIds } } })
  console.log(`  🧹  removed ${createdIds.length} test audit row(s)`)
  await prisma.$disconnect()

  console.log(`\n${passed} passed, ${failed} failed`)
  console.log(failed === 0 ? 'INTEGRATION TEST: PASS' : 'INTEGRATION TEST: FAIL')
  if (failed > 0) process.exit(1)
}

main().catch(async (err) => {
  console.error('INTEGRATION TEST: ERROR', err)
  try {
    const { default: prisma } = await import('../src/prisma')
    await (prisma as any).auditEntry.deleteMany({ where: { id: { in: createdIds } } })
  } catch {}
  process.exit(1)
})
