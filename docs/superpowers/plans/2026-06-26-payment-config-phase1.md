# Payment Configuration — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow restaurant admins to configure payment providers (Orange Money, MTN MoMo, Wave, Moyasar, Stripe), and display only the configured methods dynamically on the customer QR menu.

**Architecture:** Three-layer change — schema adds `stripePublishableKey` to `PaymentConfig`; two dedicated backend routes handle read/write of payment config; admin settings gets a new "Paiements" tab; QR customer menu reads `paymentGateway` from the public API and renders only the enabled options.

**Tech Stack:** Prisma (MongoDB embedded type), Express, Next.js 14 App Router, Tailwind CSS, TypeScript

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `stripePublishableKey` to `PaymentConfig` |
| `src/routes/menuAdmin.ts` | Modify | Add `GET` + `PUT` `/api/admin/cafe/payment-config` |
| `app/admin/settings/page.tsx` | Modify | Add "Paiements" tab — per-provider config form |
| `app/[subdomain]/t/[tableNumber]/page.tsx` | Modify | Store `paymentGateway` from API; render payment modal dynamically |

---

## Task 1 — Schema: add `stripePublishableKey` to `PaymentConfig`

**Files:**
- Modify: `prisma/schema.prisma` lines 117–129

- [ ] **Step 1: Edit schema**

Replace the `PaymentConfig` block:

```prisma
// Embedded document — Mobile Money / Gulf payment gateway config
type PaymentConfig {
  // Africa Mobile Money
  orangeMoneyNumber String @default("")
  mtnMoMoNumber     String @default("")
  waveWallet        String @default("")
  // Gulf (Moyasar)
  moyasarPublishableKey String @default("")
  // Stripe (cards + Apple Pay + Google Pay via Checkout redirect)
  stripePublishableKey  String @default("")
  stripeAccountId       String @default("")
  // WhatsApp zero-rating ingest
  whatsappNumber   String @default("")
}
```

- [ ] **Step 2: Push schema to DB**

```bash
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add stripePublishableKey to PaymentConfig"
```

---

## Task 2 — Backend: GET + PUT `/api/admin/cafe/payment-config`

**Files:**
- Modify: `src/routes/menuAdmin.ts` — add two routes after the existing `GET /api/admin/cafe/profile` (around line 228)

- [ ] **Step 1: Add GET route**

Insert after the closing `})` of `GET /api/admin/cafe/profile`:

```typescript
// ─── GET /api/admin/cafe/payment-config ──────────────────────────────────────
router.get('/api/admin/cafe/payment-config', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const cafe = await prisma.cafe.findUnique({
      where:  { id: cafeId },
      select: { paymentConfig: true, country: true },
    })
    const pc = cafe?.paymentConfig ?? {}
    return res.json({
      orangeMoneyNumber:    (pc as any).orangeMoneyNumber    ?? '',
      mtnMoMoNumber:        (pc as any).mtnMoMoNumber        ?? '',
      waveWallet:           (pc as any).waveWallet           ?? '',
      moyasarPublishableKey:(pc as any).moyasarPublishableKey ?? '',
      stripePublishableKey: (pc as any).stripePublishableKey  ?? '',
      stripeAccountId:      (pc as any).stripeAccountId       ?? '',
      whatsappNumber:       (pc as any).whatsappNumber        ?? '',
      country:              cafe?.country ?? 'MA',
    })
  } catch (err) {
    logger.error({ msg: 'GET payment-config error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})
```

- [ ] **Step 2: Add PUT route**

Insert immediately after the GET route:

```typescript
// ─── PUT /api/admin/cafe/payment-config ──────────────────────────────────────
router.put('/api/admin/cafe/payment-config', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const {
      orangeMoneyNumber,
      mtnMoMoNumber,
      waveWallet,
      moyasarPublishableKey,
      stripePublishableKey,
      stripeAccountId,
      whatsappNumber,
    } = req.body

    await prisma.cafe.update({
      where: { id: cafeId },
      data:  {
        paymentConfig: {
          orangeMoneyNumber:     orangeMoneyNumber    ?? '',
          mtnMoMoNumber:         mtnMoMoNumber        ?? '',
          waveWallet:            waveWallet           ?? '',
          moyasarPublishableKey: moyasarPublishableKey ?? '',
          stripePublishableKey:  stripePublishableKey  ?? '',
          stripeAccountId:       stripeAccountId       ?? '',
          whatsappNumber:        whatsappNumber        ?? '',
        },
      },
    })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'PUT payment-config error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})
```

