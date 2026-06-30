# Payment Engine — Architecture Reference

Provider-agnostic payment layer for SmartSuite OS. Reusable by every future SaaS module (Marketplace, Billing, Hotel, Clinic, Retail). No Stripe SDK. No hardcoded gateways.

---

## Core Design: Provider Abstraction

Every payment gateway implements the same `IPaymentProvider` interface:

```typescript
interface IPaymentProvider {
  readonly name: ProviderName
  authorize(tx, metadata?): Promise<AuthorizeResult>
  capture(tx, metadata?):   Promise<CaptureResult>
  refund(tx, amount?):      Promise<RefundResult>
  cancel(tx):               Promise<void>
}
```

The `PaymentService` (main facade) calls the interface — it never knows which gateway is behind it. Adding a new gateway = creating one new class and registering it in `registry.ts`.

---

## Provider Registry

**File:** `src/payments/providers/registry.ts`

| Provider | Status | Implementation |
|----------|--------|----------------|
| `MANUAL` | ✅ Active | Human validates via admin UI |
| `CASH` | ✅ Active | In-person collection, auto-captures |
| `BANK_TRANSFER` | ✅ Active | Admin confirms receipt |
| `STRIPE` | 🔜 Stub | Throws NotImplemented |
| `PAYPAL` | 🔜 Stub | Throws NotImplemented |
| `CMI` | 🔜 Stub | CMI (Moroccan interbank) — Throws NotImplemented |
| `PAYZONE` | 🔜 Stub | Moroccan digital gateway — Throws NotImplemented |

---

## Payment Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                    Payment Lifecycle                     │
│                                                         │
│  MarketplaceOrderApproved event                         │
│           ↓                                             │
│     createTransaction()  ──────────────────→ PENDING    │
│           ↓                                     │       │
│       authorize()   ──────────────────────→ AUTHORIZED  │
│           ↓                     (or skip)       │       │
│        markPaid()   ──────────────────────────→ PAID    │
│                                                 │       │
│  ┌──────────────────────────────────────────────┤       │
│  │                                              │       │
│  ▼                                             ▼        │
│  fail() → FAILED               refund() → REFUNDED      │
│  cancel() → CANCELLED                                   │
└─────────────────────────────────────────────────────────┘
```

### Status Transitions

| From | Allowed To |
|------|-----------|
| PENDING | AUTHORIZED, PAID, FAILED, CANCELLED |
| AUTHORIZED | PAID, FAILED, CANCELLED |
| PAID | REFUNDED |
| FAILED | — (terminal) |
| REFUNDED | — (terminal) |
| CANCELLED | — (terminal) |

---

## Integration: Marketplace Orders

The Payment Engine integrates with Marketplace Orders without touching order code — through the event bus:

```
MarketplaceOrderApproved event
         ↓
initPaymentEngine() subscriber
         ↓
PaymentService.createTransaction({
  orderId, tenantId,
  provider: 'MANUAL',
  method:   'MANUAL',
  amount:   order.total,
})
         ↓
PENDING transaction created
Notification sent to restaurant: "دفع مطلوب"
         ↓
SuperAdmin validates payment
POST /api/superadmin/payments/transactions/:id/paid
         ↓
PAID status
Notification sent to restaurant: "تم تأكيد الدفع"
         ↓
