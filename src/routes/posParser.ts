/**
 * POS Bridge API routes
 *
 * POST /api/v1/parser/ai-fallback         — Groq parses raw receipt text → structured JSON
 * POST /api/v1/restaurant/sync-menu       — upsert products / update prices from POS data
 */

import express, { Request, Response } from 'express'
import Groq from 'groq-sdk'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getGroq() {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  return new Groq({ apiKey: key })
}

function parseJson(text: string): any {
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  try { return JSON.parse(match ? (match[1] ?? match[0]) : text.trim()) } catch { return null }
}

// Normalise name for fuzzy matching (lowercase, strip punctuation/spaces)
function normName(s: string) {
  return s.toLowerCase().replace(/[\s\-_'".]/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/parser/ai-fallback
// Called by pos-bridge.js when regex extraction yields 0 items.
// Body: { cafeId, rawText }
// Returns: { items: [{ name, price, qty }] }
// ─────────────────────────────────────────────────────────────────────────────

router.post('/api/v1/parser/ai-fallback', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { rawText } = req.body as { rawText?: string }
    if (!rawText || rawText.trim().length < 10) {
      return res.status(400).json({ error: 'rawText is required' })
    }

    const groq   = getGroq()
    const prompt = `
You are a receipt OCR parser. Extract ALL purchased items from this raw receipt/POS text.
Return ONLY a valid JSON array — no explanation, no markdown, no extra text.
Each element: { "name": "...", "price": 0.00, "qty": 1 }

Rules:
- name: the product/dish name (translate to English if Arabic/French)
- price: unit price as a number (not total)
- qty: quantity ordered (default 1 if unclear)
- Ignore: totals, taxes, dates, cashier names, restaurant name, separator lines

Receipt text:
${rawText.slice(0, 4000)}

JSON array only:
`

    const result = await groq.chat.completions.create({
      model:       'llama-3.3-70b-versatile',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens:  2048,
    })

    const raw    = result.choices[0]?.message?.content ?? ''
    const parsed = parseJson(raw)

    if (!Array.isArray(parsed)) {
      logger.warn({ msg: 'AI fallback returned non-array', raw: raw.slice(0, 300) })
      return res.status(422).json({ error: 'AI could not parse receipt', raw: raw.slice(0, 300) })
    }

    // Sanitise output
    const items = parsed
      .filter((it: any) => it?.name && it?.price > 0)
      .map((it: any) => ({
        name:  String(it.name).trim().slice(0, 120),
        price: Number(it.price),
        qty:   Math.max(1, Math.round(Number(it.qty) || 1)),
      }))

    logger.info({ msg: 'AI fallback parsed', count: items.length })
    return res.json({ items })

  } catch (err: any) {
    logger.error({ msg: 'AI fallback error', err: err?.message })
    const is429 = err?.status === 429 || err?.message?.includes('429')
    return res.status(is429 ? 429 : 500).json({ error: err?.message ?? 'AI fallback failed' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/restaurant/sync-menu
// Called by pos-bridge.js after every receipt.
// Body: { cafeId, items: [{ name, price, qty }], source, syncedAt, wasOffline? }
// Returns: { updated, created, unchanged, skipped }
// ─────────────────────────────────────────────────────────────────────────────

router.post('/api/v1/restaurant/sync-menu', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { items, source, wasOffline } = req.body as {
      items:      { name: string; price: number; qty: number }[]
      source?:    string
      wasOffline?: boolean
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'items array is required' })
    }

    // Load all products for this cafe
    const products = await prisma.product.findMany({
      where:   { category: { cafeId } },
      select:  { id: true, nameAr: true, nameEn: true, nameFr: true, nameEs: true, price: true, categoryId: true },
    })

    // Find or create a default "POS Sync" category for unknown items
    let defaultCategoryId: string | null = null

    const stats = { updated: 0, created: 0, unchanged: 0, skipped: 0 }

    for (const item of items) {
      if (!item.name || item.price <= 0) { stats.skipped++; continue }

      const targetNorm = normName(item.name)

      // Fuzzy match: exact normalised name against any language field
      const match = products.find(p =>
        normName(p.nameEn) === targetNorm ||
        normName(p.nameAr) === targetNorm ||
        normName(p.nameFr) === targetNorm ||
        normName(p.nameEs) === targetNorm
      )

      if (match) {
        if (Math.abs(match.price - item.price) < 0.01) {
          stats.unchanged++
          continue
        }
        // Price changed — update
        await prisma.product.update({
          where: { id: match.id },
          data:  { price: item.price },
        })
        logger.info({ msg: 'pos-sync: price updated', name: item.name, old: match.price, new: item.price })
        stats.updated++
      } else {
        // New item detected — create as draft so admin can review before publishing
        if (!defaultCategoryId) {
          // Ensure "POS Sync" category exists
          const existing = await prisma.category.findFirst({
            where: { cafeId, nameEn: 'POS Sync' },
          })
          if (existing) {
            defaultCategoryId = existing.id
          } else {
            const created = await prisma.category.create({
              data: {
                cafe:   { connect: { id: cafeId } },
                nameAr: 'مزامنة POS',
                nameEn: 'POS Sync',
                nameFr: 'Sync POS',
                nameEs: 'Sync POS',
                order:  999,
              },
            })
            defaultCategoryId = created.id
          }
        }

        await prisma.product.create({
          data: {
            categoryId: defaultCategoryId,
            nameEn:     item.name,
            nameAr:     item.name,
            nameFr:     item.name,
            nameEs:     item.name,
            price:      item.price,
            status:     'draft',        // admin must review & publish
            isAvailable: false,
          },
        })
        logger.info({ msg: 'pos-sync: new draft product', name: item.name, price: item.price })
        stats.created++
      }
    }

    logger.info({ msg: 'pos-sync complete', source, wasOffline, stats })
    return res.json({ ok: true, ...stats })

  } catch (err: any) {
    logger.error({ msg: 'sync-menu error', err: err?.message })
    return res.status(500).json({ error: err?.message ?? 'Sync failed' })
  }
})

export default router
