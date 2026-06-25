# Fawatir & I7tiyajat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two operational finance modules — Supplier Invoice tracking (Fawatir) and Purchase Requisition management (I7tiyajat) — to the Smart Restau admin panel.

**Architecture:** Two new Prisma models (`SupplierInvoice`, `PurchaseRequisition`) scoped to `cafeId`, two Express routers, two Next.js admin pages, two sidebar links. Follows the exact same pattern as the Equipment module already in the codebase.

**Tech Stack:** Prisma (MongoDB), Express + TypeScript, Next.js App Router, Tailwind CSS, lucide-react

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add `SupplierInvoice` + `PurchaseRequisition` models + Cafe relations |
| `src/routes/supplierInvoices.ts` | Create | CRUD + summary stats for invoices |
| `src/routes/requisitions.ts` | Create | CRUD + summary stats for requisitions |
| `src/server.ts` | Modify | Register both routers |
| `app/admin/invoices/page.tsx` | Create | Invoice list + add/edit form + status quick-change |
| `app/admin/requisitions/page.tsx` | Create | Requisition list + add form + status workflow |
| `app/admin/layout.tsx` | Modify | Add FileText + ClipboardList sidebar links |
| `lib/adminI18n.ts` | Modify | Add `invoices` + `requisitions` i18n keys (4 languages) |

---

## Task 1 — Prisma Schema: SupplierInvoice + PurchaseRequisition

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add relations to Cafe model**

In `prisma/schema.prisma`, find the Cafe model relations block (where `equipment Equipment[]` was just added, around line 318–320) and add two more lines:

```prisma
  supplierInvoices   SupplierInvoice[]
  purchaseRequisitions PurchaseRequisition[]
```

- [ ] **Step 2: Append models at end of file**

After the `MaintenanceRecord` model (end of file), append:

```prisma
// ─── Supplier Invoices (Fawatir) ──────────────────────────────────────────────

model SupplierInvoice {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  cafeId        String   @db.ObjectId
  cafe          Cafe     @relation(fields: [cafeId], references: [id])

  supplierName  String
  invoiceNumber String?
  amount        Float
  currency      String   @default("MAD")
  issueDate     DateTime
  dueDate       DateTime?
  status        String   @default("unpaid")
  documentUrl   String?
  notes         String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([cafeId])
  @@index([cafeId, status])
  @@index([dueDate])
}

// ─── Purchase Requisitions (I7tiyajat) ────────────────────────────────────────

model PurchaseRequisition {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  cafeId         String   @db.ObjectId
  cafe           Cafe     @relation(fields: [cafeId], references: [id])

  itemName       String
  quantity       Float
  unit           String   @default("units")
  estimatedPrice Float?
  urgency        String   @default("normal")
  requestedBy    String
  notes          String?
  status         String   @default("pending")

  approvedAt     DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([cafeId])
  @@index([cafeId, status])
  @@index([cafeId, urgency])
}
```

- [ ] **Step 3: Generate Prisma client**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Validate schema**

```bash
npx prisma validate
```

Expected: `The schema at .../schema.prisma is valid 🚀`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add SupplierInvoice and PurchaseRequisition models"
```

---

## Task 2 — Backend: Supplier Invoices Routes

**Files:**
- Create: `src/routes/supplierInvoices.ts`

- [ ] **Step 1: Create the file**

Create `src/routes/supplierInvoices.ts` with this exact content:

```typescript
import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

