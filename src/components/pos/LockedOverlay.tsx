'use client'

import { Lock } from 'lucide-react'

export default function LockedOverlay({ staffName, plannedEndTime }: { staffName: string; plannedEndTime: string | null }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="w-16 h-16 rounded-full bg-red-950 border border-red-800 flex items-center justify-center mx-auto mb-5">
          <Lock className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-white font-black text-xl mb-2">Poste verrouillé</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          {staffName} a dépassé sa sortie prévue
          {plannedEndTime ? ` (${new Date(plannedEndTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})` : ''} de plus d'1h sans clôturer.
          La caisse est bloquée jusqu'à déverrouillage par un administrateur.
        </p>
      </div>
    </div>
  )
}
