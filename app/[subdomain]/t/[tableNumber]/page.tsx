'use client'

/**
 * Dynamic QR Table Page — Single QR per table, seats assigned automatically.
 *
 * URL:  /{subdomain}/t/{tableNumber}?token={tableQrToken}
 * Flow: scan → POST /api/qr/scan → get sessionId + seatNumber
 *       → show full menu using sessionId for all orders
 *       → heartbeat every 5 min to keep session alive
 */

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useSearchParams } from 'next/navigation'
import { io as socketIO, Socket } from 'socket.io-client'
import LiveOrderTracker from './LiveOrderTracker'

type Lang = 'ar' | 'en' | 'fr' | 'es'

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  en: {
    scanningTitle: 'Setting up your table…',
    scanningSeats: (n: number, cap: number) => `${n} of ${cap} seats occupied`,
    welcome: (seat: number) => `You're Seat ${seat}`,
    welcomeSub: 'Your seat has been reserved. Browse the menu below!',
    tableFull: 'Table is fully occupied',
    tableFullSub: 'Please ask a staff member for assistance.',
    sessionExpired: 'Your session has expired',
    sessionExpiredSub: 'Please scan the QR code again to continue.',
    scanAgain: 'Scan QR Again',
    menu: 'Menu', table: 'Table', seat: 'Seat', search: 'Search menu…',
    pending: 'Order received', preparing: 'Being prepared…', delivered: 'Ready! 🎉',
    trackerTitle: 'Your Order',
    bonAppetit: 'Bon Appétit! 🍽️',
    bonSub: 'Enjoy your meal. Thank you!',
    noItems: 'No items found',
    viewCart: 'View Cart',
    total: 'Total',
    confirmOrder: 'Confirm Order',
    placing: 'Placing Order…',
    added: 'added',
    orderPlaced: "🎉 Order placed! We're on it.",
    failedOrder: 'Failed to place order',
    placeOrder: 'Place Order 🎉',
    waiterTitle: 'How can we help?',
    callWaiter: 'Call Waiter 🔔',
    payCash: 'Pay in Cash 💵',
    payCard: 'Pay by Card / TPE 💳',
    water: 'Extra Ice / Water 🧊',
    question: 'I have a question ❓',
    clean: 'Table needs cleaning 🧹',
    waiterCalled: '✅ Waiter on the way!',
    mergedWith: 'Merged with',
    invalidTitle: 'Invalid QR Code',
    invalidSub: 'This QR code is invalid or has expired. Please scan the code on your table again.',
    orderMore: 'Order more items',
    requestBill: 'Request Bill 🧾',
    billMyself: 'Just me',
    billMyselfSub: 'Pay only for my seat',
    billTable: 'Whole table',
    billTableSub: 'Everyone pays together',
    billGroup: 'Choose seats',
    billGroupSub: 'Select who pays',
    billSeatPicker: 'Select seats to include',
    billConfirm: 'Send Bill Request',
    billRequested: '✅ Bill request sent!',
    billModalTitle: 'How would you like to pay?',
  },
  ar: {
    scanningTitle: 'جارٍ تجهيز طاولتك…',
    scanningSeats: (n: number, cap: number) => `${n} من ${cap} مقاعد مشغولة`,
    welcome: (seat: number) => `أنت في المقعد ${seat}`,
    welcomeSub: 'تم حجز مقعدك. تصفح القائمة أدناه!',
    tableFull: 'الطاولة ممتلئة',
    tableFullSub: 'يرجى التواصل مع أحد الموظفين.',
    sessionExpired: 'انتهت جلستك',
    sessionExpiredSub: 'يرجى مسح رمز QR مرة أخرى للمتابعة.',
    scanAgain: 'مسح QR مجدداً',
    menu: 'القائمة', table: 'طاولة', seat: 'مقعد', search: 'ابحث في القائمة…',
    pending: 'تم استلام الطلب', preparing: 'جارٍ التحضير…', delivered: 'جاهز! 🎉',
    trackerTitle: 'طلبك',
    bonAppetit: 'بالهناء والشفاء! 🍽️',
    bonSub: 'استمتع بوجبتك. شكراً!',
    noItems: 'لا توجد عناصر',
    viewCart: 'عرض السلة',
    total: 'المجموع',
    confirmOrder: 'تأكيد الطلب',
    placing: 'جارٍ الطلب…',
    added: 'أُضيف',
    orderPlaced: '🎉 تم الطلب! نحن على ذلك.',
    failedOrder: 'فشل في تقديم الطلب',
    placeOrder: 'اطلب الآن 🎉',
    waiterTitle: 'كيف يمكننا مساعدتك؟',
    callWaiter: 'استدعاء النادل 🔔',
    payCash: 'الدفع نقداً 💵',
    payCard: 'الدفع بالبطاقة 💳',
    water: 'ماء / ثلج إضافي 🧊',
    question: 'لدي سؤال ❓',
    clean: 'تنظيف الطاولة 🧹',
    waiterCalled: '✅ النادل في الطريق!',
    mergedWith: 'مدمجة مع',
    invalidTitle: 'رمز QR غير صالح',
    invalidSub: 'رمز QR غير صالح أو منتهي الصلاحية. يرجى المسح مرة أخرى.',
    orderMore: 'طلب المزيد',
    requestBill: 'طلب الفاتورة 🧾',
    billMyself: 'على راسي فقط',
    billMyselfSub: 'أدفع فقط لمقعدي',
    billTable: 'الطاولة كلها',
    billTableSub: 'الجميع يدفع معاً',
    billGroup: 'اختيار مقاعد',
    billGroupSub: 'حدد من يدفع',
    billSeatPicker: 'اختر المقاعد المشمولة',
    billConfirm: 'إرسال طلب الفاتورة',
    billRequested: '✅ تم إرسال طلب الفاتورة!',
    billModalTitle: 'كيف تريد الدفع؟',
  },
  fr: {
    scanningTitle: 'Préparation de votre table…',
    scanningSeats: (n: number, cap: number) => `${n} sur ${cap} places occupées`,
    welcome: (seat: number) => `Vous êtes à la place ${seat}`,
    welcomeSub: 'Votre place est réservée. Parcourez le menu ci-dessous !',
    tableFull: 'Table complète',
    tableFullSub: 'Veuillez contacter un membre du personnel.',
    sessionExpired: 'Votre session a expiré',
    sessionExpiredSub: 'Veuillez scanner à nouveau le QR code pour continuer.',
    scanAgain: 'Scanner à nouveau',
    menu: 'Menu', table: 'Table', seat: 'Place', search: 'Rechercher…',
    pending: 'Commande reçue', preparing: 'En préparation…', delivered: 'Prêt ! 🎉',
    trackerTitle: 'Votre commande',
    bonAppetit: 'Bon Appétit ! 🍽️',
    bonSub: 'Profitez de votre repas. Merci !',
    noItems: 'Aucun article trouvé',
    viewCart: 'Voir le panier',
    total: 'Total',
    confirmOrder: 'Confirmer',
    placing: 'Commande en cours…',
    added: 'ajouté',
    orderPlaced: '🎉 Commande passée !',
    failedOrder: 'Échec de la commande',
    placeOrder: 'Commander 🎉',
    waiterTitle: 'Comment pouvons-nous vous aider ?',
    callWaiter: 'Appeler le serveur 🔔',
    payCash: 'Payer en espèces 💵',
    payCard: 'Payer par carte 💳',
    water: 'Eau / Glace supplémentaire 🧊',
    question: "J'ai une question ❓",
    clean: 'Nettoyer la table 🧹',
    waiterCalled: '✅ Serveur en route !',
    mergedWith: 'Fusionnée avec',
    invalidTitle: 'QR Code invalide',
    invalidSub: 'Ce QR code est invalide ou expiré. Veuillez rescanner.',
    orderMore: "Commander d'autres articles",
    requestBill: "Demander l'addition 🧾",
    billMyself: 'Rien que moi',
    billMyselfSub: 'Payer uniquement ma place',
    billTable: 'Toute la table',
    billTableSub: 'Tout le monde paie ensemble',
    billGroup: 'Choisir les places',
    billGroupSub: 'Sélectionner qui paie',
    billSeatPicker: 'Sélectionner les places',
    billConfirm: 'Envoyer la demande',
    billRequested: '✅ Demande envoyée !',
    billModalTitle: 'Comment souhaitez-vous payer ?',
  },
  es: {
    scanningTitle: 'Preparando tu mesa…',
    scanningSeats: (n: number, cap: number) => `${n} de ${cap} asientos ocupados`,
    welcome: (seat: number) => `Eres el asiento ${seat}`,
    welcomeSub: 'Tu asiento está reservado. ¡Explora el menú!',
    tableFull: 'Mesa llena',
    tableFullSub: 'Por favor, contacta a un miembro del personal.',
    sessionExpired: 'Tu sesión ha expirado',
    sessionExpiredSub: 'Escanea el código QR de nuevo para continuar.',
    scanAgain: 'Escanear de nuevo',
    menu: 'Menú', table: 'Mesa', seat: 'Asiento', search: 'Buscar…',
    pending: 'Pedido recibido', preparing: 'Preparando…', delivered: '¡Listo! 🎉',
    trackerTitle: 'Tu pedido',
    bonAppetit: '¡Buen Provecho! 🍽️',
    bonSub: 'Disfruta tu comida. ¡Gracias!',
    noItems: 'Sin resultados',
    viewCart: 'Ver carrito',
    total: 'Total',
    confirmOrder: 'Confirmar',
    placing: 'Realizando pedido…',
    added: 'añadido',
    orderPlaced: '🎉 ¡Pedido realizado!',
    failedOrder: 'Error al realizar el pedido',
    placeOrder: 'Pedir 🎉',
    waiterTitle: '¿Cómo podemos ayudarte?',
    callWaiter: 'Llamar al camarero 🔔',
    payCash: 'Pagar en efectivo 💵',
    payCard: 'Pagar con tarjeta 💳',
    water: 'Agua / Hielo extra 🧊',
    question: 'Tengo una pregunta ❓',
    clean: 'Limpiar la mesa 🧹',
    waiterCalled: '✅ ¡Camarero en camino!',
    mergedWith: 'Fusionada con',
    invalidTitle: 'QR Code inválido',
    invalidSub: 'El QR code es inválido o expirado. Vuelve a escanear.',
    orderMore: 'Pedir más',
    requestBill: 'Pedir la cuenta 🧾',
    billMyself: 'Solo yo',
    billMyselfSub: 'Pagar solo mi asiento',
    billTable: 'Toda la mesa',
    billTableSub: 'Todos pagan juntos',
    billGroup: 'Elegir asientos',
    billGroupSub: 'Seleccionar quién paga',
    billSeatPicker: 'Seleccionar asientos',
    billConfirm: 'Enviar solicitud',
    billRequested: '✅ ¡Solicitud enviada!',
    billModalTitle: '¿Cómo quieres pagar?',
  },
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanResult = {
  sessionId:          string
  seatNumber:         number
  tableId:            string
  tableNumber:        number
  cafeId:             string
  subdomain:          string
  capacity:           number
  occupiedCount:      number
  isNew:              boolean
  isMerged:           boolean
  billingTableId:     string
  billingTableNumber: number
  cafeName?:          string
  cafeLogoUrl?:       string | null
}

