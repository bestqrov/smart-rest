/**
 * Automation Engine — Phase D Integration Test
 *
 * Proves:
 *   1. READY execution → webhook called → status = SENT, audit log written
 *   2. Webhook 5xx → retry → FAILED after max attempts, 3 audit entries
 *   3. Permanent 4xx → no retry → FAILED in 1 attempt
 *   4. CANCELLED execution → deliverWithRetry() throws, no audit log
 *   5. QUEUED execution → deliverWithRetry() throws, no audit log
 *   6. runOnce() processes multiple READY executions in one pass
 *
 * Uses an embedded Node.js HTTP server — no real n8n required.
 *
 * Run:
 *   npm run integration:automation
 *
 * Requires: DATABASE_URL in .env
 */

import dotenv from 'dotenv'
dotenv.config()

import http    from 'http'
import crypto  from 'crypto'
import mongoose from 'mongoose'

import { connect, disconnect }        from '../src/marketing-brain/connection'
import { CampaignExecution }          from '../src/marketing-brain/models/CampaignExecution'
import { DeliveryAuditLog }           from '../src/marketing-brain/automation/models/DeliveryAuditLog'
import { AutomationEngineService }    from '../src/marketing-brain/automation/AutomationEngineService'
import { N8nAdapter }                 from '../src/marketing-brain/automation/providers/N8nAdapter'
import type { DeliveryProvider, DeliveryResult } from '../src/marketing-brain/automation/providers/DeliveryProvider'
import type { ICampaignExecution }    from '../src/marketing-brain/models/CampaignExecution'

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m',
  red:   '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', grey: '\x1b[90m',
}
const sep  = (ch = '─', w = 60) => c.grey + ch.repeat(w) + c.reset
const ok   = (t: string) => `${c.green}✓ ${t}${c.reset}`
const fail = (t: string) => `${c.red}✗ ${t}${c.reset}`
const step = (n: number, t: string) => console.log(`\n${sep()}\n${c.bold}[${n}] ${t}${c.reset}`)

let passed = 0
let failed = 0

function assert(condition: boolean, message: string): void {
  if (condition) { console.log(ok(message)); passed++ }
  else           { console.error(fail(message)); failed++ }
}

// ─── Local webhook server ─────────────────────────────────────────────────────

interface WebhookRequest {
  method:  string
  url:     string
  body:    string
  headers: Record<string, string>
}

interface LocalServer {
  url:          string
  requests:     WebhookRequest[]
  setStatus:    (code: number) => void
  setBody:      (body: string) => void
  close:        () => Promise<void>
}

function startLocalServer(initialStatus = 200): Promise<LocalServer> {
  return new Promise((resolve, reject) => {
    let statusCode = initialStatus
    let responseBody = JSON.stringify({ executionId: `mock-${crypto.randomUUID()}` })
    const requests: WebhookRequest[] = []

    const server = http.createServer((req, res) => {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        requests.push({
          method:  req.method ?? 'GET',
          url:     req.url ?? '/',
          body,
          headers: req.headers as Record<string, string>,
        })
        res.writeHead(statusCode, { 'Content-Type': 'application/json' })
        res.end(statusCode < 300 ? responseBody : `{"error":"mocked ${statusCode}"}`)
      })
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      resolve({
        url:      `http://127.0.0.1:${addr.port}/webhook`,
        requests,
        setStatus: (code) => { statusCode = code },
        setBody:   (body) => { responseBody = body },
        close:     () => new Promise((res, rej) => server.close(e => e ? rej(e) : res())),
      })
    })

    server.on('error', reject)
  })
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_CAMPAIGN_ID   = crypto.randomUUID()
const MOCK_GENERATION_ID = crypto.randomUUID()
const ALL_LEAD_IDS: string[] = []

async function createExecution(
  overrides: Partial<{
    campaignId:   string
    status:       string
    leadId:       string
    scheduledAt:  Date
  }> = {},
): Promise<ICampaignExecution> {
  const leadId = overrides.leadId ?? new mongoose.Types.ObjectId().toString()
  ALL_LEAD_IDS.push(leadId)

  const doc = await CampaignExecution.create({
    campaignId:    overrides.campaignId   ?? MOCK_CAMPAIGN_ID,
    generationId:  MOCK_GENERATION_ID,
    leadId,
    executionType: 'PRIMARY',
    followupOrder: null,
    channel:       'WHATSAPP',
    scheduledAt:   overrides.scheduledAt  ?? new Date(Date.now() - 1_000),
    priority:      1,
    status:        (overrides.status      ?? 'READY') as 'READY' | 'QUEUED' | 'CANCELLED',
    retryCount:    0,
    message:       'Si Ahmed, votre démo SmartRestau est prête !',
    goal:          'Initial outreach',
    metadata:      { scenario: 'demo_request_submitted', language: 'fr' },
  })

  return doc as unknown as ICampaignExecution
}

