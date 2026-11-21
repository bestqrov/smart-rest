'use client'

/**
 * Presentational building blocks for the guest QR table page.
 * Pure UI — no fetches, no business state. The page owns all logic.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion, AnimatePresence, useDragControls, type PanInfo } from 'framer-motion'
import { Check, Globe, Minus, Plus, SearchX, X } from 'lucide-react'

// ─── Brand colour ─────────────────────────────────────────────────────────────

export const DEFAULT_BRAND = '#10b981'

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance([r, g, b]: [number, number, number]) {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/**
 * CSS variables driven by the venue accent colour:
 *  --brand       solid fill (buttons, active chip, cart bar)
 *  --brand-fg    readable text on top of --brand (white or near-black)
 *  --brand-text  brand colour used as text on the dark surface (lightened if too dark)
 *  --brand-soft  translucent tint for subtle backgrounds
 */
export function brandVars(accent?: string | null): CSSProperties {
  const rgb = (accent && parseHex(accent)) || parseHex(DEFAULT_BRAND)!
  const lum = luminance(rgb)
  const fg = lum > 0.42 ? '#0a0a0a' : '#ffffff'
  // Mix towards white until it reads on a zinc-950 surface
  const mix = lum < 0.12 ? 0.55 : lum < 0.22 ? 0.3 : 0
  const txt = rgb.map(c => Math.round(c + (255 - c) * mix)) as [number, number, number]
  return {
    ['--brand' as string]: `rgb(${rgb.join(' ')})`,
    ['--brand-fg' as string]: fg,
    ['--brand-text' as string]: `rgb(${txt.join(' ')})`,
    ['--brand-soft' as string]: `rgb(${rgb.join(' ')} / 0.16)`,
  }
}

/** Remove trailing emoji from a translated label (labels are reused next to icons). */
export function stripEmoji(s: string): string {
  return s.replace(/[\s‍️]*(\p{Extended_Pictographic}[‍️]*)+\s*$/u, '').replace(/^\s*(\p{Extended_Pictographic}[‍️]*)+\s*/u, '').trim()
}

export function haptic() {
  try { navigator.vibrate?.(10) } catch {}
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

export function BottomSheet({
  open, onClose, children, z = 40, className = '', style, ariaLabel,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  z?: number
  className?: string
  style?: CSSProperties
  ariaLabel?: string
}) {
  const controls = useDragControls()

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: z }} role="dialog" aria-modal="true" aria-label={ariaLabel}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            drag="y" dragListener={false} dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            className={`relative w-full max-w-lg bg-zinc-900 rounded-t-[28px] ring-1 ring-white/[0.06] shadow-2xl flex flex-col max-h-[88dvh] ${className}`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)', ...style }}
          >
            <div
              className="shrink-0 pt-2.5 pb-2 flex justify-center cursor-grab touch-none"
              onPointerDown={e => controls.start(e)}
            >
              <div className="w-10 h-1.5 rounded-full bg-white/15" />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function SheetHeader({ title, sub, onClose, closeLabel }: { title: ReactNode; sub?: ReactNode; onClose?: () => void; closeLabel?: string }) {
  return (
    <div className="shrink-0 px-5 pb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-extrabold text-lg text-white leading-tight">{title}</h3>
        {sub && <p className="text-sm text-zinc-400 mt-1">{sub}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} aria-label={closeLabel}
          className="w-9 h-9 shrink-0 rounded-full bg-white/[0.07] flex items-center justify-center text-zinc-300 active:scale-90 transition-transform">
          <X size={18} />
        </button>
      )}
    </div>
  )
}

// ─── Full-screen states (invalid / expired / full) ────────────────────────────

