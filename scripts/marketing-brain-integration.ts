/**
 * Marketing Brain — Phase B Integration Test
 *
 * Proves:
 *   1. Lead created → MarketingGenerationService runs → message stored in MongoDB
 *   2. Lead creation succeeds even when Gemini fails (graceful degradation)
 *
 * Run:
 *   npm run integration:brain
 *
 * Requires: DATABASE_URL and GEMINI_API_KEY in .env
 */

import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import { connect, disconnect }  from '../src/marketing-brain/connection'
import { MarketingGeneration }  from '../src/marketing-brain/models/MarketingGeneration'
import {
  generate,
  mapBusinessType,
  inferLanguage,
} from '../src/marketing-brain/MarketingGenerationService'
import type { GenerationInput } from '../src/marketing-brain/MarketingGenerationService'

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m',
  red:    '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', grey: '\x1b[90m',
}
const sep  = (ch = '─', w = 60) => c.grey + ch.repeat(w) + c.reset
const ok   = (t: string) => `${c.green}✓ ${t}${c.reset}`
const fail = (t: string) => `${c.red}✗ ${t}${c.reset}`
const step = (n: number, t: string) => console.log(`\n${sep()}\n${c.bold}[${n}] ${t}${c.reset}`)

let passed = 0
let failed = 0

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(ok(message))
    passed++
  } else {
    console.error(fail(message))
    failed++
  }
}

// ─── Mock lead IDs (not real Prisma records — service only stores the ref) ───

const MOCK_LEAD_ID        = new mongoose.Types.ObjectId().toString()
const MOCK_LEAD_FAIL_ID   = new mongoose.Types.ObjectId().toString()

// ─── Test 1: Happy path — real Gemini call, stored in MongoDB ─────────────────

async function testHappyPath(): Promise<void> {
  step(1, 'Happy path — generate() stores message in MongoDB')

  const input: GenerationInput = {
    leadId:       MOCK_LEAD_ID,
    ownerName:    'Youssef',
    cafeName:     'Café Marrakech',
    cafeCity:     'Marrakech',
    language:     'fr',
    country:      'MA',
    businessType: 'cafe',
    scenario:     'demo_request_submitted',
    ownerPhone:   '+212600000001',
    agentName:    'Fatima',
  }

  const t0      = Date.now()
  const summary = await generate(input)
  const elapsed = Date.now() - t0

  console.log(`\n   generationId:    ${summary.generationId}`)
  console.log(`   status:          ${summary.status === 'COMPLETED' ? c.green : c.red}${summary.status}${c.reset}`)
  console.log(`   attempts:        ${summary.attempts}`)
  console.log(`   latency:         ${elapsed}ms`)
  console.log(`   tokens:          ${summary.tokens ?? 'n/a'}`)
  console.log(`   cost:            ${summary.estimatedCost != null ? `$${summary.estimatedCost.toFixed(6)}` : 'n/a'}`)
  console.log(`   promptVersion:   ${summary.promptVersion ?? 'n/a'}`)
  console.log(`   validationStatus:${summary.validationStatus ?? 'n/a'}`)

  assert(summary.status === 'COMPLETED',  'summary.status = COMPLETED')
  assert(!summary.error,                  'no error in summary')
  assert(summary.attempts >= 1,           'at least 1 attempt recorded')
  assert(summary.tokens !== null,         'tokens tracked')
  assert(summary.promptVersion !== null,  'promptVersion stored')

  // Verify MongoDB record
  const doc = await MarketingGeneration.findOne({ generationId: summary.generationId })

  assert(doc !== null,                                  'record exists in marketing_generations')
  assert(doc?.status === 'COMPLETED',                   'record.status = COMPLETED')
  assert(doc?.leadId === MOCK_LEAD_ID,                  'record.leadId matches input')
  assert(typeof doc?.generatedMessage === 'string',     'record.generatedMessage is a string')
  assert((doc?.generatedMessage?.length ?? 0) > 10,    'generatedMessage is non-trivial')
  assert(doc?.provider === 'gemini',                    'record.provider = gemini')
  assert(doc?.confidenceScore !== null,                 'record.confidenceScore stored')
  assert(doc?.tokens !== null,                          'record.tokens stored')
  assert(doc?.estimatedCost !== null,                   'record.estimatedCost stored')
  assert(doc?.latencyMs !== null,                       'record.latencyMs stored')
  assert(doc?.validationStatus === 'OUTPUT_VALID',      'record.validationStatus = OUTPUT_VALID')
  assert(doc?.error === null,                           'record.error = null')

  if (doc?.generatedMessage) {
    console.log(`\n   ${c.cyan}${c.bold}GENERATED MESSAGE${c.reset}`)
    console.log(`   ${c.grey}${'─'.repeat(50)}${c.reset}`)
    console.log(`   ${doc.generatedMessage}`)
    console.log(`   ${c.grey}${'─'.repeat(50)}${c.reset}`)
  }
}

