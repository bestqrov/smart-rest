# Premium Pricing System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Premium subscription tier (flat monthly fee, no commission) with per-country pricing controlled by the superadmin in real-time.

**Architecture:** New `PremiumPlan` MongoDB collection stores one doc per country/region. Cafe model gets `isPremium` flag. `applyOrderFee` skips commission for premium cafes. Superadmin UI gets a new "Premium Plans" section. Landing page shows a Premium card alongside the existing commission table.

**Tech Stack:** Prisma (MongoDB), Express, Next.js App Router, React, TypeScript

---

## File Map

| File | Action | What changes |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `PremiumPlan` model + `isPremium` to `Cafe` |
| `prisma/seed.ts` | Modify | Seed 5 default PremiumPlan rows |
| `src/routes/superadmin.ts` | Modify | Add GET + PUT `/api/superadmin/premium-plans` routes |
| `src/services/billing.ts` | Modify | Skip commission if `cafe.isPremium && plan.hasNoCommission` |
| `app/superadmin/page.tsx` | Modify | Add "Premium Plans" management section |
| `app/landing/page.tsx` | Modify | Add premium price to each MARKETS entry + Premium card in UI |

---

## Task 1 — Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `isPremium` to Cafe model**

Find the `Cafe` model (around line 185) and add after `billingStatus`:
```prisma
isPremium           Boolean       @default(false)
```

- [ ] **Step 2: Add PremiumPlan model at the end of schema.prisma**

```prisma
// ─── Premium Subscription Plans ───────────────────────────────────────────────
// One document per country/region. Superadmin can update prices and feature flags at runtime.

model PremiumPlan {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  country      String   @unique  // "MA" | "SN" | "SA" | "AE" | "EU"
  currency     String            // "MAD" | "XOF" | "SAR" | "AED" | "EUR"
  monthlyPrice Float             // 199 | 13000 | 159

  hasMarketing     Boolean @default(true)  // video marketing feature
  hasCertification Boolean @default(true)  // certification badge
  hasAnalytics     Boolean @default(true)  // advanced analytics
  hasNoCommission  Boolean @default(true)  // skip per-order commission

  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```
Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add PremiumPlan model and isPremium flag on Cafe"
```

---

## Task 2 — Seed Initial Premium Plans

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add seedPremiumPlans function**

Add before the final `main()` call at the bottom of `seed.ts`:

```ts
async function seedPremiumPlans() {
  const plans = [
    { country: 'MA', currency: 'MAD', monthlyPrice: 199  },
    { country: 'SN', currency: 'XOF', monthlyPrice: 13000 },
    { country: 'SA', currency: 'SAR', monthlyPrice: 159  },
    { country: 'AE', currency: 'AED', monthlyPrice: 159  },
    { country: 'EU', currency: 'EUR', monthlyPrice: 159  },
  ]
  for (const plan of plans) {
    await prisma.premiumPlan.upsert({
      where:  { country: plan.country },
      update: {},
      create: { ...plan, hasMarketing: true, hasCertification: true, hasAnalytics: true, hasNoCommission: true },
    })
  }
  console.log('✅ PremiumPlans seeded')
}
```

- [ ] **Step 2: Call it inside main()**

In the `main()` function, add:
```ts
await seedPremiumPlans()
```

- [ ] **Step 3: Run seed to verify**

```bash
npx ts-node prisma/seed.ts
```
Expected output includes: `✅ PremiumPlans seeded`

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): seed default PremiumPlan for MA/SN/SA/AE/EU"
```

---

## Task 3 — Backend API Routes

**Files:**
- Modify: `src/routes/superadmin.ts`

- [ ] **Step 1: Add GET /api/superadmin/premium-plans**

Add at the end of `superadmin.ts` (before `export default router`):

```ts
// ─── GET /api/superadmin/premium-plans ────────────────────────────────────────
router.get('/api/superadmin/premium-plans', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.premiumPlan.findMany({ orderBy: { country: 'asc' } })
    return res.json({ plans })
  } catch (err) {
    logger.error({ msg: 'premium-plans GET error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})
```

- [ ] **Step 2: Add PUT /api/superadmin/premium-plans/:country**

