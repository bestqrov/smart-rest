# Purchases → Payables Linking + Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link the existing `PurchaseRequisition` → `PurchaseOrder` → `SupplierInvoice` models via optional foreign keys, auto-generate an invoice when a PO is marked `received`, support partial payments via a new `SupplierPayment` model, and give the gérant/comptable a dedicated `/admin/achats` report (accounts-payable aging, spend trend, top suppliers, upcoming due invoices) plus a summary widget on the existing `/admin/financials` page.

**Architecture:** All new schema fields are optional/nullable — no breaking change to existing standalone `PurchaseOrder`/`SupplierInvoice` rows. Linking happens opportunistically at each step (requisition→PO, PO→invoice) but every model still works fully unlinked, exactly as it does today. Everything stays behind the existing `isSmartInventoryEnabled` premium gate.

**Tech Stack:** Express + Prisma (MongoDB) on the backend, Next.js App Router client components on the frontend, no test framework configured — verification follows this repo's existing convention (`scripts/controlTest*.ts`-style integration scripts run against a live dev server with `ts-node`, plus `tsc --noEmit` and a manual browser pass).

**Note on TDD in this repo:** There is no Jest/Vitest setup and no `*.test.ts` files anywhere in the codebase — the established verification pattern is a `scripts/*.ts` script using `node-fetch`/`fetch` + a tiny `ok()` assertion helper, run manually against `npm run dev`. This plan follows that convention: backend tasks are verified individually with quick manual `curl` checks, then a consolidated integration script (mirroring `scripts/controlTestComptoir.ts`) exercises the full chain. Frontend tasks are verified with `npx tsc --noEmit` per task, then a full manual browser pass in the final task.

---

## File Structure

**Schema:**
- Modify: `prisma/schema.prisma` — add `requisitionId` to `PurchaseOrder`, `purchaseOrderId` to `PurchaseRequisition`, `purchaseOrderId`+`amountPaid` to `SupplierInvoice`, new `SupplierPayment` model.

**Backend:**
- Create: `src/services/supplierInvoiceStatus.ts` — shared pure function to (re)compute an invoice's derived status.
- Modify: `src/routes/inventoryAdmin.ts` — export `requireInventory`; PO creation accepts optional `requisitionId`; PO receive auto-creates a `SupplierInvoice` and marks the linked requisition `received`.
- Modify: `src/routes/supplierInvoices.ts` — add payment sub-routes (`POST`/`GET /:id/payments`), fix the manual "mark paid" action to stay consistent with `amountPaid`.
- Create: `src/routes/achatsReport.ts` — `GET /api/admin/achats/report` (aging, spend trend, top suppliers, upcoming due, pending pipeline).
- Modify: `src/server.ts` — mount the new router.

**Test script:**
- Create: `scripts/controlTestAchats.ts` — integration coverage for everything above.

**Frontend:**
- Modify: `app/admin/requisitions/page.tsx` — "Commander" on an approved requisition now navigates to Purchase Orders with a prefill instead of silently flipping status.
- Modify: `app/admin/inventory/purchase-orders/page.tsx` — reads the prefill query params, opens the create modal pre-filled, sends `requisitionId` when creating.
- Modify: `app/admin/invoices/page.tsx` — adds `partial` status, a "record payment" mini-form, and a payment history list per invoice.
- Create: `app/admin/achats/page.tsx` — the new purchases report page.
- Modify: `app/admin/financials/page.tsx` — small "Achats" summary card linking to `/admin/achats`.
- Modify: `app/admin/layout.tsx` and `lib/adminI18n.ts` — nav entry + labels for the new page.

---

## Task 1: Schema changes

**Files:**
- Modify: `prisma/schema.prisma:1572-1596` (`PurchaseOrder`)
- Modify: `prisma/schema.prisma:1789-1811` (`SupplierInvoice`)
- Modify: `prisma/schema.prisma:1815-1836` (`PurchaseRequisition`)

- [ ] **Step 1: Add `requisitionId` to `PurchaseOrder`**

Find:

```prisma
// Tracks purchase order sent to a supplier for restocking
model PurchaseOrder {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  cafeId     String   @db.ObjectId
  cafe       Cafe     @relation(fields: [cafeId], references: [id])
  supplierId String   @db.ObjectId
  supplier   InventorySupplier @relation(fields: [supplierId], references: [id])

  // pending | ordered | received | cancelled
  status    String   @default("pending")
  notes     String   @default("")
  items     PurchaseOrderItem[]
  totalCost Float    @default(0)

  // Set when the PO is sent via WhatsApp/n8n webhook
  sentViaWhatsApp Boolean  @default(false)
  sentAt          DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([cafeId])
  @@index([supplierId])
  @@index([status])
  @@index([createdAt])
}
```

Replace with:

```prisma
// Tracks purchase order sent to a supplier for restocking
model PurchaseOrder {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  cafeId     String   @db.ObjectId
  cafe       Cafe     @relation(fields: [cafeId], references: [id])
  supplierId String   @db.ObjectId
  supplier   InventorySupplier @relation(fields: [supplierId], references: [id])

  // pending | ordered | received | cancelled
  status    String   @default("pending")
  notes     String   @default("")
  items     PurchaseOrderItem[]
  totalCost Float    @default(0)

  // Optional link back to the requisition this PO was created from.
  // Null when the PO was created directly (no requisition involved).
  requisitionId String? @db.ObjectId

  // Set when the PO is sent via WhatsApp/n8n webhook
  sentViaWhatsApp Boolean  @default(false)
  sentAt          DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([cafeId])
  @@index([supplierId])
  @@index([status])
  @@index([createdAt])
  @@index([requisitionId])
}
```

- [ ] **Step 2: Add `purchaseOrderId`+`amountPaid` to `SupplierInvoice`**

Find:

```prisma
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

  @@unique([cafeId, id])
  @@index([cafeId])
  @@index([cafeId, status])
  @@index([dueDate])
}
```

Replace with:

```prisma
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
  // unpaid | partial | paid | overdue — recomputed whenever a payment is
  // recorded (see src/services/supplierInvoiceStatus.ts). Still a plain
  // stored field (not a Prisma computed field) so existing reads/filters
  // keep working unchanged.
  status        String   @default("unpaid")
  documentUrl   String?
  notes         String?

  // Optional link back to the PO this invoice was auto-generated from.
  // Null for manual/standalone invoices (today's only flow).
  purchaseOrderId String? @db.ObjectId
  // Running total of payments recorded against this invoice.
  amountPaid      Float   @default(0)

  payments      SupplierPayment[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([cafeId, id])
  @@index([cafeId])
  @@index([cafeId, status])
  @@index([dueDate])
  @@index([purchaseOrderId])
}

// One payment (partial or full) recorded against a SupplierInvoice.
model SupplierPayment {
  id        String          @id @default(auto()) @map("_id") @db.ObjectId
  invoiceId String          @db.ObjectId
  invoice   SupplierInvoice @relation(fields: [invoiceId], references: [id])
  cafeId    String          @db.ObjectId

  amount    Float
  paidAt    DateTime @default(now())
  // cash | card | virement
  method    String   @default("cash")
  notes     String?

  createdAt DateTime @default(now())

  @@index([invoiceId])
  @@index([cafeId])
}
```

- [ ] **Step 3: Add `purchaseOrderId` to `PurchaseRequisition`**

Find:

