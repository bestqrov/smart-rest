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
import Link from 'next/link'
import { io as socketIO, Socket } from 'socket.io-client'
import LiveOrderTracker from './LiveOrderTracker'
import CertifiedBadge from '../../menu/components/CertifiedBadge'
import SmartWifiCard from '../../menu/SmartWifiCard'

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
    notePlaceholder: 'Add a note (e.g. no onions)…',
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
    shareDone: '🍽️ Your order is served!',
    shareSub: 'Share your experience with friends',
    goToPay: 'Request the bill 🧾',
    thankTitle: (name: string) => `Thank you for visiting ${name}!`,
    thankSub: 'Wishing you good health and comfort. See you again soon! 🌟',
    thankBye: 'Goodbye 👋',
    paymentTitle: 'Ready to pay?',
    paymentSub: 'Choose how you would like to settle your bill.',
    optInTitle: '🎁 Get exclusive offers!',
    optInSub: 'Leave your WhatsApp to be the first to know about special deals.',
    optInPhone: 'WhatsApp number (+212…)',
    optInName: 'Your name (optional)',
    optInConfirm: 'Yes, subscribe',
    optInSkip: 'No thanks',
    optInDone: '✅ Subscribed!',
    loyaltyCta: '🎁 Check my loyalty points',
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
    notePlaceholder: 'أضف ملاحظة (مثلاً: بلا بصل)…',
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
    shareDone: '🍽️ تم تقديم طلبك!',
    shareSub: 'شارك تجربتك مع أصدقائك',
    goToPay: 'طلب الحساب 🧾',
    thankTitle: (name: string) => `شكراً على زيارة ${name}!`,
    thankSub: 'بالصحة والراحة، نتمنى لكم وقتاً ممتعاً ونراكم قريباً 🌟',
    thankBye: 'مع السلامة 👋',
    paymentTitle: 'جاهز للدفع؟',
    paymentSub: 'اختر طريقة الدفع المناسبة لك.',
    optInTitle: '🎁 احصل على عروض حصرية!',
    optInSub: 'خليّ رقم واتساب باش تكون أول من يعرف بالعروض الخاصة.',
    optInPhone: 'رقم واتساب (+212…)',
    optInName: 'اسمك (اختياري)',
    optInConfirm: 'نعم، اشترك',
    optInSkip: 'لا شكراً',
    optInDone: '✅ تم الاشتراك!',
    loyaltyCta: '🎁 تحقق من نقط الولاء ديالي',
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
    notePlaceholder: 'Ajouter une note (ex. sans oignons)…',
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
    shareDone: '🍽️ Commande servie !',
    shareSub: 'Partagez votre expérience avec vos amis',
    goToPay: "Demander l'addition 🧾",
    thankTitle: (name: string) => `Merci pour votre visite chez ${name} !`,
    thankSub: 'Nous vous souhaitons une excellente santé et un bon repos. À bientôt ! 🌟',
    thankBye: 'Au revoir 👋',
    paymentTitle: 'Prêt à payer ?',
    paymentSub: 'Choisissez votre mode de paiement.',
    optInTitle: '🎁 Recevez des offres exclusives !',
    optInSub: 'Laissez votre WhatsApp pour être le premier informé des promotions.',
    optInPhone: 'Numéro WhatsApp (+212…)',
    optInName: 'Votre prénom (optionnel)',
    optInConfirm: 'Oui, s\'abonner',
    optInSkip: 'Non merci',
    optInDone: '✅ Abonné !',
    loyaltyCta: '🎁 Voir mes points de fidélité',
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
    notePlaceholder: 'Añade una nota (ej. sin cebolla)…',
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
    shareDone: '🍽️ ¡Tu pedido ha sido servido!',
    shareSub: 'Comparte tu experiencia con amigos',
    goToPay: 'Pedir la cuenta 🧾',
    thankTitle: (name: string) => `¡Gracias por visitar ${name}!`,
    thankSub: '¡Te deseamos salud y descanso! Hasta pronto 🌟',
    thankBye: 'Adiós 👋',
    paymentTitle: '¿Listo para pagar?',
    paymentSub: 'Elige cómo quieres pagar.',
    optInTitle: '🎁 ¡Recibe ofertas exclusivas!',
    optInSub: 'Deja tu WhatsApp para ser el primero en saber de las promociones.',
    optInPhone: 'Número WhatsApp (+212…)',
    optInName: 'Tu nombre (opcional)',
    optInConfirm: 'Sí, suscribirme',
    optInSkip: 'No gracias',
    optInDone: '✅ ¡Suscrito!',
    loyaltyCta: '🎁 Ver mis puntos de fidelidad',
  },
} as const

// ─── Share message templates per dialect/region ───────────────────────────────

