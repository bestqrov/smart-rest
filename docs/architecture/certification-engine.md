# SmartSuite Certification Engine

`src/certification/` provides a generic, profile-based certification engine reusable by every SmartSuite application.

---

## Architecture

```
src/certification/
├── types/            — all shared TypeScript types
├── profiles/
│   ├── ProfileRegistry.ts     — in-memory profile registry
│   ├── restaurant/            — Restaurant certification profile
│   │   ├── RestaurantRules.ts       — 12 rule definitions
│   │   ├── RestaurantEvaluators.ts  — evaluators + data fetcher
│   │   └── index.ts                 — registers profile + rules
│   └── index.ts               — registerBuiltinProfiles()
├── rules/            — RuleRegistry (in-memory)
├── evidence/         — EvidenceStore (Prisma: cert_evidence)
├── scoring/          — ScoringEngine (deterministic)
├── engine/           — CertificationEngine (orchestrator)
├── services/         — CertificationService (Prisma: cert_results)
└── index.ts          — public API
```

---

## Evaluation Flow

```
evaluate(tenantId, profileId)
  │
  ├─ 1. FeatureFlagService.isEnabled('certification')
  ├─ 2. getProfile(profileId)         → ProfileDefinition
  ├─ 3. getRulesForProfile(profileId) → RuleDefinition[]
  ├─ 4. profile.dataFetcher(tenantId) → data: Record<string, unknown>
  │
  ├─ 5. For each rule:
  │       evaluator(rule, data, ctx)  → EvidenceInput { passed, score, rawValue }
  │
  ├─ 6. calculateScore(rules, evidences)
  │       → ScoringResult { totalScore, maxScore, percentage, ... }
  │
  ├─ 7. determineLevel(percentage, profile.certificateLevels)
  │       → CertificationLevel
  │
  ├─ 8. generateRecommendations(rules, evidences)
  │       → Recommendation[] (sorted by priority)
  │
  ├─ 9. persistEvidence() × N        → CertificationEvidence[]
  ├─ 10. prisma.certificationResult.create()
  ├─ 11. AuditService.createAudit()
  └─ 12. eventBus.publish('CertificationCompleted')
```

---

## Profiles

A profile defines everything the engine needs to evaluate a business domain.

```typescript
interface ProfileDefinition {
  id:                string
  name:              string
  description:       string
  version:           string
  enabled:           boolean
  validityDays:      number           // certificate validity
  certificateLevels: LevelThreshold[] // BRONZE → DIAMOND thresholds
  dataFetcher:       DataFetcher      // how to pull tenant data
  ruleEvaluators:    RuleEvaluatorMap // ruleId → evaluator function
}
```

**Registering a new profile:**

```typescript
// src/certification/profiles/hotel/index.ts
import { registerProfile } from '../ProfileRegistry'
import { registerRules }   from '../../rules/RuleRegistry'

export function registerHotelProfile() {
  registerRules(HOTEL_RULES)
  registerProfile({
    id:           'hotel',
    name:         'SmartHotel Certification',
    version:      '1.0',
    validityDays: 90,
    certificateLevels: [...],
    dataFetcher:    hotelDataFetcher,
    ruleEvaluators: hotelEvaluators,
  })
}
```

Then add `registerHotelProfile()` to `src/certification/profiles/index.ts`.

---

## Rules

Rules are pure data. The engine does not interpret them — evaluators do.

```typescript
interface RuleDefinition {
  id:             string
  profile:        string          // must match a registered profile
  category:       string          // e.g. 'SETUP', 'CONTENT', 'ACTIVITY'
  title:          string
  description:    string
  weight:         number          // contribution to total score
  required:       boolean         // used by recommendation priority
  enabled:        boolean
  evaluationType: 'BOOLEAN' | 'NUMBER' | 'PERCENTAGE' | 'CUSTOM'
  expectedValue?: unknown
}
```

**Restaurant profile rules (12 rules, max 126 points):**

| Rule ID | Category | Weight | Required |
|---------|----------|--------|----------|
| MENU_ITEMS_COUNT | CONTENT | 12 | ✅ |
| MENU_CATEGORIES | CONTENT | 8 | ✅ |
| TABLES_CONFIGURED | SETUP | 10 | ✅ |
| STAFF_REGISTERED | SETUP | 10 | ✅ |
| BILLING_ACTIVE | COMPLIANCE | 20 | ✅ |
| ORDERS_LAST_30_DAYS | ACTIVITY | 20 | ❌ |
| WEEKLY_ORDER_VOLUME | ACTIVITY | 10 | ❌ |
| QR_ORDERS_ENABLED | FEATURES | 10 | ❌ |
| RESERVATIONS_ACTIVE | FEATURES | 8 | ❌ |
| MARKETING_CONFIGURED | MARKETING | 8 | ❌ |
| LOYALTY_CUSTOMERS | ENGAGEMENT | 5 | ❌ |
| INVENTORY_ACTIVE | FEATURES | 5 | ❌ |

