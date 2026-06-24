# SuperAdmin — Plan 3: Lead Scraper + Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Future Clients" section to the superadmin dashboard — scrape restaurant leads from Google Places, track them in a kanban-style pipeline, and show a conversion analytics report.

**Architecture:** New `Lead` Prisma model (check if already exists — extend it). New Express routes for Places search + CRUD. New React components: `LeadScraper`, `LeadPipeline`, `LeadCard`, `LeadAnalytics`. Accessed via a "Future Clients" tab inside the superadmin themes.

**Tech Stack:** Next.js 14, Express.js (`src/routes/superadmin.ts`), Prisma (MongoDB), Google Places Text Search API + Place Details API, Tailwind CSS

**Pre-requisite:** Plans 1 + 2 complete. `GOOGLE_PLACES_API_KEY` env var added to `.env`.

---

## File Map

**Create:**
- `app/superadmin/components/leads/LeadScraper.tsx` — city + type search, displays raw results
- `app/superadmin/components/leads/LeadCard.tsx` — single lead card with status dropdown
- `app/superadmin/components/leads/LeadPipeline.tsx` — kanban column view grouped by status
- `app/superadmin/components/leads/LeadAnalytics.tsx` — conversion funnel + top cities chart

**Modify:**
- `prisma/schema.prisma` — extend or create `Lead` model + `LeadStatus` enum
- `src/routes/superadmin.ts` — add leads search + CRUD routes
- `.env` — add `GOOGLE_PLACES_API_KEY`
- `app/superadmin/components/themes/ThemeA.tsx` — add "Future Clients" tab/section
- `app/superadmin/components/themes/ThemeB.tsx` — same
- `app/superadmin/components/themes/ThemeC.tsx` — same

---

## Task 1 — Prisma: Lead Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] Check if the `Lead` model already exists:

```bash
grep -n "model Lead" prisma/schema.prisma
```

**Case A — Lead model does NOT exist:** Add it:

```prisma
enum LeadStatus {
  NEW
  CONTACTED
  INTERESTED
  CLIENT
  REJECTED
}

model Lead {
  id          String     @id @default(auto()) @map("_id") @db.ObjectId
  businessName String
  address     String?
  phone       String?
  rating      Float?
  reviewCount Int?
  placeId     String?    @unique
  city        String
  country     String     @default("MA")
  status      LeadStatus @default(NEW)
  notes       String?
  lastContact DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}
```

**Case B — Lead model already exists:** Check if it has `placeId` and `reviewCount` fields:

```bash
grep -A 25 "model Lead" prisma/schema.prisma
```

If `placeId` is missing, add it:

```prisma
  placeId     String?    @unique
  reviewCount Int?
```

If `status` is a plain `String` (not enum), change it:

```prisma
  // Change:
  status      String    @default("NEW")
  // To:
  status      LeadStatus @default(NEW)
```

And add the `LeadStatus` enum before the model if it doesn't exist:

```prisma
enum LeadStatus { NEW CONTACTED INTERESTED CLIENT REJECTED }
```

- [ ] Run Prisma generate:

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] Commit:

```bash
git add prisma/schema.prisma
git commit -m "feat(leads): extend Lead model with placeId, reviewCount, LeadStatus enum"
```

---

## Task 2 — Environment: Add Google Places Key

- [ ] Ask the user for a Google Places API key if not already in `.env`.
  The key needs the **Places API (New)** or **Places API** enabled in Google Cloud Console.

- [ ] Add to `.env`:

```env
GOOGLE_PLACES_API_KEY=your_key_here
```

- [ ] Verify the key works:

```bash
KEY=$(grep GOOGLE_PLACES_API_KEY .env | cut -d= -f2)
curl -s "https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurant+Agadir+Morocco&key=$KEY" | head -c 300
# Expected: JSON starting with { "results": [ ...
```

If the response contains `"status": "REQUEST_DENIED"` or `"INVALID_REQUEST"`, the key is invalid — double-check Google Cloud Console.

---

## Task 3 — Backend: Lead Routes

**Files:**
- Modify: `src/routes/superadmin.ts`

- [ ] Add all lead routes to `src/routes/superadmin.ts` **before** `export default router`:

