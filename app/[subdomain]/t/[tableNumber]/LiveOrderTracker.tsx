'use client'

/**
 * LiveOrderTracker — customer-facing real-time order status timeline.
 *
 * Receives the current `status` as a prop (kept in sync via socket in the
 * parent page). Renders a 4-step vertical timeline with animated transitions:
 *
 *   PENDING → PREPARING → READY → DELIVERED
 *
 * Each step glows when active and fades when future.
 */

import React from 'react'

type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'

interface Step {
  key:     OrderStatus
  labelAr: string
  labelFr: string
  labelEn: string
  icon:    string
}

const STEPS: Step[] = [
  { key: 'PENDING',   icon: '🧾', labelAr: 'تم استلام طلبك',  labelFr: 'Commande reçue',     labelEn: 'Order received'  },
  { key: 'PREPARING', icon: '👨‍🍳', labelAr: 'يتم التحضير',     labelFr: 'En préparation',     labelEn: 'Preparing'       },
  { key: 'READY',     icon: '✅', labelAr: 'جاهز للتقديم',   labelFr: 'Prêt à servir',      labelEn: 'Ready to serve'  },
  { key: 'DELIVERED', icon: '🍽️', labelAr: 'تم التقديم',      labelFr: 'Servi',              labelEn: 'Served'          },
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
  lang?:    'ar' | 'fr' | 'en'
  orderId?: string
}

export default function LiveOrderTracker({ status, lang = 'fr', orderId }: Props) {
  const currentIndex = STATUS_INDEX[status] ?? 0
  const isCancelled  = status === 'CANCELLED'

  if (isCancelled) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
        <span className="text-2xl">❌</span>
        <p className="mt-1 text-sm font-medium text-red-600">
          {lang === 'ar' ? 'تم إلغاء الطلب' : lang === 'fr' ? 'Commande annulée' : 'Order cancelled'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      {/* Header */}
      <p className="mb-4 text-xs text-gray-400 text-center tracking-wide uppercase">
        {lang === 'ar' ? 'تتبع طلبك' : lang === 'fr' ? 'Suivi de commande' : 'Order tracking'}
        {orderId && <span className="ml-1 opacity-50">#{orderId.slice(-6)}</span>}
      </p>

      {/* Timeline */}
      <div className="relative flex flex-col gap-0">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentIndex
          const isActive    = i === currentIndex
          const isFuture    = i > currentIndex

          const label = lang === 'ar' ? step.labelAr : lang === 'fr' ? step.labelFr : step.labelEn

          return (
            <div key={step.key} className="flex items-start gap-3">
              {/* Icon column */}
              <div className="flex flex-col items-center">
                {/* Circle */}
                <div
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full text-base transition-all duration-500',
                    isCompleted ? 'bg-emerald-500 text-white shadow-md'         : '',
                    isActive    ? 'bg-emerald-500 text-white shadow-emerald-300 shadow-lg scale-110 ring-2 ring-emerald-300 ring-offset-1' : '',
                    isFuture    ? 'bg-gray-100 text-gray-300'                   : '',
                  ].join(' ')}
                >
                  {isCompleted ? '✓' : step.icon}
                </div>

                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div
                    className={[
                      'my-0.5 w-0.5 flex-1 transition-all duration-700',
                      i < currentIndex ? 'bg-emerald-400 h-6' : 'bg-gray-100 h-6'
                    ].join(' ')}
                  />
                )}
              </div>

              {/* Label column */}
              <div className={`pb-4 pt-1.5 ${lang === 'ar' ? 'text-right' : ''}`}>
                <p
                  className={[
                    'text-sm font-semibold transition-all duration-300',
                    isActive    ? 'text-emerald-600' : '',
                    isCompleted ? 'text-gray-500'    : '',
                    isFuture    ? 'text-gray-300'    : '',
                  ].join(' ')}
                >
                  {label}
                </p>
                {/* Pulsing dot for active step */}
                {isActive && (
                  <span className="mt-0.5 flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
                    <span className="text-xs text-emerald-500">
                      {lang === 'ar' ? 'الآن' : lang === 'fr' ? 'En cours…' : 'In progress…'}
                    </span>
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
