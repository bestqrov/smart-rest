// ─── Branded table QR — venue colours + logo, verified before printing ──────
// Design rules that keep the code scannable in a dim restaurant:
//   • error correction H (30%), logo ≤ 22% of the width on a white pad
//   • quiet zone of 4 modules (QR spec) — cameras need it to find the code
//   • rounded-square modules at 90% of a cell (circles lose too much ink)
//   • brand colour darkened until it has ≥ 4.5:1 contrast on white
// Then every image is decoded by the browser's own QR reader (BarcodeDetector,
// Chrome/Edge/Android) at full size and at a small print size; if it doesn't
// read back the exact URL we fall back to a simpler variant.

import QRCode from 'qrcode'

export type QrVariant = 'branded' | 'simple' | 'plain'
export interface QrResult { dataUrl: string; variant: QrVariant; verified: boolean | null }

const SIZE = 600

// ── colour helpers ───────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
function luminance([r, g, b]: [number, number, number]) {
  const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const contrastOnWhite = (rgb: [number, number, number]) => 1.05 / (luminance(rgb) + 0.05)
function mixBlack(rgb: [number, number, number], t: number): [number, number, number] {
  return [rgb[0] * (1 - t), rgb[1] * (1 - t), rgb[2] * (1 - t)]
}

/** Brand colour adjusted to be safely scannable on white (≥ 4.5:1). */
export function scannableColor(hex: string | null | undefined): { data: string; eye: string } {
  let rgb = hexToRgb(hex ?? '') ?? [17, 24, 39]
  for (let i = 0; i < 20 && contrastOnWhite(rgb) < 4.5; i++) rgb = mixBlack(rgb, 0.12)
  const eye = mixBlack(rgb, 0.35)
  return { data: toHex(...rgb), eye: toHex(...eye) }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
}

// ── drawing ──────────────────────────────────────────────────────────────────
async function draw(url: string, o: { color: string; eye: string; logo: HTMLImageElement | null; logoRatio: number; rounded: boolean }): Promise<HTMLCanvasElement> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qr: any = (QRCode as any).create(url, { errorCorrectionLevel: 'H' })
  const n: number = qr.modules.size
  const quiet = 4
  const cell = SIZE / (n + quiet * 2)
  const off = quiet * cell

  const canvas = document.createElement('canvas')
  canvas.width = SIZE; canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, SIZE, SIZE)

  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)

  // data modules
  ctx.fillStyle = o.color
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.modules.get(r, c) || inFinder(r, c)) continue
    const x = off + c * cell, y = off + r * cell
    if (o.rounded) { const s = cell * 0.9, d = (cell - s) / 2; roundRect(ctx, x + d, y + d, s, s, s * 0.3) }
    else ctx.fillRect(x, y, cell + 0.5, cell + 0.5)
  }

  // finder "eyes" drawn as whole shapes (rounded frame + inner dot)
  const eyes: [number, number][] = [[0, 0], [0, n - 7], [n - 7, 0]]
  for (const [r, c] of eyes) {
    const x = off + c * cell, y = off + r * cell, s = cell * 7
    ctx.fillStyle = o.eye
    roundRect(ctx, x, y, s, s, o.rounded ? cell * 1.8 : 0)
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, x + cell, y + cell, s - 2 * cell, s - 2 * cell, o.rounded ? cell * 1.2 : 0)
    ctx.fillStyle = o.eye
    roundRect(ctx, x + 2 * cell, y + 2 * cell, 3 * cell, 3 * cell, o.rounded ? cell * 0.9 : 0)
  }

  // centre logo on a white rounded pad (object-contain)
  if (o.logo) {
    const box = SIZE * o.logoRatio
    const pad = box * 0.14
    const bx = (SIZE - box) / 2, by = (SIZE - box) / 2
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, bx - pad, by - pad, box + 2 * pad, box + 2 * pad, (box + 2 * pad) * 0.22)
    const k = Math.min(box / o.logo.width, box / o.logo.height)
    const w = o.logo.width * k, h = o.logo.height * k
    ctx.drawImage(o.logo, (SIZE - w) / 2, (SIZE - h) / 2, w, h)
  }
  return canvas
}

