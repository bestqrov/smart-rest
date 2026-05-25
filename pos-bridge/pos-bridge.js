'use strict'

/**
 * SmartResto POS Bridge  v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs silently on the restaurant cash-register PC.
 * Intercepts ESC/POS print jobs → parses items/prices → syncs to backend.
 *
 * Setup (Windows):
 *   1. Install Node.js 18+ on the PC.
 *   2. Run:  npm install
 *   3. Edit  config.json  (API_TOKEN + CAFE_ID from admin panel → Settings).
 *   4. Add a printer:  Control Panel → Devices → Add Printer → Local → TCP/IP
 *                      Host: 127.0.0.1   Port: 9100   Protocol: RAW
 *   5. Set that printer as default in your POS software.
 *   6. Run:  node install-service.js   (registers Windows Service, auto-start)
 *      Or just test with:  node pos-bridge.js
 *
 * To forward jobs to the real physical printer as well, set FORWARD_HOST in config.json.
 */

const net  = require('net')
const dns  = require('dns')
const http = require('http')
const https = require('https')
const fs   = require('fs')
const path = require('path')

// NeDB — embedded offline queue (no MongoDB installation needed on the PC)
const Datastore = require('@seald-io/nedb')

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG  (overridden by config.json at runtime)
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  LISTEN_PORT:        9100,          // TCP port — configure Windows printer to 127.0.0.1:9100
  FORWARD_HOST:       null,          // Real printer IP, e.g. "192.168.1.50"  (null = disabled)
  FORWARD_PORT:       9100,
  API_BASE:           'https://smartrestau.digima.cloud',
  API_TOKEN:          '',            // JWT token from admin panel (Settings → POS Bridge)
  CAFE_ID:            '',            // cafeId from admin panel
  RETRY_INTERVAL_MS:  30_000,        // How often to retry offline queue
  JOB_FLUSH_MS:       2_500,         // Wait after last byte before processing receipt
  MIN_RECEIPT_CHARS:  30,            // Ignore print jobs shorter than this
  LOG_RECEIPTS:       true,          // Save raw receipt text to receipts.log
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────

const LOG_FILE     = path.join(__dirname, 'pos-bridge.log')
const RECEIPT_LOG  = path.join(__dirname, 'receipts.log')

function writeLog(level, msg, data) {
  const line = `[${new Date().toISOString()}] [${level.padEnd(5)}] ${msg}${data ? '  ' + JSON.stringify(data) : ''}\n`
  process.stdout.write(line)
  try { fs.appendFileSync(LOG_FILE, line) } catch {}
}

