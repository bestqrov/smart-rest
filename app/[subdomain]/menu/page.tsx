"use client"

import React, { useMemo, useRef, useState } from 'react'
import ErrorBoundary from '../../../src/components/ErrorBoundary'
import NProgressProvider from '../../../src/components/NProgressProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, ShoppingCart, X, Plus, Minus } from 'lucide-react'
import ReviewPrompt from './ReviewPrompt'

// Config (colors to be fetched from API later)
const theme = {
  primary: 'bg-emerald-600',
  primaryText: 'text-white',
  secondary: 'bg-amber-500'
}

type Product = {
  id: number
  name: string
  description?: string
  price: number
  imageUrl?: string
}

type Category = { id: string; name: string; products: Product[] }

// Mock data — replace with real fetch in production
const mockCategories: Category[] = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    products: [
      { id: 1, name: 'Croissant', description: 'Buttery flakey pastry', price: 12, imageUrl: '/images/croissant.jpg' },
      { id: 2, name: 'Pancakes', description: 'Stack with syrup', price: 30, imageUrl: '/images/pancakes.jpg' }
    ]
  },
  {
    id: 'cold-drinks',
    name: 'Cold Drinks',
    products: [
      { id: 3, name: 'Fresh Orange Juice', description: 'Squeezed daily', price: 25, imageUrl: '/images/orange.jpg' },
      { id: 4, name: 'Iced Latte', description: 'Chilled espresso milk', price: 35, imageUrl: '/images/latte.jpg' }
    ]
  },
  {
    id: 'traditional',
    name: 'Traditional Moroccan',
    products: [
      { id: 5, name: 'Tajine Kefta', description: 'Slow cooked kefta', price: 85, imageUrl: '/images/tajine.jpg' },
      { id: 6, name: 'Moroccan Tea', description: 'Mint tea', price: 20, imageUrl: '/images/tea.jpg' }
    ]
  }
]

export default function MenuPage({ params }: { params: { subdomain: string } }) {
  const categories = useMemo(() => mockCategories, [])
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [cart, setCart] = useState<Record<number, { product: Product; qty: number }>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)

  const cafe = { id: 1, name: "Café de la Plage", logoUrl: '/images/logo.png', socialLinks: { instagram: 'https://www.instagram.com/cafedelaplage', googleMaps: 'https://maps.google.com/?q=Caf%C3%A9+de+la+Plage+Agadir', tripadvisor: 'https://www.tripadvisor.com/Cafe_de_la_Plague' } }
  const [orderSent, setOrderSent] = useState(false)

  function scrollToCategory(id: string) {
    const el = sectionRefs.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function addToCart(product: Product) {
    import useTranslation from '../../../src/hooks/useTranslation'
    import LanguageSwitcher from './LanguageSwitcher'
    setCart((c) => {
      const existing = c[product.id]
      const { lang, tCategory, tProduct } = useTranslation()
      const categories = useMemo(() => mockCategories, [])
    })
    // quick animation could be added here
  }

  function changeQty(productId: number, delta: number) {
        <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-50 text-gray-900">
      const item = c[productId]
      if (!item) return c
      const newQty = item.qty + delta
      if (newQty <= 0) {
        const next = { ...c }
        delete next[productId]
        return next
      }
      return { ...c, [productId]: { ...item, qty: newQty } }
              <div className="flex items-center gap-3">
                <LanguageSwitcher />
                <button className={`${theme.primary} ${theme.primaryText} px-3 py-2 rounded flex items-center gap-2`}>
                  <Phone className="w-4 h-4" /> Call Waiter
                </button>
              </div>
  const totalPrice = itemsArray.reduce((s, it) => s + it.qty * it.product.price, 0)

  return (
    <ErrorBoundary>
      <NProgressProvider />
      <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={cafe.logoUrl} alt="logo" className="w-10 h-10 rounded" />
            <div>
              <div className="font-bold">{cafe.name}</div>
              <div className="text-xs text-gray-500">{params.subdomain}.smartmenu.ma</div>
            </div>
          </div>
                    {tCategory(c)}
            <button className={`${theme.primary} ${theme.primaryText} px-3 py-2 rounded flex items-center gap-2`}>
              <Phone className="w-4 h-4" /> Call Waiter
            </button>
          </div>
        </div>
      </header>

      {/* Category Tabs */}
      <div className="sticky top-16 z-20 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-2 overflow-x-auto">
          <div className="flex gap-3">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => scrollToCategory(c.id)}
                className="whitespace-nowrap px-3 py-2 rounded-full bg-white shadow-sm text-sm"
              >
                        <h4 className="font-medium">{tProduct(p)}</h4>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {categories.map((cat) => (
          <section key={cat.id} ref={(el) => (sectionRefs.current[cat.id] = el)}>
            <h3 className="text-xl font-semibold mb-4">{cat.name}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
              {cat.products.map((p) => (
                <article key={p.id} className="bg-white rounded-lg shadow p-3 flex flex-col">
                  <div className="h-36 bg-gray-100 rounded overflow-hidden mb-3">
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{p.name}</h4>
                    <p className="text-sm text-gray-500 line-clamp-2">{p.description}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-lg font-semibold">{p.price} MAD</div>
                    <button
                      onClick={() => addToCart(p)}
                      className={`${theme.primary} ${theme.primaryText} px-3 py-1 rounded flex items-center gap-2`}
                    >
                      Add
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Floating Cart Button */}
      <div className="fixed bottom-4 left-0 right-0 flex justify-center pointer-events-none">
        <AnimatePresence>
          <motion.button
            key="cart"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            onClick={() => setDrawerOpen(true)}
            className={`${theme.primary} ${theme.primaryText} pointer-events-auto py-3 px-4 rounded-full shadow-lg flex items-center gap-3`}
          >
            <ShoppingCart className="w-5 h-5" />
            <div className="text-sm">{totalQty} • {totalPrice} MAD</div>
          </motion.button>
        </AnimatePresence>
      </div>

      {/* Cart Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-xl z-40"
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="font-semibold">Your Cart</h4>
              <button onClick={() => setDrawerOpen(false)} className="p-2 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto h-full">
              {itemsArray.length === 0 && <div className="text-gray-500">Your cart is empty</div>}
              {itemsArray.map((it) => (
                <div key={it.product.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{it.product.name}</div>
                    <div className="text-sm text-gray-500">{it.product.price} MAD</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(it.product.id, -1)} className="p-2 rounded bg-gray-100">
                      <Minus className="w-4 h-4" />
                    </button>
                    <div>{it.qty}</div>
                    <button onClick={() => changeQty(it.product.id, 1)} className="p-2 rounded bg-gray-100">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">Total</div>
                <div className="font-semibold">{totalPrice} MAD</div>
              </div>
              <button className={`${theme.secondary} text-white w-full py-3 rounded`} onClick={() => {
                // TODO: call /api/orders; here we simulate success
                setOrderSent(true)
                setCart({})
              }}>
                Send Order
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      {/* Review Prompt shown after successful order */}
      <AnimatePresence>
        {orderSent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md p-4">
              <ReviewPrompt cafeName={cafe.name} socialLinks={cafe.socialLinks} onClose={() => setOrderSent(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </ErrorBoundary>
  )
}
