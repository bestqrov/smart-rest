/**
 * Seed data for follow-up sequences.
 * All slugs are resolved to ObjectIds at seed time by the seed runner.
 */
export const FOLLOWUP_SEQUENCES = [
  // ── Demo lead nurture — Traditional owner, Arabic ─────────────────────────
  {
    slug:             'demo_nurture_traditional_ar',
    nameEn:           'Demo Nurture — Traditional Owner (Arabic)',
    nameAr:           'متابعة الليد — صاحب المحل التقليدي (عربي)',
    nameFr:           'Nurture Démo — Patron Traditionnel (Arabe)',
    scenarioSlug:     'demo_request_submitted',
    personaSlug:      'traditional_owner',
    languageCode:     'ar',
    businessTypeSlug: null,
    countryCode:      null,
    steps: [
      {
        order:      1,
        delayDays:  0,
        delayHours: 0,
        templateSlug: 'demo_whatsapp_ar_traditional_owner_welcome',
        condition:  'always',
        channelOverride: null,
        isActive:   true,
      },
      {
        order:      2,
        delayDays:  1,
        delayHours: 10,
        templateSlug: 'day3_whatsapp_ar_traditional_no_menu',
        condition:  'no_reply',
        channelOverride: null,
        isActive:   true,
      },
    ],
    isActive: true,
  },
  // ── Demo lead nurture — Young entrepreneur, Arabic ────────────────────────
  {
    slug:             'demo_nurture_young_ar',
    nameEn:           'Demo Nurture — Young Entrepreneur (Arabic)',
    nameAr:           'متابعة الليد — رائد الأعمال الشاب (عربي)',
    nameFr:           'Nurture Démo — Jeune Entrepreneur (Arabe)',
    scenarioSlug:     'demo_request_submitted',
    personaSlug:      'young_entrepreneur',
    languageCode:     'ar',
    businessTypeSlug: null,
    countryCode:      null,
    steps: [
      {
        order:      1,
        delayDays:  0,
        delayHours: 0,
        templateSlug: 'demo_whatsapp_ar_young_entrepreneur_welcome',
        condition:  'always',
        channelOverride: null,
        isActive:   true,
      },
    ],
    isActive: true,
  },
  // ── Demo lead nurture — Young entrepreneur, French ────────────────────────
  {
    slug:             'demo_nurture_young_fr',
    nameEn:           'Demo Nurture — Young Entrepreneur (French)',
    nameAr:           'متابعة الليد — رائد الأعمال الشاب (فرنسي)',
    nameFr:           'Nurture Démo — Jeune Entrepreneur (Français)',
    scenarioSlug:     'demo_request_submitted',
    personaSlug:      'young_entrepreneur',
    languageCode:     'fr',
    businessTypeSlug: null,
    countryCode:      null,
    steps: [
      {
        order:      1,
        delayDays:  0,
        delayHours: 0,
        templateSlug: 'demo_whatsapp_fr_young_entrepreneur_welcome',
        condition:  'always',
        channelOverride: null,
        isActive:   true,
      },
    ],
    isActive: true,
  },
  // ── Expiry urgency — all personas ─────────────────────────────────────────
  {
    slug:             'trial_expiry_urgency_ar',
    nameEn:           'Trial Expiry Urgency (Arabic)',
    nameAr:           'إلحاح انتهاء التجربة (عربي)',
    nameFr:           'Urgence Expiration Essai (Arabe)',
    scenarioSlug:     'trial_day_6_expiry_tomorrow',
    personaSlug:      'traditional_owner',
    languageCode:     'ar',
    businessTypeSlug: null,
    countryCode:      null,
    steps: [
      {
        order:      1,
        delayDays:  0,
        delayHours: 9,   // send at 9 AM
        templateSlug: 'expiry_whatsapp_ar_all_urgency',
        condition:  'always',
        channelOverride: null,
        isActive:   true,
      },
    ],
    isActive: true,
  },
  // ── Suspended account recovery ────────────────────────────────────────────
  {
    slug:             'suspended_recovery_ar',
    nameEn:           'Suspended Account Recovery (Arabic)',
    nameAr:           'استرداد الحساب الموقوف (عربي)',
    nameFr:           'Récupération Compte Suspendu (Arabe)',
    scenarioSlug:     'suspended_account_reactivation',
    personaSlug:      'traditional_owner',
    languageCode:     'ar',
    businessTypeSlug: null,
    countryCode:      null,
    steps: [
      {
        order:      1,
        delayDays:  0,
        delayHours: 0,
        templateSlug: 'suspended_whatsapp_ar_recovery',
        condition:  'always',
        channelOverride: null,
        isActive:   true,
      },
    ],
    isActive: true,
  },
]
