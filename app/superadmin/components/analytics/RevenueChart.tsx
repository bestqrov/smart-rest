interface Props {
  data: { month: string; value: number }[]
}

export default function RevenueChart({ data }: Props) {
  const max = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-sm">الإيراد الشهري</h3>
          <p className="text-gray-500 text-xs mt-0.5">آخر 6 أشهر (MAD)</p>
        </div>
        <span className="text-xs text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
          {data[data.length - 1]?.value.toFixed(0) ?? '—'} هذا الشهر
        </span>
      </div>

      {data.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-gray-600 text-sm">لا توجد بيانات</div>
      ) : (
        <div className="flex items-end gap-2 h-24">
          {data.map((d, i) => {
            const isLast   = i === data.length - 1
            const heightPct = Math.max((d.value / max) * 100, 4)
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-1 group relative">
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {d.value.toFixed(2)}
                </div>
                <div
                  className={`w-full rounded-t-lg transition-all ${isLast ? 'bg-emerald-500' : 'bg-emerald-800/50 group-hover:bg-emerald-700/70'}`}
                  style={{ height: `${heightPct}%` }}
                />
                <span className={`text-[9px] font-medium ${isLast ? 'text-emerald-400' : 'text-gray-600'}`}>
                  {d.month}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