SuperAdmin can now fulfill the order
```

**Important:** The Payment Engine listens to `MarketplaceOrderApproved` but does **not** modify the order status. Fulfillment remains a separate SuperAdmin action on the order itself.

---

## Data Model

**Collection:** `payment_transactions`

| Field | Type | Notes |
|-------|------|-------|
| orderId | String | Links to any module's order |
| tenantId | String | cafeId for restaurants |
| module | String | MARKETPLACE / BILLING / HOTEL / CLINIC / RETAIL |
| provider | String | ProviderName enum |
| method | String | PaymentMethod enum |
| status | String | PaymentStatus enum |
| amount | Float | Transaction amount |
| currency | String | Default: MAD |
| reference | String? | Wire ref, cheque #, external ID |
| notes | String? | Admin notes or failure reason |
| paidAt | DateTime? | Set on PAID |
| refundedAt | DateTime? | Set on REFUNDED |
| refundAmount | Float? | Partial refund support |
| metadata | String? | JSON blob for provider-specific data |

---

## Events

| Event | Payload | When |
|-------|---------|------|
| `PaymentCreated` | txId, orderId, tenantId, amount, currency, provider, method | createTransaction() |
| `PaymentAuthorized` | txId, orderId, tenantId, amount | authorize() |
| `PaymentSucceeded` | txId, orderId, tenantId, amount, currency, reference | markPaid() |
| `PaymentFailed` | txId, orderId, tenantId, reason | fail() |
| `PaymentRefunded` | txId, orderId, tenantId, amount, refundAmount, currency | refund() |

All events published via `eventBus.publish()` from `src/core`.

---

## Notifications

| Trigger | Level | Message (AR) |
|---------|-------|-------------|
| createTransaction() | INFO | دفع مطلوب — amount + orderId |
| markPaid() | SUCCESS | تم تأكيد الدفع — amount + orderId |
| refund() | INFO | تم استرداد المبلغ — refund amount |

Sent via `NotificationService.createNotification()` from `src/core`. Non-blocking (fire-and-forget).

---

## API Routes

### SuperAdmin (`x-superadmin-secret` required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/superadmin/payments/transactions` | List all transactions (filters: tenantId, status, provider, module) |
| GET | `/api/superadmin/payments/transactions/:id` | Single transaction |
| POST | `/api/superadmin/payments/transactions` | Create transaction manually |
| POST | `/api/superadmin/payments/transactions/:id/authorize` | Authorize |
| POST | `/api/superadmin/payments/transactions/:id/paid` | Mark as paid (manual validation) |
| POST | `/api/superadmin/payments/transactions/:id/fail` | Mark as failed |
| POST | `/api/superadmin/payments/transactions/:id/refund` | Refund (body: amount?, reason?) |
| POST | `/api/superadmin/payments/transactions/:id/cancel` | Cancel |
| GET | `/api/superadmin/payments/stats` | Global payment stats |

### Restaurant (`Authorization: Bearer <JWT>` required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/restaurant/payments/transactions` | My payment history |
| GET | `/api/restaurant/payments/transactions/:id` | Single transaction (tenant-isolated) |
| GET | `/api/restaurant/payments/order/:orderId` | Payment status for a specific order |

---

## File Structure

```
src/payments/
├── types/
│   └── index.ts              ProviderName, PaymentMethod, PaymentStatus, interfaces
├── providers/
│   ├── PaymentProvider.ts    IPaymentProvider interface
│   ├── ManualProvider.ts     ✅ Active — human validation
│   ├── CashProvider.ts       ✅ Active — in-person
│   ├── BankTransferProvider.ts ✅ Active — wire transfer
│   ├── StripeProvider.ts     🔜 Stub
│   ├── PayPalProvider.ts     🔜 Stub
│   ├── CMIProvider.ts        🔜 Stub (Moroccan)
│   ├── PayzoneProvider.ts    🔜 Stub (Moroccan)
│   └── registry.ts           getProvider() / listProviders() / ACTIVE_PROVIDERS
├── transactions/
│   └── TransactionService.ts createTransaction / getTransaction / getTransactions / updateTransaction
├── refunds/
│   └── RefundService.ts      refundTransaction() — validates + calls provider + updates DB
├── services/
│   └── PaymentService.ts     Main facade: createTransaction / authorize / markPaid / fail / refund / cancel
└── index.ts                  Public API + initPaymentEngine()
```

---

## Future: Stripe Integration

When Stripe is enabled, update `StripeProvider.ts`:

```typescript
// 1. Install: npm install stripe (no SDK currently — add when ready)
// 2. Read credentials from env:
//    STRIPE_SECRET_KEY=sk_live_...
// 3. Implement:
async authorize(tx): Promise<AuthorizeResult> {
  const intent = await stripe.paymentIntents.create({
    amount:   Math.round(tx.amount * 100),   // Stripe uses cents
    currency: tx.currency.toLowerCase(),
    metadata: { orderId: tx.orderId, tenantId: tx.tenantId },
  })
  return { reference: intent.id, metadata: { clientSecret: intent.client_secret } }
}
```

No other files change. The registry swap is all that's needed.

---

## Future: CMI Integration (Moroccan Market)

CMI uses a hosted payment page model (POST redirect). Future implementation:

1. `authorize()` → generate HMAC-signed form fields for CMI redirect
2. CMI posts back to `/api/payments/webhook/cmi` (new webhook route)
3. Webhook validates HMAC + updates transaction status
4. `PaymentSucceeded` event fires

---

## Future: Multi-module Support

To use the Payment Engine from a new module (e.g., Hotel booking):

```typescript
import { createTransaction } from '../../payments'

await createTransaction({
  orderId:  hotelBooking.id,
  tenantId: hotelTenantId,
  module:   'HOTEL',
  provider: 'MANUAL',
  method:   'BANK_TRANSFER',
  amount:   hotelBooking.totalPrice,
  currency: 'MAD',
})
```

No changes to the Payment Engine required.