const SHARE_TEMPLATES: Record<string, string[]> = {
  ma: [ // Moroccan Darija
    '🔥 واو! {dish} فـ {cafe} — ما تصدقيش كيفاش كانت مزيانة! ولا فـ حياتي 🍽️\n\n{items}',
    '🤤 {cafe} ما خيّبوش — {dish} كانت خرافة! كلشي يجربها 🍽️\n\n{items}',
    '✨ هذ النهار كليت {dish} فـ {cafe} وما بقيتش نتكلم — تجربة من أروع ما كليت 🔥\n\n{items}',
    '🍽️ {cafe} عندهم {dish} تهبل — ماشي كلام، جربوها وغادي تفهمو 🤤\n\n{items}',
  ],
  dz: [ // Algerian Darija
    '🔥 واش! {dish} عند {cafe} — مكنتش نحسبش تكون هكاك! 🍽️\n\n{items}',
    '✨ جربت {dish} عند {cafe} وربي كانت قمة — نوصي بيها كاملين 🤤\n\n{items}',
    '🤤 {cafe} فاقت التوقعات — {dish} جاءت على قد الوصف وأكثر 🔥\n\n{items}',
  ],
  tn: [ // Tunisian
    '🔥 سحر! {dish} في {cafe} — مانجيمش نتخيل أحلى منها! 🍽️\n\n{items}',
    '✨ جربت {dish} في {cafe} وبصراحة كانت قمة — كل واحد يجربها 🤤\n\n{items}',
    '🤤 {cafe} ما تخيبش — {dish} جاءت تحفة 🔥\n\n{items}',
  ],
  eg: [ // Egyptian Arabic
    '🔥 يا ساتر! {dish} من {cafe} دي كانت تحفة يا جماعة 🍽️\n\n{items}',
    '🤤 جربتوا {dish} من {cafe}؟ والنبي ده تحفة الدنيا — اجربوه 🔥\n\n{items}',
    '✨ اللي ماجربش {dish} من {cafe} فاته حاجة في الدنيا 🍽️\n\n{items}',
  ],
  gulf: [ // Khaleeji Gulf Arabic
    '🔥 والله {dish} من {cafe} ما شفت أحلى منها بحياتي — جربوها 🍽️\n\n{items}',
    '🤤 جربت {dish} من {cafe} وهييت — أنصح فيها الكل بجد 🔥\n\n{items}',
    '✨ {cafe} فاقت التوقعات — {dish} كانت خيال ما يوصف 🍽️\n\n{items}',
  ],
  fr: [ // French
    '🔥 Franchement, le {dish} chez {cafe} était incroyable ! À tester absolument 🍽️\n\n{items}',
    '🤤 J\'ai testé {dish} chez {cafe} — honnêtement c\'est de loin le meilleur que j\'ai mangé ✨\n\n{items}',
    '✨ {cafe} m\'a bluffé — {dish} était parfait, je recommande les yeux fermés 🔥\n\n{items}',
    '🍽️ Coup de cœur pour le {dish} chez {cafe} — une valeur sûre à ne pas manquer 🤤\n\n{items}',
  ],
  en: [ // English
    '🔥 Just had {dish} at {cafe} and honestly it was next level 🍽️\n\n{items}',
    '🤤 If you haven\'t tried {dish} at {cafe} yet, you\'re seriously missing out ✨\n\n{items}',
    '✨ {cafe} exceeded all expectations — {dish} was absolutely incredible 🔥\n\n{items}',
    '🍽️ Best {dish} I\'ve had in a long time — {cafe} never disappoints 🤤\n\n{items}',
  ],
  es: [ // Spanish
    '🔥 ¡Acabo de probar {dish} en {cafe} y ha sido increíble! 🍽️\n\n{items}',
    '🤤 ¿Ya probaste {dish} en {cafe}? En serio, te lo estás perdiendo ✨\n\n{items}',
    '✨ {cafe} superó todas mis expectativas — {dish} estaba de otro nivel 🔥\n\n{items}',
  ],
}

function detectRegion(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (/Casablanca|Ceuta/.test(tz))                                                  return 'ma'
    if (/Algiers/.test(tz))                                                            return 'dz'
    if (/Tunis/.test(tz))                                                              return 'tn'
    if (/Cairo|Alexandria/.test(tz))                                                   return 'eg'
    if (/Dubai|Riyadh|Kuwait|Bahrain|Qatar|Muscat|Aden/.test(tz))                     return 'gulf'
    if (/Paris|Brussels|Geneva|Luxembourg|Monaco|Andorra|Lisbon|Madrid|Rome/.test(tz)) return 'fr'
    if (/Buenos_Aires|Mexico|Bogota|Lima|Santiago|Caracas/.test(tz))                   return 'es'
    return 'en'
  } catch { return 'en' }
}

