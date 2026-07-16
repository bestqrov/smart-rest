// ─── Smart Intelligence Data Hub — Contracts (K32) ─────────────────────────
// Same registry-of-definitions idiom as AgentRegistry (K30) and
// analytics/collectors/CollectorRegistry — applied to a third concern: pull-
// based cross-module data access instead of event push or metric snapshots.

export interface NormalizedMetric {
  key:        string                              // e.g. "billing.mrr", "reviews.averageRating"
  module:     string
  value:      number | string | boolean | null
  unit?:      string
  tenantId:   string
  computedAt: Date
}

export interface DataAdapterDefinition {
  module: string                                             // domain this adapter covers
  name:   string
  fetch:  (tenantId: string) => Promise<NormalizedMetric[]>   // must reuse an existing domain service — no new storage
}