// ─── Test 2: Graceful failure — bad API key, lead creation still returns OK ──

async function testGracefulFailure(): Promise<void> {
  step(2, 'Graceful failure — bad API key → status=FAILED, no throw')

  // Temporarily override the env key so the service uses a bad key
  const originalKey  = process.env.GEMINI_API_KEY
  process.env.GEMINI_API_KEY = 'AIzaBadKeyForTesting1234567890123456789'

  const input: GenerationInput = {
    leadId:       MOCK_LEAD_FAIL_ID,
    ownerName:    'Ahmed',
    cafeName:     'Café Tanger',
    cafeCity:     'Tanger',
    language:     'fr',
    country:      'MA',
    businessType: 'restaurant',
    scenario:     'demo_request_submitted',
  }

  let threwUnexpectedly = false
  let summary: Awaited<ReturnType<typeof generate>> | null = null

  try {
    summary = await generate(input)
  } catch {
    threwUnexpectedly = true
  } finally {
    // Restore original key
    process.env.GEMINI_API_KEY = originalKey
  }

  assert(!threwUnexpectedly,          'generate() did NOT throw — lead creation safe')

  if (summary) {
    console.log(`\n   generationId: ${summary.generationId}`)
    console.log(`   status:       ${summary.status === 'FAILED' ? c.yellow : c.red}${summary.status}${c.reset}`)
    console.log(`   attempts:     ${summary.attempts}`)
    console.log(`   error:        ${summary.error?.slice(0, 80)}...`)

    assert(summary.status === 'FAILED',   'summary.status = FAILED (not COMPLETED)')
    assert(!!summary.error,               'error message captured in summary')
    assert(summary.tokens === null,       'no tokens on failure')
    assert(summary.estimatedCost === null,'no cost on failure')

    // Verify MongoDB record reflects failure
    const doc = await MarketingGeneration.findOne({ generationId: summary.generationId })

    assert(doc !== null,              'FAILED record still stored in MongoDB')
    assert(doc?.status === 'FAILED',  'record.status = FAILED')
    assert(!!doc?.error,              'record.error contains message')
    assert(doc?.generatedMessage === null || doc?.generatedMessage === undefined || doc?.generatedMessage === '',
                                      'record.generatedMessage empty on failure')
  }
}

// ─── Test 3: Utility functions ────────────────────────────────────────────────

function testUtilities(): void {
  step(3, 'Utility functions — mapBusinessType() and inferLanguage()')

  assert(mapBusinessType('CAFE')       === 'cafe',       'CAFE → cafe')
  assert(mapBusinessType('RESTAURANT') === 'restaurant', 'RESTAURANT → restaurant')
  assert(mapBusinessType('TRAITEUR')   === 'caterer',    'TRAITEUR → caterer')
  assert(mapBusinessType('HOTEL')      === 'hotel',      'HOTEL → hotel')
  assert(mapBusinessType('UNKNOWN')    === 'restaurant', 'UNKNOWN → restaurant (default)')

  assert(inferLanguage('MA') === 'fr', 'MA → fr')
  assert(inferLanguage('TN') === 'fr', 'TN → fr')
  assert(inferLanguage('DZ') === 'fr', 'DZ → fr')
  assert(inferLanguage('SA') === 'ar', 'SA → ar')
  assert(inferLanguage('AE') === 'ar', 'AE → ar')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${sep('═')}\n${c.bold}  Marketing Brain — Phase B Integration Test${c.reset}\n${sep('═')}`)

  // Env guard
  if (!process.env.DATABASE_URL) {
    console.error(fail('DATABASE_URL not set'))
    process.exit(1)
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error(fail('GEMINI_API_KEY not set'))
    process.exit(1)
  }

  // DB connection
  await connect()
  console.log(ok('Connected to marketing_brain'))

  // Tests
  testUtilities()
  await testHappyPath()
  await testGracefulFailure()

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(`\n${sep('═')}`)
  const allPassed = failed === 0
  if (allPassed) {
    console.log(`${c.green}${c.bold}  ✓ ALL ${passed} ASSERTIONS PASSED${c.reset}`)
  } else {
    console.log(`${c.red}${c.bold}  ✗ ${failed} ASSERTION(S) FAILED (${passed} passed)${c.reset}`)
  }
  console.log(sep('═'))

  // Cleanup test records
  await MarketingGeneration.deleteMany({
    leadId: { $in: [MOCK_LEAD_ID, MOCK_LEAD_FAIL_ID] },
  }).catch(() => undefined)

  process.exit(allPassed ? 0 : 1)
}

main()
  .catch((err: unknown) => {
    console.error(fail('UNHANDLED ERROR'), err)
    process.exit(1)
  })
  .finally(() => disconnect().catch(() => undefined))