- [ ] **Step 3: Test manually**

```bash
# Replace TOKEN with a valid admin JWT
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/admin/cafe/payment-config
```

Expected: `{"orangeMoneyNumber":"","mtnMoMoNumber":"","waveWallet":"","moyasarPublishableKey":"","stripePublishableKey":"","stripeAccountId":"","whatsappNumber":"","country":"MA"}`

- [ ] **Step 4: Commit**

```bash
git add src/routes/menuAdmin.ts
git commit -m "feat(api): GET + PUT /api/admin/cafe/payment-config"
```

---

## Task 3 — Admin UI: "Paiements" tab in settings

**Files:**
- Modify: `app/admin/settings/page.tsx`

### Step 1 — Add `PaymentConfig` type and `'payments'` tab

- [ ] In the `type` block at the top of the file, after the `Profile` type add:

```typescript
type PaymentConfig = {
  orangeMoneyNumber:     string
  mtnMoMoNumber:         string
  waveWallet:            string
  moyasarPublishableKey: string
  stripePublishableKey:  string
  stripeAccountId:       string
  whatsappNumber:        string
  country:               string
}
```

- [ ] Change the `Tab` type:

```typescript
type Tab = 'profile' | 'branding' | 'password' | 'staff' | 'payments'
```

### Step 2 — Add state variables

- [ ] In the component body, after the existing `useState` declarations add:

```typescript
const [payConfig,    setPayConfig]    = useState<PaymentConfig>({
  orangeMoneyNumber: '', mtnMoMoNumber: '', waveWallet: '',
  moyasarPublishableKey: '', stripePublishableKey: '', stripeAccountId: '',
  whatsappNumber: '', country: 'MA',
})
const [payLoading,   setPayLoading]   = useState(false)
const [paySaving,    setPaySaving]    = useState(false)
const [payMsg,       setPayMsg]       = useState<'ok' | 'err' | null>(null)
```

### Step 3 — Fetch payment config when tab is activated

- [ ] Add a `useEffect` after the existing data-fetch effects:

```typescript
useEffect(() => {
  if (activeTab !== 'payments') return
  setPayLoading(true)
  fetch('/api/admin/cafe/payment-config', { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d) setPayConfig(d) })
    .finally(() => setPayLoading(false))
}, [activeTab])
```

### Step 4 — Save handler

- [ ] Add the save function:

```typescript
async function savePaymentConfig() {
  setPaySaving(true); setPayMsg(null)
  try {
    const res = await fetch('/api/admin/cafe/payment-config', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
      body:    JSON.stringify(payConfig),
    })
    setPayMsg(res.ok ? 'ok' : 'err')
  } catch { setPayMsg('err') }
  finally { setPaySaving(false); setTimeout(() => setPayMsg(null), 3000) }
}
```

### Step 5 — Add "Paiements" tab button

- [ ] In the tabs nav (where 'profile', 'branding', etc. are rendered), add:

```tsx
<button onClick={() => setActiveTab('payments')}
  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
    activeTab === 'payments' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
  }`}>
  💳 {lang === 'ar' ? 'الدفع' : lang === 'fr' ? 'Paiements' : 'Payments'}
