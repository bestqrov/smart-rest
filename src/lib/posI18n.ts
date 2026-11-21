/**
 * posI18n — 4-language translations for POS / Waiter / Supervisor interfaces.
 * Languages: Arabic (ar · RTL), French (fr), English (en), Spanish (es).
 */

export type Lang = 'ar' | 'fr' | 'en' | 'es'
// `flag` is a short text badge, not a country flag: Arabic is spoken across
// many markets (Gulf, Maghreb…), so a single country's flag is wrong for it.
export const POS_LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'ar', label: 'العربية', flag: 'ع' },
  { code: 'fr', label: 'Français', flag: 'FR' },
  { code: 'en', label: 'English',  flag: 'EN' },
  { code: 'es', label: 'Español',  flag: 'ES' },
]

export function isRTL(lang: Lang) { return lang === 'ar' }

export function getLang(): Lang {
  if (typeof window === 'undefined') return 'ar'
  // One language for every staff screen (POS, waiter, kitchen, staff login).
  // 'sm_lang' is the legacy key kitchen/staff used before they were unified.
  try {
    const stored = (localStorage.getItem('posLang') ?? localStorage.getItem('sm_lang')) as Lang | null
    if (stored && ['ar','fr','en','es'].includes(stored)) return stored
  } catch {}
  return 'ar'
}
export function setLang(lang: Lang) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem('posLang', lang); localStorage.setItem('sm_lang', lang) } catch {}
}

// ─── Translations ─────────────────────────────────────────────────────────────