router.get('/summary/stats', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const invoices = await prisma.supplierInvoice.findMany({
      where: { cafeId },
      select: { status: true, amount: true, dueDate: true, createdAt: true },
    })

    const unpaidTotal = invoices
      .filter(i => i.status === 'unpaid' || i.status === 'overdue')
      .reduce((s, i) => s + i.amount, 0)

    const overdueCount = invoices.filter(i =>
      (i.status === 'unpaid') && i.dueDate && new Date(i.dueDate) < now
    ).length

    const paidThisMonth = invoices
      .filter(i => i.status === 'paid' && new Date(i.createdAt) >= startOfMonth)
      .reduce((s, i) => s + i.amount, 0)

    return res.json({ unpaidTotal, overdueCount, paidThisMonth, total: invoices.length })
  } catch (err) {
    logger.error({ msg: 'invoice stats error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const { status } = req.query as { status?: string }
  try {
    const invoices = await prisma.supplierInvoice.findMany({
      where: { cafeId, ...(status && status !== 'all' ? { status } : {}) },
      orderBy: { issueDate: 'desc' },
    })
    return res.json({ items: invoices })
  } catch (err) {
    logger.error({ msg: 'invoice list error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const {
    supplierName, invoiceNumber, amount, currency,
    issueDate, dueDate, status, documentUrl, notes,
  } = req.body as Record<string, any>

  if (!supplierName || amount == null || !issueDate) {
    return res.status(400).json({ error: 'supplierName, amount and issueDate are required' })
  }

  try {
    const invoice = await prisma.supplierInvoice.create({
      data: {
        cafeId,
        supplierName,
        invoiceNumber: invoiceNumber ?? null,
        amount:        Number(amount),
        currency:      currency      ?? 'MAD',
        issueDate:     new Date(issueDate),
        dueDate:       dueDate       ? new Date(dueDate) : null,
        status:        status        ?? 'unpaid',
        documentUrl:   documentUrl   ?? null,
        notes:         notes         ?? null,
      },
    })
    return res.status(201).json(invoice)
  } catch (err) {
    logger.error({ msg: 'invoice create error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  const body = req.body as Record<string, any>

  try {
    const existing = await prisma.supplierInvoice.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Invoice not found' })

    const data: Record<string, any> = {}
    if (body.supplierName  !== undefined) data.supplierName  = body.supplierName
    if (body.invoiceNumber !== undefined) data.invoiceNumber = body.invoiceNumber
    if (body.amount        !== undefined) data.amount        = Number(body.amount)
    if (body.currency      !== undefined) data.currency      = body.currency
    if (body.issueDate     !== undefined) data.issueDate     = new Date(body.issueDate)
    if (body.dueDate       !== undefined) data.dueDate       = body.dueDate ? new Date(body.dueDate) : null
    if (body.status        !== undefined) data.status        = body.status
    if (body.documentUrl   !== undefined) data.documentUrl   = body.documentUrl
    if (body.notes         !== undefined) data.notes         = body.notes

    const invoice = await prisma.supplierInvoice.update({ where: { id, cafeId }, data })
    return res.json(invoice)
  } catch (err) {
    logger.error({ msg: 'invoice update error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  try {
    const existing = await prisma.supplierInvoice.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Invoice not found' })
    await prisma.supplierInvoice.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'invoice delete error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
```

- [ ] **Step 2: Verify build**

```bash
cd "/Users/mac/Documents/SaaS restau" && npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/supplierInvoices.ts
git commit -m "feat(api): add supplier invoices CRUD routes"
```

---

## Task 3 — Backend: Purchase Requisitions Routes

**Files:**
- Create: `src/routes/requisitions.ts`

- [ ] **Step 1: Create the file**

Create `src/routes/requisitions.ts` with this exact content:

```typescript
import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

const NEXT_STATUS: Record<string, string> = {
  pending:  'approved',
  approved: 'ordered',
  ordered:  'received',
}

router.get('/summary/stats', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const items = await prisma.purchaseRequisition.findMany({
      where: { cafeId },
      select: { status: true, urgency: true, createdAt: true },
    })

    return res.json({
      pending:         items.filter(i => i.status === 'pending').length,
      urgentPending:   items.filter(i => i.status === 'pending' && i.urgency === 'urgent').length,
      ordered:         items.filter(i => i.status === 'ordered').length,
      receivedThisMonth: items.filter(i => i.status === 'received' && new Date(i.createdAt) >= startOfMonth).length,
      total:           items.length,
    })
  } catch (err) {
    logger.error({ msg: 'requisition stats error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const { status, urgency } = req.query as { status?: string; urgency?: string }
  try {
    const items = await prisma.purchaseRequisition.findMany({
      where: {
        cafeId,
        ...(status  && status  !== 'all' ? { status }  : {}),
        ...(urgency && urgency !== 'all' ? { urgency } : {}),
      },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
    })
    return res.json({ items })
  } catch (err) {
    logger.error({ msg: 'requisition list error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const {
    itemName, quantity, unit, estimatedPrice,
    urgency, requestedBy, notes,
  } = req.body as Record<string, any>

  if (!itemName || quantity == null || !requestedBy) {
    return res.status(400).json({ error: 'itemName, quantity and requestedBy are required' })
  }

  try {
    const item = await prisma.purchaseRequisition.create({
      data: {
        cafeId,
        itemName,
        quantity:       Number(quantity),
        unit:           unit           ?? 'units',
        estimatedPrice: estimatedPrice != null ? Number(estimatedPrice) : null,
        urgency:        urgency        ?? 'normal',
        requestedBy,
        notes:          notes          ?? null,
        status:         'pending',
      },
    })
    return res.status(201).json(item)
  } catch (err) {
    logger.error({ msg: 'requisition create error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  const body = req.body as Record<string, any>

  try {
    const existing = await prisma.purchaseRequisition.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Requisition not found' })

    const data: Record<string, any> = {}
    if (body.itemName       !== undefined) data.itemName       = body.itemName
    if (body.quantity       !== undefined) data.quantity       = Number(body.quantity)
    if (body.unit           !== undefined) data.unit           = body.unit
    if (body.estimatedPrice !== undefined) data.estimatedPrice = body.estimatedPrice != null ? Number(body.estimatedPrice) : null
    if (body.urgency        !== undefined) data.urgency        = body.urgency
    if (body.requestedBy    !== undefined) data.requestedBy    = body.requestedBy
    if (body.notes          !== undefined) data.notes          = body.notes
    if (body.status         !== undefined) {
      data.status = body.status
      if (body.status === 'approved' && !existing.approvedAt) {
        data.approvedAt = new Date()
      }
    }

    const item = await prisma.purchaseRequisition.update({ where: { id, cafeId }, data })
    return res.json(item)
  } catch (err) {
    logger.error({ msg: 'requisition update error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  try {
    const existing = await prisma.purchaseRequisition.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Requisition not found' })
    await prisma.purchaseRequisition.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'requisition delete error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
```

- [ ] **Step 2: Verify build**

```bash
cd "/Users/mac/Documents/SaaS restau" && npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/requisitions.ts
git commit -m "feat(api): add purchase requisitions CRUD routes"
```

---

## Task 4 — Register Both Routers in server.ts

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add imports**

Find the imports block in `src/server.ts` (around the line with `import equipmentRouter from './routes/equipment'`) and add right after it:

```typescript
import supplierInvoicesRouter from './routes/supplierInvoices'
import requisitionsRouter     from './routes/requisitions'
```

- [ ] **Step 2: Register routes**

Find where `app.use('/api/v1/equipment', equipmentRouter)` is registered and add right after it:

```typescript
  app.use('/api/v1/invoices',      supplierInvoicesRouter)
  app.use('/api/v1/requisitions',  requisitionsRouter)
```

- [ ] **Step 3: Verify build**

```bash
cd "/Users/mac/Documents/SaaS restau" && npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat(server): register invoices and requisitions routers"
```

---

## Task 5 — Frontend: Invoices Page

**Files:**
- Create: `app/admin/invoices/page.tsx`

- [ ] **Step 1: Create the file**

Create `app/admin/invoices/page.tsx` with this exact content:

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  FileText, Plus, Trash2, Edit3, Loader2, RefreshCw,
  DollarSign, AlertCircle, CheckCircle2, Clock, XCircle, ExternalLink
} from 'lucide-react'
import { useLang } from '../lang-context'

type InvoiceStatus = 'unpaid' | 'paid' | 'overdue' | 'cancelled'

interface SupplierInvoice {
  id:            string
  supplierName:  string
  invoiceNumber: string | null
  amount:        number
  currency:      string
  issueDate:     string
  dueDate:       string | null
  status:        InvoiceStatus
  documentUrl:   string | null
  notes:         string | null
}

interface Summary {
  unpaidTotal:    number
  overdueCount:   number
  paidThisMonth:  number
  total:          number
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

const STATUS_META: Record<InvoiceStatus, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  unpaid:    { label: 'Non payée',  color: 'text-amber-400',   bg: 'bg-amber-500/15',   Icon: Clock        },
  overdue:   { label: 'En retard',  color: 'text-rose-400',    bg: 'bg-rose-500/15',    Icon: AlertCircle  },
  paid:      { label: 'Payée',      color: 'text-emerald-400', bg: 'bg-emerald-500/15', Icon: CheckCircle2 },
  cancelled: { label: 'Annulée',    color: 'text-slate-500',   bg: 'bg-slate-500/15',   Icon: XCircle      },
}

const STATUSES: InvoiceStatus[] = ['unpaid', 'overdue', 'paid', 'cancelled']

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isOverdue(dueDate: string | null, status: InvoiceStatus) {
  if (!dueDate || status === 'paid' || status === 'cancelled') return false
  return new Date(dueDate) < new Date()
}

const EMPTY_FORM = {
  supplierName: '', invoiceNumber: '', amount: '', currency: 'MAD',
  issueDate: '', dueDate: '', status: 'unpaid' as InvoiceStatus,
  documentUrl: '', notes: '',
}

type FilterTab = 'all' | InvoiceStatus

export default function InvoicesPage() {
  const { isRTL } = useLang()

  const [items,    setItems]    = useState<SupplierInvoice[]>([])
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<FilterTab>('all')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<SupplierInvoice | null>(null)
  const [form,     setForm]     = useState({ ...EMPTY_FORM })
  const [saving,   setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/v1/invoices?status=${filter}`, { headers: authHeader() }),
        fetch('/api/v1/invoices/summary/stats',    { headers: authHeader() }),
      ])
      if (listRes.ok) setItems((await listRes.json()).items ?? [])
      if (sumRes.ok)  setSummary(await sumRes.json())
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const body = {
        ...form,
        amount:    form.amount    ? Number(form.amount) : undefined,
        dueDate:   form.dueDate   || null,
        invoiceNumber: form.invoiceNumber || null,
        documentUrl:   form.documentUrl   || null,
        notes:         form.notes         || null,
      }
      const url    = editItem ? `/api/v1/invoices/${editItem.id}` : '/api/v1/invoices'
      const method = editItem ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) { setShowForm(false); setEditItem(null); setForm({ ...EMPTY_FORM }); await load() }
    } finally {
      setSaving(false)
    }
  }

  async function quickStatus(id: string, status: InvoiceStatus) {
    await fetch(`/api/v1/invoices/${id}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  async function del(id: string) {
    if (!confirm('Supprimer cette facture ?')) return
    await fetch(`/api/v1/invoices/${id}`, { method: 'DELETE', headers: authHeader() })
    await load()
  }

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',       label: 'Toutes'      },
    { key: 'unpaid',    label: 'Non payées'  },
    { key: 'overdue',   label: 'En retard'   },
    { key: 'paid',      label: 'Payées'      },
    { key: 'cancelled', label: 'Annulées'    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-emerald-500" size={36} />
      </div>
    )
  }

  return (
    <div className={`max-w-5xl mx-auto px-4 py-8 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/10">
            <FileText className="text-violet-400" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Fawatir — Factures</h1>
            <p className="text-sm text-slate-400 mt-0.5">Suivez vos factures fournisseurs.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { setShowForm(true); setEditItem(null); setForm({ ...EMPTY_FORM }) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">Total factures</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-xs text-slate-400">Non payé</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{summary.unpaidTotal.toLocaleString('fr-FR')} MAD</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-xs text-slate-400">En retard</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">{summary.overdueCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-xs text-slate-400">Payé ce mois</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.paidThisMonth.toLocaleString('fr-FR')} MAD</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === t.key
                ? 'bg-violet-500 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{editItem ? 'Modifier la facture' : 'Nouvelle facture'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { key: 'supplierName',  label: 'Fournisseur *', type: 'text'   },
              { key: 'invoiceNumber', label: 'N° Facture',    type: 'text'   },
              { key: 'amount',        label: 'Montant *',     type: 'number' },
              { key: 'currency',      label: 'Devise',        type: 'text'   },
              { key: 'issueDate',     label: 'Date facture *',type: 'date'   },
              { key: 'dueDate',       label: 'Échéance',      type: 'date'   },
              { key: 'documentUrl',   label: 'URL document',  type: 'url'    },
            ] as { key: keyof typeof EMPTY_FORM; label: string; type: string }[]).map(f => (
              <div key={f.key}>
                <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key] as string}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Statut</label>
              <select
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value as InvoiceStatus }))}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s} className="bg-slate-800">{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving || !form.supplierName || !form.amount || !form.issueDate}
              className="px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Enregistrer'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditItem(null) }}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Invoice list */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-12 text-center">
          <FileText className="mx-auto text-slate-600 mb-3" size={40} />
          <p className="text-slate-400 text-sm">Aucune facture{filter !== 'all' ? ' dans ce filtre' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(inv => {
            const late = isOverdue(inv.dueDate, inv.status)
            const meta = STATUS_META[late ? 'overdue' : inv.status] ?? STATUS_META.unpaid
            const StatusIcon = meta.Icon

            return (
              <div key={inv.id} className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{inv.supplierName}</span>
                    {inv.invoiceNumber && <span className="text-xs text-slate-500">#{inv.invoiceNumber}</span>}
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.color} ${meta.bg}`}>
                      <StatusIcon size={11} /> {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-sm font-bold text-white">{inv.amount.toLocaleString('fr-FR')} {inv.currency}</span>
                    <span className="text-xs text-slate-400">Émise: {fmt(inv.issueDate)}</span>
                    {inv.dueDate && (
                      <span className={`text-xs ${late ? 'text-rose-400 font-medium' : 'text-slate-400'}`}>
                        Échéance: {fmt(inv.dueDate)}{late ? ' ⚠️' : ''}
                      </span>
                    )}
                    {inv.documentUrl && (
                      <a href={inv.documentUrl} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-violet-400 hover:underline flex items-center gap-1">
                        <ExternalLink size={11} /> Document
                      </a>
                    )}
                  </div>
                </div>

                {/* Quick status toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                    <button
                      onClick={() => quickStatus(inv.id, 'paid')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold transition-colors"
                    >
                      ✓ Payée
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditItem(inv)
                      setForm({
                        supplierName:  inv.supplierName,
                        invoiceNumber: inv.invoiceNumber  ?? '',
                        amount:        String(inv.amount),
                        currency:      inv.currency,
                        issueDate:     inv.issueDate.slice(0, 10),
                        dueDate:       inv.dueDate ? inv.dueDate.slice(0, 10) : '',
                        status:        inv.status,
                        documentUrl:   inv.documentUrl ?? '',
                        notes:         inv.notes       ?? '',
                      })
                      setShowForm(true)
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => del(inv.id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd "/Users/mac/Documents/SaaS restau" && npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add app/admin/invoices/page.tsx
git commit -m "feat(ui): add Fawatir supplier invoices page"
```

---

## Task 6 — Frontend: Requisitions Page

**Files:**
- Create: `app/admin/requisitions/page.tsx`

- [ ] **Step 1: Create the file**

Create `app/admin/requisitions/page.tsx` with this exact content:

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ClipboardList, Plus, Trash2, Edit3, Loader2, RefreshCw,
  CheckCircle2, Clock, Package, XCircle, ChevronRight, AlertTriangle
} from 'lucide-react'
import { useLang } from '../lang-context'

type ReqStatus  = 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled'
type ReqUrgency = 'low' | 'normal' | 'high' | 'urgent'

interface PurchaseRequisition {
  id:             string
  itemName:       string
  quantity:       number
  unit:           string
  estimatedPrice: number | null
  urgency:        ReqUrgency
  requestedBy:    string
  notes:          string | null
  status:         ReqStatus
  approvedAt:     string | null
  createdAt:      string
}

interface Summary {
  pending:          number
  urgentPending:    number
  ordered:          number
  receivedThisMonth: number
  total:            number
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

const STATUS_META: Record<ReqStatus, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  pending:   { label: 'En attente', color: 'text-amber-400',   bg: 'bg-amber-500/15',   Icon: Clock        },
  approved:  { label: 'Approuvé',   color: 'text-blue-400',    bg: 'bg-blue-500/15',    Icon: CheckCircle2 },
  ordered:   { label: 'Commandé',   color: 'text-violet-400',  bg: 'bg-violet-500/15',  Icon: Package      },
  received:  { label: 'Reçu',       color: 'text-emerald-400', bg: 'bg-emerald-500/15', Icon: CheckCircle2 },
  cancelled: { label: 'Annulé',     color: 'text-slate-500',   bg: 'bg-slate-500/15',   Icon: XCircle      },
}

const URGENCY_META: Record<ReqUrgency, { label: string; color: string; bg: string }> = {
  low:    { label: 'Faible',  color: 'text-slate-400',   bg: 'bg-slate-500/15'  },
  normal: { label: 'Normal',  color: 'text-blue-400',    bg: 'bg-blue-500/15'   },
  high:   { label: 'Élevée',  color: 'text-amber-400',   bg: 'bg-amber-500/15'  },
  urgent: { label: 'Urgent',  color: 'text-rose-400',    bg: 'bg-rose-500/15'   },
}

const NEXT_STATUS: Partial<Record<ReqStatus, { next: ReqStatus; label: string }>> = {
  pending:  { next: 'approved', label: 'Approuver'  },
  approved: { next: 'ordered',  label: 'Commander'  },
  ordered:  { next: 'received', label: 'Reçu ✓'     },
}

const UNITS = ['units', 'kg', 'L', 'boxes', 'other']
type FilterTab = 'all' | ReqStatus

const EMPTY_FORM = {
  itemName: '', quantity: '', unit: 'units', estimatedPrice: '',
  urgency: 'normal' as ReqUrgency, requestedBy: '', notes: '',
}

export default function RequisitionsPage() {
  const { isRTL } = useLang()

  const [items,    setItems]    = useState<PurchaseRequisition[]>([])
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<FilterTab>('all')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<PurchaseRequisition | null>(null)
  const [form,     setForm]     = useState({ ...EMPTY_FORM })
  const [saving,   setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/v1/requisitions?status=${filter}`, { headers: authHeader() }),
        fetch('/api/v1/requisitions/summary/stats',    { headers: authHeader() }),
      ])
      if (listRes.ok) setItems((await listRes.json()).items ?? [])
      if (sumRes.ok)  setSummary(await sumRes.json())
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const body = {
        ...form,
        quantity:       form.quantity       ? Number(form.quantity)       : undefined,
        estimatedPrice: form.estimatedPrice ? Number(form.estimatedPrice) : null,
        notes:          form.notes          || null,
      }
      const url    = editItem ? `/api/v1/requisitions/${editItem.id}` : '/api/v1/requisitions'
      const method = editItem ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) { setShowForm(false); setEditItem(null); setForm({ ...EMPTY_FORM }); await load() }
    } finally {
      setSaving(false)
    }
  }

  async function advanceStatus(id: string, next: ReqStatus) {
    await fetch(`/api/v1/requisitions/${id}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    await load()
  }

  async function cancel(id: string) {
    if (!confirm('Annuler cette demande ?')) return
    await fetch(`/api/v1/requisitions/${id}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    await load()
  }

  async function del(id: string) {
    if (!confirm('Supprimer cette demande ?')) return
    await fetch(`/api/v1/requisitions/${id}`, { method: 'DELETE', headers: authHeader() })
    await load()
  }

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',       label: 'Toutes'     },
    { key: 'pending',   label: 'En attente' },
    { key: 'approved',  label: 'Approuvés'  },
    { key: 'ordered',   label: 'Commandés'  },
    { key: 'received',  label: 'Reçus'      },
    { key: 'cancelled', label: 'Annulés'    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-emerald-500" size={36} />
      </div>
    )
  }

  return (
    <div className={`max-w-5xl mx-auto px-4 py-8 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-teal-500/10">
            <ClipboardList className="text-teal-400" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">I7tiyajat — Besoins</h1>
            <p className="text-sm text-slate-400 mt-0.5">Gérez vos demandes d'achat.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { setShowForm(true); setEditItem(null); setForm({ ...EMPTY_FORM }) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-xs text-slate-400">En attente</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{summary.pending}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-xs text-slate-400">Urgent en attente</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">{summary.urgentPending}</p>
          </div>
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
            <p className="text-xs text-slate-400">En transit</p>
            <p className="text-2xl font-bold text-violet-400 mt-1">{summary.ordered}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-xs text-slate-400">Reçus ce mois</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.receivedThisMonth}</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === t.key
                ? 'bg-teal-500 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{editItem ? 'Modifier la demande' : 'Nouvelle demande'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { key: 'itemName',      label: 'Article *',      type: 'text'   },
              { key: 'requestedBy',   label: 'Demandé par *',  type: 'text'   },
              { key: 'quantity',      label: 'Quantité *',     type: 'number' },
              { key: 'estimatedPrice', label: 'Prix estimé (MAD)', type: 'number' },
            ] as { key: keyof typeof EMPTY_FORM; label: string; type: string }[]).map(f => (
              <div key={f.key}>
                <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key] as string}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Unité</label>
              <select
                value={form.unit}
                onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                {UNITS.map(u => <option key={u} value={u} className="bg-slate-800">{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Urgence</label>
              <select
                value={form.urgency}
                onChange={e => setForm(prev => ({ ...prev, urgency: e.target.value as ReqUrgency }))}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                {(Object.keys(URGENCY_META) as ReqUrgency[]).map(u => (
                  <option key={u} value={u} className="bg-slate-800">{URGENCY_META[u].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving || !form.itemName || !form.quantity || !form.requestedBy}
              className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Enregistrer'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditItem(null) }}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Requisition list */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-12 text-center">
          <ClipboardList className="mx-auto text-slate-600 mb-3" size={40} />
          <p className="text-slate-400 text-sm">Aucune demande{filter !== 'all' ? ' dans ce filtre' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(req => {
            const sMeta = STATUS_META[req.status]  ?? STATUS_META.pending
            const uMeta = URGENCY_META[req.urgency] ?? URGENCY_META.normal
            const StatusIcon = sMeta.Icon
            const nextStep = NEXT_STATUS[req.status]

            return (
              <div key={req.id} className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{req.itemName}</span>
                    <span className="text-xs text-slate-400">{req.quantity} {req.unit}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${uMeta.color} ${uMeta.bg}`}>
                      {uMeta.label}
                    </span>
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sMeta.color} ${sMeta.bg}`}>
                      <StatusIcon size={11} /> {sMeta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-slate-400">👤 {req.requestedBy}</span>
                    {req.estimatedPrice != null && (
                      <span className="text-xs text-slate-400">~{req.estimatedPrice.toLocaleString('fr-FR')} MAD</span>
                    )}
                    {req.notes && <span className="text-xs text-slate-500 truncate max-w-[200px]">{req.notes}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {nextStep && (
                    <button
                      onClick={() => advanceStatus(req.id, nextStep.next)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/30 text-teal-400 text-xs font-semibold transition-colors"
                    >
                      {nextStep.label} <ChevronRight size={12} />
                    </button>
                  )}
                  {req.status !== 'received' && req.status !== 'cancelled' && (
                    <button
                      onClick={() => cancel(req.id)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Annuler"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditItem(req)
                      setForm({
                        itemName:       req.itemName,
                        quantity:       String(req.quantity),
                        unit:           req.unit,
                        estimatedPrice: req.estimatedPrice != null ? String(req.estimatedPrice) : '',
                        urgency:        req.urgency,
                        requestedBy:    req.requestedBy,
                        notes:          req.notes ?? '',
                      })
                      setShowForm(true)
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => del(req.id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd "/Users/mac/Documents/SaaS restau" && npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add app/admin/requisitions/page.tsx
git commit -m "feat(ui): add I7tiyajat purchase requisitions page"
```

---

## Task 7 — Sidebar Links + i18n

**Files:**
- Modify: `app/admin/layout.tsx`
- Modify: `lib/adminI18n.ts`

- [ ] **Step 1: Add icons to layout.tsx import**

In `app/admin/layout.tsx`, find the lucide-react import line (line ~14) which currently ends with `Wrench`. Add `FileText` and `ClipboardList`:

```typescript
import {
  LayoutDashboard, UtensilsCrossed, QrCode, Share2,
  CreditCard, LogOut, ChevronRight, Menu, X,
  AlertTriangle, Loader2, Gift, Zap, ChefHat, Bell, Monitor,
  Users, BarChart3, Copy, Check, ExternalLink, Building2,
  Banknote, Wallet, CalendarClock, Sparkles, Settings, Languages, TrendingUp, Film,
  Package, Lock, LayoutGrid, Wrench, FileText, ClipboardList
} from 'lucide-react'
```

- [ ] **Step 2: Add nav entries to the NAV array**

In the same file, find the NAV array. After the `{ href: '/admin/equipment', icon: Wrench, key: 'equipment' }` line, add:

```typescript
  { href: '/admin/invoices',      icon: FileText,       key: 'invoices'      },
  { href: '/admin/requisitions',  icon: ClipboardList,  key: 'requisitions'  },
```

- [ ] **Step 3: Add Arabic i18n keys**

In `lib/adminI18n.ts`, find the Arabic block (first language block). After the line `equipment: 'المعدات & الصيانة',` add:

```typescript
    invoices:      'الفواتير',
    requisitions:  'الاحتياجات',
```

- [ ] **Step 4: Add English i18n keys**

Find the English block. After `equipment: 'Equipment & Maintenance',` add:

```typescript
    invoices:      'Invoices',
    requisitions:  'Requisitions',
```

- [ ] **Step 5: Add French i18n keys**

Find the French block. After `equipment: 'Équipements & Maintenance',` add:

```typescript
    invoices:      'Fawatir',
    requisitions:  'Besoins',
```

- [ ] **Step 6: Add Spanish i18n keys**

Find the Spanish block. After `equipment: 'Equipos & Mantenimiento',` add:

```typescript
    invoices:      'Facturas',
    requisitions:  'Requisiciones',
```

- [ ] **Step 7: Verify build**

```bash
cd "/Users/mac/Documents/SaaS restau" && npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors

- [ ] **Step 8: Commit**

```bash
git add app/admin/layout.tsx lib/adminI18n.ts
git commit -m "feat(nav): add Fawatir and I7tiyajat sidebar links with i18n"
```

---

## Final Verification

- [ ] Navigate to `/admin/invoices` — page loads, summary cards visible, "Ajouter" button works
- [ ] Add an invoice — appears in list with correct status badge (amber = unpaid)
- [ ] Click "✓ Payée" — status changes to emerald "Payée" instantly
- [ ] Navigate to `/admin/requisitions` — page loads, summary cards visible
- [ ] Add a requisition with urgency "urgent" — appears with rose badge
- [ ] Click "Approuver" → "Commander" → "Reçu ✓" — status advances through workflow
- [ ] Filter tabs work on both pages
- [ ] Both pages appear in sidebar with correct icons
