import { Scenario }   from '../models/Scenario'
import type { IScenario, FunnelStage } from '../models/Scenario'
import type { ScenarioKnowledge } from './types'
import {
  STAGE_PROFILES,
  TRIGGER_OVERRIDES,
  type ScenarioEnrichment,
  type TriggerOverride,
} from './profiles/scenario'

// ─── Public API ───────────────────────────────────────────────────────────────

/** Look up by slug. */
export async function getBySlug(slug: string): Promise<ScenarioKnowledge | null> {
  const doc = await Scenario.findOne({ slug, isActive: true }).lean<IScenario>()
  return doc ? enrich(doc) : null
}

/** Look up by MongoDB ObjectId. */
export async function getById(id: string): Promise<ScenarioKnowledge | null> {
  const doc = await Scenario.findById(id).lean<IScenario>()
  return doc ? enrich(doc) : null
}

/**
 * Find and enrich the best matching scenario for a trigger string.
 * When multiple scenarios share a trigger, the highest-priority one wins.
 */
export async function getByTrigger(trigger: string): Promise<ScenarioKnowledge | null> {
  const doc = await Scenario
    .findOne({ trigger, isActive: true })
    .sort({ priority: -1 })
    .lean<IScenario>()
  return doc ? enrich(doc) : null
}

/** Batch lookup — returns map keyed by slug. */
export async function getBySlugs(slugs: string[]): Promise<Record<string, ScenarioKnowledge>> {
  if (!slugs.length) return {}
  const docs = await Scenario.find({ slug: { $in: slugs }, isActive: true }).lean<IScenario[]>()
  return Object.fromEntries(docs.map(d => [d.slug, enrich(d)]))
}

/** All active scenarios for a given funnel stage, sorted by priority. */
export async function getByStage(stage: FunnelStage): Promise<ScenarioKnowledge[]> {
  const docs = await Scenario
    .find({ stage, isActive: true })
    .sort({ priority: -1 })
    .lean<IScenario[]>()
  return docs.map(enrich)
}

/** All active scenarios, sorted by stage order then priority. */
export async function getAll(): Promise<ScenarioKnowledge[]> {
  const stageOrder: FunnelStage[] = [
    'AWARENESS', 'CONSIDERATION', 'DECISION', 'ONBOARDING', 'RETENTION', 'REACTIVATION',
  ]
  const docs = await Scenario.find({ isActive: true }).lean<IScenario[]>()
  const enriched = docs.map(enrich)
  enriched.sort((a, b) => {
    const stageDiff = stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage)
    return stageDiff !== 0 ? stageDiff : b.priority - a.priority
  })
  return enriched
}

// ─── Enrichment ───────────────────────────────────────────────────────────────

function enrich(doc: IScenario): ScenarioKnowledge {
  const profile = resolveProfile(doc.stage, doc.trigger)
  return {
    // From DB
    slug:     doc.slug,
    stage:    doc.stage,
    trigger:  doc.trigger,
    nameEn:   doc.nameEn,
    nameAr:   doc.nameAr,
    nameFr:   doc.nameFr,
    priority: doc.priority,
    // From profile (stage defaults merged with trigger overrides)
    ...profile,
  }
}

/**
 * Resolution order:
 *   1. Stage-level default from STAGE_PROFILES
 *   2. Trigger-specific overrides merged on top
 */
function resolveProfile(stage: FunnelStage, trigger: string): ScenarioEnrichment {
  const stageProfile = STAGE_PROFILES[stage]
  const triggerOverride: TriggerOverride = TRIGGER_OVERRIDES[trigger] ?? {}
  return { ...stageProfile, ...triggerOverride }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Enrich from plain object — no DB call. For unit testing. */
export function enrichSync(doc: Pick<IScenario,
  'slug' | 'stage' | 'trigger' | 'nameEn' | 'nameAr' | 'nameFr' | 'priority'
>): ScenarioKnowledge {
  return enrich(doc as IScenario)
}

/** Return the raw merged profile without DB fields. Useful in tests. */
export function resolveProfileSync(stage: FunnelStage, trigger: string): ScenarioEnrichment {
  const stageProfile = STAGE_PROFILES[stage]
  const override: TriggerOverride = TRIGGER_OVERRIDES[trigger] ?? {}
  return { ...stageProfile, ...override }
}
