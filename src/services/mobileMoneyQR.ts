/**
 * mobileMoneyQR — generates operator-specific payment payloads for
 * Orange Money (MA/SN/CI), MTN MoMo (GH/NG/CI/CM), and Wave (SN/CI/ML).
 *
 * Each operator has a different QR standard:
 *   Orange Money MA  — proprietary EMVCo-like string  *145*amount*phone#
 *   MTN MoMo        — EMVCo QR  (mtn-gh://pay?...)
 *   Wave            — wave://pay?to=phone&amount=N&note=...
 *
 * For customers who cannot scan QR (feature phone), we also produce a
 * USSD deep-link string they can dial, and an SMS body for WhatsApp fallback.
 */

import QRCode from 'qrcode'

export interface MobileMoneyConfig {
  orangeMoneyNumber: string
  mtnMoMoNumber:     string
  waveWallet:        string
}

export interface MobileMoneyPayload {
  operator:    'orange' | 'mtn' | 'wave'
  qrDataUrl:   string    // base64 PNG for <img src>
  qrRawString: string    // the raw string encoded in the QR
  ussdCode:    string    // e.g. *145*2*1*212600000000*500# (dial-to-pay)
  smsBody:     string    // pre-filled SMS / WhatsApp message
  logoEmoji:   string
  color:       string    // brand hex
}

export interface OrderSummary {
  total:       number
  currency:    string
  tableNumber: number
  items:       { name: string; qty: number }[]
  orderId:     string
}

// ─── Orange Money ─────────────────────────────────────────────────────────────

function buildOrangeQR(phone: string, amount: number, currency: string, note: string): string {
  // Orange Money MA USSD format: *145*2*1*<recipient>*<amount>#
  // The QR encodes the same string so the OM app can deep-link it
  const cleaned = phone.replace(/\D/g, '').replace(/^212/, '0')
  return `*145*2*1*${cleaned}*${Math.round(amount)}#`
}

function buildOrangeUssd(phone: string, amount: number): string {
  const cleaned = phone.replace(/\D/g, '').replace(/^212/, '0')
  return `*145*2*1*${cleaned}*${Math.round(amount)}#`
}

// ─── MTN MoMo ─────────────────────────────────────────────────────────────────

function buildMtnQR(phone: string, amount: number, currency: string, note: string): string {
  // MTN MoMo EMVCo-compatible deep-link
  const encoded = encodeURIComponent(note)
  return `mtn-momo://pay?to=${phone}&amount=${amount}&currency=${currency}&note=${encoded}`
}

function buildMtnUssd(phone: string, amount: number, country: string): string {
  // GH: *170#  NG: *671#  CI: *133#  CM: *126#
  const codes: Record<string, string> = { GH: '*170#', NG: '*671#', CI: '*133#', CM: '*126#' }
  const base = codes[country] ?? '*170#'
  return `Dial ${base} → Send Money → ${phone} → Amount: ${amount}`
}

// ─── Wave ────────────────────────────────────────────────────────────────────

function buildWaveQR(phone: string, amount: number, note: string): string {
  const encoded = encodeURIComponent(note)
  return `wave://pay?to=${phone}&amount=${amount}&note=${encoded}`
}

function buildWaveUssd(phone: string, amount: number): string {
  return `Open Wave app → Send → ${phone} → ${amount}`
}

// ─── SMS / WhatsApp body ──────────────────────────────────────────────────────

function buildSmsBody(summary: OrderSummary): string {
  const lines = summary.items.map(i => `${i.qty}x ${i.name}`).join(', ')
  return `ORDER Table ${summary.tableNumber}: ${lines} — Total: ${summary.total} ${summary.currency} — Ref: ${summary.orderId.slice(-6).toUpperCase()}`
}

// ─── Public builder ───────────────────────────────────────────────────────────

export async function buildMobileMoneyPayloads(
  config:  MobileMoneyConfig,
  summary: OrderSummary,
  country: string,
): Promise<MobileMoneyPayload[]> {
  const note    = `SmartResto Table ${summary.tableNumber} #${summary.orderId.slice(-6).toUpperCase()}`
  const smsBody = buildSmsBody(summary)
  const results: MobileMoneyPayload[] = []

  // Orange Money
  if (config.orangeMoneyNumber) {
    const raw  = buildOrangeQR(config.orangeMoneyNumber, summary.total, summary.currency, note)
    const qr   = await QRCode.toDataURL(raw, { width: 280, margin: 2, color: { dark: '#FF6600', light: '#fff' } })
    results.push({
      operator:    'orange',
      qrDataUrl:   qr,
      qrRawString: raw,
      ussdCode:    buildOrangeUssd(config.orangeMoneyNumber, summary.total),
      smsBody,
      logoEmoji:   '🟠',
      color:       '#FF6600',
    })
  }

  // MTN MoMo
  if (config.mtnMoMoNumber) {
    const raw  = buildMtnQR(config.mtnMoMoNumber, summary.total, summary.currency, note)
    const qr   = await QRCode.toDataURL(raw, { width: 280, margin: 2, color: { dark: '#FFCC00', light: '#fff' } })
    results.push({
      operator:    'mtn',
      qrDataUrl:   qr,
      qrRawString: raw,
      ussdCode:    buildMtnUssd(config.mtnMoMoNumber, summary.total, country),
      smsBody,
      logoEmoji:   '🟡',
      color:       '#FFCC00',
    })
  }

  // Wave
  if (config.waveWallet) {
    const raw  = buildWaveQR(config.waveWallet, summary.total, note)
    const qr   = await QRCode.toDataURL(raw, { width: 280, margin: 2, color: { dark: '#1A9CFF', light: '#fff' } })
    results.push({
      operator:    'wave',
      qrDataUrl:   qr,
      qrRawString: raw,
      ussdCode:    buildWaveUssd(config.waveWallet, summary.total),
      smsBody,
      logoEmoji:   '🔵',
      color:       '#1A9CFF',
    })
  }

  return results
}