```prisma
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

Replace with:

```prisma
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

  // Set once a PurchaseOrder is created from this requisition.
  purchaseOrderId String? @db.ObjectId

  approvedAt     DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([cafeId])
  @@index([cafeId, status])
  @@index([cafeId, urgency])
  @@index([purchaseOrderId])
}
```

- [ ] **Step 4: Push schema + regenerate client**

Run: `npx prisma db push && npx prisma generate`
Expected: `SupplierPayment` collection created, no errors.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (no code references the new fields yet, so this just confirms the schema itself compiles).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): link Requisition/PurchaseOrder/SupplierInvoice + add SupplierPayment"
```

---

## Task 2: Shared invoice-status helper

**Files:**
- Create: `src/services/supplierInvoiceStatus.ts`

- [ ] **Step 1: Write the helper**

```typescript
// Recomputes a SupplierInvoice's derived status from its amount/amountPaid/dueDate.
// Called whenever a payment is written so `status` (a plain stored string field,
// not a Prisma computed field) stays consistent with the payment ledger.

export type SupplierInvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'

export function computeInvoiceStatus(params: {
  amount: number
  amountPaid: number
  dueDate: Date | null
  now?: Date
}): SupplierInvoiceStatus {
  const { amount, amountPaid, dueDate } = params
  const now = params.now ?? new Date()

  if (amountPaid >= amount) return 'paid'
  if (dueDate && dueDate < now) return 'overdue'
  if (amountPaid > 0) return 'partial'
  return 'unpaid'
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/supplierInvoiceStatus.ts
git commit -m "feat(achats): add shared invoice-status computation helper"
```

---

## Task 3: Export `requireInventory` + accept `requisitionId` on PO creation

**Files:**
- Modify: `src/routes/inventoryAdmin.ts:48-65` (export the middleware)
- Modify: `src/routes/inventoryAdmin.ts:357-394` (PO creation)

- [ ] **Step 1: Export the feature-gate middleware**

Find:

```typescript
async function requireInventory(req: Request, res: Response, next: Function) {
```

Replace with:

```typescript
export async function requireInventory(req: Request, res: Response, next: Function) {
```

- [ ] **Step 2: Accept optional `requisitionId` when creating a PO**

Find:

```typescript
// POST /api/v1/inventory/purchase-orders
router.post('/api/v1/inventory/purchase-orders', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { supplierId, notes, items } = req.body as {
      supplierId: string
      notes?:     string
      items:      { stockItemName: string; unit: string; quantityOrdered: number; unitCost: number }[]
    }

    if (!supplierId) return res.status(400).json({ error: 'supplierId is required' })
    if (!items?.length) return res.status(400).json({ error: 'items array is required' })

    const supplier = await prisma.inventorySupplier.findFirst({ where: { id: supplierId, cafeId } })
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' })

    const enrichedItems = items.map(item => ({
      ...item,
      totalCost: item.quantityOrdered * item.unitCost
    }))
    const totalCost = enrichedItems.reduce((sum, i) => sum + i.totalCost, 0)

    const po = await prisma.purchaseOrder.create({
      data: {
        cafeId,
        supplierId,
        notes:    notes ?? '',
        items:    enrichedItems,
        totalCost
      },
      include: { supplier: { select: { id: true, name: true, phone: true, email: true } } }
    })
    return res.status(201).json(po)
  } catch (err) {
    logger.error({ msg: 'POST /api/v1/inventory/purchase-orders error', err })
    return res.status(500).json({ error: 'Failed to create purchase order' })
  }
})
```

Replace with:

```typescript
// POST /api/v1/inventory/purchase-orders
router.post('/api/v1/inventory/purchase-orders', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { supplierId, notes, items, requisitionId } = req.body as {
      supplierId:     string
      notes?:         string
      items:          { stockItemName: string; unit: string; quantityOrdered: number; unitCost: number }[]
      requisitionId?: string
    }

    if (!supplierId) return res.status(400).json({ error: 'supplierId is required' })
    if (!items?.length) return res.status(400).json({ error: 'items array is required' })

    const supplier = await prisma.inventorySupplier.findFirst({ where: { id: supplierId, cafeId } })
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' })

    let requisition = null
    if (requisitionId) {
      requisition = await prisma.purchaseRequisition.findFirst({ where: { id: requisitionId, cafeId } })
      if (!requisition) return res.status(404).json({ error: 'Requisition not found' })
    }

    const enrichedItems = items.map(item => ({
      ...item,
      totalCost: item.quantityOrdered * item.unitCost
    }))
    const totalCost = enrichedItems.reduce((sum, i) => sum + i.totalCost, 0)

    const po = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          cafeId,
          supplierId,
          notes:    notes ?? '',
          items:    enrichedItems,
          totalCost,
          ...(requisition && { requisitionId: requisition.id })
        },
        include: { supplier: { select: { id: true, name: true, phone: true, email: true } } }
      })
      if (requisition) {
        await tx.purchaseRequisition.update({
          where: { id: requisition.id },
          data:  { status: 'ordered', purchaseOrderId: created.id }
        })
      }
      return created
    })
    return res.status(201).json(po)
  } catch (err) {
    logger.error({ msg: 'POST /api/v1/inventory/purchase-orders error', err })
    return res.status(500).json({ error: 'Failed to create purchase order' })
  }
})
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run `npm run dev`, then create a requisition, approve it, and via `curl` create a PO with its id as `requisitionId`:

```bash
curl -X POST http://localhost:3000/api/v1/inventory/purchase-orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"supplierId":"<id>","requisitionId":"<req-id>","items":[{"stockItemName":"Tomatoes","unit":"kg","quantityOrdered":5,"unitCost":10}]}'
```

Expected: `201` with `requisitionId` set on the returned PO. Then `GET /api/v1/requisitions` shows that requisition with `status: "ordered"` and `purchaseOrderId` set.

- [ ] **Step 5: Commit**

```bash
git add src/routes/inventoryAdmin.ts
git commit -m "feat(achats): link PO creation to an originating requisition"
```

---

## Task 4: Auto-create a `SupplierInvoice` when a PO is received

**Files:**
- Modify: `src/routes/inventoryAdmin.ts:396-474` (PO receive handler)

- [ ] **Step 1: Auto-generate the invoice + mark the linked requisition received**

Find:

```typescript
    // When marking as received, auto-restock the inventory quantities
    if (status === 'received' && existing.status !== 'received') {
      await prisma.$transaction(async (tx) => {
        for (const item of existing.items as any[]) {
          const stockItem = await tx.stockItem.findUnique({
            where: { cafeId_ingredientName: { cafeId, ingredientName: item.stockItemName } }
          })
          if (stockItem) {
            const newQty = stockItem.currentQty + item.quantityOrdered
            await tx.stockItem.update({
              where: { id: stockItem.id },
              data:  {
                currentQty:     newQty,
                isLow:          newQty < stockItem.minimumThreshold,
                lastRestockedAt: new Date()
              }
            })
          }
        }

        await tx.purchaseOrder.update({
          where: { id },
          data:  { status, ...(notes !== undefined && { notes }) }
        })

        await tx.systemNotification.create({
          data: {
            cafeId,
            type:    'PO_RECEIVED',
            title:   `Purchase Order Received`,
            body:    `Stock levels updated for ${existing.items.length} item(s). PO from ${(await tx.inventorySupplier.findUnique({ where: { id: existing.supplierId }, select: { name: true } }))?.name ?? 'supplier'}.`,
            refId:   id,
            refType: 'purchase_order'
          }
        })
      })
      const updated = await prisma.purchaseOrder.findFirst({ where: { id }, include: { supplier: true } })
      return res.json(updated)
    }
