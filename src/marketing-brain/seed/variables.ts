/**
 * Canonical variable registry for the Marketing Brain.
 *
 * Every {{key}} used in ANY template body must have an entry here.
 * The seed runner upserts on `key` — safe to re-run.
 *
 * sourcePath uses dot-notation relative to the source object:
 *   CAFE_PROFILE → Cafe document (Prisma)
 *   CONTACT      → CafeCustomer / lead record
 *   COMPUTED     → derived by the send pipeline at runtime
 *   CAMPAIGN     → set per campaign/batch trigger
 *   MANUAL       → filled in by the agent before sending
 *   SYSTEM       → injected by the platform (always available)
 */
export const VARIABLES = [

  // ── CAFE_PROFILE ────────────────────────────────────────────────────────────

  {
    key:        'cafeName',
    dataType:   'text',
    source:     'CAFE_PROFILE',
    sourcePath: 'cafe.name',
    descriptions: {
      en: 'The name of the restaurant or café',
      ar: 'اسم المطعم أو المقهى',
      fr: 'Nom du restaurant ou du café',
    },
    defaultValue:  'مطعمك',
    exampleValues: ['مطعم الريف', 'Café Atlas', 'La Palmeraie'],
    isGlobal:  true,
    isActive:  true,
    validation: {
      required:      false,
      minLength:     1,
      maxLength:     100,
      min:           null,
      max:           null,
      pattern:       null,
      allowedValues: [],
    },
  },

  {
    key:        'cafeCity',
    dataType:   'text',
    source:     'CAFE_PROFILE',
    sourcePath: 'cafe.city',
    descriptions: {
      en: 'City where the café is located',
      ar: 'المدينة التي يقع فيها المطعم',
      fr: 'Ville où se trouve le restaurant',
    },
    defaultValue:  '',
    exampleValues: ['Casablanca', 'Rabat', 'Marrakech', 'Riyadh'],
    isGlobal:  true,
    isActive:  true,
    validation: {
      required:      false,
      minLength:     null,
      maxLength:     80,
      min:           null,
      max:           null,
      pattern:       null,
      allowedValues: [],
    },
  },

  {
    key:        'cafeSubdomain',
    dataType:   'url',
    source:     'CAFE_PROFILE',
    sourcePath: 'cafe.subdomain',
    descriptions: {
      en: 'SmartRestau subdomain for the café (full URL)',
      ar: 'رابط SmartRestau الخاص بالمطعم',
      fr: 'Sous-domaine SmartRestau du restaurant',
    },
    defaultValue:  '',
    exampleValues: ['https://atlas.smartrestau.ma', 'https://alrif.smartrestau.ma'],
    isGlobal:  true,
    isActive:  true,
    validation: {
      required:      false,
      minLength:     null,
      maxLength:     200,
      min:           null,
      max:           null,
      pattern:       '^https://',
      allowedValues: [],
    },
  },

  // ── CONTACT ─────────────────────────────────────────────────────────────────

  {
    key:        'ownerName',
    dataType:   'text',
    source:     'CONTACT',
    sourcePath: 'contact.name',
    descriptions: {
      en: 'First name or full name of the café owner / decision-maker',
      ar: 'الاسم الأول أو الاسم الكامل لصاحب المطعم',
      fr: 'Prénom ou nom complet du propriétaire',
    },
    defaultValue:  'أستاذ',
    exampleValues: ['Karim', 'Fatima', 'Mohamed', 'أستاذ حسن'],
    isGlobal:  true,
    isActive:  true,
    validation: {
      required:      true,
      minLength:     1,
      maxLength:     60,
      min:           null,
      max:           null,
      pattern:       null,
      allowedValues: [],
    },
  },

  {
    key:        'ownerPhone',
    dataType:   'text',
    source:     'CONTACT',
    sourcePath: 'contact.phone',
    descriptions: {
      en: 'WhatsApp phone number of the owner (international format)',
      ar: 'رقم واتساب الخاص بالمالك (الصيغة الدولية)',
      fr: 'Numéro WhatsApp du propriétaire (format international)',
    },
    defaultValue:  '',
    exampleValues: ['+212600000000', '+966500000000'],
    isGlobal:  false,
    isActive:  true,
    validation: {
      required:      false,
      minLength:     10,
      maxLength:     20,
      min:           null,
      max:           null,
      pattern:       '^\\+[1-9]\\d{7,14}$',
      allowedValues: [],
    },
  },

  // ── SYSTEM ───────────────────────────────────────────────────────────────────

  {
    key:        'agentName',
    dataType:   'text',
    source:     'SYSTEM',
    sourcePath: 'system.agentName',
    descriptions: {
      en: 'Name of the SmartRestau support agent sending the message',
      ar: 'اسم وكيل الدعم في SmartRestau الذي يرسل الرسالة',
      fr: 'Nom de l\'agent SmartRestau qui envoie le message',
    },
    defaultValue:  'فريق SmartRestau',
    exampleValues: ['Sara', 'Ahmed', 'فريق SmartRestau'],
    isGlobal:  true,
    isActive:  true,
    validation: {
      required:      true,
      minLength:     1,
      maxLength:     60,
      min:           null,
      max:           null,
      pattern:       null,
      allowedValues: [],
    },
  },

  {
    key:        'supportLink',
    dataType:   'url',
    source:     'SYSTEM',
    sourcePath: 'system.supportLink',
    descriptions: {
      en: 'Support contact URL or WhatsApp link',
      ar: 'رابط التواصل مع الدعم أو رقم واتساب للدعم',
      fr: 'Lien de contact support ou lien WhatsApp',
    },
    defaultValue:  'https://wa.me/212600000000',
    exampleValues: ['https://wa.me/212600000000', 'https://smartrestau.ma/support'],
    isGlobal:  true,
    isActive:  true,
    validation: {
      required:      true,
      minLength:     10,
      maxLength:     200,
      min:           null,
      max:           null,
      pattern:       '^https://',
      allowedValues: [],
    },
  },

  {
    key:        'currentDate',
    dataType:   'date',
    source:     'SYSTEM',
    sourcePath: 'system.currentDate',
    descriptions: {
      en: 'Today\'s date in the recipient\'s locale (e.g. "27 juin 2026")',
      ar: 'تاريخ اليوم بصيغة لغة المستلم',
      fr: 'Date du jour dans la locale du destinataire',
    },
    defaultValue:  '',
    exampleValues: ['27 juin 2026', '٢٧ يونيو ٢٠٢٦'],
    isGlobal:  true,
    isActive:  true,
    validation: {
      required:      false,
      minLength:     null,
      maxLength:     null,
      min:           null,
      max:           null,
      pattern:       null,
      allowedValues: [],
    },
  },

  // ── COMPUTED ────────────────────────────────────────────────────────────────

  {
    key:        'orderCount',
    dataType:   'number',
    source:     'COMPUTED',
    sourcePath: 'computed.orderCount',
    descriptions: {
      en: 'Number of orders received during the trial period',
      ar: 'عدد الطلبات المستلمة خلال فترة التجربة',
      fr: 'Nombre de commandes reçues pendant la période d\'essai',
    },
    defaultValue:  '0',
    exampleValues: ['12', '47', '103'],
    isGlobal:  false,
    isActive:  true,
    validation: {
      required:      false,
      minLength:     null,
      maxLength:     null,
      min:           0,
      max:           100000,
      pattern:       null,
      allowedValues: [],
    },
  },

  {
    key:        'savedMinutes',
    dataType:   'number',
    source:     'COMPUTED',
    sourcePath: 'computed.savedMinutes',
    descriptions: {
      en: 'Estimated minutes saved per day by using SmartRestau',
      ar: 'الدقائق التقديرية الموفرة يومياً باستخدام SmartRestau',
      fr: 'Minutes estimées économisées par jour grâce à SmartRestau',
    },
    defaultValue:  '60',
    exampleValues: ['45', '60', '90'],
    isGlobal:  false,
    isActive:  true,
    validation: {
      required:      false,
      minLength:     null,
      maxLength:     null,
      min:           0,
      max:           480,
      pattern:       null,
      allowedValues: [],
    },
  },

  {
    key:        'trialDaysLeft',
    dataType:   'number',
    source:     'COMPUTED',
    sourcePath: 'computed.trialDaysLeft',
    descriptions: {
      en: 'Number of days remaining in the free trial',
      ar: 'عدد الأيام المتبقية من التجربة المجانية',
      fr: 'Nombre de jours restants dans l\'essai gratuit',
    },
    defaultValue:  '7',
    exampleValues: ['1', '3', '7', '14'],
    isGlobal:  false,
    isActive:  true,
    validation: {
      required:      false,
      minLength:     null,
      maxLength:     null,
      min:           0,
      max:           90,
      pattern:       null,
      allowedValues: [],
    },
  },

  {
    key:        'expiryDate',
    dataType:   'date',
    source:     'COMPUTED',
    sourcePath: 'computed.expiryDate',
    descriptions: {
      en: 'Date when the trial or offer expires',
      ar: 'تاريخ انتهاء فترة التجربة أو العرض',
      fr: 'Date d\'expiration de l\'essai ou de l\'offre',
    },
    defaultValue:  '',
    exampleValues: ['30 juin 2026', '٣٠ يونيو ٢٠٢٦'],
    isGlobal:  false,
    isActive:  true,
    validation: {
      required:      false,
      minLength:     null,
      maxLength:     null,
      min:           null,
      max:           null,
      pattern:       null,
      allowedValues: [],
    },
  },

  // ── CAMPAIGN ─────────────────────────────────────────────────────────────────

  {
    key:        'trialLink',
    dataType:   'url',
    source:     'CAMPAIGN',
    sourcePath: 'campaign.trialLink',
    descriptions: {
      en: 'Direct link to start the free trial (unique per contact)',
      ar: 'رابط مباشر لبدء التجربة المجانية (فريد لكل مستلم)',
      fr: 'Lien direct pour démarrer l\'essai gratuit (unique par contact)',
    },
    defaultValue:  '',
    exampleValues: ['https://app.smartrestau.ma/trial?ref=abc123'],
    isGlobal:  false,
    isActive:  true,
    validation: {
      required:      false,
      minLength:     10,
      maxLength:     300,
      min:           null,
      max:           null,
      pattern:       '^https://',
      allowedValues: [],
    },
  },

  {
    key:        'demoBookingLink',
    dataType:   'url',
    source:     'CAMPAIGN',
    sourcePath: 'campaign.demoBookingLink',
    descriptions: {
      en: 'Link for the prospect to book a product demo',
      ar: 'رابط لحجز عرض توضيحي للمنتج',
      fr: 'Lien pour réserver une démonstration du produit',
    },
    defaultValue:  '',
    exampleValues: ['https://calendly.com/smartrestau/demo'],
    isGlobal:  false,
    isActive:  true,
    validation: {
      required:      false,
      minLength:     10,
      maxLength:     300,
      min:           null,
      max:           null,
      pattern:       '^https://',
      allowedValues: [],
    },
  },

  // ── MANUAL ───────────────────────────────────────────────────────────────────

  {
    key:        'customNote',
    dataType:   'text',
    source:     'MANUAL',
    sourcePath: '',
    descriptions: {
      en: 'A free-text note written by the agent before sending (personalisation)',
      ar: 'ملاحظة نصية حرة يكتبها الوكيل قبل الإرسال',
      fr: 'Note libre rédigée par l\'agent avant l\'envoi (personnalisation)',
    },
    defaultValue:  '',
    exampleValues: ['سمعت إنك فتحت فرع جديد في البيضاء، مبروك!'],
    isGlobal:  false,
    isActive:  true,
    validation: {
      required:      false,
      minLength:     null,
      maxLength:     300,
      min:           null,
      max:           null,
      pattern:       null,
      allowedValues: [],
    },
  },
]
