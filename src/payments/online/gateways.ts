// ─── Restaurant-owned online gateways (Gulf) ─────────────────────────────────
// Each adapter uses the RESTAURANT's own secret key, so funds settle directly
// into the restaurant's account — the platform never holds customer money.
//
// All three use a hosted payment page (redirect), so card data never touches
// our servers. Confirmation NEVER trusts a callback body: we always re-fetch
// the payment from the provider with the restaurant's secret key.
//
//   TAP     — KSA, UAE, Oman, Kuwait, Bahrain, Qatar (mada, KNET, Benefit, Apple Pay, cards)
//   MOYASAR — KSA (mada, Apple Pay, STC Pay, cards)
//   STRIPE  — UAE and others (cards, Apple Pay, Google Pay)

// eslint-disable-next-line @typescript-eslint/no-var-requires
const StripeLib = require('stripe')

export type OnlineProvider = 'TAP' | 'MOYASAR' | 'STRIPE'
export const ONLINE_PROVIDERS: OnlineProvider[] = ['TAP', 'MOYASAR', 'STRIPE']

export interface CreateCheckoutInput {
  secretKey:   string
  amount:      number   // major units (e.g. 45.5 SAR)
  currency:    string   // ISO 4217
  payId:       string   // our OnlinePayment id
  description: string
  returnUrl:   string   // customer browser comes back here
  callbackUrl: string   // server-to-server notification (Tap / Moyasar)
  customerPhone?: string
}

export interface CheckoutResult { providerRef: string; redirectUrl: string }

export interface ProviderStatus {
  paid:     boolean
  failed:   boolean
  amount:   number   // major units actually charged
  currency: string
}

// Three-decimal currencies used in the Gulf region.
const THREE_DECIMALS = new Set(['KWD', 'BHD', 'OMR', 'JOD', 'TND', 'IQD', 'LYD'])
export function minorFactor(currency: string): number {
  return THREE_DECIMALS.has(currency.toUpperCase()) ? 1000 : 100
}
export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * minorFactor(currency))
}

async function httpJson(url: string, init: RequestInit): Promise<any> {
  const res  = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) })
  const text = await res.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
  if (!res.ok) {
    const msg = body?.errors?.[0]?.description ?? body?.message ?? body?.error?.message ?? `HTTP ${res.status}`
    const err = new Error(`Gateway error: ${msg}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return body
}

// ─── Tap Payments ────────────────────────────────────────────────────────────

const TAP_API = 'https://api.tap.company/v2'

async function tapCreate(i: CreateCheckoutInput): Promise<CheckoutResult> {
  const body = {
    amount:      Number(i.amount.toFixed(minorFactor(i.currency) === 1000 ? 3 : 2)),
    currency:    i.currency.toUpperCase(),
    description: i.description,
    customer:    { first_name: 'Guest' },
    source:      { id: 'src_all' },
    reference:   { transaction: i.payId, order: i.payId },
    metadata:    { payId: i.payId },
    redirect:    { url: i.returnUrl },
    post:        { url: i.callbackUrl },
  }
  const r = await httpJson(`${TAP_API}/charges`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${i.secretKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  const url = r?.transaction?.url
  if (!r?.id || !url) throw new Error('Tap did not return a payment URL')
  return { providerRef: r.id, redirectUrl: url }
}

async function tapStatus(secretKey: string, ref: string): Promise<ProviderStatus> {
  const r = await httpJson(`${TAP_API}/charges/${encodeURIComponent(ref)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const s = String(r?.status ?? '').toUpperCase()
  return {
    paid:     s === 'CAPTURED',
    failed:   ['FAILED', 'DECLINED', 'CANCELLED', 'ABANDONED', 'VOID', 'RESTRICTED', 'TIMEDOUT', 'UNKNOWN'].includes(s),
    amount:   Number(r?.amount ?? 0),
    currency: String(r?.currency ?? '').toUpperCase(),
  }
}

async function tapTest(secretKey: string): Promise<void> {
  await httpJson(`${TAP_API}/charges/list`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ limit: 1 }),
  })
}

// ─── Moyasar (hosted invoice) ────────────────────────────────────────────────

const MOYASAR_API = 'https://api.moyasar.com/v1'
const basic = (k: string) => 'Basic ' + Buffer.from(`${k}:`).toString('base64')

