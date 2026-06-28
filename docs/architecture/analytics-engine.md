# SmartSuite Analytics Engine

## Overview

The Analytics Engine is the single source of truth for all KPIs across the SmartSuite platform.

It provides a reusable, module-agnostic framework for collecting, aggregating, storing, and serving metrics. Future dashboards (Restaurant Admin, SuperAdmin, Hotel, Clinic, Marketplace) consume this engine exclusively — no business logic is duplicated inside dashboards.

---

## Folder Structure

```
src/analytics/
├── types/
│   └── index.ts              — All Analytics types (MetricDefinition, Collector, Period, etc.)
├── metrics/
│   ├── MetricRegistry.ts     — In-memory registry for all platform metrics
│   └── builtin/
│       └── index.ts          — 30+ built-in metric definitions
├── collectors/
│   ├── CollectorRegistry.ts  — In-memory registry for module collectors
│   └── builtin/
│       ├── restaurant.ts     — Cafe/order data
│       ├── billing.ts        — MRR, ARR, subscription counts
│       ├── marketing.ts      — Campaign completion stats
│       ├── ai.ts             — AI job counts, tokens, cost
│       ├── certification.ts  — Scores, level distribution
│       ├── automation.ts     — (placeholder, module not yet built)
│       └── index.ts          — registerBuiltinCollectors()
├── aggregators/
│   ├── periods.ts            — Period resolution (today/7d/30d/month/year/custom)
│   └── AggregationEngine.ts  — SUM, AVG, COUNT, MIN, MAX, PERCENTAGE, TREND, LATEST
├── storage/
│   └── SnapshotStore.ts      — Prisma persistence (MetricSnapshot model)
├── reports/
│   ├── ReportRegistry.ts     — In-memory registry for report definitions
│   └── builtin/
│       └── index.ts          — 6 built-in reports
├── services/
│   └── AnalyticsService.ts   — Main service: collect, aggregate, report
├── events/
│   └── EventSubscriber.ts    — EventBus subscriptions for reactive updates
└── index.ts                  — Public API + initAnalyticsEngine()
```

---

## Architecture

### Metric Lifecycle

```
MetricDefinition (registry)
        │
        │ describes
        ▼
CollectorDefinition (registry)
        │
        │ collect(period, tenantId?)
        ▼
CollectedData { data: Record<metricId, number | null> }
        │
        │ applyAggregation(type, values)
        ▼
AggregationResult { metricId, period, value, trend? }
        │
        │ saveSnapshot()
        ▼
MetricSnapshot (MongoDB: analytics_snapshots)
        │
        │ future consumption
        ▼
Dashboard / Report / BI Tool
```

### Principle: Separation of Concerns

| Layer | Responsibility |
|-------|---------------|
| **MetricDefinition** | Declares what a metric _is_ — id, unit, aggregationType |
| **Collector** | Fetches _raw values_ from Prisma (no math, no business logic) |
| **AggregationEngine** | Pure math functions — deterministic, testable, no DB access |
| **SnapshotStore** | Persists aggregated values for chart rendering |
| **AnalyticsService** | Orchestrates: collector → aggregation → persistence |
| **EventSubscriber** | Keeps snapshots fresh by reacting to platform events |

---

## Collectors

Each module exposes exactly one collector. A collector:
- Receives a `Period` (start + end Date) and optional `tenantId`
- Returns `CollectedData` with raw metric values keyed by metric ID
- Never calculates trends or applies formulas (just reads from DB)
- Never modifies business data

### Built-in Collectors

| Module | Metrics Provided |
|--------|-----------------|
| `restaurants` | total, active, new_today, new_30d, orders.total_30d, orders.revenue_30d |
| `billing` | mrr, arr, active_subs, trial, grace_period, suspended, churn_risk, avg_monthly_fee |
| `marketing` | campaigns_total, campaigns_completed, campaigns_failed, success_rate |
| `ai` | jobs_completed, jobs_failed, jobs_running, jobs_queued, tokens_total, cost_total, avg_duration_ms, success_rate |
| `certification` | evaluations, avg_score, gold_plus, platinum_plus |
| `automation` | executions, executions_failed (placeholder — null until module ships) |