type CartItem = { productId: string; name: string; price: number; quantity: number; notes: string }
type OrderItem = { productId: string; name: string; quantity: number; status: string }
type ActiveOrder = { orderId: string; items: OrderItem[]; status: string; totalPrice: number }

type Product = {
  id: string; nameAr: string; nameEn: string; nameFr: string; nameEs: string
  description: string | null; price: number; imageUrl: string | null
  isAvailable: boolean; calories: number | null; likesCount: number
}
type Category = { id: string; nameAr: string; nameEn: string; nameFr: string; nameEs: string; products: Product[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateDeviceId(): string {
  const key = 'sm_device_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(key, id)
  }
  return id
}

function sessionStorageKey(tableId: string) {
  return `sm_session_${tableId}`
}

function saveSession(tableId: string, data: ScanResult) {
  localStorage.setItem(sessionStorageKey(tableId), JSON.stringify(data))
}

function loadSession(tableId: string): ScanResult | null {
  try {
    const raw = localStorage.getItem(sessionStorageKey(tableId))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function clearSession(tableId: string) {
  localStorage.removeItem(sessionStorageKey(tableId))
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

// ─── Scan Gateway Component ───────────────────────────────────────────────────

function TablePageInner() {
  const params       = useParams()
  const searchParams = useSearchParams()

  const subdomain   = params.subdomain as string
  const tableNumber = params.tableNumber as string
  const tableToken  = searchParams.get('token') ?? ''

  const [lang, setLang]           = useState<Lang>('en')
  const [phase, setPhase]         = useState<'scanning' | 'welcome' | 'menu' | 'full' | 'expired' | 'invalid'>('scanning')
  const [scan, setScan]           = useState<ScanResult | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [cart, setCart]           = useState<CartItem[]>([])
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null)
  const [search, setSearch]       = useState('')
  const [cartOpen, setCartOpen]   = useState(false)
  const [waiterOpen, setWaiterOpen] = useState(false)
  const [placing, setPlacing]     = useState(false)
  const [orderMsg, setOrderMsg]   = useState('')
  const [waiterMsg, setWaiterMsg] = useState('')
  const [billOpen, setBillOpen]   = useState(false)
  const [billPhase, setBillPhase] = useState<'choice' | 'pick'>('choice')
  const [billSeats, setBillSeats] = useState<number[]>([])
  const [billMsg, setBillMsg]     = useState('')
  const [billSending, setBillSending] = useState(false)

  const socketRef    = useRef<Socket | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tr    = T[lang]
  const isRTL = lang === 'ar'

  // ── Language detection ────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('sm_lang')
    if (saved && saved in T) setLang(saved as Lang)
    else {
      const nav = navigator.language.slice(0, 2)
      if (nav === 'ar') setLang('ar')
      else if (nav === 'fr') setLang('fr')
      else if (nav === 'es') setLang('es')
    }
  }, [])

  // ── Seat assignment on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!tableToken) { setPhase('invalid'); return }

    async function initSession() {
      const deviceId = getOrCreateDeviceId()

      // First: try to resume from localStorage (avoids re-scan on page refresh)
      // We don't know the tableId yet (only tableToken), so we'll validate via API
      // Check if we have any session in localStorage for any table and validate it
      const keys = Object.keys(localStorage).filter(k => k.startsWith('sm_session_'))
      for (const key of keys) {
        try {
          const cached: ScanResult = JSON.parse(localStorage.getItem(key) || '')
          if (!cached?.sessionId) continue
          const r = await fetch(`/api/qr/table-session/${cached.sessionId}`)
          if (r.ok) {
            const fresh = await r.json()
            // Confirm this session is for the correct table (by tableNumber)
            if (String(fresh.tableNumber) === tableNumber) {
              const merged = { ...cached, ...fresh }
              setScan(merged)
              saveSession(cached.tableId, merged)
              await loadMenu()
              setPhase('menu')
              startHeartbeat(cached.sessionId)
              return
            }
          }
        } catch {}
      }

      // Fresh scan
      try {
        const r = await fetch('/api/qr/scan', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ tableToken, deviceId }),
        })
        const data = await r.json()

        if (r.status === 409) { setPhase('full'); return }
        if (!r.ok)            { setPhase('invalid'); return }

        setScan(data)
        saveSession(data.tableId, data)
        await loadMenu()
        setPhase('welcome')
        startHeartbeat(data.sessionId)

        // Auto-advance to menu after 2.5s
        setTimeout(() => setPhase('menu'), 2500)
      } catch {
        setPhase('invalid')
      }
    }

    initSession()
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableToken])

  async function loadMenu() {
    try {
      const r = await fetch(`/api/menu/public?tableToken=${encodeURIComponent(tableToken)}`)
      if (r.ok) {
        const data = await r.json()
        setCategories(data.categories || [])
      }
    } catch {}
  }

  function startHeartbeat(sessionId: string) {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    heartbeatRef.current = setInterval(async () => {
      const r = await fetch(`/api/qr/session/${sessionId}/heartbeat`, { method: 'PATCH' })
      if (r.status === 401) {
        setPhase('expired')
        clearInterval(heartbeatRef.current!)
        if (scan) clearSession(scan.tableId)
      }
    }, 5 * 60 * 1000) // every 5 min
  }

  // ── Socket: listen for order status updates ───────────────────────────────
  useEffect(() => {
    if (!scan?.cafeId) return
    const socket = socketIO(SOCKET_URL || window.location.origin, {
      transports: ['polling', 'websocket'],
      reconnection: true,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      // Use session-based room join — the correct event for dynamic QR customers
      socket.emit('join_session_room', { sessionId: scan.sessionId })
    })

    socket.on('TABLES_MERGED', (p: any) => {
      setScan(prev => prev
        ? { ...prev, isMerged: true, billingTableId: p.targetTableId, billingTableNumber: p.targetTableNumber }
        : prev
      )
    })
    socket.on('TABLES_UNMERGED', () => {
      setScan(prev => prev ? { ...prev, isMerged: false } : prev)
    })
    socket.on('your_order_updated', (p: { orderId: string; status: string }) => {
      setActiveOrder(prev => prev && prev.orderId === p.orderId ? { ...prev, status: p.status } : prev)
    })
    socket.on('order_status_update', (p: { orderId: string; status: string }) => {
      setActiveOrder(prev => prev && prev.orderId === p.orderId ? { ...prev, status: p.status } : prev)
    })

    return () => { socket.disconnect() }
  }, [scan?.cafeId, scan?.tableId])

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const addToCart = useCallback((product: Product) => {
    const name = lang === 'ar' ? product.nameAr : lang === 'fr' ? product.nameFr : product.nameEn
    setCart(prev => {
      const ex = prev.find(c => c.productId === product.id)
      if (ex) return prev.map(c => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { productId: product.id, name, price: product.price, quantity: 1, notes: '' }]
    })
  }, [lang])

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => {
      const ex = prev.find(c => c.productId === productId)
      if (!ex) return prev
      if (ex.quantity === 1) return prev.filter(c => c.productId !== productId)
      return prev.map(c => c.productId === productId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }, [])

  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  // ── Place order ───────────────────────────────────────────────────────────
  async function placeOrder() {
    if (!scan || cart.length === 0 || placing) return
    setPlacing(true)
    try {
      const r = await fetch('/api/orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: scan.sessionId,
          items: cart.map(c => ({ productId: c.productId, quantity: c.quantity, notes: c.notes || undefined })),
        }),
      })
      const data = await r.json()

      if (r.status === 401 && data.code === 'SESSION_EXPIRED') {
        setPhase('expired')
        if (scan) clearSession(scan.tableId)
        return
      }
      if (!r.ok) { setOrderMsg(tr.failedOrder); return }

      setActiveOrder({ orderId: data.orderId, status: 'PENDING', items: cart.map(c => ({ productId: c.productId, name: c.name, quantity: c.quantity, status: 'PENDING' })), totalPrice: cartTotal })
      setCart([])
      setCartOpen(false)
      setOrderMsg(tr.orderPlaced)
      setTimeout(() => setOrderMsg(''), 4000)
    } catch {
      setOrderMsg(tr.failedOrder)
    } finally {
      setPlacing(false)
    }
  }

  // ── Waiter call ───────────────────────────────────────────────────────────
  async function callWaiter(type: 'call_waiter' | 'pay_cash' | 'pay_tpe' | 'water' | 'clean' | 'question') {
    if (!scan) return
    setWaiterMsg(tr.waiterCalled)
    setTimeout(() => setWaiterMsg(''), 3000)
    try {
      await fetch('/api/waiter-calls', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: scan.tableId, cafeId: scan.cafeId, type }),
      })
    } catch {}
  }

  // ── Request bill (split or full table) ───────────────────────────────────
  async function requestBill(scope: 'TABLE' | 'SEATS', seats: number[] = []) {
    if (!scan || billSending) return
    setBillSending(true)
    try {
      await fetch('/api/bill-requests', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId:   scan.sessionId,
          seatNumbers: scope === 'SEATS' ? seats : [],
          payScope:    scope,
        }),
      })
      setBillMsg(tr.billRequested)
      setBillOpen(false)
      setBillPhase('choice')
      setBillSeats([])
      setTimeout(() => setBillMsg(''), 5000)
    } catch {
      setBillMsg('Failed to send request')
      setTimeout(() => setBillMsg(''), 3000)
    } finally {
      setBillSending(false)
    }
  }

  function openBillModal() {
    if (!scan) return
    setBillPhase('choice')
    setBillSeats([scan.seatNumber])
    setBillOpen(true)
  }

  function toggleBillSeat(seat: number) {
    setBillSeats(prev =>
      prev.includes(seat) ? prev.filter(s => s !== seat) : [...prev, seat]
    )
  }

  // ── Filtered menu ─────────────────────────────────────────────────────────
  const filteredCategories = search
    ? categories.map(c => ({
        ...c,
        products: c.products.filter(p => {
          const q = search.toLowerCase()
          return p.nameAr.toLowerCase().includes(q) || p.nameEn.toLowerCase().includes(q) || p.nameFr.toLowerCase().includes(q)
        })
      })).filter(c => c.products.length > 0)
    : categories

  // ─── Render ───────────────────────────────────────────────────────────────

  // Scanning / loading
  if (phase === 'scanning') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-gray-300 font-semibold">{tr.scanningTitle}</p>
      </div>
    )
  }

  // Table full
  if (phase === 'full') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl">🪑</div>
        <h2 className="text-xl font-bold text-white">{tr.tableFull}</h2>
        <p className="text-gray-400 text-sm max-w-xs">{tr.tableFullSub}</p>
      </div>
    )
  }

  // Session expired
  if (phase === 'expired') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl">⏰</div>
        <h2 className="text-xl font-bold text-white">{tr.sessionExpired}</h2>
        <p className="text-gray-400 text-sm max-w-xs mb-2">{tr.sessionExpiredSub}</p>
      </div>
    )
  }

  // Invalid QR
  if (phase === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl">❌</div>
        <h2 className="text-xl font-bold text-white">{tr.invalidTitle}</h2>
        <p className="text-gray-400 text-sm max-w-xs">{tr.invalidSub}</p>
      </div>
    )
  }

  // Welcome splash
  if (phase === 'welcome' && scan) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-5 p-6 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="flex flex-col items-center gap-2"
        >
          {scan.cafeLogoUrl
            ? <img src={scan.cafeLogoUrl} alt={scan.cafeName} className="w-24 h-24 rounded-3xl object-contain bg-white/5 border border-white/10 shadow-xl" />
            : <div className="w-24 h-24 rounded-3xl bg-emerald-500/20 flex items-center justify-center text-5xl">🪑</div>
          }
          {scan.cafeName && <span className="text-lg font-black text-white">{scan.cafeName}</span>}
          <span className="text-[10px] text-gray-600 font-medium">Powered by SmartMenu</span>
        </motion.div>

        <div>
          <h1 className="text-3xl font-black text-white">{tr.welcome(scan.seatNumber)}</h1>
          <p className="text-gray-400 text-sm mt-2 max-w-xs">{tr.welcomeSub}</p>
        </div>

        {/* Seat occupancy visual */}
        <div className="flex gap-2 mt-2">
          {Array.from({ length: scan.capacity }, (_, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
                ${i + 1 === scan.seatNumber
                  ? 'bg-emerald-500 text-white ring-2 ring-emerald-300'
                  : i + 1 <= scan.occupiedCount
                    ? 'bg-gray-600 text-gray-300'
                    : 'bg-gray-800 text-gray-600'
                }`}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600">{tr.scanningSeats(scan.occupiedCount, scan.capacity)}</p>

        <div className="w-8 h-1 rounded-full bg-emerald-500 animate-pulse mt-2" />
      </motion.div>
    )
  }

  // ── Main menu ─────────────────────────────────────────────────────────────
  if (!scan) return null

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {scan.cafeLogoUrl && (
            <img src={scan.cafeLogoUrl} alt={scan.cafeName} className="w-7 h-7 rounded-lg object-contain bg-white/5 border border-white/10" />
          )}
          <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full">
            {tr.table} {scan.isMerged ? scan.billingTableNumber : scan.tableNumber}
            {scan.isMerged && <span className="ml-1 text-amber-400">({tr.mergedWith} {scan.billingTableNumber})</span>}
          </span>
          <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-full font-bold">
            {tr.seat} {scan.seatNumber}
          </span>
        </div>

        {/* Lang selector */}
        <div className="flex items-center gap-0.5">
          {(['ar','en','fr','es'] as Lang[]).map(l => (
            <button key={l} onClick={() => { setLang(l); localStorage.setItem('sm_lang', l) }}
              className={`text-xs px-1.5 py-0.5 rounded font-bold transition-all ${lang === l ? 'bg-emerald-500 text-white' : 'text-gray-500'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* ── Order tracker ── */}
      <AnimatePresence>
        {activeOrder && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="border-b border-gray-700 px-4 py-3"
          >
            <p className="mb-2 text-xs text-gray-400">
              {activeOrder.items.map(i => `${i.quantity}× ${i.name}`).join(' · ')}
            </p>
            <LiveOrderTracker
              status={activeOrder.status}
              orderId={activeOrder.orderId}
              lang={lang as 'ar' | 'fr' | 'en'}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bill toast ── */}
      <AnimatePresence>
        {billMsg && (
          <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg whitespace-nowrap">
            {billMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast messages ── */}
      <AnimatePresence>
        {orderMsg && (
          <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg">
            {orderMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search ── */}
      <div className="px-4 pt-4 pb-2">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={tr.search}
          className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* ── Menu ── */}
      <div className="pb-36 px-4 space-y-8">
        {filteredCategories.length === 0 && (
          <p className="text-center text-gray-600 py-12">{tr.noItems}</p>
        )}
        {filteredCategories.map(cat => {
          const catName = lang === 'ar' ? cat.nameAr : lang === 'fr' ? cat.nameFr : cat.nameEn
          return (
            <section key={cat.id}>
              <h2 className="text-sm font-black uppercase tracking-widest text-emerald-400 mb-3">{catName}</h2>
              <div className="space-y-2">
                {cat.products.filter(p => p.isAvailable).map(product => {
                  const name = lang === 'ar' ? product.nameAr : lang === 'fr' ? product.nameFr : product.nameEn
                  const inCart = cart.find(c => c.productId === product.id)
                  return (
                    <div key={product.id} className="bg-gray-900 rounded-2xl flex items-center gap-3 p-3 border border-gray-800">
                      {product.imageUrl && (
                        <img src={product.imageUrl} alt={name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-white leading-tight">{name}</p>
                        {product.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{product.description}</p>}
                        <p className="text-emerald-400 font-black text-sm mt-1">{product.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {inCart ? (
                          <>
                            <button onClick={() => removeFromCart(product.id)}
                              className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-lg leading-none">−</button>
                            <span className="text-sm font-bold w-5 text-center">{inCart.quantity}</span>
                            <button onClick={() => addToCart(product)}
                              className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg leading-none">+</button>
                          </>
                        ) : (
                          <button onClick={() => addToCart(product)}
                            className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xl leading-none">+</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {/* ── Bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-gray-950/95 backdrop-blur border-t border-gray-800 flex gap-2">
        {/* Waiter button */}
        <button onClick={() => setWaiterOpen(true)}
          className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-xl">
          🔔
        </button>

        {/* Bill button */}
        <button onClick={openBillModal}
          className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-xl">
          🧾
        </button>

        {/* Cart button */}
        <button onClick={() => cartCount > 0 && setCartOpen(true)}
          disabled={cartCount === 0}
          className={`flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-between px-4 transition-all
            ${cartCount > 0 ? 'bg-emerald-500 text-white active:scale-95' : 'bg-gray-800 text-gray-600'}`}
        >
          <span>{cartCount > 0 ? tr.viewCart : tr.menu}</span>
          {cartCount > 0 && (
            <span className="flex items-center gap-2">
              <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full">{cartCount}</span>
              <span className="font-black">{cartTotal.toFixed(2)}</span>
            </span>
          )}
        </button>
      </div>

      {/* ── Cart Modal ── */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => setCartOpen(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30 }}
              className="w-full bg-gray-900 rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-4" />
              <h3 className="font-black text-lg mb-4">{tr.viewCart}</h3>
              <div className="space-y-3 mb-4">
                {cart.map(item => (
                  <div key={item.productId} className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{item.name}</p>
                      <p className="text-xs text-gray-400">{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(item.productId)} className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center font-bold">−</button>
                      <span className="w-5 text-center font-bold">{item.quantity}</span>
                      <button onClick={() => setCart(prev => prev.map(c => c.productId === item.productId ? { ...c, quantity: c.quantity + 1 } : c))} className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-white">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-700 pt-3 flex items-center justify-between mb-4">
                <span className="font-bold">{tr.total}</span>
                <span className="font-black text-emerald-400 text-lg">{cartTotal.toFixed(2)}</span>
              </div>
              <button onClick={placeOrder} disabled={placing}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-black text-base active:scale-95 transition-all">
                {placing ? tr.placing : tr.placeOrder}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bill Modal ── */}
      <AnimatePresence>
        {billOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => { setBillOpen(false); setBillPhase('choice') }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30 }}
              className="w-full bg-gray-900 rounded-t-3xl p-5" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-4" />

              {billPhase === 'choice' && (
                <>
                  <h3 className="font-black text-lg mb-5">{tr.billModalTitle}</h3>
                  <div className="space-y-3">
                    {/* Just me */}
                    <button
                      onClick={() => requestBill('SEATS', [scan!.seatNumber])}
                      disabled={billSending}
                      className="w-full bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl p-4 text-left transition-all flex items-center gap-4 disabled:opacity-50"
                    >
                      <span className="text-3xl">🙋</span>
                      <div>
                        <p className="font-bold text-white">{tr.billMyself}</p>
                        <p className="text-xs text-gray-400">{tr.billMyselfSub} — {tr.seat} {scan!.seatNumber}</p>
                      </div>
                    </button>

                    {/* Whole table */}
                    <button
                      onClick={() => requestBill('TABLE')}
                      disabled={billSending}
                      className="w-full bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl p-4 text-left transition-all flex items-center gap-4 disabled:opacity-50"
                    >
                      <span className="text-3xl">👨‍👩‍👧‍👦</span>
                      <div>
                        <p className="font-bold text-white">{tr.billTable}</p>
                        <p className="text-xs text-gray-400">{tr.billTableSub}</p>
                      </div>
                    </button>

                    {/* Choose seats */}
                    {scan!.capacity > 1 && (
                      <button
                        onClick={() => setBillPhase('pick')}
                        className="w-full bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl p-4 text-left transition-all flex items-center gap-4"
                      >
                        <span className="text-3xl">🪑</span>
                        <div>
                          <p className="font-bold text-white">{tr.billGroup}</p>
                          <p className="text-xs text-gray-400">{tr.billGroupSub}</p>
                        </div>
                      </button>
                    )}
                  </div>
                </>
              )}

              {billPhase === 'pick' && (
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setBillPhase('choice')} className="text-gray-400 text-sm">← Back</button>
                    <h3 className="font-black text-lg">{tr.billSeatPicker}</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {Array.from({ length: scan!.capacity }, (_, i) => i + 1).map(seat => (
                      <button
                        key={seat}
                        onClick={() => toggleBillSeat(seat)}
                        className={`h-14 rounded-2xl flex flex-col items-center justify-center text-sm font-black transition-all active:scale-90
                          ${billSeats.includes(seat)
                            ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                            : seat === scan!.seatNumber
                              ? 'bg-blue-900/40 border-2 border-blue-500/40 text-blue-300'
                              : 'bg-gray-800 text-gray-400'
                          }`}
                      >
                        <span>{seat}</span>
                        {seat === scan!.seatNumber && <span className="text-[9px] mt-0.5 opacity-70">me</span>}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => requestBill('SEATS', billSeats)}
                    disabled={billSending || billSeats.length === 0}
                    className="w-full py-3.5 rounded-2xl bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-black text-base active:scale-95 transition-all"
                  >
                    {billSending ? '…' : `${tr.billConfirm} (${billSeats.length} ${tr.seat})`}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Waiter Modal ── */}
      <AnimatePresence>
        {waiterOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => setWaiterOpen(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30 }}
              className="w-full bg-gray-900 rounded-t-3xl p-5" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-4" />
              <h3 className="font-black text-lg mb-4">{tr.waiterTitle}</h3>
              {waiterMsg && <p className="text-emerald-400 text-sm font-bold mb-3">{waiterMsg}</p>}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: 'call_waiter' as const, emoji: '🔔', label: tr.callWaiter },
                  { type: 'pay_cash'   as const, emoji: '💵', label: tr.payCash },
                  { type: 'pay_tpe'   as const, emoji: '💳', label: tr.payCard },
                  { type: 'water'     as const, emoji: '🧊', label: tr.water },
                  { type: 'clean'     as const, emoji: '🧹', label: tr.clean },
                  { type: 'question'  as const, emoji: '❓', label: tr.question },
                ].map(btn => (
                  <button key={btn.type} onClick={() => callWaiter(btn.type)}
                    className="bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl p-4 text-left transition-all">
                    <p className="text-2xl mb-1">{btn.emoji}</p>
                    <p className="text-xs font-bold text-gray-200 leading-tight">{btn.label}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function TablePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    }>
      <TablePageInner />
    </Suspense>
  )
}
