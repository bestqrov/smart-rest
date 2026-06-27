/**
 * Marketing Brain — End-to-End Smoke Test
 *
 * Proves the complete AI generation chain:
 *   Decision Engine → Strategy Engine → Prompt Builder
 *   → Generation Pipeline → Gemini → Output Validation
 *
 * Run:
 *   npx ts-node --transpile-only scripts/marketing-brain-e2e.ts
 *
 * Requires:
 *   DATABASE_URL  — MongoDB Atlas URI (same as the rest of the app)
 *   GEMINI_API_KEY — live Gemini key
 */

import dotenv from 'dotenv'
dotenv.config()

// ─── Core modules ─────────────────────────────────────────────────────────────

import { connect, disconnect, seedMarketingBrain } from '../src/marketing-brain'
import { decide }           from '../src/marketing-brain/decision-engine/DecisionEngine'
import { plan as planStrategy }   from '../src/marketing-brain/strategy/StrategyEngine'
import * as CountryKnowledgeService      from '../src/marketing-brain/knowledge/CountryKnowledgeService'
import * as PersonaKnowledgeService      from '../src/marketing-brain/knowledge/PersonaKnowledgeService'
import * as ScenarioKnowledgeService     from '../src/marketing-brain/knowledge/ScenarioKnowledgeService'
import * as BusinessTypeKnowledgeService from '../src/marketing-brain/knowledge/BusinessTypeKnowledgeService'
import { build as buildPrompt }           from '../src/marketing-brain/prompt-builder/PromptBuilder'
import { runPipeline, processOutput }     from '../src/marketing-brain/generation/GenerationPipeline'
import { createAIProviderManager }        from '../src/marketing-brain/providers/AIProviderManager'

import type { DecisionContext }   from '../src/marketing-brain/decision-engine/DecisionContext'
import type { PromptContext }     from '../src/marketing-brain/prompt-builder/PromptContext'
import type { UsageEvent }        from '../src/marketing-brain/providers/UsageTracker'

// ─── ANSI colours (no dependencies) ──────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
  white:  '\x1b[97m',
}

function sep(char = '─', width = 60): string {
  return c.grey + char.repeat(width) + c.reset
}
function label(text: string): string {
  return `${c.cyan}${c.bold}${text}${c.reset}`
}
function ok(text: string): string {
  return `${c.green}✓ ${text}${c.reset}`
}
function fail(text: string): string {
  return `${c.red}✗ ${text}${c.reset}`
}
function warn(text: string): string {
  return `${c.yellow}⚠ ${text}${c.reset}`
}
function step(n: number, text: string): void {
  console.log(`\n${sep()}\n${c.bold}[${n}] ${text}${c.reset}`)
}

// ─── Fixed lead profile ───────────────────────────────────────────────────────

/**
 * A Moroccan café owner (young entrepreneur) who just submitted a demo request.
 * The seed contains the French WhatsApp template for this exact scenario+persona.
 * Template slug: demo_whatsapp_fr_young_entrepreneur_welcome
 * Variables required: ownerName (required), cafeName (optional)
 */
