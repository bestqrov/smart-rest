# Purchases → Payables Linking + Reporting — Design Spec

> **V1 freeze exception**, explicitly authorized by the user 2026-07-06 (see
> memory `project-v1-freeze-exceptions`). Not part of the Reservations →
> Loyalty → Marketing → Social priority order.

## Problem

Three Prisma models already exist and each works in isolation, but nothing
connects them: `PurchaseRequisition` (staff request), `PurchaseOrder` (order
to a supplier), `SupplierInvoice` (money owed). A gérant/comptable today
must re-key the same purchase 2-3 times by hand across three separate admin
pages, `PurchaseOrder` has no payment status at all, and the main financials
report (`/admin/financials`) never surfaces supplier spend — so purchase
cost is invisible in the restaurant's P&L unless someone manually logs it as
a generic `Expense`.

## Goals (this round)

1. Link the chain: Requisition → PurchaseOrder → SupplierInvoice →
   SupplierPayment, via optional foreign keys — no breaking change to
   existing standalone records.
2. Auto-generate a `SupplierInvoice` when a `PurchaseOrder` is marked
   `received`.
3. Support partial payments against an invoice (not just paid/unpaid).
4. Give the gérant/comptable a dedicated purchases report
   (`/admin/achats`) with accounts-payable aging, spend trend, top
   suppliers, and upcoming due invoices — plus a lightweight summary widget
   surfaced inside the existing `/admin/financials` page.

## Explicitly out of scope (deferred to Phase 2)

- OCR / scan-to-fill for BL (bon de livraison) or supplier invoices.
- Stock movement ledger (append-only history of stock in/out) — stock keeps
  its current snapshot-only model (`StockItem.currentQty` +
  `lastRestockedAt`).
- Changing the `isSmartInventoryEnabled` feature gate — this work stays
  behind the same premium flag; it does not become core for all tenants.

## Data model changes (`prisma/schema.prisma`)

- `PurchaseOrder` gains `requisitionId String? @db.ObjectId` (optional
  back-reference to the requisition it was created from, if any).
- `PurchaseRequisition` gains `purchaseOrderId String? @db.ObjectId` (set
  once a PO is created from it).
- `SupplierInvoice` gains:
  - `purchaseOrderId String? @db.ObjectId` (optional link to the PO that
    generated it — manual/standalone invoices leave this null).
  - `amountPaid Float @default(0)`.
  - `status` becomes a derived field, recomputed on every payment write:
    `unpaid` (`amountPaid == 0`), `partial` (`0 < amountPaid < amount`),
    `paid` (`amountPaid >= amount`), `overdue` (not `paid` AND
    `dueDate < now`).
- New model `SupplierPayment`: `id`, `invoiceId` (FK to `SupplierInvoice`),
  `amount`, `paidAt`, `method` (`cash` | `card` | `virement`), `notes`.
  One invoice can have many payments (partial payments accumulate).

All new fields are optional/nullable — existing `PurchaseOrder` and
`SupplierInvoice` rows created before this change keep working unmodified,
with the new fields simply null/zero.

## Workflow

- **Requisition → PO**: creating a PO from an `approved` requisition
  auto-fills line items from it and sets `PurchaseOrder.requisitionId`; the
  requisition's status moves to `ordered`. Creating a PO without a
  requisition (today's flow) still works — `requisitionId` stays null.
- **PO → Invoice**: when a `PurchaseOrder` transitions to `received`, the
  system auto-creates a `SupplierInvoice`: `amount = PO.totalCost`,
  `status = unpaid`, `purchaseOrderId` set, `dueDate = receivedAt + 30
  days` (30-day default, not user-configurable in this round). A PO that
  was never linked to a requisition still produces this invoice normally —
  the requisition link and the invoice link are independent optional steps.
- **Invoice → Payment**: recording a `SupplierPayment` against an invoice
  increments `amountPaid` and the invoice's derived `status` recalculates
  automatically. Invoices can still be created directly with no
  `purchaseOrderId` (e.g. a manual/one-off supplier expense with no formal
  PO) — the link is opportunistic, not mandatory at any stage.

## Reporting

### New page: `/admin/achats`

- **Accounts payable aging**: outstanding balance buckets — 0-30 / 31-60 /
  61-90 / 90+ days past `dueDate`.
- **Spend trend**: chart of total purchase spend by period, same
  today/week/month/custom selector pattern as `/admin/financials`.
- **Top suppliers by spend**: ranked total per `InventorySupplier`.
- **Upcoming due invoices**: invoices whose `dueDate` falls within the next
  N days and are not yet `paid`.
- **Pending pipeline**: requisitions in `pending`, POs in `ordered` (not
  yet received).

Backend: `GET /api/admin/achats/report?period=week|month|custom` aggregating
`PurchaseOrder` + `SupplierInvoice` + `SupplierPayment`.

### Widget in `/admin/financials`

A small "Achats" summary card (total unpaid + this-month purchase spend)
linking through to `/admin/achats`, so the main P&L view gestures at
supplier spend without duplicating the detailed report.

## Testing approach

Per this repo's existing convention (no Jest/Vitest configured): a
consolidated `scripts/controlTestAchats.ts` integration script exercising
the full chain — requisition→PO→receive→auto-invoice→partial
payment→status transitions→aging report — run against a live dev server,
mirroring `scripts/controlTestComptoir.ts`.
