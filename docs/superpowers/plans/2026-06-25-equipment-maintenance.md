# Equipment & Maintenance Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full Equipment & Maintenance module so each restaurant can track their equipment (fridges, ovens, coffee machines), purchase info, warranty expiry, maintenance records with technician costs, and document uploads.

**Architecture:** Two new Prisma models (`Equipment`, `MaintenanceRecord`) scoped to `cafeId`. A new Express router at `/api/v1/equipment` handles CRUD. A new Next.js page at `app/admin/equipment/page.tsx` shows the equipment list, inline maintenance history, and a dashboard summary. No feature gate — available to all cafes.

**Tech Stack:** Prisma (MongoDB), Express, Next.js App Router, TypeScript, Tailwind CSS, Cloudinary (existing — for receipt image uploads)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add `Equipment` + `MaintenanceRecord` models, add relations to `Cafe` |
| `src/routes/equipment.ts` | Create | CRUD routes for equipment + maintenance records |
| `src/server.ts` | Modify | Register equipment router |
| `app/admin/equipment/page.tsx` | Create | Equipment list UI + maintenance history + dashboard |

---

## Task 1 — Prisma Schema: Equipment & MaintenanceRecord models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `equipment` relation to Cafe model**

In `prisma/schema.prisma`, find the `Cafe` model relations block (around line 270+, where `marketingCampaigns`, `expenses`, etc. are listed) and add:

```prisma
  equipment          Equipment[]
```

- [ ] **Step 2: Add Equipment and MaintenanceRecord models at the end of schema.prisma**

Append after the `PremiumPlan` model (end of file):

```prisma
// ─── Equipment & Maintenance Management ───────────────────────────────────────

model Equipment {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  cafeId          String   @db.ObjectId
  cafe            Cafe     @relation(fields: [cafeId], references: [id])

  name            String                          // "Réfrigérateur Samsung"
  category        String                          // "refrigeration" | "cooking" | "coffee" | "pos" | "furniture" | "other"
  brand           String?
  serialNumber    String?
  purchaseDate    DateTime?
  purchasePrice   Float?
  supplier        String?
  warrantyEndsAt  DateTime?
  receiptUrl      String?                         // Cloudinary URL of purchase receipt
  photoUrl        String?                         // equipment photo
  status          String    @default("active")    // "active" | "maintenance" | "broken" | "retired"
  notes           String?

  maintenanceRecords MaintenanceRecord[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([cafeId])
  @@index([cafeId, status])
  @@index([warrantyEndsAt])
}

model MaintenanceRecord {
  id            String     @id @default(auto()) @map("_id") @db.ObjectId
  equipmentId   String     @db.ObjectId
  equipment     Equipment  @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  cafeId        String     @db.ObjectId             // denormalized for fast queries

  date          DateTime   @default(now())
  description   String
  technicianName String?
  technicianPhone String?
  cost          Float      @default(0)
  receiptUrl    String?                             // Cloudinary URL of invoice/receipt
  nextServiceAt DateTime?                          // scheduled next maintenance

  createdAt     DateTime   @default(now())

  @@index([equipmentId])
  @@index([cafeId])
  @@index([date])
}
```

- [ ] **Step 3: Generate Prisma client**

```bash
cd "/Users/mac/Documents/SaaS restau" && npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add Equipment and MaintenanceRecord models"
```

---

## Task 2 — Backend: Equipment & Maintenance API routes

**Files:**
- Create: `src/routes/equipment.ts`

Create the file with the following full content:

```typescript
import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

// ─── Equipment CRUD ───────────────────────────────────────────────────────────

// GET /api/v1/equipment — list all equipment for the cafe
router.get('/', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  try {
    const equipment = await prisma.equipment.findMany({
      where: { cafeId },
      orderBy: { createdAt: 'desc' },
      include: {
        maintenanceRecords: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { date: true, cost: true, nextServiceAt: true },
        },
        _count: { select: { maintenanceRecords: true } },
      },
    })
    return res.json({ items: equipment })
  } catch (err) {
    logger.error({ msg: 'equipment list error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/v1/equipment/:id — get single equipment with all maintenance records
router.get('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const { id } = req.params
  try {
    const equipment = await prisma.equipment.findFirst({
      where: { id, cafeId },
      include: {
        maintenanceRecords: { orderBy: { date: 'desc' } },
      },
    })
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' })
    return res.json(equipment)
  } catch (err) {
    logger.error({ msg: 'equipment get error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/v1/equipment — create equipment
router.post('/', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const {
    name, category, brand, serialNumber, purchaseDate, purchasePrice,
    supplier, warrantyEndsAt, receiptUrl, photoUrl, status, notes,
  } = req.body as {
    name:           string
    category:       string
    brand?:         string
    serialNumber?:  string
    purchaseDate?:  string
    purchasePrice?: number
    supplier?:      string
    warrantyEndsAt?: string
    receiptUrl?:    string
    photoUrl?:      string
    status?:        string
    notes?:         string
  }

  if (!name || !category) {
    return res.status(400).json({ error: 'name and category are required' })
  }

  try {
    const equipment = await prisma.equipment.create({
      data: {
        cafeId,
        name,
        category,
        brand:         brand         ?? null,
        serialNumber:  serialNumber  ?? null,
        purchaseDate:  purchaseDate  ? new Date(purchaseDate)  : null,
        purchasePrice: purchasePrice ?? null,
        supplier:      supplier      ?? null,
        warrantyEndsAt: warrantyEndsAt ? new Date(warrantyEndsAt) : null,
        receiptUrl:    receiptUrl    ?? null,
        photoUrl:      photoUrl      ?? null,
        status:        status        ?? 'active',
        notes:         notes         ?? null,
      },
    })
    return res.status(201).json(equipment)
  } catch (err) {
    logger.error({ msg: 'equipment create error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/v1/equipment/:id — update equipment
router.patch('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const { id } = req.params
  const {
    name, category, brand, serialNumber, purchaseDate, purchasePrice,
    supplier, warrantyEndsAt, receiptUrl, photoUrl, status, notes,
  } = req.body as Record<string, any>

  try {
    const existing = await prisma.equipment.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Equipment not found' })

    const equipment = await prisma.equipment.update({
      where: { id },
      data: {
        ...(name          !== undefined ? { name }                                        : {}),
        ...(category      !== undefined ? { category }                                    : {}),
        ...(brand         !== undefined ? { brand }                                       : {}),
        ...(serialNumber  !== undefined ? { serialNumber }                                : {}),
        ...(purchaseDate  !== undefined ? { purchaseDate: purchaseDate ? new Date(purchaseDate) : null } : {}),
        ...(purchasePrice !== undefined ? { purchasePrice }                               : {}),
        ...(supplier      !== undefined ? { supplier }                                    : {}),
        ...(warrantyEndsAt !== undefined ? { warrantyEndsAt: warrantyEndsAt ? new Date(warrantyEndsAt) : null } : {}),
        ...(receiptUrl    !== undefined ? { receiptUrl }                                  : {}),
        ...(photoUrl      !== undefined ? { photoUrl }                                    : {}),
        ...(status        !== undefined ? { status }                                      : {}),
        ...(notes         !== undefined ? { notes }                                       : {}),
      },
    })
    return res.json(equipment)
  } catch (err) {
    logger.error({ msg: 'equipment update error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/v1/equipment/:id — delete equipment (cascades maintenance records)
router.delete('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const { id } = req.params
  try {
    const existing = await prisma.equipment.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Equipment not found' })
    await prisma.equipment.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'equipment delete error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Maintenance Records ──────────────────────────────────────────────────────

// GET /api/v1/equipment/:id/maintenance — list maintenance records for one equipment
router.get('/:id/maintenance', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const { id } = req.params
  try {
    const equipment = await prisma.equipment.findFirst({ where: { id, cafeId } })
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' })

    const records = await prisma.maintenanceRecord.findMany({
      where: { equipmentId: id },
      orderBy: { date: 'desc' },
    })
    return res.json({ items: records })
  } catch (err) {
    logger.error({ msg: 'maintenance list error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/v1/equipment/:id/maintenance — add maintenance record
router.post('/:id/maintenance', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const { id } = req.params
  const {
    date, description, technicianName, technicianPhone,
    cost, receiptUrl, nextServiceAt,
  } = req.body as {
    date?:           string
    description:     string
    technicianName?: string
    technicianPhone?: string
    cost?:           number
    receiptUrl?:     string
    nextServiceAt?:  string
  }

  if (!description) return res.status(400).json({ error: 'description is required' })

  try {
    const equipment = await prisma.equipment.findFirst({ where: { id, cafeId } })
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' })

    const record = await prisma.maintenanceRecord.create({
      data: {
        equipmentId:    id,
        cafeId,
        date:           date          ? new Date(date) : new Date(),
        description,
        technicianName: technicianName  ?? null,
        technicianPhone: technicianPhone ?? null,
        cost:           cost           ?? 0,
        receiptUrl:     receiptUrl     ?? null,
        nextServiceAt:  nextServiceAt  ? new Date(nextServiceAt) : null,
      },
    })
    return res.status(201).json(record)
  } catch (err) {
    logger.error({ msg: 'maintenance create error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/v1/equipment/:equipId/maintenance/:recordId — delete one record
router.delete('/:equipId/maintenance/:recordId', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const { equipId, recordId } = req.params
  try {
    const record = await prisma.maintenanceRecord.findFirst({
      where: { id: recordId, equipmentId: equipId, cafeId },
    })
    if (!record) return res.status(404).json({ error: 'Record not found' })
    await prisma.maintenanceRecord.delete({ where: { id: recordId } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'maintenance delete error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Dashboard summary ────────────────────────────────────────────────────────

// GET /api/v1/equipment/summary — totals for dashboard cards
router.get('/summary/stats', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  try {
    const [equipment, maintenanceCosts] = await Promise.all([
      prisma.equipment.findMany({
        where: { cafeId },
        select: { id: true, status: true, purchasePrice: true, warrantyEndsAt: true },
      }),
      prisma.maintenanceRecord.aggregate({
        where: { cafeId },
        _sum: { cost: true },
      }),
    ])

    const now = new Date()
    const in30days = new Date(now.getTime() + 30 * 86400000)

    return res.json({
      total:          equipment.length,
      active:         equipment.filter(e => e.status === 'active').length,
      maintenance:    equipment.filter(e => e.status === 'maintenance').length,
      broken:         equipment.filter(e => e.status === 'broken').length,
      totalPurchaseValue: equipment.reduce((s, e) => s + (e.purchasePrice ?? 0), 0),
      totalMaintenanceCost: maintenanceCosts._sum.cost ?? 0,
      warrantyExpiringSoon: equipment.filter(e =>
        e.warrantyEndsAt && e.warrantyEndsAt > now && e.warrantyEndsAt < in30days
      ).length,
    })
  } catch (err) {
    logger.error({ msg: 'equipment summary error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/equipment.ts
git commit -m "feat(api): add equipment and maintenance CRUD routes"
```

