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
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { Armchair, Bell, Clock, QrCode, Receipt, Search, ShoppingBag, X, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  BottomSheet, SheetHeader, StatusScreen, MenuSkeleton, LangSwitch, ProductRow, ProductSheet,
  EmptySearch, Toast, brandVars, stripEmoji, haptic,
} from './GuestUI'
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
    invalidSub: 'This code has expired or is no longer valid. Rescan the QR on your table, or ask a staff member for a new one.',
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
    optInPhone: 'WhatsApp number ({dial}…)',
    optInName: 'Your name (optional)',
    optInConfirm: 'Yes, subscribe',
    optInSkip: 'No thanks',
    optInDone: '✅ Subscribed!',
    loyaltyCta: '🎁 Check my loyalty points',
    addToOrder: 'Add to order',
    addItem: 'Add',
    removeItem: 'Remove one',
    clearSearch: 'Clear search',
    noItemsSub: 'Try another word or browse the categories.',
    noteLabel: 'Special request',
    language: 'Language',
    close: 'Close',
    waiterShort: 'Waiter',
    billShort: 'Bill',
    back: 'Back',
    me: 'me',
    emptyHint: 'Tap + on any dish to start your order',
    items: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
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
    invalidSub: 'انتهت صلاحية هذا الرمز أو لم يعد صالحاً. امسح رمز QR الموجود على طاولتك من جديد، أو اطلب رمزاً جديداً من أحد الموظفين.',
    orderMore: 'طلب المزيد',
    requestBill: 'طلب الفاتورة 🧾',
    billMyself: 'حسابي فقط',
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
    optInSub: 'اترك رقم واتساب لتكون أول من يعلم بالعروض الخاصة.',
    optInPhone: 'رقم واتساب ({dial}…)',
    optInName: 'اسمك (اختياري)',
    optInConfirm: 'نعم، اشترك',
    optInSkip: 'لا شكراً',
    optInDone: '✅ تم الاشتراك!',
    loyaltyCta: '🎁 تحقق من نقاط الولاء الخاصة بي',
    addToOrder: 'أضف إلى الطلب',
    addItem: 'إضافة',
    removeItem: 'إزالة واحدة',
    clearSearch: 'مسح البحث',
    noItemsSub: 'جرّب كلمة أخرى أو تصفح الأقسام.',
    noteLabel: 'طلب خاص',
    language: 'اللغة',
    close: 'إغلاق',
    waiterShort: 'النادل',
    billShort: 'الحساب',
    back: 'رجوع',
    me: 'أنا',
    emptyHint: 'اضغط + على أي طبق لبدء طلبك',
    items: (n: number) => `${n} ${n === 1 ? 'صنف' : n === 2 ? 'صنفان' : n <= 10 ? 'أصناف' : 'صنفاً'}`,
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
    invalidSub: 'Ce code a expiré ou n\'est plus valide. Rescannez le QR de votre table ou demandez-en un nouveau au personnel.',
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
    optInPhone: 'Numéro WhatsApp ({dial}…)',
    optInName: 'Votre prénom (optionnel)',
    optInConfirm: 'Oui, s\'abonner',
    optInSkip: 'Non merci',
    optInDone: '✅ Abonné !',
    loyaltyCta: '🎁 Voir mes points de fidélité',
    addToOrder: 'Ajouter à la commande',
    addItem: 'Ajouter',
    removeItem: 'Retirer un',
    clearSearch: 'Effacer la recherche',
    noItemsSub: 'Essayez un autre mot ou parcourez les catégories.',
    noteLabel: 'Demande particulière',
    language: 'Langue',
    close: 'Fermer',
    waiterShort: 'Serveur',
    billShort: 'Addition',
    back: 'Retour',
    me: 'moi',
    emptyHint: 'Touchez + sur un plat pour commencer',
    items: (n: number) => `${n} article${n > 1 ? 's' : ''}`,
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
    invalidSub: 'Este código ha caducado o ya no es válido. Vuelve a escanear el QR de tu mesa o pide uno nuevo al personal.',
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
    optInPhone: 'Número WhatsApp ({dial}…)',
    optInName: 'Tu nombre (opcional)',
    optInConfirm: 'Sí, suscribirme',
    optInSkip: 'No gracias',
    optInDone: '✅ ¡Suscrito!',
    loyaltyCta: '🎁 Ver mis puntos de fidelidad',
    addToOrder: 'Añadir al pedido',
    addItem: 'Añadir',
    removeItem: 'Quitar uno',
    clearSearch: 'Borrar búsqueda',
    noItemsSub: 'Prueba otra palabra o explora las categorías.',
    noteLabel: 'Petición especial',
    language: 'Idioma',
    close: 'Cerrar',
    waiterShort: 'Mesero',
    billShort: 'Cuenta',
    back: 'Volver',
    me: 'yo',
    emptyHint: 'Toca + en un plato para empezar tu pedido',
    items: (n: number) => `${n} ${n === 1 ? 'artículo' : 'artículos'}`,
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
      onlinePayment?: boolean
    } | null
    currency: string | null
    country: string | null
  }>({ socialLinks: null, hasSocialShareAddon: false, isDemo: false, googleMapsUrl: null, tripadvisorUrl: null, paymentGateway: null, currency: null, country: null })

  const [payingOnline, setPayingOnline] = useState(false)
  const [accentColor, setAccentColor] = useState<string | null>(null)
  const [detail, setDetail] = useState<Product | null>(null)
  const [cartBump, setCartBump] = useState(0)
  const stickyRef       = useRef<HTMLDivElement | null>(null)
  const chipBarRef      = useRef<HTMLDivElement | null>(null)
  const spyLockRef      = useRef(0)
  const [stickyH, setStickyH] = useState(150)
  const socketRef       = useRef<Socket | null>(null)
  const heartbeatRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  // Latest scan for long-lived callbacks (heartbeat interval captured a stale null)
  const scanRef         = useRef<typeof scan>(null)
  useEffect(() => { scanRef.current = scan }, [scan])
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
              // Independent reads — no need to serialize them.
              await Promise.all([loadMenu(), fetchActiveOrder(cached.sessionId, lang)])
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
        // Independent reads — no need to serialize them.
        await Promise.all([loadMenu(), fetchActiveOrder(data.sessionId, lang)])
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
          // API sends the English name as `name` (+ nameAr/nameFr/nameEs); there is no nameEn,
          // which made the tracker read "2× undefined" in English and Spanish.
          name: (currentLang === 'ar' ? i.nameAr : currentLang === 'fr' ? i.nameFr : currentLang === 'es' ? i.nameEs : i.name) || i.name || i.nameAr || '',
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
        if (typeof data.accentColor === 'string') setAccentColor(data.accentColor)
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
          currency:            data.currency ?? null,
          country:             data.country ?? null,
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
        if (scanRef.current) clearSession(scanRef.current.tableId)
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

  // Product sheet: add N at once, optionally setting the line's note (same `notes` field the cart edits)
  const addToCartQty = useCallback((product: Product, qty: number, note: string) => {
    const name = lang === 'ar' ? product.nameAr : lang === 'fr' ? product.nameFr : product.nameEn
    setCart(prev => {
      const ex = prev.find(c => c.productId === product.id)
      if (ex) return prev.map(c => c.productId === product.id ? { ...c, quantity: c.quantity + qty, notes: note || c.notes } : c)
      return [...prev, { productId: product.id, name, price: product.price, quantity: qty, notes: note }]
    })
  }, [lang])

  const handleAdd = useCallback((product: Product) => {
    haptic()
    addToCart(product)
    setCartBump(b => b + 1)
  }, [addToCart])

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => {
      const ex = prev.find(c => c.productId === productId)
      if (!ex) return prev
      if (ex.quantity === 1) return prev.filter(c => c.productId !== productId)
      return prev.map(c => c.productId === productId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }, [])

  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  // Price label with the venue's currency (guests in the Gulf expect "SAR 44.00", not a bare number)
  const money = (n: number) => `${n.toFixed(2)}${cafeShare.currency ? ' ' + cafeShare.currency : ''}`
  const DIAL: Record<string, string> = { SA: '+966', AE: '+971', OM: '+968', KW: '+965', QA: '+974', BH: '+973', MA: '+212' }
  const dialCode = DIAL[cafeShare.country ?? ''] ?? '+'

  // ── Coupon (preview only — the server recomputes the discount at order time) ─
  const [couponInput, setCouponInput]   = useState('')
  const [coupon, setCoupon]             = useState<{ code: string; discount: number } | null>(null)
  const [couponErr, setCouponErr]       = useState('')
  const [couponBusy, setCouponBusy]     = useState(false)
  const CPN = {
    ar: { ph: 'كود الخصم', apply: 'تطبيق', remove: 'إزالة', discount: 'الخصم', NOT_FOUND: 'الكود غير صحيح', INACTIVE: 'الكود غير مفعّل', NOT_STARTED: 'العرض لم يبدأ بعد', EXPIRED: 'انتهت صلاحية الكود', USED_UP: 'تم استنفاد هذا الكود', MIN_ORDER: 'الحد الأدنى للطلب', err: 'تعذّر التحقق من الكود' },
    en: { ph: 'Discount code', apply: 'Apply', remove: 'Remove', discount: 'Discount', NOT_FOUND: 'Invalid code', INACTIVE: 'Code is not active', NOT_STARTED: 'Offer has not started yet', EXPIRED: 'Code has expired', USED_UP: 'Code has been fully used', MIN_ORDER: 'Minimum order', err: 'Could not check the code' },
    fr: { ph: 'Code promo', apply: 'Appliquer', remove: 'Retirer', discount: 'Remise', NOT_FOUND: 'Code invalide', INACTIVE: 'Code inactif', NOT_STARTED: "L'offre n'a pas commencé", EXPIRED: 'Code expiré', USED_UP: 'Code épuisé', MIN_ORDER: 'Commande minimum', err: 'Vérification impossible' },
    es: { ph: 'Código de descuento', apply: 'Aplicar', remove: 'Quitar', discount: 'Descuento', NOT_FOUND: 'Código inválido', INACTIVE: 'Código inactivo', NOT_STARTED: 'La oferta aún no empieza', EXPIRED: 'Código caducado', USED_UP: 'Código agotado', MIN_ORDER: 'Pedido mínimo', err: 'No se pudo verificar' },
  }[lang as 'ar' | 'en' | 'fr' | 'es'] ?? null
  function couponErrorText(code: string, minOrder?: number) {
    const c = CPN!
    const k = code.replace(/^COUPON_/, '') as keyof typeof c
    const base = (c[k] as string | undefined) ?? c.err
    return k === 'MIN_ORDER' && minOrder != null ? `${base}: ${minOrder}` : base
  }
  async function checkCoupon(code: string) {
    if (!scan || !code.trim()) return
    setCouponBusy(true); setCouponErr('')
    try {
      const r = await fetch('/api/coupons/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: scan.sessionId, code, subtotal: cartTotal }),
      })
      const d = await r.json()
      if (r.ok) setCoupon({ code: d.code, discount: d.discount })
      else { setCoupon(null); setCouponErr(couponErrorText(d.code ?? '', d.minOrder)) }
    } catch { setCouponErr(CPN!.err) }
    finally { setCouponBusy(false) }
  }
  // Keep the preview in sync when the cart changes
  useEffect(() => {
    if (coupon && cart.length) checkCoupon(coupon.code)
    if (!cart.length) { setCoupon(null); setCouponErr('') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartTotal])
  const payableTotal = Math.max(0, cartTotal - (coupon?.discount ?? 0))
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
          couponCode: coupon?.code || undefined,
        }),
      })
      const data = await r.json()

      if (r.status === 400 && typeof data.code === 'string' && data.code.startsWith('COUPON_')) {
        setCoupon(null)
        setCouponErr(couponErrorText(data.code, data.minOrder))
        return
      }

      if (r.status === 401 && data.code === 'SESSION_EXPIRED') {
        setPhase('expired')
        if (scan) clearSession(scan.tableId)
        return
      }
      if (!r.ok) { setOrderMsg(tr.failedOrder); return }

      const newOrder = { orderId: data.orderId, status: 'PENDING', items: cart.map(c => ({ productId: c.productId, name: c.name, quantity: c.quantity, status: 'PENDING' })), totalPrice: data.totalPrice ?? cartTotal, queueNumber: data.queueNumber }
      setActiveOrder(newOrder)
      sharedOrderRef.current = ''
      setCart([])
      setCoupon(null); setCouponInput(''); setCouponErr('')
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
    // Two server paths (this page used to send everything to /api/waiter-calls
    // with tableId/cafeId + lowercase types, which that endpoint rejects — so
    // every call silently failed while the guest saw "waiter on the way"):
    //   • call_waiter / pay_cash / pay_tpe → PATCH /api/orders/:id/notify-waiter
    //     (needs an open order; ownership via sessionId)
    //   • water / clean / question → POST /api/waiter-calls { tableToken, TYPE }
    //   • call_waiter with no order yet → a QUESTION call so staff still come.
    let ok = false
    const orderId = activeOrder?.orderId
    const postCall = (t: 'WATER' | 'CLEAN' | 'QUESTION', message?: string) =>
      fetch('/api/waiter-calls', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tableToken, type: t, message }),
      })
    try {
      let r: Response
      if ((type === 'call_waiter' || type === 'pay_cash' || type === 'pay_tpe') && orderId) {
        r = await fetch(`/api/orders/${orderId}/notify-waiter`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ type, sessionId: scan.sessionId }),
        })
      } else if (type === 'water' || type === 'clean' || type === 'question') {
        r = await postCall(type.toUpperCase() as 'WATER' | 'CLEAN' | 'QUESTION')
      } else {
        const note = type === 'pay_cash' ? 'pay_cash' : type === 'pay_tpe' ? 'pay_tpe' : 'call_waiter'
        r = await postCall('QUESTION', note)
      }
      ok = r.ok
    } catch {}
    // Only tell the guest a waiter is coming if the request actually reached us.
    setWaiterMsg(ok ? tr.waiterCalled : (lang === 'ar' ? '⚠️ تعذّر الإرسال، حاول مجدداً أو نادِ أحد الموظفين' : lang === 'fr' ? '⚠️ Envoi impossible, réessayez ou appelez un serveur' : lang === 'es' ? '⚠️ No se pudo enviar, inténtalo de nuevo o llama a un camarero' : '⚠️ Could not send — try again or wave to a staff member'))
    setTimeout(() => setWaiterMsg(''), ok ? 3000 : 5000)
  }

  // ── Request bill (split or full table) ───────────────────────────────────
  async function requestBill(scope: 'TABLE' | 'SEATS', seats: number[] = []) {
    if (!scan || billSending) return
    setBillSending(true)
    try {
      const r = await fetch('/api/bill-requests', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId:   scan.sessionId,
          seatNumbers: scope === 'SEATS' ? seats : [],
          payScope:    scope,
        }),
      })
      if (!r.ok) throw new Error('bill request failed')
      setBillMsg(tr.billRequested)
      setBillOpen(false)
      setBillPhase('choice')
      setBillSeats([])
      setTimeout(() => setBillMsg(''), 5000)
    } catch {
      setBillMsg((lang === 'ar' ? '⚠️ تعذّر الإرسال، حاول مجدداً أو نادِ أحد الموظفين' : lang === 'fr' ? '⚠️ Envoi impossible, réessayez ou appelez un serveur' : lang === 'es' ? '⚠️ No se pudo enviar, inténtalo de nuevo o llama a un camarero' : '⚠️ Could not send — try again or wave to a staff member'))
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

  // ── Sticky header height + category scroll-spy ───────────────────────────
  const catsRef = useRef<Category[]>([])
  catsRef.current = filteredCategories
  const spyTargetRef = useRef<string | null>(null)
  const prefersReduced = () =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const el = stickyRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setStickyH(el.offsetHeight))
    ro.observe(el)
    setStickyH(el.offsetHeight)
    return () => ro.disconnect()
  }, [phase])

  useEffect(() => {
    if (phase !== 'menu') return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const cats = catsRef.current
        if (!cats.length) return
        const line = (stickyRef.current?.offsetHeight ?? 0) + 24
        // While a chip-triggered smooth scroll runs, don't fight it
        if (spyTargetRef.current) {
          const t = document.getElementById(`cat-${spyTargetRef.current}`)
          const arrived = !t || Math.abs(t.getBoundingClientRect().top - (line - 16)) < 6
          if (!arrived && Date.now() < spyLockRef.current) return
          spyTargetRef.current = null
        }
        let current = cats[0].id
        for (const c of cats) {
          const el = document.getElementById(`cat-${c.id}`)
          if (!el) continue
          if (el.getBoundingClientRect().top - line <= 0) current = c.id
          else break
        }
        const doc = document.documentElement
        if (window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 4) current = cats[cats.length - 1].id
        setActiveCat(prev => (prev === current ? prev : current))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [phase, search])

  // Keep the active chip visible inside the horizontal chip bar
  useEffect(() => {
    const bar = chipBarRef.current
    if (!bar || !activeCat) return
    const chip = bar.querySelector<HTMLElement>(`[data-cat="${activeCat}"]`)
    if (!chip) return
    const b = bar.getBoundingClientRect()
    const c = chip.getBoundingClientRect()
    const delta = (c.left + c.width / 2) - (b.left + b.width / 2)
    if (Math.abs(delta) > 4) bar.scrollBy({ left: delta, behavior: prefersReduced() ? 'auto' : 'smooth' })
  }, [activeCat])

  function goToCategory(id: string) {
    setActiveCat(id)
    const el = document.getElementById(`cat-${id}`)
    if (!el) return
    const offset = (stickyRef.current?.offsetHeight ?? stickyH) + 8
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    spyTargetRef.current = id
    spyLockRef.current = Date.now() + 1200
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReduced() ? 'auto' : 'smooth' })
  }

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

  // ── Pay the bill online — restaurant's own Tap / Moyasar / Stripe account ─
  async function payOnline() {
    if (!scan || payingOnline) return
    setPayingOnline(true)
    try {
      const r = await fetch('/api/payment/online/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId: scan.sessionId }),
      })
      const data = await r.json()
      if (r.ok && data.redirectUrl) {
        try { localStorage.setItem('sm_pay_return', window.location.pathname + window.location.search) } catch {}
        window.location.href = data.redirectUrl
        return
      }
      setBillMsg(data.code === 'NOTHING_TO_PAY'
        ? (isRTL ? 'لا توجد طلبات غير مدفوعة' : lang === 'fr' ? 'Aucune commande à payer' : 'Nothing left to pay')
        : (isRTL ? 'تعذّر بدء الدفع، حاول مجدداً' : lang === 'fr' ? 'Paiement indisponible, réessayez' : 'Could not start payment, try again'))
      setTimeout(() => setBillMsg(''), 4000)
    } catch {
      setBillMsg(isRTL ? 'تعذّر بدء الدفع، حاول مجدداً' : 'Could not start payment, try again')
      setTimeout(() => setBillMsg(''), 4000)
    } finally {
      setPayingOnline(false)
    }
  }

  // ── Dynamic payment options — built from paymentGateway config ───────────
  const pg = cafeShare.paymentGateway
  const paymentOptions: { emoji: string; label: string; sub: string; action: () => void }[] = [
    ...(pg?.onlinePayment ? [{
      emoji: '📱',
      label: isRTL ? 'ادفع الآن من هاتفك' : lang === 'fr' ? 'Payer maintenant' : 'Pay now on your phone',
      sub:   payingOnline
        ? (isRTL ? 'جارٍ التحويل…' : lang === 'fr' ? 'Redirection…' : 'Redirecting…')
        : 'mada · Apple Pay · Visa / Mastercard',
      action: () => { payOnline() },
    }] : []),
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

  const brandStyle = brandVars(accentColor)
  const dir: 'rtl' | 'ltr' = isRTL ? 'rtl' : 'ltr'
  const pName = (p: { nameAr: string; nameEn: string; nameFr: string }) =>
    lang === 'ar' ? p.nameAr : lang === 'fr' ? p.nameFr : p.nameEn

  // Scanning / loading — skeleton of the menu instead of a blank spinner
  if (phase === 'scanning') {
    return <div style={brandStyle}><MenuSkeleton label={tr.scanningTitle} dir={dir} /></div>
  }

  // Table full
  if (phase === 'full') {
    return <div style={brandStyle}><StatusScreen dir={dir} tone="warn" icon={<Armchair size={40} />} title={tr.tableFull} sub={tr.tableFullSub} /></div>
  }

  // Session expired
  if (phase === 'expired') {
    return <div style={brandStyle}><StatusScreen dir={dir} icon={<Clock size={40} />} title={tr.sessionExpired} sub={tr.sessionExpiredSub} /></div>
  }

  // Invalid QR
  if (phase === 'invalid') {
    return <div style={brandStyle}><StatusScreen dir={dir} icon={<QrCode size={40} />} title={tr.invalidTitle} sub={tr.invalidSub} /></div>
  }

  // Welcome splash
  if (phase === 'welcome' && scan) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        style={brandStyle}
        dir={dir}
        className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center gap-6 p-6 text-center"
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', delay: 0.1, damping: 16 }}
          className="flex flex-col items-center gap-3"
        >
          {scan.cafeLogoUrl
            ? <img src={scan.cafeLogoUrl} alt={scan.cafeName} className="w-24 h-24 rounded-3xl object-contain bg-white/[0.06] ring-1 ring-white/10 shadow-2xl" />
            : <div className="w-24 h-24 rounded-3xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center"><Armchair size={44} /></div>
          }
          {scan.cafeName && <span className="text-lg font-extrabold text-white">{scan.cafeName}</span>}
        </motion.div>

        <div>
          <h1 className="text-3xl font-extrabold text-white">{tr.welcome(scan.seatNumber)}</h1>
          <p className="text-zinc-400 text-sm mt-2 max-w-xs">{tr.welcomeSub}</p>
        </div>

        {/* Seat occupancy visual */}
        <div className="flex flex-wrap justify-center gap-2 max-w-xs">
          {Array.from({ length: Math.max(scan.capacity, scan.seatNumber, scan.occupiedCount) }, (_, i) => (
            <div
              key={i}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold
                ${i + 1 === scan.seatNumber
                  ? 'bg-[var(--brand)] text-[var(--brand-fg)] ring-2 ring-[var(--brand-soft)] ring-offset-2 ring-offset-zinc-950'
                  : i + 1 <= scan.occupiedCount
                    ? 'bg-zinc-700 text-zinc-300'
                    : 'bg-zinc-800/70 text-zinc-500'
                }`}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500">{tr.scanningSeats(scan.occupiedCount, scan.capacity)}</p>

        <div className="w-10 h-1 rounded-full bg-[var(--brand)] animate-pulse motion-reduce:animate-none" />
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
        style={brandStyle}
        className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center p-8 text-center gap-6"
        dir={dir}
      >
        {/* Animated checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
          className="w-24 h-24 rounded-full bg-[var(--brand-soft)] ring-2 ring-[var(--brand)] flex items-center justify-center"
        >
          <span className="text-5xl">✅</span>
        </motion.div>

        {/* Logo + name */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-3">
          {logoUrl && (
            <img src={logoUrl} alt={cafeName} className="w-20 h-20 rounded-2xl object-contain ring-1 ring-white/10 bg-white/[0.06] shadow-xl" />
          )}
          <h1 className="text-2xl font-extrabold text-white">{tr.thankTitle(cafeName)}</h1>
          <p className="text-zinc-400 text-sm max-w-xs leading-relaxed">{tr.thankSub}</p>
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
            <p className="text-xs text-zinc-500 text-center">
              {lang === 'ar' ? '⭐ شاركنا رأيك' : lang === 'fr' ? '⭐ Laissez-nous un avis' : '⭐ Leave us a review'}
            </p>
            {cafeShare.googleMapsUrl && (
              <a href={cafeShare.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl bg-white text-gray-800 font-bold text-sm active:scale-95 transition-all shadow-lg">
                <GoogleIcon />
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
            points exist. */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
          className="w-full max-w-xs">
          <Link href={`/${subdomain}/loyalty`}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/30 text-amber-300 font-bold text-sm active:scale-95 transition-all">
            {tr.loyaltyCta}
          </Link>
        </motion.div>

        {/* Powered by */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
          className="text-xs text-zinc-600 mt-2">
          Powered by <span className="text-zinc-300 font-bold">Smart</span><span className="text-orange-500 font-bold">Restau</span>
        </motion.p>
      </motion.div>
    )
  }

  // ── Main menu ─────────────────────────────────────────────────────────────
  if (!scan) return null

  const trackerVisible = !!activeOrder && activeOrder.status !== 'DELIVERED'
  const BackIcon = isRTL ? ChevronRight : ChevronLeft
  const detailInCart = detail ? cart.find(c => c.productId === detail.id) : undefined

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white overflow-x-clip" dir={dir} style={brandStyle}>

      {/* ── Sticky header: venue + table chip + language, then search + categories ── */}
      <div ref={stickyRef} className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-xl border-b border-white/[0.05]">
        <header className="px-4 pt-3 pb-2 flex items-center gap-3">
          {scan.cafeLogoUrl ? (
            <img src={scan.cafeLogoUrl} alt="" className="w-9 h-9 rounded-xl object-contain bg-white/[0.06] ring-1 ring-white/10 shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center shrink-0"><ShoppingBag size={18} /></div>
          )}
          <div className="min-w-0 flex-1">
            {scan.cafeName && <h1 className="text-[15px] font-extrabold text-white leading-tight truncate">{scan.cafeName}</h1>}
            <p className="text-[11px] text-zinc-400 font-semibold truncate">
              {tr.table} {scan.isMerged ? scan.billingTableNumber : scan.tableNumber}
              <span className="mx-1 text-zinc-600">·</span>
              {tr.seat} {scan.seatNumber}
              {scan.isMerged && <span className="ms-1 text-amber-300">({tr.mergedWith} {scan.billingTableNumber})</span>}
            </p>
          </div>
          <LangSwitch
            lang={lang}
            langs={['ar', 'en', 'fr', 'es'] as Lang[]}
            label={tr.language}
            onChange={l => { setLang(l); localStorage.setItem('sm_lang', l) }}
          />
        </header>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search size={17} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-zinc-500 pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={tr.search}
              type="search"
              enterKeyHint="search"
              className="w-full h-11 bg-white/[0.07] text-white placeholder-zinc-500 rounded-2xl ps-10 pe-10 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)] [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label={tr.clearSearch}
                className="absolute top-1/2 -translate-y-1/2 end-2 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-zinc-300">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {filteredCategories.length > 0 && (
          <div className="relative">
            <div
              ref={chipBarRef}
              className="flex gap-2 overflow-x-auto px-4 pb-2.5 pt-0.5 overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{
                WebkitOverflowScrolling: 'touch',
                maskImage: 'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)',
              }}
            >
              {filteredCategories.map(cat => (
                <button key={cat.id} data-cat={cat.id}
                  onClick={() => goToCategory(cat.id)}
                  aria-current={activeCat === cat.id ? 'true' : undefined}
                  className={`shrink-0 h-8 px-3.5 rounded-full text-[13px] font-bold transition-colors whitespace-nowrap ${
                    activeCat === cat.id
                      ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                      : 'bg-white/[0.06] text-zinc-300 active:bg-white/10'
                  }`}>
                  {pName(cat)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {certified && (
        <div className="px-4 pt-3">
          <CertifiedBadge certified={certified} lang={lang} />
        </div>
      )}

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

      {/* ── Order tracker — floating card above bottom bar ── */}
      <AnimatePresence>
        {trackerVisible && activeOrder && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="fixed inset-x-3 z-[25] mx-auto max-w-lg"
            style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))' }}
          >
            <div className="rounded-3xl bg-zinc-900/95 backdrop-blur-xl ring-1 ring-white/[0.08] shadow-2xl shadow-black/50 px-4 pt-3 pb-3.5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse motion-reduce:animate-none" />
                  <span className="text-sm font-extrabold text-white">
                    {activeOrder.status === 'PREPARING' ? tr.preparing : tr.pending}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500 min-w-0 truncate text-end">
                  {activeOrder.items.map(i => `${i.quantity}× ${i.name}`).join(' · ')}
                </span>
              </div>

              {/* Queue number — pickup counters (food trucks) instead of a table */}
              {activeOrder.queueNumber != null && (
                <div className="flex items-center justify-center gap-2 mb-3 bg-white/[0.05] rounded-2xl py-2">
                  <span className="text-xs text-zinc-400 font-semibold">
                    {lang === 'ar' ? 'رقم طلبك' : lang === 'fr' ? 'Votre numéro' : 'Your order #'}
                  </span>
                  <span className="text-2xl font-extrabold text-white tabular-nums">#{activeOrder.queueNumber}</span>
                </div>
              )}
              <LiveOrderTracker
                status={activeOrder.status}
                orderId={activeOrder.orderId}
                lang={lang}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toasts ── */}
      <Toast msg={billMsg} tone={billMsg.startsWith('⚠️') ? 'error' : 'info'} />
      <Toast msg={orderMsg} />

      {/* ── Menu ── */}
      <main className="px-4 pt-4 space-y-7" style={{ paddingBottom: trackerVisible ? 300 : 128 }}>
        {filteredCategories.length === 0 && (
          search
            ? <EmptySearch title={tr.noItems} sub={tr.noItemsSub} clearLabel={tr.clearSearch} onClear={() => setSearch('')} />
            : <p className="text-center text-zinc-500 py-12">{tr.noItems}</p>
        )}
        {filteredCategories.map(cat => (
          <section key={cat.id} id={`cat-${cat.id}`} style={{ scrollMarginTop: stickyH + 8 }}>
            <h2 className="text-base font-extrabold text-white mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-[var(--brand)]" />
              {pName(cat)}
            </h2>
            <div className="space-y-2.5">
              {cat.products.filter(p => p.isAvailable).map(product => {
                const inCart = cart.find(c => c.productId === product.id)
                return (
                  <ProductRow
                    key={product.id}
                    name={pName(product)}
                    description={product.description}
                    price={money(product.price)}
                    imageUrl={product.imageUrl}
                    qty={inCart?.quantity ?? 0}
                    onOpen={() => setDetail(product)}
                    onAdd={() => handleAdd(product)}
                    onRemove={() => removeFromCart(product.id)}
                    addLabel={tr.addItem}
                    removeLabel={tr.removeItem}
                  />
                )
              })}
            </div>
          </section>
        ))}

        {/* ── Footer — single, subtle brand mention ── */}
        <p className="text-center text-[10px] text-zinc-600 font-medium tracking-wider pt-2">
          Powered by <span className="text-zinc-400 font-bold">Smart</span><span className="text-orange-500/70 font-bold">Restau</span> · © {new Date().getFullYear()}
        </p>
      </main>

      {/* ── Bottom bar ── */}
      <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-none">
        <div className="mx-auto max-w-lg px-3 pt-6 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent"
          style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
          {cartCount === 0 && !trackerVisible && (
            <p className="text-center text-[11px] text-zinc-500 mb-2">{tr.emptyHint}</p>
          )}
          <div className="flex gap-2 pointer-events-auto">
            <button onClick={() => setWaiterOpen(true)} aria-label={stripEmoji(tr.callWaiter)}
              className={`h-14 rounded-2xl bg-zinc-800/95 ring-1 ring-white/[0.06] flex items-center justify-center gap-2 text-zinc-100 active:scale-95 transition-transform ${cartCount > 0 ? 'w-14 flex-col gap-0.5' : 'flex-1'}`}>
              <Bell size={cartCount > 0 ? 18 : 18} />
              <span className={cartCount > 0 ? 'text-[10px] text-zinc-400 leading-none' : 'text-sm font-bold'}>{tr.waiterShort}</span>
            </button>

            <button onClick={openBillModal} aria-label={stripEmoji(tr.requestBill)}
              className={`h-14 rounded-2xl bg-zinc-800/95 ring-1 ring-white/[0.06] flex items-center justify-center gap-2 text-zinc-100 active:scale-95 transition-transform ${cartCount > 0 ? 'w-14 flex-col gap-0.5' : 'flex-1'}`}>
              <Receipt size={18} />
              <span className={cartCount > 0 ? 'text-[10px] text-zinc-400 leading-none' : 'text-sm font-bold'}>{tr.billShort}</span>
            </button>

            <AnimatePresence>
              {cartCount > 0 && (
                <motion.button
                  key="cart"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setCartOpen(true)}
                  className="flex-1 min-w-0 h-14 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] font-bold text-sm flex items-center gap-3 ps-2 pe-4 shadow-xl shadow-black/40 active:scale-[0.98] transition-transform"
                >
                  <motion.span
                    key={cartBump}
                    initial={{ scale: 1.35 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    className="relative w-10 h-10 shrink-0 rounded-full bg-black/15 flex items-center justify-center"
                  >
                    <ShoppingBag size={18} />
                    <span className="absolute -top-1 -end-1 min-w-[20px] h-5 px-1 rounded-full bg-white text-zinc-900 text-[11px] font-extrabold flex items-center justify-center tabular-nums">{cartCount}</span>
                  </motion.span>
                  <span className="flex-1 min-w-0 truncate text-start">{tr.viewCart}</span>
                  <span className="font-extrabold tabular-nums shrink-0">{money(cartTotal)}</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Product detail sheet ── */}
      <ProductSheet
        product={detail ? { id: detail.id, name: pName(detail), description: detail.description, imageUrl: detail.imageUrl, price: detail.price } : null}
        onClose={() => setDetail(null)}
        onConfirm={(qty, note) => {
          if (detail) { haptic(); addToCartQty(detail, qty, note); setCartBump(b => b + 1) }
          setDetail(null)
        }}
        money={money}
        initialNote={detailInCart?.notes ?? ''}
        labels={{ addToOrder: tr.addToOrder, note: tr.noteLabel, notePlaceholder: tr.notePlaceholder, add: tr.addItem, remove: tr.removeItem, close: tr.close }}
      />

      {/* ── Cart sheet ── */}
      <BottomSheet open={cartOpen} onClose={() => setCartOpen(false)} ariaLabel={tr.viewCart}>
        <SheetHeader title={tr.viewCart} sub={tr.items(cartCount)} onClose={() => setCartOpen(false)} closeLabel={tr.close} />
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5">
          <div className="divide-y divide-white/[0.05]">
            {cart.map(item => (
              <div key={item.productId} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-white truncate">{item.name}</p>
                    <p className="text-xs text-[var(--brand-text)] font-bold tabular-nums mt-0.5">{money(item.price * item.quantity)}</p>
                  </div>
                  <div className="h-9 flex items-center rounded-full bg-white/[0.08] shrink-0">
                    <button onClick={() => removeFromCart(item.productId)} aria-label={tr.removeItem}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-200 active:scale-90 transition-transform">−</button>
                    <span className="min-w-[1.25rem] text-center font-extrabold text-sm tabular-nums">{item.quantity}</span>
                    <button onClick={() => setCart(prev => prev.map(c => c.productId === item.productId ? { ...c, quantity: c.quantity + 1 } : c))} aria-label={tr.addItem}
                      className="w-9 h-9 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] flex items-center justify-center font-bold active:scale-90 transition-transform">+</button>
                  </div>
                </div>
                <input
                  value={item.notes}
                  onChange={e => setCart(prev => prev.map(c => c.productId === item.productId ? { ...c, notes: e.target.value } : c))}
                  placeholder={tr.notePlaceholder}
                  maxLength={140}
                  className="mt-2 w-full bg-white/[0.05] text-white placeholder-zinc-500 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="shrink-0 px-5 pt-3 pb-4 border-t border-white/[0.05] space-y-3">
          {CPN && (
            <div>
              {coupon ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--brand-text)] font-bold">🏷️ {coupon.code} · {CPN.discount} −{coupon.discount.toFixed(2)}</span>
                  <button onClick={() => { setCoupon(null); setCouponInput('') }} className="text-xs text-zinc-400 underline">{CPN.remove}</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={couponInput} onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponErr('') }}
                    placeholder={CPN.ph} maxLength={20} dir="ltr"
                    className="flex-1 min-w-0 bg-white/[0.06] text-white placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm uppercase outline-none focus:ring-2 focus:ring-[var(--brand)]" />
                  <button onClick={() => checkCoupon(couponInput)} disabled={couponBusy || !couponInput.trim()}
                    className="px-4 rounded-xl bg-white/10 text-white text-sm font-bold disabled:opacity-40">{CPN.apply}</button>
                </div>
              )}
              {couponErr && <p className="text-xs text-red-400 mt-1">{couponErr}</p>}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-bold text-zinc-300">{tr.total}</span>
            <span className="font-extrabold text-white text-lg tabular-nums">
              {coupon && <span className="text-zinc-500 line-through text-sm me-2">{cartTotal.toFixed(2)}</span>}
              {money(payableTotal)}
            </span>
          </div>
          <motion.button whileTap={{ scale: 0.98 }} onClick={placeOrder} disabled={placing}
            className="w-full py-3.5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] disabled:opacity-50 font-extrabold text-base">
            {placing ? tr.placing : tr.placeOrder}
          </motion.button>
        </div>
      </BottomSheet>

      {/* ── Bill sheet ── */}
      <BottomSheet open={billOpen} onClose={() => { setBillOpen(false); setBillPhase('choice') }} ariaLabel={tr.billModalTitle}>
        <div className="px-5 pb-5 overflow-y-auto">
          {billPhase === 'choice' && (
            <>
              <h3 className="font-extrabold text-lg text-white mb-4">{tr.billModalTitle}</h3>
              <div className="space-y-2.5">
                {/* Just me */}
                <button
                  onClick={() => requestBill('SEATS', [scan!.seatNumber])}
                  disabled={billSending}
                  className="w-full bg-white/[0.05] active:bg-white/[0.09] active:scale-[0.98] rounded-2xl p-4 text-start transition-all flex items-center gap-4 disabled:opacity-50"
                >
                  <span className="text-2xl w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">🙋</span>
                  <div className="min-w-0">
                    <p className="font-bold text-white">{tr.billMyself}</p>
                    <p className="text-xs text-zinc-400">{tr.billMyselfSub} — {tr.seat} {scan!.seatNumber}</p>
                  </div>
                </button>

                {/* Whole table */}
                <button
                  onClick={() => requestBill('TABLE')}
                  disabled={billSending}
                  className="w-full bg-white/[0.05] active:bg-white/[0.09] active:scale-[0.98] rounded-2xl p-4 text-start transition-all flex items-center gap-4 disabled:opacity-50"
                >
                  <span className="text-2xl w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">👨‍👩‍👧‍👦</span>
                  <div className="min-w-0">
                    <p className="font-bold text-white">{tr.billTable}</p>
                    <p className="text-xs text-zinc-400">{tr.billTableSub}</p>
                  </div>
                </button>

                {/* Choose seats */}
                {scan!.capacity > 1 && (
                  <button
                    onClick={() => setBillPhase('pick')}
                    className="w-full bg-white/[0.05] active:bg-white/[0.09] active:scale-[0.98] rounded-2xl p-4 text-start transition-all flex items-center gap-4"
                  >
                    <span className="text-2xl w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">🪑</span>
                    <div className="min-w-0">
                      <p className="font-bold text-white">{tr.billGroup}</p>
                      <p className="text-xs text-zinc-400">{tr.billGroupSub}</p>
                    </div>
                  </button>
                )}
              </div>
            </>
          )}

          {billPhase === 'pick' && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <button onClick={() => setBillPhase('choice')} aria-label={tr.back}
                  className="w-9 h-9 rounded-full bg-white/[0.07] flex items-center justify-center text-zinc-300 shrink-0">
                  <BackIcon size={18} />
                </button>
                <h3 className="font-extrabold text-lg text-white">{tr.billSeatPicker}</h3>
              </div>
              <div className="grid grid-cols-4 gap-2.5 mb-6">
                {Array.from({ length: Math.max(scan!.capacity, scan!.seatNumber, scan!.occupiedCount) }, (_, i) => i + 1).map(seat => (
                  <button
                    key={seat}
                    onClick={() => toggleBillSeat(seat)}
                    className={`h-14 rounded-2xl flex flex-col items-center justify-center text-sm font-extrabold transition-all active:scale-90
                      ${billSeats.includes(seat)
                        ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                        : seat === scan!.seatNumber
                          ? 'bg-[var(--brand-soft)] ring-1 ring-[var(--brand)] text-[var(--brand-text)]'
                          : 'bg-white/[0.06] text-zinc-300'
                      }`}
                  >
                    <span>{seat}</span>
                    {seat === scan!.seatNumber && <span className="text-[9px] mt-0.5 opacity-80">{tr.me}</span>}
                  </button>
                ))}
              </div>
              <button
                onClick={() => requestBill('SEATS', billSeats)}
                disabled={billSending || billSeats.length === 0}
                className="w-full py-3.5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] disabled:opacity-50 font-extrabold text-base active:scale-[0.98] transition-all"
              >
                {billSending ? '…' : `${tr.billConfirm} (${billSeats.length} ${tr.seat})`}
              </button>
            </>
          )}
        </div>
      </BottomSheet>

      {/* ── Waiter sheet ── */}
      <BottomSheet open={waiterOpen} onClose={() => setWaiterOpen(false)} ariaLabel={tr.waiterTitle}>
        <SheetHeader title={tr.waiterTitle} onClose={() => setWaiterOpen(false)} closeLabel={tr.close} />
        <div className="px-5 pb-5">
          {waiterMsg && <p className={`${waiterMsg.startsWith('⚠️') ? 'text-red-400' : 'text-[var(--brand-text)]'} text-sm font-bold mb-3`}>{waiterMsg}</p>}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { type: 'call_waiter' as const, emoji: '🔔', label: tr.callWaiter },
              { type: 'pay_cash'   as const, emoji: '💵', label: tr.payCash },
              { type: 'pay_tpe'   as const, emoji: '💳', label: tr.payCard },
              { type: 'water'     as const, emoji: '🧊', label: tr.water },
              { type: 'clean'     as const, emoji: '🧹', label: tr.clean },
              { type: 'question'  as const, emoji: '❓', label: tr.question },
            ].map(btn => (
              <button key={btn.type} onClick={() => callWaiter(btn.type)}
                className="bg-white/[0.05] active:bg-white/[0.09] active:scale-95 rounded-2xl p-4 text-start transition-all flex flex-col gap-2 min-h-[92px]">
                <span className="text-2xl leading-none" aria-hidden>{btn.emoji}</span>
                <span className="text-[13px] font-bold text-zinc-100 leading-tight">{stripEmoji(btn.label)}</span>
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>

      {/* ── Payment sheet ── */}
      <BottomSheet open={showPayment} onClose={() => setShowPayment(false)} z={50} ariaLabel={tr.paymentTitle}>
        <SheetHeader title={tr.paymentTitle} sub={tr.paymentSub} onClose={() => setShowPayment(false)} closeLabel={tr.close} />
        <div className="px-5 pb-5 space-y-2.5 overflow-y-auto">
          {paymentOptions.map((opt, i) => (
            <button key={i} onClick={opt.action}
              className="w-full bg-white/[0.05] active:bg-white/[0.09] active:scale-[0.98] rounded-2xl p-4 flex items-center gap-4 transition-all text-start">
              <span className="text-2xl shrink-0 w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center" aria-hidden>{opt.emoji}</span>
              <div className="min-w-0">
                <p className="font-bold text-white text-sm">{stripEmoji(opt.label)}</p>
                <p className="text-xs text-zinc-400">{opt.sub}</p>
              </div>
            </button>
          ))}
          <button onClick={() => { setShowPayment(false); openBillModal() }}
            className="w-full bg-[var(--brand-soft)] ring-1 ring-[var(--brand-soft)] active:scale-[0.98] rounded-2xl p-4 flex items-center gap-4 transition-all text-start">
            <span className="text-2xl shrink-0 w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center" aria-hidden>🧾</span>
            <div className="min-w-0">
              <p className="font-bold text-[var(--brand-text)] text-sm">{stripEmoji(tr.requestBill)}</p>
              <p className="text-xs text-zinc-400">{isRTL ? 'اختر طريقة الدفع وشارك الفاتورة' : lang === 'fr' ? 'Partager ou payer séparément' : 'Split or share the bill'}</p>
            </div>
          </button>
        </div>
      </BottomSheet>

      {/* ── WhatsApp Opt-in — shown once after first order ── */}
      <BottomSheet open={showOptIn} onClose={dismissOptIn} z={50} ariaLabel={tr.optInTitle}>
        <div className="px-6 pb-6">
          {optInDone ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-3 py-4">
              <span className="text-5xl">✅</span>
              <p className="text-white font-extrabold text-lg">{tr.optInDone}</p>
            </motion.div>
          ) : (
            <>
              <div className="mb-5">
                <p className="font-extrabold text-white text-lg">{tr.optInTitle}</p>
                <p className="text-sm text-zinc-400 mt-1">{tr.optInSub}</p>
              </div>
              <div className="space-y-3 mb-5">
                <input
                  type="tel"
                  value={optInPhone}
                  onChange={e => setOptInPhone(e.target.value)}
                  placeholder={tr.optInPhone.replace('{dial}', dialCode)}
                  inputMode="tel"
                  className="w-full bg-white/[0.06] text-white placeholder-zinc-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)] font-mono"
                />
                <input
                  type="text"
                  value={optInName}
                  onChange={e => setOptInName(e.target.value)}
                  placeholder={tr.optInName}
                  className="w-full bg-white/[0.06] text-white placeholder-zinc-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={dismissOptIn}
                  className="flex-1 py-3 rounded-full bg-white/[0.07] text-zinc-300 font-bold text-sm active:scale-95 transition-all">
                  {tr.optInSkip}
                </button>
                <button onClick={submitOptIn} disabled={!optInPhone.trim() || optInSending}
                  className="flex-[2] py-3 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] disabled:opacity-50 font-extrabold text-sm active:scale-95 transition-all">
                  {optInSending ? '…' : tr.optInConfirm}
                </button>
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      {/* ── Review prompt — shown after WhatsApp opt-in ── */}
      <BottomSheet open={showReview} onClose={() => setShowReview(false)} z={50}>
        <div className="px-6 pb-6">
          <div className="flex flex-col items-center text-center gap-2 mb-6">
            <span className="text-4xl">⭐</span>
            <p className="font-extrabold text-white text-lg">
              {lang === 'ar' ? 'أعجبك المكان؟' : lang === 'fr' ? 'Vous avez aimé ?' : 'Did you enjoy your visit?'}
            </p>
            <p className="text-sm text-zinc-400">
              {lang === 'ar' ? 'ساعدنا بتقييمك — يستغرق ثانية فقط 🙏' : lang === 'fr' ? 'Laissez-nous un avis — ça prend 10 secondes 🙏' : 'Leave a quick review — takes 10 seconds 🙏'}
            </p>
          </div>
          <div className="space-y-3 mb-4">
            {cafeShare.googleMapsUrl && (
              <a href={cafeShare.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                onClick={() => setShowReview(false)}
                className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-white text-gray-800 font-bold text-sm active:scale-95 transition-all shadow-lg">
                <GoogleIcon />
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
            className="w-full py-3 rounded-full bg-white/[0.07] text-zinc-300 font-bold text-sm active:scale-95 transition-all">
            {lang === 'ar' ? 'لاحقاً' : lang === 'fr' ? 'Plus tard' : 'Maybe later'}
          </button>
        </div>
      </BottomSheet>

      {/* ── Share sheet — triggered when order is DELIVERED ── */}
      <BottomSheet
        open={showShare}
        onClose={() => { setShowShare(false); setSelectedShareImg(null) }}
        z={50}
        style={{ height: 'calc(50dvh + env(safe-area-inset-bottom))', minHeight: '300px' }}
        ariaLabel={tr.shareDone}
      >
        <SheetHeader title={tr.shareDone} sub={tr.shareSub} onClose={() => { setShowShare(false); setSelectedShareImg(null) }} closeLabel={tr.close} />

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
        <div className="shrink-0 flex gap-3 px-5 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          {/* User-taken photo — shown first when available */}
          {userPhoto && (
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="relative">
                <img src={userPhoto} alt="photo"
                  className="w-20 h-20 rounded-2xl object-cover ring-2 ring-[var(--brand)]" />
                {/* SmartRestau branding badge */}
                <div className="absolute bottom-1 inset-x-1 bg-black/70 rounded-lg px-1 py-0.5 flex items-center justify-center gap-1">
                  <span className="text-[8px] font-black text-white leading-none">Smart</span>
                  <span className="text-[8px] font-black text-[#FF4B1F] leading-none">Resto</span>
                </div>
                <button onClick={() => setUserPhoto(null)}
                  className="absolute -top-1 -end-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                  ✕
                </button>
              </div>
              <p className="text-[10px] text-[var(--brand-text)] w-20 text-center">
                {lang === 'ar' ? '+ الشعار' : lang === 'fr' ? '+ branding' : '+ branding'}
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
                  <img src={item.imageUrl} alt={item.name} loading="lazy"
                    className={`w-20 h-20 rounded-2xl object-cover transition-all ${
                      isSelected
                        ? 'ring-2 ring-[var(--brand)]'
                        : 'ring-1 ring-white/10 opacity-70'
                    }`} />
                  {isSelected && (
                    <div className="absolute inset-0 flex items-end justify-center pb-1.5">
                      <span className="text-[10px] font-black bg-[var(--brand)] text-[var(--brand-fg)] px-1.5 py-0.5 rounded-full">✓</span>
                    </div>
                  )}
                  {item.qty > 1 && (
                    <span className="absolute -top-1 -end-1 bg-[var(--brand)] text-[var(--brand-fg)] text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                      {item.qty}
                    </span>
                  )}
                </div>
                <p className={`text-[10px] w-20 text-center truncate ${isSelected ? 'text-[var(--brand-text)] font-bold' : 'text-zinc-400'}`}>
                  {item.name}
                </p>
              </button>
            )
          })}

          {/* Cafe logo fallback */}
          {shareImages.length === 0 && !userPhoto && scan?.cafeLogoUrl && (
            <div className="shrink-0 flex flex-col items-center gap-1">
              <img src={scan.cafeLogoUrl} alt={scan.cafeName}
                className="w-20 h-20 rounded-2xl object-contain bg-white/[0.05] ring-1 ring-white/10" />
              <p className="text-[10px] text-zinc-400 w-20 text-center truncate">{scan.cafeName}</p>
            </div>
          )}

          {/* Camera button — always last */}
          <button onClick={() => cameraInputRef.current?.click()}
            className="shrink-0 flex flex-col items-center gap-1">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-zinc-600 bg-white/[0.04] flex flex-col items-center justify-center gap-1 transition-colors active:scale-95">
              <span className="text-2xl">📷</span>
              <span className="text-[10px] text-zinc-400 font-bold">
                {lang === 'ar' ? 'صوّر' : lang === 'fr' ? 'Photo' : 'Photo'}
              </span>
            </div>
          </button>
        </div>

        {/* Share buttons */}
        <div className="mt-auto px-5 pb-5 space-y-2.5">
          <button onClick={handleShare}
            className="w-full bg-[var(--brand)] text-[var(--brand-fg)] active:scale-[0.98] font-bold py-3 rounded-full flex items-center justify-center gap-2 transition-all text-sm">
            📤 {lang === 'ar' ? 'شارك مع أصدقائك' : lang === 'fr' ? 'Partager avec des amis' : 'Share with friends'}
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"
            className="w-full bg-[#25D366] active:scale-[0.98] text-white font-bold py-3 rounded-full flex items-center justify-center gap-2 text-sm">
            💬 WhatsApp
          </a>
          <button
            onClick={() => { setShowShare(false); setShowPayment(true) }}
            className="w-full bg-white/[0.07] text-zinc-100 font-bold py-3 rounded-full flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-all"
          >
            {tr.goToPay}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.5-.4-3.5z" fill="#FFC107"/>
      <path d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" fill="#FF3D00"/>
      <path d="M24 44c5.3 0 10.1-1.9 13.8-5.1l-6.4-5.4C29.4 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.1C9.4 37 16.1 44 24 44z" fill="#4CAF50"/>
      <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.4 5.4C37.4 38.6 44 33 44 24c0-1.2-.1-2.5-.4-3.5z" fill="#1976D2"/>
    </svg>
  )
}

export default function TablePage() {
  return (
    <MotionConfig reducedMotion="user">
      <Suspense fallback={
        <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin motion-reduce:animate-none" />
        </div>
      }>
        <TablePageInner />
      </Suspense>
    </MotionConfig>
  )
}
