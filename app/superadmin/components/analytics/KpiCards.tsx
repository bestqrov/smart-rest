import type { Overview, MrrData } from '../types'

interface Props {
  overview: Overview
  mrrData:  MrrData | null
  onOpenMrr: () => void
}

interface Card {
  label:  string
  value:  string | number
  trend?: string
  trendUp?: boolean
  color:  string
  bg:     string
  border: string
  icon:   string
}

export default function KpiCards({ overview, mrrData, onOpenMrr }: Props) {
  const cards: Card[] = [
    {
      label: 'إجمالي المطاعم',
      value: overview.totalCafes,
      color: 'text-blue-400', bg: 'from-blue-950/60 to-gray-900', border: 'border-blue-800/40',
      icon: '🏪',
    },
    {
      label: 'نشطة',
      value: overview.activeCafes,
      trend: `${Math.round((overview.activeCafes / Math.max(overview.totalCafes, 1)) * 100)}%`,
      trendUp: true,
      color: 'text-emerald-400', bg: 'from-emerald-950/60 to-gray-900', border: 'border-emerald-800/40',
      icon: '✅',
    },
    {
      label: 'في التجربة',
      value: overview.trialCafes,
      color: 'text-amber-400', bg: 'from-amber-950/60 to-gray-900', border: 'border-amber-800/40',
      icon: '⏳',
    },
    {
      label: 'موقوفة',
      value: overview.suspendedCafes,
      color: 'text-red-400', bg: 'from-red-950/60 to-gray-900', border: 'border-red-800/40',
      icon: '⛔',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c, i) => (
        <div key={i} className={`bg-gradient-to-br ${c.bg} border ${c.border} rounded-2xl p-4`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xl">{c.icon}</span>
            {c.trend && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${c.trendUp ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'}`}>
                {c.trend}
              </span>
            )}
          </div>
          <div className={`text-3xl font-black ${c.color}`}>{c.value}</div>
          <div className="text-gray-500 text-xs mt-1 font-medium">{c.label}</div>
        </div>
      ))}

      {/* MRR card */}
      <div className="bg-gradient-to-br from-violet-950/60 to-gray-900 border border-violet-800/40 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xl">💎</span>
          <button
            onClick={onOpenMrr}
            className="w-5 h-5 rounded-full bg-violet-900/60 hover:bg-violet-700 flex items-center justify-center text-violet-400 hover:text-white text-[10px] font-black transition-colors"
            title="Breakdown"
          >
            i
          </button>
        </div>
        {mrrData ? (
          <div className="text-3xl font-black text-violet-400">${mrrData.totalMRR_USD.toFixed(0)}</div>
        ) : (
          <div className="text-3xl font-black text-violet-400 animate-pulse">…</div>
        )}
        <div className="text-gray-500 text-xs mt-1 font-medium">MRR / شهر</div>
      </div>
    </div>
  )
}
