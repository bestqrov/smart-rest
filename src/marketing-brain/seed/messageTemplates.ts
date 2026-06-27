/**
 * Seed data for message templates.
 *
 * References are by slug/code and resolved to ObjectIds at seed time.
 * Body text uses {{variableName}} placeholders — validated against the variables array.
 *
 * This file contains the Sprint 1 baseline set (Arabic WhatsApp focus).
 * Additional templates (email, SMS, other languages) are added in subsequent sprints.
 */

export const MESSAGE_TEMPLATES = [
  // ─── SCENARIO: demo_request_submitted ────────────────────────────────────
  {
    slug:            'demo_whatsapp_ar_traditional_owner_welcome',
    channel:         'WHATSAPP',
    format:          'TEXT',
    tone:            'FRIENDLY',
    scenarioSlug:    'demo_request_submitted',
    personaSlug:     'traditional_owner',
    languageCode:    'ar',
    countryCode:     null,      // all countries
    businessTypeSlug: null,
    subject:         '',
    body: `مرحباً {{ownerName}} 👋

شكراً على اهتمامك بـ SmartRestau!

أنا {{agentName}} من فريق الدعم — خصصت ليك تجربة مجانية 7 أيام في {{cafeName}}.

في دقيقتين راه تقدر:
✅ تضيف قائمة طعامك
✅ تطبع QR codes للطاولات
✅ تبدأ تستقبل الطلبات

واش وقت مناسب نقدر نساعدك في الإعداد؟`,
    variables: [
      { key: 'ownerName',  descriptionEn: 'Name of the restaurant owner',  required: true,  defaultValue: 'أستاذ',       valueType: 'text' },
      { key: 'agentName',  descriptionEn: 'Name of the support agent',     required: true,  defaultValue: 'فريق SmartRestau', valueType: 'text' },
      { key: 'cafeName',   descriptionEn: 'Name of the restaurant/café',   required: false, defaultValue: 'مطعمك',       valueType: 'text' },
    ],
    tags:      ['demo', 'welcome', 'ar', 'whatsapp'],
    createdBy: 'SEED',
    version:   1,
    isActive:  true,
  },
  {
    slug:            'demo_whatsapp_ar_young_entrepreneur_welcome',
    channel:         'WHATSAPP',
    format:          'TEXT',
    tone:            'PLAYFUL',
    scenarioSlug:    'demo_request_submitted',
    personaSlug:     'young_entrepreneur',
    languageCode:    'ar',
    countryCode:     null,
    businessTypeSlug: null,
    subject:         '',
    body: `سلام {{ownerName}} 🚀

طلبك وصل! جاهزين نطلقوا مشروعك للمستوى اللي فوق.

SmartRestau غير مو نظام — هو السلاح السري ديالك لـ:
📲 قائمة QR تبهر الزبائن
📊 إحصاءات تبين أش الطبق الكتبيع
🎬 فيديوهات AI للتسويق أوتوماتيك

جاوبني على سؤال: {{cafeName}} في أي مدينة؟`,
    variables: [
      { key: 'ownerName', descriptionEn: 'Name of the owner', required: true,  defaultValue: 'صديقي', valueType: 'text' },
      { key: 'cafeName',  descriptionEn: 'Name of the café',  required: false, defaultValue: 'المحل ديالك', valueType: 'text' },
    ],
    tags:      ['demo', 'welcome', 'ar', 'whatsapp', 'young'],
    createdBy: 'SEED',
    version:   1,
    isActive:  true,
  },
  {
    slug:            'demo_whatsapp_fr_young_entrepreneur_welcome',
    channel:         'WHATSAPP',
    format:          'TEXT',
    tone:            'PLAYFUL',
    scenarioSlug:    'demo_request_submitted',
    personaSlug:     'young_entrepreneur',
    languageCode:    'fr',
    countryCode:     null,
    businessTypeSlug: null,
    subject:         '',
    body: `Salut {{ownerName}} 🚀

Votre demande est bien reçue ! On est prêts à propulser votre concept.

SmartRestau c'est pas juste un système — c'est votre arme secrète pour :
📲 Une carte QR qui impressionne vos clients
📊 Des stats qui montrent vos best-sellers en temps réel
🎬 Des vidéos IA pour votre marketing automatique

Question rapide : {{cafeName}} est dans quelle ville ?`,
    variables: [
      { key: 'ownerName', descriptionEn: 'Name of the owner', required: true,  defaultValue: 'Chef', valueType: 'text' },
      { key: 'cafeName',  descriptionEn: 'Name of the café',  required: false, defaultValue: 'votre établissement', valueType: 'text' },
    ],
    tags:      ['demo', 'welcome', 'fr', 'whatsapp', 'young'],
    createdBy: 'SEED',
    version:   1,
    isActive:  true,
  },

  // ─── SCENARIO: trial_day_3_no_menu ───────────────────────────────────────
  {
    slug:            'day3_whatsapp_ar_traditional_no_menu',
    channel:         'WHATSAPP',
    format:          'TEXT',
    tone:            'FRIENDLY',
    scenarioSlug:    'trial_day_3_no_menu',
    personaSlug:     'traditional_owner',
    languageCode:    'ar',
    countryCode:     null,
    businessTypeSlug: null,
    subject:         '',
    body: `صباح الخير {{ownerName}} ☀️

لاحظت أنك لازلت ما ضيفتيش قائمة الطعام.

ما تقلقش — إعداد القائمة يأخذ أقل من 10 دقائق.
وعندنا أيضاً خاصية الـ AI اللي تقدر تضيف قائمة كاملة من صورة واحدة 📸

نساعدك الآن؟ قولي ✅`,
    variables: [
      { key: 'ownerName', descriptionEn: 'Name of the owner', required: true, defaultValue: 'أستاذ', valueType: 'text' },
    ],
    tags:      ['day3', 'activation', 'ar', 'whatsapp', 'menu'],
    createdBy: 'SEED',
    version:   1,
    isActive:  true,
  },

  // ─── SCENARIO: trial_day_6_expiry_tomorrow ───────────────────────────────
  {
    slug:            'expiry_whatsapp_ar_all_urgency',
    channel:         'WHATSAPP',
    format:          'TEXT',
    tone:            'URGENT',
    scenarioSlug:    'trial_day_6_expiry_tomorrow',
    personaSlug:     'traditional_owner',
    languageCode:    'ar',
    countryCode:     null,
    businessTypeSlug: null,
    subject:         '',
    body: `تنبيه مهم {{ownerName}} ⚠️

تجربتك المجانية تنتهي غداً.

خلال 7 أيام، مطعمك:
• استقبل {{orderCount}} طلب
• وفر {{savedMinutes}} دقيقة من الوقت
• حسن رضا الزبائن

علاش توقف الآن؟ 🤔

للاستمرار: أرسل كلمة *استمر* أو راسل فريقنا على {{supportLink}}`,
    variables: [
      { key: 'ownerName',     descriptionEn: 'Name of the owner',         required: true,  defaultValue: 'أستاذ', valueType: 'text'   },
      { key: 'orderCount',    descriptionEn: 'Orders received in trial',  required: false, defaultValue: '0',     valueType: 'number' },
      { key: 'savedMinutes',  descriptionEn: 'Minutes saved estimate',    required: false, defaultValue: '60',    valueType: 'number' },
      { key: 'supportLink',   descriptionEn: 'Support contact link/number',required: true, defaultValue: '',      valueType: 'url'    },
    ],
    tags:      ['urgency', 'expiry', 'ar', 'whatsapp', 'conversion'],
    createdBy: 'SEED',
    version:   1,
    isActive:  true,
  },

  // ─── SCENARIO: first_real_order ──────────────────────────────────────────
  {
    slug:            'first_order_whatsapp_ar_celebration',
    channel:         'WHATSAPP',
    format:          'TEXT',
    tone:            'PLAYFUL',
    scenarioSlug:    'first_real_order',
    personaSlug:     'young_entrepreneur',
    languageCode:    'ar',
    countryCode:     null,
    businessTypeSlug: null,
    subject:         '',
    body: `🎉 مبروك {{ownerName}}!

جاء أول طلب حقيقي في {{cafeName}}!

هذه اللحظة هي البداية الحقيقية.

الخطوة الجاية: طبع QR codes وضعها على كل الطاولات.
كل طاولة = طلبات أكثر بدون ما تحتاج موظف إضافي.

شكون أول زبون تذكره دائماً؟ 😄`,
    variables: [
      { key: 'ownerName', descriptionEn: 'Name of the owner',     required: true,  defaultValue: 'أستاذ',    valueType: 'text' },
      { key: 'cafeName',  descriptionEn: 'Name of the restaurant', required: false, defaultValue: 'المطعم', valueType: 'text' },
    ],
    tags:      ['milestone', 'celebration', 'ar', 'whatsapp', 'onboarding'],
    createdBy: 'SEED',
    version:   1,
    isActive:  true,
  },

  // ─── SCENARIO: suspended_account_reactivation ────────────────────────────
  {
    slug:            'suspended_whatsapp_ar_recovery',
    channel:         'WHATSAPP',
    format:          'TEXT',
    tone:            'EMPATHETIC',
    scenarioSlug:    'suspended_account_reactivation',
    personaSlug:     'traditional_owner',
    languageCode:    'ar',
    countryCode:     null,
    businessTypeSlug: null,
    subject:         '',
    body: `{{ownerName}}، أنا هنا لمساعدتك 🤝

لاحظت أن حساب {{cafeName}} موقوف بسبب رصيد سلبي.

نفهم أن الأمور مرات تكون صعبة.
نقدرو نرتبوا حل يناسبك:
• تسديد على مراحل
• تمديد مهلة الدفع
• مراجعة الرصيد مع فريقنا

أرسل *تواصل* وسنتصل بك خلال ساعة.`,
    variables: [
      { key: 'ownerName', descriptionEn: 'Name of the owner',      required: true,  defaultValue: 'أستاذ',    valueType: 'text' },
      { key: 'cafeName',  descriptionEn: 'Name of the restaurant', required: false, defaultValue: 'المطعم', valueType: 'text' },
    ],
    tags:      ['reactivation', 'suspended', 'ar', 'whatsapp', 'payment'],
    createdBy: 'SEED',
    version:   1,
    isActive:  true,
  },
]
