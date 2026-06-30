# Tenant Lifecycle Engine — Architecture Reference

Platform-wide tenant management for SmartSuite OS. Zero Restaurant logic. Every SaaS module (Restaurant, Hotel, Clinic, Retail, Retail) reuses it.

---

## Lifecycle Diagram

```
                     provision()
                         │
                         ▼
                     ┌──────┐
                     │PENDING│
                     └───┬──┘
             startTrial()│     activate()
                    ┌────┘────────────┐
                    ▼                 ▼
                ┌───────┐         ┌────────┐
                │ TRIAL │─────────│ ACTIVE │◄───── reactivate()
                └───┬───┘activate └────┬───┘
                    │                  │
               trial│expires     enterGrace
                    │            Period()
                    ▼                  │
              ┌────────────┐           │
              │GRACE_PERIOD│◄──────────┘
              └─────┬──────┘
      grace expires │       reactivate()
          (auto)    ▼        ───────────►┐
               ┌──────────┐             │
               │ SUSPENDED │◄──suspend()─┤
               └─────┬─────┘            │
                     │                  │
               cancel│        archive() │
                     ▼                  │
               ┌───────────┐            │
               │ CANCELLED │────────────┘
               └─────┬─────┘
                     │
               archive│
                     ▼
               ┌──────────┐
               │ ARCHIVED │ (terminal — data preserved forever)
               └──────────┘
```

---

## State Reference

| State | Description | Write | Read | Marketplace |
|-------|-------------|-------|------|-------------|
| PENDING | Created but not yet activated | ✓ | ✓ | plan |
| TRIAL | Free trial active | ✓ | ✓ | plan |
| ACTIVE | Paid subscription | ✓ | ✓ | plan |
| GRACE_PERIOD | Overdue — limited access | ✗ | ✓ | ✗ |
| SUSPENDED | Access blocked | ✗ | ✗ | ✗ |
| CANCELLED | Subscription ended | ✗ | ✗ | ✗ |
| ARCHIVED | Permanent archive — data retained | ✗ | SA only | ✗ |

---

## Provisioning Flow

```
CreateTenantInput
    │
    ▼
ProvisioningService.provision()
    │
    ├─ upsert TenantProfile (idempotent)
    ├─ set state = TRIAL (if plan has trialDays > 0)
    ├─ set defaults: language, currency, country, timezone
    ├─ publish TenantCreated event
    └─ publish TenantTrialStarted event
```

**Idempotent:** calling `provision()` twice on the same `tenantId` returns the existing profile without modification.

**Auto-provision from event:** `initTenantEngine()` subscribes to `CafeCreated` and auto-provisions a profile, so no explicit provisioning call is needed from the Restaurant module.

---

## Plan Definitions

| Plan | Users | Tables | QRs | Storage | AI/month | Marketplace | Automation | Trial |
|------|-------|--------|-----|---------|----------|-------------|------------|-------|
| FREE | 2 | 10 | 5 | 1 GB | 100 | ✗ | ✗ | 14d |
| STARTER | 5 | 30 | 20 | 5 GB | 500 | ✓ | ✗ | 14d |
| PROFESSIONAL | 15 | 100 | 50 | 20 GB | 2000 | ✓ | ✓ | 14d |
| ENTERPRISE | 999 | 999 | 999 | 200 GB | 20000 | ✓ | ✓ | 30d |
| CUSTOM | SA-defined | — | — | — | — | SA-set | SA-set | 0 |

---

## Feature Resolution

Final feature availability is computed in this priority order (highest wins):

```
1. Temporary Promotions  (time-limited, set by SA)
       ▼ (if no promo for this feature)
2. Tenant Feature Overrides  (permanent SA overrides per tenant)
       ▼ (if no override)
3. Plan Definition  (plan's built-in features)
       ▼ (applied on top)
4. Global Feature Flags  (FeatureFlagService — e.g. global marketplace kill switch)
```

**API:** `GET /api/restaurant/tenant/features` returns the full resolved set.

**Action gate:** `canPerformAction(tenantId, 'write' | 'read' | 'marketplace' | 'automation')` is state-aware and returns `{ allowed, reason }`.

---

## Usage Tracking

Usage is tracked in `TenantUsageSnapshot` per `tenantId + YYYY-MM` period.