```typescript
// ─── POST /api/superadmin/leads/search ────────────────────────────────────────
// Queries Google Places and returns results WITHOUT saving to DB.
// Frontend then lets superadmin choose which ones to add to pipeline.
router.post('/api/superadmin/leads/search', requireSuperAdmin, async (req: Request, res: Response) => {
  const { city, type } = req.body
  if (!city || !type) return res.status(400).json({ error: 'city + type required' })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY not set' })

  try {
    const query     = encodeURIComponent(`${type} ${city} Morocco`)
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=ar&key=${apiKey}`
    const searchRes = await fetch(searchUrl)
    const searchData: any = await searchRes.json()

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      return res.status(502).json({ error: `Google Places error: ${searchData.status}` })
    }

    const results = (searchData.results ?? []).slice(0, 20).map((p: any) => ({
      placeId:     p.place_id,
      businessName: p.name,
      address:     p.formatted_address,
      rating:      p.rating ?? null,
      reviewCount: p.user_ratings_total ?? null,
      city,
      country:     'MA',
    }))

    return res.json(results)
  } catch (err) {
    logger.error({ msg: 'POST leads/search error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── GET /api/superadmin/leads ────────────────────────────────────────────────
router.get('/api/superadmin/leads', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { status, city } = req.query
    const where: any = {}
    if (status) where.status = status
    if (city)   where.city = { contains: city as string, mode: 'insensitive' }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return res.json(leads)
  } catch (err) {
    logger.error({ msg: 'GET leads error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── POST /api/superadmin/leads ───────────────────────────────────────────────
router.post('/api/superadmin/leads', requireSuperAdmin, async (req: Request, res: Response) => {
  const { businessName, address, phone, rating, reviewCount, placeId, city, country } = req.body
  if (!businessName || !city) return res.status(400).json({ error: 'businessName + city required' })
  try {
    const lead = await prisma.lead.upsert({
      where:  { placeId: placeId ?? `manual-${Date.now()}` },
      update: { businessName, address, phone, rating, reviewCount },
      create: { businessName, address, phone, rating, reviewCount, placeId: placeId ?? null, city, country: country ?? 'MA' },
    })
    return res.status(201).json(lead)
  } catch (err) {
    logger.error({ msg: 'POST leads error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── PATCH /api/superadmin/leads/:id ──────────────────────────────────────────
router.patch('/api/superadmin/leads/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  const { status, notes, phone, lastContact } = req.body
  try {
    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...(status      && { status }),
        ...(notes  !== undefined && { notes }),
        ...(phone       && { phone }),
        ...(lastContact && { lastContact: new Date(lastContact) }),
      },
    })
    return res.json(updated)
  } catch (err) {
    logger.error({ msg: 'PATCH lead error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── DELETE /api/superadmin/leads/:id ─────────────────────────────────────────
router.delete('/api/superadmin/leads/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'DELETE lead error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})
```

- [ ] Restart the backend:

```bash
npm run dev
```

- [ ] Verify lead search route:

```bash
SECRET=$(grep SUPERADMIN_SECRET .env | cut -d= -f2)
EMAIL=$(grep SUPERADMIN_EMAIL .env | cut -d= -f2)

curl -s -X POST "http://localhost:4000/api/superadmin/leads/search" \
  -H "x-superadmin-secret: $SECRET" -H "x-superadmin-email: $EMAIL" \
  -H "Content-Type: application/json" \
  -d '{"city":"Agadir","type":"restaurant"}'
# Expected: JSON array of up to 20 leads
```

- [ ] Commit:

```bash
git add src/routes/superadmin.ts
git commit -m "feat(leads): add Google Places search + leads CRUD routes"
```

---

## Task 4 — LeadCard Component

**Files:**
- Create: `app/superadmin/components/leads/LeadCard.tsx`

- [ ] Create the component:

```tsx
// app/superadmin/components/leads/LeadCard.tsx
'use client'
import { useState } from 'react'
import { Loader2, Phone, MapPin, Star, Trash2 } from 'lucide-react'

export type LeadStatus = 'NEW' | 'CONTACTED' | 'INTERESTED' | 'CLIENT' | 'REJECTED'

export interface Lead {
  id:           string
  businessName: string
  address:      string | null
  phone:        string | null
  rating:       number | null
  reviewCount:  number | null
  placeId:      string | null
  city:         string
  country:      string
  status:       LeadStatus
  notes:        string | null
  lastContact:  string | null
  createdAt:    string
}

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'NEW',        label: '🆕 جديد',     color: 'bg-sky-900/50 text-sky-300 border-sky-700' },
  { value: 'CONTACTED',  label: '📞 تواصلنا',   color: 'bg-amber-900/50 text-amber-300 border-amber-700' },
  { value: 'INTERESTED', label: '🤝 مهتم',      color: 'bg-violet-900/50 text-violet-300 border-violet-700' },
  { value: 'CLIENT',     label: '✅ عميل',       color: 'bg-emerald-900/50 text-emerald-300 border-emerald-700' },
  { value: 'REJECTED',   label: '❌ رفض',        color: 'bg-red-900/50 text-red-300 border-red-700' },
]

interface Props {
  lead:        Lead
  superHeader: () => Record<string, string>
  onUpdate:    (updated: Lead) => void
  onDelete:    (id: string) => void
}

export default function LeadCard({ lead, superHeader, onUpdate, onDelete }: Props) {
  const [editing,  setEditing]  = useState(false)
  const [notes,    setNotes]    = useState(lead.notes ?? '')
  const [phone,    setPhone]    = useState(lead.phone ?? '')
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  const badge = STATUS_OPTIONS.find(s => s.value === lead.status) ?? STATUS_OPTIONS[0]

  async function changeStatus(status: LeadStatus) {
    const res = await fetch(`/api/superadmin/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { ...superHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, lastContact: status !== 'NEW' ? new Date().toISOString() : undefined }),
    })
    if (res.ok) onUpdate({ ...lead, status })
  }

  async function saveNotes() {
    setSaving(true)
    const res = await fetch(`/api/superadmin/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { ...superHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, phone }),
    })
    if (res.ok) { onUpdate({ ...lead, notes, phone }); setEditing(false) }
    setSaving(false)
  }

  async function deleteLead() {
    setDeleting(true)
    const res = await fetch(`/api/superadmin/leads/${lead.id}`, {
      method: 'DELETE', headers: superHeader()
    })
    if (res.ok) onDelete(lead.id)
    else setDeleting(false)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3 hover:border-gray-700 transition-colors group" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white text-sm truncate">{lead.businessName}</p>
          {lead.address && <p className="text-gray-500 text-[11px] mt-0.5 truncate flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.address}</p>}
        </div>
        <button onClick={deleteLead} disabled={deleting}
          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all shrink-0">
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Rating */}
      {lead.rating && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400">
          <Star className="w-3 h-3 fill-amber-400" />
          <span className="font-bold">{lead.rating.toFixed(1)}</span>
          {lead.reviewCount && <span className="text-gray-600">({lead.reviewCount})</span>}
        </div>
      )}

      {/* Phone */}
      {lead.phone && (
        <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-xs text-emerald-400 hover:underline">
          <Phone className="w-3 h-3" /> {lead.phone}
        </a>
      )}

      {/* Status selector */}
      <select
        value={lead.status}
        onChange={e => changeStatus(e.target.value as LeadStatus)}
        className={`w-full text-xs font-bold px-2.5 py-1.5 rounded-xl border outline-none cursor-pointer ${badge.color} bg-transparent`}
      >
        {STATUS_OPTIONS.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Notes toggle */}
      {editing ? (
        <div className="space-y-2">
          <input value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="الهاتف" dir="ltr"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500" />
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="ملاحظات…" rows={2}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 resize-none" />
          <div className="flex gap-1.5">
            <button onClick={() => setEditing(false)} className="flex-1 text-xs text-gray-500 hover:text-white py-1 rounded-lg border border-gray-700">إلغاء</button>
            <button onClick={saveNotes} disabled={saving}
              className="flex-1 flex items-center justify-center text-xs font-bold py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'حفظ'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors w-full text-right">
          {lead.notes ? `📝 ${lead.notes.slice(0, 40)}${lead.notes.length > 40 ? '…' : ''}` : '+ إضافة ملاحظة'}
        </button>
      )}

      {/* Last contact */}
      {lead.lastContact && (
        <p className="text-[10px] text-gray-700">
          آخر تواصل: {new Date(lead.lastContact).toLocaleDateString('ar-MA', { day: 'numeric', month: 'short' })}
        </p>
      )}
    </div>
  )
}
```

- [ ] Commit:

```bash
git add app/superadmin/components/leads/LeadCard.tsx
git commit -m "feat(leads): add LeadCard component"
```

---

## Task 5 — LeadScraper Component

**Files:**
- Create: `app/superadmin/components/leads/LeadScraper.tsx`

- [ ] Create the component:

```tsx
// app/superadmin/components/leads/LeadScraper.tsx
'use client'
import { useState } from 'react'
import { Loader2, Search, Plus } from 'lucide-react'
import type { Lead } from './LeadCard'

interface SearchResult {
  placeId:      string | null
  businessName: string
  address:      string | null
  rating:       number | null
  reviewCount:  number | null
  city:         string
  country:      string
}

interface Props {
  superHeader: () => Record<string, string>
  onAdded:     (lead: Lead) => void
}

const TYPES = [
  { v: 'restaurant', label: '🍽 مطعم' },
  { v: 'cafe',       label: '☕ كافيه' },
  { v: 'traiteur',   label: '🥘 ترايتور' },
  { v: 'snack',      label: '🌮 سناك' },
  { v: 'boulangerie',label: '🥐 مخبزة' },
]

const CITIES = ['Agadir', 'Casablanca', 'Rabat', 'Marrakech', 'Fes', 'Tanger', 'Oujda', 'Kenitra', 'Tetouan', 'Meknes']

export default function LeadScraper({ superHeader, onAdded }: Props) {
  const [city,     setCity]     = useState(CITIES[0])
  const [type,     setType]     = useState(TYPES[0].v)
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [adding,   setAdding]   = useState<string | null>(null)
  const [error,    setError]    = useState('')

  async function search() {
    setLoading(true)
    setError('')
    setResults([])
    try {
      const res = await fetch('/api/superadmin/leads/search', {
        method:  'POST',
        headers: { ...superHeader(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ city, type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setResults(data)
    } catch (e: any) {
      setError(e.message ?? 'فشل البحث')
    } finally {
      setLoading(false)
    }
  }

  async function addToPipeline(r: SearchResult) {
    const key = r.placeId ?? r.businessName
    setAdding(key)
    try {
      const res = await fetch('/api/superadmin/leads', {
        method:  'POST',
        headers: { ...superHeader(), 'Content-Type': 'application/json' },
        body:    JSON.stringify(r),
      })
      const lead = await res.json()
      if (!res.ok) throw new Error(lead.error ?? 'Failed')
      onAdded(lead)
      setResults(prev => prev.filter(x => (x.placeId ?? x.businessName) !== key))
    } catch (e: any) {
      setError(e.message ?? 'فشل الإضافة')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Search bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-400" /> بحث عن عملاء محتملين
        </h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-gray-500 mb-1">المدينة</p>
            <select value={city} onChange={e => setCity(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-emerald-500">
              {CITIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">النوع</p>
            <select value={type} onChange={e => setType(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-emerald-500">
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </div>
          <button onClick={search} disabled={loading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            بحث
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-3 bg-red-950/40 border border-red-800 rounded-xl px-3 py-2">{error}</p>}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <p className="text-gray-500 text-xs mb-3 font-medium">{results.length} نتيجة — اضغط + لإضافة إلى Pipeline</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.map((r, i) => {
              const key = r.placeId ?? r.businessName
              return (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2 hover:border-gray-600 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-white text-sm flex-1">{r.businessName}</p>
                    <button onClick={() => addToPipeline(r)} disabled={adding === key}
                      className="shrink-0 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors">
                      {adding === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      إضافة
                    </button>
                  </div>
                  {r.address && <p className="text-gray-500 text-[11px]">{r.address}</p>}
                  {r.rating && (
                    <p className="text-amber-400 text-xs">⭐ {r.rating.toFixed(1)} {r.reviewCount ? `(${r.reviewCount})` : ''}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] Commit:

```bash
git add app/superadmin/components/leads/LeadScraper.tsx
git commit -m "feat(leads): add LeadScraper component"
```

---

## Task 6 — LeadPipeline Component

**Files:**
- Create: `app/superadmin/components/leads/LeadPipeline.tsx`

- [ ] Create the component:

```tsx
// app/superadmin/components/leads/LeadPipeline.tsx
'use client'
import type { Lead, LeadStatus } from './LeadCard'
import LeadCard from './LeadCard'

const COLUMNS: { status: LeadStatus; label: string; color: string; border: string }[] = [
  { status: 'NEW',        label: '🆕 جديد',    color: 'bg-sky-950/30',     border: 'border-sky-800/40' },
  { status: 'CONTACTED',  label: '📞 تواصلنا',  color: 'bg-amber-950/30',   border: 'border-amber-800/40' },
  { status: 'INTERESTED', label: '🤝 مهتم',     color: 'bg-violet-950/30',  border: 'border-violet-800/40' },
  { status: 'CLIENT',     label: '✅ عميل',      color: 'bg-emerald-950/30', border: 'border-emerald-800/40' },
  { status: 'REJECTED',   label: '❌ رفض',       color: 'bg-red-950/30',     border: 'border-red-800/40' },
]

interface Props {
  leads:       Lead[]
  superHeader: () => Record<string, string>
  onUpdate:    (updated: Lead) => void
  onDelete:    (id: string) => void
}

export default function LeadPipeline({ leads, superHeader, onUpdate, onDelete }: Props) {
  return (
    <div className="grid grid-cols-5 gap-3 overflow-x-auto pb-2" dir="rtl">
      {COLUMNS.map(col => {
        const colLeads = leads.filter(l => l.status === col.status)
        return (
          <div key={col.status} className={`rounded-2xl p-3 min-h-[120px] border ${col.color} ${col.border}`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-black text-white">{col.label}</span>
              <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full font-bold">{colLeads.length}</span>
            </div>
            <div className="space-y-2">
              {colLeads.map(l => (
                <LeadCard key={l.id} lead={l} superHeader={superHeader} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
              {colLeads.length === 0 && (
                <p className="text-center text-gray-700 text-[11px] py-4">فارغ</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] Commit:

```bash
git add app/superadmin/components/leads/LeadPipeline.tsx
git commit -m "feat(leads): add LeadPipeline kanban component"
```

---

## Task 7 — LeadAnalytics Component

**Files:**
- Create: `app/superadmin/components/leads/LeadAnalytics.tsx`

- [ ] Create the component:

```tsx
// app/superadmin/components/leads/LeadAnalytics.tsx
import type { Lead, LeadStatus } from './LeadCard'

interface Props {
  leads: Lead[]
}

const FUNNEL: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'NEW',        label: 'جديد',   color: 'bg-sky-500' },
  { status: 'CONTACTED',  label: 'تواصل',  color: 'bg-amber-500' },
  { status: 'INTERESTED', label: 'مهتم',   color: 'bg-violet-500' },
  { status: 'CLIENT',     label: 'عميل',   color: 'bg-emerald-500' },
]

export default function LeadAnalytics({ leads }: Props) {
  const total = leads.length

  // Funnel
  const funnelData = FUNNEL.map(f => ({
    ...f,
    count: leads.filter(l => l.status === f.status).length,
    pct:   total > 0 ? Math.round((leads.filter(l => l.status === f.status).length / total) * 100) : 0,
  }))

  const clients   = leads.filter(l => l.status === 'CLIENT').length
  const conversion = total > 0 ? ((clients / total) * 100).toFixed(1) : '0'

  // Top cities
  const cityCount: Record<string, number> = {}
  for (const l of leads) cityCount[l.city] = (cityCount[l.city] ?? 0) + 1
  const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxCity   = topCities[0]?.[1] ?? 1

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" dir="rtl">
      {/* Funnel */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-sm">قمع التحويل</h3>
          <span className="text-emerald-400 font-black text-sm bg-emerald-950/50 border border-emerald-700/40 px-2.5 py-1 rounded-lg">
            {conversion}% تحويل
          </span>
        </div>
        <div className="space-y-3">
          {funnelData.map(f => (
            <div key={f.status} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">{f.label}</span>
                <span className="text-white font-bold">{f.count}</span>
              </div>
              <div className="bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${f.color}`}
                  style={{ width: `${f.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {total === 0 && <p className="text-center text-gray-600 text-sm pt-4">لا توجد بيانات</p>}
      </div>

      {/* Top cities */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-bold text-white text-sm mb-5">أفضل المدن</h3>
        {topCities.length === 0 ? (
          <p className="text-center text-gray-600 text-sm pt-4">لا توجد بيانات</p>
        ) : (
          <div className="space-y-3">
            {topCities.map(([city, count]) => (
              <div key={city} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">{city}</span>
                  <span className="text-white font-bold">{count}</span>
                </div>
                <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: `${Math.round((count / maxCity) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] Commit:

```bash
git add app/superadmin/components/leads/LeadAnalytics.tsx
git commit -m "feat(leads): add LeadAnalytics conversion funnel + city chart"
```

---

## Task 8 — Wire Lead Section into Themes

**Files:**
- Modify: `app/superadmin/components/themes/ThemeA.tsx`
- Modify: `app/superadmin/components/themes/ThemeB.tsx`
- Modify: `app/superadmin/components/themes/ThemeC.tsx`

### Step 8a — Add imports and state to ThemeA

- [ ] Add imports to `ThemeA.tsx`:

```typescript
import LeadScraper from '../leads/LeadScraper'
import LeadPipeline from '../leads/LeadPipeline'
import LeadAnalytics from '../leads/LeadAnalytics'
import type { Lead } from '../leads/LeadCard'
```

- [ ] Add state to ThemeA (inside the component, with other `useState` declarations):

```typescript
const [activeTab,  setActiveTab]  = useState<'tenants' | 'leads'>('tenants')
const [leads,      setLeads]      = useState<Lead[]>([])
const [leadsLoaded,setLeadsLoaded]= useState(false)

async function loadLeads() {
  if (leadsLoaded) return
  const res = await fetch('/api/superadmin/leads', { headers: p.superHeader() })
  if (res.ok) { setLeads(await res.json()); setLeadsLoaded(true) }
}
```

- [ ] In the header section of ThemeA, after the h1/subtitle, add tab switcher buttons:

```tsx
<div className="flex items-center gap-0.5 bg-gray-900 border border-gray-800 rounded-xl p-0.5">
  <button onClick={() => setActiveTab('tenants')}
    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
      activeTab === 'tenants' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-300'
    }`}>
    🏪 المطاعم
  </button>
  <button onClick={() => { setActiveTab('leads'); loadLeads() }}
    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
      activeTab === 'leads' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-300'
    }`}>
    🎯 عملاء محتملون
  </button>
</div>
```

- [ ] Wrap the existing main content (everything after the header) in a conditional:

```tsx
{activeTab === 'tenants' && (
  <> {/* existing tenants content: KpiCards, charts, churn, table etc */} </>
)}

{activeTab === 'leads' && (
  <div className="space-y-6">
    <LeadAnalytics leads={leads} />
    <LeadScraper superHeader={p.superHeader} onAdded={lead => setLeads(prev => [lead, ...prev])} />
    <LeadPipeline
      leads={leads}
      superHeader={p.superHeader}
      onUpdate={updated => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))}
      onDelete={id => setLeads(prev => prev.filter(l => l.id !== id))}
    />
  </div>
)}
```

- [ ] Apply same pattern to ThemeB: add `activeTab` state, the tab switcher in the sidebar nav (replace the `NAV_ITEMS` array or add a tab bar at the top of main), and the leads section conditional.

- [ ] Apply same pattern to ThemeC: the `NAV` array already has "Tenants" and "Analytics" — add `'Future Clients'` to it, then render the leads section when `activeNav === 'Future Clients'`.

- [ ] Commit:

```bash
git add app/superadmin/components/themes/ThemeA.tsx app/superadmin/components/themes/ThemeB.tsx app/superadmin/components/themes/ThemeC.tsx
git commit -m "feat(leads): wire Lead section into all 3 themes"
```

---

## Task 9 — Manual Verification

- [ ] Start both servers:

```bash
npm run dev       # Express backend
npx next dev      # Next.js frontend
```

- [ ] Open `http://localhost:3000/superadmin` and login.

- [ ] Click "عملاء محتملون" tab.

- [ ] In the scraper, select city "Agadir" + type "restaurant" → click بحث.
  Expected: List of real Google Places results appears (up to 20).

- [ ] Click "إضافة" on one result.
  Expected: It disappears from scraper results and appears in the "🆕 جديد" column of the pipeline.

- [ ] In the LeadCard, change status to "📞 تواصلنا" using the dropdown.
  Expected: The card moves to the CONTACTED column.

- [ ] Click "+ إضافة ملاحظة", type a note, click حفظ.
  Expected: Note text appears on the card.

- [ ] Check LeadAnalytics — verify the funnel bars reflect the 1 lead added.

- [ ] Switch to Theme B and Theme C — verify the leads section is accessible in both.

- [ ] Final commit:

```bash
git add -A
git commit -m "feat(leads): complete Plan 3 — Lead Scraper + Pipeline + Analytics"
```