// ── verification with the browser's own QR reader ───────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let detector: any | null | undefined
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDetector(): Promise<any | null> {
  if (detector !== undefined) return detector
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BD = (globalThis as any).BarcodeDetector
    if (!BD) return (detector = null)
    const formats: string[] = await BD.getSupportedFormats?.() ?? []
    detector = formats.includes('qr_code') ? new BD({ formats: ['qr_code'] }) : null
  } catch { detector = null }
  return detector
}

async function verify(canvas: HTMLCanvasElement, url: string): Promise<boolean | null> {
  const d = await getDetector()
  if (!d) return null
  try {
    for (const px of [SIZE, 160]) {           // on-screen size and a small table-tent print
      const c = document.createElement('canvas'); c.width = px; c.height = px
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(canvas, 0, 0, px, px)
      const codes = await d.detect(c)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!codes.some((x: any) => x.rawValue === url)) return false
    }
    return true
  } catch { return null }
}

/** Branded → simple → plain, keeping the first variant that verifiably scans. */
export async function makeBrandedQr(url: string, opts: { logoUrl: string | null; color?: string | null }): Promise<QrResult> {
  const { data, eye } = scannableColor(opts.color)
  let logo: HTMLImageElement | null = null
  if (opts.logoUrl) { try { logo = await loadImage(opts.logoUrl) } catch { logo = null } }

  const attempts: { variant: QrVariant; build: () => Promise<HTMLCanvasElement> }[] = [
    { variant: 'branded', build: () => draw(url, { color: data, eye, logo, logoRatio: 0.22, rounded: true }) },
    { variant: 'simple',  build: () => draw(url, { color: '#111827', eye: '#111827', logo, logoRatio: 0.18, rounded: false }) },
    { variant: 'plain',   build: () => draw(url, { color: '#000000', eye: '#000000', logo: null, logoRatio: 0, rounded: false }) },
  ]
  let last: QrResult | null = null
  for (const a of attempts) {
    const canvas = await a.build()
    const ok = await verify(canvas, url)
    last = { dataUrl: canvas.toDataURL('image/png'), variant: a.variant, verified: ok }
    if (ok !== false) return last          // verified, or no reader available (design rules apply)
  }
  return last!
}

// ── print-ready card: logo, name, QR, table, call to action ─────────────────
export async function makeTableCard(qrDataUrl: string, o: {
  cafeName: string; tableLabel: string; cta: string; color?: string | null; logoUrl: string | null; rtl: boolean
}): Promise<string> {
  const W = 700, H = 980
  const { data, eye } = scannableColor(o.color)
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = data; roundRect(ctx, 0, 0, W, 150, 0)
  ctx.direction = o.rtl ? 'rtl' : 'ltr'
  ctx.textAlign = 'center'

  let headerY = 95
  if (o.logoUrl) {
    try {
      const logo = await loadImage(o.logoUrl)
      const s = 96, k = Math.min(s / logo.width, s / logo.height)
      ctx.fillStyle = '#ffffff'; roundRect(ctx, W / 2 - 62, 26, 124, 124, 28)
      ctx.drawImage(logo, W / 2 - (logo.width * k) / 2, 88 - (logo.height * k) / 2, logo.width * k, logo.height * k)
      headerY = 200
    } catch { /* no logo */ }
  }
  ctx.fillStyle = headerY > 150 ? eye : '#ffffff'
  ctx.font = 'bold 40px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(o.cafeName, W / 2, headerY, W - 80)

  const qr = await loadImage(qrDataUrl)
  const qs = 520, qy = headerY + 30
  ctx.drawImage(qr, (W - qs) / 2, qy, qs, qs)

  ctx.fillStyle = eye
  ctx.font = '900 56px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(o.tableLabel, W / 2, qy + qs + 70, W - 80)
  ctx.fillStyle = '#4b5563'
  ctx.font = '600 30px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(o.cta, W / 2, qy + qs + 118, W - 80)
  return c.toDataURL('image/png')
}
