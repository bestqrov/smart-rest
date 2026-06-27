/**
 * AI Center — SuperAdmin REST API
 *
 * All routes require x-superadmin-secret + x-superadmin-email headers.
 *
 * Routes:
 *   GET  /api/superadmin/ai-center/providers            — all providers + stats
 *   GET  /api/superadmin/ai-center/providers/:id        — single provider detail
 *   PATCH /api/superadmin/ai-center/providers/:id       — update settings
 *   POST  /api/superadmin/ai-center/providers/:id/test  — health check
 *   POST  /api/superadmin/ai-center/fallback-chain      — save fallback order
 *   GET  /api/superadmin/ai-center/analytics            — platform-wide totals
 *   GET  /api/superadmin/ai-center/health               — all providers health
 */

import { Router, Request, Response, NextFunction } from 'express'
import prisma from '../prisma'
import logger from '../logger'
import {
  getDefaultManager,
  listProviders,
  getProvider,
  registryStatus,
} from '../marketing-brain/providers'
import { getProviderStats, getAllProviderStats, getPlatformTotals } from '../services/aiCenterStats'

const router = Router()

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const secret        = req.header('x-superadmin-secret')
  const email         = req.header('x-superadmin-email')
  const expectedSecret = process.env.SUPERADMIN_SECRET
  const expectedEmail  = process.env.SUPERADMIN_EMAIL

  if (!expectedSecret || secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (expectedEmail && email !== expectedEmail) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  return next()
}

// ─── Static metadata (not in adapters — avoids touching Marketing Brain) ─────

const PROVIDER_META: Record<string, {
  label:        string
  model:        string
  apiKeyEnv:    string
  docsUrl:      string
  pricingNote:  string
}> = {
  gemini: {
    label:       'Google Gemini',
    model:       'gemini-2.5-flash',
    apiKeyEnv:   'GEMINI_API_KEY',
    docsUrl:     'https://ai.google.dev',
    pricingNote: '$0.15/$0.60 per 1M tokens (input/output)',
  },
  claude: {
    label:       'Anthropic Claude',
    model:       'claude-opus-4-5',
    apiKeyEnv:   'CLAUDE_API_KEY',
    docsUrl:     'https://docs.anthropic.com',
    pricingNote: '$15/$75 per 1M tokens (Opus)',
  },
  openai: {
    label:       'OpenAI',
    model:       'gpt-4o',
    apiKeyEnv:   'OPENAI_API_KEY',
    docsUrl:     'https://platform.openai.com',
    pricingNote: '$5/$15 per 1M tokens (GPT-4o)',
  },
  groq: {
    label:       'Groq',
    model:       'llama-3.1-70b-versatile',
    apiKeyEnv:   'GROQ_API_KEY',
    docsUrl:     'https://console.groq.com',
    pricingNote: '$0.59/$0.79 per 1M tokens (Llama 70B)',
  },
  openrouter: {
    label:       'OpenRouter',
    model:       'auto',
    apiKeyEnv:   'OPENROUTER_API_KEY',
    docsUrl:     'https://openrouter.ai',
    pricingNote: 'Varies by routed model',
  },
}

// ─── Helper: merge registry + DB settings + stats ────────────────────────────

async function buildProviderView(providerId: string) {
  // Ensure manager is initialized so all providers are registered
  try { getDefaultManager() } catch { /* no GEMINI_API_KEY in env — continue */ }

  const provider = getProvider(providerId)
  const meta     = PROVIDER_META[providerId]

  // DB settings (may not exist yet — use defaults)
  const settings = await prisma.aIProviderSettings.findUnique({
    where: { providerId },
  })

  const stats = getProviderStats(providerId)
  const apiKeyConfigured = !!(process.env[meta?.apiKeyEnv ?? ''])

  return {
    id:             providerId,
    label:          meta?.label       ?? provider?.name ?? providerId,
    model:          meta?.model       ?? 'unknown',
    docsUrl:        meta?.docsUrl     ?? '',
    pricingNote:    meta?.pricingNote ?? '',
    apiKeyEnv:      meta?.apiKeyEnv   ?? '',
    apiKeyConfigured,

    // From registry (runtime state)
    registeredInProcess: !!provider,
    runtimeActive:       provider?.isActive ?? false,
    runtimePriority:     provider?.priority ?? 99,

    // From DB (persisted admin config)
    isEnabled:     settings?.isEnabled     ?? (provider?.isActive ?? false),
    priority:      settings?.priority      ?? (provider?.priority ?? 99),
    isDefault:     settings?.isDefault     ?? false,
    fallbackChain: settings?.fallbackChain ?? [],
    notes:         settings?.notes         ?? '',
    updatedAt:     settings?.updatedAt     ?? null,
    updatedBy:     settings?.updatedBy     ?? null,

    // Usage stats (today + MTD)
    stats,
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/superadmin/ai-center/providers
router.get('/api/superadmin/ai-center/providers', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    try { getDefaultManager() } catch { /* ok */ }

    const providers = listProviders()

    // Ensure all known providers appear even if not registered
    const allIds = new Set([...Object.keys(PROVIDER_META), ...providers.map(p => p.id)])

    const views = await Promise.all([...allIds].map(id => buildProviderView(id)))

    // Sort by priority asc
    views.sort((a, b) => a.priority - b.priority)

    res.json({ providers: views, registry: registryStatus() })
  } catch (err: unknown) {
    logger.error({ msg: '[AICenter] GET providers error', err })
    res.status(500).json({ error: 'Failed to load providers' })
  }
})