```

Replace with:

```typescript
    // When marking as received, auto-restock the inventory quantities,
    // auto-generate the supplier invoice, and mark the linked requisition received.
    if (status === 'received' && existing.status !== 'received') {
      const receivedAt = new Date()
      const dueDate = new Date(receivedAt)
      dueDate.setDate(dueDate.getDate() + 30)

      await prisma.$transaction(async (tx) => {
        for (const item of existing.items as any[]) {
          const stockItem = await tx.stockItem.findUnique({
            where: { cafeId_ingredientName: { cafeId, ingredientName: item.stockItemName } }
          })
          if (stockItem) {
            const newQty = stockItem.currentQty + item.quantityOrdered
            await tx.stockItem.update({
              where: { id: stockItem.id },
              data:  {
                currentQty:     newQty,
                isLow:          newQty < stockItem.minimumThreshold,
                lastRestockedAt: new Date()
              }
            })
          }
        }

        await tx.purchaseOrder.update({
          where: { id },
          data:  { status, ...(notes !== undefined && { notes }) }
        })

        const supplier = await tx.inventorySupplier.findUnique({ where: { id: existing.supplierId }, select: { name: true } })

        await tx.supplierInvoice.create({
          data: {
            cafeId,
            supplierName: supplier?.name ?? 'Supplier',
            amount:       existing.totalCost,
            currency:     'MAD',
            issueDate:    receivedAt,
            dueDate,
            status:       'unpaid',
            purchaseOrderId: id,
          }
        })

        if (existing.requisitionId) {
          await tx.purchaseRequisition.update({
            where: { id: existing.requisitionId },
            data:  { status: 'received' }
          })
        }

        await tx.systemNotification.create({
          data: {
            cafeId,
            type:    'PO_RECEIVED',
            title:   `Purchase Order Received`,
            body:    `Stock levels updated for ${existing.items.length} item(s). PO from ${supplier?.name ?? 'supplier'}.`,
            refId:   id,
            refType: 'purchase_order'
          }
        })
      })
      const updated = await prisma.purchaseOrder.findFirst({ where: { id }, include: { supplier: true } })
      return res.json(updated)
    }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Manual check**

Mark the PO from Task 3 as received:

```bash
curl -X PATCH http://localhost:3000/api/v1/inventory/purchase-orders/<po-id> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"received"}'
```

Expected: `200`. Then `GET /api/v1/invoices` shows a new `unpaid` invoice with `purchaseOrderId` set and `amount` equal to the PO's `totalCost`, and `GET /api/v1/requisitions` shows the linked requisition with `status: "received"`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/inventoryAdmin.ts
git commit -m "feat(achats): auto-generate supplier invoice when a PO is received"
```

---

## Task 5: Partial-payment endpoints on `SupplierInvoice`

**Files:**
- Modify: `src/routes/supplierInvoices.ts`

- [ ] **Step 1: Import the status helper**

Find:

```typescript
import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'
```

Replace with:

```typescript
import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'
import { computeInvoiceStatus } from '../services/supplierInvoiceStatus'
```

- [ ] **Step 2: Add payment endpoints**

Find (end of file):

```typescript
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

Replace with:

```typescript
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

// ─── Payments ──────────────────────────────────────────────────────────────

router.get('/:id/payments', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  try {
    const invoice = await prisma.supplierInvoice.findFirst({ where: { id, cafeId } })
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    const payments = await prisma.supplierPayment.findMany({
      where:   { invoiceId: id, cafeId },
      orderBy: { paidAt: 'desc' },
    })
    return res.json({ items: payments })
  } catch (err) {
    logger.error({ msg: 'invoice payments list error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/payments', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  const { amount, method, notes, paidAt } = req.body as Record<string, any>

  if (amount == null || Number(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' })
  }

  try {
    const invoice = await prisma.supplierInvoice.findFirst({ where: { id, cafeId } })
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    const newAmountPaid = invoice.amountPaid + Number(amount)
    const newStatus = computeInvoiceStatus({
      amount:     invoice.amount,
      amountPaid: newAmountPaid,
      dueDate:    invoice.dueDate,
    })

    const [payment] = await prisma.$transaction([
      prisma.supplierPayment.create({
        data: {
          invoiceId: id,
          cafeId,
          amount:    Number(amount),
          method:    method ?? 'cash',
          notes:     notes ?? null,
          ...(paidAt && { paidAt: new Date(paidAt) }),
        },
      }),
      prisma.supplierInvoice.update({
        where: { id },
        data:  { amountPaid: newAmountPaid, status: newStatus },
      }),
    ])

    return res.status(201).json({ payment, amountPaid: newAmountPaid, status: newStatus })
  } catch (err) {
    logger.error({ msg: 'invoice payment create error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
```

- [ ] **Step 3: Keep the existing "mark paid" quick action consistent**

Find:

```typescript
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

    const invoice = await prisma.supplierInvoice.update({ where: { id }, data })
    return res.json(invoice)
  } catch (err) {
    logger.error({ msg: 'invoice update error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})
```

Replace with:

```typescript
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
    if (body.documentUrl   !== undefined) data.documentUrl   = body.documentUrl
    if (body.notes         !== undefined) data.notes         = body.notes
    if (body.status        !== undefined) {
      data.status = body.status
      // The legacy "mark paid" shortcut fully pays the invoice so
      // amountPaid stays consistent with status for anyone still using it.
      if (body.status === 'paid') data.amountPaid = body.amount !== undefined ? Number(body.amount) : existing.amount
    }

    const invoice = await prisma.supplierInvoice.update({ where: { id }, data })
    return res.json(invoice)
  } catch (err) {
    logger.error({ msg: 'invoice update error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Manual check**

Record a partial payment against the invoice created in Task 4:

```bash
curl -X POST http://localhost:3000/api/v1/invoices/<invoice-id>/payments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount": 20, "method": "cash"}'
```

Expected: `201` with `status: "partial"` if `amount < invoice.amount`, `"paid"` if it fully covers it. `GET /api/v1/invoices/<id>/payments` returns the recorded payment.

- [ ] **Step 6: Commit**

```bash
git add src/routes/supplierInvoices.ts
git commit -m "feat(achats): add partial-payment endpoints for supplier invoices"
```

---

## Task 6: Achats report endpoint

**Files:**
- Create: `src/routes/achatsReport.ts`

- [ ] **Step 1: Write the report route**

```typescript
/**
 * GET /api/admin/achats/report?period=week|month|custom&from=&to=
 *
 * Consolidated purchases report: accounts-payable aging, spend trend,
 * top suppliers, upcoming due invoices, and the pending pipeline
 * (requisitions awaiting approval/order, POs awaiting receipt).
 */

import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import { requireInventory } from './inventoryAdmin'
import prisma from '../prisma'
import logger from '../logger'

const router = express.Router()

