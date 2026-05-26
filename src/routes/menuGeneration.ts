/**
 * Smart Menu Generation Engine
 *
 * POST /api/admin/menu-gen/from-url      — scrape a website URL
 * POST /api/admin/menu-gen/from-images   — Gemini Vision on base64 images
 * POST /api/admin/menu-gen/from-file     — parse uploaded xlsx/pdf/docx
 * POST /api/admin/menu-gen/enhance       — AI descriptions, calories, tags
 * POST /api/admin/menu-gen/price-suggest — geo-aware price estimation
 * POST /api/admin/menu-gen/publish-draft — save draft products to DB
 * PATCH /api/admin/cafe/tier-upgrade     — upgrade CAFE → RESTAURANT
 */

import express, { Request, Response } from 'express'
import multer from 'multer'
import * as cheerio from 'cheerio'
import * as https from 'https'
import * as http from 'http'
import Groq from 'groq-sdk'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

function getGroq() {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  return new Groq({ apiKey: key })
}

async function aiGenerate(prompt: string): Promise<string> {
  try {
    const groq = getGroq()
    const res  = await groq.chat.completions.create({
      model:    'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })
    return res.choices[0]?.message?.content ?? ''
  } catch (err: any) {
    const is429 = err?.status === 429 || err?.message?.includes('429')
    if (is429) throw Object.assign(new Error('AI_QUOTA_EXCEEDED'), { status: 429 })
    throw err
  }
}

// ── PATCH /api/admin/cafe/tier-upgrade ───────────────────────────────────────

router.patch('/api/admin/cafe/tier-upgrade', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    await prisma.cafe.update({ where: { id: cafeId }, data: { tier: 'RESTAURANT' } })
    return res.json({ ok: true, tier: 'RESTAURANT' })
  } catch (err) {
    logger.error({ msg: 'tier-upgrade error', err })
    return res.status(500).json({ error: 'Upgrade failed' })
  }
})

// ── GET /api/admin/cafe/tier ──────────────────────────────────────────────────

router.get('/api/admin/cafe/tier', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe   = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { tier: true, country: true, currency: true, name: true } })
    return res.json(cafe)
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ── helpers ───────────────────────────────────────────────────────────────────

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod  = url.startsWith('https') ? https : http
    const req  = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 SmartRestoBot/1.0' } }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', c => { body += c })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchUrl(res.headers.location as string).then(resolve).catch(reject)
        } else {
          resolve(body)
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

interface RawItem { nameAr: string; nameEn: string; nameFr: string; nameEs: string; price: number; category: string; description?: string }

function parseAiJson(text: string): any {
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  try { return JSON.parse(match ? match[1] ?? match[0] : text.trim()) } catch { return null }
}

// ── POST /api/admin/menu-gen/from-url ────────────────────────────────────────

router.post('/api/admin/menu-gen/from-url', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { url } = req.body as { url?: string }
    if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'Invalid URL' })

    const html = await fetchUrl(url)
    const $    = cheerio.load(html)
    $('script, style, nav, footer, header').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000)

    const prompt = `
You are a menu extraction AI. From this restaurant webpage text, extract ALL menu items.
Return ONLY a valid JSON array with no extra text. Each item must have exactly these fields:
{"nameAr":"...","nameEn":"...","nameFr":"...","nameEs":"...","price":0,"category":"...", "description":""}

Rules:
- Translate names to all 4 languages (ar/en/fr/es) using the context
- price is a number (0 if not found)
- category: group by type (Drinks, Main Dishes, Starters, Desserts, etc.)
- Keep descriptions concise (1 sentence max)

Webpage text:
${text}
`
    const text2  = await aiGenerate(prompt)
    const parsed = parseAiJson(text2)
    if (!parsed) return res.status(422).json({ error: 'Could not parse menu from this URL', raw: text2.slice(0, 500) })
    return res.json({ items: Array.isArray(parsed) ? parsed : parsed.items ?? [] })
  } catch (err: any) {
    logger.error({ msg: 'menu-gen from-url error', err })
    const status = (err as any).status === 429 ? 429 : 500
    return res.status(status).json({ error: status === 429 ? 'AI quota exceeded — please try again later or enable billing at console.groq.com' : (err?.message ?? 'Failed to scrape URL') })
  }
})

// ── POST /api/admin/menu-gen/from-images ─────────────────────────────────────