```ts
// ─── PUT /api/superadmin/premium-plans/:country ───────────────────────────────
router.put('/api/superadmin/premium-plans/:country', requireSuperAdmin, async (req: Request, res: Response) => {
  const { country } = req.params
  const { monthlyPrice, currency, hasMarketing, hasCertification, hasAnalytics, hasNoCommission } = req.body as {
    monthlyPrice?:     number
    currency?:         string
    hasMarketing?:     boolean
    hasCertification?: boolean
    hasAnalytics?:     boolean
    hasNoCommission?:  boolean
  }

  try {
    const plan = await prisma.premiumPlan.upsert({
      where:  { country },
      update: {
        ...(monthlyPrice     !== undefined ? { monthlyPrice }     : {}),
        ...(currency         !== undefined ? { currency }         : {}),
        ...(hasMarketing     !== undefined ? { hasMarketing }     : {}),
        ...(hasCertification !== undefined ? { hasCertification } : {}),
        ...(hasAnalytics     !== undefined ? { hasAnalytics }     : {}),
        ...(hasNoCommission  !== undefined ? { hasNoCommission }  : {}),
      },
      create: {
        country,
        currency:         currency         ?? 'MAD',
        monthlyPrice:     monthlyPrice     ?? 0,
        hasMarketing:     hasMarketing     ?? true,
        hasCertification: hasCertification ?? true,
        hasAnalytics:     hasAnalytics     ?? true,
        hasNoCommission:  hasNoCommission  ?? true,
      },
    })
    return res.json({ ok: true, plan })
  } catch (err) {
    logger.error({ msg: 'premium-plans PUT error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```