async function moyasarCreate(i: CreateCheckoutInput): Promise<CheckoutResult> {
  const r = await httpJson(`${MOYASAR_API}/invoices`, {
    method:  'POST',
    headers: { Authorization: basic(i.secretKey), 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      amount:       toMinor(i.amount, i.currency),
      currency:     i.currency.toUpperCase(),
      description:  i.description,
      callback_url: i.callbackUrl,
      success_url:  i.returnUrl,
      back_url:     i.returnUrl,
      metadata:     { payId: i.payId },
    }),
  })
  if (!r?.id || !r?.url) throw new Error('Moyasar did not return a payment URL')
  return { providerRef: r.id, redirectUrl: r.url }
}

async function moyasarStatus(secretKey: string, ref: string): Promise<ProviderStatus> {
  const r = await httpJson(`${MOYASAR_API}/invoices/${encodeURIComponent(ref)}`, {
    headers: { Authorization: basic(secretKey) },
  })
  const s        = String(r?.status ?? '').toLowerCase()
  const currency = String(r?.currency ?? '').toUpperCase()
  return {
    paid:     s === 'paid',
    failed:   s === 'failed' || s === 'canceled' || s === 'expired',
    amount:   Number(r?.amount ?? 0) / minorFactor(currency || 'SAR'),
    currency,
  }
}

async function moyasarTest(secretKey: string): Promise<void> {
  await httpJson(`${MOYASAR_API}/invoices?page=1`, { headers: { Authorization: basic(secretKey) } })
}

// ─── Stripe (restaurant's own account) ───────────────────────────────────────

async function stripeCreate(i: CreateCheckoutInput): Promise<CheckoutResult> {
  const stripe  = new StripeLib(i.secretKey)
  const session = await stripe.checkout.sessions.create({
    mode:                'payment',
    line_items: [{
      price_data: {
        currency:     i.currency.toLowerCase(),
        unit_amount:  toMinor(i.amount, i.currency),
        product_data: { name: i.description },
      },
      quantity: 1,
    }],
    success_url:         i.returnUrl,
    cancel_url:          i.returnUrl,
    client_reference_id: i.payId,
    metadata:            { payId: i.payId },
    expires_at:          Math.floor(Date.now() / 1000) + 1800,
  })
  if (!session?.id || !session?.url) throw new Error('Stripe did not return a payment URL')
  return { providerRef: session.id, redirectUrl: session.url }
}

async function stripeStatus(secretKey: string, ref: string): Promise<ProviderStatus> {
  const stripe   = new StripeLib(secretKey)
  const s        = await stripe.checkout.sessions.retrieve(ref)
  const currency = String(s?.currency ?? '').toUpperCase()
  return {
    paid:     s?.payment_status === 'paid',
    failed:   s?.status === 'expired',
    amount:   Number(s?.amount_total ?? 0) / minorFactor(currency || 'USD'),
    currency,
  }
}

async function stripeTest(secretKey: string): Promise<void> {
  const stripe = new StripeLib(secretKey)
  await stripe.balance.retrieve()
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

export function createCheckout(p: OnlineProvider, i: CreateCheckoutInput): Promise<CheckoutResult> {
  if (p === 'TAP')     return tapCreate(i)
  if (p === 'MOYASAR') return moyasarCreate(i)
  return stripeCreate(i)
}

export function fetchStatus(p: OnlineProvider, secretKey: string, ref: string): Promise<ProviderStatus> {
  if (p === 'TAP')     return tapStatus(secretKey, ref)
  if (p === 'MOYASAR') return moyasarStatus(secretKey, ref)
  return stripeStatus(secretKey, ref)
}

/** Cheap authenticated read — proves the key is valid without charging anything. */
export function testCredentials(p: OnlineProvider, secretKey: string): Promise<void> {
  if (p === 'TAP')     return tapTest(secretKey)
  if (p === 'MOYASAR') return moyasarTest(secretKey)
  return stripeTest(secretKey)
}

/** Basic shape check so obvious paste mistakes (publishable key instead of secret) fail early. */
export function looksLikeSecretKey(p: OnlineProvider, key: string): boolean {
  if (p === 'TAP')     return /^sk_(test|live)_[A-Za-z0-9]+$/.test(key)
  if (p === 'MOYASAR') return /^sk_(test|live)_[A-Za-z0-9]+$/.test(key)
  return /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(key)
}