router.post('/api/admin/menu-gen/from-images', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { images } = req.body as { images?: { data: string; mimeType: string }[] }
    if (!images?.length) return res.status(400).json({ error: 'No images provided' })

    // Groq uses vision via llama-3.2-90b-vision — send images as image_url content parts
    const groq = getGroq()
    const imageContent = images.map(img => ({
      type: 'image_url' as const,
      image_url: { url: `data:${img.mimeType};base64,${img.data}` }
    }))

    const res2 = await groq.chat.completions.create({
      model: 'llama-3.2-90b-vision-preview',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `You are a menu OCR AI. Extract ALL menu items from these menu images.
Return ONLY a valid JSON array. Each item: {"nameAr":"","nameEn":"","nameFr":"","nameEs":"","price":0,"category":"","description":""}
- Translate names to all 4 languages
- price is numeric (0 if unreadable)
- Group by category (Drinks, Starters, Main Dishes, Desserts…)
JSON array only, no extra text:` },
          ...imageContent
        ]
      }],
      temperature: 0.3,
    })

    const text2  = res2.choices[0]?.message?.content ?? ''
    const parsed = parseAiJson(text2)
    if (!parsed) return res.status(422).json({ error: 'Could not extract menu from images', raw: text2.slice(0, 500) })
    return res.json({ items: Array.isArray(parsed) ? parsed : parsed.items ?? [] })
  } catch (err: any) {
    logger.error({ msg: 'menu-gen from-images error', err })
    const status = (err as any).status === 429 ? 429 : 500
    return res.status(status).json({ error: status === 429 ? 'AI quota exceeded — please try again later' : (err?.message ?? 'Vision AI failed') })
  }
})

// ── POST /api/admin/menu-gen/from-file ───────────────────────────────────────

router.post('/api/admin/menu-gen/from-file', authorizeAdmin, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    let text = ''
    const mime = req.file.mimetype
    const buf  = req.file.buffer

    if (mime === 'application/pdf' || req.file.originalname.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buf)
      text = data.text
    } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            || req.file.originalname.endsWith('.docx')) {
      const mammoth = require('mammoth')
      const r = await mammoth.extractRawText({ buffer: buf })
      text = r.value
    } else if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            || mime === 'application/vnd.ms-excel'
            || req.file.originalname.endsWith('.xlsx')
            || req.file.originalname.endsWith('.xls')) {
      const XLSX = require('xlsx')
      const wb   = XLSX.read(buf, { type: 'buffer' })
      const rows: string[][] = []
      wb.SheetNames.forEach((name: string) => {
        const ws   = wb.Sheets[name]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
        rows.push(...data)
      })
      text = rows.map(r => r.join('\t')).join('\n')
    } else {
      text = buf.toString('utf8')
    }

    if (!text.trim()) return res.status(422).json({ error: 'Could not extract text from file' })

    const prompt = `
You are a menu extraction AI. From this menu document text, extract ALL menu items.
Return ONLY a valid JSON array. Each item: {"nameAr":"","nameEn":"","nameFr":"","nameEs":"","price":0,"category":"","description":""}
- Translate names to all 4 languages
- price is numeric (0 if missing)
- Group by category

Document text (first 6000 chars):
${text.slice(0, 6000)}
`
    const text2  = await aiGenerate(prompt)
    const parsed = parseAiJson(text2)
    if (!parsed) return res.status(422).json({ error: 'Could not parse menu from file', raw: text2.slice(0, 500) })
    return res.json({ items: Array.isArray(parsed) ? parsed : parsed.items ?? [] })
  } catch (err: any) {
    logger.error({ msg: 'menu-gen from-file error', err })
    const status = (err as any).status === 429 ? 429 : 500
    return res.status(status).json({ error: status === 429 ? 'AI quota exceeded — please try again later or enable billing at console.groq.com' : (err?.message ?? 'File parse failed') })
  }
})

// ── POST /api/admin/menu-gen/enhance ─────────────────────────────────────────

router.post('/api/admin/menu-gen/enhance', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { items, country, currency } = req.body as { items: RawItem[]; country?: string; currency?: string }
    if (!items?.length) return res.status(400).json({ error: 'items required' })

    const prompt = `
You are a restaurant menu AI assistant. Enhance these menu items for a restaurant in ${country ?? 'Morocco'} (currency: ${currency ?? 'MAD'}).

For each item, return enhanced JSON with these EXACT fields:
{
  "nameAr": "...",  "nameEn": "...",  "nameFr": "...",  "nameEs": "...",
  "price": 0,
  "category": "...",
  "descriptionAr": "وصف شهي قصير",
  "descriptionEn": "short appetizing description",
  "descriptionFr": "description courte et appétissante",
  "descriptionEs": "descripción corta y apetitosa",
  "calories": 0,
  "tags": ["vegetarian"|"spicy"|"popular"|"new"|"halal"|"cold"|"hot"|"sweet"]
}

Rules:
- descriptions: 1–2 sentences max, appetizing and culturally appropriate
- calories: realistic estimate (integer Kcal, 0 if drink with no calories)
- tags: 0–3 relevant tags from the allowed list only
- Keep existing prices if non-zero; if price is 0, estimate a realistic price in ${currency ?? 'MAD'} for ${country ?? 'Morocco'}

Input items:
${JSON.stringify(items.slice(0, 50), null, 0)}

Return ONLY a JSON array, no extra text.
`
    const text2  = await aiGenerate(prompt)
    const parsed = parseAiJson(text2)
    if (!parsed) return res.status(422).json({ error: 'AI enhancement failed', raw: text2.slice(0, 500) })
    return res.json({ items: Array.isArray(parsed) ? parsed : parsed.items ?? [] })
  } catch (err: any) {
    logger.error({ msg: 'menu-gen enhance error', err })
    const status = (err as any).status === 429 ? 429 : 500
    return res.status(status).json({ error: status === 429 ? 'AI quota exceeded — please try again later or enable billing at console.groq.com' : (err?.message ?? 'Enhancement failed') })
  }
})

