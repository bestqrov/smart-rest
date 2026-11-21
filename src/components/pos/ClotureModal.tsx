'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { CashierShift } from '../../hooks/useCashierShift'
import { tr, getLang, isRTL, type Lang } from '../../lib/posI18n'

interface ClotureModalProps {
  shift: CashierShift
  currency: string
  onClose: () => void
  onConfirm: (countedCash: number) => Promise<CashierShift>
  lang?: Lang
}

export default function ClotureModal({ shift, currency, onClose, onConfirm, lang: langProp }: ClotureModalProps) {
  const lang = langProp ?? getLang()
  const [countedCash, setCountedCash] = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')
  const [result, setResult]           = useState<{ discrepancy: number } | null>(null)

  const expected = shift.initialCash + shift.totalCollectedCash

  async function handleConfirm() {
    setError('')
    const counted = parseFloat(countedCash)
    if (isNaN(counted) || counted < 0) { setError(tr('invalid_amount', lang)); return }
    setSubmitting(true)
    try {
      const closedShift = await onConfirm(counted)
      setResult({ discrepancy: closedShift.discrepancy ?? (counted - expected) })
    } catch (err: any) {
      console.error('[Cloture] close shift failed:', err?.message)
      setError(tr('cl_failed', lang))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl" dir={isRTL(lang) ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-lg text-white">{tr('cl_title', lang)}</h3>
          <button onClick={onClose} aria-label={tr('close', lang)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {result ? (
          <div className="text-center space-y-3">
            <p className="text-gray-400 text-sm">{tr('cl_discrepancy', lang)}</p>
            <p dir="ltr" className={`text-3xl font-black ${result.discrepancy === 0 ? 'text-emerald-400' : result.discrepancy > 0 ? 'text-sky-400' : 'text-red-400'}`}>
              {result.discrepancy > 0 ? '+' : ''}{result.discrepancy.toFixed(2)} {currency}
            </p>
            <p className="text-gray-500 text-xs">
              {result.discrepancy === 0 ? tr('cl_exact', lang) : result.discrepancy > 0 ? tr('cl_over', lang) : tr('cl_short', lang)}
            </p>
            <button onClick={onClose} className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm">
              {tr('cl_done', lang)}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between text-gray-400"><span>{tr('today_cash_open', lang)}</span><span dir="ltr" className="text-white font-mono">{shift.initialCash.toFixed(2)} {currency}</span></div>
              <div className="flex justify-between text-gray-400"><span>{tr('cl_cash_rev', lang)}</span><span dir="ltr" className="text-white font-mono">{shift.totalCollectedCash.toFixed(2)} {currency}</span></div>
              <div className="flex justify-between font-bold border-t border-gray-800 pt-2"><span className="text-gray-300">{tr('cl_expected', lang)}</span><span dir="ltr" className="text-white font-mono">{expected.toFixed(2)} {currency}</span></div>
            </div>

            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">{tr('cl_counted', lang)}</label>
            <input
              type="number" min="0" step="0.5" autoFocus
              value={countedCash} onChange={e => setCountedCash(e.target.value)}
              placeholder={expected.toFixed(2)}
              className="w-full px-4 py-3 bg-gray-950 border border-gray-700 text-white rounded-xl text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
            />

            {error && <div className="bg-red-950/60 border border-red-800 text-red-400 text-xs rounded-xl px-3 py-2 mb-3">{error}</div>}

            <button onClick={handleConfirm} disabled={submitting}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm active:scale-95">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : tr('cl_confirm', lang)}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
