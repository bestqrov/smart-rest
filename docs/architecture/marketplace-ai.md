# Marketplace AI — Architecture Reference

The AI layer transforms the Marketplace from a static catalog into an intelligent purchasing assistant. Everything is deterministic, explainable, and reuses existing SmartSuite infrastructure.

---

## Core Principle

**No ML training. No hallucinations. No black boxes.**

All recommendations are produced by deterministic scoring rules applied to real data in the database. Every recommendation carries an explicit `reason` string that explains WHY it was made. Confidence scores are computed from known signals, not from a trained model.

---

## Recommendation Engine

**File:** `src/marketplace/ai/RecommendationService.ts`

### Flow

```
Restaurant Context
       ↓
generateRecommendations(ctx, limit)
       ↓
For each published product:
  scoreProduct(product, ctx) → AIScore
  if confidence ≥ 20: include in results
       ↓
Sort by (priority DESC, confidence DESC)
       ↓
Return top N recommendations
       ↓
Log each recommendation → RecommendationLog
Publish RecommendationGenerated event
```

### Scoring Signals

| Signal | Score Added | Priority Boost |
|--------|------------|----------------|
| Product tags match restaurant type affinity | +15 per tag match | — |
| Product compatible with installed modules | +20 | — |
| Already purchased by this tenant | −40 | — |
| Product tagged `ai` + tenant uses AI | +25 | priority=7 |
| Product tagged `marketing` + tenant marketing active | +20 | — |
| Seasonal tag match (month) | +10 | — |

Confidence is clamped to [0, 100]. Products below 20 confidence are excluded.

### Restaurant Type Affinity Map

```typescript
RESTAURANT → ['pos', 'qr', 'kitchen', 'waiter', 'reservations']
FAST_FOOD  → ['pos', 'kiosk', 'kitchen', 'display']
CAFE       → ['pos', 'loyalty', 'mobile', 'wifi']
HOTEL      → ['reservations', 'pos', 'reporting']
DEFAULT    → ['pos', 'analytics', 'reporting']
```

### Recommendation Types

| Type | When Applied |
|------|-------------|
| `RECOMMENDED_FOR_YOU` | Default — restaurant type + module match |
| `FREQUENTLY_BOUGHT_TOGETHER` | Product was previously ordered by this tenant |
| `UPGRADE_SUGGESTION` | Product tagged `upgrade` |
| `REPLACEMENT_SUGGESTION` | Previously purchased, now low stock |
| `TRENDING` | Most ordered in last 30 days (getTrending) |
| `AI_PICKS` | Product tagged `ai` |

### Trending Calculation

Counts `MarketplaceOrderItem.quantity` per `productId` over the last 30 days. Sorted descending. Confidence = `min(95, 50 + qty × 5)`. Priority = 8.

---

## Compatibility Engine

**File:** `src/marketplace/ai/CompatibilityEngine.ts`

Products declare compatibility via two fields:
- `supportedModules[]` — which SmartSuite modules this product works with
- `metadata` (JSON string) — optional `requiredModules[]` and `optionalModules[]`

### Algorithm

```
1. Parse product.metadata for requiredModules + optionalModules
2. If ANY requiredModule missing → INCOMPATIBLE (score=0)
3. If supportedModules includes 'ALL' or is empty → COMPATIBLE (score=100)
4. If NO supported module matches restaurant modules → INCOMPATIBLE (score=10)
5. If some optional modules missing → PARTIAL (score=70–100)
6. Otherwise → COMPATIBLE (score=100)
```

Each result includes `reasons[]` (Arabic) explaining the decision.

---

## Bundle Engine

**File:** `src/marketplace/ai/BundleEngine.ts`

Bundles are persisted in the `marketplace_bundles` MongoDB collection.

### Default Bundle Seeds (seeded on init)

| Name | Type | Price |
|------|------|-------|
| Starter Pack | STARTER | 1,499 MAD |
| Restaurant Pro Pack | PRO | 3,299 MAD |
| POS Pack | POS | 2,199 MAD |
| Kitchen Pack | KITCHEN | 1,799 MAD |
| Premium AI Pack | PREMIUM_AI | 2,499 MAD |