---

## Task 3 — Register router in server.ts

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add import**

Find the imports block (around line 57 where other routers are imported) and add:

```typescript
import equipmentRouter from './routes/equipment'
```

- [ ] **Step 2: Register route**

Find the route registrations block (around line 158 where `app.use(inventoryAdminRouter)` is) and add after it:

```typescript
  app.use('/api/v1/equipment', equipmentRouter)
```

- [ ] **Step 3: Verify build passes**

```bash
cd "/Users/mac/Documents/SaaS restau" && npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat(server): register equipment router at /api/v1/equipment"
```

---

## Task 4 — Frontend: Equipment Management Page

**Files:**
- Create: `app/admin/equipment/page.tsx`

Create the file with the following full content:

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Wrench, Plus, ChevronDown, ChevronUp, Trash2, Edit3,
  AlertTriangle, CheckCircle2, Clock, XCircle, Loader2,
  RefreshCw, DollarSign, Shield, BarChart3, Tool
} from 'lucide-react'
import { useLang } from '../lang-context'

// ─── Types ─────────────────────────────────────────────────────────────────────

type EquipStatus = 'active' | 'maintenance' | 'broken' | 'retired'

interface MaintenanceRecord {
  id:              string
  date:            string
  description:     string
  technicianName:  string | null
  technicianPhone: string | null
  cost:            number
  receiptUrl:      string | null
  nextServiceAt:   string | null
}