const log = {
  info:  (m, d) => writeLog('INFO',  m, d),
  warn:  (m, d) => writeLog('WARN',  m, d),
  error: (m, d) => writeLog('ERROR', m, d),
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE QUEUE  (NeDB — persisted to offline.db)
// ─────────────────────────────────────────────────────────────────────────────

const db = new Datastore({ filename: path.join(__dirname, 'offline.db'), autoload: true })
db.ensureIndex({ fieldName: 'createdAt' }, () => {})

function dbInsert(doc) {
  return new Promise((res, rej) => db.insert(doc, (e, d) => e ? rej(e) : res(d)))
}
function dbFind() {
  return new Promise((res, rej) => db.find({}).sort({ createdAt: 1 }).exec((e, d) => e ? rej(e) : res(d)))
}
function dbRemove(id) {
  return new Promise((res, rej) => db.remove({ _id: id }, {}, e => e ? rej(e) : res()))
}

async function enqueue(payload) {
  await dbInsert({ ...payload, createdAt: new Date(), retries: 0 })
  log.warn('Queued offline', { type: payload.type, items: payload.items?.length })
}

// ─────────────────────────────────────────────────────────────────────────────
// ESC/POS STRIPPER  — removes all printer control codes, returns clean text
// ─────────────────────────────────────────────────────────────────────────────

function stripEscPos(buffer) {
  const bytes  = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const out    = []
  let   i      = 0

  while (i < bytes.length) {
    const b = bytes[i]

    // ── ESC (0x1B) sequences ────────────────────────────────────────────────
    if (b === 0x1B) {
      const n = bytes[i + 1]
      if (n === undefined)        { i++; continue }
      if (n === 0x40)             { i += 2; continue }  // ESC @  initialize
      if (n === 0x45)             { i += 3; continue }  // ESC E  bold
      if (n === 0x47)             { i += 3; continue }  // ESC G  double-strike
      if (n === 0x61)             { i += 3; continue }  // ESC a  alignment
      if (n === 0x21)             { i += 3; continue }  // ESC !  font
      if (n === 0x4D)             { i += 3; continue }  // ESC M  font select
      if (n === 0x2D)             { i += 3; continue }  // ESC -  underline
      if (n === 0x7B)             { i += 3; continue }  // ESC {  upside-down
      if (n === 0x74)             { i += 3; continue }  // ESC t  code page
      if (n === 0x52)             { i += 3; continue }  // ESC R  charset
      if (n === 0x25)             { i += 3; continue }  // ESC %  user-defined
      if (n === 0x4A)             { i += 3; continue }  // ESC J  feed n dots
      if (n === 0x64)             { i += 3; continue }  // ESC d  feed n lines
      if (n === 0x56)             { i += 3; continue }  // ESC V  cut (obsolete)
      if (n === 0x69 || n === 0x6D) { i += 2; continue } // ESC i/m cut
      if (n === 0x57)             { i += 10; continue } // ESC W  print area
      if (n === 0x26)             { i += 6;  continue } // ESC &  user char
      if (n === 0x3D)             { i += 3;  continue } // ESC =  device select
      if (n === 0x50)             { i += 3;  continue } // ESC P  macro def
      if (n === 0x71)             { i += bytes[i + 2] + 3; continue } // ESC q
      i += 2; continue // unknown ESC — skip both bytes
    }

    // ── GS (0x1D) sequences ─────────────────────────────────────────────────
    if (b === 0x1D) {
      const n = bytes[i + 1]
      if (n === undefined)    { i++; continue }
      if (n === 0x56)         { i += 4; continue }  // GS V  cut
      if (n === 0x21)         { i += 3; continue }  // GS !  size
      if (n === 0x42)         { i += 3; continue }  // GS B  reverse
      if (n === 0x62)         { i += 3; continue }  // GS b  smooth
      if (n === 0x61)         { i += 3; continue }  // GS a  density
      if (n === 0x4C)         { i += 4; continue }  // GS L  left margin
      if (n === 0x57)         { i += 4; continue }  // GS W  print width
      if (n === 0x50)         { i += 4; continue }  // GS P  dot size
      if (n === 0x68)         { i += 3; continue }  // GS h  barcode height
      if (n === 0x77)         { i += 3; continue }  // GS w  barcode width
      if (n === 0x66)         { i += 3; continue }  // GS f  barcode font
      if (n === 0x48)         { i += 3; continue }  // GS H  barcode position
      if (n === 0x6B) {                             // GS k  barcode data
        i += 3
        while (i < bytes.length && bytes[i] !== 0x00) i++
        i++; continue
      }
      if (n === 0x28) {                             // GS (  extended commands
        const len = bytes[i + 3] + bytes[i + 4] * 256
        i += 4 + len; continue
      }
      i += 2; continue
    }

    // ── DLE (0x10) sequences ────────────────────────────────────────────────
    if (b === 0x10) { i += 2; continue }

    // ── Single skip bytes ────────────────────────────────────────────────────
    if (b === 0x00 || b === 0x08 || b === 0x0C || b === 0x12 || b === 0x14 || b === 0x18) {
      i++; continue
    }

    // ── Keep: TAB, LF, CR, printable ASCII, and high bytes (Arabic / Windows-1256) ──
    if (b === 0x09 || b === 0x0A || b === 0x0D || (b >= 0x20 && b <= 0x7E) || b >= 0x80) {
      out.push(b)
    }
    i++
  }

  // Decode using Windows-1256 (Arabic POS) — approximate with latin1 then fix common chars
  return Buffer.from(out).toString('latin1')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT PARSER  — regex-based extraction of items, qty, price
// ─────────────────────────────────────────────────────────────────────────────

// Lines we definitely don't want to extract items from
const SKIP_LINE = /total|sub.?total|tax|tva|vat|discount|remise|مجموع|ضريبة|خصم|إجمالي|merci|thank|change|monnaie|الباقي|caisse|cashier|caissier|date|time|heure|order|commande|welcome|bienvenue|مرحبا|receipt|reçu|ticket|facture|invoice|------|-{4,}|={4,}/i

// Price pattern: 12.50  /  12,50  /  1 200.00
const PRICE_RE = /(\d{1,3}(?:[ .]\d{3})*[.,]\d{2}|\d{1,6}[.,]\d{2})/g

// Quantity: 2x  /  x2  /  2 X  /  Qty:2  /  Qt 3
const QTY_RE   = /(?:^|\s)(\d{1,3})\s*[xX×*]|[xX×*]\s*(\d{1,3})(?:\s|$)|(?:qt[y]?|qty|qte)[:\s]*(\d{1,3})/i

function parsePrice(str) {
  return parseFloat(str.replace(/\s/g, '').replace(',', '.'))
}

function parseReceipt(text) {
  const lines  = text.split('\n').map(l => l.trim()).filter(l => l.length > 2)
  const items  = []
  const seen   = new Set()

  for (const line of lines) {
    if (SKIP_LINE.test(line))   continue

    const prices = [...line.matchAll(PRICE_RE)].map(m => parsePrice(m[1]))
    if (!prices.length)          continue

    // Last price on the line is the item total/unit price
    const price = prices[prices.length - 1]
    if (price <= 0 || price > 100_000) continue

    // Extract quantity
    const qtyMatch = line.match(QTY_RE)
    const qty = qtyMatch
      ? parseInt(qtyMatch[1] || qtyMatch[2] || qtyMatch[3])
      : 1

    // Name: strip prices, qty markers, separators → what remains
    let name = line
    name = name.replace(PRICE_RE, '')
    name = name.replace(QTY_RE,   '')
    name = name.replace(/[|…_.]{2,}/g, ' ')
    name = name.replace(/\s{2,}/g, ' ')
    name = name.replace(/^[-–—•*|\s]+|[-–—•*|\s]+$/g, '')
    name = name.trim()

    if (!name || name.length < 2)  continue

    // Deduplicate
    const key = `${name.toLowerCase()}|${price}`
    if (seen.has(key))  continue
    seen.add(key)

    items.push({ name, price, qty })
  }

  return items
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTIVITY CHECK
// ─────────────────────────────────────────────────────────────────────────────

function isOnline() {
  return new Promise(resolve => {
    const host = new URL(CONFIG.API_BASE).hostname
    dns.lookup(host, err => resolve(!err))
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT
// ─────────────────────────────────────────────────────────────────────────────

function apiPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload  = JSON.stringify(body)
    const base     = new URL(CONFIG.API_BASE)
    const mod      = base.protocol === 'https:' ? https : http
    const port     = base.port || (base.protocol === 'https:' ? 443 : 80)

    const req = mod.request({
      hostname:  base.hostname,
      port,
      path:      endpoint,
      method:    'POST',
      headers:   {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization':  `Bearer ${CONFIG.API_TOKEN}`,
      },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)) } catch { resolve({}) }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(payload)
    req.end()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC  — send items to backend, queue if offline
// ─────────────────────────────────────────────────────────────────────────────

async function syncMenu(items, rawText) {
  const payload = {
    cafeId:   CONFIG.CAFE_ID,
    items,
    source:   'pos-bridge',
    syncedAt: new Date().toISOString(),
  }
  try {
    await apiPost('/api/v1/restaurant/sync-menu', payload)
    log.info('Synced to backend', { items: items.length })
  } catch (err) {
    log.warn('Sync failed — queuing', { err: err.message })
    await enqueue({ type: 'sync-menu', rawText, ...payload })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI FALLBACK  — if regex extracts 0 items, backend Groq parses the raw text
// ─────────────────────────────────────────────────────────────────────────────

async function aiFallback(rawText) {
  try {
    const result = await apiPost('/api/v1/parser/ai-fallback', {
      cafeId:  CONFIG.CAFE_ID,
      rawText,
    })
    const items = result?.items ?? []
    log.info('AI fallback parsed', { items: items.length })
    return items
  } catch (err) {
    log.error('AI fallback failed', { err: err.message })
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE QUEUE FLUSH
// ─────────────────────────────────────────────────────────────────────────────

async function flushQueue() {
  const docs = await dbFind()
  if (!docs.length) return

  if (!(await isOnline())) return
  log.info(`Flushing ${docs.length} queued job(s)`)

  for (const doc of docs) {
    try {
      if (doc.type === 'sync-menu') {
        await apiPost('/api/v1/restaurant/sync-menu', {
          cafeId:      doc.cafeId,
          items:       doc.items,
          source:      doc.source,
          syncedAt:    new Date().toISOString(),
          wasOffline:  true,
        })
      }
      await dbRemove(doc._id)
      log.info('Flushed queued doc', { id: doc._id })
    } catch (err) {
      log.warn('Flush failed, will retry', { id: doc._id, err: err.message })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT PROCESSOR  — glues everything together
// ─────────────────────────────────────────────────────────────────────────────

async function processJob(buffer) {
  const rawText = stripEscPos(buffer).trim()

  if (rawText.length < CONFIG.MIN_RECEIPT_CHARS) {
    log.info('Job too short, skipping', { chars: rawText.length })
    return
  }

  log.info('Processing job', { chars: rawText.length })

  if (CONFIG.LOG_RECEIPTS) {
    const sep = `\n${'─'.repeat(60)}\n[${new Date().toISOString()}]\n`
    try { fs.appendFileSync(RECEIPT_LOG, sep + rawText + '\n') } catch {}
  }

  // Primary: regex parse
  let items = parseReceipt(rawText)
  log.info('Regex parse result', { items: items.length })

  // Fallback: send raw text to backend AI parser
  if (!items.length) {
    log.warn('Regex extracted 0 items — requesting AI fallback')
    items = await aiFallback(rawText)
  }

  if (!items.length) {
    log.warn('No items extracted — skipping sync')
    return
  }

  await syncMenu(items, rawText)
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB BUFFER  — accumulate TCP chunks per connection, flush after silence
// ─────────────────────────────────────────────────────────────────────────────

const jobs = new Map()  // socketId → { chunks: Buffer[], timer: Timeout }

function feedChunk(socketId, chunk) {
  const job = jobs.get(socketId) ?? { chunks: [], timer: null }

  if (job.timer) clearTimeout(job.timer)
  job.chunks.push(chunk)

  // Detect GS V (paper cut = 0x1D 0x56) — immediate flush
  const hasCut = chunk.includes(0x56) && (() => {
    for (let i = 0; i < chunk.length - 1; i++) {
      if (chunk[i] === 0x1D && chunk[i + 1] === 0x56) return true
    }
    return false
  })()

  if (hasCut) {
    const full = Buffer.concat(job.chunks)
    jobs.delete(socketId)
    setImmediate(() => processJob(full).catch(err => log.error('Job error', { err: err.message })))
    return
  }

  // Timeout-based flush (2.5 s after last byte)
  job.timer = setTimeout(() => {
    const full = Buffer.concat(job.chunks)
    jobs.delete(socketId)
    processJob(full).catch(err => log.error('Job error', { err: err.message }))
  }, CONFIG.JOB_FLUSH_MS)

  jobs.set(socketId, job)
}

// ─────────────────────────────────────────────────────────────────────────────
// TCP SERVER  — virtual printer on port 9100
// ─────────────────────────────────────────────────────────────────────────────

function startServer() {
  const server = net.createServer(socket => {
    const id = `${socket.remoteAddress}:${Date.now()}`
    log.info('Connection from POS', { id })

    // Optional: forward raw data to real physical printer
    let fwd = null
    if (CONFIG.FORWARD_HOST) {
      fwd = net.createConnection(CONFIG.FORWARD_PORT, CONFIG.FORWARD_HOST)
      fwd.on('error', e => log.warn('Forward error', { err: e.message }))
    }

    socket.on('data', chunk => {
      if (fwd && !fwd.destroyed) fwd.write(chunk)
      feedChunk(id, chunk)
    })

    socket.on('end',   () => { log.info('Connection ended', { id }); if (fwd) fwd.end() })
    socket.on('error', e  => { log.warn('Socket error',     { err: e.message })           })
    socket.on('close', () => {
      // Force-flush any buffered data on close
      const job = jobs.get(id)
      if (job) {
        clearTimeout(job.timer)
        const full = Buffer.concat(job.chunks)
        jobs.delete(id)
        if (full.length > 0) {
          processJob(full).catch(err => log.error('Job error on close', { err: err.message }))
        }
      }
    })
  })

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      log.error(`Port ${CONFIG.LISTEN_PORT} already in use — is another instance running?`)
      process.exit(1)
    }
    log.error('Server error', { err: err.message })
  })

  server.listen(CONFIG.LISTEN_PORT, '127.0.0.1', () => {
    log.info(`Virtual printer ready at 127.0.0.1:${CONFIG.LISTEN_PORT}`)
  })

  return server
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  log.info('SmartResto POS Bridge starting...')

  // Load / create config.json
  const cfgPath = path.join(__dirname, 'config.json')
  if (fs.existsSync(cfgPath)) {
    try {
      Object.assign(CONFIG, JSON.parse(fs.readFileSync(cfgPath, 'utf8')))
      log.info('config.json loaded')
    } catch {
      log.warn('config.json parse error — using defaults')
    }
  } else {
    fs.writeFileSync(cfgPath, JSON.stringify(CONFIG, null, 2))
    log.info('config.json created — fill in API_TOKEN and CAFE_ID then restart')
  }

  if (!CONFIG.API_TOKEN) log.warn('API_TOKEN empty — sync will fail until configured')
  if (!CONFIG.CAFE_ID)   log.warn('CAFE_ID empty — sync will fail until configured')

  startServer()

  // Flush offline queue on start, then every RETRY_INTERVAL_MS
  flushQueue().catch(() => {})
  setInterval(() => flushQueue().catch(() => {}), CONFIG.RETRY_INTERVAL_MS)

  log.info('Ready. Add printer: Control Panel → Devices → Add → Local → TCP/IP → 127.0.0.1:9100 (RAW)')
}

main().catch(err => {
  log.error('Fatal', { err: err.message })
  process.exit(1)
})

process.on('SIGINT',  () => { log.info('Shutting down'); process.exit(0) })
process.on('SIGTERM', () => { log.info('Shutting down'); process.exit(0) })
process.on('uncaughtException',  err => log.error('Uncaught',  { err: err.message }))
process.on('unhandledRejection', err => log.error('Unhandled', { err: String(err) }))