| Metric | Tracked via | Reset |
|--------|-------------|-------|
| `aiRequests` | `increment()` | Monthly |
| `reservations` | `increment()` | Monthly |
| `marketplaceOrders` | `increment()` | Monthly |
| `automations` | `increment()` | Monthly |
| `userCount` | `syncCounts()` | Live (replaced) |
| `tableCount` | `syncCounts()` | Live (replaced) |
| `qrCount` | `syncCounts()` | Live (replaced) |
| `storageBytes` | `syncCounts()` | Live (replaced) |

**Usage summary** includes `percentages` (0–100%) for each metric vs. plan limits.

---

## Suspension Engine

Five suspension types — all preserve data, never delete:

| Type | Triggered by | Behavior |
|------|-------------|---------|
| MANUAL | SA UI | Read access removed |
| AUTOMATIC | System (grace expiry) | Read access removed |
| BILLING | Billing engine (future) | Read access removed |
| SECURITY | SA security team | Read access removed |
| MAINTENANCE | SA maintenance mode | Temporary, shows maintenance message |

Every suspend/reactivate writes to `TenantSuspensionLog` for full audit trail.

**Grace Period before suspension:** pass `gracePeriodDays` to `suspend()` to enter `GRACE_PERIOD` first (read-only access for N days) before full suspension.

---

## Grace Period

```
enterGracePeriod(tenantId, durationDays = 7)
    │
    ├─ state → GRACE_PERIOD
    ├─ gracePeriodEndsAt = now + durationDays
    ├─ publish TenantGracePeriodStarted
    └─ notify tenant: "فترة السماح"

Nightly cron checks:
    if gracePeriodEndsAt < now AND state = GRACE_PERIOD:
        suspend(type: AUTOMATIC, reason: 'Grace period expired')
```

**During grace period:**
- Read: ✓ allowed
- Write: ✗ blocked
- Marketplace: ✗ blocked
- Automation: ✗ blocked

---

## Events

| Event | Payload | When |
|-------|---------|------|
| `TenantCreated` | tenantId, tenantType, plan, state | provision() |
| `TenantTrialStarted` | tenantId, plan, trialEndsAt | startTrial() |
| `TenantActivated` | tenantId, activatedBy | activate() |
| `TenantPlanChanged` | tenantId, oldPlan, newPlan, changedBy | assignPlan() |
| `TenantGracePeriodStarted` | tenantId, gracePeriodEndsAt, durationDays | enterGracePeriod() |
| `TenantSuspended` | tenantId, type, reason, state | suspend() |
| `TenantReactivated` | tenantId, reactivatedBy | reactivate() |
| `TenantArchived` | tenantId, archivedBy | archive() |

---

## Notifications

| Trigger | Level | Arabic Message |
|---------|-------|---------------|
| provision() (trial) | INFO | "تجربة N يوماً مجاناً" |
| activate() | SUCCESS | "حسابك نشط الآن" |
| assignPlan() upgrade | SUCCESS | "تمت ترقية خطتك" |
| assignPlan() downgrade | INFO | "تغيير خطة الاشتراك" |
| enterGracePeriod() | WARNING | "فترة السماح" |
| trial expiring (nightly, 3d before) | WARNING | "تجربتك تنتهي خلال N أيام" |
| trial expired → grace | WARNING | "انتهت تجربتك المجانية" |
| grace period expired → suspend | ERROR | "تم إيقاف حسابك" |
| suspend() | ERROR | Type-specific message |
| reactivate() | SUCCESS | "تم تفعيل حسابك" |

---

## API Reference

