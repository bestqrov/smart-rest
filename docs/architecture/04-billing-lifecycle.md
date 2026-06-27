# Billing Lifecycle — SmartRestau OS

## Commission Model

SmartRestau charges per-order commissions that accumulate in each cafe's `walletBalance` (negative = debt). When the wallet goes sufficiently negative the cafe transitions through billing states.

## Billing States

```mermaid
stateDiagram-v2
    [*] --> GRACE_PERIOD : Cafe registered
    GRACE_PERIOD --> COLLECTING_DEBT : Trial period ends\n(trialEndsAt reached)
    COLLECTING_DEBT --> PAST_DUE : walletBalance < 0\nDaily cron detects
    PAST_DUE --> COLLECTING_DEBT : Owner makes payment\nwallet topped up
    PAST_DUE --> SUSPENDED : 7-day grace elapsed\nno payment received
    SUSPENDED --> COLLECTING_DEBT : Payment received\nmanual reactivation
    COLLECTING_DEBT --> COLLECTING_DEBT : Orders processed\ncommissions deducted
```

## Commission Tier Structure

Per-order commission is determined by the order total and the cafe's country:

```mermaid
graph LR
    ORDER[Order Completed] --> CALC[Commission Calculator\nbilling.ts]
    CALC --> TIER{Country Tier Table}
    TIER -->|MA| MA[Morocco MAD\n0–30 → 0.30 MAD\n30–70 → 0.99 MAD\n70–150 → 3.99 MAD\n150+ → 11 MAD]
    TIER -->|SA| SA[Saudi Arabia SAR\nTiered 1–22 SAR]
    TIER -->|AE| AE[UAE AED\nTiered 1–22 AED]
    TIER -->|TN DZ MR| OTHER[Africa Pack\nCountry-specific tiers]
    MA --> WALLET[Cafe.walletBalance\n-= commission]
    SA --> WALLET
    AE --> WALLET
    OTHER --> WALLET
    WALLET --> LOG[WalletLog record\ntype: DEBT_ACC_ORDER]
```

## Cron Schedule

Four cron jobs manage the billing lifecycle:

| Cron | Schedule | File | Purpose |
|---|---|---|---|
| Daily Debt Detection | Every day 02:00 | `cron/dailyDebtDetection.ts` | Sweep `walletBalance < 0` → `PAST_DUE` / `SUSPENDED`; fire n8n alerts |
| Weekly Billing | Mon 23:59 | `cron/weeklyBilling.ts` | Trial expiry analysis; AI billing package generation |
| Nightly | Every day 03:00 | `cron/nightly.ts` | General housekeeping, reporting |
| Certification Eval | 1st of month 02:00 | `cron/certificationEval.ts` | Evaluate all cafes for Smart Resto Certified badge |

## Full Billing Lifecycle

```mermaid
sequenceDiagram
    participant C as Customer
    participant API as REST API
    participant SB as SmartBilling Service
    participant DB as MongoDB (Prisma)
    participant CRON as Daily Cron (02:00)
    participant N8N as n8n Webhook

    C->>API: Place Order (QR / POS)
    API->>DB: Create Order (status: PENDING)
    API->>C: Order confirmed

    Note over API,DB: Order completes (DELIVERED → COMPLETED)

    API->>SB: computeCommission(order)
    SB->>DB: Cafe.walletBalance -= commission
    SB->>DB: WalletLog { DEBT_ACC_ORDER }
    SB->>DB: BillingInvoice updated

    Note over CRON: Every day at 02:00

    CRON->>DB: SELECT cafes WHERE walletBalance < 0
    DB-->>CRON: Indebted cafes list

    alt Balance negative for > 7 days
        CRON->>DB: billingStatus = SUSPENDED
        CRON->>N8N: POST /webhook/billing { event: CAFE_SUSPENDED }
        N8N->>Owner: WhatsApp alert
    else Balance negative but within grace
        CRON->>DB: billingStatus = PAST_DUE
        CRON->>N8N: POST /webhook/billing { event: CAFE_PAST_DUE }
        N8N->>Owner: WhatsApp reminder
    end

    Note over API: Owner pays via Stripe / Moyasar / Manual

    API->>DB: WalletLog { PAYMENT_SETTLEMENT }
    DB->>DB: walletBalance += payment
    DB->>DB: billingStatus = COLLECTING_DEBT
```

## Payment Methods

| Method | Region | Integration |
|---|---|---|
| Stripe (card / Apple Pay / Google Pay) | Gulf | `src/routes/payment.ts` → Stripe SDK |
| Moyasar | Saudi Arabia, Gulf | `src/routes/payment.ts` → Moyasar REST |
| Orange Money | West Africa | Manual QR / number |
| MTN MoMo | West / Central Africa | Manual QR / number |
| Wave | Senegal, Ivory Coast | Manual QR / number |
| Bank Transfer / Western Union | All regions | Manual confirmation |

## Invoice Records

Every settlement or commission event creates a `BillingInvoice` record:

```
BillingInvoice {
  cafeId · type (COMMISSION | SETTLEMENT) · amount · currency
  orderId (for commissions) · paymentMethod · status · createdAt
}
```

And a `WalletLog`:

```
WalletLog {
  cafeId · type (DEBT_ACC_ORDER | PAYMENT_SETTLEMENT | TRIAL_EXTENSION | DEBT_ACC_SOCIAL)
  amount · balanceAfter · note · createdAt
}
```
