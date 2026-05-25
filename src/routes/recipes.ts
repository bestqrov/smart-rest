/**
 * Recipes & Smart Costing
 *
 * GET    /api/v1/recipes                    list all recipes for the cafe
 * GET    /api/v1/recipes/:productId         get one recipe
 * PUT    /api/v1/recipes/:productId         upsert recipe (create or update)
 * DELETE /api/v1/recipes/:productId         reset to Standard mode
 * POST   /api/v1/recipes/ai-suggest         Groq → suggested ingredients JSON
 */

import express, { Request, Response } from 'express'
import Groq from 'groq-sdk'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

function getGroq() {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  return new Groq({ apiKey: key })
}

function parseJson(text: string): unknown {
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  try { return JSON.parse(match ? (match[1] ?? match[0]) : text.trim()) } catch { return null }
}

function calcCost(ingredients: { quantityGramsOrMl: number; costPerUnit: number }[]): number {
  return ingredients.reduce((sum, i) => sum + i.quantityGramsOrMl * i.costPerUnit, 0)
}

// ─── GET /api/v1/recipes ──────────────────────────────────────────────────────

router.get('/api/v1/recipes', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId  = req.admin!.cafeId
    const recipes = await prisma.recipe.findMany({
      where:   { cafeId },
      include: { product: { select: { nameEn: true, nameAr: true, price: true } } },
      orderBy: { updatedAt: 'desc' }
    })
    return res.json(recipes)
  } catch (err) {
    logger.error({ msg: 'GET /api/v1/recipes error', err })
    return res.status(500).json({ error: 'Failed to fetch recipes' })
  }
})

// ─── GET /api/v1/recipes/:productId ──────────────────────────────────────────

router.get('/api/v1/recipes/:productId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId    = req.admin!.cafeId
    const productId = req.params.productId as string

    const recipe = await prisma.recipe.findFirst({
      where:   { cafeId, productId },
      include: { product: { select: { nameEn: true, nameAr: true, price: true } } }
    })
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
    return res.json(recipe)
  } catch (err) {
    logger.error({ msg: 'GET /api/v1/recipes/:productId error', err })
    return res.status(500).json({ error: 'Failed to fetch recipe' })
  }
})

// ─── PUT /api/v1/recipes/:productId — upsert ─────────────────────────────────

router.put('/api/v1/recipes/:productId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId    = req.admin!.cafeId
    const productId = req.params.productId as string
    const { costingMode = 'Standard', ingredients = [] } = req.body as {
      costingMode?: string
      ingredients?: { ingredientName: string; quantityGramsOrMl: number; costPerUnit: number }[]
    }

    // Verify product belongs to this cafe
    const product = await prisma.product.findFirst({
      where:  { id: productId, category: { cafeId } },
      select: { id: true, price: true }
    })
    if (!product) return res.status(404).json({ error: 'Product not found' })

    if (!['Standard', 'Smart_Costing'].includes(costingMode)) {
      return res.status(400).json({ error: 'costingMode must be Standard or Smart_Costing' })
    }

    const calculatedCost = calcCost(ingredients)
    const profitMargin   = product.price - calculatedCost

    const recipe = await prisma.recipe.upsert({
      where:  { productId },
      create: { cafeId, productId, costingMode, ingredients, calculatedCost, profitMargin },
      update: { costingMode, ingredients, calculatedCost, profitMargin },
    })

    return res.json(recipe)
  } catch (err) {
    logger.error({ msg: 'PUT /api/v1/recipes/:productId error', err })
    return res.status(500).json({ error: 'Failed to save recipe' })
  }
})

// ─── DELETE /api/v1/recipes/:productId ───────────────────────────────────────

router.delete('/api/v1/recipes/:productId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId    = req.admin!.cafeId
    const productId = req.params.productId as string

    const existing = await prisma.recipe.findFirst({ where: { cafeId, productId } })
    if (!existing) return res.status(404).json({ error: 'Recipe not found' })

    await prisma.recipe.delete({ where: { id: existing.id } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'DELETE /api/v1/recipes/:productId error', err })
    return res.status(500).json({ error: 'Failed to delete recipe' })
  }
})

// ─── POST /api/v1/recipes/ai-suggest ─────────────────────────────────────────
// Body: { productName, country?, currency? }
// Returns: { ingredients: [{ ingredientName, quantityGramsOrMl, costPerUnit, unit }] }

router.post('/api/v1/recipes/ai-suggest', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { productName, country, currency } = req.body as {
      productName?: string
      country?:     string
      currency?:    string
    }
    if (!productName?.trim()) {
      return res.status(400).json({ error: 'productName is required' })
    }

    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { country: true, currency: true }
    })
    const ctx      = country  ?? cafe?.country  ?? 'MA'
    const curr     = currency ?? cafe?.currency ?? 'MAD'
    const region   = ['SA','AE','KW','QA','BH','OM'].includes(ctx) ? 'Gulf (Saudi/UAE)' : 'Morocco/North Africa'

    const prompt = `
You are a professional restaurant cost analyst specialising in ${region} cuisine.

For the dish/drink: "${productName}"

Return ONLY a valid JSON array — no markdown, no commentary.
Each element must be:
{
  "ingredientName": "...",
  "quantityGramsOrMl": <number>,
  "unit": "g" | "ml" | "pcs",
  "costPerUnit": <cost in ${curr} per gram or ml or piece>,
  "totalCost": <quantityGramsOrMl * costPerUnit>
}

Rules:
- Use realistic local market prices for ${region} (${curr})
- quantityGramsOrMl is in grams for solids, ml for liquids, count for pcs
- Include all key ingredients (5–12 items)
- Do NOT include labour, energy, or overhead costs
- Return nothing else — just the JSON array`

    const groq = getGroq()
    const res2 = await groq.chat.completions.create({
      model:       'llama-3.3-70b-versatile',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.2,
    })

    const raw         = res2.choices[0]?.message?.content ?? ''
    const ingredients = parseJson(raw)

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(502).json({ error: 'AI returned unexpected format', raw })
    }

    const calculatedCost = (ingredients as { totalCost?: number }[])
      .reduce((s, i) => s + (i.totalCost ?? 0), 0)

    return res.json({ ingredients, calculatedCost })

  } catch (err) {
    logger.error({ msg: 'POST /api/v1/recipes/ai-suggest error', err })
    return res.status(500).json({ error: 'AI suggest failed' })
  }
})

export default router
