/**
 * Seed data for common sales objections.
 * persona slugs are resolved to ObjectIds at seed time.
 * responseTemplates is left empty — populated once templates exist.
 */
export const OBJECTIONS = [
  {
    slug:      'too_expensive',
    category:  'PRICE',
    frequency: 'VERY_HIGH',
    translations: [
      { lang: 'ar', text: 'غالي عليّ، ما عندي ميزانية لهذا' },
      { lang: 'fr', text: 'C\'est trop cher pour moi, je n\'ai pas le budget' },
      { lang: 'en', text: 'It\'s too expensive, I can\'t afford it right now' },
    ],
    personaSlugs: ['traditional_owner', 'young_entrepreneur'],
    isActive: true,
  },
  {
    slug:      'commission_model_unclear',
    category:  'PRICE',
    frequency: 'HIGH',
    translations: [
      { lang: 'ar', text: 'ما فهمتش كيفاش يتحسب الكوميسيون' },
      { lang: 'fr', text: 'Je ne comprends pas comment la commission est calculée' },
      { lang: 'en', text: 'I don\'t understand how the commission is calculated' },
    ],
    personaSlugs: ['traditional_owner', 'multi_branch_manager'],
    isActive: true,
  },
  {
    slug:      'dont_trust_unknown_company',
    category:  'TRUST',
    frequency: 'HIGH',
    translations: [
      { lang: 'ar', text: 'ما نعرفكمش، ما عندي ثقة في شركات جديدة' },
      { lang: 'fr', text: 'Je ne vous connais pas, je n\'ai pas confiance en les nouvelles entreprises' },
      { lang: 'en', text: 'I don\'t know your company, I don\'t trust new startups' },
    ],
    personaSlugs: ['traditional_owner'],
    isActive: true,
  },
  {
    slug:      'data_security_concern',
    category:  'TRUST',
    frequency: 'MEDIUM',
    translations: [
      { lang: 'ar', text: 'بياناتي وبيانات الزبائن ديالي في أمان؟' },
      { lang: 'fr', text: 'Mes données et celles de mes clients sont-elles sécurisées ?' },
      { lang: 'en', text: 'Are my data and my customers\' data secure?' },
    ],
    personaSlugs: ['multi_branch_manager', 'hotel_food_manager'],
    isActive: true,
  },
  {
    slug:      'too_complicated_to_use',
    category:  'COMPLEXITY',
    frequency: 'HIGH',
    translations: [
      { lang: 'ar', text: 'يبان معقد، الموظفين ديالي ما يقدروش يتعلموه' },
      { lang: 'fr', text: 'Ça a l\'air compliqué, mes employés ne pourront pas l\'apprendre' },
      { lang: 'en', text: 'It looks complicated, my staff won\'t be able to learn it' },
    ],
    personaSlugs: ['traditional_owner'],
    isActive: true,
  },
  {
    slug:      'no_wifi_in_restaurant',
    category:  'COMPLEXITY',
    frequency: 'MEDIUM',
    translations: [
      { lang: 'ar', text: 'ما عندناش واي فاي في المطعم' },
      { lang: 'fr', text: 'On n\'a pas de WiFi dans le restaurant' },
      { lang: 'en', text: 'We don\'t have WiFi in the restaurant' },
    ],
    personaSlugs: ['traditional_owner'],
    isActive: true,
  },
  {
    slug:      'not_right_time',
    category:  'TIMING',
    frequency: 'HIGH',
    translations: [
      { lang: 'ar', text: 'الوقت ما مناسبش الآن، رمضان/العطلة/الزحام' },
      { lang: 'fr', text: 'Ce n\'est pas le bon moment, Ramadan/vacances/rush' },
      { lang: 'en', text: 'Not the right time — Ramadan/holidays/peak season' },
    ],
    personaSlugs: ['traditional_owner', 'traiteur_owner'],
    isActive: true,
  },
  {
    slug:      'already_using_competitor',
    category:  'COMPETITION',
    frequency: 'MEDIUM',
    translations: [
      { lang: 'ar', text: 'عندي نظام آخر، ما بغيتش نبدل' },
      { lang: 'fr', text: 'J\'utilise déjà un autre système, je ne veux pas changer' },
      { lang: 'en', text: 'I\'m already using another system, I don\'t want to switch' },
    ],
    personaSlugs: ['young_entrepreneur', 'multi_branch_manager'],
    isActive: true,
  },
  {
    slug:      'dont_need_technology',
    category:  'NECESSITY',
    frequency: 'HIGH',
    translations: [
      { lang: 'ar', text: 'المطعم ديالي صغير، ما محتاجش هذا' },
      { lang: 'fr', text: 'Mon restaurant est petit, je n\'en ai pas besoin' },
      { lang: 'en', text: 'My restaurant is small, I don\'t need this' },
    ],
    personaSlugs: ['traditional_owner'],
    isActive: true,
  },
  {
    slug:      'customers_dont_use_qr',
    category:  'NECESSITY',
    frequency: 'MEDIUM',
    translations: [
      { lang: 'ar', text: 'الزبائن ديالي ما يعرفوش يقراو QR' },
      { lang: 'fr', text: 'Mes clients ne savent pas scanner les QR codes' },
      { lang: 'en', text: 'My customers don\'t know how to scan QR codes' },
    ],
    personaSlugs: ['traditional_owner'],
    isActive: true,
  },
]