// ─── Test 1: READY → webhook called → SENT + audit log ───────────────────────

async function testHappyPath(): Promise<void> {
  step(1, 'READY execution → webhook called → status=SENT, audit log written')

  const srv     = await startLocalServer(200)
  const adapter = new N8nAdapter({ webhookUrl: srv.url, timeoutMs: 5_000 })
  const engine  = new AutomationEngineService({ providers: [adapter], maxAttempts: 3 })
  const exec    = await createExecution()

  const result  = await engine.deliverWithRetry(exec)

  assert(result.finalStatus === 'SENT',   'finalStatus = SENT')
  assert(result.attempts    === 1,        'delivered on first attempt')
  assert(result.lastResult.success,       'lastResult.success = true')
  assert(result.lastResult.provider === 'n8n', 'provider = n8n')
  assert(result.lastResult.statusCode === 200,  'statusCode = 200')
  assert(result.lastResult.latencyMs  >= 0,     'latencyMs tracked')

  // Webhook called exactly once
  assert(srv.requests.length === 1, 'webhook called exactly once')
  const body = JSON.parse(srv.requests[0].body)
  assert(body.channel === 'WHATSAPP',         'payload.channel = WHATSAPP')
  assert(typeof body.message === 'string',    'payload.message present')
  assert(body.generationId === MOCK_GENERATION_ID, 'payload.generationId correct')

  // MongoDB: execution is SENT
  const updated = await CampaignExecution.findById(exec._id)
  assert(updated?.status === 'SENT', 'MongoDB: execution.status = SENT')

  // Audit log written
  const logs = await DeliveryAuditLog.find({ executionId: (exec._id as object).toString() })
  assert(logs.length === 1,            'audit log: 1 record written')
  assert(logs[0].success === true,     'audit log: success = true')
  assert(logs[0].attempt === 1,        'audit log: attempt = 1')
  assert(logs[0].provider === 'n8n',   'audit log: provider = n8n')
  assert(logs[0].latencyMs >= 0,       'audit log: latencyMs tracked')
  assert(logs[0].error === null,       'audit log: error = null')

  await srv.close()
}

// ─── Test 2: 5xx → retry → FAILED after max attempts ─────────────────────────

async function testTransientRetry(): Promise<void> {
  step(2, '5xx webhook → 3 retries → status=FAILED, 3 audit log entries')

  const srv     = await startLocalServer(503)
  const adapter = new N8nAdapter({ webhookUrl: srv.url, timeoutMs: 5_000 })
  const engine  = new AutomationEngineService({
    providers:   [adapter],
    maxAttempts: 3,
    baseDelayMs: 50,   // fast for tests
  })
  const exec = await createExecution()

  const result = await engine.deliverWithRetry(exec)

  assert(result.finalStatus === 'FAILED',   'finalStatus = FAILED')
  assert(result.attempts    === 3,          '3 attempts exhausted')
  assert(!result.lastResult.success,        'lastResult.success = false')
  assert(result.lastResult.retryable,       'lastResult.retryable = true (5xx)')

  // Webhook called 3 times
  assert(srv.requests.length === 3, 'webhook called 3 times (all retries)')

  // MongoDB: execution is FAILED
  const updated = await CampaignExecution.findById(exec._id)
  assert(updated?.status     === 'FAILED', 'MongoDB: execution.status = FAILED')
  assert((updated?.retryCount ?? 0) >= 3,  'MongoDB: retryCount incremented')

  // 3 audit log entries
  const logs = await DeliveryAuditLog.find(
    { executionId: (exec._id as object).toString() },
  ).sort({ attempt: 1 })

  assert(logs.length === 3,   'audit log: 3 records (one per attempt)')
  assert(logs[0].attempt === 1, 'audit log: attempt 1 recorded')
  assert(logs[1].attempt === 2, 'audit log: attempt 2 recorded')
  assert(logs[2].attempt === 3, 'audit log: attempt 3 recorded')
  assert(logs.every(l => l.success === false),    'all audit logs: success=false')
  assert(logs.every(l => l.statusCode === 503),   'all audit logs: statusCode=503')
  assert(logs.every(l => !!l.error),              'all audit logs: error recorded')

  await srv.close()
}

