'use client'
import type { Overview, MrrData } from '../types'

interface Props {
  overview:  Overview
  mrrData:   MrrData | null
  onOpenMrr: () => void
}

const CARDS = (o: Overview, mrr: MrrData | null) => [
  {
    label:  'Total Restaurants',
    value:  o.totalCafes,
    sub:    'Registered tenants',
    bg:     'bg-blue-500',
    shadow: 'shadow-blue-600/30',
    icon:   '🏪',
  },
  {
    label:  'Active',
    value:  o.activeCafes,
    sub:    `${Math.round((o.activeCafes / Math.max(o.totalCafes, 1)) * 100)}% of total`,
    bg:     'bg-emerald-500',
    shadow: 'shadow-emerald-600/30',
    icon:   '✅',
  },
  {
    label:  'Trial',
    value:  o.trialCafes,
    sub:    'Grace period',
    bg:     'bg-amber-500',
    shadow: 'shadow-amber-600/30',
    icon:   '⏳',
  },
  {
    label:  'Suspended',
    value:  o.suspendedCafes,
    sub:    'Need attention',
    bg:     'bg-red-500',
    shadow: 'shadow-red-600/30',
    icon:   '⛔',
  },
  {
    label:  'MRR',
    value:  mrr ? `$${mrr.totalMRR_USD.toFixed(0)}` : '…',
    sub:    'Monthly revenue',
    bg:     'bg-violet-500',
    shadow: 'shadow-violet-600/30',
    icon:   '💎',
    onClick: undefined as (() => void) | undefined,
  },
]

export default function KpiCards({ overview, mrrData, onOpenMrr }: Props) {
  const cards = CARDS(overview, mrrData)
  cards[4].onClick = onOpenMrr

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c, i) => (
        <div
          key={i}
          className={`${c.bg} ${c.shadow} rounded-2xl shadow-lg overflow-hidden cursor-default`}
          onClick={c.onClick}
        >
          {/* Main body */}
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">{c.label}</p>
              <p className="text-white text-3xl font-black mt-1 leading-none">{c.value}</p>
            </div>
            <div className="text-5xl opacity-30 select-none">{c.icon}</div>
          </div>
          {/* Footer */}
          <div className="bg-black/15 px-5 py-2 flex items-center gap-1">
            <span className="text-white/80 text-xs font-medium">{c.sub}</span>
            {c.onClick && (
              <button onClick={c.onClick} className="ml-auto text-white/60 hover:text-white text-[10px] underline transition-colors">
                Details
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