interface Equipment {
  id:              string
  name:            string
  category:        string
  brand:           string | null
  serialNumber:    string | null
  purchaseDate:    string | null
  purchasePrice:   number | null
  supplier:        string | null
  warrantyEndsAt:  string | null
  receiptUrl:      string | null
  photoUrl:        string | null
  status:          EquipStatus
  notes:           string | null
  maintenanceRecords: MaintenanceRecord[]
  _count:          { maintenanceRecords: number }
}

interface Summary {
  total:               number
  active:              number
  maintenance:         number
  broken:              number
  totalPurchaseValue:  number
  totalMaintenanceCost: number
  warrantyExpiringSoon: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

const CATEGORIES = [
  { value: 'refrigeration', label: '❄️ Réfrigération' },
  { value: 'cooking',       label: '🔥 Cuisson' },
  { value: 'coffee',        label: '☕ Café' },
  { value: 'pos',           label: '🖥️ POS / Caisse' },
  { value: 'furniture',     label: '🪑 Mobilier' },
  { value: 'other',         label: '🔧 Autre' },
]

const STATUS_META: Record<EquipStatus, { label: string; color: string; Icon: React.ElementType }> = {
  active:      { label: 'Actif',       color: 'text-emerald-400', Icon: CheckCircle2 },
  maintenance: { label: 'Maintenance', color: 'text-amber-400',   Icon: Clock        },
  broken:      { label: 'En panne',    color: 'text-rose-400',    Icon: XCircle      },
  retired:     { label: 'Retraité',    color: 'text-slate-500',   Icon: XCircle      },
}

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isWarrantyExpiringSoon(warrantyEndsAt: string | null) {
  if (!warrantyEndsAt) return false
  const d = new Date(warrantyEndsAt)
  const now = new Date()
  return d > now && d < new Date(now.getTime() + 30 * 86400000)
}

function isWarrantyExpired(warrantyEndsAt: string | null) {
  if (!warrantyEndsAt) return false
  return new Date(warrantyEndsAt) < new Date()
}

// ─── Empty form state ─────────────────────────────────────────────────────────

const EMPTY_EQUIP = {
  name: '', category: 'other', brand: '', serialNumber: '',
  purchaseDate: '', purchasePrice: '', supplier: '',
  warrantyEndsAt: '', receiptUrl: '', photoUrl: '', status: 'active' as EquipStatus, notes: '',
}

const EMPTY_MAINT = {
  date: '', description: '', technicianName: '', technicianPhone: '',
  cost: '', receiptUrl: '', nextServiceAt: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const { isRTL } = useLang()

  const [items,       setItems]       = useState<Equipment[]>([])
  const [summary,     setSummary]     = useState<Summary | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [showForm,    setShowForm]    = useState(false)
  const [editItem,    setEditItem]    = useState<Equipment | null>(null)
  const [equipForm,   setEquipForm]   = useState({ ...EMPTY_EQUIP })
  const [maintForms,  setMaintForms]  = useState<Record<string, typeof EMPTY_MAINT>>({})
  const [showMaintForm, setShowMaintForm] = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [eqRes, sumRes] = await Promise.all([
        fetch('/api/v1/equipment',              { headers: authHeader() }),
        fetch('/api/v1/equipment/summary/stats', { headers: authHeader() }),
      ])
      if (eqRes.ok)  setItems((await eqRes.json()).items ?? [])
      if (sumRes.ok) setSummary(await sumRes.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveEquip() {
    setSaving(true)
    try {
      const body = {
        ...equipForm,
        purchasePrice: equipForm.purchasePrice ? Number(equipForm.purchasePrice) : null,
        purchaseDate:  equipForm.purchaseDate  || null,
        warrantyEndsAt: equipForm.warrantyEndsAt || null,
        brand:         equipForm.brand         || null,
        serialNumber:  equipForm.serialNumber  || null,
        supplier:      equipForm.supplier      || null,
        receiptUrl:    equipForm.receiptUrl    || null,
        photoUrl:      equipForm.photoUrl      || null,
        notes:         equipForm.notes         || null,
      }
      const url    = editItem ? `/api/v1/equipment/${editItem.id}` : '/api/v1/equipment'
      const method = editItem ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowForm(false)
        setEditItem(null)
        setEquipForm({ ...EMPTY_EQUIP })
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteEquip(id: string) {
    if (!confirm('Supprimer cet équipement et tout son historique ?')) return
    await fetch(`/api/v1/equipment/${id}`, { method: 'DELETE', headers: authHeader() })
    await load()
  }

  async function saveMaint(equipId: string) {
    const f = maintForms[equipId] ?? { ...EMPTY_MAINT }
    setSaving(true)
    try {
      const res = await fetch(`/api/v1/equipment/${equipId}/maintenance`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          cost:          f.cost          ? Number(f.cost) : 0,
          date:          f.date          || null,
          nextServiceAt: f.nextServiceAt || null,
          technicianName:  f.technicianName  || null,
          technicianPhone: f.technicianPhone || null,
          receiptUrl:    f.receiptUrl    || null,
        }),
      })
      if (res.ok) {
        setShowMaintForm(null)
        setMaintForms(prev => ({ ...prev, [equipId]: { ...EMPTY_MAINT } }))
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteMaint(equipId: string, recordId: string) {
    if (!confirm('Supprimer cette intervention ?')) return
    await fetch(`/api/v1/equipment/${equipId}/maintenance/${recordId}`, {
      method: 'DELETE', headers: authHeader(),
    })
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-emerald-500" size={36} />
      </div>
    )
  }

  return (
    <div className={`max-w-5xl mx-auto px-4 py-8 space-y-8 ${isRTL ? 'text-right' : 'text-left'}`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10">
            <Wrench className="text-blue-400" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Équipements & Maintenance</h1>
            <p className="text-sm text-slate-400 mt-0.5">Gérez vos machines et suivez les interventions.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { setShowForm(true); setEditItem(null); setEquipForm({ ...EMPTY_EQUIP }) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total équipements', value: summary.total,        color: 'text-white',         bg: 'bg-white/5' },
            { label: 'Actifs',            value: summary.active,       color: 'text-emerald-400',   bg: 'bg-emerald-500/10' },
            { label: 'En panne / SAV',    value: summary.maintenance + summary.broken, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Garanties < 30j',   value: summary.warrantyExpiringSoon, color: 'text-rose-400', bg: 'bg-rose-500/10' },
          ].map(c => (
            <div key={c.label} className={`rounded-2xl border border-white/10 ${c.bg} p-4`}>
              <p className="text-xs text-slate-400">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
            <DollarSign className="text-slate-400 shrink-0" size={20} />
            <div>
              <p className="text-xs text-slate-400">Valeur totale achetée</p>
              <p className="text-lg font-bold text-white">{summary.totalPurchaseValue.toLocaleString('fr-FR')} MAD</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
            <BarChart3 className="text-slate-400 shrink-0" size={20} />
            <div>
              <p className="text-xs text-slate-400">Total coûts maintenance</p>
              <p className="text-lg font-bold text-amber-400">{summary.totalMaintenanceCost.toLocaleString('fr-FR')} MAD</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Equipment Form ───────────────────────────────────────── */}
      {showForm && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{editItem ? 'Modifier' : 'Nouvel équipement'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'name',          label: 'Nom *',            type: 'text'   },
              { key: 'brand',         label: 'Marque',           type: 'text'   },
              { key: 'serialNumber',  label: 'N° Série',         type: 'text'   },
              { key: 'supplier',      label: 'Fournisseur',      type: 'text'   },
              { key: 'purchaseDate',  label: 'Date achat',       type: 'date'   },
              { key: 'purchasePrice', label: 'Prix achat (MAD)', type: 'number' },
              { key: 'warrantyEndsAt', label: 'Fin garantie',    type: 'date'   },
              { key: 'receiptUrl',    label: 'URL facture',      type: 'url'    },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={(equipForm as any)[f.key]}
                  onChange={e => setEquipForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs text-slate-400 mb-1">Catégorie *</label>
              <select
                value={equipForm.category}
                onChange={e => setEquipForm(prev => ({ ...prev, category: e.target.value }))}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Statut</label>
              <select
                value={equipForm.status}
                onChange={e => setEquipForm(prev => ({ ...prev, status: e.target.value as EquipStatus }))}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="active">Actif</option>
                <option value="maintenance">Maintenance</option>
                <option value="broken">En panne</option>
                <option value="retired">Retraité</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              value={equipForm.notes}
              onChange={e => setEquipForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={saveEquip}
              disabled={saving || !equipForm.name}
              className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
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

      {/* ── Equipment List ─────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-12 text-center">
          <Wrench className="mx-auto text-slate-600 mb-3" size={40} />
          <p className="text-slate-400 text-sm">Aucun équipement enregistré.</p>
          <p className="text-slate-500 text-xs mt-1">Cliquez sur "Ajouter" pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const meta       = STATUS_META[item.status] ?? STATUS_META.active
            const StatusIcon = meta.Icon
            const isOpen     = expanded === item.id
            const warnSoon   = isWarrantyExpiringSoon(item.warrantyEndsAt)
            const warnExp    = isWarrantyExpired(item.warrantyEndsAt)
            const mf         = maintForms[item.id] ?? { ...EMPTY_MAINT }

            return (
              <div key={item.id} className="rounded-2xl border border-slate-700 bg-slate-800/50 overflow-hidden">

                {/* ── Equipment header row ───────────────────────────────── */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white">{item.name}</span>
                      {item.brand && <span className="text-xs text-slate-400">{item.brand}</span>}
                      <span className="text-xs text-slate-500">
                        {CATEGORIES.find(c => c.value === item.category)?.label ?? item.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className={`flex items-center gap-1 text-xs font-medium ${meta.color}`}>
                        <StatusIcon size={12} /> {meta.label}
                      </span>
                      {item.purchasePrice && (
                        <span className="text-xs text-slate-400">Achat: {item.purchasePrice.toLocaleString('fr-FR')} MAD</span>
                      )}
                      {item.warrantyEndsAt && (
                        <span className={`text-xs flex items-center gap-1 ${warnExp ? 'text-slate-500' : warnSoon ? 'text-rose-400' : 'text-slate-400'}`}>
                          <Shield size={11} />
                          Garantie {warnExp ? 'expirée' : `jusqu'au ${fmt(item.warrantyEndsAt)}`}
                          {warnSoon && !warnExp && ' ⚠️'}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        {item._count.maintenanceRecords} intervention{item._count.maintenanceRecords !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setEditItem(item)
                        setEquipForm({
                          name:           item.name,
                          category:       item.category,
                          brand:          item.brand          ?? '',
                          serialNumber:   item.serialNumber   ?? '',
                          purchaseDate:   item.purchaseDate   ? item.purchaseDate.slice(0, 10) : '',
                          purchasePrice:  item.purchasePrice  != null ? String(item.purchasePrice) : '',
                          supplier:       item.supplier       ?? '',
                          warrantyEndsAt: item.warrantyEndsAt ? item.warrantyEndsAt.slice(0, 10) : '',
                          receiptUrl:     item.receiptUrl     ?? '',
                          photoUrl:       item.photoUrl       ?? '',
                          status:         item.status,
                          notes:          item.notes          ?? '',
                        })
                        setShowForm(true)
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteEquip(item.id) }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                    {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>

                {/* ── Expanded: maintenance history ──────────────────────── */}
                {isOpen && (
                  <div className="border-t border-slate-700 p-4 space-y-4 bg-slate-900/30">

                    {/* Maintenance records */}
                    {item.maintenanceRecords.length === 0 ? (
                      <p className="text-sm text-slate-500">Aucune intervention enregistrée.</p>
                    ) : (
                      <div className="space-y-2">
                        {item.maintenanceRecords.map(r => (
                          <div key={r.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 flex gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-white">{fmt(r.date)}</span>
                                <span className="text-xs text-amber-400 font-semibold">{r.cost > 0 ? `${r.cost.toLocaleString('fr-FR')} MAD` : 'Gratuit'}</span>
                                {r.technicianName && <span className="text-xs text-slate-400">👷 {r.technicianName}</span>}
                                {r.technicianPhone && <span className="text-xs text-slate-500">{r.technicianPhone}</span>}
                              </div>
                              <p className="text-sm text-slate-300 mt-1">{r.description}</p>
                              {r.nextServiceAt && (
                                <p className="text-xs text-blue-400 mt-1">Prochain: {fmt(r.nextServiceAt)}</p>
                              )}
                              {r.receiptUrl && (
                                <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline mt-1 inline-block">
                                  📄 Voir la facture
                                </a>
                              )}
                            </div>
                            <button
                              onClick={() => deleteMaint(item.id, r.id)}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add maintenance record form */}
                    {showMaintForm === item.id ? (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-white">Nouvelle intervention</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { key: 'date',           label: 'Date',             type: 'date'   },
                            { key: 'cost',           label: 'Coût (MAD)',       type: 'number' },
                            { key: 'technicianName', label: 'Technicien',       type: 'text'   },
                            { key: 'technicianPhone',label: 'Tél. technicien',  type: 'tel'    },
                            { key: 'nextServiceAt',  label: 'Prochain service', type: 'date'   },
                            { key: 'receiptUrl',     label: 'URL facture',      type: 'url'    },
                          ].map(f => (
                            <div key={f.key}>
                              <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                              <input
                                type={f.type}
                                value={(mf as any)[f.key]}
                                onChange={e => setMaintForms(prev => ({
                                  ...prev,
                                  [item.id]: { ...(prev[item.id] ?? EMPTY_MAINT), [f.key]: e.target.value }
                                }))}
                                className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Description *</label>
                          <textarea
                            value={mf.description}
                            onChange={e => setMaintForms(prev => ({
                              ...prev,
                              [item.id]: { ...(prev[item.id] ?? EMPTY_MAINT), description: e.target.value }
                            }))}
                            rows={2}
                            placeholder="Ex: Remplacement compresseur, nettoyage filtre…"
                            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveMaint(item.id)}
                            disabled={saving || !mf.description}
                            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                          >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Enregistrer'}
                          </button>
                          <button
                            onClick={() => setShowMaintForm(null)}
                            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowMaintForm(item.id)}
                        className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <Plus size={14} /> Ajouter une intervention
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd "/Users/mac/Documents/SaaS restau" && npm run build 2>&1 | tail -10
```

Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add app/admin/equipment/page.tsx
git commit -m "feat(ui): add Equipment & Maintenance management page"
```

---

## Task 5 — Add Equipment link to admin sidebar

**Files:**
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Find the nav links array in layout.tsx**

Open `app/admin/layout.tsx` and find where the sidebar navigation links are defined (look for links like `/admin/inventory`, `/admin/marketing`, etc.)

- [ ] **Step 2: Add Equipment link**

Add the following entry to the nav links array, alongside inventory/marketing:

```tsx
{ href: '/admin/equipment', label: 'Équipements', icon: Wrench }
```

Also add the import at the top if `Wrench` isn't already imported from `lucide-react`:

```tsx
import { ..., Wrench } from 'lucide-react'
```

- [ ] **Step 3: Verify build passes**

```bash
cd "/Users/mac/Documents/SaaS restau" && npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat(nav): add Equipment link to admin sidebar"
```

---

## Final Verification

- [ ] Run full build: `npm run build`
- [ ] Navigate to `/admin/equipment` — equipment list loads, "Ajouter" button visible
- [ ] Add an equipment item — appears in list with correct status badge
- [ ] Expand equipment row — maintenance history shows, "Ajouter une intervention" button visible
- [ ] Add a maintenance record — appears with date, cost, technician
- [ ] Summary cards update after adding items
- [ ] Warranty expiry warning shows for equipment expiring within 30 days
- [ ] Edit equipment — form pre-fills correctly
- [ ] Delete equipment — removes from list with cascade
