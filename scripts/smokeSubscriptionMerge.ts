/**
 * Sprint K2.2 → K48 merge smoke test — no DB required.
 *
 * Verifies: the module graph resolves at runtime after merging main into
 * worktree-sprint-k2-subscription-engine; the old TenantProfile-based
 * subscription API is fully gone (no stale dual-system); the old
 * SubscriptionLifecycleJobs.ts stub and its cron were deleted outright (per
 * the Tenant Access Migration Phase 1 decision to build a real Scheduler
 * rather than resurrect the stub); the real SubscriptionScheduler (K48) is
 * registered in its place; no other cron job was affected; and manual
 * lifecycle operations remain fully available via the SuperAdmin
 * BillingSubscription API.
 *
 * Run: npx ts-node --transpile-only scripts/smokeSubscriptionMerge.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import * as Billing from '../src/billing'
import * as SubscriptionService from '../src/billing/subscriptions/SubscriptionService'
import * as SubscriptionScheduler from '../src/billing/scheduler/SubscriptionScheduler'
import { startSubscriptionSchedulerCron } from '../src/cron/subscriptionSchedulerCron'

let passed = 0, failed = 0
function ok(cond: boolean, label: string) {
  if (cond) { console.log(`  ✅  ${label}`); passed++ }
  else      { console.log(`  ❌  ${label}`); failed++ }
}

console.log('\n1. Billing barrel (src/billing/index.ts) exports the K2 API')
ok(typeof Billing.runSubscriptionLifecycleSweep === 'function', 'exports runSubscriptionLifecycleSweep')
ok(typeof Billing.getSubscription === 'function', 'exports getSubscription (K2, by id)')
ok(typeof Billing.getSubscriptionByTenant === 'function', 'exports getSubscriptionByTenant (K2, by tenant)')

console.log('\n2. SubscriptionService (K2) — new BillingSubscription API present')
ok(typeof SubscriptionService.createTrialSubscription === 'function', 'createTrialSubscription exists')
ok(typeof SubscriptionService.activate === 'function', 'activate exists')
ok(typeof SubscriptionService.expire === 'function', 'expire exists')
ok(typeof SubscriptionService.suspend === 'function', 'suspend exists')
ok(typeof SubscriptionService.renew === 'function', 'renew exists')
ok(typeof SubscriptionService.enterGracePeriod === 'function', 'enterGracePeriod exists (K48 Scheduler wrapper)')
ok(typeof SubscriptionService.isAccessAllowed === 'function', 'isAccessAllowed exists (Tenant Access Migration Phase 1)')
ok(typeof SubscriptionService.isCafeAccessAllowed === 'function', 'isCafeAccessAllowed exists (Tenant Access Migration Phase 1)')

console.log('\n3. Old TenantProfile-based subscription API is fully removed (no dual system)')
ok((SubscriptionService as any).cancelSubscription === undefined, 'old cancelSubscription is gone')
ok((SubscriptionService as any).suspendSubscription === undefined, 'old suspendSubscription is gone')
ok((SubscriptionService as any).renewSubscription === undefined, 'old renewSubscription is gone')
ok((SubscriptionService as any).createSubscription === undefined, 'old createSubscription is gone')
ok((SubscriptionService as any).startTrialSubscription === undefined, 'old startTrialSubscription is gone')

console.log('\n4. Old K2.2 stub-only adapter surface is gone (superseded by the real K48 Scheduler)')
ok((SubscriptionService as any).findTrialsEndingWithin === undefined, 'SubscriptionService.findTrialsEndingWithin removed (moved to Repository, used by the real Scheduler)')
ok(fs.existsSync(path.join(__dirname, '../src/billing/lifecycle/SubscriptionLifecycleJobs.ts')) === false, 'SubscriptionLifecycleJobs.ts (old stub) no longer exists')
ok(fs.existsSync(path.join(__dirname, '../src/cron/subscriptionLifecycle.ts')) === false, 'cron/subscriptionLifecycle.ts (old stub cron) no longer exists')

console.log('\n5. SubscriptionScheduler (K48) — real scheduler, not a stub')
ok(typeof SubscriptionScheduler.runTrialEndingReminders === 'function', 'runTrialEndingReminders exists')
ok(typeof SubscriptionScheduler.runTrialExpirationCheck === 'function', 'runTrialExpirationCheck exists')
ok(typeof SubscriptionScheduler.runActiveLapseCheck === 'function', 'runActiveLapseCheck exists')
ok(typeof SubscriptionScheduler.runGracePeriodExpirationCheck === 'function', 'runGracePeriodExpirationCheck exists')
ok(typeof SubscriptionScheduler.runSubscriptionLifecycleSweep === 'function', 'runSubscriptionLifecycleSweep exists')
ok(SubscriptionScheduler.runSubscriptionLifecycleSweep === Billing.runSubscriptionLifecycleSweep, 'billing barrel re-exports the SAME scheduler fn (no shadow copy)')
ok(typeof startSubscriptionSchedulerCron === 'function', 'src/cron/subscriptionSchedulerCron.ts exports startSubscriptionSchedulerCron')

console.log('\n6. Cron registration — real scheduler active, no other cron affected')
const serverSrc = fs.readFileSync(path.join(__dirname, '../src/server.ts'), 'utf8')
ok(/^\s*startSubscriptionSchedulerCron\(\),\s*$/m.test(serverSrc), 'startSubscriptionSchedulerCron() is actively registered in cronTasks')
ok(!serverSrc.includes('startSubscriptionLifecycleCron'), 'no reference to the old startSubscriptionLifecycleCron remains')
for (const other of ['startDailyDebtDetectionCron', 'startWeeklyBillingCron', 'startNightlyCron', 'startCertificationCron', 'startWhatsAppSchedulerCron', 'startEmailSchedulerCron', 'startSocialSchedulerCron', 'startShiftOvertimeLockCron']) {
  ok(new RegExp(`^\\s*${other}\\(\\),\\s*$`, 'm').test(serverSrc), `${other}() is still actively registered (unaffected)`)
}

console.log('\n7. Manual lifecycle operations remain available (SuperAdmin API)')
const routesSrc = fs.readFileSync(path.join(__dirname, '../src/routes/billingSubscriptionsSA.ts'), 'utf8')
for (const action of ['activate', 'suspend', 'resume', 'cancel', 'renew', 'change-plan']) {
  ok(routesSrc.includes(`/${action}'`), `POST .../:id/${action} route still registered`)
}

console.log('\n8. Zero legacy billing dependency — no src/billing/** code reads TenantProfile')
const glob = require('child_process').execSync(
  `grep -rl "tenantProfile" --include="*.ts" ${path.join(__dirname, '../src/billing')} || true`,
  { encoding: 'utf8' },
).trim()
ok(glob === '', 'no file under src/billing/ contains a `tenantProfile` (prisma) read/write')

const metricsSrc = fs.readFileSync(path.join(__dirname, '../src/billing/metrics/BillingMetricsService.ts'), 'utf8')
ok(metricsSrc.includes('billingSubscription'), 'BillingMetricsService.ts reads billingSubscription')
ok(!metricsSrc.includes('tenantProfile'), 'BillingMetricsService.ts no longer reads tenantProfile')

const planRepoSrc = fs.readFileSync(path.join(__dirname, '../src/billing/plans/PlanRepository.ts'), 'utf8')
ok(planRepoSrc.includes("from '../subscriptions/SubscriptionRepository'"), 'PlanRepository.ts delegates to SubscriptionRepository.countByPlan')
ok(!planRepoSrc.includes('tenantProfile'), 'PlanRepository.ts no longer reads tenantProfile')

console.log('\n9. Tenant Access Migration (Phase 1) — access gates wired, nightly TenantProfile sweep removed')
const gateFiles = [
  '../src/middleware/validateSeatQR.ts',
  '../src/routes/publicCafe.ts',
  '../src/routes/clientMenu.ts',
  '../src/routes/customers.ts',
]
let totalGateCallSites = 0
for (const f of gateFiles) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8')
  const count = (src.match(/isCafeAccessAllowed\(/g) || []).length
  totalGateCallSites += count
  ok(count > 0, `${f} calls isCafeAccessAllowed (${count}x)`)
}
ok(totalGateCallSites === 7, `exactly 7 isCafeAccessAllowed call sites across the 4 gate files (found ${totalGateCallSites})`)

const nightlySrc = fs.readFileSync(path.join(__dirname, '../src/cron/nightly.ts'), 'utf8')
ok(!/\b(expireTrials|expireGracePeriods|notifyExpiringTrials|cleanupExpiredPromotions)\(/.test(nightlySrc),
   'nightly.ts no longer calls the TenantProfile lifecycle functions')
ok(nightlySrc.includes('resetDemoCafeStaff'), 'nightly.ts still runs unrelated jobs (resetDemoCafeStaff) — surgical removal only')

console.log('\n10. Release Patch P0 — CafeCreated is published from every real cafe-creation path')
const authSrc = fs.readFileSync(path.join(__dirname, '../src/routes/auth.ts'), 'utf8')
const demoReqSrc = fs.readFileSync(path.join(__dirname, '../src/routes/demoRequests.ts'), 'utf8')
const cafeCreatedPublishCount = (authSrc.match(/eventBus\.publish\('CafeCreated'/g) || []).length
                               + (demoReqSrc.match(/eventBus\.publish\('CafeCreated'/g) || []).length
ok(cafeCreatedPublishCount === 4, `exactly 4 CafeCreated publish call sites across auth.ts (3) + demoRequests.ts (1) (found ${cafeCreatedPublishCount})`)
ok(fs.existsSync(path.join(__dirname, 'controlTestCafeCreatedPipeline.ts')), 'Signup → CafeCreated → BillingSubscription integration test exists')

console.log(`\n${passed} passed, ${failed} failed`)
console.log(failed === 0 ? 'SMOKE TEST: PASS' : 'SMOKE TEST: FAIL')
if (failed > 0) process.exit(1)
