/**
 * setup-creatomate.ts
 *
 * Creates (or updates) the Smart Resto dish-promo video template on Creatomate,
 * then patches .env with CREATOMATE_TEMPLATE_ID automatically.
 *
 * Usage:
 *   npx ts-node scripts/setup-creatomate.ts
 *   npx ts-node scripts/setup-creatomate.ts --update <existing-template-id>
 */

import fs   from 'fs'
import path from 'path'

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.creatomate.com/v1'

function getApiKey(): string {
  // Try .env directly (no dotenv dep needed)
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    const match   = content.match(/^CREATOMATE_API_KEY=(.+)$/m)
    if (match) return match[1].trim()
  }
  const fromEnv = process.env.CREATOMATE_API_KEY
  if (fromEnv && !fromEnv.startsWith('REPLACE')) return fromEnv
  console.error('❌  CREATOMATE_API_KEY not set in .env')
  process.exit(1)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(method: string, path: string, body?: unknown, apiKey?: string) {
  const key = apiKey ?? getApiKey()
  const res  = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json()
  if (!res.ok) {
    console.error('Creatomate API error:', json)
    process.exit(1)
  }
  return json
}

function patchEnv(key: string, value: string) {
  const envPath = path.resolve(process.cwd(), '.env')
  let content   = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''

  const regex = new RegExp(`^${key}=.*$`, 'm')
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`)
  } else {
    content += `\n${key}=${value}`
  }
  fs.writeFileSync(envPath, content)
  console.log(`✅  .env updated: ${key}=${value}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args       = process.argv.slice(2)
  const updateFlag = args.indexOf('--update')
  const existingId = updateFlag !== -1 ? args[updateFlag + 1] : null

  const templateSource = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'scripts/creatomate-template.json'), 'utf-8')
  )
  // Remove the _comment and _variables meta keys before sending
  delete templateSource._comment
  delete templateSource._variables

  const apiKey = getApiKey()

  if (existingId) {
    // ── Update existing template ──────────────────────────────────────────────
    console.log(`🔄  Updating template ${existingId}…`)
    const result = await apiFetch('PUT', `/templates/${existingId}`, {
      name:   'Smart Resto — Dish Promo v1',
      source: templateSource,
    }, apiKey)
    console.log('✅  Template updated:', result.id)
    patchEnv('CREATOMATE_TEMPLATE_ID', result.id)
  } else {
    // ── Create new template ───────────────────────────────────────────────────
    console.log('🚀  Creating new Creatomate template…')
    const result = await apiFetch('POST', '/templates', {
      name:   'Smart Resto — Dish Promo v1',
      source: templateSource,
    }, apiKey)
    console.log('✅  Template created!')
    console.log('   ID:', result.id)
    console.log('   Preview URL:', result.preview_url ?? 'N/A')
    patchEnv('CREATOMATE_TEMPLATE_ID', result.id)
  }

  // ── Test render (dry run) ──────────────────────────────────────────────────
  const shouldTest = args.includes('--test')
  if (shouldTest) {
    console.log('\n🎬  Kicking off a test render…')
    const render = await apiFetch('POST', '/renders', {
      template_id: process.env.CREATOMATE_TEMPLATE_ID,
      modifications: {
        imageUrl:         'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1080',
        logoUrl:          'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Test-Logo.svg/783px-Test-Logo.svg.png',
        cafeName:         'مطعم الأطلس',
        dishName:         'كوسكوس مراكشي',
        price:            '85 MAD',
        caption:          'واو! شي حاجة من أخر الدنيا 🔥\nتانريكوموندوه لكل عشاق الأكل المغربي',
        watermarkOpacity: '0.22',
      },
    }, apiKey)
    console.log('✅  Test render kicked off:', render[0]?.id ?? render.id)
    console.log('   Status:', render[0]?.status ?? render.status)
    console.log('   Poll URL:', `${API_BASE}/renders/${render[0]?.id ?? render.id}`)
  }

  console.log('\n🎉  Done. Add your CREATOMATE_API_KEY and run:')
  console.log('   npx ts-node scripts/setup-creatomate.ts --test')
}

main().catch(err => { console.error(err); process.exit(1) })
