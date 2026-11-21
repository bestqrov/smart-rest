'use client'

/**
 * LiveOrderTracker — customer-facing real-time order status stepper.
 *
 * Receives the current `status` as a prop (kept in sync via socket in the
 * parent page). Renders a compact 4-step horizontal stepper:
 *
 *   PENDING → PREPARING → READY → DELIVERED
 *
 * Colours come from the page's --brand CSS variables (venue accent colour).
 */

import React from 'react'
import { motion } from 'framer-motion'
import { Check, ChefHat, ClipboardCheck, BellRing, UtensilsCrossed, XCircle } from 'lucide-react'

type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'
type L = 'ar' | 'fr' | 'en' | 'es'

const STEPS: { key: OrderStatus; Icon: typeof ClipboardCheck; label: Record<L, string> }[] = [
  { key: 'PENDING',   Icon: ClipboardCheck,       label: { ar: 'تم الاستلام', fr: 'Reçue',          en: 'Received', es: 'Recibido' } },
  { key: 'PREPARING', Icon: ChefHat,         label: { ar: 'التحضير',     fr: 'En préparation', en: 'Preparing', es: 'Preparando' } },
  { key: 'READY',     Icon: BellRing,        label: { ar: 'جاهز',        fr: 'Prêt',           en: 'Ready',     es: 'Listo' } },
  { key: 'DELIVERED', Icon: UtensilsCrossed, label: { ar: 'تم التقديم',  fr: 'Servi',          en: 'Served',    es: 'Servido' } },
]

const STATUS_INDEX: Record<string, number> = {
  PENDING:   0,
  PREPARING: 1,
  READY:     2,
  DELIVERED: 3,
  COMPLETED: 3,
}

interface Props {
  status:   OrderStatus | string
  lang?:    L
  orderId?: string
}

export default function LiveOrderTracker({ status, lang = 'fr', orderId }: Props) {
  const currentIndex = STATUS_INDEX[status] ?? 0
  const isCancelled  = status === 'CANCELLED'

  if (isCancelled) {
    return (
      <div className="rounded-xl bg-red-500/10 ring-1 ring-red-500/20 p-3 flex items-center justify-center gap-2 text-red-300">
        <XCircle size={18} />
        <p className="text-sm font-semibold">
          {lang === 'ar' ? 'تم إلغاء الطلب' : lang === 'fr' ? 'Commande annulée' : lang === 'es' ? 'Pedido cancelado' : 'Order cancelled'}
        </p>
      </div>
    )
  }

  const pct = (currentIndex / (STEPS.length - 1)) * 100

  return (
    <div>
      {orderId && (
        <p className="mb-2 text-[11px] text-zinc-500 tracking-wide">
          {lang === 'ar' ? 'تتبع طلبك' : lang === 'fr' ? 'Suivi de commande' : lang === 'es' ? 'Seguimiento' : 'Order tracking'}
          <span className="ms-1 opacity-70 tabular-nums" dir="ltr">#{orderId.slice(-6)}</span>
        </p>
      )}
      <div className="relative">
        {/* Track (logical: grows from the start side in both LTR and RTL) */}
        <div className="absolute top-4 inset-x-4 h-0.5 rounded-full bg-white/10" />
        <div className="absolute top-4 start-4 end-4 h-0.5">
          <motion.div
            className="h-full rounded-full bg-[var(--brand,#10b981)]"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <ol className="relative grid grid-cols-4">
          {STEPS.map((step, i) => {
            const done   = i < currentIndex
            const active = i === currentIndex
            const { Icon } = step
            return (
              <li key={step.key} className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={[
                    'relative flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-500',
                    done || active ? 'bg-[var(--brand,#10b981)] text-[var(--brand-fg,#fff)]' : 'bg-zinc-800 text-zinc-500 ring-1 ring-white/10',
                  ].join(' ')}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-full bg-[var(--brand,#10b981)] opacity-40 animate-ping motion-reduce:hidden" />
                  )}
                  {done ? <Check size={15} strokeWidth={3} /> : <Icon size={15} />}
                </span>
                <span className={`text-[11px] leading-tight font-semibold ${active ? 'text-white' : done ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {step.label[lang] ?? step.label.en}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
