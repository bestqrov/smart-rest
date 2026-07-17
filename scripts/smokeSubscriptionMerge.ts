/**
 * Sprint K2.2 → K48 merge smoke test — no DB required.
 *
 * Verifies: the module graph resolves at runtime after merging main into
 * worktree-sprint-k2-subscription-engine; the old TenantProfile-based
 * subscription API is fully gone (no stale dual-system); the legacy
 * subscription-lifecycle cron is disabled and SubscriptionLifecycleJobs.ts
 * is a no-op stub (NOT a compatibility adapter, per K48 PM decision); no
 * other cron job was affected; and manual lifecycle operations remain fully
 * available via the SuperAdmin BillingSubscription API.
 *
 * Run: npx ts-node --transpile-only scripts/smokeSubscriptionMerge.ts
 */
import * as Billing from '../src/billing'
import * as SubscriptionService from '../src/billing/subscriptions/SubscriptionService'
import * as LifecycleJobs from '../src/billing/lifecycle/SubscriptionLifecycleJobs'
import { startSubscriptionLifecycleCron } from '../src/cron/subscriptionLifecycle'

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

console.log('\n3. Old TenantProfile-based subscription API is fully removed (no dual system)')
ok((SubscriptionService as any).cancelSubscription === undefined, 'old cancelSubscription is gone')
ok((SubscriptionService as any).suspendSubscription === undefined, 'old suspendSubscription is gone')
ok((SubscriptionService as any).renewSubscription === undefined, 'old renewSubscription is gone')
ok((SubscriptionService as any).createSubscription === undefined, 'old createSubscription is gone')
ok((SubscriptionService as any).startTrialSubscription === undefined, 'old startTrialSubscription is gone')

console.log('\n4. SubscriptionService has no adapter/scheduler-finder surface (K48: cleanliness over compat)')
ok((SubscriptionService as any).findTrialsEndingWithin === undefined, 'findTrialsEndingWithin removed (was adapter-only)')
ok((SubscriptionService as any).findExpiredTrials === undefined, 'findExpiredTrials removed (was adapter-only)')
ok((SubscriptionService as any).findExpiredGracePeriods === undefined, 'findExpiredGracePeriods removed (was adapter-only)')
ok((SubscriptionService as any).findRenewalCandidates === undefined, 'findRenewalCandidates removed (was adapter-only)')

console.log('\n5. SubscriptionLifecycleJobs is a no-op stub, not a compatibility adapter')
ok(typeof LifecycleJobs.runTrialEndingReminders === 'function', 'runTrialEndingReminders still exported (import sites keep compiling)')
ok(typeof LifecycleJobs.runSubscriptionExpirationCheck === 'function', 'runSubscriptionExpirationCheck still exported')
ok(typeof LifecycleJobs.runGracePeriodExpirationCheck === 'function', 'runGracePeriodExpirationCheck still exported')
ok(typeof LifecycleJobs.runAutomaticRenewalChecks === 'function', 'runAutomaticRenewalChecks still exported')
ok(typeof LifecycleJobs.runSubscriptionLifecycleSweep === 'function', 'runSubscriptionLifecycleSweep still exported')
ok(LifecycleJobs.runSubscriptionLifecycleSweep === Billing.runSubscriptionLifecycleSweep, 'billing barrel re-exports the SAME stub fn (no shadow copy)')

async function verifyStubIsInert() {
  const result = await LifecycleJobs.runSubscriptionLifecycleSweep()
  ok(result.remindersSent === 0 && result.cancelled.length === 0 && result.suspended.length === 0 && result.renewed.length === 0,
     'runSubscriptionLifecycleSweep() is inert — returns all-empty result with zero DB/API calls')
}

console.log('\n6. Legacy cron implementation preserved but registration disabled')
ok(typeof startSubscriptionLifecycleCron === 'function', 'src/cron/subscriptionLifecycle.ts still exports startSubscriptionLifecycleCron (not deleted)')

const fs = require('fs')
const path = require('path')
const serverSrc = fs.readFileSync(path.join(__dirname, '../src/server.ts'), 'utf8')
ok(/\/\/\s*startSubscriptionLifecycleCron\(\)/.test(serverSrc), 'startSubscriptionLifecycleCron() call is commented out in cronTasks')
ok(!/^\s*startSubscriptionLifecycleCron\(\),\s*$/m.test(serverSrc), 'no active (uncommented) startSubscriptionLifecycleCron() call remains')
ok(/TODO\(K48\)/.test(serverSrc), 'server.ts has the required TODO(K48) marker near the disabled cron')
for (const other of ['startDailyDebtDetectionCron', 'startWeeklyBillingCron', 'startNightlyCron', 'startCertificationCron', 'startWhatsAppSchedulerCron', 'startEmailSchedulerCron', 'startSocialSchedulerCron', 'startShiftOvertimeLockCron']) {
  ok(new RegExp(`^\\s*${other}\\(\\),\\s*$`, 'm').test(serverSrc), `${other}() is still actively registered (unaffected)`)
}

const jobsSrc = fs.readFileSync(path.join(__dirname, '../src/billing/lifecycle/SubscriptionLifecycleJobs.ts'), 'utf8')
ok(/TODO\(K48\)/.test(jobsSrc), 'SubscriptionLifecycleJobs.ts has the required TODO(K48) marker')
ok(!/^import .*from ['"]\.\.\/subscriptions\//m.test(jobsSrc), 'SubscriptionLifecycleJobs.ts does not import the new BillingSubscription engine (no adapter logic)')

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

verifyStubIsInert().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`)
  console.log(failed === 0 ? 'SMOKE TEST: PASS' : 'SMOKE TEST: FAIL')
  if (failed > 0) process.exit(1)
})
