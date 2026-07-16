/**
 * Sprint K2.2 merge smoke test — no DB required.
 *
 * Verifies the module graph resolves at runtime after merging main into
 * worktree-sprint-k2-subscription-engine, that the SubscriptionLifecycleJobs
 * compatibility layer exposes the exact function names/signatures the
 * existing production cron (src/cron/subscriptionLifecycle.ts) expects, and
 * that the old TenantProfile-based subscription API is fully gone (proving
 * there isn't a stale dual-system).
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
ok(typeof SubscriptionService.findTrialsEndingWithin === 'function', 'findTrialsEndingWithin exists (new scheduler finder)')
ok(typeof SubscriptionService.findExpiredTrials === 'function', 'findExpiredTrials exists (new scheduler finder)')
ok(typeof SubscriptionService.findExpiredGracePeriods === 'function', 'findExpiredGracePeriods exists (new scheduler finder)')
ok(typeof SubscriptionService.findRenewalCandidates === 'function', 'findRenewalCandidates exists (new scheduler finder)')

console.log('\n3. Old TenantProfile-based subscription API is fully removed (no dual system)')
ok((SubscriptionService as any).cancelSubscription === undefined, 'old cancelSubscription is gone')
ok((SubscriptionService as any).suspendSubscription === undefined, 'old suspendSubscription is gone')
ok((SubscriptionService as any).renewSubscription === undefined, 'old renewSubscription is gone')
ok((SubscriptionService as any).createSubscription === undefined, 'old createSubscription is gone')
ok((SubscriptionService as any).startTrialSubscription === undefined, 'old startTrialSubscription is gone')

console.log('\n4. SubscriptionLifecycleJobs compat adapter — same entry points the cron uses')
ok(typeof LifecycleJobs.runTrialEndingReminders === 'function', 'runTrialEndingReminders exists')
ok(typeof LifecycleJobs.runSubscriptionExpirationCheck === 'function', 'runSubscriptionExpirationCheck exists')
ok(typeof LifecycleJobs.runGracePeriodExpirationCheck === 'function', 'runGracePeriodExpirationCheck exists')
ok(typeof LifecycleJobs.runAutomaticRenewalChecks === 'function', 'runAutomaticRenewalChecks exists')
ok(typeof LifecycleJobs.runSubscriptionLifecycleSweep === 'function', 'runSubscriptionLifecycleSweep exists')
ok(LifecycleJobs.runSubscriptionLifecycleSweep === Billing.runSubscriptionLifecycleSweep, 'billing barrel re-exports the SAME sweep fn (no shadow copy)')

console.log('\n5. Cron registration untouched')
ok(typeof startSubscriptionLifecycleCron === 'function', 'src/cron/subscriptionLifecycle.ts still exports startSubscriptionLifecycleCron')

console.log(`\n${passed} passed, ${failed} failed`)
console.log(failed === 0 ? 'SMOKE TEST: PASS' : 'SMOKE TEST: FAIL')
if (failed > 0) process.exit(1)