</button>
```

### Step 6 — Add "Paiements" tab content

- [ ] Add the tab panel (inside the existing `{activeTab === '...' && (...)}` pattern):

```tsx
{activeTab === 'payments' && (
  <div className="space-y-6">
    {payLoading ? (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    ) : (
      <>
        {/* ── Africa — Mobile Money ── */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🌍</span>
            <h3 className="font-bold text-white">Africa — Mobile Money</h3>
          </div>
          {[
            { key: 'orangeMoneyNumber', label: '🟠 Orange Money', placeholder: '+212 6XX XXX XXX' },
            { key: 'mtnMoMoNumber',     label: '🟡 MTN MoMo',     placeholder: '+225 0X XX XX XX' },
            { key: 'waveWallet',         label: '🔵 Wave',          placeholder: 'Numéro Wave' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-gray-400 font-semibold block mb-1">{label}</label>
              <input
                type="text"
                value={(payConfig as any)[key]}
                onChange={e => setPayConfig(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          ))}
        </div>

        {/* ── Gulf — Moyasar ── */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🇸🇦</span>
            <h3 className="font-bold text-white">Gulf — Moyasar</h3>
            <span className="text-xs text-gray-500">(Visa · Mada · Apple Pay · Google Pay)</span>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-semibold block mb-1">Moyasar Publishable Key</label>
            <input
              type="text"
              value={payConfig.moyasarPublishableKey}
              onChange={e => setPayConfig(p => ({ ...p, moyasarPublishableKey: e.target.value }))}
              placeholder="pk_live_..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>
        </div>

        {/* ── Global — Stripe ── */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">💳</span>
            <h3 className="font-bold text-white">Global — Stripe</h3>
            <span className="text-xs text-gray-500">(Visa · Apple Pay · Google Pay)</span>
          </div>
          {[
            { key: 'stripePublishableKey', label: 'Publishable Key', placeholder: 'pk_live_...' },
            { key: 'stripeAccountId',      label: 'Account ID (Connect)', placeholder: 'acct_...' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-gray-400 font-semibold block mb-1">{label}</label>
              <input
                type="text"
                value={(payConfig as any)[key]}
                onChange={e => setPayConfig(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          ))}
        </div>

        {/* ── Save ── */}
        {payMsg === 'ok'  && <p className="text-emerald-400 text-sm font-semibold">✅ Saved</p>}
        {payMsg === 'err' && <p className="text-red-400 text-sm font-semibold">❌ Error — try again</p>}
        <button onClick={savePaymentConfig} disabled={paySaving}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2">
          {paySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {lang === 'ar' ? 'حفظ' : lang === 'fr' ? 'Enregistrer' : 'Save'}
        </button>
      </>
    )}
  </div>
)}
```

- [ ] **Step 7: Commit**

```bash
git add app/admin/settings/page.tsx
git commit -m "feat(admin): Payments tab — configure payment providers per market"
```

---

## Task 4 — QR Menu: dynamic payment modal

**Files:**
- Modify: `app/[subdomain]/t/[tableNumber]/page.tsx`

The goal: store `paymentGateway` from `GET /api/menu/public` response, then show only configured payment options in the payment modal.

### Step 1 — Add `paymentGateway` to cafeShare state

- [ ] Change the `cafeShare` state initialization (around line 378):

```typescript
const [cafeShare, setCafeShare] = useState<{
  socialLinks: Record<string, string> | null
  hasSocialShareAddon: boolean
  isDemo: boolean
  googleMapsUrl: string | null
  tripadvisorUrl: string | null
  paymentGateway: {
    hasOrangeMoney: boolean
    hasMtnMomo: boolean
    hasWave: boolean
    moyasarPublishableKey: string | null
    hasStripe: boolean
    whatsappNumber: string | null
  } | null
}>({
  socialLinks: null, hasSocialShareAddon: false, isDemo: false,
  googleMapsUrl: null, tripadvisorUrl: null, paymentGateway: null,
})
```

### Step 2 — Store `paymentGateway` in `loadMenu()`

- [ ] In the `loadMenu()` function, inside the `setCafeShare({...})` call, add `paymentGateway`:

```typescript
setCafeShare({
  socialLinks:         data.socialLinks ?? null,
  hasSocialShareAddon: data.hasSocialShareAddon ?? false,
  isDemo:              data.isDemo ?? false,
  googleMapsUrl:       data.googleMapsUrl ?? null,
  tripadvisorUrl:      data.tripadvisorUrl ?? null,
  paymentGateway:      data.paymentGateway ?? null,
})
```

### Step 3 — Build dynamic payment options list

- [ ] Add a computed variable just before the `return` statement of `TablePageInner`:

```typescript
const pg = cafeShare.paymentGateway

const paymentOptions: { emoji: string; label: string; sub: string; action: () => void }[] = [
  // Cash — always shown
  {
    emoji: '💵',
    label: tr.payCash,
    sub: isRTL ? 'سيأتي النادل إليك' : lang === 'fr' ? 'Le serveur viendra vous voir' : 'Waiter will come to you',
    action: () => { callWaiter('pay_cash'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
  },
  // Cards / TPE — always shown (physical terminal)
  {
    emoji: '💳',
    label: tr.payCard,
    sub: isRTL ? 'TPE — سيحضر لك الجهاز' : lang === 'fr' ? 'Terminal TPE apporté à table' : 'TPE terminal brought to table',
    action: () => { callWaiter('pay_tpe'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
  },
  // Stripe (Apple Pay + Google Pay) — only if hasStripe
  ...(pg?.hasStripe ? [{
    emoji: '🍎',
    label: 'Apple Pay',
    sub: isRTL ? 'NFC · iPhone' : 'NFC · iPhone',
    action: () => { callWaiter('pay_tpe'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
  }, {
    emoji: '🤖',
    label: 'Google Pay',
    sub: isRTL ? 'NFC · Android' : 'NFC · Android',
    action: () => { callWaiter('pay_tpe'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
  }] : []),
  // Orange Money — only if configured
  ...(pg?.hasOrangeMoney ? [{
    emoji: '🟠',
    label: 'Orange Money',
    sub: isRTL ? 'دفع عبر Orange Money' : lang === 'fr' ? 'Paiement via Orange Money' : 'Pay via Orange Money',
    action: () => { callWaiter('pay_tpe'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
  }] : []),
  // MTN MoMo — only if configured
  ...(pg?.hasMtnMomo ? [{
    emoji: '🟡',
    label: 'MTN MoMo',
    sub: isRTL ? 'دفع عبر MTN MoMo' : lang === 'fr' ? 'Paiement via MTN MoMo' : 'Pay via MTN MoMo',
    action: () => { callWaiter('pay_tpe'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
  }] : []),
  // Wave — only if configured
  ...(pg?.hasWave ? [{
    emoji: '🔵',
    label: 'Wave',
    sub: isRTL ? 'دفع عبر Wave' : lang === 'fr' ? 'Paiement via Wave' : 'Pay via Wave',
    action: () => { callWaiter('pay_tpe'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
  }] : []),
]
```

### Step 4 — Replace static payment modal options with `paymentOptions`

- [ ] Find the payment modal JSX (the `{showPayment && ...}` block, around line 1435) and replace the static buttons with:

```tsx
<div className="space-y-2.5">
  {paymentOptions.map((opt, i) => (
    <button key={i} onClick={opt.action}
      className="w-full bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl p-4 flex items-center gap-4 transition-all">
      <span className="text-2xl shrink-0">{opt.emoji}</span>
      <div className={isRTL ? 'text-right' : 'text-left'}>
        <p className="font-bold text-white text-sm">{opt.label}</p>
        <p className="text-xs text-gray-400">{opt.sub}</p>
      </div>
    </button>
  ))}
  <button onClick={() => { setShowPayment(false); openBillModal() }}
    className="w-full bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 active:scale-95 rounded-2xl p-4 flex items-center gap-4 transition-all">
    <span className="text-2xl shrink-0">🧾</span>
    <div className={isRTL ? 'text-right' : 'text-left'}>
      <p className="font-bold text-blue-300 text-sm">{tr.requestBill}</p>
      <p className="text-xs text-gray-400">{isRTL ? 'اختر طريقة الدفع وشارك الفاتورة' : lang === 'fr' ? 'Partager ou payer séparément' : 'Split or share the bill'}</p>
    </div>
  </button>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add "app/[subdomain]/t/[tableNumber]/page.tsx"
git commit -m "feat(qr): dynamic payment modal — only show configured providers"
```

---

## Task 5 — Final push

- [ ] **Push all commits**

```bash
git push
```

---

## Self-Review Checklist

- [x] Schema change adds field without breaking existing data (new field has `@default("")`)
- [x] Backend routes are behind `authorizeAdmin` — no public access to secret keys
- [x] `GET /api/menu/public` already exposes only public-facing `paymentGateway` (no secret keys leak to client)
- [x] Admin UI fetches on tab switch, not on mount — no unnecessary calls
- [x] `paymentOptions` computed array keeps Cash + TPE always visible (waiter flow fallback)
- [x] No TypeScript errors — `as any` casts used only for Prisma embedded type access
- [x] Stripe Apple Pay / Google Pay shown only if `hasStripe` — which is true when `stripeAccountId` is set OR env `STRIPE_SECRET_KEY` exists