// ── POST /api/admin/menu-gen/price-suggest ────────────────────────────────────

router.post('/api/admin/menu-gen/price-suggest', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { items, country, currency, city } = req.body as { items: { nameEn: string; nameAr: string; category: string }[]; country?: string; currency?: string; city?: string }
    if (!items?.length) return res.status(400).json({ error: 'items required' })

    const prompt = `
You are a restaurant pricing expert. Suggest realistic menu prices for items served in a restaurant/cafe located in:
- City: ${city ?? 'unknown'}
- Country: ${country ?? 'Morocco'}
- Currency: ${currency ?? 'MAD'}

Base prices on typical mid-range cafe/restaurant market rates in that location.

Items to price:
${items.map((it, i) => `${i + 1}. ${it.nameEn ?? it.nameAr} (${it.category})`).join('\n')}

Return ONLY a JSON array with one object per item: [{"index":0,"price":25.0}, ...]
Prices must be realistic for that market. No extra text.
`
    const text2  = await aiGenerate(prompt)
    const parsed = parseAiJson(text2)
    if (!parsed) return res.status(422).json({ error: 'Price suggestion failed' })
    return res.json({ prices: Array.isArray(parsed) ? parsed : [] })
  } catch (err: any) {
    const status = (err as any).status === 429 ? 429 : 500
    return res.status(status).json({ error: status === 429 ? 'AI quota exceeded — please try again later or enable billing at console.groq.com' : (err?.message ?? 'Price suggestion failed') })
  }
})

// ── POST /api/admin/menu-gen/publish-draft ────────────────────────────────────

router.post('/api/admin/menu-gen/publish-draft', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { items, publishNow, mode = 'add' } = req.body as {
      items: {
        nameAr: string; nameEn: string; nameFr?: string; nameEs?: string
        descriptionAr?: string; descriptionEn?: string; descriptionFr?: string; descriptionEs?: string
        price: number; calories?: number; tags?: string[]; category: string; imageUrl?: string
      }[]
      publishNow?: boolean
      mode?: 'add' | 'replace'
    }
    if (!items?.length) return res.status(400).json({ error: 'items required' })

    const status = publishNow ? 'published' : 'draft'

    // Replace mode: wipe existing menu first
    if (mode === 'replace') {
      const oldCats = await prisma.category.findMany({ where: { cafeId }, select: { id: true } })
      if (oldCats.length) {
        await prisma.product.deleteMany({ where: { categoryId: { in: oldCats.map(c => c.id) } } })
        await prisma.category.deleteMany({ where: { cafeId } })
      }
    }

    // Group by category — create categories that don't exist yet
    const categoryNames = [...new Set(items.map(i => i.category.trim()).filter(Boolean))]
    const existingCats  = await prisma.category.findMany({ where: { cafeId }, select: { id: true, nameEn: true, order: true } })
    const maxOrder      = existingCats.reduce((m, c) => Math.max(m, c.order), -1)
    const catMap: Record<string, string> = {}
    let orderOffset = maxOrder + 1

    for (const catName of categoryNames) {
      const existing = existingCats.find(c => c.nameEn.toLowerCase() === catName.toLowerCase())
      if (existing) {
        catMap[catName] = existing.id
      } else {
        const created = await prisma.category.create({
          data: { cafeId, nameAr: catName, nameEn: catName, nameFr: catName, nameEs: catName, order: orderOffset++ }
        })
        catMap[catName] = created.id
      }
    }

    // Create products
    const created = await Promise.all(items.map(item => {
      const catId = catMap[item.category.trim()] ?? Object.values(catMap)[0]
      return prisma.product.create({
        data: {
          categoryId:    catId,
          nameAr:        item.nameAr,
          nameEn:        item.nameEn,
          nameFr:        item.nameFr ?? item.nameEn,
          nameEs:        item.nameEs ?? item.nameEn,
          description:   item.descriptionEn ?? '',
          price:         Number(item.price) || 0,
          calories:      item.calories ?? null,
          tags:          item.tags ?? [],
          status,
          isAvailable:   true,
          imageUrl:      item.imageUrl ?? null,
          commissionRate: 0,
        }
      })
    }))

    return res.json({ ok: true, created: created.length, status })
  } catch (err: any) {
    logger.error({ msg: 'publish-draft error', err })
    return res.status(500).json({ error: err?.message ?? 'Publish failed' })
  }
})

export default router