Expected: no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/superadmin.ts
git commit -m "feat(api): add GET/PUT /api/superadmin/premium-plans routes"
```

---

## Task 4 — Billing Logic: Skip Commission for Premium Cafes

**Files:**
- Modify: `src/services/billing.ts` (lines 277–315)

- [ ] **Step 1: Update applyOrderFee to skip commission for premium cafes**

In `applyOrderFee`, after the existing trial check (line 293 `if (cafe.trialEndsAt && ...)`), add a premium check.

First, update the `select` in the `cafe` query to include `isPremium` and `country`:

```ts
const cafe = await tx.cafe.findUnique({
  where:  { id: cafeId },
  select: { trialEndsAt: true, walletBalance: true, hasSocialShareAddon: true, isPremium: true, country: true }
})
```

Then after the trial check, add:

```ts
if (cafe.isPremium) {
  const plan = await tx.premiumPlan.findUnique({ where: { country: cafe.country } })
  if (plan?.hasNoCommission) return
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```
Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/services/billing.ts
git commit -m "feat(billing): skip commission for Premium cafes based on PremiumPlan.hasNoCommission"
```

---

## Task 5 — Superadmin UI: Premium Plans Section

**Files:**
- Modify: `app/superadmin/page.tsx`

- [ ] **Step 1: Add state and fetch for premium plans**

Near the top of the component where other state variables are declared, add:

```ts
const [premiumPlans, setPremiumPlans]   = useState<any[]>([])
const [editingPlan,  setEditingPlan]    = useState<any | null>(null)
```

Add a fetch inside the `useEffect` that loads superadmin data:

```ts
const r3 = await fetch('/api/superadmin/premium-plans', {
  headers: { 'x-superadmin-secret': secret, 'x-superadmin-email': email }
})
if (r3.ok) {
  const d3 = await r3.json()
  setPremiumPlans(d3.plans ?? [])
}
```

- [ ] **Step 2: Add savePlan helper**

```ts
async function savePlan(country: string, patch: Record<string, any>) {
  await fetch(`/api/superadmin/premium-plans/${country}`, {
    method:  'PUT',
    headers: {
      'Content-Type':       'application/json',
      'x-superadmin-secret': secret,
      'x-superadmin-email':  email,
    },
    body: JSON.stringify(patch),
  })
  // Refresh list
  const r = await fetch('/api/superadmin/premium-plans', {
    headers: { 'x-superadmin-secret': secret, 'x-superadmin-email': email }
  })
  const d = await r.json()
  setPremiumPlans(d.plans ?? [])
  setEditingPlan(null)
}
```

- [ ] **Step 3: Add Premium Plans section to the JSX**

Find a good location in the superadmin JSX (after the billing section or tenants section) and add:

```tsx
{/* ── Premium Plans ──────────────────────────────────────────────── */}
<section className="mt-10">
  <h2 className="text-xl font-bold text-white mb-4">💎 Premium Plans</h2>
  <div className="overflow-x-auto rounded-xl border border-white/10">
    <table className="w-full text-sm text-white">
      <thead className="bg-white/5 text-gray-400">
        <tr>
          <th className="px-4 py-3 text-left">Country</th>
          <th className="px-4 py-3 text-left">Price / Month</th>
          <th className="px-4 py-3 text-center">No Commission</th>
          <th className="px-4 py-3 text-center">Marketing</th>
          <th className="px-4 py-3 text-center">Certification</th>
          <th className="px-4 py-3 text-center">Analytics</th>
          <th className="px-4 py-3 text-center">Actions</th>
        </tr>
      </thead>
      <tbody>
        {premiumPlans.map((plan) => (
          <tr key={plan.country} className="border-t border-white/5 hover:bg-white/5">
            <td className="px-4 py-3 font-mono font-bold">{plan.country}</td>
            <td className="px-4 py-3">
              {editingPlan?.country === plan.country ? (
                <input
                  type="number"
                  defaultValue={plan.monthlyPrice}
                  className="bg-white/10 rounded px-2 py-1 w-28 text-white"
                  onChange={e => setEditingPlan({ ...editingPlan, monthlyPrice: Number(e.target.value) })}
                />
              ) : (
                <span className="font-bold text-green-400">{plan.monthlyPrice} {plan.currency}</span>
              )}
            </td>
            {(['hasNoCommission', 'hasMarketing', 'hasCertification', 'hasAnalytics'] as const).map(key => (
              <td key={key} className="px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={editingPlan?.country === plan.country ? editingPlan[key] : plan[key]}
                  onChange={e => {
                    if (editingPlan?.country === plan.country) {
                      setEditingPlan({ ...editingPlan, [key]: e.target.checked })
                    } else {
                      savePlan(plan.country, { [key]: e.target.checked })
                    }
                  }}
                  className="w-4 h-4 accent-green-400"
                />
              </td>
            ))}
            <td className="px-4 py-3 text-center">
              {editingPlan?.country === plan.country ? (
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => savePlan(plan.country, { monthlyPrice: editingPlan.monthlyPrice })}
                    className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs"
                  >Save</button>
                  <button
                    onClick={() => setEditingPlan(null)}
                    className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs"
                  >Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingPlan({ ...plan })}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs"
                >Edit</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```
Expected: no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add app/superadmin/page.tsx
git commit -m "feat(superadmin): add Premium Plans management table"
```

---

## Task 6 — Landing Page: Show Premium Price per Country

**Files:**
- Modify: `app/landing/page.tsx`

- [ ] **Step 1: Add premium price to MARKETS array**

Update each entry in the `MARKETS` array (around line 519) to include a `premium` field:

```ts
// Morocco
{ ..., premium: { price: '199', currency: 'MAD', label: '199 MAD / mois' } },

// Saudi Arabia  
{ ..., premium: { price: '159', currency: 'SAR', label: '159 SAR / month' } },

// UAE
{ ..., premium: { price: '159', currency: 'AED', label: '159 AED / month' } },

// North Africa (DZ/TN/EG) — no premium plan yet, set null
{ ..., premium: null },

// Europe
{ ..., premium: { price: '159', currency: 'EUR', label: '159 € / mois' } },
```

Also add a West Africa entry OR update the North Africa entry to include XOF:
```ts
// Add after Europe, or merge with Africa section:
{
  flag: '🇸🇳🇨🇮🇧🇫', currency: 'XOF',
  en: { country: 'West Africa', cities: 'Dakar · Abidjan · Ouagadougou · Bamako' },
  fr: { country: 'Afrique de l\'Ouest', cities: 'Dakar · Abidjan · Ouagadougou · Bamako' },
  ar: { country: 'غرب أفريقيا', cities: 'داكار · أبيدجان · واغادوغو · باماكو' },
  color: 'from-yellow-700 to-yellow-900',
  pricing: [
    { en: 'Under 2,000 XOF', fr: 'Moins de 2 000 XOF', ar: 'أقل من 2000 فرنك', fee: '50 XOF' },
    { en: '2,000 — 5,000',   fr: '2 000 — 5 000',       ar: '2000 — 5000',      fee: '200 XOF' },
    { en: 'Over 5,000 XOF',  fr: 'Plus de 5 000 XOF',   ar: 'أكثر من 5000',    fee: '500 XOF' },
  ],
  note: { en: '−5% if order has 2+ items', fr: '−5% dès 2 articles', ar: 'خصم 5% عند طلب منتجين أو أكثر' },
  premium: { price: '13 000', currency: 'XOF', label: '13 000 XOF / mois' },
}
```

- [ ] **Step 2: Add Premium badge to each market card in the JSX**

Find where MARKETS are rendered (around line 1535+). Inside each market card, after the commission pricing table, add:

```tsx
{market.premium && (
  <div className="mt-3 rounded-lg bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border border-yellow-500/30 px-4 py-3 flex items-center justify-between">
    <div>
      <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">💎 Premium</span>
      <p className="text-white font-bold text-lg mt-0.5">{market.premium.label}</p>
      <p className="text-gray-400 text-xs">Pas de commission · Toutes les fonctionnalités</p>
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```
Expected: no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add app/landing/page.tsx
git commit -m "feat(landing): add Premium pricing card per market"
```

---

## Final Verification

- [ ] Run full build: `npm run build`
- [ ] Open superadmin at `/superadmin` — verify "Premium Plans" table visible with 5 rows
- [ ] Edit a price in superadmin — verify it saves and updates
- [ ] Open `/landing` — verify Premium badge appears on each market card
- [ ] Toggle a feature checkbox — verify it saves without needing Edit mode