---

## Aggregation

### Supported Types

| Type | Description | Formula |
|------|-------------|---------|
| `SUM` | Total across period | Σ values |
| `AVG` | Mean value | Σ / n |
| `COUNT` | Non-null count | count(v ≠ null) |
| `MIN` | Minimum | Math.min(...) |
| `MAX` | Maximum | Math.max(...) |
| `PERCENTAGE` | Ratio × 100 | (numerator / denominator) × 100 |
| `TREND` | % change vs previous period | (curr − prev) / |prev| × 100 |
| `LATEST` | Point-in-time snapshot | most recent value |

### Period Resolution

```typescript
resolvePeriod('today')     // 00:00 → 23:59 today
resolvePeriod('yesterday') // 00:00 → 23:59 yesterday
resolvePeriod('7d')        // today - 7 days → now
resolvePeriod('30d')       // today - 30 days → now
resolvePeriod('month')     // 1st of current month → last day
resolvePeriod('year')      // Jan 1 → Dec 31 current year
resolvePeriod('custom', start, end)
```

`previousPeriod(period)` mirrors the exact same duration before the start — used for TREND calculations.

---

## Storage

### MetricSnapshot (MongoDB: `analytics_snapshots`)

```
id           ObjectId
metricId     String      'billing.mrr'
period       String      'today' | '7d' | '30d' | 'month' | 'year' | 'custom'
periodStart  DateTime
periodEnd    DateTime
value        Float
trend        Float?      % change vs previous period
tenantId     String?     null = platform-wide
metadata     String?     JSON blob
createdAt    DateTime
```

Indexed on:
- `(metricId, period)` — efficient time-series lookup
- `(metricId, createdAt)` — chronological ordering
- `(tenantId, metricId)` — per-restaurant drill-down

### Snapshot Strategy

- Every `collectModule()` call with `persist: true` (default) saves a snapshot
- EventBus events trigger focused re-collection for the affected module
- `getMetricValue()` checks for a cached snapshot before running a live query
- Old snapshots can be pruned with `deleteOldSnapshots(days)`

---

## Built-in Reports

| ID | Module | Default Period | Metrics |
|----|--------|---------------|---------|
| `platform-overview` | platform | 30d | 13 cross-module KPIs |
| `billing-overview` | billing | month | 8 billing metrics |
| `ai-usage` | ai | 30d | 8 AI metrics |
| `marketing-performance` | marketing | 30d | 4 marketing metrics |
| `certification-overview` | certification | 30d | 4 certification metrics |
| `restaurant-activity` | restaurants | 30d | 6 restaurant metrics |

---

## Event Subscriptions

The engine reacts to platform events and refreshes snapshots automatically:

| Event | Action |
|-------|--------|
| `BillingRenewed` | Re-collect billing module |
| `CampaignCompleted` | Re-collect marketing module |
| `CertificationCompleted` | Re-collect certification module |
| `RestaurantCreated` | Re-collect restaurants module |
| `AIGenerationCompleted` | Re-collect ai module |
| `AIGenerationFailed` | Re-collect ai module |

This ensures dashboard snapshots are fresh without requiring a cron job.

---

## Public API

```typescript
import {
  // Bootstrap
  initAnalyticsEngine,           // registers metrics + collectors + reports + events

  // Collect
  collect,                       // collect one metric, returns AggregationResult
  collectModule,                 // collect entire module, returns CollectedData
  collectAll,                    // collect every module
  collectNow,                    // convenience trigger for all modules

  // Query
  getMetricValue,                // resolve from snapshot or live collect
  getMetrics,                    // batch resolve
  getModuleSummary,              // all metrics for one module
  getPlatformSummary,            // all enabled metrics (for superadmin)
  getDashboardMetrics,           // subset of metrics for a dashboard widget

  // Reports
  generateReport,                // run a named report → ReportResult

  // Storage
  saveSnapshot,
  getLatestSnapshot,
  getSnapshots,
  getSnapshotsForPeriod,
  deleteOldSnapshots,

  // Registry
  registerMetric, getMetric, getAllMetrics,
  registerCollector, getCollector,
  registerReport, getReport, getAllReports,
} from './analytics'
```

