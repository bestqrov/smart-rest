# Fawatir & I7tiyajat — Design Spec

**Date:** 2026-06-25
**Status:** Approved

---

## Overview

Two independent operational finance modules for the Smart Restau admin panel:

1. **Fawatir (فواتير)** — Supplier invoice tracking: record incoming invoices, track payment status, upload documents
2. **I7tiyajat (احتياجات)** — Purchase requisitions: staff request items to buy, manager progresses them through a workflow

Both follow the same architectural pattern as the Equipment module (Prisma model → Express route → Next.js admin page → sidebar link).

---

## Module 1: Fawatir — Supplier Invoices

### Prisma Model: `SupplierInvoice`

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
  status        String   @default("unpaid")   // unpaid | paid | overdue | cancelled
  documentUrl   String?                        // Cloudinary PDF or image URL
  notes         String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([cafeId])
  @@index([cafeId, status])
  @@index([dueDate])
}
```

### API Routes: `GET/POST /api/v1/invoices`, `PATCH/DELETE /api/v1/invoices/:id`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/invoices` | List all invoices (filter by status optional) |
| GET | `/api/v1/invoices/summary/stats` | Dashboard totals (unpaid total, overdue count, paid this month) |
| POST | `/api/v1/invoices` | Create invoice |
| PATCH | `/api/v1/invoices/:id` | Update invoice (any field including status) |
| DELETE | `/api/v1/invoices/:id` | Delete invoice |

All routes require `authorizeAdmin`, scoped to `cafeId`.

### Frontend: `app/admin/invoices/page.tsx`

- **Summary cards:** Total unpaid (MAD), Overdue count, Paid this month
- **Filter bar:** All / Unpaid / Overdue / Paid / Cancelled
- **Invoice list:** Sorted by issueDate desc. Each row shows: supplierName, invoiceNumber, amount, issueDate, dueDate (red if overdue), status badge, document link
- **Add/Edit form:** All fields, inline toggle (same pattern as Equipment)
- **Status quick-change:** Click status badge → dropdown to change (unpaid → paid most common action)
- **Delete:** With confirm dialog

### Status Color Scheme

| Status | Color |
|--------|-------|
| unpaid | amber |
| overdue | rose |
| paid | emerald |
| cancelled | slate |

---

## Module 2: I7tiyajat — Purchase Requisitions

### Prisma Model: `PurchaseRequisition`

```prisma
model PurchaseRequisition {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  cafeId         String   @db.ObjectId
  cafe           Cafe     @relation(fields: [cafeId], references: [id])

  itemName       String
  quantity       Float
  unit           String   @default("units")   // kg | L | units | boxes | other
  estimatedPrice Float?
  urgency        String   @default("normal")  // low | normal | high | urgent
  requestedBy    String
  notes          String?
  status         String   @default("pending") // pending | approved | ordered | received | cancelled

  approvedAt     DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([cafeId])
  @@index([cafeId, status])
  @@index([cafeId, urgency])
}
```

### Workflow

```
pending → approved → ordered → received
            ↓
         cancelled (from any state except received)
```

### API Routes: `GET/POST /api/v1/requisitions`, `PATCH/DELETE /api/v1/requisitions/:id`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/requisitions` | List all requisitions (filter by status/urgency optional) |
| GET | `/api/v1/requisitions/summary/stats` | Counts by status, urgent pending count |
| POST | `/api/v1/requisitions` | Create requisition |
| PATCH | `/api/v1/requisitions/:id` | Update (fields or status advance) |
| DELETE | `/api/v1/requisitions/:id` | Delete |

All routes require `authorizeAdmin`, scoped to `cafeId`.

### Frontend: `app/admin/requisitions/page.tsx`

- **Summary cards:** Pending count, Urgent pending, Ordered (in transit), Total received this month
- **Filter bar:** All / Pending / Approved / Ordered / Received / Cancelled
- **Requisition list:** Sorted by urgency then createdAt. Each row shows: itemName, quantity+unit, requestedBy, urgency badge (color-coded), status badge, estimatedPrice
- **Status advance button:** One-click next-step button ("Approuver", "Commander", "Reçu") — most common action surfaced prominently
- **Add form:** itemName, quantity, unit, estimatedPrice, urgency, requestedBy, notes
- **Edit form:** Same fields + status change
- **Cancel button:** Available on pending/approved/ordered rows

### Urgency Color Scheme

| Urgency | Color |
|---------|-------|
| low | slate |
| normal | blue |
| high | amber |
| urgent | rose |

---

## Sidebar

Add two entries to `app/admin/layout.tsx` and `lib/adminI18n.ts`:

```
📄 Fawatir      → /admin/invoices       (icon: FileText)
📋 I7tiyajat    → /admin/requisitions   (icon: ClipboardList)
```

Positioned after Equipment in the operational tools group.

---

## i18n Keys (`lib/adminI18n.ts`)

| Key | AR | FR | EN | ES |
|-----|----|----|----|----|
| `invoices` | الفواتير | Fawatir | Invoices | Facturas |
| `requisitions` | الاحتياجات | Besoins | Requisitions | Requisiciones |

---

## What's Out of Scope

- PDF generation for invoices (display only)
- Automatic overdue detection via cron (status is set manually)
- Approval notifications via WhatsApp/email
- Linking requisitions to supplier invoices
- Multi-currency conversion
