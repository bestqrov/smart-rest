/**
 * posI18n — 4-language translations for POS / Waiter / Supervisor interfaces.
 * Languages: Arabic (ar · RTL), French (fr), English (en), Spanish (es).
 */

export type Lang = 'ar' | 'fr' | 'en' | 'es'
export const POS_LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'ar', label: 'العربية', flag: '🇲🇦' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'es', label: 'Español',  flag: '🇪🇸' },
]

export function isRTL(lang: Lang) { return lang === 'ar' }

export function getLang(): Lang {
  if (typeof window === 'undefined') return 'ar'
  const stored = localStorage.getItem('posLang') as Lang | null
  if (stored && ['ar','fr','en','es'].includes(stored)) return stored
  return 'ar'
}
export function setLang(lang: Lang) {
  if (typeof window !== 'undefined') localStorage.setItem('posLang', lang)
}

// ─── Translations ─────────────────────────────────────────────────────────────

const T = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  pin_title:       { ar: 'تسجيل الدخول', fr: 'Connexion', en: 'Sign In', es: 'Iniciar sesión' },
  pin_subtitle:    { ar: 'أدخل كود المطعم وكودك الشخصي', fr: 'Entrez le code resto et votre PIN', en: 'Enter the venue code and your PIN', es: 'Ingresa el código del local y tu PIN' },
  pin_subdomain:   { ar: 'كود المطعم', fr: 'Code du restaurant', en: 'Venue code', es: 'Código del local' },
  pin_code:        { ar: 'كود PIN', fr: 'Code PIN', en: 'PIN code', es: 'Código PIN' },
  pin_enter:       { ar: 'دخول', fr: 'Entrer', en: 'Enter', es: 'Entrar' },
  pin_logging:     { ar: 'جارٍ الدخول…', fr: 'Connexion…', en: 'Signing in…', es: 'Iniciando…' },
  // ── Navigation ───────────────────────────────────────────────────────────
  nav_tables:      { ar: 'الطاولات', fr: 'Tables', en: 'Tables', es: 'Mesas' },
  nav_menu:        { ar: 'القائمة', fr: 'Menu', en: 'Menu', es: 'Menú' },
  nav_order:       { ar: 'الطلب', fr: 'Commande', en: 'Order', es: 'Pedido' },
  nav_logout:      { ar: 'خروج', fr: 'Déconnexion', en: 'Logout', es: 'Salir' },
  nav_today:       { ar: 'اليوم', fr: "Aujourd'hui", en: 'Today', es: 'Hoy' },
  today_empty:     { ar: 'لا يوجد طلبات منتهية اليوم بعد', fr: "Aucune commande terminée aujourd'hui", en: 'No finished orders yet today', es: 'Ningún pedido terminado hoy todavía' },
  today_cash_open: { ar: 'رصيد بداية الوردية', fr: 'Fond de caisse', en: 'Opening float', es: 'Fondo de caja' },
  today_cash_in:   { ar: 'الكاش المجموع', fr: 'Espèces collectées', en: 'Cash collected', es: 'Efectivo cobrado' },
  // ── Tables ───────────────────────────────────────────────────────────────
  table:           { ar: 'طاولة', fr: 'Table', en: 'Table', es: 'Mesa' },
  table_empty:     { ar: 'فارغة', fr: 'Libre', en: 'Empty', es: 'Libre' },
  table_qr:        { ar: 'طلب QR', fr: 'Commande QR', en: 'QR Order', es: 'Pedido QR' },
  table_manual:    { ar: 'طلب يدوي', fr: 'Commande manuelle', en: 'Manual Order', es: 'Pedido manual' },
  table_bill:      { ar: 'طلب الحساب', fr: 'Addition demandée', en: 'Bill Requested', es: 'Pedir cuenta' },
  table_inactive:  { ar: 'غير نشطة', fr: 'Inactive', en: 'Inactive', es: 'Inactiva' },
  seats:           { ar: 'مقاعد', fr: 'sièges', en: 'seats', es: 'asientos' },
  open_since:      { ar: 'مفتوحة منذ', fr: 'Ouverte depuis', en: 'Open since', es: 'Abierta desde' },
  no_orders:       { ar: 'لا طلبات', fr: 'Pas de commandes', en: 'No orders', es: 'Sin pedidos' },
  // ── Order / Bill ─────────────────────────────────────────────────────────
  total:           { ar: 'المجموع', fr: 'Total', en: 'Total', es: 'Total' },
  qty:             { ar: 'الكمية', fr: 'Qté', en: 'Qty', es: 'Cant.' },
  item:            { ar: 'الصنف', fr: 'Article', en: 'Item', es: 'Artículo' },
  price:           { ar: 'السعر', fr: 'Prix', en: 'Price', es: 'Precio' },
  notes:           { ar: 'ملاحظات', fr: 'Notes', en: 'Notes', es: 'Notas' },
  add_to_order:    { ar: 'أضف للطلب', fr: 'Ajouter', en: 'Add to order', es: 'Agregar' },
  submit_order:    { ar: 'إرسال الطلب', fr: 'Envoyer la commande', en: 'Submit order', es: 'Enviar pedido' },
  submitting:      { ar: 'جارٍ الإرسال…', fr: 'Envoi…', en: 'Submitting…', es: 'Enviando…' },
  order_sent:      { ar: 'تم إرسال الطلب', fr: 'Commande envoyée', en: 'Order sent', es: 'Pedido enviado' },
  cart_empty:      { ar: 'السلة فارغة', fr: 'Panier vide', en: 'Cart is empty', es: 'Carrito vacío' },
  browse_menu:     { ar: 'تصفح القائمة لإضافة أصناف', fr: 'Parcourez le menu pour ajouter des articles', en: 'Browse the menu to add items', es: 'Navega el menú para agregar artículos' },
  // ── Payment ──────────────────────────────────────────────────────────────
  pay_cash:        { ar: 'نقداً', fr: 'Espèces', en: 'Cash', es: 'Efectivo' },
  pay_card:        { ar: 'بطاقة', fr: 'Carte', en: 'Card', es: 'Tarjeta' },
  pay_online:      { ar: 'إلكتروني', fr: 'En ligne', en: 'Online', es: 'En línea' },
  cash_given:      { ar: 'المبلغ المعطى', fr: 'Montant reçu', en: 'Amount given', es: 'Monto dado' },
  change:          { ar: 'الباقي', fr: 'Monnaie', en: 'Change', es: 'Cambio' },
  print_receipt:   { ar: 'طباعة + دفع', fr: 'Imprimer + Payer', en: 'Print + Pay', es: 'Imprimir + Pagar' },
  pay_now:         { ar: 'دفع فقط', fr: 'Payer seulement', en: 'Pay only', es: 'Solo pagar' },
  processing:      { ar: 'جارٍ المعالجة…', fr: 'En cours…', en: 'Processing…', es: 'Procesando…' },
  paid_success:    { ar: 'تم الدفع بنجاح', fr: 'Paiement enregistré', en: 'Payment recorded', es: 'Pago registrado' },
  // ── Supervisor ───────────────────────────────────────────────────────────
  supervisor:      { ar: 'المشرف', fr: 'Superviseur', en: 'Supervisor', es: 'Supervisor' },
  all_tables:      { ar: 'كل الطاولات', fr: 'Toutes les tables', en: 'All tables', es: 'Todas las mesas' },
  waiter:          { ar: 'الشفار', fr: 'Serveur', en: 'Waiter', es: 'Mesero' },
  alert_long:      { ar: 'مفتوحة أكثر من 90 دقيقة', fr: 'Ouverte depuis +90 min', en: 'Open for over 90 min', es: 'Abierta más de 90 min' },
  approve_checkout:{ ar: 'تأكيد الدفع', fr: 'Valider le paiement', en: 'Approve checkout', es: 'Aprobar pago' },
  daily_total:     { ar: 'إيرادات اليوم', fr: 'CA du jour', en: "Today's revenue", es: 'Ingresos hoy' },
  open_tables:     { ar: 'طاولات مفتوحة', fr: 'Tables ouvertes', en: 'Open tables', es: 'Mesas abiertas' },
  pending_bills:   { ar: 'حسابات معلقة', fr: 'Additions en attente', en: 'Pending bills', es: 'Cuentas pendientes' },
  // ── Waiter ───────────────────────────────────────────────────────────────
  my_tables:       { ar: 'طاولاتي', fr: 'Mes tables', en: 'My tables', es: 'Mis mesas' },
  take_order:      { ar: 'أخذ طلب', fr: 'Prendre commande', en: 'Take order', es: 'Tomar pedido' },
  notifications:   { ar: 'الإشعارات', fr: 'Notifications', en: 'Notifications', es: 'Notificaciones' },
  select_table:    { ar: 'اختر الطاولة', fr: 'Choisir une table', en: 'Select table', es: 'Seleccionar mesa' },
  split_bill:      { ar: 'تقسيم الحساب', fr: "Partager l'addition", en: 'Split Bill', es: 'Dividir cuenta' },
  payment_done:    { ar: 'تم الدفع!', fr: 'Paiement effectué!', en: 'Done!', es: '¡Listo!' },
  no_order_yet:    { ar: 'لا طلب بعد', fr: 'Aucune commande', en: 'No order yet', es: 'Sin pedido' },
  short_amount:    { ar: 'ناقص', fr: 'Manque', en: 'Short', es: 'Falta' },
  // ── Generic ──────────────────────────────────────────────────────────────
  loading:         { ar: 'جارٍ التحميل…', fr: 'Chargement…', en: 'Loading…', es: 'Cargando…' },
  error_generic:   { ar: 'حدث خطأ', fr: 'Une erreur est survenue', en: 'An error occurred', es: 'Ocurrió un error' },
  confirm:         { ar: 'تأكيد', fr: 'Confirmer', en: 'Confirm', es: 'Confirmar' },
  cancel:          { ar: 'إلغاء', fr: 'Annuler', en: 'Cancel', es: 'Cancelar' },
  min:             { ar: 'د', fr: 'min', en: 'min', es: 'min' },
  hr:              { ar: 'س', fr: 'h', en: 'h', es: 'h' },
} as const

type Key = keyof typeof T

export function tr(key: Key, lang: Lang): string {
  const entry = T[key] as Record<Lang, string>
  return entry[lang] ?? entry.en ?? key
}

export default T