const LEAD: DecisionContext = {
  ownerName:    'Karim',
  language:     'fr',
  country:      'MA',
  businessType: 'cafe',
  scenario:     'demo_request_submitted',   // Scenario.trigger in DB
  channel:      'WHATSAPP',
  persona:      'young_entrepreneur',
  campaignGoal: 'CONVERT',
  cafeName:     'Café Atlas',
  cafeCity:     'Casablanca',
  agentName:    'Sofia',
  supportLink:  'https://smartrestau.digima.cloud/support',
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${sep('═')}\n${c.bold}${c.white}  Marketing Brain — E2E Smoke Test${c.reset}\n${sep('═')}`)
  console.log(`${c.grey}Lead: ${LEAD.ownerName} | ${LEAD.language.toUpperCase()} | ${LEAD.country} | ${LEAD.businessType} | ${LEAD.scenario}${c.reset}`)

  // ── STEP 0: Guard — env check ──────────────────────────────────────────────

  step(0, 'Environment check')

  if (!process.env.DATABASE_URL) {
    console.error(fail('DATABASE_URL is not set. Add it to .env'))
    process.exit(1)
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error(fail('GEMINI_API_KEY is not set. Add it to .env'))
    process.exit(1)
  }
  console.log(ok('DATABASE_URL present'))
  console.log(ok('GEMINI_API_KEY present'))

  // ── STEP 1: MongoDB connection ─────────────────────────────────────────────

  step(1, 'MongoDB connection')
  await connect()
  console.log(ok('Connected to marketing_brain database'))

  // ── STEP 2: Seed (idempotent) ──────────────────────────────────────────────

  step(2, 'Seed check (idempotent)')
  await seedMarketingBrain()
  console.log(ok('Seed complete (existing records are not duplicated)'))

  // ── STEP 3: Decision Engine ────────────────────────────────────────────────

  step(3, 'Decision Engine — decide()')
  const t3 = Date.now()
  const decisionResult = await decide(LEAD)
  const t3ms = Date.now() - t3

  if (decisionResult.errors.length) {
    console.error(fail('Decision Engine returned errors:'))
    decisionResult.errors.forEach(e => console.error(`   ${c.red}•${c.reset} ${e}`))
    process.exit(1)
  }

  console.log(ok(`Completed in ${t3ms}ms`))
  console.log(`   ${label('Scenario')}       ${decisionResult.selectedScenario?.slug ?? 'null'}`)
  console.log(`   ${label('Template')}       ${decisionResult.selectedTemplate?.slug ?? 'null'}`)
  console.log(`   ${label('Confidence')}     ${decisionResult.confidenceScore}/100`)
  console.log(`   ${label('AI Rules')}       ${decisionResult.selectedAIRules.length} applied`)
  console.log(`   ${label('Variables')}      ${Object.keys(decisionResult.selectedVariables).join(', ')}`)

  if (!decisionResult.selectedTemplate) {
    console.error(fail('No template was selected. The seed may not include a French WhatsApp template for this scenario+persona.'))
    process.exit(1)
  }
  if (decisionResult.warnings.length) {
    decisionResult.warnings.forEach(w => console.log(warn(w)))
  }

  // ── STEP 4: Strategy Engine ────────────────────────────────────────────────

  step(4, 'Strategy Engine — plan()')
  const t4 = Date.now()
  const strategyResult = await planStrategy(decisionResult, LEAD)
  const t4ms = Date.now() - t4

  console.log(ok(`Completed in ${t4ms}ms`))
  console.log(`   ${label('Primary channel')} ${strategyResult.primaryChannel}`)
  console.log(`   ${label('Duration')}        ${strategyResult.expectedDurationDays} days`)
  console.log(`   ${label('Follow-ups')}      ${strategyResult.followupPlan.touchpoints.length} planned`)
  console.log(`   ${label('Stop conds')}      ${strategyResult.stopConditions.map(s => s.code).join(', ')}`)
  console.log(`   ${label('Strategy')}        ${strategyResult.reasoning.summary}`)

  // ── STEP 5: Knowledge fetch ────────────────────────────────────────────────

  step(5, 'Knowledge fetch (parallel)')
  const t5 = Date.now()
  const [countryKnowledge, personaKnowledge, scenarioKnowledge, businessTypeKnowledge] =
    await Promise.all([
      CountryKnowledgeService     .getByCode(LEAD.country).catch(() => null),
      PersonaKnowledgeService     .getBySlug('young_entrepreneur').catch(() => null),
      ScenarioKnowledgeService    .getByTrigger(LEAD.scenario).catch(() => null),
      BusinessTypeKnowledgeService.getBySlug(LEAD.businessType).catch(() => null),
    ])
  const t5ms = Date.now() - t5

  console.log(ok(`Fetched in ${t5ms}ms`))
  console.log(`   ${label('Country')}         ${countryKnowledge ? countryKnowledge.nameEn : warn('missing')}`)
  console.log(`   ${label('Persona')}         ${personaKnowledge ? personaKnowledge.nameEn : warn('missing')}`)
  console.log(`   ${label('Scenario')}        ${scenarioKnowledge ? scenarioKnowledge.trigger : warn('missing')}`)
  console.log(`   ${label('BusinessType')}    ${businessTypeKnowledge ? businessTypeKnowledge.nameEn : warn('missing')}`)

  // ── STEP 6: Prompt Builder ─────────────────────────────────────────────────

  step(6, 'Prompt Builder — build()')
  const promptCtx: PromptContext = {
    decisionResult,
    decisionContext: LEAD,
    strategyResult,
    countryKnowledge:      countryKnowledge      ?? null,
    personaKnowledge:      personaKnowledge      ?? null,
    scenarioKnowledge:     scenarioKnowledge     ?? null,
    businessTypeKnowledge: businessTypeKnowledge ?? null,
    objectionKnowledge:    null,
  }

  const t6 = Date.now()
  const promptBuildResult = buildPrompt(promptCtx)
  const t6ms = Date.now() - t6

  if (!promptBuildResult.ok) {
    console.error(fail('Prompt Builder failed:'))
    ;(promptBuildResult as { ok: false; errors: string[]; warnings: string[] }).errors
      .forEach((e: string) => console.error(`   ${c.red}•${c.reset} ${e}`))
    process.exit(1)
  }

  const { result: promptResult, warnings: promptWarnings } = promptBuildResult
  const tok = promptResult.estimatedTokens
  console.log(ok(`Completed in ${t6ms}ms`))
  console.log(`   ${label('Version')}         ${promptResult.version}`)
  console.log(`   ${label('Est. tokens')}     ${tok.totalTokens} (sys ${tok.systemTokens} + user ${tok.userTokens})`)
  console.log(`   ${label('System length')}   ${promptResult.systemPrompt.length} chars`)
  console.log(`   ${label('User length')}     ${promptResult.userPrompt.length} chars`)
  if (promptWarnings.length) {
    promptWarnings.forEach(w => console.log(warn(w)))
  }

  // ── STEP 7: Generation Pipeline pre-flight ─────────────────────────────────

  step(7, 'Generation Pipeline — runPipeline()')
  const t7 = Date.now()
  const pipeline = runPipeline({ promptResult })
  const t7ms = Date.now() - t7

  console.log(ok(`Completed in ${t7ms}ms`))
  console.log(`   ${label('Status')}          ${pipeline.status}`)
  console.log(`   ${label('Safety')}          ${pipeline.safetyResult.passed ? 'PASS' : 'FAIL'} (${pipeline.safetyResult.checks.filter(c => !c.passed).length} issues)`)
  console.log(`   ${label('Compliance')}      ${pipeline.complianceResult.passed ? 'PASS' : 'FAIL'} (${pipeline.complianceResult.checks.filter(c => !c.passed).length} issues)`)
  console.log(`   ${label('Brand')}           ${pipeline.brandResult.passed ? 'PASS' : 'FAIL'} (${pipeline.brandResult.checks.filter(c => !c.passed).length} issues)`)

  if (pipeline.status !== 'READY_TO_SEND') {
    console.error(fail(`Pipeline blocked. Status: ${pipeline.status}`))
    const allFailures = [
      ...pipeline.safetyResult.checks.filter(c => !c.passed).map(c => `[SAFETY] ${c.code}: ${c.details ?? c.message}`),
      ...pipeline.complianceResult.checks.filter(c => !c.passed).map(c => `[COMPLIANCE] ${c.code}: ${c.details ?? c.message}`),
      ...pipeline.brandResult.checks.filter(c => !c.passed).map(c => `[BRAND] ${c.code}: ${c.details ?? c.message}`),
    ]
    allFailures.forEach(f => console.error(`   ${c.red}•${c.reset} ${f}`))
    process.exit(1)
  }

  // ── STEP 8: AI Provider — Gemini ───────────────────────────────────────────

  step(8, 'AI Provider — Gemini generate()')

  let usageEvent: UsageEvent | null = null

  const manager = createAIProviderManager(
    { gemini: { apiKey: process.env.GEMINI_API_KEY! } },
    { clearExisting: true },
  )

  manager.addUsageHook((event: UsageEvent) => {
    usageEvent = event
  })

  const providerStatus = manager.status()
  console.log(`   ${label('Active providers')} ${providerStatus.providers.filter(p => p.active).map(p => p.name).join(', ')}`)

  const t8 = Date.now()
  const genResult = await manager.generate({
    systemPrompt: promptResult.systemPrompt,
    userPrompt:   promptResult.userPrompt,
    maxTokens:    512,
    temperature:  0.7,
    metadata:     {
      pipelineId: pipeline.pipelineId,
      scenario:   LEAD.scenario,
      language:   LEAD.language,
    },
  })
  const t8ms = Date.now() - t8

  if (!genResult.ok) {
    type FailedResult = { ok: false; error: string; errorCode?: string; provider: null; attempts: unknown[] }
    const failed = genResult as unknown as FailedResult
    console.error(fail(`Gemini generation failed: ${failed.error}`))
    console.error(`   Error code: ${failed.errorCode ?? 'unknown'}`)
    process.exit(1)
  }

  console.log(ok(`Generated in ${t8ms}ms`))
  console.log(`   ${label('Provider')}        ${genResult.response.provider}`)
  console.log(`   ${label('Model')}           ${genResult.response.model}`)
  console.log(`   ${label('Latency')}         ${genResult.response.latencyMs}ms`)
  console.log(`   ${label('Tokens (in)')}     ${genResult.response.usage.inputTokens}`)
  console.log(`   ${label('Tokens (out)')}    ${genResult.response.usage.outputTokens}`)
  console.log(`   ${label('Tokens (total)')}  ${genResult.response.usage.totalTokens}`)

  if (usageEvent) {
    const evt = usageEvent as UsageEvent
    const costDisplay = evt.costUsd < 0.0001
      ? `< $0.0001`
      : `$${evt.costUsd.toFixed(6)}`
    console.log(`   ${label('Est. cost')}       ${costDisplay}`)
  }

  // ── STEP 9: Output Validation ──────────────────────────────────────────────

  step(9, 'Output Validation — processOutput()')
  const rawOutput = genResult.response.content
  const t9 = Date.now()
  const finalPipeline = processOutput(pipeline, rawOutput)
  const t9ms = Date.now() - t9

  console.log(ok(`Validated in ${t9ms}ms`))
  console.log(`   ${label('Final status')}    ${finalPipeline.status}`)

  const validated = finalPipeline.validatedOutput
  if (validated) {
    const passed   = validated.checks.filter(c => c.passed).length
    const total    = validated.checks.length
    console.log(`   ${label('Output checks')}   ${passed}/${total} passed`)
    console.log(`   ${label('Char count')}      ${validated.characterCount}`)
    console.log(`   ${label('Word count')}      ${validated.wordCount}`)
    console.log(`   ${label('Has CTA')}         ${validated.hasCTA ? 'yes' : 'no'}`)
    console.log(`   ${label('Unresolved vars')} ${validated.hasUnresolved ? warn('YES — check template!') : 'none'}`)

    const failedChecks = validated.checks.filter(c => !c.passed && c.code !== 'CTA_PRESENT')
    if (failedChecks.length) {
      failedChecks.forEach(ch => {
        console.log(warn(`   Output check failed: ${ch.code} — ${ch.details ?? ch.message}`))
      })
    }
  }

  if (finalPipeline.status !== 'OUTPUT_VALID') {
    console.error(fail(`Output validation failed. Status: ${finalPipeline.status}`))
    if (finalPipeline.errors.length) {
      finalPipeline.errors.forEach(e => console.error(`   ${c.red}•${c.reset} ${e}`))
    }
    process.exit(1)
  }

  // ── RESULT ─────────────────────────────────────────────────────────────────

  console.log(`\n${sep('═')}`)
  console.log(`${c.green}${c.bold}  ✓ SMOKE TEST PASSED${c.reset}`)
  console.log(sep('═'))
  console.log(`\n${label('GENERATED MESSAGE')} (${validated!.channel}, ${validated!.characterCount} chars)\n`)
  console.log(sep('─'))
  console.log(validated!.content)
  console.log(sep('─'))

  console.log(`\n${label('PIPELINE SUMMARY')}`)
  console.log(`  Decision Engine    ${t3ms}ms    confidence ${decisionResult.confidenceScore}/100`)
  console.log(`  Strategy Engine    ${t4ms}ms    ${strategyResult.followupPlan.touchpoints.length} follow-ups planned`)
  console.log(`  Knowledge fetch    ${t5ms}ms`)
  console.log(`  Prompt Builder     ${t6ms}ms    ${promptResult.estimatedTokens.totalTokens} est. tokens`)
  console.log(`  Pre-flight         ${t7ms}ms    ${pipeline.status}`)
  console.log(`  Gemini generate    ${t8ms}ms    ${genResult.response.usage.totalTokens} real tokens`)
  console.log(`  Output validation  ${t9ms}ms    ${finalPipeline.status}`)

  if (usageEvent) {
    const evt = usageEvent as UsageEvent
    const costDisplay = evt.costUsd < 0.0001 ? '< $0.0001' : `$${evt.costUsd.toFixed(6)}`
    const total = t3ms + t4ms + t5ms + t6ms + t7ms + t8ms + t9ms
    console.log(`\n  Total wall time    ${total}ms`)
    console.log(`  Generation cost    ${costDisplay}`)
    console.log(`  Provider           ${evt.provider} / ${evt.model}`)
  }

  console.log()
}

// ─── Entry point ──────────────────────────────────────────────────────────────

main()
  .catch((err: unknown) => {
    console.error(`\n${fail('UNHANDLED ERROR')}`)
    console.error(err)
    process.exit(1)
  })
  .finally(() => {
    disconnect().catch(() => undefined)
  })