export function StatusScreen({ icon, title, sub, dir, tone = 'neutral' }: {
  icon: ReactNode; title: string; sub: string; dir: 'rtl' | 'ltr'; tone?: 'neutral' | 'warn'
}) {
  return (
    <div dir={dir} className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center gap-5 px-8 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 18 }}
        className={`w-24 h-24 rounded-full flex items-center justify-center ring-8 ${
          tone === 'warn' ? 'bg-amber-400/10 text-amber-300 ring-amber-400/[0.04]' : 'bg-white/[0.06] text-zinc-200 ring-white/[0.03]'
        }`}
      >
        {icon}
      </motion.div>
      <div className="space-y-2 max-w-xs">
        <h2 className="text-xl font-extrabold text-white">{title}</h2>
        <p className="text-zinc-400 text-sm leading-relaxed">{sub}</p>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function MenuSkeleton({ label, dir }: { label: string; dir: 'rtl' | 'ltr' }) {
  return (
    <div dir={dir} className="min-h-[100dvh] bg-zinc-950" aria-busy="true" aria-label={label}>
      <div className="px-4 py-3 flex items-center gap-3 border-b border-white/[0.05]">
        <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-32 rounded-full bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
        <div className="ms-auto h-7 w-16 rounded-full bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="px-4 pt-3 space-y-3">
        <div className="h-11 rounded-2xl bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
        <div className="flex gap-2 overflow-hidden">
          {[72, 96, 64, 88, 70].map((w, i) => (
            <div key={i} className="h-8 shrink-0 rounded-full bg-white/[0.06] animate-pulse motion-reduce:animate-none" style={{ width: w }} />
          ))}
        </div>
      </div>
      <p className="px-4 pt-5 pb-2 text-xs font-semibold text-zinc-500">{label}</p>
      <div className="px-4 space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-2xl bg-white/[0.03]">
            <div className="w-20 h-20 shrink-0 rounded-xl bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-2/3 rounded-full bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
              <div className="h-3 w-full rounded-full bg-white/[0.05] animate-pulse motion-reduce:animate-none" />
              <div className="h-3 w-1/3 rounded-full bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Language switch ──────────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = { ar: 'العربية', en: 'English', fr: 'Français', es: 'Español' }

export function LangSwitch<L extends string>({ lang, langs, onChange, label }: {
  lang: L; langs: L[]; onChange: (l: L) => void; label: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label={label} aria-expanded={open}
        className="h-8 px-2.5 rounded-full bg-white/[0.07] text-zinc-200 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform">
        <Globe size={14} />
        {lang.toUpperCase()}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute end-0 top-10 z-50 w-40 rounded-2xl bg-zinc-800 ring-1 ring-white/10 shadow-2xl p-1"
          >
            {langs.map(l => (
              <li key={l}>
                <button onClick={() => { onChange(l); setOpen(false) }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm ${l === lang ? 'text-white font-bold bg-white/[0.06]' : 'text-zinc-300'}`}>
                  <span>{LANG_NAMES[l] ?? l}</span>
                  {l === lang && <Check size={15} className="text-[var(--brand-text)]" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Quantity controls ────────────────────────────────────────────────────────

export function AddStepper({ qty, onAdd, onRemove, addLabel, removeLabel }: {
  qty: number; onAdd: () => void; onRemove: () => void; addLabel: string; removeLabel: string
}) {
  return (
    <div className="h-9 flex items-center" onClick={e => e.stopPropagation()}>
      <AnimatePresence initial={false} mode="popLayout">
        {qty === 0 ? (
          <motion.button key="add" onClick={onAdd} aria-label={addLabel}
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
            whileTap={{ scale: 0.85 }}
            className="w-9 h-9 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] flex items-center justify-center shadow-md shadow-black/30">
            <Plus size={18} strokeWidth={2.75} />
          </motion.button>
        ) : (
          <motion.div key="stepper"
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
            className="h-9 flex items-center rounded-full bg-white/[0.08] ring-1 ring-white/[0.06]">
            <motion.button whileTap={{ scale: 0.82 }} onClick={onRemove} aria-label={removeLabel}
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-200">
              <Minus size={16} strokeWidth={2.75} />
            </motion.button>
            <motion.span key={qty} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="min-w-[1.25rem] text-center text-sm font-extrabold text-white tabular-nums">{qty}</motion.span>
            <motion.button whileTap={{ scale: 0.82 }} onClick={onAdd} aria-label={addLabel}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--brand)] text-[var(--brand-fg)]">
              <Plus size={16} strokeWidth={2.75} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Product row ──────────────────────────────────────────────────────────────

export function ProductRow({ name, description, price, imageUrl, qty, onOpen, onAdd, onRemove, addLabel, removeLabel }: {
  name: string; description: string | null; price: string; imageUrl: string | null; qty: number
  onOpen: () => void; onAdd: () => void; onRemove: () => void; addLabel: string; removeLabel: string
}) {
  return (
    <div
      role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className={`flex gap-3 p-3 rounded-2xl bg-white/[0.035] active:bg-white/[0.06] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${qty > 0 ? 'ring-1 ring-[var(--brand-soft)]' : ''}`}
    >
      {imageUrl && (
        <img src={imageUrl} alt="" loading="lazy" className="w-[84px] h-[84px] shrink-0 rounded-xl object-cover bg-white/[0.04]" />
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <p className="font-bold text-[15px] text-white leading-snug line-clamp-2">{name}</p>
        {description && <p className="text-[13px] text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">{description}</p>}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <span className="text-[var(--brand-text)] font-extrabold text-sm tabular-nums">{price}</span>
          <AddStepper qty={qty} onAdd={onAdd} onRemove={onRemove} addLabel={addLabel} removeLabel={removeLabel} />
        </div>
      </div>
    </div>
  )
}

// ─── Product detail sheet ─────────────────────────────────────────────────────

export type SheetProduct = { id: string; name: string; description: string | null; imageUrl: string | null; price: number }

export function ProductSheet({ product, onClose, onConfirm, money, initialNote, labels }: {
  product: SheetProduct | null
  onClose: () => void
  onConfirm: (qty: number, note: string) => void
  money: (n: number) => string
  initialNote: string
  labels: { addToOrder: string; note: string; notePlaceholder: string; add: string; remove: string; close: string }
}) {
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  useEffect(() => { if (product) { setQty(1); setNote(initialNote) } }, [product?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BottomSheet open={!!product} onClose={onClose} z={45} ariaLabel={product?.name}>
      {product && (
        <>
          <div className="overflow-y-auto overscroll-contain">
            {product.imageUrl && (
              <div className="px-4">
                <img src={product.imageUrl} alt={product.name} className="w-full aspect-[4/3] object-cover rounded-2xl bg-white/[0.04]" />
              </div>
            )}
            <div className="px-5 pt-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-extrabold text-white leading-tight">{product.name}</h3>
                <button onClick={onClose} aria-label={labels.close}
                  className="w-9 h-9 shrink-0 rounded-full bg-white/[0.07] flex items-center justify-center text-zinc-300">
                  <X size={18} />
                </button>
              </div>
              <p className="text-[var(--brand-text)] font-extrabold text-lg tabular-nums">{money(product.price)}</p>
              {product.description && <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{product.description}</p>}
            </div>
            <div className="px-5 pt-5 pb-2">
              <label className="text-xs font-bold text-zinc-400">{labels.note}</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder={labels.notePlaceholder} maxLength={140}
                className="mt-1.5 w-full bg-white/[0.06] text-white placeholder-zinc-500 rounded-xl px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]" />
            </div>
          </div>
          <div className="shrink-0 px-5 pt-3 pb-4 flex items-center gap-3 border-t border-white/[0.05]">
            <div className="h-12 flex items-center rounded-full bg-white/[0.07]">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label={labels.remove} disabled={qty <= 1}
                className="w-12 h-12 flex items-center justify-center text-zinc-200 disabled:opacity-30"><Minus size={18} /></button>
              <span className="min-w-[1.5rem] text-center font-extrabold text-white tabular-nums">{qty}</span>
              <button onClick={() => setQty(q => Math.min(99, q + 1))} aria-label={labels.add}
                className="w-12 h-12 flex items-center justify-center text-zinc-200"><Plus size={18} /></button>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => onConfirm(qty, note.trim())}
              className="flex-1 h-12 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-between px-5 gap-2">
              <span className="truncate">{labels.addToOrder}</span>
              <span className="tabular-nums shrink-0">{money(product.price * qty)}</span>
            </motion.button>
          </div>
        </>
      )}
    </BottomSheet>
  )
}

// ─── Empty search ─────────────────────────────────────────────────────────────

export function EmptySearch({ title, sub, clearLabel, onClear }: { title: string; sub: string; clearLabel: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-16 gap-3">
      <div className="w-16 h-16 rounded-full bg-white/[0.06] flex items-center justify-center text-zinc-400">
        <SearchX size={28} />
      </div>
      <p className="font-bold text-white">{title}</p>
      <p className="text-sm text-zinc-400 max-w-[16rem]">{sub}</p>
      <button onClick={onClear} className="mt-1 h-10 px-5 rounded-full bg-white/[0.08] text-sm font-bold text-white active:scale-95 transition-transform">
        {clearLabel}
      </button>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export function Toast({ msg, tone = 'brand' }: { msg: string; tone?: 'brand' | 'info' | 'error' }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
          className="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
          style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}>
          <div className={`max-w-sm text-center text-sm font-bold px-4 py-2.5 rounded-2xl shadow-xl ring-1 ring-white/10 ${
            tone === 'brand' ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : tone === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white'
          }`}>
            {msg}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
