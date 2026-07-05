'use client'

import type { TimingStatus } from '../../hooks/useCashierShift'

export default function ShiftTimingPill({ timing }: { timing: TimingStatus }) {
  if (timing.state === 'none') return null

  const style =
    timing.state === 'overtime' ? 'bg-red-950 text-red-400 border-red-800 animate-pulse' :
    timing.state === 'warning'  ? 'bg-amber-950 text-amber-400 border-amber-800' :
                                   'bg-gray-800 text-gray-400 border-gray-700'

  return (
    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${style}`}>
      {timing.label}
    </span>
  )
}
