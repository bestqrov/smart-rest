'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useSearchParams } from 'next/navigation'
import { io as socketIO, Socket } from 'socket.io-client'

type Lang = 'ar' | 'en' | 'fr' | 'es'

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  en: {
    menu: 'Menu', table: 'Table', seat: 'Seat', search: 'Search menu…',
    pending: 'Order received', preparing: 'Being prepared…', delivered: 'Ready! 🎉',
    trackerTitle: 'Your Order',
    bonAppetit: 'Bon Appétit! 🍽️',
    bonSub: 'Enjoy your meal. Thank you!',
    photoPrompt: '📸 Snap & Share your plate',
    photoSub: 'Get a branded filter automatically',
    openCamera: 'Open Camera 📷',
    captureBtn: '📷 Take Photo',
    retake: 'Retake',
    share: '🚀 Share',
    backMenu: '← Back to Menu',
    orderMore: 'Order more items',
    waiterTitle: 'How can we help?',
    callWaiter: 'Call Waiter 🔔',
    callWaiterSub: 'We\'ll be right there',
    payCash: 'Pay in Cash 💵',
    payCashSub: "We'll bring change",
    payCard: 'Pay by Card / TPE 💳',
    payCardSub: 'Card machine on the way',
    water: 'Extra Ice / Water 🧊',
    waterSub: 'Coming right up',
    question: 'I have a question ❓',
    questionSub: 'Waiter will assist you',
    clean: 'Table needs cleaning 🧹',
    cleanSub: "We'll tidy up",
    waiterCalled: '✅ Waiter on the way!',
    noItems: 'No items found',
    viewCart: 'View Cart',
    total: 'Total',
    confirmOrder: 'Confirm Order',
    placing: 'Placing Order…',
    added: 'added',
    orderPlaced: "🎉 Order placed! We're on it.",
    failedOrder: 'Failed to place order',
    completeOrder: '✨ Complete your order',
    alsoLoved: 'Customers who ordered the same also loved:',
    skip: 'Skip',
    placeOrder: 'Place Order 🎉',
    addingFilter: 'Adding Cafe Branded Filter…',
    shareInstagram: '📤 Share to Instagram / Snapchat',
    mergedWith: 'Merged with',
    invalidTitle: 'Invalid QR Code',
    invalidSub: 'This QR code is invalid or has expired. Please scan the code on your table again.',
    chimeMsg: '🍽️ Your order is ready!',
    mergedMsg: 'Your table has merged with Table',
    downloadedMsg: '📥 Photo saved to gallery!',
    sharedMsg: '🎉 Shared! Enjoy your moment.',
    showOrder: 'Show Order',
    rateTitle: 'How was your experience?',
    rateSub: 'Your feedback helps us improve',
    reviewPlaceholder: 'Tell us more (optional)…',
    submitReview: 'Submit Review',
    reviewThanks: '🙏 Thank you for your feedback!',
    likeLabel: 'Like',
    shareLabel: 'Share',
    kcal: 'kcal',
    requestBill: '💳 Request the Bill',
    choosePayMethod: 'How would you like to pay?',
    waiterWithBill: '🛎️ Waiter is on the way with your bill!',
    sharedDone: '✅ Photo shared! Enjoy your meal.',
  },
  ar: {
    menu: 'القائمة', table: 'طاولة', seat: 'مقعد', search: 'ابحث في القائمة…',
    pending: 'تم استلام طلبك', preparing: 'جارٍ التحضير…', delivered: 'جاهز! 🎉',
    trackerTitle: 'طلبك',
    bonAppetit: 'بالصحة والعافية! 🍽️',
    bonSub: 'استمتع بوجبتك. شكراً لك!',
    photoPrompt: '📸 صوّر وشارك طبقك',
    photoSub: 'سيُضاف فلتر المطعم تلقائياً',
    openCamera: 'فتح الكاميرا 📷',
    captureBtn: '📷 التقط الصورة',
    retake: 'إعادة التصوير',
    share: '🚀 مشاركة',
    backMenu: 'العودة للقائمة →',
    orderMore: 'طلب مزيد من الأصناف',
    waiterTitle: 'كيف يمكننا مساعدتك؟',
    callWaiter: 'استدعاء النادل 🔔',
    callWaiterSub: 'سنصل إليك فوراً',
    payCash: 'دفع نقدي 💵',
    payCashSub: 'سنحضر الباقي',
    payCard: 'دفع بالبطاقة / TPE 💳',
    payCardSub: 'ماكينة الدفع في الطريق',
    water: 'ثلج / ماء إضافي 🧊',
    waterSub: 'في الطريق',
    question: 'لدي سؤال ❓',
    questionSub: 'النادل سيساعدك',
    clean: 'تنظيف الطاولة 🧹',
    cleanSub: 'سنرتب فوراً',
    waiterCalled: '✅ النادل في الطريق!',
    noItems: 'لا توجد نتائج',
    viewCart: 'عرض السلة',
    total: 'المجموع',
    confirmOrder: 'تأكيد الطلب',
    placing: 'جارٍ الطلب…',
    added: 'أُضيف',
    orderPlaced: '🎉 تم الطلب!',
    failedOrder: 'فشل في إرسال الطلب',
    completeOrder: '✨ أكمل طلبك',
    alsoLoved: 'زبائن طلبوا نفس الشيء أحبوا أيضاً:',
    skip: 'تخطي',
    placeOrder: 'إرسال الطلب 🎉',
    addingFilter: 'جارٍ إضافة فلتر المطعم…',
    shareInstagram: '📤 مشاركة على إنستغرام',
    mergedWith: 'مدمجة مع طاولة',
    invalidTitle: 'رمز QR غير صحيح',
    invalidSub: 'رمز QR هذا غير صحيح أو انتهت صلاحيته. يرجى مسح الرمز الموجود على طاولتك مرة أخرى.',
    chimeMsg: '🍽️ طلبك جاهز!',
    mergedMsg: 'طاولتك دُمجت مع طاولة',
    downloadedMsg: '📥 تم حفظ الصورة!',
    sharedMsg: '🎉 تمت المشاركة!',
    showOrder: 'عرض الطلب',
    rateTitle: 'كيف كانت تجربتك؟',
    rateSub: 'ملاحظاتك تساعدنا على التحسين',
    reviewPlaceholder: 'أخبرنا بالمزيد (اختياري)…',
    submitReview: 'إرسال التقييم',
    reviewThanks: '🙏 شكراً على ملاحظاتك!',
    likeLabel: 'إعجاب',
    shareLabel: 'مشاركة',
    kcal: 'سعرة',
    requestBill: '💳 طلب الفاتورة والدفع',
    choosePayMethod: 'كيف تريد أن تدفع؟',
    waiterWithBill: '🛎️ النادل في طريقه إليك بالحساب!',
    sharedDone: '✅ تمت المشاركة! استمتع بوجبتك.',
  },
  fr: {
    menu: 'Menu', table: 'Table', seat: 'Place', search: 'Rechercher…',
    pending: 'Commande reçue', preparing: 'En cours de préparation…', delivered: 'Prêt! 🎉',
    trackerTitle: 'Votre commande',
    bonAppetit: 'Bon Appétit! 🍽️',
    bonSub: 'Profitez de votre repas. Merci!',
    photoPrompt: '📸 Snap & Partagez votre plat',
    photoSub: 'Filtre brandé ajouté automatiquement',
    openCamera: 'Ouvrir la caméra 📷',
    captureBtn: '📷 Prendre la photo',
    retake: 'Reprendre',
    share: '🚀 Partager',
    backMenu: '← Retour au menu',
    orderMore: 'Commander plus',
    waiterTitle: 'Comment pouvons-nous vous aider?',
    callWaiter: 'Appeler le serveur 🔔',
    callWaiterSub: 'Nous arrivons',
    payCash: 'Payer en espèces 💵',
    payCashSub: 'Nous apportons la monnaie',
    payCard: 'Payer par carte / TPE 💳',
    payCardSub: 'Terminal de paiement en route',
    water: 'Eau / Glaçons supplémentaires 🧊',
    waterSub: 'Tout de suite',
    question: "J'ai une question ❓",
    questionSub: 'Le serveur va vous aider',
    clean: 'Table à nettoyer 🧹',
    cleanSub: 'Nous allons ranger',
    waiterCalled: '✅ Serveur en route!',
    noItems: 'Aucun résultat',
    viewCart: 'Voir le panier',
    total: 'Total',
    confirmOrder: 'Confirmer la commande',
    placing: 'Commande en cours…',
    added: 'ajouté',
    orderPlaced: '🎉 Commande passée!',
    failedOrder: 'Échec de la commande',
    completeOrder: '✨ Complétez votre commande',
    alsoLoved: "Les clients qui ont commandé pareil ont aussi aimé:",
    skip: 'Passer',
    placeOrder: 'Commander 🎉',
    addingFilter: 'Ajout du filtre…',
    shareInstagram: '📤 Partager sur Instagram / Snapchat',
    mergedWith: 'Fusionnée avec la Table',
    invalidTitle: 'QR Code invalide',
    invalidSub: 'Ce QR code est invalide ou expiré. Veuillez re-scanner le code sur votre table.',
    chimeMsg: '🍽️ Votre commande est prête!',
    mergedMsg: 'Votre table a fusionné avec la Table',
    downloadedMsg: '📥 Photo sauvegardée!',
    sharedMsg: '🎉 Partagé! Profitez du moment.',
    showOrder: 'Voir commande',
    rateTitle: 'Comment était votre expérience?',
    rateSub: 'Votre avis nous aide à nous améliorer',
    reviewPlaceholder: 'Dites-nous en plus (optionnel)…',
    submitReview: 'Soumettre l\'avis',
    reviewThanks: '🙏 Merci pour votre retour!',
    likeLabel: 'J\'aime',
    shareLabel: 'Partager',
    kcal: 'kcal',
    requestBill: '💳 Demander l\'addition',
    choosePayMethod: 'Comment souhaitez-vous payer ?',
    waiterWithBill: '🛎️ Le serveur arrive avec l\'addition !',
    sharedDone: '✅ Photo partagée ! Bon appétit.',
  },
  es: {
    menu: 'Menú', table: 'Mesa', seat: 'Asiento', search: 'Buscar en el menú…',
    pending: 'Pedido recibido', preparing: 'En preparación…', delivered: '¡Listo! 🎉',
    trackerTitle: 'Tu pedido',
    bonAppetit: '¡Buen provecho! 🍽️',
    bonSub: 'Disfruta tu comida. ¡Gracias!',
    photoPrompt: '📸 Fotografía y comparte tu plato',
    photoSub: 'Filtro de marca añadido automáticamente',
    openCamera: 'Abrir cámara 📷',
    captureBtn: '📷 Tomar foto',
    retake: 'Volver a tomar',
    share: '🚀 Compartir',
    backMenu: '← Volver al menú',
    orderMore: 'Pedir más artículos',
    waiterTitle: '¿En qué podemos ayudarte?',
    callWaiter: 'Llamar al mesero 🔔',
    callWaiterSub: 'Llegamos enseguida',
    payCash: 'Pagar en efectivo 💵',
    payCashSub: 'Traemos el cambio',
    payCard: 'Pagar con tarjeta / TPE 💳',
    payCardSub: 'Datáfono en camino',
    water: 'Agua / Hielo extra 🧊',
    waterSub: 'En seguida',
    question: 'Tengo una pregunta ❓',
    questionSub: 'El mesero te ayudará',
    clean: 'Limpiar la mesa 🧹',
    cleanSub: 'Lo arreglamos',
    waiterCalled: '✅ ¡Mesero en camino!',
    noItems: 'Sin resultados',
    viewCart: 'Ver carrito',
    total: 'Total',
    confirmOrder: 'Confirmar pedido',
    placing: 'Enviando pedido…',
    added: 'añadido',
    orderPlaced: '🎉 ¡Pedido enviado!',
    failedOrder: 'Error al enviar el pedido',
    completeOrder: '✨ Completa tu pedido',
    alsoLoved: 'A otros clientes también les gustó:',
    skip: 'Omitir',
    placeOrder: 'Realizar pedido 🎉',
    addingFilter: 'Aplicando filtro…',
    shareInstagram: '📤 Compartir en Instagram / Snapchat',
    mergedWith: 'Fusionada con Mesa',
    invalidTitle: 'Código QR inválido',
    invalidSub: 'Este código QR es inválido o ha expirado. Escanea de nuevo el código en tu mesa.',
    chimeMsg: '🍽️ ¡Tu pedido está listo!',
    mergedMsg: 'Tu mesa se fusionó con la Mesa',
    downloadedMsg: '📥 ¡Foto guardada!',
    sharedMsg: '🎉 ¡Compartido! Disfruta el momento.',
    showOrder: 'Ver pedido',
    rateTitle: '¿Cómo fue tu experiencia?',
    rateSub: 'Tu opinión nos ayuda a mejorar',
    reviewPlaceholder: 'Cuéntanos más (opcional)…',
    submitReview: 'Enviar reseña',
    reviewThanks: '🙏 ¡Gracias por tu opinión!',
    likeLabel: 'Me gusta',
    shareLabel: 'Compartir',
    kcal: 'kcal',
    requestBill: '💳 Pedir la cuenta',
    choosePayMethod: '¿Cómo deseas pagar?',
    waiterWithBill: '🛎️ ¡El mesero viene con la cuenta!',
    sharedDone: '✅ ¡Foto compartida! Disfruta tu comida.',
  },
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