### SuperAdmin (`x-superadmin-secret` required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/superadmin/tenants/plans` | List all plan definitions |
| GET | `/api/superadmin/tenants` | List tenant profiles (filter: state, plan, tenantType) |
| GET | `/api/superadmin/tenants/:id` | Single tenant profile |
| POST | `/api/superadmin/tenants` | Provision new tenant |
| POST | `/api/superadmin/tenants/:id/activate` | Activate |
| POST | `/api/superadmin/tenants/:id/trial` | Start trial |
| POST | `/api/superadmin/tenants/:id/plan` | Assign plan |
| POST | `/api/superadmin/tenants/:id/suspend` | Suspend (body: type, reason, gracePeriodDays?) |
| POST | `/api/superadmin/tenants/:id/reactivate` | Reactivate |
| POST | `/api/superadmin/tenants/:id/grace-period` | Enter grace period |
| POST | `/api/superadmin/tenants/:id/cancel` | Cancel |
| POST | `/api/superadmin/tenants/:id/archive` | Archive |
| PATCH | `/api/superadmin/tenants/:id/features/:feature` | Set feature override |
| POST | `/api/superadmin/tenants/:id/promotions` | Add temporary promotion |
| GET | `/api/superadmin/tenants/:id/suspension-logs` | Suspension audit log |
| GET | `/api/superadmin/tenants/:id/usage` | Usage summary + 6-month history |
| GET | `/api/superadmin/tenants/:id/features` | Resolved features |

### Restaurant (`Authorization: Bearer <JWT>` required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/restaurant/tenant/subscription` | My current plan + state |
| GET | `/api/restaurant/tenant/usage` | My usage this month |
| GET | `/api/restaurant/tenant/usage/history` | 6-month usage history |
| GET | `/api/restaurant/tenant/features` | My resolved features |
| GET | `/api/restaurant/tenant/limits` | My current limits |
| GET | `/api/restaurant/tenant/can/:action` | Can I do read/write/marketplace/automation? |

---

## Nightly Cron Integration

The `startNightlyCron()` runs daily at 23:00 and includes:

```
1. notifyExpiringTrials(3)    — warn tenants whose trial ends in ≤3 days
2. expireTrials(7)            — trials past end → GRACE_PERIOD (7 day grace)
3. expireGracePeriods()       — grace past end → SUSPENDED (AUTOMATIC)
4. cleanupExpiredPromotions() — remove expired temp promotions from profiles
```

---

## File Structure

```
src/tenant/
├── types/
│   └── index.ts              TenantState, Plan, PlanDefinition, PlanLimits, etc.
├── plans/
│   └── index.ts              PLAN_DEFINITIONS, getPlan(), listPlans()
├── provisioning/
│   └── ProvisioningService.ts provision(), getProfile(), ensureProfile(), listProfiles()
├── lifecycle/
│   └── LifecycleService.ts   activate(), startTrial(), assignPlan(), enterGracePeriod(),
│                             cancel(), archive(), setFeatureOverride(), addPromotion()
├── suspension/
│   └── SuspensionService.ts  suspend(), reactivate(), getSuspensionLogs()
├── usage/
│   └── UsageService.ts       increment(), syncCounts(), getUsageSummary(), checkLimit()
├── activation/
│   └── ActivationService.ts  notifyExpiringTrials(), expireTrials(), expireGracePeriods(),
│                             cleanupExpiredPromotions()
├── services/
│   └── FeatureResolutionService.ts resolveFeatures(), isFeatureAvailable(),
│                                   isModuleAccessible(), canPerformAction()
└── index.ts                  Public API + initTenantEngine()
```

---

## Future: Multi-Region Support

The engine is region-agnostic by design. Future additions:

```typescript
// Add to TenantProfile:
region:   String @default("MA")  // MA, FR, AE, US, ...
dataZone: String @default("eu-west-1")

// Add to CreateTenantInput:
region?: string
dataZone?: string
```

Data residency rules are enforced at the provisioning level. No other engine code changes.

---

## Future: Billing Integration

When a Billing Engine is built, it integrates via events:

```
BillingOverdue event
    └→ TenantLifecycleEngine.suspend(tenantId, { type: 'BILLING', ... })

BillingPaid event
    └→ TenantLifecycleEngine.reactivate(tenantId)
```

The Tenant Engine never calls Billing — Billing calls the Tenant Engine.

---

## How Other SaaS Modules Use This

```typescript
// Hotel module — provision a hotel tenant
import { provision } from '../../tenant'

await provision({
  tenantId:   hotel.id,
  tenantType: 'HOTEL',
  plan:       'PROFESSIONAL',
  startTrial: true,
})

// Check if hotel can use automation
import { canPerformAction } from '../../tenant'
const { allowed, reason } = await canPerformAction(hotel.id, 'automation')

// Track AI usage
import { increment } from '../../tenant'
await increment(hotel.id, 'aiRequests')
```
