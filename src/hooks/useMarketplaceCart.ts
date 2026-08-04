'use client'

import { useState } from 'react'
import { lineTotal, type MenuItem, type CartItem } from '../lib/posCart'

// Marketplace (Glovo/Uber Eats/...) order-logging cart, shared between /pos and /comptoir.
// Identical behavior in both screens — extracted so a future change only needs to happen once.
export function useMarketplaceCart(
  posToken: string | null,
  pName: (item: { nameEn: string; nameAr: string; nameFr: string }) => string,
  messages: { choosePlatform: string; requestFailed: string; networkError: string },
) {
  const [showMarketplace, setShowMarketplace] = useState(false)
  const [mpPlatform,      setMpPlatform]      = useState('Glovo')
  const [mpPlatformOther, setMpPlatformOther] = useState('')
  const [mpRef,           setMpRef]           = useState('')
  const [mpCart,          setMpCart]          = useState<CartItem[]>([])
  const [mpCat,           setMpCat]           = useState('')
  const [mpSubmitting,    setMpSubmitting]    = useState(false)
  const [mpError,         setMpError]         = useState('')

  function addToMpCart(item: MenuItem) {
    const isWeight = item.unitType === 'WEIGHT'
    setMpCart(prev => {
      const ex = prev.find(c => c.productId === item.id)
      if (ex) return prev.map(c => c.productId === item.id ? { ...c, qty: c.qty + (isWeight ? 50 : 1) } : c)
      return [...prev, { productId: item.id, name: pName(item), price: item.price, qty: isWeight ? 250 : 1, unitType: item.unitType ?? 'PIECE' }]
    })
  }
  function updateMpQty(productId: string, delta: number) {
    setMpCart(prev => prev.map(c => {
      if (c.productId !== productId) return c
      const isWeight = c.unitType === 'WEIGHT'
      const step = isWeight ? 50 * delta : delta
      return { ...c, qty: Math.max(isWeight ? 50 : 1, c.qty + step) }
    }))
  }
  function removeFromMpCart(productId: string) {
    setMpCart(prev => prev.filter(c => c.productId !== productId))
  }
  const mpCartTotal = mpCart.reduce((s, c) => s + lineTotal(c), 0)

  async function submitMarketplaceOrder() {
    if (!posToken || mpCart.length === 0) return
    const platform = mpPlatform === 'Other' ? mpPlatformOther.trim() : mpPlatform
    if (!platform) { setMpError(messages.choosePlatform); return }
    setMpSubmitting(true); setMpError('')
    try {
      const res = await fetch('/api/pos/orders/marketplace', {
        method: 'POST', headers: { Authorization: `Bearer ${posToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: mpCart.map(c => ({ productId: c.productId, quantity: c.qty })),
          platform,
          externalOrderRef: mpRef.trim() || undefined,
        })
      })
      if (!res.ok) { const d = await res.json(); setMpError(d.error ?? messages.requestFailed); return }
      setMpCart([]); setMpRef(''); setShowMarketplace(false)
    } catch { setMpError(messages.networkError) }
    finally { setMpSubmitting(false) }
  }

  return {
    showMarketplace, setShowMarketplace,
    mpPlatform, setMpPlatform, mpPlatformOther, setMpPlatformOther,
    mpRef, setMpRef,
    mpCart, addToMpCart, updateMpQty, removeFromMpCart,
    mpCat, setMpCat,
    mpSubmitting, mpError, mpCartTotal,
    submitMarketplaceOrder,
  }
}
