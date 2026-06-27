/**
 * Seed data for AIRule.
 *
 * appliesTo fields use slug/code arrays — resolved to ObjectIds at seed time.
 * Empty arrays = "applies to all" (universal rule).
 *
 * HARD rules (isHard: true) are always enforced and cannot be overridden
 * by persona or scenario-level soft rules.
 */
export const AI_RULES = [

  // ── LANGUAGE ────────────────────────────────────────────────────────────────

  {
    slug:     'language-dialect-morocco-ar',
    ruleType: 'LANGUAGE',
    nameEn:   'Moroccan Arabic (Darija) Dialect',
    nameAr:   'اللهجة المغربية (الدارجة)',
    nameFr:   'Dialecte arabe marocain (Darija)',
    priority: 90,
    isHard:   true,
    appliesTo: {
      countryCodes:     ['MA'],
      languageCodes:    ['ar'],
      channels:         ['WHATSAPP'],
      personaSlugs:     [],
      scenarioSlugs:    [],
      businessTypeSlugs:[],
    },
    rule: {
      instruction:
        'Write in Moroccan Darija (الدارجة المغربية). Use informal register. ' +
        'Mix lightly with French loanwords that are natural in Morocco (e.g. "l7it", "merci", "parfait"). ' +
        'Do NOT use Modern Standard Arabic (فصحى) — it sounds robotic and impersonal to Moroccan readers. ' +
        'Avoid Egyptian or Gulf dialect expressions.',
      goodExamples: [
        'كيداير أستاذ؟ واش جربتي l menu ديال SmartRestau؟',
        'هاد النظام غادي يخففلك الخدمة بزاف، من غير ما تضيع الوقت.',
      ],
      badExamples: [
        'هل تريد أن تجرب نظامنا؟ إنه الأفضل في المنطقة.',
        'نتمنى أن تكون بخير وأن يكون يومك جميلاً.',
      ],
      maxChars:          null,
      maxLines:          null,
      maxWords:          null,
      forbiddenPatterns: ['هل تريد', 'نتمنى لك', 'مع أطيب التحيات'],
      requiredTokens:    [],
    },
  },

  {
    slug:     'language-dialect-gulf-ar',
    ruleType: 'LANGUAGE',
    nameEn:   'Gulf Arabic Dialect',
    nameAr:   'اللهجة الخليجية',
    nameFr:   'Dialecte arabe du Golfe',
    priority: 90,
    isHard:   true,
    appliesTo: {
      countryCodes:     ['SA', 'AE', 'KW', 'QA', 'BH', 'OM'],
      languageCodes:    ['ar'],
      channels:         ['WHATSAPP'],
      personaSlugs:     [],
      scenarioSlugs:    [],
      businessTypeSlugs:[],
    },
    rule: {
      instruction:
        'Write in Gulf dialect appropriate for the country. ' +
        'SA: Najdi register, warm and direct. AE: slightly more formal. ' +
        'Avoid Egyptian dialect. Avoid Moroccan Darija. ' +
        'Use formal yet friendly register — Gulf business culture values courtesy.',
      goodExamples: [
        'عساك بخير! وش رأيك تجرب نظام SmartRestau؟',
        'حياك الله، نبي أشاركك كيف نظامنا يوفر لك وقت وجهد.',
      ],
      badExamples: [
        'إيه أزيك!', // Egyptian
        'واش راك؟',  // Maghrebi
      ],
      maxChars:          null,
      maxLines:          null,
      maxWords:          null,
      forbiddenPatterns: ['إيه أزيك', 'واش', 'كيداير'],
      requiredTokens:    [],
    },
  },

  // ── TONE ────────────────────────────────────────────────────────────────────

  {
    slug:     'tone-traditional-owner-warmth',
    ruleType: 'TONE',
    nameEn:   'Warm & Respectful Tone for Traditional Owners',
    nameAr:   'نبرة دافئة ومحترمة لأصحاب المطاعم التقليديين',
    nameFr:   'Ton chaleureux et respectueux pour les propriétaires traditionnels',
    priority: 70,
    isHard:   false,
    appliesTo: {
      personaSlugs:     ['traditional_owner'],
      countryCodes:     [],
      languageCodes:    [],
      channels:         [],
      scenarioSlugs:    [],
      businessTypeSlugs:[],
    },
    rule: {
      instruction:
        'Address the owner with "أستاذ" or "Si" (not just by first name). ' +
        'Emphasise simplicity and time-saving — not technology. ' +
        'Avoid startup jargon ("onboarding", "dashboard", "KPI"). ' +
        'Reference concrete day-to-day benefits: fewer mistakes on orders, ' +
        'no more paper slips, customers served faster.',
      goodExamples: [
        'أستاذ، SmartRestau كتخلص الگارسون من الأخطاء — الطلبات كتوصل للمطبخ مباشرة.',
      ],
      badExamples: [
        'Activez votre onboarding dès aujourd\'hui pour accéder à votre dashboard !',
        'هادا AI-powered solution ديالك.',
      ],
      maxChars:          null,
      maxLines:          null,
      maxWords:          null,
      forbiddenPatterns: ['dashboard', 'KPI', 'onboarding', 'AI-powered'],
      requiredTokens:    [],
    },
  },

  {
    slug:     'tone-young-entrepreneur-playful',
    ruleType: 'TONE',
    nameEn:   'Playful & Direct Tone for Young Entrepreneurs',
    nameAr:   'نبرة مرحة ومباشرة للشباب المقاولين',
    nameFr:   'Ton joueur et direct pour les jeunes entrepreneurs',
    priority: 70,
    isHard:   false,
    appliesTo: {
      personaSlugs:     ['young_entrepreneur'],
      countryCodes:     [],
      languageCodes:    [],
      channels:         [],
      scenarioSlugs:    [],
      businessTypeSlugs:[],
    },
    rule: {
      instruction:
        'Be energetic, concise, and peer-to-peer. ' +
        'Use a single emoji maximum per message (not multiple emoji stacks). ' +
        'Lead with the value proposition immediately — no long preamble. ' +
        'Tech terms are fine; avoid corporate stiffness.',
      goodExamples: [
        'يا سي خالد، كتلقى 3x طلبات بلا أخطاء — واش مجرب SmartRestau? 🚀',
      ],
      badExamples: [
        'نتشرف بمراسلتك ونتمنى أن تكون في تمام الصحة والعافية...',
      ],
      maxChars:          null,
      maxLines:          null,
      maxWords:          null,
      forbiddenPatterns: [],
      requiredTokens:    [],
    },
  },

  // ── LENGTH ──────────────────────────────────────────────────────────────────

  {
    slug:     'length-whatsapp-max-lines',
    ruleType: 'LENGTH',
    nameEn:   'WhatsApp Message Max Length',
    nameAr:   'الحد الأقصى لطول رسالة واتساب',
    nameFr:   'Longueur maximale des messages WhatsApp',
    priority: 80,
    isHard:   true,
    appliesTo: {
      channels:         ['WHATSAPP'],
      personaSlugs:     [],
      countryCodes:     [],
      languageCodes:    [],
      scenarioSlugs:    [],
      businessTypeSlugs:[],
    },
    rule: {
      instruction:
        'WhatsApp messages must be at most 10 lines and 500 characters. ' +
        'Shorter is always better — 3–5 lines is optimal. ' +
        'If the message needs more content, split into a multi-step sequence instead.',
      goodExamples: [],
      badExamples:  [],
      maxChars:     500,
      maxLines:     10,
      maxWords:     null,
      forbiddenPatterns: [],
      requiredTokens:    [],
    },
  },

  {
    slug:     'length-email-max-words',
    ruleType: 'LENGTH',
    nameEn:   'Email Max Word Count',
    nameAr:   'الحد الأقصى لعدد الكلمات في البريد الإلكتروني',
    nameFr:   'Nombre de mots maximum pour les emails',
    priority: 60,
    isHard:   false,
    appliesTo: {
      channels:         ['EMAIL'],
      personaSlugs:     [],
      countryCodes:     [],
      languageCodes:    [],
      scenarioSlugs:    [],
      businessTypeSlugs:[],
    },
    rule: {
      instruction:
        'Cold and nurture emails should stay under 200 words. ' +
        'Onboarding step emails can go up to 350 words if needed. ' +
        'DECISION stage emails may include a single bullet-point feature list.',
      goodExamples: [],
      badExamples:  [],
      maxChars:     null,
      maxLines:     null,
      maxWords:     350,
      forbiddenPatterns: [],
      requiredTokens:    [],
    },
  },

  // ── STRUCTURE ───────────────────────────────────────────────────────────────

  {
    slug:     'structure-whatsapp-hook-first',
    ruleType: 'STRUCTURE',
    nameEn:   'WhatsApp: Hook in First Line',
    nameAr:   'واتساب: الجملة الجذابة في السطر الأول',
    nameFr:   'WhatsApp : accroche en première ligne',
    priority: 75,
    isHard:   true,
    appliesTo: {
      channels:         ['WHATSAPP'],
      personaSlugs:     [],
      countryCodes:     [],
      languageCodes:    [],
      scenarioSlugs:    [],
      businessTypeSlugs:[],
    },
    rule: {
      instruction:
        'The first line of every WhatsApp message must be a hook: ' +
        'a short statement or question that gives the reader a reason to keep reading. ' +
        'Do NOT start with a greeting or pleasantry on the first line — ' +
        'greetings may appear on line 2 at most. ' +
        'The hook should reference a specific benefit or pain point.',
      goodExamples: [
        'طلباتك وصلات للمطبخ بدون ورقة ولا قلم 📱',
        'واش عارف أنك كتضيع معدل 40 دقيقة كل يوم بسبب الطلبات اليدوية؟',
      ],
      badExamples: [
        'السلام عليكم، كيف حالك أستاذ؟',
        'مرحبا! نتمنى أنك بخير.',
      ],
      maxChars:          null,
      maxLines:          null,
      maxWords:          null,
      forbiddenPatterns: [],
      requiredTokens:    [],
    },
  },

  // ── FORBIDDEN ───────────────────────────────────────────────────────────────

  {
    slug:     'forbidden-competitor-names',
    ruleType: 'FORBIDDEN',
    nameEn:   'Never Mention Competitor Names',
    nameAr:   'ممنوع ذكر أسماء المنافسين',
    nameFr:   'Ne jamais mentionner les noms des concurrents',
    priority: 100,
    isHard:   true,
    appliesTo: {
      personaSlugs:     [],
      countryCodes:     [],
      languageCodes:    [],
      channels:         [],
      scenarioSlugs:    [],
      businessTypeSlugs:[],
    },
    rule: {
      instruction:
        'Never mention competitor products or brand names in any template. ' +
        'Do not compare SmartRestau to any named competitor — ' +
        'use generic phrases like "other solutions" or "traditional methods" instead.',
      goodExamples: [
        'مقارنة بالطرق التقليدية، SmartRestau كيوفر لك 40 دقيقة في اليوم.',
      ],
      badExamples: [
        'خلافاً لـ Glovo أو Jahez...',
        'أفضل من SquarePOS بكثير.',
      ],
      maxChars:          null,
      maxLines:          null,
      maxWords:          null,
      forbiddenPatterns: ['Glovo', 'Jahez', 'Foodics', 'Toast', 'Square', 'Lightspeed'],
      requiredTokens:    [],
    },
  },

  {
    slug:     'forbidden-false-urgency',
    ruleType: 'FORBIDDEN',
    nameEn:   'No False Urgency or Fake Scarcity',
    nameAr:   'ممنوع الإلحاح الزائف أو الندرة المصطنعة',
    nameFr:   'Pas d\'urgence ou de rareté artificielle',
    priority: 95,
    isHard:   true,
    appliesTo: {
      personaSlugs:     [],
      countryCodes:     [],
      languageCodes:    [],
      channels:         [],
      scenarioSlugs:    [],
      businessTypeSlugs:[],
    },
    rule: {
      instruction:
        'Do not manufacture urgency or scarcity that is not real. ' +
        'Avoid: "last X spots", "offer expires in 24 hours" (unless the offer genuinely does), ' +
        '"only for the first N clients". ' +
        'Real deadlines (e.g. trial expiry, seasonal promo) are allowed and should reference {{expiryDate}}.',
      goodExamples: [],
      badExamples: [
        'تبقى 3 أماكن فقط! اشترك الآن قبل فوات الأوان.',
        'العرض ينتهي الليلة في منتصف الليل! (without a real deadline variable)',
      ],
      maxChars:          null,
      maxLines:          null,
      maxWords:          null,
      forbiddenPatterns: ['الأماكن الأخيرة', 'تبقى فقط', 'last spots', 'limited slots'],
      requiredTokens:    [],
    },
  },

  // ── REQUIRED ────────────────────────────────────────────────────────────────

  {
    slug:     'required-cta-every-message',
    ruleType: 'REQUIRED',
    nameEn:   'Every Message Must Have a Single Clear CTA',
    nameAr:   'كل رسالة يجب أن تحتوي على دعوة واحدة واضحة للتصرف',
    nameFr:   'Chaque message doit avoir un seul CTA clair',
    priority: 85,
    isHard:   true,
    appliesTo: {
      personaSlugs:     [],
      countryCodes:     [],
      languageCodes:    [],
      channels:         ['WHATSAPP', 'EMAIL', 'SMS'],
      scenarioSlugs:    [],
      businessTypeSlugs:[],
    },
    rule: {
      instruction:
        'Every message must end with exactly one call to action (CTA). ' +
        'Do not include two CTAs in one message (e.g. "call us OR visit the link"). ' +
        'The CTA must be the last thing in the message. ' +
        'For WhatsApp, prefer a direct question or instruction over a button label.',
      goodExamples: [
        'ردني بـ "نعم" باش نرتبو معاك شي وقت مناسب.',
        'جرب مجاناً: {{trialLink}}',
      ],
      badExamples: [
        'اتصل بنا أو زور موقعنا أو راسلنا على الإيميل.',
      ],
      maxChars:          null,
      maxLines:          null,
      maxWords:          null,
      forbiddenPatterns: [],
      requiredTokens:    [],
    },
  },

  // ── FORMAT ───────────────────────────────────────────────────────────────────

  {
    slug:     'format-no-markdown-whatsapp',
    ruleType: 'FORMAT',
    nameEn:   'No Markdown in WhatsApp',
    nameAr:   'بدون Markdown في واتساب',
    nameFr:   'Pas de Markdown dans WhatsApp',
    priority: 80,
    isHard:   true,
    appliesTo: {
      channels:         ['WHATSAPP'],
      personaSlugs:     [],
      countryCodes:     [],
      languageCodes:    [],
      scenarioSlugs:    [],
      businessTypeSlugs:[],
    },
    rule: {
      instruction:
        'Do not use Markdown syntax in WhatsApp messages. ' +
        'No ## headers, no - bullet lists, no [link text](url). ' +
        'WhatsApp supports *bold* and _italic_ natively — use these sparingly (max once per message). ' +
        'Line breaks are written as literal newlines, not <br> or \\n in the template body.',
      goodExamples: [
        '*SmartRestau* — الطلبات الرقمية لمطعمك',
      ],
      badExamples: [
        '## Avantages\n- Commande rapide\n- [Essayer](https://...)',
      ],
      maxChars:          null,
      maxLines:          null,
      maxWords:          null,
      forbiddenPatterns: ['## ', '### ', '- [', '](http'],
      requiredTokens:    [],
    },
  },
]