function pickShareTemplate(lang: string, cafe: string, dish: string, items: string): string {
  let region = lang === 'ar' ? detectRegion() : lang
  if (!SHARE_TEMPLATES[region]) region = 'en'
  const pool = SHARE_TEMPLATES[region]
  const tpl = pool[Math.floor(Math.random() * pool.length)]
  return tpl
    .replace('{dish}', dish)
    .replace('{cafe}', cafe)
    .replace('{items}', items)
}

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
type ActiveOrder = { orderId: string; items: OrderItem[]; status: string; totalPrice: number; queueNumber?: number | null }

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
  const [phase, setPhase]         = useState<'scanning' | 'welcome' | 'menu' | 'full' | 'expired' | 'invalid' | 'thankyou'>('scanning')
  const [showPayment, setShowPayment] = useState(false)
  const [scan, setScan]           = useState<ScanResult | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [certified, setCertified]   = useState(false)
  const [wifiData, setWifiData]     = useState<{ ssid: string; password: string } | null>(null)
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
  const [activeCat,   setActiveCat]   = useState('')
  const [showShare,   setShowShare]   = useState(false)
  const [showOptIn,   setShowOptIn]   = useState(false)
  const [showReview,  setShowReview]  = useState(false)
  const [optInPhone,  setOptInPhone]  = useState('')
  const [optInName,   setOptInName]   = useState('')
  const [optInSending, setOptInSending] = useState(false)
  const [optInDone,   setOptInDone]   = useState(false)
  const [userPhoto,       setUserPhoto]       = useState<string | null>(null)
  const [selectedShareImg, setSelectedShareImg] = useState<string | null>(null)
  const [cafeShare,   setCafeShare]   = useState<{
    socialLinks: Record<string, string> | null
    hasSocialShareAddon: boolean
    isDemo: boolean
    googleMapsUrl: string | null
    tripadvisorUrl: string | null
    paymentGateway: {
      hasOrangeMoney: boolean
      hasMtnMomo: boolean
      hasWave: boolean
      moyasarPublishableKey: string | null
      hasStripe: boolean
      whatsappNumber: string | null
    } | null
  }>({ socialLinks: null, hasSocialShareAddon: false, isDemo: false, googleMapsUrl: null, tripadvisorUrl: null, paymentGateway: null })

  const socketRef       = useRef<Socket | null>(null)
  const heartbeatRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const sharedOrderRef  = useRef('')
  const cameraInputRef  = useRef<HTMLInputElement | null>(null)

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
              await fetchActiveOrder(cached.sessionId, lang)
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
        await fetchActiveOrder(data.sessionId, lang)
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

  // ── Restore active order after page refresh ───────────────────────────────
  async function fetchActiveOrder(sessionId: string, currentLang: Lang) {
    try {
      const r = await fetch(`/api/orders/session/${sessionId}/active`)
      if (!r.ok) return
      const data = await r.json()
      if (!data.order) return
      const o = data.order
      setActiveOrder({
        orderId:    o.orderId,
        status:     o.status,
        totalPrice: o.totalPrice,
        items: o.items.map((i: any) => ({
          productId: i.productId,
          name: currentLang === 'ar' ? i.nameAr : currentLang === 'fr' ? i.nameFr : i.nameEn,
          quantity:  i.quantity,
          status:    i.status,
        }))
      })
    } catch {}
  }

  async function loadMenu() {
    try {
      const r = await fetch(`/api/menu/public?tableToken=${encodeURIComponent(tableToken)}`)
      if (r.ok) {
        const data = await r.json()
        const cats: Category[] = data.categories || []
        setCategories(cats)
        if (cats.length > 0) setActiveCat(cats[0].id)
        // Already present on this same response — just wasn't read before.
        setCertified(data.certificationStatus === 'CERTIFIED')
        // Enrich scan state with logo/name (kept out of /api/qr/scan to avoid huge base64 payload)
        if (data.cafeName || data.cafeLogoUrl) {
          setScan(prev => prev ? { ...prev, cafeName: data.cafeName ?? prev.cafeName, cafeLogoUrl: data.cafeLogoUrl ?? prev.cafeLogoUrl } : prev)
        }
        setCafeShare({
          socialLinks:         data.socialLinks ?? null,
          hasSocialShareAddon: data.hasSocialShareAddon ?? false,
          isDemo:              data.isDemo ?? false,
          googleMapsUrl:       data.googleMapsUrl ?? null,
          tripadvisorUrl:      data.tripadvisorUrl ?? null,
          paymentGateway:      data.paymentGateway ?? null,
        })
      }
    } catch {}
  }

  // ── Trigger share popup when order is DELIVERED ───────────────────────────
  useEffect(() => {
    if (
      (activeOrder?.status === 'DELIVERED' || activeOrder?.status === 'READY') &&
      activeOrder.orderId !== sharedOrderRef.current
    ) {
      sharedOrderRef.current = activeOrder.orderId
      const t = setTimeout(() => setShowShare(true), 900)
      return () => clearTimeout(t)
    }
  }, [activeOrder?.status, activeOrder?.orderId])

  // ── Thank you screen when table checkout is completed ─────────────────────
  useEffect(() => {
    if (activeOrder?.status === 'COMPLETED') {
      setShowShare(false)
      setShowPayment(false)
      setPhase('thankyou')
      if (scan) clearSession(scan.tableId)
    }
  }, [activeOrder?.status, scan])

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
    // POS checkout complete → thank you screen
    socket.on('table_checked_out', () => {
      setShowShare(false)
      setShowPayment(false)
      setActiveOrder(prev => prev ? { ...prev, status: 'COMPLETED' } : prev)
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

      const newOrder = { orderId: data.orderId, status: 'PENDING', items: cart.map(c => ({ productId: c.productId, name: c.name, quantity: c.quantity, status: 'PENDING' })), totalPrice: cartTotal, queueNumber: data.queueNumber }
      setActiveOrder(newOrder)
      sharedOrderRef.current = ''
      setCart([])
      setCartOpen(false)
      setOrderMsg(tr.orderPlaced)
      setTimeout(() => setOrderMsg(''), 4000)

      // Smart WiFi — best-effort, matches legacy menu/page.tsx: the endpoint
      // only returns credentials once there's a verified active order, which
      // is exactly what just happened. A 403/404 here just means the venue
      // doesn't have Smart WiFi configured — silently ignored, same as before.
      try {
        const wifiRes = await fetch(`/api/menu/wifi?tableToken=${encodeURIComponent(tableToken)}`)
        if (wifiRes.ok) {
          const wifi = await wifiRes.json()
          if (wifi.ssid) setWifiData(wifi)
        }
      } catch {}

      // Show opt-in popup once per device (3s after order confirmation)
      const alreadyAsked = localStorage.getItem('sm_optin_asked')
      if (!alreadyAsked) {
        setTimeout(() => setShowOptIn(true), 3000)
      }
    } catch {
      setOrderMsg(tr.failedOrder)
    } finally {
      setPlacing(false)
    }
  }

  // ── Opt-in submit ─────────────────────────────────────────────────────────
  async function submitOptIn() {
    if (!optInPhone.trim() || optInSending) return
    setOptInSending(true)
    try {
      await fetch('/api/customers/optin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tableToken, phone: optInPhone.trim(), name: optInName.trim() || undefined }),
      })
      setOptInDone(true)
      localStorage.setItem('sm_optin_asked', '1')
      setTimeout(() => {
        setShowOptIn(false)
        if (cafeShare.googleMapsUrl || cafeShare.tripadvisorUrl) setShowReview(true)
      }, 1800)
    } catch {
      setShowOptIn(false)
      if (cafeShare.googleMapsUrl || cafeShare.tripadvisorUrl) setShowReview(true)
    } finally {
      setOptInSending(false)
    }
  }

  function dismissOptIn() {
    localStorage.setItem('sm_optin_asked', '1')
    setShowOptIn(false)
    if (cafeShare.googleMapsUrl || cafeShare.tripadvisorUrl) setShowReview(true)
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

  // ── Share helpers ─────────────────────────────────────────────────────────

  const shareImages = (activeOrder?.items ?? []).flatMap(item => {
    for (const cat of categories) {
      const p = cat.products.find(pr => pr.id === item.productId)
      if (p?.imageUrl) return [{ name: item.name, imageUrl: p.imageUrl, qty: item.quantity }]
    }
    return []
  })

  function buildShareText(): string {
    const items = activeOrder?.items ?? []
    const firstName = items[0]?.name ?? ''
    const cafe = scan?.cafeName ?? ''
    const allNames = items.map(i => i.name).join(' · ')
    const social = cafeShare.hasSocialShareAddon && cafeShare.socialLinks
      ? '\n' + Object.values(cafeShare.socialLinks as Record<string,string>)
          .filter(v => v && v.trim().length > 0)
          .map(v => v.trim().startsWith('http') ? v.trim() : `https://${v.trim()}`)
          .join('\n')
      : ''
    const body = pickShareTemplate(lang, cafe, firstName, allNames)
    return `${body}${social}\n\nsmartrestau.com\n#SmartRestau @smartrestau.app`
  }
  const shareText = buildShareText()

  function composeBrandedImage(
    photoDataUrl: string,
    opts: { cafeLogoUrl?: string | null; cafeName?: string; dishName?: string } = {}
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const size = 1080
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no ctx')); return }

      const photo = new Image()
      photo.crossOrigin = 'anonymous'
      photo.onload = () => {
        // Cover-crop into square
        const scale = Math.max(size / photo.width, size / photo.height)
        const sw = photo.width * scale, sh = photo.height * scale
        ctx.drawImage(photo, (size - sw) / 2, (size - sh) / 2, sw, sh)

        // Dark gradient bottom 38%
        const grad = ctx.createLinearGradient(0, size * 0.60, 0, size)
        grad.addColorStop(0, 'rgba(0,0,0,0)')
        grad.addColorStop(1, 'rgba(0,0,0,0.86)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, size, size)

        const finish = () => {
          // Bottom-left: cafe name + dish
          const bottomY = size - 52
          if (opts.cafeName) {
            ctx.font = "bold 44px -apple-system, BlinkMacSystemFont, Arial, sans-serif"
            ctx.fillStyle = 'rgba(255,255,255,0.95)'
            ctx.fillText(opts.cafeName, 48, bottomY - 48)
          }
          if (opts.dishName) {
            ctx.font = "30px -apple-system, BlinkMacSystemFont, Arial, sans-serif"
            ctx.fillStyle = 'rgba(255,255,255,0.62)'
            ctx.fillText(opts.dishName, 48, bottomY - 8)
          }

          canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob')), 'image/jpeg', 0.93)
        }

        // Restaurant logo — top-left, prominent
        if (opts.cafeLogoUrl) {
          const logo = new Image()
          logo.crossOrigin = 'anonymous'
          logo.onload = () => {
            const lsize = 96
            const pad = 32
            const cx = pad + lsize / 2, cy = pad + lsize / 2
            // White circle bg
            ctx.globalAlpha = 0.92
            ctx.beginPath()
            ctx.arc(cx, cy, lsize / 2 + 6, 0, Math.PI * 2)
            ctx.fillStyle = '#ffffff'
            ctx.fill()
            // Clip logo to circle
            ctx.save()
            ctx.beginPath()
            ctx.arc(cx, cy, lsize / 2, 0, Math.PI * 2)
            ctx.clip()
            ctx.drawImage(logo, pad, pad, lsize, lsize)
            ctx.restore()
            ctx.globalAlpha = 1
            finish()
          }
          logo.onerror = finish
          logo.src = opts.cafeLogoUrl
        } else {
          finish()
        }
      }
      photo.onerror = reject
      photo.src = photoDataUrl
    })
  }

  async function handleShare() {
    try {
      // Priority: user-taken photo → selected menu image → text only
      const photoSrc = userPhoto ?? selectedShareImg ?? null
      if (photoSrc) {
        const blob = await composeBrandedImage(photoSrc, {
          cafeLogoUrl: scan?.cafeLogoUrl ?? null,
          cafeName: scan?.cafeName ?? undefined,
          dishName: activeOrder?.items[0]?.name ?? undefined,
        })
        const file = new File([blob], 'smartrestau-dish.jpg', { type: 'image/jpeg' })
        if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: scan?.cafeName ?? 'Smart Resto', text: shareText, files: [file] })
          return
        }
      }
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: scan?.cafeName ?? 'Smart Resto', text: shareText })
      } else {
        await navigator.clipboard.writeText(shareText)
      }
    } catch {}
  }

  function handleCameraInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setUserPhoto(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── Dynamic payment options — built from paymentGateway config ───────────
  const pg = cafeShare.paymentGateway
  const paymentOptions: { emoji: string; label: string; sub: string; action: () => void }[] = [
    {
      emoji: '💵',
      label: tr.payCash,
      sub: isRTL ? 'سيأتي النادل إليك' : lang === 'fr' ? 'Le serveur viendra vous voir' : 'Waiter will come to you',
      action: () => { callWaiter('pay_cash'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
    },
    {
      emoji: '💳',
      label: tr.payCard,
      sub: isRTL ? 'TPE — سيحضر لك الجهاز' : lang === 'fr' ? 'Terminal TPE apporté à table' : 'TPE terminal brought to table',
      action: () => { callWaiter('pay_tpe'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
    },
    ...(pg?.hasStripe ? [
      {
        emoji: '🍎',
        label: 'Apple Pay',
        sub: isRTL ? 'NFC · iPhone' : 'NFC · iPhone',
        action: () => { callWaiter('pay_tpe'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
      },
      {
        emoji: '🤖',
        label: 'Google Pay',
        sub: isRTL ? 'NFC · Android' : 'NFC · Android',
        action: () => { callWaiter('pay_tpe'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
      },
    ] : []),
    ...(pg?.hasOrangeMoney ? [{
      emoji: '🟠',
      label: 'Orange Money',
      sub: isRTL ? 'دفع عبر Orange Money' : lang === 'fr' ? 'Paiement via Orange Money' : 'Pay via Orange Money',
      action: () => { callWaiter('pay_tpe'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
    }] : []),
    ...(pg?.hasMtnMomo ? [{
      emoji: '🟡',
      label: 'MTN MoMo',
      sub: isRTL ? 'دفع عبر MTN MoMo' : lang === 'fr' ? 'Paiement via MTN MoMo' : 'Pay via MTN MoMo',
      action: () => { callWaiter('pay_tpe'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
    }] : []),
    ...(pg?.hasWave ? [{
      emoji: '🔵',
      label: 'Wave',
      sub: isRTL ? 'دفع عبر Wave' : lang === 'fr' ? 'Paiement via Wave' : 'Pay via Wave',
      action: () => { callWaiter('pay_tpe'); setShowPayment(false); setBillMsg(tr.billRequested); setTimeout(() => setBillMsg(''), 4000) },
    }] : []),
  ]

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

  // ── Thank you screen ──────────────────────────────────────────────────────
  if (phase === 'thankyou') {
    const cafeName = scan?.cafeName ?? 'SmartRestau'
    const logoUrl  = scan?.cafeLogoUrl ?? null
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8 text-center gap-6"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Animated checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
          className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center"
        >
          <span className="text-5xl">✅</span>
        </motion.div>

        {/* Logo + name */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-3">
          {logoUrl && (
            <img src={logoUrl} alt={cafeName} className="w-20 h-20 rounded-2xl object-contain border border-white/10 bg-white/5 shadow-xl" />
          )}
          <h1 className="text-2xl font-black text-white">{tr.thankTitle(cafeName)}</h1>
          <p className="text-gray-400 text-sm max-w-xs leading-relaxed">{tr.thankSub}</p>
        </motion.div>

        {/* Decorative stars */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="flex gap-2 text-2xl">
          {'⭐'.repeat(5).split('').map((s, i) => (
            <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.08 }}>{s}</motion.span>
          ))}
        </motion.div>

        {/* Review buttons */}
        {(cafeShare.googleMapsUrl || cafeShare.tripadvisorUrl) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="w-full max-w-xs space-y-2.5">
            <p className="text-xs text-gray-500 text-center">
              {lang === 'ar' ? '⭐ شاركنا رأيك' : lang === 'fr' ? '⭐ Laissez-nous un avis' : '⭐ Leave us a review'}
            </p>
            {cafeShare.googleMapsUrl && (
              <a href={cafeShare.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl bg-white text-gray-800 font-bold text-sm active:scale-95 transition-all shadow-lg">
                <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                  <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.5-.4-3.5z" fill="#FFC107"/>
                  <path d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" fill="#FF3D00"/>
                  <path d="M24 44c5.3 0 10.1-1.9 13.8-5.1l-6.4-5.4C29.4 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.1C9.4 37 16.1 44 24 44z" fill="#4CAF50"/>
                  <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.4 5.4C37.4 38.6 44 33 44 24c0-1.2-.1-2.5-.4-3.5z" fill="#1976D2"/>
                </svg>
                {lang === 'ar' ? 'قيّمنا على Google' : lang === 'fr' ? 'Nous noter sur Google' : 'Rate us on Google'}
              </a>
            )}
            {cafeShare.tripadvisorUrl && (
              <a href={cafeShare.tripadvisorUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl bg-[#34e0a1] text-gray-900 font-bold text-sm active:scale-95 transition-all shadow-lg">
                <span className="text-xl">🦉</span>
                {lang === 'ar' ? 'قيّمنا على Tripadvisor' : lang === 'fr' ? 'Nous noter sur Tripadvisor' : 'Rate us on Tripadvisor'}
              </a>
            )}
          </motion.div>
        )}

        {/* Loyalty — customer just ordered, this is the moment to remind them
            points exist. The loyalty lookup page already works end-to-end
            (points/tier/profile) but had no link from anywhere a customer
            could actually reach it. */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
          className="w-full max-w-xs">
          <Link href={`/${subdomain}/loyalty`}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-sm active:scale-95 transition-all">
            {tr.loyaltyCta}
          </Link>
        </motion.div>

        {/* Powered by */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
          className="text-xs text-gray-700 mt-2">
          Powered by <span className="text-white font-bold">Smart</span><span className="text-orange-500 font-bold">Restau</span>
        </motion.p>
      </motion.div>
    )
  }

  // ── Main menu ─────────────────────────────────────────────────────────────
  if (!scan) return null

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Sticky top bar — minimal navigation ── */}
      <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full">
            {tr.table} {scan.isMerged ? scan.billingTableNumber : scan.tableNumber}
            {scan.isMerged && <span className={`${isRTL ? 'mr-1' : 'ml-1'} text-amber-400`}>({tr.mergedWith} {scan.billingTableNumber})</span>}
          </span>
          <span className="text-xs bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full font-bold">
            {tr.seat} {scan.seatNumber}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {(['ar','en','fr','es'] as Lang[]).map(l => (
            <button key={l} onClick={() => { setLang(l); localStorage.setItem('sm_lang', l) }}
              className={`text-xs px-1.5 py-0.5 rounded font-bold transition-all ${lang === l ? 'bg-emerald-500 text-white' : 'text-gray-500'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* ── Cafe hero — logo + name + branding (non-sticky, scrolls away) ── */}
      <div className="flex flex-col items-center gap-3 py-6 px-4 border-b border-gray-800/60">
        {scan.cafeLogoUrl ? (
          <img
            src={scan.cafeLogoUrl}
            alt={scan.cafeName ?? ''}
            className="w-20 h-20 rounded-2xl object-contain bg-white/5 border border-white/10 shadow-2xl"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center text-4xl shadow-2xl">🍽️</div>
        )}
        {scan.cafeName && (
          <h1 className="text-xl font-black text-white tracking-tight">{scan.cafeName}</h1>
        )}
        <CertifiedBadge certified={certified} lang={lang} />
        <p className="text-[10px] text-gray-600 font-medium tracking-widest uppercase">
          Powered by <span className="text-gray-500 font-bold">Smart</span><span className="text-orange-500/80 font-bold">Restau</span> © 2025
        </p>
      </div>

      {/* ── Smart WiFi — appears once there's a verified active order ── */}
      {wifiData && (
        <div className="px-4 pt-4">
          <SmartWifiCard
            ssid={wifiData.ssid}
            password={wifiData.password}
            onClose={() => setWifiData(null)}
          />
        </div>
      )}

      {/* ── Order tracker — floating prominent card above bottom bar ── */}
      <AnimatePresence>
        {activeOrder && activeOrder.status !== 'DELIVERED' && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="fixed left-3 right-3 z-[25] rounded-2xl overflow-hidden shadow-2xl"
            style={{ bottom: '76px' }}
          >
            {/* Pulsing glow behind card */}
            <div className={`absolute inset-0 rounded-2xl blur-xl opacity-40 -z-10 ${
              activeOrder.status === 'PREPARING' ? 'bg-amber-500' : 'bg-sky-500'
            }`} />
            <div className={`relative rounded-2xl border px-4 py-3 backdrop-blur-md ${
              activeOrder.status === 'PREPARING'
                ? 'bg-amber-950/90 border-amber-700/60'
                : 'bg-sky-950/90 border-sky-700/60'
            }`}>
              {/* Header row */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                    activeOrder.status === 'PREPARING' ? 'bg-amber-400' : 'bg-sky-400'
                  }`} />
                  <span className={`text-sm font-black ${
                    activeOrder.status === 'PREPARING' ? 'text-amber-300' : 'text-sky-300'
                  }`}>
                    {activeOrder.status === 'PREPARING' ? tr.preparing : tr.pending}
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 max-w-[55%] text-right truncate">
                  {activeOrder.items.map(i => `${i.quantity}× ${i.name}`).join(' · ')}
                </span>
              </div>

              {/* Queue number — pickup counters (food trucks) instead of a table */}
              {activeOrder.queueNumber != null && (
                <div className="flex items-center justify-center gap-2 mb-2.5 bg-black/20 rounded-xl py-2">
                  <span className="text-xs text-gray-400 font-semibold">
                    {lang === 'ar' ? 'رقم طلبك' : lang === 'fr' ? 'Votre numéro' : 'Your order #'}
                  </span>
                  <span className="text-2xl font-black text-white">#{activeOrder.queueNumber}</span>
                </div>
              )}
              <LiveOrderTracker
                status={activeOrder.status}
                orderId={activeOrder.orderId}
                lang={lang as 'ar' | 'fr' | 'en'}
              />
            </div>
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

      {/* ── Sticky search + category pills ── */}
      <div className="sticky top-[40px] z-20 bg-gray-950 border-b border-gray-800/60">
        <div className="px-4 pt-3 pb-2">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tr.search}
            className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: 'none' }}>
            {categories.map(cat => {
              const name = lang === 'ar' ? cat.nameAr : lang === 'fr' ? cat.nameFr : cat.nameEn
              return (
                <button key={cat.id}
                  onClick={() => {
                    setActiveCat(cat.id)
                    document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    activeCat === cat.id
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}>
                  {name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Menu ── */}
      <div className="pb-40 px-4 space-y-8 pt-4">
        {filteredCategories.length === 0 && (
          <p className="text-center text-gray-600 py-12">{tr.noItems}</p>
        )}
        {filteredCategories.map(cat => {
          const catName = lang === 'ar' ? cat.nameAr : lang === 'fr' ? cat.nameFr : cat.nameEn
          return (
            <section key={cat.id} id={`cat-${cat.id}`} style={{ scrollMarginTop: '120px' }}>
              <h2 className="text-sm font-black uppercase tracking-widest text-emerald-400 mb-3">{catName}</h2>
              <div className="space-y-2">
                {cat.products.filter(p => p.isAvailable).map(product => {
                  const name = lang === 'ar' ? product.nameAr : lang === 'fr' ? product.nameFr : product.nameEn
                  const inCart = cart.find(c => c.productId === product.id)
                  return (
                    <div key={product.id} className={`bg-gray-900 rounded-2xl border border-gray-800/80 overflow-hidden flex ${product.imageUrl ? 'items-stretch' : 'items-center p-3'}`}>
                      {product.imageUrl && (
                        <img src={product.imageUrl} alt={name}
                          className="w-24 h-24 object-cover shrink-0 self-stretch" />
                      )}
                      <div className={`flex-1 min-w-0 flex items-center justify-between gap-2 ${product.imageUrl ? 'p-3' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-white leading-tight">{name}</p>
                          {product.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{product.description}</p>
                          )}
                          <p className="text-emerald-400 font-black text-sm mt-1.5">{product.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {inCart ? (
                            <>
                              <button onClick={() => removeFromCart(product.id)}
                                className="w-11 h-11 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-lg leading-none active:scale-90 transition-transform">−</button>
                              <span className="text-sm font-black w-5 text-center text-white">{inCart.quantity}</span>
                              <button onClick={() => addToCart(product)}
                                className="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg leading-none active:scale-90 transition-transform">+</button>
                            </>
                          ) : (
                            <button onClick={() => addToCart(product)}
                              className="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-2xl leading-none active:scale-90 transition-transform shadow-lg shadow-emerald-500/20">+</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {/* ── Footer copyright ── */}
      <div className="text-center py-6">
        <p className="text-[10px] text-gray-700 font-medium tracking-widest uppercase">
          Powered by <span className="text-gray-600 font-bold">Smart</span><span className="text-orange-500/60 font-bold">Restau</span> · © {new Date().getFullYear()} All rights reserved
        </p>
      </div>

      {/* ── Bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gray-950/98 backdrop-blur border-t border-gray-800/80">
        {/* SmartRestau copyright bar */}
        <div className="flex items-center justify-center py-1 border-b border-gray-800/50">
          <span className="text-[9px] text-gray-700 font-medium tracking-widest">
            Powered by <span className="text-gray-600 font-bold">Smart</span><span className="text-orange-500/50 font-bold">Restau</span>
          </span>
        </div>
        <div className="p-3 flex gap-2">
        {/* Waiter button */}
        <button onClick={() => setWaiterOpen(true)}
          className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-800/80 border border-gray-700/50 flex items-center justify-center text-xl active:scale-90 transition-transform">
          🔔
        </button>

        {/* Bill button */}
        <button onClick={openBillModal}
          className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-xl active:scale-90 transition-transform">
          🧾
        </button>

        {/* Cart button */}
        <button onClick={() => cartCount > 0 && setCartOpen(true)}
          disabled={cartCount === 0}
          className={`flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-between px-4 transition-all
            ${cartCount > 0 ? 'bg-emerald-500 text-white active:scale-95 shadow-lg shadow-emerald-500/20' : 'bg-gray-800/80 text-gray-600 border border-gray-700/50'}`}
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
                  <div key={item.productId} className="pb-3 border-b border-gray-800/60 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm">{item.name}</p>
                        <p className="text-xs text-gray-400">{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeFromCart(item.productId)} className="w-11 h-11 rounded-full bg-gray-700 flex items-center justify-center font-bold active:scale-90 transition-transform">−</button>
                        <span className="w-5 text-center font-bold">{item.quantity}</span>
                        <button onClick={() => setCart(prev => prev.map(c => c.productId === item.productId ? { ...c, quantity: c.quantity + 1 } : c))} className="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-white active:scale-90 transition-transform">+</button>
                      </div>
                    </div>
                    <input
                      value={item.notes}
                      onChange={e => setCart(prev => prev.map(c => c.productId === item.productId ? { ...c, notes: e.target.value } : c))}
                      placeholder={tr.notePlaceholder}
                      maxLength={140}
                      className="mt-2 w-full bg-gray-800/60 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    />
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

      {/* ── Payment Modal ── */}
      <AnimatePresence>
        {showPayment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={() => setShowPayment(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30 }}
              className="w-full bg-gray-900 rounded-t-3xl p-5" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-black text-lg text-white">{tr.paymentTitle}</h3>
                <button onClick={() => setShowPayment(false)} className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">✕</button>
              </div>
              <p className="text-sm text-gray-400 mb-5">{tr.paymentSub}</p>
              <div className="space-y-2.5">
                {paymentOptions.map((opt, i) => (
                  <button key={i} onClick={opt.action}
                    className="w-full bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl p-4 flex items-center gap-4 transition-all">
                    <span className="text-2xl shrink-0">{opt.emoji}</span>
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <p className="font-bold text-white text-sm">{opt.label}</p>
                      <p className="text-xs text-gray-400">{opt.sub}</p>
                    </div>
                  </button>
                ))}
                <button onClick={() => { setShowPayment(false); openBillModal() }}
                  className="w-full bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 active:scale-95 rounded-2xl p-4 flex items-center gap-4 transition-all">
                  <span className="text-2xl shrink-0">🧾</span>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-bold text-blue-300 text-sm">{tr.requestBill}</p>
                    <p className="text-xs text-gray-400">{isRTL ? 'اختر طريقة الدفع وشارك الفاتورة' : lang === 'fr' ? 'Partager ou payer séparément' : 'Split or share the bill'}</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── WhatsApp Opt-in popup — shown once after first order ── */}
      <AnimatePresence>
        {showOptIn && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60" onClick={dismissOptIn} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-3xl p-6"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />

              {optInDone ? (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-3 py-4">
                  <span className="text-5xl">✅</span>
                  <p className="text-white font-black text-lg">{tr.optInDone}</p>
                </motion.div>
              ) : (
                <>
                  <div className="mb-5">
                    <p className="font-black text-white text-lg">{tr.optInTitle}</p>
                    <p className="text-sm text-gray-400 mt-1">{tr.optInSub}</p>
                  </div>
                  <div className="space-y-3 mb-5">
                    <input
                      type="tel"
                      value={optInPhone}
                      onChange={e => setOptInPhone(e.target.value)}
                      placeholder={tr.optInPhone}
                      inputMode="tel"
                      className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                    <input
                      type="text"
                      value={optInName}
                      onChange={e => setOptInName(e.target.value)}
                      placeholder={tr.optInName}
                      className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={dismissOptIn}
                      className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-bold text-sm active:scale-95 transition-all">
                      {tr.optInSkip}
                    </button>
                    <button onClick={submitOptIn} disabled={!optInPhone.trim() || optInSending}
                      className="flex-[2] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-black text-sm active:scale-95 transition-all">
                      {optInSending ? '…' : tr.optInConfirm}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Review prompt — shown after WhatsApp opt-in ── */}
      <AnimatePresence>
        {showReview && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowReview(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-3xl p-6"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />
              <div className="flex flex-col items-center text-center gap-2 mb-6">
                <span className="text-4xl">⭐</span>
                <p className="font-black text-white text-lg">
                  {lang === 'ar' ? 'أعجبك المكان؟' : lang === 'fr' ? 'Vous avez aimé ?' : 'Did you enjoy your visit?'}
                </p>
                <p className="text-sm text-gray-400">
                  {lang === 'ar' ? 'ساعدنا بتقييمك — يستغرق ثانية فقط 🙏' : lang === 'fr' ? 'Laissez-nous un avis — ça prend 10 secondes 🙏' : 'Leave a quick review — takes 10 seconds 🙏'}
                </p>
              </div>
              <div className="space-y-3 mb-4">
                {cafeShare.googleMapsUrl && (
                  <a href={cafeShare.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                    onClick={() => setShowReview(false)}
                    className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-white text-gray-800 font-bold text-sm active:scale-95 transition-all shadow-lg">
                    <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                      <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.5-.4-3.5z" fill="#FFC107"/>
                      <path d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" fill="#FF3D00"/>
                      <path d="M24 44c5.3 0 10.1-1.9 13.8-5.1l-6.4-5.4C29.4 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.1C9.4 37 16.1 44 24 44z" fill="#4CAF50"/>
                      <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.4 5.4C37.4 38.6 44 33 44 24c0-1.2-.1-2.5-.4-3.5z" fill="#1976D2"/>
                    </svg>
                    {lang === 'ar' ? 'قيّمنا على Google Maps' : lang === 'fr' ? 'Nous noter sur Google Maps' : 'Rate us on Google Maps'}
                  </a>
                )}
                {cafeShare.tripadvisorUrl && (
                  <a href={cafeShare.tripadvisorUrl} target="_blank" rel="noopener noreferrer"
                    onClick={() => setShowReview(false)}
                    className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-[#34e0a1] text-gray-900 font-bold text-sm active:scale-95 transition-all shadow-lg">
                    <span className="text-xl">🦉</span>
                    {lang === 'ar' ? 'قيّمنا على Tripadvisor' : lang === 'fr' ? 'Nous noter sur Tripadvisor' : 'Rate us on Tripadvisor'}
                  </a>
                )}
              </div>
              <button onClick={() => setShowReview(false)}
                className="w-full py-3 rounded-xl bg-gray-800 text-gray-400 font-bold text-sm active:scale-95 transition-all">
                {lang === 'ar' ? 'لاحقاً' : lang === 'fr' ? 'Plus tard' : 'Maybe later'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Share popup — triggered when order is DELIVERED ── */}
      <AnimatePresence>
        {showShare && (
          <>
            {/* Backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50" onClick={() => { setShowShare(false); setSelectedShareImg(null) }} />

            {/* Bottom sheet — 50% height */}
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-3xl flex flex-col"
              style={{ height: '50dvh', minHeight: '280px' }}
            >
              {/* Handle + header */}
              <div className="shrink-0 px-5 pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-white text-base">{tr.shareDone}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{tr.shareSub}</p>
                  </div>
                  <button onClick={() => { setShowShare(false); setSelectedShareImg(null) }}
                    className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 text-sm shrink-0">
                    ✕
                  </button>
                </div>
              </div>

              {/* Hidden camera input */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraInput}
              />

              {/* Photos row: user photo (if any) + menu images + camera button */}
              <div className="shrink-0 flex gap-3 px-5 overflow-x-auto py-2" style={{ scrollbarWidth: 'none' }}>

                {/* User-taken photo — shown first when available */}
                {userPhoto && (
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <div className="relative">
                      <img src={userPhoto} alt="photo"
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500 ring-2 ring-emerald-500/30" />
                      {/* SmartRestau branding badge */}
                      <div className="absolute bottom-1 left-1 right-1 bg-black/70 rounded-lg px-1 py-0.5 flex items-center justify-center gap-1">
                        <span className="text-[8px] font-black text-white leading-none">Smart</span>
                        <span className="text-[8px] font-black text-[#FF4B1F] leading-none">Resto</span>
                      </div>
                      <button onClick={() => setUserPhoto(null)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                        ✕
                      </button>
                    </div>
                    <p className="text-[10px] text-emerald-400 w-20 text-center">
                      {lang === 'ar' ? '+ برندينغ' : lang === 'fr' ? '+ branding' : '+ branding'}
                    </p>
                  </div>
                )}

                {/* Menu item images — selectable */}
                {shareImages.map((item, idx) => {
                  const isSelected = selectedShareImg === item.imageUrl
                  return (
                    <button key={idx} onClick={() => setSelectedShareImg(isSelected ? null : item.imageUrl)}
                      className="shrink-0 flex flex-col items-center gap-1 active:scale-95 transition-transform">
                      <div className="relative">
                        <img src={item.imageUrl} alt={item.name}
                          className={`w-20 h-20 rounded-2xl object-cover transition-all ${
                            isSelected
                              ? 'border-2 border-emerald-400 ring-2 ring-emerald-400/40'
                              : 'border border-gray-700 opacity-70'
                          }`} />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-end justify-center pb-1.5">
                            <span className="text-[10px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">✓</span>
                          </div>
                        )}
                        {item.qty > 1 && (
                          <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                            {item.qty}
                          </span>
                        )}
                      </div>
                      <p className={`text-[10px] w-20 text-center truncate ${isSelected ? 'text-emerald-400 font-bold' : 'text-gray-400'}`}>
                        {item.name}
                      </p>
                    </button>
                  )
                })}

                {/* Cafe logo fallback */}
                {shareImages.length === 0 && !userPhoto && scan?.cafeLogoUrl && (
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <img src={scan.cafeLogoUrl} alt={scan.cafeName}
                      className="w-20 h-20 rounded-2xl object-contain bg-white/5 border border-gray-700" />
                    <p className="text-[10px] text-gray-400 w-20 text-center truncate">{scan.cafeName}</p>
                  </div>
                )}

                {/* Camera button — always last */}
                <button onClick={() => cameraInputRef.current?.click()}
                  className="shrink-0 flex flex-col items-center gap-1">
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-600 hover:border-emerald-500 bg-gray-800/60 flex flex-col items-center justify-center gap-1 transition-colors active:scale-95">
                    <span className="text-2xl">📷</span>
                    <span className="text-[10px] text-gray-400 font-bold">
                      {lang === 'ar' ? 'صوّر' : lang === 'fr' ? 'Photo' : 'Photo'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Share buttons */}
              <div className="mt-auto px-5 pb-6 space-y-2.5">
                <button onClick={handleShare}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all text-sm">
                  📤 {lang === 'ar' ? 'شارك مع أصدقائك' : lang === 'fr' ? 'Partager avec des amis' : 'Share with friends'}
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"
                  className="w-full bg-[#25D366] active:scale-95 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 text-sm">
                  💬 WhatsApp
                </a>
                <button
                  onClick={() => { setShowShare(false); setShowPayment(true) }}
                  className="w-full bg-blue-600/20 border border-blue-500/40 text-blue-300 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 text-sm active:scale-95 transition-all"
                >
                  {tr.goToPay}
                </button>
              </div>
            </motion.div>
          </>
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
