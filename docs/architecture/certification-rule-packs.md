# SmartSuite Certification — Rule Packs

Rule Packs make the certification engine fully modular.
Adding a new SmartSuite application mostly means assembling existing packs — not writing new certification logic.

---

## Architecture

```
CertificationEngine.evaluate(tenantId, profileId)
          │
          ▼
   ProfileRegistry          ← profile = assembled packs + dataFetcher
          │
          ▼
    PackRegistry            ← resolves dependencies, merges evaluators
          │
          ▼
  RuleRegistry              ← bound rules (pack rules + profileId)
          │
          ▼
  ScoringEngine / EvidenceStore
```

**Key invariant:** The engine (`CertificationEngine.ts`) is never touched when adding new packs or profiles. It calls `getRulesForProfile()` and `profile.ruleEvaluators` — both are set up during registration.

---

## Pack Lifecycle

```
registerPack(pack)
  → validates uniqueness
  → stores in PackRegistry (in-memory)
  → publishes RulePackRegistered event
  → writes AuditEntry

createProfile(config: ProfileConfig)
  → resolveDependencies(config.packs)   // topological sort, deduplicates
  → merges evaluators from all packs    // later packs override earlier ones
  → applies config.evaluatorOverrides   // profile-level final authority
  → returns ProfileDefinition

registerProfile(definition)
  → for each resolved pack:
      bindRules(pack.rules, profileId)  → registerRules()
      recordPackUsage(packId, profileId)
  → stores profile in ProfileRegistry
  → publishes ProfileUpdated event
  → writes AuditEntry
```

---

## RulePack interface

```typescript
interface RulePack {
  id:           string          // 'operations-pack', 'billing-pack', ...
  name:         string
  description:  string
  version:      string
  enabled:      boolean
  rules:        PackRule[]       // Omit<RuleDefinition, 'profile'> — profile set at bind time
  evaluators:   RuleEvaluatorMap // ruleId → (rule, data, ctx) => EvidenceInput
  dependencies: string[]         // other pack IDs required by this pack
  tags:         string[]
}
```

Evaluators receive `data: Record<string, unknown>` populated by the **profile's** `dataFetcher`.
Packs **never import Prisma** — they are DB-agnostic by design.

---

## Dependency Resolution

Dependencies are resolved with a depth-first topological sort at `createProfile()` time.

```
marketing-pack
  dependencies: ['customer-pack']

Profile packs: ['operations-pack', 'marketing-pack']

resolveDependencies(['operations-pack', 'marketing-pack'])
  → visit('operations-pack') → no deps → push
  → visit('marketing-pack')
      → visit('customer-pack') → no deps → push
      → push marketing-pack
  → result: ['operations-pack', 'customer-pack', 'marketing-pack']
```

Rules are registered in this order. Evaluators are merged in this order (later wins on conflict).
Circular dependencies throw immediately with a clear message.

---

## Built-in Packs (v1.0)

| Pack | Rules | Weight | Category | Dependencies |
|------|-------|--------|----------|--------------|
| **operations-pack** | MENU_ITEMS_COUNT, MENU_CATEGORIES, TABLES_CONFIGURED, STAFF_REGISTERED, ORDERS_LAST_30_DAYS, WEEKLY_ORDER_VOLUME | 70 | CONTENT / SETUP / ACTIVITY | — |
| **billing-pack** | BILLING_ACTIVE | 20 | COMPLIANCE | — |
| **customer-pack** | LOYALTY_CUSTOMERS | 5 | ENGAGEMENT | — |
| **marketing-pack** | MARKETING_CONFIGURED | 8 | MARKETING | customer-pack |
| **automation-pack** | QR_ORDERS_ENABLED | 10 | FEATURES | — |
| **reservation-pack** | RESERVATIONS_ACTIVE | 8 | FEATURES | — |
| **inventory-pack** | INVENTORY_ACTIVE | 5 | FEATURES | — |
| **ai-pack** | *(placeholder)* | 0 | AI | — |
| **security-pack** | *(placeholder)* | 0 | SECURITY | — |
| **compliance-pack** | *(placeholder)* | 0 | COMPLIANCE | — |

Total active rules: **12** · Max score: **126 points**

---

## Restaurant Profile

Assembly:

```typescript
createProfile({
  id:      'restaurant',
  version: '2.0',
  packs: [
    'operations-pack',   // 6 rules: menu, tables, staff, orders
    'billing-pack',      // 1 rule:  billing status
    'marketing-pack',    // pulls in customer-pack via dependency
    'automation-pack',   // 1 rule:  QR orders
    'reservation-pack',  // 1 rule:  reservations
    'inventory-pack',    // 1 rule:  inventory
    'ai-pack',           // placeholder — 0 rules now
  ],
  dataFetcher: restaurantDataFetcher,  // Prisma queries live here
})
```

Resolved pack order (after dependency expansion):

```
operations-pack → billing-pack → customer-pack → marketing-pack
→ automation-pack → reservation-pack → inventory-pack → ai-pack
```

---