// ─── Test 3: 4xx → permanent failure → FAILED in 1 attempt ───────────────────

async function testPermanentFailure(): Promise<void> {
  step(3, '400 webhook → permanent failure → FAILED in 1 attempt (no retry)')

  const srv     = await startLocalServer(400)
  const adapter = new N8nAdapter({ webhookUrl: srv.url, timeoutMs: 5_000 })
  const engine  = new AutomationEngineService({
    providers:   [adapter],
    maxAttempts: 3,
    baseDelayMs: 50,
  })
  const exec = await createExecution()

  const result = await engine.deliverWithRetry(exec)

  assert(result.finalStatus === 'FAILED', 'finalStatus = FAILED')
  assert(result.attempts    === 1,        'only 1 attempt (400 is not retryable)')
  assert(!result.lastResult.retryable,    'lastResult.retryable = false')

  // Webhook called once only
  assert(srv.requests.length === 1, 'webhook called exactly once (no retry for 4xx)')

  // 1 audit log entry
  const logs = await DeliveryAuditLog.find({ executionId: (exec._id as object).toString() })
  assert(logs.length === 1,   'audit log: 1 record only')
  assert(logs[0].statusCode === 400, 'audit log: statusCode=400')

  await srv.close()
}

// ─── Test 4: CANCELLED execution → throws, no delivery ────────────────────────

async function testCancelledGuard(): Promise<void> {
  step(4, 'CANCELLED execution → deliverWithRetry() throws, no audit log')

  const srv     = await startLocalServer(200)
  const adapter = new N8nAdapter({ webhookUrl: srv.url })
  const engine  = new AutomationEngineService({ providers: [adapter] })
  const exec    = await createExecution({ status: 'CANCELLED' })

  let threw = false
  try {
    await engine.deliverWithRetry(exec)
  } catch {
    threw = true
  }

  assert(threw,                  'deliverWithRetry() threw for CANCELLED execution')
  assert(srv.requests.length === 0, 'webhook NOT called')

  const logs = await DeliveryAuditLog.find({ executionId: (exec._id as object).toString() })
  assert(logs.length === 0, 'no audit log written for CANCELLED execution')

  await srv.close()
}

// ─── Test 5: QUEUED execution → throws ───────────────────────────────────────

async function testQueuedGuard(): Promise<void> {
  step(5, 'QUEUED execution → deliverWithRetry() throws, no audit log')

  const futureDate = new Date(Date.now() + 3_600_000)  // 1h from now
  const srv        = await startLocalServer(200)
  const adapter    = new N8nAdapter({ webhookUrl: srv.url })
  const engine     = new AutomationEngineService({ providers: [adapter] })
  const exec       = await createExecution({ status: 'QUEUED', scheduledAt: futureDate })

  let threw = false
  try {
    await engine.deliverWithRetry(exec)
  } catch {
    threw = true
  }

  assert(threw,                  'deliverWithRetry() threw for QUEUED execution')
  assert(srv.requests.length === 0, 'webhook NOT called')

  const logs = await DeliveryAuditLog.find({ executionId: (exec._id as object).toString() })
  assert(logs.length === 0, 'no audit log written for QUEUED execution')

  await srv.close()
}

// ─── Test 6: runOnce() processes multiple READY executions ────────────────────

