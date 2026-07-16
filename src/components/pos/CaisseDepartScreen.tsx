'use client'

import { useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'

interface CaisseDepartScreenProps {
  staffName: string
  onSubmit: (params: { initialCash: number; plannedEndTime: string }) => Promise<void>
}

export default function CaisseDepartScreen({ staffName, onSubmit }: CaisseDepartScreenProps) {
  const [initialCash, setInitialCash] = useState('')
  const [exitTime, setExitTime]       = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const cash = parseFloat(initialCash)
    if (isNaN(cash) || cash < 0) { setError('Montant invalide'); return }
    if (!exitTime) { setError('Heure de sortie prévue requise'); return }

    const [hours, minutes] = exitTime.split(':').map(Number)
    const planned = new Date()
    planned.setHours(hours, minutes, 0, 0)
    if (planned.getTime() < Date.now()) planned.setDate(planned.getDate() + 1)

    setSubmitting(true)
    try {
      await onSubmit({ initialCash: cash, plannedEndTime: planned.toISOString() })
    } catch (err: any) {
      setError(err.message ?? 'Échec de l\'ouverture de caisse')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div className="text-center mb-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white">Caisse de départ</h1>
          <p className="text-gray-500 text-sm mt-1">Bonjour {staffName} — ouvrez votre caisse pour commencer</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Montant de départ</label>
          <input
            type="number" min="0" step="0.5" required autoFocus
            value={initialCash} onChange={e => setInitialCash(e.target.value)}
            placeholder="200"
            className="w-full px-4 py-3.5 bg-gray-900 border border-gray-700 text-white rounded-2xl text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Sortie prévue</label>
          <input
            type="time" required
            value={exitTime} onChange={e => setExitTime(e.target.value)}
            className="w-full px-4 py-3.5 bg-gray-900 border border-gray-700 text-white rounded-2xl text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <button type="submit" disabled={submitting}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-lg rounded-2xl transition-all active:scale-95">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Ouvrir la caisse'}
        </button>
      </form>
    </div>
  )
}