router.get('/api/admin/achats/report', authorizeAdmin, requireInventory, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { period = 'month', from, to } = req.query as Record<string, string>

    const now = new Date()
    let fromDate: Date
    if (from) {
      fromDate = new Date(from)
    } else if (period === 'week') {
      fromDate = new Date(now); fromDate.setDate(now.getDate() - 7)
    } else {
      fromDate = new Date(now); fromDate.setMonth(now.getMonth() - 1)
    }
    const toDate = to ? new Date(to) : now

    // ── Accounts payable aging (all unpaid/partial/overdue invoices, any date) ──
    const outstanding = await prisma.supplierInvoice.findMany({
      where:  { cafeId, status: { in: ['unpaid', 'partial', 'overdue'] } },
      select: { amount: true, amountPaid: true, dueDate: true },
    })

    const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    for (const inv of outstanding) {
      const remaining = inv.amount - inv.amountPaid
      const dueDate = inv.dueDate ?? now
      const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)
      if (daysPastDue <= 30)      aging['0-30']  += remaining
      else if (daysPastDue <= 60) aging['31-60'] += remaining
      else if (daysPastDue <= 90) aging['61-90'] += remaining
      else                        aging['90+']   += remaining
    }
    const agingTotal = Object.values(aging).reduce((s, v) => s + v, 0)

    // ── Spend trend (invoices issued within the period, by day) ─────────────────
    const periodInvoices = await prisma.supplierInvoice.findMany({
      where:  { cafeId, issueDate: { gte: fromDate, lte: toDate } },
      select: { amount: true, issueDate: true, supplierName: true },
    })

    const dailySpend: Record<string, number> = {}
    const bySupplier: Record<string, number> = {}
    let spendThisPeriod = 0
    for (const inv of periodInvoices) {
      spendThisPeriod += inv.amount
      const day = inv.issueDate.toISOString().slice(0, 10)
      dailySpend[day] = (dailySpend[day] ?? 0) + inv.amount
      bySupplier[inv.supplierName] = (bySupplier[inv.supplierName] ?? 0) + inv.amount
    }
    const spendTrend = Object.keys(dailySpend).sort().map(date => ({
      date, spend: parseFloat(dailySpend[date].toFixed(2)),
    }))

    const topSuppliers = Object.entries(bySupplier)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([supplierName, total]) => ({ supplierName, total: parseFloat(total.toFixed(2)) }))

    // ── Upcoming due (next 7 days, not yet paid) ─────────────────────────────────
    const sevenDaysOut = new Date(now); sevenDaysOut.setDate(now.getDate() + 7)
    const upcomingDue = await prisma.supplierInvoice.findMany({
      where: {
        cafeId,
        status:  { in: ['unpaid', 'partial'] },
        dueDate: { gte: now, lte: sevenDaysOut },
      },
      select: { id: true, supplierName: true, amount: true, amountPaid: true, currency: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
    })

    // ── Pending pipeline ──────────────────────────────────────────────────────
    const [pendingRequisitions, orderedPOs] = await Promise.all([
      prisma.purchaseRequisition.count({ where: { cafeId, status: 'pending' } }),
      prisma.purchaseOrder.count({ where: { cafeId, status: 'ordered' } }),
    ])

    return res.json({
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      aging: { ...aging, total: parseFloat(agingTotal.toFixed(2)) },
      spendTrend,
      topSuppliers,
      upcomingDue,
      pending: { pendingRequisitions, orderedPOs },
      totals: {
        unpaidTotal:     parseFloat(agingTotal.toFixed(2)),
        spendThisPeriod: parseFloat(spendThisPeriod.toFixed(2)),
      },
    })
  } catch (err) {
    logger.error({ msg: 'achats/report error', err })
    return res.status(500).json({ error: 'Failed to generate report' })
  }
})

export default router
```

- [ ] **Step 2: Mount the router**

Find (in `src/server.ts`):

```typescript
import supplierInvoicesRouter from './routes/supplierInvoices'
import requisitionsRouter     from './routes/requisitions'
```

Replace with:

```typescript
import supplierInvoicesRouter from './routes/supplierInvoices'
import requisitionsRouter     from './routes/requisitions'
import achatsReportRouter     from './routes/achatsReport'
```

Find:

```typescript
  app.use('/api/v1/invoices',     supplierInvoicesRouter)
  app.use('/api/v1/requisitions', requisitionsRouter)
```

Replace with:

```typescript
  app.use('/api/v1/invoices',     supplierInvoicesRouter)
  app.use('/api/v1/requisitions', requisitionsRouter)
  app.use(achatsReportRouter)
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, then `curl http://localhost:3000/api/admin/achats/report?period=month -H "Authorization: Bearer $TOKEN"`
Expected: `200` with `aging`, `spendTrend`, `topSuppliers`, `upcomingDue`, `pending`, `totals` keys populated from the data created in earlier tasks.

- [ ] **Step 5: Commit**

```bash
git add src/routes/achatsReport.ts src/server.ts
git commit -m "feat(achats): add consolidated purchases report endpoint"
```

---

## Task 7: Consolidated backend integration test script

**Files:**
- Create: `scripts/controlTestAchats.ts`

- [ ] **Step 1: Write the script**

```typescript
/**
 * Integration coverage for the Requisition → PO → Invoice → Payment chain
 * and the achats report endpoint. Run against a live dev server:
 *   npx ts-node --transpile-only scripts/controlTestAchats.ts
 */
import 'dotenv/config'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
let passed = 0, failed = 0

function ok(cond: boolean, label: string) {
  if (cond) { console.log(`  ✅  ${label}`); passed++ }
  else      { console.log(`  ❌  ${label}`); failed++ }
}

async function json(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, opts)
  const data = await res.json().catch(() => null)
  return { res, data }
}

async function main() {
  console.log('\n── Setup ───────────────────────────────────────────────')
  const adminEmail = process.env.TEST_ADMIN_EMAIL ?? 'plage@demo.com'
  const adminPass  = process.env.TEST_ADMIN_PASSWORD ?? 'demo1234'

  const { res: loginRes, data: login } = await json('/api/auth/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPass }),
  })
  ok(loginRes.status === 200, 'admin login → 200')
  const token = login.token as string
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  console.log('\n── Requisition → PO ─────────────────────────────────────')
  const { res: reqRes, data: req } = await json('/api/v1/requisitions', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ itemName: 'Test Ingredient', quantity: 3, requestedBy: 'Control Test' }),
  })
  ok(reqRes.status === 201, 'POST /api/v1/requisitions → 201')

  await json(`/api/v1/requisitions/${req.id}`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ status: 'approved' }),
  })

  const { data: suppliers } = await json('/api/v1/inventory/suppliers', { headers: auth })
  ok(Array.isArray(suppliers) && suppliers.length > 0, 'at least one supplier exists for the test cafe')
  const supplierId = suppliers[0].id

  const { res: poRes, data: po } = await json('/api/v1/inventory/purchase-orders', {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      supplierId, requisitionId: req.id,
      items: [{ stockItemName: 'Test Ingredient', unit: 'kg', quantityOrdered: 3, unitCost: 10 }],
    }),
  })
  ok(poRes.status === 201, 'POST /api/v1/inventory/purchase-orders (linked) → 201')
  ok(po.requisitionId === req.id, 'PO.requisitionId matches the requisition')

  const { data: reqAfterOrder } = await json(`/api/v1/requisitions?status=ordered`, { headers: auth })
  ok(reqAfterOrder.items.some((r: any) => r.id === req.id), 'linked requisition moved to status=ordered')

  console.log('\n── PO → Invoice (auto-created on receive) ───────────────')
  const { res: receiveRes, data: received } = await json(`/api/v1/inventory/purchase-orders/${po.id}`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ status: 'received' }),
  })
  ok(receiveRes.status === 200, 'PATCH purchase-order status=received → 200')

  const { data: invoices } = await json('/api/v1/invoices', { headers: auth })
  const autoInvoice = invoices.items.find((i: any) => i.purchaseOrderId === po.id)
  ok(!!autoInvoice, 'SupplierInvoice auto-created with purchaseOrderId set')
  ok(autoInvoice.amount === po.totalCost, 'auto-invoice amount matches PO totalCost')
  ok(autoInvoice.status === 'unpaid', 'auto-invoice starts unpaid')

  const { data: reqAfterReceive } = await json(`/api/v1/requisitions?status=received`, { headers: auth })
  ok(reqAfterReceive.items.some((r: any) => r.id === req.id), 'linked requisition moved to status=received')

  console.log('\n── Invoice → Payment (partial then full) ────────────────')
  const halfAmount = autoInvoice.amount / 2
  const { res: pay1Res, data: pay1 } = await json(`/api/v1/invoices/${autoInvoice.id}/payments`, {
    method: 'POST', headers: auth, body: JSON.stringify({ amount: halfAmount, method: 'cash' }),
  })
  ok(pay1Res.status === 201, 'POST payment (partial) → 201')
  ok(pay1.status === 'partial', 'invoice status becomes partial after half-payment')

  const { res: pay2Res, data: pay2 } = await json(`/api/v1/invoices/${autoInvoice.id}/payments`, {
    method: 'POST', headers: auth, body: JSON.stringify({ amount: halfAmount, method: 'cash' }),
  })
  ok(pay2Res.status === 201, 'POST payment (remainder) → 201')
  ok(pay2.status === 'paid', 'invoice status becomes paid after full payment')

  const { data: paymentsList } = await json(`/api/v1/invoices/${autoInvoice.id}/payments`, { headers: auth })
  ok(paymentsList.items.length === 2, 'both payments recorded in payment history')

  console.log('\n── Achats report ─────────────────────────────────────────')
  const { res: reportRes, data: report } = await json('/api/admin/achats/report?period=month', { headers: auth })
  ok(reportRes.status === 200, 'GET /api/admin/achats/report → 200')
  ok(typeof report.aging.total === 'number', 'report includes aging total')
  ok(Array.isArray(report.spendTrend), 'report includes spendTrend array')
  ok(Array.isArray(report.topSuppliers), 'report includes topSuppliers array')
  ok(Array.isArray(report.upcomingDue), 'report includes upcomingDue array')
  ok(typeof report.pending.pendingRequisitions === 'number', 'report includes pending pipeline counts')

  console.log('\n── Summary ──────────────────────────────────────────────')
  console.log(`  ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Run it**