async function testRunOnce(): Promise<void> {
  step(6, 'runOnce() — processes all READY executions in one pass')

  const srv     = await startLocalServer(200)
  const adapter = new N8nAdapter({ webhookUrl: srv.url, timeoutMs: 5_000 })
  const engine  = new AutomationEngineService({ providers: [adapter], maxAttempts: 3 })

  // Create 3 READY executions + 1 QUEUED (future) that should not be dispatched yet
  const batchCampaignId = crypto.randomUUID()
  await Promise.all([
    createExecution({ campaignId: batchCampaignId }),
    createExecution({ campaignId: batchCampaignId }),
    createExecution({ campaignId: batchCampaignId }),
    createExecution({
      campaignId:  batchCampaignId,
      status:      'QUEUED',
      scheduledAt: new Date(Date.now() + 3_600_000),
    }),
  ])

  const runResult = await engine.runOnce()

  console.log(`\n   processed: ${runResult.processed}`)
  console.log(`   sent:      ${runResult.sent}`)
  console.log(`   failed:    ${runResult.failed}`)
  console.log(`   skipped:   ${runResult.skipped}`)
  console.log(`   duration:  ${runResult.durationMs}ms`)

  assert(runResult.sent    >= 3, `at least 3 executions sent (got ${runResult.sent})`)
  assert(runResult.failed  === 0, 'no failures (webhook returns 200)')
  assert(runResult.skipped === 0, 'no skipped executions')

  // Webhook called once per READY execution (at minimum 3)
  assert(srv.requests.length >= 3, `webhook called ≥3 times (got ${srv.requests.length})`)

  // All processed executions are now SENT in MongoDB
  const sentDocs = await CampaignExecution.find({
    campaignId: batchCampaignId,
    status:     'SENT',
  })
  assert(sentDocs.length >= 3, `MongoDB: ≥3 executions are SENT (got ${sentDocs.length})`)

  // The QUEUED future execution is still QUEUED
  const queuedDocs = await CampaignExecution.find({
    campaignId: batchCampaignId,
    status:     'QUEUED',
  })
  assert(queuedDocs.length === 1, 'future QUEUED execution still QUEUED (not dispatched)')

  await srv.close()
}

// ─── Test 7: custom provider adapter interface ─────────────────────────────────

async function testCustomProvider(): Promise<void> {
  step(7, 'Custom provider adapter — DeliveryProvider interface honored')

  let callCount = 0

  const mockProvider: DeliveryProvider = {
    id:       'mock',
    name:     'Mock Provider',
    isActive: true,
    send: async (_exec): Promise<DeliveryResult> => {
      callCount++
      return {
        success:           true,
        provider:          'mock',
        providerMessageId: `mock-${crypto.randomUUID()}`,
        latencyMs:         1,
        error:             null,
        statusCode:        200,
        retryable:         false,
      }
    },
    healthCheck: async () => true,
  }

  const engine = new AutomationEngineService({ providers: [mockProvider] })
  const exec   = await createExecution()
  const result = await engine.deliverWithRetry(exec)

  assert(callCount          === 1,     'custom provider.send() called once')
  assert(result.finalStatus === 'SENT','finalStatus = SENT via custom provider')
  assert(result.lastResult.provider === 'mock', 'provider ID = mock')

  const logs = await DeliveryAuditLog.find({ executionId: (exec._id as object).toString() })
  assert(logs.length       === 1,     'audit log: 1 record')
  assert(logs[0].provider  === 'mock','audit log: provider = mock')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${sep('═')}\n${c.bold}  Automation Engine — Phase D Integration Test${c.reset}\n${sep('═')}`)

  if (!process.env.DATABASE_URL) {
    console.error(fail('DATABASE_URL not set')); process.exit(1)
  }

  await connect()
  console.log(ok('Connected to marketing_brain'))

  await testHappyPath()
  await testTransientRetry()
  await testPermanentFailure()
  await testCancelledGuard()
  await testQueuedGuard()
  await testRunOnce()
  await testCustomProvider()

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(`\n${sep('═')}`)
  const allPassed = failed === 0
  if (allPassed) {
    console.log(`${c.green}${c.bold}  ✓ ALL ${passed} ASSERTIONS PASSED${c.reset}`)
  } else {
    console.log(`${c.red}${c.bold}  ✗ ${failed} ASSERTION(S) FAILED (${passed} passed)${c.reset}`)
  }
  console.log(sep('═'))

  // Cleanup
  await CampaignExecution.deleteMany({ leadId: { $in: ALL_LEAD_IDS } }).catch(() => undefined)
  await DeliveryAuditLog.deleteMany({ generationId: MOCK_GENERATION_ID }).catch(() => undefined)

  process.exit(allPassed ? 0 : 1)
}

main()
  .catch((err: unknown) => {
    console.error(fail('UNHANDLED ERROR'), err)
    process.exit(1)
  })
  .finally(() => disconnect().catch(() => undefined))