type Session = {
  cafeId: string; tableId: string; tableNumber: number
  seatId: string; seatNumber: number; billingTableId: string
  isMerged: boolean; mergedIntoTableNumber?: number
}
type Product  = { id: string; nameEn: string; nameAr: string; nameFr?: string; nameEs?: string; price: number; imageUrl?: string | null; description?: string | null; calories?: number | null; likesCount?: number }
type Category = { id: string; nameEn: string; nameAr: string; nameFr?: string; products: Product[] }
type CartItem = { product: Product; quantity: number }
type Toast    = { id: number; message: string; type: 'success' | 'info' | 'error' }
type OrderStatus = 'PENDING' | 'PREPARING' | 'DELIVERED' | null

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

// Auto-transition to Bon Appétit after this delay if socket hasn't fired (ms)
const PREPARE_TIMEOUT_MS = 8 * 60 * 1000 // 8 minutes — adjust as needed

function getSessionId(): string {
  const KEY = 'sm_session_id'
  let id = ''
  try { id = localStorage.getItem(KEY) ?? '' } catch {}
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    try { localStorage.setItem(KEY, id) } catch {}
  }
  return id
}

// ─── Offline cart helpers ─────────────────────────────────────────────────────

const CART_KEY = 'sm_cart'
const loadCart = (): CartItem[] => { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') } catch { return [] } }
const saveCart = (c: CartItem[]) => { try { localStorage.setItem(CART_KEY, JSON.stringify(c)) } catch {} }

// ─── AI upsell ────────────────────────────────────────────────────────────────

function getUpsells(cart: CartItem[], all: Product[]): Product[] {
  const inCart = new Set(cart.map(i => i.product.id))
  const names  = cart.map(i => i.product.nameEn.toLowerCase())
  const hour   = new Date().getHours()
  const picks: Product[] = []

  if (hour >= 12 && hour <= 18) {
    picks.push(...all.filter(p => !inCart.has(p.id) &&
      ['juice', 'lemonade', 'iced', 'cold', 'smoothie', 'water', 'refresh'].some(k => p.nameEn.toLowerCase().includes(k))
    ).slice(0, 2))
  }
  if (names.some(n => n.includes('burger') || n.includes('sandwich'))) {
    picks.push(...all.filter(p => !inCart.has(p.id) &&
      ['fries', 'cheese', 'onion', 'sauce', 'extra'].some(k => p.nameEn.toLowerCase().includes(k))
    ).slice(0, 1))
  }
  if (names.some(n => ['coffee', 'espresso', 'latte', 'cappuccino'].some(k => n.includes(k)))) {
    picks.push(...all.filter(p => !inCart.has(p.id) &&
      ['cake', 'cookie', 'muffin', 'croissant', 'pastry', 'dessert'].some(k => p.nameEn.toLowerCase().includes(k))
    ).slice(0, 2))
  }

  const seen = new Set<string>()
  return picks.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true }).slice(0, 3)
}