---

## Evidence

Evidence is immutable. Each rule evaluation produces exactly one evidence record.

```typescript
interface EvidenceInput {
  passed:         boolean
  score:          number    // 0–1 ratio (applied to rule.weight)
  rawValue:       unknown   // what was actually measured
  expectedValue?: unknown   // what was expected
  metadata?:      Record<string, unknown>
}
```

Helpers from `ScoringEngine`:
```typescript
scoreBoolean(value, expected?)   // 0 or 1
scoreNumber(value, expected, softScale?)   // partial credit if softScale=true
scorePercentage(value)           // value/100
```

---

## Scoring

**Deterministic — same input always produces same output.**

```
earnedScore(rule) = clamp(evidence.score, 0, 1) × rule.weight
totalScore        = Σ earnedScore
maxScore          = Σ rule.weight (enabled rules)
percentage        = totalScore / maxScore × 100
```

---

## Certificate Levels

Levels are defined per profile. Restaurant defaults:

| Level | Min % | Description |
|-------|-------|-------------|
| NONE | 0% | Did not qualify |
| BRONZE | 30% | Basic setup complete |
| SILVER | 50% | Operational restaurant |
| GOLD | 70% | Active and well-configured |
| PLATINUM | 85% | High-performance operation |
| DIAMOND | 95% | Exceptional SmartRestaurant |

---

## Recommendations

Generated automatically from failed rules:

- **Required rule failed** → `HIGH` priority
- **Weight ≥ 15** → `HIGH` priority
- **Weight ≥ 8** → `MEDIUM` priority
- **Weight < 8** → `LOW` priority

Each recommendation includes a structured `action` string.

---

## Usage

```typescript
import { evaluate, CertificationService } from 'src/certification'

// Run evaluation
const result = await evaluate(cafeId, 'restaurant')
// result.level      → 'GOLD'
// result.percentage → 74.2
// result.recommendations → [...]

// Dry run (no DB writes)
const preview = await evaluate(cafeId, 'restaurant', { dryRun: true })

// Retrieve latest
const latest = await CertificationService.getLatestResult(cafeId, 'restaurant')

// Stats
const stats = await CertificationService.getStats('restaurant')
// { total: 42, completed: 38, expired: 4, byLevel: { GOLD: 15, SILVER: 12, ... } }
```

---

## Events

The engine publishes to the Core EventBus:

| Event | When |
|-------|------|
| `CertificationStarted` | Before evaluation begins |
| `CertificationCompleted` | After result persisted |

Future (to add when needed): `CertificationFailed`, `CertificationExpired`

---

## Feature Flag

Certification respects `FeatureFlagService.isEnabled('certification')`.

If the flag is `disabled`, `evaluate()` throws immediately without querying the DB.

To enable for all tenants:
```typescript
await FeatureFlagService.setFlag('certification', { status: 'enabled' })
```

To enable for specific tenants only:
```typescript
await FeatureFlagService.setFlag('certification', { scope: 'tenant', targetIds: [cafeId] })
```

---

## Audit Trail

Every completed evaluation writes to `AuditService`:

```
module:      'certification'
entity:      'CertificationResult'
action:      'CERTIFICATION_COMPLETED'
performedBy: 'system'
metadata:    { tenantId, profileId, level, percentage, traceId }
```

---

## Future Extensions

### PDF Certificate Generation
```typescript
// Phase H2 — not yet built
import { generateCertificatePdf } from 'src/certification/pdf'
const buffer = await generateCertificatePdf(resultId)
```

### Public Verification Page
```
/verify/:certificationCode
```
Will render the level, tenant name, validity date, and QR code.

### AI Evaluation
Future rules with `evaluationType: 'CUSTOM'` can call AI providers:
```typescript
// Example: AI evaluates photo quality of menu images
const ev = await aiEvaluator(rule, { imageUrls: data.menuImageUrls })
```

### New Profiles
Any future SmartSuite product adds one folder:
```
src/certification/profiles/hotel/
  HotelRules.ts
  HotelEvaluators.ts
  index.ts
```

No changes to the engine itself.
