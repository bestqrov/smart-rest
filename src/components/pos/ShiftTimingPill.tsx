'use client'

import type { TimingStatus } from '../../hooks/useCashierShift'
import { trf, fmtDuration, getLang, type Lang } from '../../lib/posI18n'

export default function ShiftTimingPill({ timing, plannedEndTime, lang: langProp }: { timing: TimingStatus; plannedEndTime?: string | null; lang?: Lang }) {
  if (timing.state === 'none') return null
  const lang = langProp ?? getLang()
  // timing.label from the hook is French-only; rebuild it in the selected language.
  const diff = plannedEndTime ? new Date(plannedEndTime).getTime() - Date.now() : null
  const label = diff === null
    ? timing.label
    : timing.state === 'overtime'
      ? trf('tm_over', lang, { d: fmtDuration(diff, lang) })
      : trf('tm_left', lang, { d: fmtDuration(diff, lang) })

  const style =
    timing.state === 'overtime' ? 'bg-red-950 text-red-400 border-red-800 animate-pulse' :
    timing.state === 'warning'  ? 'bg-amber-950 text-amber-400 border-amber-800' :
                                   'bg-gray-800 text-gray-400 border-gray-700'

  return (
    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${style}`}>
      {label}
    </span>
  )
}