// ─── Audio helpers ────────────────────────────────────────────────────────────

function playChime() {
  try {
    const C = window.AudioContext || (window as any).webkitAudioContext
    if (!C) return
    const ctx = new C() as AudioContext
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      const t = ctx.currentTime + i * 0.16
      gain.gain.setValueAtTime(0.3, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
      osc.start(t); osc.stop(t + 0.5)
    })
  } catch {}
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MenuPage() {
  return (
    <Suspense fallback={<Loader lang="en" />}>
      <MenuPageInner />
    </Suspense>
  )
}

function MenuPageInner() {
  const params       = useParams()
  const searchParams = useSearchParams()

  const subdomain   = params.subdomain   as string
  const tableNumber = params.tableNumber as string
  const seatNumber  = params.seatNumber  as string
  const token       = searchParams.get('token') ?? ''

  // ── State ─────────────────────────────────────────────────────────────────
  const [status, setStatus]           = useState<'loading' | 'valid' | 'invalid'>('loading')
  const [session, setSession]         = useState<Session | null>(null)
  const [categories, setCategories]   = useState<Category[]>([])
  const [cafeName, setCafeName]       = useState('')
  const [cafeLogoUrl, setCafeLogoUrl] = useState<string | null>(null)
  const [currency, setCurrency]       = useState('MAD')
  const [activeCategory, setActiveCategory] = useState('')
  const [search, setSearch]           = useState('')
  const [cart, setCart]               = useState<CartItem[]>([])
  const [showWaiter, setShowWaiter]   = useState(false)
  const [showCart, setShowCart]       = useState(false)
  const [showAI, setShowAI]           = useState(false)
  const [upsells, setUpsells]         = useState<Product[]>([])
  const [ordering, setOrdering]       = useState(false)
  const [orderId, setOrderId]         = useState<string | null>(null)
  const [orderItems, setOrderItems]   = useState<CartItem[]>([])
  const [orderTotal, setOrderTotal]   = useState(0)
  const [orderConfirmedAt, setOrderConfirmedAt] = useState<number | null>(null)
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(null)
  const [showBonAppetit, setShowBonAppetit] = useState(false)
  const [toasts, setToasts]           = useState<Toast[]>([])
  const [lang, setLangState]          = useState<Lang>('en')

  // ── Photo share / bill state ──────────────────────────────────────────────
  const [hasShared, setHasShared]           = useState(false)
  const [showPayModal, setShowPayModal]     = useState(false)
  const [billRequested, setBillRequested]   = useState(false)

  // ── Like / review state ───────────────────────────────────────────────────
  const [likedProducts, setLikedProducts]   = useState<Record<string, boolean>>({})
  const [localLikeCounts, setLocalLikeCounts] = useState<Record<string, number>>({})
  const [showReview, setShowReview]         = useState(false)
  const [reviewRating, setReviewRating]     = useState(0)
  const [reviewComment, setReviewComment]   = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewDone, setReviewDone]         = useState(false)

  // ── Camera state ──────────────────────────────────────────────────────────
  const [cameraMode, setCameraMode]         = useState<'idle' | 'preview' | 'captured'>('idle')
  const [cameraStream, setCameraStream]     = useState<MediaStream | null>(null)
  const [photoFiltered, setPhotoFiltered]   = useState<string | null>(null)
  const [photoLoading, setPhotoLoading]     = useState(false)

  const socketRef       = useRef<Socket | null>(null)
  const videoRef        = useRef<HTMLVideoElement>(null)
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const toastIdRef      = useRef(0)
  const catBarRef       = useRef<HTMLDivElement>(null)
  const prepareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tr    = T[lang]
  const isRTL = lang === 'ar'

  // ── Language detection ────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('sm_lang')
    if (saved === 'ar' || saved === 'en' || saved === 'fr' || saved === 'es') {
      setLangState(saved as Lang)
    } else {
      const l = navigator.language?.toLowerCase() ?? 'en'
      if (l.startsWith('ar')) setLangState('ar')
      else if (l.startsWith('fr')) setLangState('fr')
      else if (l.startsWith('es')) setLangState('es')
    }
  }, [])

  function setLang(l: Lang) { setLangState(l); localStorage.setItem('sm_lang', l) }

  // ── Toast ─────────────────────────────────────────────────────────────────
  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastIdRef.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  // ── Session validation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    fetch(`/api/qr/session?subdomain=${subdomain}&tableNumber=${tableNumber}&seatNumber=${seatNumber}&token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setStatus('invalid'); return }
        setSession(data); setStatus('valid')
        const cached = loadCart()
        if (cached.length) setCart(cached)
      })
      .catch(() => setStatus('invalid'))
  }, [subdomain, tableNumber, seatNumber, token])

  // ── Menu fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    fetch(`/api/menu/public?tableId=${session.tableId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.categories) return
        setCategories(data.categories)
        setCafeName(data.cafeName ?? '')
        setCafeLogoUrl(data.cafeLogoUrl ?? null)
        setCurrency(data.currency ?? 'MAD')
        setActiveCategory(data.categories[0]?.id ?? '')
      })
      .catch(() => {})
  }, [session])

  // ── Restore last order from localStorage ─────────────────────────────────
  useEffect(() => {
    if (!session) return
    const key = `sm_order_${session.seatId}`
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      if (saved?.orderId && saved?.confirmedAt) {
        setOrderId(saved.orderId)
        setOrderItems(saved.items ?? [])
        setOrderTotal(saved.total ?? 0)
        setOrderConfirmedAt(saved.confirmedAt)
        if (saved.orderStatus) setOrderStatus(saved.orderStatus)
        if (saved.hasShared)     setHasShared(true)
        if (saved.billRequested) setBillRequested(true)
      }
    } catch {}
  }, [session])

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    const socket = socketIO(SOCKET_URL || window.location.origin, { transports: ['polling', 'websocket'] })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_table_room', { cafeId: session.cafeId, tableId: session.tableId, seatToken: token })
    })

    socket.on('TABLES_MERGED', (p: any) => {
      toast(`${tr.mergedMsg} ${p.targetTableNumber}`, 'info')
    })

    socket.on('your_order_updated', (p: { orderId?: string; status: string }) => {
      const s = p.status as OrderStatus
      if (!s) return
      setOrderStatus(s)
      // Persist so the status survives page reload
      if (session) {
        const key = `sm_order_${session.seatId}`
        try {
          const saved = JSON.parse(localStorage.getItem(key) || '{}')
          localStorage.setItem(key, JSON.stringify({ ...saved, orderStatus: s }))
        } catch {}
      }
      if (s === 'DELIVERED') {
        playChime()
        toast(tr.chimeMsg, 'success')
        setTimeout(() => setShowBonAppetit(true), 1200)
      } else if (s === 'PREPARING') {
        toast(tr.preparing, 'info')
      }
    })

    return () => { socket.disconnect() }
  }, [session, token, toast, tr])

  // ── Smart transition timer ────────────────────────────────────────────────
  // If the order stays in PENDING or PREPARING longer than PREPARE_TIMEOUT_MS,
  // auto-open the Bon Appétit screen so the customer isn't stuck waiting.
  useEffect(() => {
    if (orderStatus === 'PENDING' || orderStatus === 'PREPARING') {
      if (prepareTimerRef.current) clearTimeout(prepareTimerRef.current)
      prepareTimerRef.current = setTimeout(() => {
        setShowBonAppetit(true)
      }, PREPARE_TIMEOUT_MS)
    } else {
      // DELIVERED or null — clear any pending timer (socket already handled it)
      if (prepareTimerRef.current) {
        clearTimeout(prepareTimerRef.current)
        prepareTimerRef.current = null
      }
    }
    return () => {
      if (prepareTimerRef.current) clearTimeout(prepareTimerRef.current)
    }
  }, [orderStatus])

  // ── Cart persistence ──────────────────────────────────────────────────────
  useEffect(() => { saveCart(cart) }, [cart])

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const addToCart = useCallback((product: Product) => {
    setCart(c => {
      const e = c.find(i => i.product.id === product.id)
      return e ? c.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
               : [...c, { product, quantity: 1 }]
    })
    const name = lang === 'ar' ? product.nameAr : lang === 'fr' ? (product.nameFr ?? product.nameEn) : lang === 'es' ? (product.nameEs ?? product.nameEn) : product.nameEn
    toast(`${name} ${tr.added}`, 'success')
  }, [toast, tr, lang])

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) setCart(c => c.filter(i => i.product.id !== productId))
    else setCart(c => c.map(i => i.product.id === productId ? { ...i, quantity: qty } : i))
  }

  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const allProducts = categories.flatMap(c => c.products)

  // ── Pre-order AI check ────────────────────────────────────────────────────
  const handlePreOrder = () => {
    if (!session || cart.length === 0) return
    const suggestions = getUpsells(cart, allProducts)
    if (suggestions.length > 0) { setUpsells(suggestions); setShowAI(true); setShowCart(false) }
    else handlePlaceOrder()
  }

  // ── Place order ───────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!session || cart.length === 0) return
    setOrdering(true); setShowAI(false); setShowCart(false)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatToken: token,
          items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const confirmedAt = Date.now()
      setOrderId(data.orderId); setOrderItems([...cart]); setOrderTotal(cartTotal)
      setOrderConfirmedAt(confirmedAt); setOrderStatus('PENDING')
      const key = `sm_order_${session.seatId}`
      localStorage.setItem(key, JSON.stringify({ orderId: data.orderId, items: cart, total: cartTotal, confirmedAt, orderStatus: 'PENDING' }))
      setCart([]); saveCart([])
      toast(tr.orderPlaced, 'success')
    } catch (err: any) {
      toast(err.message || tr.failedOrder, 'error')
    } finally {
      setOrdering(false)
    }
  }

  // ── Notify waiter via HTTP (new system) ───────────────────────────────────
  const notifyWaiter = async (type: 'call_waiter' | 'pay_cash' | 'pay_tpe') => {
    if (orderId) {
      try {
        await fetch(`/api/orders/${orderId}/notify-waiter`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, seatToken: token }),
        })
      } catch {}
    } else {
      // Fallback: legacy socket event when no order yet
      socketRef.current?.emit('waiter_call', {
        cafeId: session?.cafeId, tableId: session?.tableId, type: 'QUESTION', message: type,
      })
    }
    setShowWaiter(false)
    toast(tr.waiterCalled, 'success')
    // Show review modal when customer requests bill payment
    if ((type === 'pay_cash' || type === 'pay_tpe') && orderId && !reviewDone) {
      setTimeout(() => setShowReview(true), 600)
    }
  }

  // ── Bill payment request (from Bon Appétit screen pay modal) ─────────────
  const requestBill = async (method: 'pay_cash' | 'pay_tpe') => {
    setShowPayModal(false)
    await notifyWaiter(method)
    setBillRequested(true)
    if (session) {
      const key = `sm_order_${session.seatId}`
      try {
        const saved = JSON.parse(localStorage.getItem(key) || '{}')
        localStorage.setItem(key, JSON.stringify({ ...saved, billRequested: true }))
      } catch {}
    }
  }

  // ── Legacy service calls (WATER / CLEAN / QUESTION) via socket ────────────
  const legacyCall = (type: string, msg: string) => {
    socketRef.current?.emit('waiter_call', { cafeId: session?.cafeId, tableId: session?.tableId, type, message: msg })
    setShowWaiter(false)
    toast(tr.waiterCalled, 'success')
  }

  // ── Like a product ────────────────────────────────────────────────────────
  const handleLike = async (productId: string, currentCount: number) => {
    if (likedProducts[productId]) return
    setLikedProducts(prev => ({ ...prev, [productId]: true }))
    setLocalLikeCounts(prev => ({ ...prev, [productId]: (prev[productId] ?? currentCount) + 1 }))
    try {
      const sessionId = getSessionId()
      await fetch(`/api/products/${productId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-ID': sessionId },
      })
    } catch {}
  }

  // ── Share a product ───────────────────────────────────────────────────────
  const handleShareProduct = async (product: Product, name: string) => {
    const text = `${name} — ${product.price.toFixed(2)} ${currency}`
    try {
      if (navigator.share) {
        await navigator.share({ title: cafeName, text })
      } else {
        await navigator.clipboard?.writeText(text)
        toast(tr.sharedMsg, 'success')
      }
    } catch (err: any) { if (err?.name !== 'AbortError') toast(tr.sharedMsg, 'info') }
  }

  // ── Submit review ─────────────────────────────────────────────────────────
  const submitReview = async () => {
    if (!orderId || reviewRating === 0 || reviewSubmitting || reviewDone) return
    setReviewSubmitting(true)
    try {
      await fetch(`/api/orders/${orderId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, reviewText: reviewComment || undefined, seatToken: token }),
      })
      setReviewDone(true)
      toast(tr.reviewThanks, 'success')
      setTimeout(() => setShowReview(false), 1800)
    } catch {
      toast('Failed to submit review', 'error')
    } finally {
      setReviewSubmitting(false)
    }
  }

  // ── Camera (MediaDevices API) ─────────────────────────────────────────────
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setCameraStream(stream)
      setCameraMode('preview')
      // Attach stream to video element on next tick (after state update + render)
      requestAnimationFrame(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
      })
    } catch {
      // Fallback to file input on devices that deny getUserMedia
      fileInputRef.current?.click()
    }
  }

  function captureFromCamera() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    // Stop stream
    cameraStream?.getTracks().forEach(t => t.stop())
    setCameraStream(null)
    applyFilter(canvas.toDataURL('image/jpeg', 0.9))
  }

  function stopCamera() {
    cameraStream?.getTracks().forEach(t => t.stop())
    setCameraStream(null)
    setCameraMode('idle')
    setPhotoFiltered(null)
  }

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => applyFilter(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const applyFilter = async (src: string) => {
    setPhotoLoading(true); setCameraMode('captured')
    await new Promise(r => setTimeout(r, 1000))
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!canvas || !ctx) { setPhotoLoading(false); return }

    const img = new window.Image()
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      // Warm overlay
      ctx.fillStyle = 'rgba(255,140,40,0.10)'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      // Vignette
      const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.3, canvas.width / 2, canvas.height / 2, canvas.width * 0.75)
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)')
      ctx.fillStyle = vg; ctx.fillRect(0, 0, canvas.width, canvas.height)
      const finish = () => { setPhotoFiltered(canvas.toDataURL('image/jpeg', 0.88)); setPhotoLoading(false) }
      if (cafeLogoUrl) {
        const logo = new window.Image(); logo.crossOrigin = 'anonymous'
        logo.onload = () => {
          const lw = canvas.width * 0.22; const lh = (logo.height / logo.width) * lw
          ctx.globalAlpha = 0.75; ctx.drawImage(logo, canvas.width - lw - 18, canvas.height - lh - 18, lw, lh); ctx.globalAlpha = 1; finish()
        }
        logo.onerror = () => { addWatermark(ctx, canvas); finish() }
        logo.src = cafeLogoUrl
      } else { addWatermark(ctx, canvas); finish() }
    }
    img.src = src
  }

  function addWatermark(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const fs = Math.max(18, canvas.width * 0.045)
    ctx.font = `bold ${fs}px -apple-system,sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.textAlign = 'right'; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6
    ctx.fillText(`📍 ${cafeName}`, canvas.width - 16, canvas.height - 20); ctx.shadowBlur = 0
  }

  const handleShare = async () => {
    if (!photoFiltered) return
    try {
      const blob = await (await fetch(photoFiltered)).blob()
      const file = new File([blob], 'my-plate.jpg', { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${cafeName} ✨`, text: '#SmartMenu #FoodVibes' })
        if (orderId) fetch(`/api/orders/${orderId}/social-verified`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(() => {})
      } else {
        const a = document.createElement('a'); a.href = photoFiltered; a.download = 'my-plate.jpg'; a.click()
        toast(tr.downloadedMsg, 'info')
      }
      // Mark shared — hide camera card for this session
      setHasShared(true)
      if (session) {
        const key = `sm_order_${session.seatId}`
        try {
          const saved = JSON.parse(localStorage.getItem(key) || '{}')
          localStorage.setItem(key, JSON.stringify({ ...saved, hasShared: true }))
        } catch {}
      }
      toast(tr.sharedDone, 'success')
    } catch (err: any) { if (err?.name !== 'AbortError') toast('Could not share', 'error') }
  }

  // ── Filtered view ─────────────────────────────────────────────────────────
  function productName(p: Product) {
    if (lang === 'ar') return p.nameAr ?? p.nameEn
    if (lang === 'fr') return p.nameFr ?? p.nameEn
    if (lang === 'es') return p.nameEs ?? p.nameEn
    return p.nameEn
  }
  function catName(c: Category) {
    if (lang === 'ar') return c.nameAr ?? c.nameEn
    if (lang === 'fr') return c.nameFr ?? c.nameEn
    return c.nameEn
  }

  const displayCategories = search
    ? categories.map(c => ({ ...c, products: c.products.filter(p => p.nameEn.toLowerCase().includes(search.toLowerCase()) || p.nameAr.includes(search)) })).filter(c => c.products.length)
    : categories

  const visibleProducts = search
    ? displayCategories.flatMap(c => c.products)
    : categories.find(c => c.id === activeCategory)?.products ?? []

  // ── Render guards ─────────────────────────────────────────────────────────
  if (status === 'loading') return <Loader lang={lang} />
  if (status === 'invalid') return <InvalidQR tr={tr} />

  return (
    <div className="relative min-h-screen bg-[#f7f7f5] font-sans select-none" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Watermark — cafe logo at 5% opacity fixed behind all content */}
      {cafeLogoUrl && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat bg-contain opacity-[0.05]"
          style={{ backgroundImage: `url(${cafeLogoUrl})` }}
        />
      )}
      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoFile} />

      {/* ── Bon Appétit Full-Screen Overlay ── */}
      <AnimatePresence>
        {showBonAppetit && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex flex-col"
          >
            {/* Language switcher in overlay */}
            <div className="flex justify-end px-4 pt-4 gap-1">
              {(['ar', 'en', 'fr', 'es'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`text-xs font-bold px-2 py-1 rounded-lg transition-all ${lang === l ? 'bg-amber-500 text-white' : 'bg-white/70 text-gray-500'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Camera live preview */}
            {cameraMode === 'preview' && cameraStream && (
              <div className="flex-1 relative">
                <video ref={videoRef} autoPlay playsInline muted
                  className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 px-6">
                  <button onClick={stopCamera}
                    className="flex-1 bg-white/80 backdrop-blur text-gray-700 font-bold py-3.5 rounded-2xl text-sm">
                    ✕ {tr.retake}
                  </button>
                  <button onClick={captureFromCamera}
                    className="flex-[2] bg-amber-500 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg">
                    {tr.captureBtn}
                  </button>
                </div>
              </div>
            )}

            {/* Photo loading */}
            {photoLoading && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  className="text-6xl mb-5 inline-block">✨</motion.div>
                <p className="font-bold text-gray-800 text-lg">{tr.addingFilter}</p>
              </div>
            )}

            {/* Captured photo result */}
            {cameraMode === 'captured' && photoFiltered && !photoLoading && (
              <div className="flex-1 flex flex-col px-5 py-4 gap-4 overflow-y-auto">
                <div className="rounded-3xl overflow-hidden shadow-2xl">
                  <img src={photoFiltered} alt="Your plate" className="w-full object-cover" />
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleShare}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-2xl py-4 font-bold text-base shadow-xl">
                  {tr.shareInstagram}
                </motion.button>
                <button onClick={() => { setPhotoFiltered(null); setCameraMode('idle') }}
                  className="text-center text-gray-500 text-sm py-1">{tr.retake}</button>
                <button onClick={() => setShowBonAppetit(false)}
                  className="text-center text-gray-400 text-sm py-1">{tr.backMenu}</button>
              </div>
            )}

            {/* Default Bon Appétit screen */}
            {cameraMode === 'idle' && !photoLoading && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-5 overflow-y-auto py-6">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="text-7xl">🍽️</motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                  <h1 className="font-extrabold text-3xl text-gray-900 mb-1">{tr.bonAppetit}</h1>
                  <p className="text-gray-500 text-sm">{tr.bonSub}</p>
                </motion.div>

                {/* Photo prompt — hidden after share */}
                {!hasShared && (
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}
                    className="w-full bg-gradient-to-br from-purple-600 via-pink-500 to-rose-500 rounded-3xl p-5 text-white shadow-xl">
                    <p className="font-bold text-lg mb-1">{tr.photoPrompt}</p>
                    <p className="text-sm opacity-80 mb-4">{tr.photoSub}</p>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={startCamera}
                      className="w-full bg-white text-purple-700 font-bold py-3.5 rounded-2xl text-base shadow-md">
                      {tr.openCamera}
                    </motion.button>
                  </motion.div>
                )}

                {/* Photo shared confirmation */}
                {hasShared && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="w-full bg-emerald-50 border border-emerald-200 rounded-3xl p-4 text-center">
                    <p className="text-emerald-700 font-bold text-sm">{tr.sharedDone}</p>
                  </motion.div>
                )}

                {/* Request Bill button / confirmation */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                  className="w-full">
                  {billRequested ? (
                    <div className="w-full bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 text-center">
                      <p className="text-3xl mb-2">🛎️</p>
                      <p className="font-extrabold text-amber-800 text-base">{tr.waiterWithBill}</p>
                    </div>
                  ) : (
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowPayModal(true)}
                      className="w-full bg-gray-900 text-white rounded-3xl py-5 font-extrabold text-lg shadow-2xl">
                      {tr.requestBill}
                    </motion.button>
                  )}
                </motion.div>

                {/* Back to menu */}
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
                  onClick={() => setShowBonAppetit(false)}
                  className="text-gray-400 text-sm underline underline-offset-2">
                  {tr.orderMore} →
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sticky header ── */}
      <header className="bg-white sticky top-0 z-30 border-b border-gray-100">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {cafeLogoUrl && (
                <img
                  src={cafeLogoUrl}
                  alt={cafeName}
                  className="w-9 h-9 aspect-square rounded-lg object-contain bg-gray-50 border border-gray-100 shrink-0"
                />
              )}
              <div>
                <h1 className="font-bold text-gray-900 leading-tight">{cafeName || tr.menu}</h1>
                <p className="text-xs text-emerald-600 font-medium">
                  📍 {tr.table} {tableNumber} · {tr.seat} {seatNumber}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {session?.isMerged && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                  {tr.mergedWith} T{session.mergedIntoTableNumber}
                </span>
              )}
              {/* Lang selector */}
              <div className="flex gap-0.5 bg-gray-100 rounded-xl p-0.5">
                {(['ar', 'en', 'fr', 'es'] as Lang[]).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`text-[10px] font-bold px-1.5 py-1 rounded-lg transition-all ${lang === l ? 'bg-white shadow text-gray-900' : 'text-gray-400'}`}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className={`relative ${isRTL ? 'text-right' : 'text-left'}`}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={tr.search}
              className={`w-full bg-gray-100 rounded-2xl px-4 py-2.5 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-sm outline-none focus:ring-2 focus:ring-emerald-400 transition`} />
            <span className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-gray-400`}>🔍</span>
            {search && (
              <button onClick={() => setSearch('')} className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 text-lg`}>×</button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        {!search && (
          <div ref={catBarRef} className="flex gap-2 px-4 pb-3 pt-1 overflow-x-auto scrollbar-hide">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeCategory === cat.id ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {catName(cat)}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Live Order Tracker ── */}
      <AnimatePresence>
        {orderId && orderStatus && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 mt-4 rounded-3xl overflow-hidden shadow-lg">
            <div className="bg-white border border-gray-100 rounded-3xl p-4 space-y-3">
              {/* Title + status badge */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-extrabold text-gray-900 flex items-center gap-2 text-sm">
                  ✅ {tr.trackerTitle}
                </span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  orderStatus === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700'
                  : orderStatus === 'PREPARING' ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
                }`}>
                  {orderStatus === 'PENDING' ? tr.pending : orderStatus === 'PREPARING' ? tr.preparing : tr.delivered}
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-1">
                {(['PENDING', 'PREPARING', 'DELIVERED'] as const).map((s, i) => (
                  <div key={s} className="flex-1 flex items-center gap-1">
                    <div className={`flex-1 h-1.5 rounded-full transition-all duration-700 ${
                      orderStatus === 'PENDING'   && i === 0 ? 'bg-blue-400'
                      : orderStatus === 'PREPARING' && i <= 1 ? (i === 0 ? 'bg-emerald-400' : 'bg-amber-400')
                      : orderStatus === 'DELIVERED' ? 'bg-emerald-400'
                      : 'bg-gray-200'
                    }`} />
                    {i < 2 && <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      orderStatus === 'DELIVERED' ? 'bg-emerald-400'
                      : i === 0 && orderStatus === 'PREPARING' ? 'bg-amber-400'
                      : 'bg-gray-200'
                    }`} />}
                  </div>
                ))}
              </div>

              {/* Order items summary */}
              <ul className="space-y-1">
                {orderItems.map((item, i) => (
                  <li key={i} className="flex justify-between text-sm text-gray-700">
                    <span><span className="font-bold">{item.quantity}×</span> {productName(item.product)}</span>
                    <span className="text-gray-500 tabular-nums">{(item.product.price * item.quantity).toFixed(2)} {currency}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between font-extrabold text-sm border-t border-dashed border-gray-200 pt-2">
                <span>{tr.total}</span>
                <span className="text-emerald-600">{orderTotal.toFixed(2)} {currency}</span>
              </div>

              {/* Bon Appétit trigger if delivered and overlay closed */}
              {orderStatus === 'DELIVERED' && !showBonAppetit && (
                <div className="flex gap-2">
                  <button onClick={() => setShowBonAppetit(true)}
                    className="flex-1 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold py-2.5 rounded-xl text-sm shadow-md active:scale-95 transition-all">
                    🍽️ {tr.bonAppetit}
                  </button>
                  {!billRequested && (
                    <button onClick={() => setShowPayModal(true)}
                      className="flex-1 bg-gray-900 text-white font-bold py-2.5 rounded-xl text-sm shadow-md active:scale-95 transition-all">
                      {tr.requestBill}
                    </button>
                  )}
                  {billRequested && (
                    <div className="flex-1 bg-amber-50 border border-amber-300 rounded-xl py-2.5 text-center text-amber-700 font-bold text-xs">
                      🛎️ {tr.waiterWithBill}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Product list ── */}
      <main className="px-4 pt-4 pb-36 space-y-3">
        {visibleProducts.length === 0 && (
          <div className="text-center text-gray-400 py-20">
            <p className="text-4xl mb-2">🍽️</p>
            <p>{tr.noItems}</p>
          </div>
        )}
        {visibleProducts.map(product => (
          <ProductCard key={product.id} product={product} currency={currency}
            name={productName(product)}
            cartQty={cart.find(i => i.product.id === product.id)?.quantity ?? 0}
            onAdd={() => addToCart(product)}
            onUpdateQty={qty => updateQty(product.id, qty)}
            liked={!!likedProducts[product.id]}
            likesCount={localLikeCounts[product.id] ?? product.likesCount ?? 0}
            onLike={() => handleLike(product.id, product.likesCount ?? 0)}
            onShare={() => handleShareProduct(product, productName(product))}
            likeLabel={tr.likeLabel}
            shareLabel={tr.shareLabel}
            kcalLabel={tr.kcal}
          />
        ))}
      </main>

      {/* ── Floating cart bar ── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="fixed bottom-[72px] left-4 right-4 z-20">
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowCart(true)}
              className={`w-full bg-gray-900 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-2xl ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="bg-emerald-400 text-gray-900 rounded-full px-2.5 py-0.5 text-sm font-bold">{cartCount}</span>
              <span className="font-semibold">{tr.viewCart}</span>
              <span className="font-bold">{cartTotal.toFixed(2)} {currency}</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Call Waiter FAB ── */}
      <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowWaiter(true)}
        className={`fixed bottom-5 ${isRTL ? 'left-4' : 'right-4'} z-20 bg-amber-400 text-white rounded-full w-14 h-14 flex flex-col items-center justify-center shadow-2xl`}
        aria-label="Call Waiter">
        <span className="text-xl">🔔</span>
        <span className="text-[9px] font-bold leading-none mt-0.5">WAITER</span>
      </motion.button>

      {/* ── Waiter sheet ── */}
      <Sheet open={showWaiter} onClose={() => setShowWaiter(false)} title={tr.waiterTitle} isRTL={isRTL}>
        <div className="space-y-2.5 pb-2">
          <WaiterBtn icon="🔔" label={tr.callWaiter}   sub={tr.callWaiterSub} onClick={() => notifyWaiter('call_waiter')} />
          <WaiterBtn icon="💵" label={tr.payCash}      sub={tr.payCashSub}    onClick={() => notifyWaiter('pay_cash')} />
          <WaiterBtn icon="💳" label={tr.payCard}      sub={tr.payCardSub}    onClick={() => notifyWaiter('pay_tpe')} />
          <div className="my-2 border-t border-gray-100" />
          <WaiterBtn icon="🧊" label={tr.water}        sub={tr.waterSub}      onClick={() => legacyCall('WATER', 'Extra ice / water needed')} />
          <WaiterBtn icon="❓" label={tr.question}     sub={tr.questionSub}   onClick={() => legacyCall('QUESTION', 'Customer has a question')} />
          <WaiterBtn icon="🧹" label={tr.clean}        sub={tr.cleanSub}      onClick={() => legacyCall('CLEAN', 'Table cleaning requested')} />
        </div>
      </Sheet>

      {/* ── Cart sheet ── */}
      <Sheet open={showCart} onClose={() => setShowCart(false)} title={tr.viewCart} isRTL={isRTL}>
        <div className="space-y-4">
          {cart.map(item => (
            <div key={item.product.id} className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{productName(item.product)}</p>
                <p className="text-emerald-600 text-sm font-semibold">{(item.product.price * item.quantity).toFixed(2)} {currency}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => updateQty(item.product.id, item.quantity - 1)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center">−</button>
                <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
                <button onClick={() => updateQty(item.product.id, item.quantity + 1)} className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-lg flex items-center justify-center">+</button>
              </div>
            </div>
          ))}
          {cart.length === 0 && <p className="text-center text-gray-400 py-8">{tr.viewCart}</p>}
        </div>
        {cart.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className={`flex justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="font-semibold text-gray-700">{tr.total}</span>
              <span className="font-bold text-xl">{cartTotal.toFixed(2)} {currency}</span>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handlePreOrder} disabled={ordering}
              className="w-full bg-gray-900 text-white rounded-2xl py-4 font-bold text-base disabled:opacity-50 shadow-lg">
              {ordering ? tr.placing : `${tr.confirmOrder} · ${cartTotal.toFixed(2)} ${currency}`}
            </motion.button>
          </div>
        )}
      </Sheet>

      {/* ── AI upsell sheet ── */}
      <Sheet open={showAI} onClose={() => { setShowAI(false); handlePlaceOrder() }} title={tr.completeOrder} isRTL={isRTL}>
        <p className="text-sm text-gray-500 mb-4">{tr.alsoLoved}</p>
        <div className="space-y-3">
          {upsells.map(p => (
            <motion.div key={p.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-3">
              {p.imageUrl && <img src={p.imageUrl} alt={productName(p)} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{productName(p)}</p>
                <p className="text-emerald-600 font-bold text-sm mt-0.5">+{p.price.toFixed(2)} {currency}</p>
              </div>
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => { addToCart(p); setUpsells(u => u.filter(x => x.id !== p.id)) }}
                className="bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-sm font-bold shadow-sm">
                +
              </motion.button>
            </motion.div>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={() => { setShowAI(false); handlePlaceOrder() }}
            className="flex-1 border-2 border-gray-200 text-gray-600 rounded-2xl py-3.5 font-semibold text-sm">{tr.skip}</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setShowAI(false); handlePlaceOrder() }}
            className="flex-[2] bg-gray-900 text-white rounded-2xl py-3.5 font-bold text-sm shadow-md">{tr.placeOrder}</motion.button>
        </div>
      </Sheet>

      {/* ── Pay method modal ── */}
      <Sheet open={showPayModal} onClose={() => setShowPayModal(false)} title={tr.choosePayMethod} isRTL={isRTL}>
        <div className="space-y-3 pb-2">
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => requestBill('pay_cash')}
            className="w-full flex items-center gap-4 bg-emerald-50 border-2 border-emerald-200 active:bg-emerald-100 rounded-2xl px-5 py-4 text-left transition-colors">
            <span className="text-4xl flex-shrink-0">💵</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base">{tr.payCash}</p>
              <p className="text-sm text-gray-400 mt-0.5">{tr.payCashSub}</p>
            </div>
            <span className="text-gray-300 text-2xl flex-shrink-0">›</span>
          </motion.button>

          <motion.button whileTap={{ scale: 0.97 }} onClick={() => requestBill('pay_tpe')}
            className="w-full flex items-center gap-4 bg-blue-50 border-2 border-blue-200 active:bg-blue-100 rounded-2xl px-5 py-4 text-left transition-colors">
            <span className="text-4xl flex-shrink-0">💳</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base">{tr.payCard}</p>
              <p className="text-sm text-gray-400 mt-0.5">{tr.payCardSub}</p>
            </div>
            <span className="text-gray-300 text-2xl flex-shrink-0">›</span>
          </motion.button>
        </div>
      </Sheet>

      {/* ── Review modal ── */}
      <Sheet open={showReview} onClose={() => setShowReview(false)} title={tr.rateTitle} isRTL={isRTL}>
        {reviewDone ? (
          <div className="py-8 text-center">
            <p className="text-5xl mb-4">🙏</p>
            <p className="font-bold text-gray-800 text-lg">{tr.reviewThanks}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">{tr.rateSub}</p>
            {/* Star rating */}
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map(star => (
                <motion.button key={star} whileTap={{ scale: 0.8 }} onClick={() => setReviewRating(star)}
                  className="text-4xl transition-all duration-150"
                  style={{ filter: star <= reviewRating ? 'none' : 'grayscale(1) opacity(0.35)' }}>
                  ⭐
                </motion.button>
              ))}
            </div>
            {/* Comment */}
            <textarea
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              placeholder={tr.reviewPlaceholder}
              rows={3}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={submitReview}
              disabled={reviewRating === 0 || reviewSubmitting}
              className="w-full bg-gray-900 text-white rounded-2xl py-4 font-bold text-base disabled:opacity-40 shadow-lg">
              {reviewSubmitting ? '…' : tr.submitReview}
            </motion.button>
          </div>
        )}
      </Sheet>

      {/* ── Toast stack ── */}
      <div className="fixed top-4 left-4 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <motion.div key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl text-white ${
                t.type === 'success' ? 'bg-emerald-500' : t.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
              }`}>
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProductCard({ product, currency, name, cartQty, onAdd, onUpdateQty, liked, likesCount, onLike, onShare, likeLabel, shareLabel, kcalLabel }: {
  product: Product; currency: string; name: string; cartQty: number
  onAdd: () => void; onUpdateQty: (qty: number) => void
  liked: boolean; likesCount: number; onLike: () => void; onShare: () => void
  likeLabel: string; shareLabel: string; kcalLabel: string
}) {
  return (
    <motion.div layout className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-stretch">
        {product.imageUrl && (
          <div className="w-28 h-28 flex-shrink-0 bg-gray-100 overflow-hidden">
            <img src={product.imageUrl} alt={name} className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
        <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0">
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">{name}</p>
            {product.description && <p className="text-gray-400 text-xs mt-1 line-clamp-2 leading-relaxed">{product.description}</p>}
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <span className="font-bold text-gray-900">{product.price.toFixed(2)} <span className="text-xs font-medium text-gray-400">{currency}</span></span>
            {cartQty === 0 ? (
              <motion.button whileTap={{ scale: 0.82 }} onClick={onAdd}
                className="bg-gray-900 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl font-bold shadow-md">
                +
              </motion.button>
            ) : (
              <div className="flex items-center gap-2">
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => onUpdateQty(cartQty - 1)}
                  className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center text-lg">−</motion.button>
                <span className="w-5 text-center font-bold text-sm">{cartQty}</span>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => onUpdateQty(cartQty + 1)}
                  className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-lg">+</motion.button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Micro-interactions bar */}
      <div className="flex items-center gap-3 px-3.5 py-2 border-t border-gray-50">
        {/* Like */}
        <motion.button whileTap={{ scale: 0.82 }} onClick={onLike}
          className={`flex items-center gap-1 text-xs font-semibold transition-colors ${liked ? 'text-rose-500' : 'text-gray-400 active:text-rose-400'}`}>
          <motion.span animate={{ scale: liked ? [1, 1.4, 1] : 1 }} transition={{ duration: 0.25 }}>
            {liked ? '❤️' : '🤍'}
          </motion.span>
          <span>{likesCount > 0 ? likesCount : likeLabel}</span>
        </motion.button>
        {/* Calories */}
        {product.calories != null && product.calories > 0 && (
          <span className="flex items-center gap-1 text-xs text-orange-500 font-semibold">
            🔥 {product.calories} {kcalLabel}
          </span>
        )}
        {/* Share */}
        <motion.button whileTap={{ scale: 0.85 }} onClick={onShare}
          className="flex items-center gap-1 text-xs text-gray-400 font-semibold ml-auto">
          🔗 {shareLabel}
        </motion.button>
      </div>
    </motion.div>
  )
}

function Sheet({ open, onClose, title, isRTL, children }: {
  open: boolean; onClose: () => void; title: string; isRTL: boolean; children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/50 z-40 backdrop-blur-[2px]" />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl max-h-[90vh] overflow-y-auto"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="flex justify-center pt-3">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pt-3 pb-2">
              <h2 className="font-bold text-lg text-gray-900">{title}</h2>
            </div>
            <div className="px-5 pb-10">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function WaiterBtn({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick}
      className="w-full flex items-center gap-3.5 bg-gray-50 active:bg-gray-100 rounded-2xl px-4 py-3.5 text-left transition-colors">
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
      <span className="text-gray-300 text-lg flex-shrink-0">›</span>
    </motion.button>
  )
}

function Loader({ lang }: { lang: Lang }) {
  return (
    <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center">
      <div className="text-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-5xl mb-4 inline-block">🍽️</motion.div>
        <p className="text-gray-500 font-medium">{T[lang].menu}…</p>
      </div>
    </div>
  )
}

function InvalidQR({ tr }: { tr: { invalidTitle: string; invalidSub: string } }) {
  return (
    <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center px-8">
      <div className="text-center">
        <p className="text-5xl mb-4">⚠️</p>
        <h2 className="font-bold text-xl text-gray-800 mb-2">{tr.invalidTitle}</h2>
        <p className="text-gray-500 text-sm leading-relaxed">{tr.invalidSub}</p>
      </div>
    </div>
  )
}