**Savings calculation:** `savings = Σ(individual basePrices) − bundlePrice`. Recomputed whenever bundlePrice or productIds change.

**Events:** `BundleViewed` is published when a restaurant views a bundle.

---

## Smart Alerts

**File:** `src/marketplace/ai/SmartAlerts.ts`

Rule-based alerts generated from restaurant context. No ML. All rules are explicit.

### Alert Rules

| Rule | Severity | Condition |
|------|----------|-----------|
| QR stands | WARNING | `cafe.seats > 0` and `qrOwned < seats` |
| Certification upgrade | SUCCESS | Current level is BRONZE/SILVER/GOLD → next level tip |
| Low stock re-order | WARNING | Previously purchased product now `stock ≤ 3` |
| AI products upsell | INFO | Tenant uses AI modules but hasn't ordered AI products |

---

## Data Models

### `marketplace_bundles`

| Field | Type | Notes |
|-------|------|-------|
| name | String | Display name |
| slug | String @unique | URL-safe identifier |
| type | String | STARTER / PRO / POS / KITCHEN / PREMIUM_AI |
| bundlePrice | Float | Total bundle price |
| savings | Float | Computed: sum(individual) − bundlePrice |
| productIds | String[] | Array of productIds in this bundle |
| active | Boolean | Controls visibility |

### `marketplace_recommendation_logs`

| Field | Type | Notes |
|-------|------|-------|
| tenantId | String | cafeId of the restaurant |
| productId | String | Recommended product |
| type | String | RecommendationType |
| confidence | Float | 0–100 |
| reason | String | Human-readable explanation |
| priority | Int | 1–10 |
| status | String | VIEWED / ACCEPTED / DISMISSED |
| estimatedRoi | Float? | MAD, optional |
| estimatedPayback | Float? | Months, optional |

---

## Events

| Event | Payload | When |
|-------|---------|------|
| `RecommendationGenerated` | `{ tenantId, productId, type }` | When recommendations are logged |
| `BundleViewed` | `{ bundleId, tenantId }` | When restaurant views a bundle |
| `RecommendationAccepted` | `{ logId, productId }` | Restaurant clicks Add to Order from recommendation |
| `RecommendationDismissed` | `{ logId, productId }` | Restaurant dismisses a recommendation |

---

## Analytics

**Endpoint:** `GET /api/superadmin/marketplace/ai/analytics?tenantId=`

Returns:
```json
{
  "analytics": {
    "total": 150,
    "accepted": 42,
    "dismissed": 18,
    "conversionRate": 28,
    "byType": [...]
  }
}
```

Conversion rate = `accepted / total × 100`.

---

## Restaurant API Routes

All catalog and AI endpoints: `src/routes/marketplaceCatalogRestaurant.ts`

Auth: `Authorization: Bearer <JWT>` — JWT payload must contain `cafeId`.

---

## SuperAdmin API Routes

Bundle CRUD: `src/routes/marketplaceBundlesSA.ts`  
AI analytics: `src/routes/marketplaceAISA.ts`

Auth: `x-superadmin-secret` header.

---

## Future: Predictive Purchasing

The foundation is in place for predictive purchasing:

1. **Pattern recognition** — `RecommendationLog` stores every recommendation + outcome. Once enough data accumulates, a predictive model can train on `(tenantId, productId, type, confidence, status)` to improve confidence scoring.

2. **Seasonal forecasting** — Order history + month signal already tracked. Future: auto-adjust affinity scores by season.

3. **Cross-tenant trending** — `getTrending()` already aggregates across all tenants. Future: per-module trending, per-region trending.

4. **Reorder alerts** — Low stock + previous purchase alert already implemented. Future: auto-suggest reorder quantity based on consumption rate.

5. **Marketing Brain integration** — Future: use the Marketing Brain LLM to generate personalized recommendation copy in Arabic/French based on restaurant profile.

All future extensions follow the same principle: **deterministic rules first, AI augmentation second**.