Run: `npm run dev`, then in another terminal `npx ts-node --transpile-only scripts/controlTestAchats.ts`
Expected: all assertions pass (`N passed, 0 failed`).

- [ ] **Step 3: Commit**

```bash
git add scripts/controlTestAchats.ts
git commit -m "test: add Requisition→PO→Invoice→Payment integration control test"
```

---

## Task 8: Requisitions page — "Commander" navigates to Purchase Orders

**Files:**
- Modify: `app/admin/requisitions/page.tsx`

- [ ] **Step 1: Import `useRouter`**

Find:

```tsx
import { useEffect, useState, useCallback } from 'react'
import {
  ShoppingCart, Plus, Trash2, Edit3, Loader2, RefreshCw,
  CheckCircle2, Clock, Package, XCircle, ChevronRight
} from 'lucide-react'
import { useLang } from '../lang-context'
```

Replace with:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart, Plus, Trash2, Edit3, Loader2, RefreshCw,
  CheckCircle2, Clock, Package, XCircle, ChevronRight
} from 'lucide-react'
import { useLang } from '../lang-context'
```

- [ ] **Step 2: Remove `approved → ordered` from the direct-PATCH transitions**

Find:

```typescript
const NEXT_STATUS: Partial<Record<ReqStatus, { next: ReqStatus; label: string }>> = {
  pending:  { next: 'approved', label: 'Approuver'  },
  approved: { next: 'ordered',  label: 'Commander'  },
  ordered:  { next: 'received', label: 'Reçu ✓'     },
}
```

Replace with:

```typescript
// 'approved' is handled separately below — it navigates to Purchase Orders
// to create a real linked PO instead of silently flipping status.
const NEXT_STATUS: Partial<Record<ReqStatus, { next: ReqStatus; label: string }>> = {
  pending:  { next: 'approved', label: 'Approuver'  },
  ordered:  { next: 'received', label: 'Reçu ✓'     },
}
```

- [ ] **Step 3: Add the router hook and a navigation helper**

Find:

```tsx
export default function RequisitionsPage() {
  const { isRTL } = useLang()
```

Replace with:

```tsx
export default function RequisitionsPage() {
  const { isRTL } = useLang()
  const router = useRouter()

  function orderFromRequisition(req: PurchaseRequisition) {
    const params = new URLSearchParams({
      fromRequisition: req.id,
      itemName:        req.itemName,
      quantity:        String(req.quantity),
      unit:             req.unit,
      ...(req.estimatedPrice != null && { estimatedPrice: String(req.estimatedPrice) }),
    })
    router.push(`/admin/inventory/purchase-orders?${params.toString()}`)
  }
```

- [ ] **Step 4: Render the "Commander" button for `approved` requisitions**

Find:

```tsx
                <div className="flex items-center gap-2 shrink-0">
                  {nextStep && (
                    <button
                      onClick={() => advanceStatus(req.id, nextStep.next)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/30 text-teal-400 text-xs font-semibold transition-colors"
                    >
                      {nextStep.label} <ChevronRight size={12} />
                    </button>
                  )}
```

Replace with:

```tsx
                <div className="flex items-center gap-2 shrink-0">
                  {req.status === 'approved' && (
                    <button
                      onClick={() => orderFromRequisition(req)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/30 text-teal-400 text-xs font-semibold transition-colors"
                    >
                      Commander <ChevronRight size={12} />
                    </button>
                  )}
                  {nextStep && (
                    <button
                      onClick={() => advanceStatus(req.id, nextStep.next)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/30 text-teal-400 text-xs font-semibold transition-colors"
                    >
                      {nextStep.label} <ChevronRight size={12} />
                    </button>
                  )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/admin/requisitions/page.tsx
git commit -m "feat(achats): requisitions 'Commander' navigates to Purchase Orders with prefill"
```

---

## Task 9: Purchase Orders page — read prefill, send `requisitionId`

**Files:**
- Modify: `app/admin/inventory/purchase-orders/page.tsx`

- [ ] **Step 1: Import `useSearchParams`**

Find:

```tsx
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
```

Replace with:

```tsx
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
```

- [ ] **Step 2: Let `CreatePOModal` accept a prefill line item**

Find:

```tsx
function CreatePOModal({
  suppliers, stockItems, onClose, onSave, lang
}: {
  suppliers:  Supplier[]
  stockItems: StockItem[]
  onClose:    () => void
  onSave:     (data: { supplierId: string; notes: string; items: Omit<POItem, 'totalCost'>[] }) => Promise<void>
  lang:       string
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '')
  const [notes,      setNotes]      = useState('')
  const [lines, setLines] = useState<{ stockItemName: string; unit: string; quantityOrdered: number; unitCost: number }[]>([
    { stockItemName: '', unit: 'kg', quantityOrdered: 1, unitCost: 0 }
  ])
```

Replace with:

```tsx
function CreatePOModal({
  suppliers, stockItems, onClose, onSave, lang, prefillLine
}: {
  suppliers:  Supplier[]
  stockItems: StockItem[]
  onClose:    () => void
  onSave:     (data: { supplierId: string; notes: string; items: Omit<POItem, 'totalCost'>[] }) => Promise<void>
  lang:       string
  prefillLine?: { stockItemName: string; unit: string; quantityOrdered: number; unitCost: number }
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '')
  const [notes,      setNotes]      = useState('')
  const [lines, setLines] = useState<{ stockItemName: string; unit: string; quantityOrdered: number; unitCost: number }[]>([
    prefillLine ?? { stockItemName: '', unit: 'kg', quantityOrdered: 1, unitCost: 0 }
  ])
```

- [ ] **Step 3: Read the prefill query params and carry `requisitionId` through creation**

Find:

```tsx
  const [orders,     setOrders]     = useState<PurchaseOrder[]>([])
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
```

Replace with:

```tsx
  const searchParams = useSearchParams()
  const router = useRouter()

  const [orders,     setOrders]     = useState<PurchaseOrder[]>([])
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const fromRequisitionId = searchParams.get('fromRequisition')
  const prefillLine = fromRequisitionId ? {
    stockItemName:   searchParams.get('itemName') ?? '',
    unit:            searchParams.get('unit') ?? 'kg',
    quantityOrdered: Number(searchParams.get('quantity') ?? '1'),
    unitCost:        searchParams.get('estimatedPrice') && searchParams.get('quantity')
      ? Number(searchParams.get('estimatedPrice')) / Number(searchParams.get('quantity'))
      : 0,
  } : undefined

  useEffect(() => {
    if (fromRequisitionId) setShowCreate(true)
  }, [fromRequisitionId])
```

- [ ] **Step 4: Send `requisitionId` on create, clear the query param afterwards**

Find:

```typescript
  async function handleCreate(data: any) {
    const res = await fetch('/api/v1/inventory/purchase-orders', {
      method:  'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body:    JSON.stringify(data)
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    await fetchAll()
  }
```

Replace with:

```typescript
  async function handleCreate(data: any) {
    const res = await fetch('/api/v1/inventory/purchase-orders', {
      method:  'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...data, ...(fromRequisitionId && { requisitionId: fromRequisitionId }) })
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    if (fromRequisitionId) router.replace('/admin/inventory/purchase-orders')
    await fetchAll()
  }
```

- [ ] **Step 5: Pass `prefillLine` into the modal**

Find:

```tsx
      {showCreate && (
        <CreatePOModal
          suppliers={suppliers}
          stockItems={stockItems}
          lang={lang}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}
```

Replace with:

```tsx
      {showCreate && (
        <CreatePOModal
          suppliers={suppliers}
          stockItems={stockItems}
          lang={lang}
          prefillLine={prefillLine}
          onClose={() => { setShowCreate(false); if (fromRequisitionId) router.replace('/admin/inventory/purchase-orders') }}
          onSave={handleCreate}
        />
      )}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 7: Manual browser check**

Approve a requisition on `/admin/requisitions`, click "Commander", confirm it navigates to `/admin/inventory/purchase-orders` with the create modal already open and the item name/quantity pre-filled. Pick a supplier and save — confirm the requisition (checked back on `/admin/requisitions`) now shows `status: ordered`.

- [ ] **Step 8: Commit**

```bash
git add app/admin/inventory/purchase-orders/page.tsx
git commit -m "feat(achats): purchase-orders page accepts requisition prefill + links on create"
```

---

## Task 10: Invoices page — partial payments UI

**Files:**
- Modify: `app/admin/invoices/page.tsx`

- [ ] **Step 1: Add `partial` to the status type and metadata maps**

Find:

```tsx
type InvoiceStatus = 'unpaid' | 'paid' | 'overdue' | 'cancelled'
```

Replace with:

```tsx
type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue' | 'cancelled'
```

Find:

```tsx
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
```

Replace with:

```tsx
interface SupplierInvoice {
  id:            string
  supplierName:  string
  invoiceNumber: string | null
  amount:        number
  amountPaid:    number
  currency:      string
  issueDate:     string
  dueDate:       string | null
  status:        InvoiceStatus
  documentUrl:   string | null
  notes:         string | null
}

interface SupplierPayment {
  id:       string
  amount:   number
  paidAt:   string
  method:   string
  notes:    string | null
}
```

Find:

```tsx
const STATUS_ICONS: Record<InvoiceStatus, React.ElementType> = {
  unpaid: Clock, overdue: AlertCircle, paid: CheckCircle2, cancelled: XCircle,
}
const STATUS_COLORS: Record<InvoiceStatus, { color: string; bg: string }> = {
  unpaid:    { color: 'text-amber-400',   bg: 'bg-amber-500/15'   },
  overdue:   { color: 'text-rose-400',    bg: 'bg-rose-500/15'    },
  paid:      { color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  cancelled: { color: 'text-slate-500',   bg: 'bg-slate-500/15'   },
}

const STATUSES: InvoiceStatus[] = ['unpaid', 'overdue', 'paid', 'cancelled']
```

Replace with:

```tsx
const STATUS_ICONS: Record<InvoiceStatus, React.ElementType> = {
  unpaid: Clock, partial: Wallet, overdue: AlertCircle, paid: CheckCircle2, cancelled: XCircle,
}
const STATUS_COLORS: Record<InvoiceStatus, { color: string; bg: string }> = {
  unpaid:    { color: 'text-amber-400',   bg: 'bg-amber-500/15'   },
  partial:   { color: 'text-sky-400',     bg: 'bg-sky-500/15'     },
  overdue:   { color: 'text-rose-400',    bg: 'bg-rose-500/15'    },
  paid:      { color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  cancelled: { color: 'text-slate-500',   bg: 'bg-slate-500/15'   },
}

const STATUSES: InvoiceStatus[] = ['unpaid', 'partial', 'overdue', 'paid', 'cancelled']
```

- [ ] **Step 2: Add payment-recording state + handler**

Find:

```tsx
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<SupplierInvoice | null>(null)
  const [form,     setForm]     = useState({ ...EMPTY_FORM })
  const [saving,   setSaving]   = useState(false)
```

Replace with:

```tsx
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<SupplierInvoice | null>(null)
  const [form,     setForm]     = useState({ ...EMPTY_FORM })
  const [saving,   setSaving]   = useState(false)

  const [payingId,  setPayingId]  = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payBusy,   setPayBusy]   = useState(false)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [history,   setHistory]   = useState<SupplierPayment[]>([])
```

Find:

```typescript
  async function del(id: string) {
    if (!confirm(t.deleteConfirm)) return
    await fetch(`/api/v1/invoices/${id}`, { method: 'DELETE', headers: authHeader() })
    await load()
  }
```

Replace with:

```typescript
  async function del(id: string) {
    if (!confirm(t.deleteConfirm)) return
    await fetch(`/api/v1/invoices/${id}`, { method: 'DELETE', headers: authHeader() })
    await load()
  }

  async function recordPayment(id: string) {
    if (!payAmount || Number(payAmount) <= 0) return
    setPayBusy(true)
    try {
      const res = await fetch(`/api/v1/invoices/${id}/payments`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(payAmount), method: payMethod }),
      })
      if (res.ok) { setPayingId(null); setPayAmount(''); await load() }
    } finally {
      setPayBusy(false)
    }
  }

  async function toggleHistory(id: string) {
    if (historyId === id) { setHistoryId(null); return }
    setHistoryId(id)
    const res = await fetch(`/api/v1/invoices/${id}/payments`, { headers: authHeader() })
    if (res.ok) setHistory((await res.json()).items ?? [])
  }
```

- [ ] **Step 3: Render remaining-balance, "record payment" mini-form, and payment history**

Find:

```tsx
                <div className="flex items-center gap-2 shrink-0">
                  {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                    <button
                      onClick={() => quickStatus(inv.id, 'paid')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold transition-colors"
                    >
                      {t.markPaid}
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
```

Replace with:

```tsx
                <div className="flex items-center gap-2 shrink-0">
                  {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                    <button
                      onClick={() => { setPayingId(payingId === inv.id ? null : inv.id); setPayAmount(String((inv.amount - inv.amountPaid).toFixed(2))) }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold transition-colors"
                    >
                      💵 {(inv.amount - inv.amountPaid).toFixed(2)} {inv.currency}
                    </button>
                  )}
                  <button
                    onClick={() => toggleHistory(inv.id)}
                    className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white text-xs transition-colors"
                  >
                    {historyId === inv.id ? '▲' : '▼'}
                  </button>
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

                {payingId === inv.id && (
                  <div className="w-full mt-3 pt-3 border-t border-slate-700 flex items-center gap-2 flex-wrap">
                    <input
                      type="number" min={0} step={0.01}
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="w-28 bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm"
                    />
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                      className="bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm">
                      <option value="cash" className="bg-slate-800">Cash</option>
                      <option value="card" className="bg-slate-800">Card</option>
                      <option value="virement" className="bg-slate-800">Virement</option>
                    </select>
                    <button onClick={() => recordPayment(inv.id)} disabled={payBusy}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-xs font-semibold">
                      {payBusy ? <Loader2 size={14} className="animate-spin" /> : 'Enregistrer le paiement'}
                    </button>
                  </div>
                )}

                {historyId === inv.id && (
                  <div className="w-full mt-3 pt-3 border-t border-slate-700 space-y-1">
                    {history.length === 0 ? (
                      <p className="text-xs text-slate-500">Aucun paiement enregistré.</p>
                    ) : history.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs text-slate-400">
                        <span>{fmt(p.paidAt)} · {p.method}</span>
                        <span className="font-mono text-white">{p.amount.toFixed(2)} {inv.currency}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
```

- [ ] **Step 4: Show the remaining/paid amount next to the total**

Find:

```tsx
                    <span className="text-sm font-bold text-white">{inv.amount.toLocaleString('fr-FR')} {inv.currency}</span>
```

Replace with:

```tsx
                    <span className="text-sm font-bold text-white">{inv.amount.toLocaleString('fr-FR')} {inv.currency}</span>
                    {inv.amountPaid > 0 && inv.amountPaid < inv.amount && (
                      <span className="text-xs text-sky-400">({inv.amountPaid.toFixed(2)} payé)</span>
                    )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Manual browser check**

Open `/admin/invoices`, find the auto-generated invoice from Task 4's manual check (or create one), click the balance button to open the payment mini-form, record a partial payment, confirm the status badge becomes "partial" and the remaining balance updates. Click the history toggle (▼) and confirm the payment appears.

- [ ] **Step 7: Commit**

```bash
git add app/admin/invoices/page.tsx
git commit -m "feat(achats): add partial-payment recording + history to invoices page"
```

---

## Task 11: New `/admin/achats` report page

**Files:**
- Create: `app/admin/achats/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package, Loader2, TrendingDown, AlertTriangle, Clock, ArrowRight,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts'
import { useLang } from '../lang-context'

type Period = 'week' | 'month' | 'custom'

interface AchatsReport {
  period: { from: string; to: string }
  aging: { '0-30': number; '31-60': number; '61-90': number; '90+': number; total: number }
  spendTrend: { date: string; spend: number }[]
  topSuppliers: { supplierName: string; total: number }[]
  upcomingDue: { id: string; supplierName: string; amount: number; amountPaid: number; currency: string; dueDate: string }[]
  pending: { pendingRequisitions: number; orderedPOs: number }
  totals: { unpaidTotal: number; spendThisPeriod: number }
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

function fmt(n: number, currency = 'MAD') {
  return `${n.toLocaleString('fr-FR')} ${currency}`
}

export default function AchatsPage() {
  const { isRTL } = useLang()
  const [period, setPeriod]   = useState<Period>('month')
  const [report, setReport]   = useState<AchatsReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/achats/report?period=${period}`, { headers: authHeader() })
      if (res.ok) setReport(await res.json())
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-violet-500" size={36} />
      </div>
    )
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-violet-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Achats — Comptes Fournisseurs</h1>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(['week', 'month'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${period === p ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>
              {p === 'week' ? 'Semaine' : 'Mois'}
            </button>
          ))}
        </div>
      </div>

      {report && (
        <>
          {/* Aging + spend summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-slate-600">Total dû aux fournisseurs</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{fmt(report.aging.total)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-slate-600">Dépenses ({period === 'week' ? 'semaine' : 'mois'})</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{fmt(report.totals.spendThisPeriod)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-violet-600" />
                <span className="text-sm font-semibold text-slate-600">En attente</span>
              </div>
              <p className="text-sm text-slate-700">{report.pending.pendingRequisitions} demandes · {report.pending.orderedPOs} commandes en cours</p>
            </div>
          </div>

          {/* Aging buckets */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4">Antériorité des dettes (Aging)</h3>
            <div className="grid grid-cols-4 gap-3">
              {(['0-30', '31-60', '61-90', '90+'] as const).map(bucket => (
                <div key={bucket} className={`rounded-xl p-3 text-center ${bucket === '90+' ? 'bg-rose-50' : bucket === '61-90' ? 'bg-amber-50' : 'bg-slate-50'}`}>
                  <p className="text-xs text-slate-500 mb-1">{bucket} j.</p>
                  <p className="font-bold text-slate-800">{fmt(report.aging[bucket])}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Spend trend */}
          {report.spendTrend.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-4">Tendance des dépenses</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.spendTrend}>
                    <defs>
                      <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v} MAD`, 'Dépenses']} />
                    <Area type="monotone" dataKey="spend" stroke="#8b5cf6" fill="url(#spend)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top suppliers + upcoming due, side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-3">Top fournisseurs</h3>
              {report.topSuppliers.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune dépense sur la période.</p>
              ) : (
                <div className="space-y-2">
                  {report.topSuppliers.map(s => (
                    <div key={s.supplierName} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{s.supplierName}</span>
                      <span className="font-bold text-slate-900">{fmt(s.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Échéances à venir (7 jours)
              </h3>
              {report.upcomingDue.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune échéance dans les 7 prochains jours.</p>
              ) : (
                <div className="space-y-2">
                  {report.upcomingDue.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{inv.supplierName}</span>
                      <span className="font-bold text-rose-600">{fmt(inv.amount - inv.amountPaid, inv.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Link href="/admin/invoices" className="flex items-center gap-1.5 text-sm text-violet-600 font-semibold hover:underline w-fit">
            Voir toutes les factures <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Manual browser check**

Run `npm run dev`, open `/admin/achats`. Confirm the aging buckets, spend trend chart, top suppliers, and upcoming-due list all render using the data created in earlier tasks.

- [ ] **Step 4: Commit**

```bash
git add app/admin/achats/page.tsx
git commit -m "feat(achats): add dedicated purchases report page"
```

---

## Task 12: Financials page — Achats summary widget

**Files:**
- Modify: `app/admin/financials/page.tsx`

- [ ] **Step 1: Add state + fetch for the achats summary**

Find:

```tsx
  const [report, setReport]     = useState<ReportData | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loadingReport, setLoadingReport] = useState(true)
  const [loadingExp,    setLoadingExp]    = useState(true)
```

Replace with:

```tsx
  const [report, setReport]     = useState<ReportData | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loadingReport, setLoadingReport] = useState(true)
  const [loadingExp,    setLoadingExp]    = useState(true)
  const [achatsSummary, setAchatsSummary] = useState<{ unpaidTotal: number; spendThisPeriod: number } | null>(null)
```

Find (the `report`-fetching `useEffect`, right after its closing — locate the effect that calls `/api/admin/financials/report` and add a sibling effect below it):

```typescript
    let url = `/api/admin/financials/report?period=${period}`
    if (period === 'custom' && customFrom) url += `&from=${customFrom}&to=${customTo || new Date().toISOString().slice(0,10)}`
```

After the effect containing this line closes (look for the matching `}, [period, customFrom, customTo])` immediately following it), add a new effect directly below:

```typescript
  useEffect(() => {
    fetch(`/api/admin/achats/report?period=${period === 'today' ? 'week' : period === 'custom' ? 'month' : period}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAchatsSummary(d.totals) })
      .catch(() => {})
  }, [period])
```

- [ ] **Step 2: Render the widget after the income/expense/profit card grid**

Find:

```tsx
                <div className={`rounded-2xl p-5 shadow-sm border ${report.netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${report.netProfit >= 0 ? 'bg-green-200' : 'bg-red-200'}`}>
                      <DollarSign className={`w-4 h-4 ${report.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`} />
                    </div>
                    <span className={`text-sm font-semibold ${report.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{t.netProfit}</span>
                  </div>
                  <p className={`text-3xl font-extrabold ${profitColor}`}>{fmt(report.netProfit, currency)}</p>
                </div>
              </div>
```

Replace with:

```tsx
                <div className={`rounded-2xl p-5 shadow-sm border ${report.netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${report.netProfit >= 0 ? 'bg-green-200' : 'bg-red-200'}`}>
                      <DollarSign className={`w-4 h-4 ${report.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`} />
                    </div>
                    <span className={`text-sm font-semibold ${report.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{t.netProfit}</span>
                  </div>
                  <p className={`text-3xl font-extrabold ${profitColor}`}>{fmt(report.netProfit, currency)}</p>
                </div>
              </div>

              {achatsSummary && (
                <Link href="/admin/achats" className="block bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-violet-300 transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-600 mb-1">Achats — Comptes fournisseurs</p>
                      <p className="text-xs text-slate-400">Dû aux fournisseurs / dépenses de la période</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Non payé</p>
                        <p className="font-bold text-amber-600">{fmt(achatsSummary.unpaidTotal, currency)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Dépensé</p>
                        <p className="font-bold text-slate-800">{fmt(achatsSummary.spendThisPeriod, currency)}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              )}
```

- [ ] **Step 3: Import `Link`**

Find:

```tsx
import { useCallback, useEffect, useState } from 'react'
```

Replace with:

```tsx
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Manual browser check**

Open `/admin/financials`, confirm the "Achats — Comptes fournisseurs" card appears below the 3 stat cards with real numbers, and clicking it navigates to `/admin/achats`.

- [ ] **Step 6: Commit**

```bash
git add app/admin/financials/page.tsx
git commit -m "feat(achats): add Achats summary widget to financials page"
```

---

## Task 13: Nav entry + i18n labels

**Files:**
- Modify: `app/admin/layout.tsx`
- Modify: `lib/adminI18n.ts`

- [ ] **Step 1: Add the nav entry**

Find:

```tsx
  { href: '/admin/invoices',      icon: Receipt,        key: 'invoices'      },
  { href: '/admin/requisitions',  icon: ShoppingCart,   key: 'requisitions'  },
```

Replace with:

```tsx
  { href: '/admin/invoices',      icon: Receipt,        key: 'invoices'      },
  { href: '/admin/requisitions',  icon: ShoppingCart,   key: 'requisitions'  },
  { href: '/admin/achats',        icon: Package,        key: 'achats'        },
```

- [ ] **Step 2: Add the `achats` label to all 4 languages**

Find (Arabic block):

```typescript
    invoices:      'فواتير الموردين',
    requisitions:  'الاحتياجات',
```

Replace with:

```typescript
    invoices:      'فواتير الموردين',
    requisitions:  'الاحتياجات',
    achats:        'المشتريات',
```

Find (English block):

```typescript
    invoices:      'Invoices',
    requisitions:  'Requisitions',
```

Replace with:

```typescript
    invoices:      'Invoices',
    requisitions:  'Requisitions',
    achats:        'Purchases',
```

Find (French block):

```typescript
    invoices:      'Factures',
    requisitions:  'Besoins',
```

Replace with:

```typescript
    invoices:      'Factures',
    requisitions:  'Besoins',
    achats:        'Achats',
```

Find (Spanish block):

```typescript
    invoices:      'Facturas',
    requisitions:  'Requisiciones',
```

Replace with:

```typescript
    invoices:      'Facturas',
    requisitions:  'Requisiciones',
    achats:        'Compras',
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (the `AdminT` type is inferred from the language objects — adding the same key to all 4 keeps them structurally consistent).

- [ ] **Step 4: Manual browser check**

Confirm the sidebar shows a new "Purchases"/"Achats"/"المشتريات"/"Compras" entry (depending on active language) linking to `/admin/achats`, using the `Package` icon.

- [ ] **Step 5: Commit**

```bash
git add app/admin/layout.tsx lib/adminI18n.ts
git commit -m "feat(achats): add /admin/achats nav entry + i18n labels"
```

---

## Task 14: Full manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Re-run the backend integration script end-to-end**

Run: `npm run dev`, then `npx ts-node --transpile-only scripts/controlTestAchats.ts`
Expected: all assertions pass.

- [ ] **Step 2: Browser walkthrough — full chain**

On `/admin/requisitions`: create a requisition, approve it, click "Commander" — confirm it lands on `/admin/inventory/purchase-orders` with the create modal pre-filled. Pick a supplier, save. Confirm the requisition now shows `status: ordered`.

On `/admin/inventory/purchase-orders`: mark the new PO as received. Confirm stock increments as before (existing behavior, unchanged).

On `/admin/invoices`: confirm a new `unpaid` invoice appeared automatically, linked to that PO (no manual re-entry). Record a partial payment, confirm status flips to `partial` and the remaining balance is correct; pay the remainder, confirm it flips to `paid`. Expand the payment history and confirm both payments are listed.

On `/admin/achats`: confirm the aging buckets, spend trend, top suppliers, and upcoming-due sections reflect the data just created.

On `/admin/financials`: confirm the new "Achats" widget shows a non-zero unpaid/spend figure and links through to `/admin/achats`.

- [ ] **Step 3: Regression check — unlinked flows still work**

Create a `SupplierInvoice` directly (no PO) via `/admin/invoices`'s existing "Add Invoice" form, and a `PurchaseOrder` directly (no requisition) via `/admin/inventory/purchase-orders`'s existing "Create Order" button. Confirm both still work exactly as before — nothing in this plan requires the link to be present.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during Achats/Payables manual verification"
```

(Skip this step if no fixes were needed.)

---

## Self-Review Notes

- **Spec coverage:** Optional FK linking (Task 1). Auto-invoice-on-receive (Task 4). Partial payments via `SupplierPayment` (Tasks 1, 5, 10). Dedicated `/admin/achats` report — aging, spend trend, top suppliers, upcoming due, pending pipeline (Tasks 6, 11). Financials widget (Task 12). Requisition→PO real linking replacing the old direct-status-flip shortcut (Tasks 8-9). Everything stays behind `isSmartInventoryEnabled` — the new report route reuses `requireInventory` (Task 6). OCR and stock-movement ledger are explicitly out of scope and not touched anywhere in this plan.
- **Placeholder scan:** no TBD/TODO markers; every step has literal code or an exact command with expected output.
- **Type consistency:** `SupplierInvoiceStatus` type (Task 2) matches the 4 states used in `computeInvoiceStatus` (Task 2), the payments endpoint (Task 5), and the frontend `InvoiceStatus` type (Task 10). `AchatsReport` interface (Task 11) matches the exact JSON shape returned by `GET /api/admin/achats/report` (Task 6) field-for-field (`aging`, `spendTrend`, `topSuppliers`, `upcomingDue`, `pending`, `totals`).