// GET /api/superadmin/ai-center/providers/:id
router.get('/api/superadmin/ai-center/providers/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const view = await buildProviderView(String(req.params.id))
    res.json(view)
  } catch (err: unknown) {
    logger.error({ msg: '[AICenter] GET provider error', err })
    res.status(500).json({ error: 'Failed to load provider' })
  }
})

// PATCH /api/superadmin/ai-center/providers/:id
router.patch('/api/superadmin/ai-center/providers/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { isEnabled, priority, isDefault, notes } = req.body as {
      isEnabled?: boolean
      priority?:  number
      isDefault?: boolean
      notes?:     string
    }
    const email = req.header('x-superadmin-email') ?? 'superadmin'

    const data: Record<string, unknown> = { updatedBy: email }
    if (isEnabled  !== undefined) data.isEnabled  = isEnabled
    if (priority   !== undefined) data.priority   = Math.max(1, Math.min(99, Number(priority)))
    if (isDefault  !== undefined) data.isDefault  = isDefault
    if (notes      !== undefined) data.notes      = notes.slice(0, 500)

    // If setting as default, clear other defaults first
    if (isDefault === true) {
      await prisma.aIProviderSettings.updateMany({
        where: { providerId: { not: id } },
        data:  { isDefault: false },
      })
    }

    const settings = await prisma.aIProviderSettings.upsert({
      where:  { providerId: id },
      create: { providerId: id, ...data },
      update: data,
    })

    logger.info({ msg: '[AICenter] provider settings updated', id, data, email })
    res.json({ ok: true, settings })
  } catch (err: unknown) {
    logger.error({ msg: '[AICenter] PATCH provider error', err })
    res.status(500).json({ error: 'Failed to update provider settings' })
  }
})

// POST /api/superadmin/ai-center/providers/:id/test
router.post('/api/superadmin/ai-center/providers/:id/test', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

    try { getDefaultManager() } catch { /* ok */ }

    const provider = getProvider(id)
    if (!provider) {
      return res.json({
        ok:        false,
        status:    'unavailable',
        healthy:   false,
        error:     'Provider not registered in this process',
        latencyMs: null,
        checkedAt: new Date().toISOString(),
      })
    }

    const health = await provider.healthCheck()
    logger.info({ msg: '[AICenter] provider health check', id, health })

    res.json({
      ok:        health.healthy,
      status:    health.status,
      healthy:   health.healthy,
      latencyMs: health.latencyMs ?? null,
      error:     health.error     ?? null,
      checkedAt: health.checkedAt,
    })
  } catch (err: unknown) {
    logger.error({ msg: '[AICenter] test provider error', err })
    res.status(500).json({ error: 'Health check failed unexpectedly' })
  }
})

// POST /api/superadmin/ai-center/fallback-chain
router.post('/api/superadmin/ai-center/fallback-chain', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { chain } = req.body as { chain: string[] }
    const email     = req.header('x-superadmin-email') ?? 'superadmin'

    if (!Array.isArray(chain) || chain.length === 0) {
      return res.status(400).json({ error: 'chain must be a non-empty array of provider IDs' })
    }

    // Store on the first (primary/default) provider's settings
    const primaryId = chain[0]
    await prisma.aIProviderSettings.upsert({
      where:  { providerId: primaryId },
      create: { providerId: primaryId, fallbackChain: chain.slice(1), isDefault: true, updatedBy: email },
      update: { fallbackChain: chain.slice(1), isDefault: true, updatedBy: email },
    })

    logger.info({ msg: '[AICenter] fallback chain saved', chain, email })
    res.json({ ok: true, chain })
  } catch (err: unknown) {
    logger.error({ msg: '[AICenter] fallback chain error', err })
    res.status(500).json({ error: 'Failed to save fallback chain' })
  }
})

// GET /api/superadmin/ai-center/analytics
router.get('/api/superadmin/ai-center/analytics', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const totals       = getPlatformTotals()
    const perProvider  = getAllProviderStats()
    res.json({ totals, perProvider })
  } catch (err: unknown) {
    logger.error({ msg: '[AICenter] analytics error', err })
    res.status(500).json({ error: 'Failed to load analytics' })
  }
})

// GET /api/superadmin/ai-center/health
router.get('/api/superadmin/ai-center/health', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    try { getDefaultManager() } catch { /* ok */ }

    const providers = listProviders()

    const checks = await Promise.all(
      providers.map(async p => {
        const health = await p.healthCheck()
        return { id: p.id, name: p.name, ...health }
      }),
    )

    res.json({ checks, checkedAt: new Date().toISOString() })
  } catch (err: unknown) {
    logger.error({ msg: '[AICenter] health check error', err })
    res.status(500).json({ error: 'Health check failed' })
  }
})

export default router