## Hotel Profile (example — not yet built)

```typescript
createProfile({
  id:      'hotel',
  version: '1.0',
  packs: [
    'operations-pack',   // tables → rooms (dataFetcher maps room count to data.tableCount)
    'billing-pack',
    'reservation-pack',  // reservations → hotel bookings
    'ai-pack',
  ],
  dataFetcher: hotelDataFetcher,  // maps hotel DB schema to same data keys
})
```

The `operations-pack.TABLES_CONFIGURED` rule checks `data.tableCount`.
The hotel `dataFetcher` maps room count → `data.tableCount`.
**Zero pack changes required** — only a new dataFetcher.

---

## Clinic Profile (example — not yet built)

```typescript
createProfile({
  id:      'clinic',
  version: '1.0',
  packs: [
    'operations-pack',   // staff (doctors/nurses) + content (services)
    'billing-pack',
    'security-pack',     // access control, audit completeness
    'compliance-pack',   // GDPR, data retention
    'ai-pack',
  ],
  dataFetcher: clinicDataFetcher,
})
```

---

## Creating a New Pack

```typescript
// src/certification/packs/builtin/appointments-pack.ts
import { scoreNumber } from '../../scoring/ScoringEngine'
import type { RulePack, EvidenceInput } from '../../types'

export const APPOINTMENTS_PACK: RulePack = {
  id:           'appointments-pack',
  name:         'Appointments Pack',
  description:  'Appointment booking volume and availability rules.',
  version:      '1.0',
  enabled:      true,
  dependencies: [],
  tags:         ['appointments', 'bookings', 'healthcare'],

  rules: [
    {
      id:             'APPOINTMENTS_LAST_30_DAYS',
      category:       'ACTIVITY',
      title:          'Recent Appointments',
      description:    'At least 5 appointments must have been booked in the last 30 days.',
      weight:         15,
      required:       false,
      enabled:        true,
      evaluationType: 'NUMBER',
      expectedValue:  5,
    },
  ],

  evaluators: {
    APPOINTMENTS_LAST_30_DAYS: async (rule, data): Promise<EvidenceInput> =>
      scoreNumber(data.appointmentCount30d as number, rule.expectedValue as number, true),
  },
}
```

Then add it to `builtin/index.ts` (after any dependencies) and to the target profile's `packs` array.

---

## Evaluator Override

A profile can override a specific rule's evaluator without modifying the pack:

```typescript
createProfile({
  id:    'restaurant-enterprise',
  packs: ['operations-pack', 'billing-pack', ...],
  evaluatorOverrides: {
    // Enterprise tier: require 50 menu items instead of 5
    MENU_ITEMS_COUNT: async (rule, data) =>
      scoreNumber(data.menuItemCount as number, 50, true),
  },
  dataFetcher: restaurantDataFetcher,
})
```

---

## Statistics API

```typescript
import { getPackUsage, getUnusedPacks, getRuleCoverage } from 'src/certification'

// Which packs are used by which profiles?
getPackUsage()
// → [{ packId: 'operations-pack', profiles: ['restaurant'], ruleCount: 6 }, ...]

// Which packs are registered but unused?
getUnusedPacks()
// → [{ id: 'security-pack', ... }, { id: 'compliance-pack', ... }]

// Rule distribution across packs and categories
getRuleCoverage()
// → { totalRules: 12, totalPacks: 10, byPack: { 'operations-pack': 6, ... }, byCategory: { CONTENT: 2, ... } }
```

---

## Events

| Event | When | Payload |
|-------|------|---------|
| `RulePackRegistered` | Pack registered | `{ packId, ruleCount, version }` |
| `RulePackUpdated` | Pack patched | `{ packId }` |
| `RulePackRemoved` | Pack deleted | `{ packId }` |
| `ProfileUpdated` | Profile registered | `{ profileId, version, packs }` |

---

## Best Practices

**Do:**
- Keep packs focused on one concern (billing, marketing, operations...)
- Re-use existing packs in new profiles before writing new rules
- Define data key conventions in the profile's `dataFetcher` — never in packs
- Add dependencies only when a pack's rules are meaningless without another pack

**Don't:**
- Import Prisma inside a pack evaluator
- Duplicate rules across packs — if two packs need the same rule, extract a shared pack
- Register packs inside `registerProfile` — packs must be registered first via `registerBuiltinPacks()`
- Modify pack rules after server startup (in-memory registry is not hot-reload safe)

---

## Startup Order

```
server.ts
  │
  ├─ FeatureFlagService.seedDefaultFlags()   // async, fire-and-forget
  │
  └─ registerBuiltinProfiles()               // sync, runs immediately
       │
       ├─ registerBuiltinPacks()             // registers all 10 packs
       │     operations, billing, customer, marketing, automation,
       │     reservation, inventory, ai, security, compliance
       │
       └─ registerRestaurantProfile()
             createProfile({ packs: [...] })
               → resolveDependencies()
               → merge evaluators
             registerProfile(definition)
               → bind rules → RuleRegistry
               → track usage → PackRegistry
```
