'use client'

import { Bike, X, Loader2, Trash2 } from 'lucide-react'
import type { MenuCat } from '../../lib/posCart'

const TXT = {
  en: {
    title: 'Delivery App Order', platformOther: 'Platform name', orderRef: 'Order # (optional)',
    save: (total: string) => `Log Order — ${total}`, empty: 'Tap products to add them',
  },
  fr: {
    title: "Commande app de livraison", platformOther: 'Nom de la plateforme', orderRef: 'N° commande (optionnel)',
    save: (total: string) => `Enregistrer — ${total}`, empty: "Touchez un produit pour l'ajouter",
  },
} as const

interface Props {
  locale: 'en' | 'fr'
  open: boolean
  onClose: () => void
  menuCats: MenuCat[]
  pName: (item: { nameEn: string; nameAr: string; nameFr: string }) => string
  currency: string
  mpPlatform: string; setMpPlatform: (v: string) => void
  mpPlatformOther: string; setMpPlatformOther: (v: string) => void
  mpRef: string; setMpRef: (v: string) => void
  mpCat: string; setMpCat: (v: string) => void
  mpCart: { productId: string; name: string; qty: number; unitType: string }[]
  addToMpCart: (item: any) => void
  updateMpQty: (productId: string, delta: number) => void
  removeFromMpCart: (productId: string) => void
  mpCartTotal: number
  mpSubmitting: boolean
  mpError: string
  onSubmit: () => void
}

// Marketplace (Glovo/Uber Eats/...) order-logging modal — identical markup
// previously duplicated in app/pos/page.tsx and app/comptoir/page.tsx.
export default function MarketplaceOrderModal(props: Props) {
  const {
    locale, open, onClose, menuCats, pName, currency,
    mpPlatform, setMpPlatform, mpPlatformOther, setMpPlatformOther, mpRef, setMpRef,
    mpCat, setMpCat, mpCart, addToMpCart, updateMpQty, removeFromMpCart,
    mpCartTotal, mpSubmitting, mpError, onSubmit,
  } = props
  if (!open) return null
  const t = TXT[locale]

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <h3 className="font-black text-lg text-white flex items-center gap-2"><Bike className="w-5 h-5 text-amber-500" /> {t.title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3 border-b border-gray-800 shrink-0">
          <div className="flex flex-wrap gap-2">
            {['Glovo', 'Uber Eats', 'Jumia Food', 'Other'].map(p => (
              <button key={p} onClick={() => setMpPlatform(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${mpPlatform === p ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {mpPlatform === 'Other' && (
              <input type="text" value={mpPlatformOther} onChange={e => setMpPlatformOther(e.target.value)}
                placeholder={t.platformOther} className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500" />
            )}
            <input type="text" value={mpRef} onChange={e => setMpRef(e.target.value)}
              placeholder={t.orderRef} className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-1/2 border-r border-gray-800 overflow-y-auto p-3">
            <div className="flex gap-1.5 overflow-x-auto mb-2 pb-1">
              {menuCats.map(cat => (
                <button key={cat.id} onClick={() => setMpCat(cat.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${mpCat === cat.id ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {pName(cat)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(menuCats.find(c => c.id === mpCat)?.products ?? []).map(item => (
                <button key={item.id} onClick={() => addToMpCart(item)}
                  className="bg-gray-800 hover:bg-gray-700 rounded-xl p-2 text-left transition-colors">
                  <p className="text-white text-xs font-bold truncate">{pName(item)}</p>
                  <p className="text-amber-400 text-xs font-bold">{item.price.toFixed(2)} {currency}{item.unitType === 'WEIGHT' ? '/kg' : ''}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="w-1/2 overflow-y-auto p-3 space-y-2">
            {mpCart.map(item => (
              <div key={item.productId} className="flex items-center gap-2 bg-gray-800 rounded-xl px-2.5 py-1.5">
                <button onClick={() => updateMpQty(item.productId, -1)} className="w-7 h-7 rounded-lg bg-gray-700 text-gray-300 font-bold shrink-0">−</button>
                <span className="w-10 text-center text-white text-xs font-bold shrink-0">{item.unitType === 'WEIGHT' ? `${item.qty}g` : item.qty}</span>
                <button onClick={() => updateMpQty(item.productId, 1)} className="w-7 h-7 rounded-lg bg-amber-900/70 text-amber-400 font-bold shrink-0">+</button>
                <span className="flex-1 text-white text-xs font-semibold truncate">{item.name}</span>
                <button onClick={() => removeFromMpCart(item.productId)} className="text-gray-500 hover:text-red-400 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {mpCart.length === 0 && <p className="text-gray-600 text-xs text-center py-8">{t.empty}</p>}
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 shrink-0 space-y-2">
          {mpError && <p className="text-red-400 text-xs font-semibold">{mpError}</p>}
          <button onClick={onSubmit} disabled={mpSubmitting || mpCart.length === 0}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2">
            {mpSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t.save(`${mpCartTotal.toFixed(2)} ${currency}`)}
          </button>
        </div>
      </div>
    </div>
  )
}