const T = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  pin_title:       { ar: 'تسجيل الدخول', fr: 'Connexion', en: 'Sign In', es: 'Iniciar sesión' },
  pin_subtitle:    { ar: 'أدخل رمز المطعم ورمزك الشخصي', fr: 'Entrez le code resto et votre PIN', en: 'Enter the venue code and your PIN', es: 'Ingresa el código del local y tu PIN' },
  pin_subdomain:   { ar: 'رمز المطعم', fr: 'Code du restaurant', en: 'Venue code', es: 'Código del local' },
  pin_code:        { ar: 'الرمز السري (PIN)', fr: 'Code PIN', en: 'PIN code', es: 'Código PIN' },
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
  cash_given:      { ar: 'المبلغ المستلم', fr: 'Montant reçu', en: 'Amount given', es: 'Monto dado' },
  change:          { ar: 'الباقي', fr: 'Monnaie', en: 'Change', es: 'Cambio' },
  print_receipt:   { ar: 'طباعة + دفع', fr: 'Imprimer + Payer', en: 'Print + Pay', es: 'Imprimir + Pagar' },
  pay_now:         { ar: 'دفع فقط', fr: 'Payer seulement', en: 'Pay only', es: 'Solo pagar' },
  processing:      { ar: 'جارٍ المعالجة…', fr: 'En cours…', en: 'Processing…', es: 'Procesando…' },
  paid_success:    { ar: 'تم الدفع بنجاح', fr: 'Paiement enregistré', en: 'Payment recorded', es: 'Pago registrado' },
  // ── Supervisor ───────────────────────────────────────────────────────────
  supervisor:      { ar: 'المشرف', fr: 'Superviseur', en: 'Supervisor', es: 'Supervisor' },
  all_tables:      { ar: 'كل الطاولات', fr: 'Toutes les tables', en: 'All tables', es: 'Todas las mesas' },
  waiter:          { ar: 'النادل', fr: 'Serveur', en: 'Waiter', es: 'Mesero' },
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
  // ── POS / Counter screens ────────────────────────────────────────────────
  pos_subtitle:    { ar: 'نقطة البيع — دخول الموظفين', fr: 'Point de vente — Connexion du personnel', en: 'Point of Sale — Staff Login', es: 'Punto de venta — Acceso del personal' },
  counter_subtitle:{ ar: 'الكاونتر — دخول الموظفين', fr: 'Comptoir — Connexion du personnel', en: 'Counter — Staff Login', es: 'Mostrador — Acceso del personal' },
  demo_pick:       { ar: '🧪 تجريبي — اختر موظفاً للدخول', fr: '🧪 Démo — choisissez un employé', en: '🧪 Demo — pick a staff member', es: '🧪 Demo — elige un empleado' },
  login_btn:       { ar: 'دخول', fr: 'CONNEXION', en: 'LOGIN', es: 'ENTRAR' },
  login_failed:    { ar: 'تعذّر تسجيل الدخول. تحقّق من الرمز وحاول مجدداً', fr: 'Connexion impossible. Vérifiez le code et réessayez', en: 'Sign-in failed. Check the code and try again', es: 'No se pudo iniciar sesión. Verifica el código e inténtalo de nuevo' },
  network_error:   { ar: 'خطأ في الاتصال بالشبكة', fr: 'Erreur réseau', en: 'Network error', es: 'Error de red' },
  role_CASHIER:    { ar: 'أمين الصندوق', fr: 'Caissier', en: 'Cashier', es: 'Cajero' },
  role_WAITER:     { ar: 'النادل', fr: 'Serveur', en: 'Waiter', es: 'Mesero' },
  role_SUPERVISOR: { ar: 'المشرف', fr: 'Superviseur', en: 'Supervisor', es: 'Supervisor' },
  drawer:          { ar: 'الصندوق', fr: 'Caisse', en: 'Drawer', es: 'Caja' },
  delivery:        { ar: 'التوصيل', fr: 'Livraison', en: 'Delivery', es: 'Reparto' },
  delivery_hint:   { ar: 'تسجيل طلب من تطبيق توصيل (Glovo، Uber Eats…)', fr: "Enregistrer une commande d'une app de livraison (Glovo, Uber Eats…)", en: 'Log a delivery-app order (Glovo, Uber Eats…)', es: 'Registrar un pedido de app de reparto (Glovo, Uber Eats…)' },
  view_live:       { ar: 'مباشر', fr: 'En direct', en: 'Live', es: 'En vivo' },
  shift_close:     { ar: 'إغلاق الصندوق', fr: 'Clôture', en: 'Close shift', es: 'Cierre de caja' },
  mute:            { ar: 'كتم التنبيهات', fr: 'Couper le son', en: 'Mute alerts', es: 'Silenciar alertas' },
  refresh:         { ar: 'تحديث', fr: 'Actualiser', en: 'Refresh', es: 'Actualizar' },
  prices_updated:  { ar: '⚠️ تم تحديث أسعار القائمة — قد تحتاج الطلبات اليدوية إلى إعادة التسعير', fr: '⚠️ Prix du menu mis à jour — les commandes manuelles peuvent nécessiter une révision', en: '⚠️ Menu prices updated — manual orders may need repricing', es: '⚠️ Precios del menú actualizados — los pedidos manuales pueden requerir revisión' },
  close:           { ar: 'إغلاق', fr: 'Fermer', en: 'Close', es: 'Cerrar' },
  legend_pos:      { ar: 'الكاشير', fr: 'Caisse', en: 'POS', es: 'TPV' },
  legend_bill:     { ar: 'الحساب', fr: 'Addition', en: 'Bill', es: 'Cuenta' },
  no_items_cat:    { ar: 'لا توجد أصناف في هذه الفئة', fr: 'Aucun article dans cette catégorie', en: 'No items in this category', es: 'No hay artículos en esta categoría' },
  select_table_hint:{ ar: 'اختر طاولة لإضافة الأصناف', fr: 'Choisissez une table pour ajouter des articles', en: 'Select a table to add items', es: 'Selecciona una mesa para agregar artículos' },
  loading_order:   { ar: 'جارٍ تحميل الطلب…', fr: 'Chargement de la commande…', en: 'Loading order…', es: 'Cargando pedido…' },
  browse_menu_table:{ ar: 'تصفّح القائمة لإضافة أصناف إلى هذه الطاولة', fr: 'Parcourez le menu pour ajouter des articles à cette table', en: 'Browse the menu to add items to this table', es: 'Navega el menú para agregar artículos a esta mesa' },
  payment:         { ar: 'الدفع', fr: 'Paiement', en: 'Payment', es: 'Pago' },
  split_by_seat:   { ar: '🪑 تقسيم الحساب حسب المقعد', fr: "🪑 Partager l'addition par siège", en: '🪑 Split Bill by Seat', es: '🪑 Dividir cuenta por asiento' },
  split_unavailable:{ ar: 'تقسيم الحساب غير متاح — هذه الطاولة بمقعد واحد فقط', fr: "Partage indisponible — cette table n'a qu'un siège", en: "Split bill isn't available — this table only has 1 seat", es: 'No se puede dividir — esta mesa solo tiene 1 asiento' },
  split_select:    { ar: 'اختر المقاعد المراد إغلاقها', fr: 'Choisissez les sièges à clôturer', en: 'Select seats to close', es: 'Selecciona los asientos a cerrar' },
  charge:          { ar: 'تحصيل', fr: 'ENCAISSER', en: 'CHARGE', es: 'COBRAR' },
  no_table_sel:    { ar: 'لم يتم اختيار طاولة', fr: 'Aucune table sélectionnée', en: 'No table selected', es: 'Ninguna mesa seleccionada' },
  tap_table_hint:  { ar: 'اضغط على طاولة لعرض طلبها أو إنشاء طلب جديد', fr: 'Touchez une table pour voir ou créer une commande', en: 'Tap a table to view or create an order', es: 'Toca una mesa para ver o crear un pedido' },
  pay_mode_title:  { ar: 'طريقة الدفع', fr: 'Mode de paiement', en: 'Payment method', es: 'Método de pago' },
  pay_mode_sub:    { ar: 'اختر الطريقة التي استخدمها العميل', fr: 'Choisissez le mode utilisé par le client', en: 'Choose the method the customer used', es: 'Elige el método que usó el cliente' },
  pay_cash_sub:    { ar: 'دفع نقدي', fr: 'Paiement en espèces', en: 'Cash payment', es: 'Pago en efectivo' },
  pay_card_term:   { ar: 'بطاقة / جهاز الدفع', fr: 'TPE / Visa', en: 'Card terminal / Visa', es: 'TPV / Visa' },
  pay_card_sub:    { ar: 'بطاقة بنكية', fr: 'Carte bancaire', en: 'Bank card', es: 'Tarjeta bancaria' },
  pay_mobile_sub:  { ar: 'دفع عبر الجوال', fr: 'Paiement mobile', en: 'Mobile payment', es: 'Pago móvil' },
  pay_confirm_q:   { ar: 'هل تؤكد طريقة الدفع هذه؟', fr: 'Confirmez-vous ce mode de paiement ?', en: 'Confirm this payment method?', es: '¿Confirmas este método de pago?' },
  pay_check_cash:  { ar: '✔ تأكد من استلام المبلغ نقداً قبل التأكيد', fr: "✔ Assurez-vous d'avoir reçu les espèces avant de confirmer", en: '✔ Make sure you have received the cash before confirming', es: '✔ Asegúrate de haber recibido el efectivo antes de confirmar' },
  pay_check_card:  { ar: '✔ تأكد من قبول جهاز الدفع للعملية قبل التأكيد', fr: '✔ Assurez-vous que le TPE a validé le paiement avant de confirmer', en: '✔ Make sure the card terminal approved the payment before confirming', es: '✔ Asegúrate de que el TPV aprobó el pago antes de confirmar' },
  pay_check_mobile:{ ar: '✔ تأكد من اكتمال الدفع عبر الجوال قبل المتابعة', fr: '✔ Assurez-vous que le paiement mobile est confirmé avant de continuer', en: '✔ Make sure the mobile payment is confirmed before continuing', es: '✔ Asegúrate de que el pago móvil esté confirmado antes de continuar' },
  back:            { ar: 'رجوع', fr: 'Retour', en: 'Back', es: 'Volver' },
  order_create_failed:{ ar: 'تعذّر إنشاء الطلب', fr: 'Échec de la création de la commande', en: 'Could not create the order', es: 'No se pudo crear el pedido' },
  checkout_failed: { ar: 'تعذّر إتمام الدفع', fr: 'Échec du paiement', en: 'Checkout failed', es: 'No se pudo completar el pago' },
  // ── Marketplace (delivery app) modal ─────────────────────────────────────
  mp_title:        { ar: 'طلب من تطبيق توصيل', fr: 'Commande app de livraison', en: 'Delivery App Order', es: 'Pedido de app de reparto' },
  mp_other:        { ar: 'أخرى', fr: 'Autre', en: 'Other', es: 'Otra' },
  mp_platform_name:{ ar: 'اسم المنصة', fr: 'Nom de la plateforme', en: 'Platform name', es: 'Nombre de la plataforma' },
  mp_order_ref:    { ar: 'رقم الطلب (اختياري)', fr: 'N° commande (optionnel)', en: 'Order # (optional)', es: 'N.º de pedido (opcional)' },
  mp_save:         { ar: 'تسجيل الطلب', fr: 'Enregistrer', en: 'Log Order', es: 'Registrar pedido' },
  mp_empty:        { ar: 'اضغط على المنتجات لإضافتها', fr: "Touchez un produit pour l'ajouter", en: 'Tap products to add them', es: 'Toca los productos para agregarlos' },
  mp_choose:       { ar: 'اختر منصة', fr: 'Choisissez une plateforme', en: 'Choose a platform', es: 'Elige una plataforma' },
  request_failed:  { ar: 'فشل الطلب', fr: 'Échec', en: 'Request failed', es: 'Error en la solicitud' },
  // ── Shift open / close / lock ────────────────────────────────────────────
  cd_title:        { ar: 'فتح الصندوق', fr: 'Caisse de départ', en: 'Open the drawer', es: 'Apertura de caja' },
  cd_greeting:     { ar: 'مرحباً {name} — افتح الصندوق للبدء', fr: 'Bonjour {name} — ouvrez votre caisse pour commencer', en: 'Hello {name} — open your drawer to start', es: 'Hola {name} — abre tu caja para empezar' },
  cd_amount:       { ar: 'المبلغ الافتتاحي في الصندوق', fr: 'Montant de départ', en: 'Opening cash amount', es: 'Monto inicial en caja' },
  cd_amount_ph:    { ar: 'مثال: 200', fr: 'ex. : 200', en: 'e.g. 200', es: 'ej.: 200' },
  cd_amount_hint:  { ar: 'أدخل المبلغ النقدي الموجود فعلاً في الصندوق', fr: 'Saisissez les espèces réellement présentes dans la caisse', en: 'Enter the cash actually in the drawer', es: 'Introduce el efectivo que hay realmente en la caja' },
  cd_end:          { ar: 'وقت الانصراف المتوقع', fr: 'Heure de sortie prévue', en: 'Planned end time', es: 'Hora de salida prevista' },
  cd_end_hint:     { ar: 'الوقت المتوقع لانتهاء ورديتك', fr: 'Heure à laquelle votre service doit se terminer', en: 'When your shift is expected to end', es: 'Cuándo está previsto que termine tu turno' },
  cd_end_required: { ar: 'يرجى تحديد وقت الانصراف المتوقع', fr: 'Heure de sortie prévue requise', en: 'Planned end time is required', es: 'La hora de salida prevista es obligatoria' },
  cd_open:         { ar: 'فتح الصندوق', fr: 'Ouvrir la caisse', en: 'Open drawer', es: 'Abrir caja' },
  cd_open_failed:  { ar: 'تعذّر فتح الصندوق', fr: "Échec de l'ouverture de caisse", en: 'Could not open the drawer', es: 'No se pudo abrir la caja' },
  invalid_amount:  { ar: 'مبلغ غير صالح', fr: 'Montant invalide', en: 'Invalid amount', es: 'Monto no válido' },
  cl_title:        { ar: 'إغلاق الصندوق', fr: 'Clôture de caisse', en: 'Close the drawer', es: 'Cierre de caja' },
  cl_discrepancy:  { ar: 'الفرق', fr: 'Écart', en: 'Discrepancy', es: 'Diferencia' },
  cash_exact:      { ar: 'بالضبط', fr: 'Exact', en: 'Exact', es: 'Exacto' },
  cl_exact:        { ar: 'الصندوق مطابق', fr: 'Caisse exacte', en: 'Drawer balanced', es: 'Caja cuadrada' },
  cl_over:         { ar: 'فائض', fr: 'Excédent', en: 'Over', es: 'Sobrante' },
  cl_short:        { ar: 'عجز', fr: 'Manque', en: 'Short', es: 'Faltante' },
  cl_done:         { ar: 'تم', fr: 'Terminé', en: 'Done', es: 'Listo' },
  cl_cash_rev:     { ar: 'المقبوضات النقدية', fr: 'Recette (espèces)', en: 'Cash takings', es: 'Ingresos en efectivo' },
  cl_expected:     { ar: 'المبلغ المتوقع', fr: 'Montant attendu', en: 'Expected amount', es: 'Monto esperado' },
  cl_counted:      { ar: 'المبلغ المعدود', fr: 'Montant compté', en: 'Counted amount', es: 'Monto contado' },
  cl_confirm:      { ar: 'تأكيد الإغلاق', fr: 'Confirmer la clôture', en: 'Confirm close', es: 'Confirmar cierre' },
  cl_failed:       { ar: 'تعذّر إغلاق الصندوق', fr: 'Échec de la clôture', en: 'Could not close the drawer', es: 'No se pudo cerrar la caja' },
  lk_title:        { ar: 'نقطة البيع مقفلة', fr: 'Poste verrouillé', en: 'Station locked', es: 'Puesto bloqueado' },
  lk_body:         { ar: 'تجاوز {name} وقت الانصراف المتوقع{time} بأكثر من ساعة دون إغلاق الصندوق. الصندوق مقفل حتى يفتحه أحد المسؤولين.', fr: "{name} a dépassé sa sortie prévue{time} de plus d'1h sans clôturer. La caisse est bloquée jusqu'à déverrouillage par un administrateur.", en: '{name} is more than 1h past the planned end time{time} without closing the drawer. The drawer is locked until an administrator unlocks it.', es: '{name} superó en más de 1 h la hora de salida prevista{time} sin cerrar la caja. La caja está bloqueada hasta que un administrador la desbloquee.' },
  tm_left:         { ar: '⏱ الانصراف بعد {d}', fr: '⏱ Sortie dans {d}', en: '⏱ Ends in {d}', es: '⏱ Salida en {d}' },
  tm_over:         { ar: '⏱ +{d} — يُقفل الصندوق بعد ساعة من الموعد', fr: '⏱ +{d} — verrouillage à +1h', en: '⏱ +{d} — locks at +1h', es: '⏱ +{d} — bloqueo a +1 h' },
  // ── Counter (comptoir) ───────────────────────────────────────────────────
  categories:      { ar: 'الفئات', fr: 'Catégories', en: 'Categories', es: 'Categorías' },
  counter:         { ar: 'الكاونتر', fr: 'Comptoir', en: 'Counter', es: 'Mostrador' },
  customer:        { ar: 'العميل', fr: 'Client', en: 'Customer', es: 'Cliente' },
  wholesale:       { ar: 'جملة', fr: 'Gros', en: 'Wholesale', es: 'Mayorista' },
  select_customer: { ar: '⚠ اختر عميلاً', fr: '⚠ Sélectionnez un client', en: '⚠ Select a customer', es: '⚠ Selecciona un cliente' },
  edit_wholesale:  { ar: 'تعديل حالة عميل الجملة', fr: 'Modifier le statut grossiste', en: 'Edit wholesale status', es: 'Editar estado de mayorista' },
  change_btn:      { ar: 'تغيير', fr: 'Changer', en: 'Change', es: 'Cambiar' },
  choose_btn:      { ar: 'اختيار', fr: 'Choisir', en: 'Choose', es: 'Elegir' },
  counter_empty:   { ar: 'لا توجد أصناف — اضغط على منتج لإضافته', fr: "Aucun article — touchez un produit pour l'ajouter", en: 'No items — tap a product to add it', es: 'Sin artículos — toca un producto para agregarlo' },
  subtotal:        { ar: 'المجموع الفرعي', fr: 'Sous-total', en: 'Subtotal', es: 'Subtotal' },
  wholesale_disc:  { ar: 'خصم الجملة', fr: 'Remise gros', en: 'Wholesale discount', es: 'Descuento mayorista' },
  takeaway:        { ar: 'طلب خارجي', fr: 'Emporter', en: 'Takeaway', es: 'Para llevar' },
  dine_in:         { ar: 'تناول في المطعم', fr: 'Sur place', en: 'Dine in', es: 'Para comer aquí' },
  sale_recorded:   { ar: '✓ تم تسجيل البيع', fr: '✓ Vente enregistrée', en: '✓ Sale recorded', es: '✓ Venta registrada' },
  confirm_print:   { ar: 'تأكيد وطباعة', fr: 'Confirmer & Imprimer', en: 'Confirm & Print', es: 'Confirmar e imprimir' },
  today_no_sales:  { ar: 'لا توجد مبيعات مسجّلة اليوم', fr: "Aucune vente enregistrée aujourd'hui", en: 'No sales recorded today', es: 'No hay ventas registradas hoy' },
  client_search_ph:{ ar: 'الاسم أو رقم الهاتف', fr: 'Nom ou téléphone', en: 'Name or phone number', es: 'Nombre o teléfono' },
  no_name:         { ar: 'بدون اسم', fr: 'Sans nom', en: 'No name', es: 'Sin nombre' },
  new_customer:    { ar: 'عميل جديد', fr: 'Nouveau client', en: 'New customer', es: 'Cliente nuevo' },
  name_optional:   { ar: 'الاسم (اختياري)', fr: 'Nom (optionnel)', en: 'Name (optional)', es: 'Nombre (opcional)' },
  wholesale_client:{ ar: 'عميل جملة (موزّع)', fr: 'Client grossiste (revendeur)', en: 'Wholesale customer (reseller)', es: 'Cliente mayorista (revendedor)' },
  discount_each:   { ar: '% خصم على كل طلب', fr: '% de remise sur chaque commande', en: '% discount on every order', es: '% de descuento en cada pedido' },
  creating:        { ar: 'جارٍ الإنشاء…', fr: 'Création…', en: 'Creating…', es: 'Creando…' },
  create_select:   { ar: 'إنشاء واختيار', fr: 'Créer et sélectionner', en: 'Create and select', es: 'Crear y seleccionar' },
  saving:          { ar: 'جارٍ الحفظ…', fr: 'Enregistrement…', en: 'Saving…', es: 'Guardando…' },
  save:            { ar: 'حفظ', fr: 'Enregistrer', en: 'Save', es: 'Guardar' },
  update_failed:   { ar: 'تعذّر حفظ التعديل', fr: 'Échec de la mise à jour', en: 'Update failed', es: 'No se pudo actualizar' },
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

/** tr() with `{var}` placeholders, e.g. trf('cd_greeting', lang, { name }). */
export function trf(key: Key, lang: Lang, vars: Record<string, string | number>): string {
  return tr(key, lang).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

/** Short duration like "1س05د" / "1h05" / "12min", localised. */
export function fmtDuration(ms: number, lang: Lang): string {
  const totalMinutes = Math.round(Math.abs(ms) / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (lang === 'ar') return h > 0 ? `${h} ${tr('hr', lang)} ${m} ${tr('min', lang)}` : `${m} ${tr('min', lang)}`
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`
}

/** Translate a staff role enum (CASHIER/WAITER/SUPERVISOR); unknown roles pass through. */
export function roleLabel(role: string | undefined | null, lang: Lang): string {
  if (!role) return ''
  const k = `role_${role}` as Key
  return k in T ? tr(k, lang) : role
}

export type PosKey = Key

export default T