---

## Extending the Engine

### Register a custom metric

```typescript
import { registerMetric } from './analytics'

registerMetric({
  id:              'hotel.occupancy_rate',
  module:          'hotel',
  category:        'operations',
  name:            'Occupancy Rate',
  description:     'Percentage of rooms occupied',
  unit:            'percentage',
  aggregationType: 'AVG',
  enabled:         true,
  tags:            ['hotel', 'kpi'],
})
```

### Register a custom collector

```typescript
import { registerCollector } from './analytics'

registerCollector({
  module:  'hotel',
  name:    'Hotel Collector',
  metrics: ['hotel.occupancy_rate', 'hotel.bookings_today'],
  async collect(period, tenantId) {
    // prisma queries here — raw values only
    return {
      module: 'hotel',
      collectedAt: new Date(),
      period,
      data: {
        'hotel.occupancy_rate': 78.5,
        'hotel.bookings_today': 12,
      },
    }
  },
})
```

### Register a custom report

```typescript
import { registerReport } from './analytics'

registerReport({
  id:            'hotel-daily',
  name:          'Hotel Daily Summary',
  description:   'Key hotel metrics for the day',
  module:        'hotel',
  defaultPeriod: 'today',
  tags:          ['hotel', 'daily'],
  metrics:       ['hotel.occupancy_rate', 'hotel.bookings_today'],
})
```

---

## Future Integrations

### Phase I+1 — Analytics REST API

Expose the engine via HTTP for consumption by frontend dashboards:

```
GET  /api/superadmin/analytics/platform       — getPlatformSummary()
GET  /api/superadmin/analytics/report/:id     — generateReport(id)
GET  /api/superadmin/analytics/metric/:id     — getMetricValue(id)
POST /api/superadmin/analytics/collect        — collectNow()
GET  /api/admin/analytics/summary             — getModuleSummary('restaurants')
```

### Phase I+2 — Scheduled Collection (Cron)

Add a daily/hourly cron that calls `collectNow()` to keep all snapshots current:

```typescript
startAnalyticsCron()  // hourly: collectNow('today'), daily: collectNow('30d')
```

### Phase I+3 — BI Integration

`MetricSnapshot` records include `metadata` (JSON) and full period timestamps.
Any BI tool (Metabase, Grafana, Redash) can query the `analytics_snapshots` collection directly.

### Phase I+4 — Per-Tenant Analytics

Collectors already accept `tenantId`. When called with a tenantId, they scope all queries to that tenant.
Snapshots include `tenantId = null` for platform-wide and `tenantId = <cafeId>` for per-restaurant.

### Future Applications

The engine is application-agnostic. Hotel, Clinic, Marketplace modules register their own:
- `MetricDefinition` entries
- `CollectorDefinition` implementations
- `ReportDefinition` templates

And consume the same `AnalyticsService` functions.

---

## Design Decisions

**Why not use a dedicated time-series DB?**
At current scale (hundreds of restaurants) MongoDB is sufficient. The `analytics_snapshots` collection acts as a lightweight time-series store. When volume exceeds MongoDB's comfort zone, migrate `SnapshotStore` to InfluxDB or TimescaleDB without changing any collector or service code.

**Why collectors return pre-aggregated values (not raw rows)?**
Returning millions of raw order rows would be impractical. MongoDB/Prisma aggregate functions (`_sum`, `_avg`, `_count`) are used inside collectors to keep payloads small. The `AggregationEngine` handles cross-collector math and trend calculation.

**Why in-memory registries (not DB-backed)?**
Metrics and collectors are static definitions, not dynamic data. In-memory registries are zero-latency and survive process restarts identically (they're seeded at startup). This mirrors the pattern used by `PackRegistry` and `RuleRegistry` in the Certification Engine.
