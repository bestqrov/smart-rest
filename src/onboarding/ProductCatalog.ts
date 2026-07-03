// ─── Onboarding — Suggested Product Catalog ─────────────────────────────────
// Country + business-type aware starter menu suggestions, shown as a
// checklist during onboarding so a new cafe can populate its menu in one
// click instead of typing every product by hand. Data lives here (not the
// route) so the same catalog can be reused by both the GET (preview) and
// POST (apply) endpoints without drifting apart.
//
// V1 scope: Morocco only. The shape (country → businessType → categories)
// is intentionally open so more countries can be added later without
// touching the route layer or the onboarding UI — see ProductCatalog.md
// note in this file's history for the extension pattern.

export interface CatalogProduct {
  key:             string   // stable id within its category, used for selection round-trips
  nameAr:          string
  nameFr:          string
  nameEn:          string
  suggestedPrice?: number   // rough reference price in the country's local currency
}

export interface CatalogCategory {
  key:      string
  nameAr:   string
  nameFr:   string
  nameEn:   string
  icon:     string
  products: CatalogProduct[]
}

// Mirrors the BUSINESS_TYPES values used on the signup page
// (app/signup/page.tsx) and Cafe.tier/accountMode conventions.
export type OnboardingBusinessType = 'CAFE' | 'RESTAURANT' | 'TRAITEUR' | 'PASTRY' | 'FOOD_TRUCK' | 'HOTEL'

const MOROCCO_CAFE: CatalogCategory[] = [
  {
    key: 'hot-drinks', icon: '☕', nameAr: 'مشروبات ساخنة', nameFr: 'Boissons chaudes', nameEn: 'Hot drinks',
    products: [
      { key: 'cafe-noir',   nameAr: 'قهوة سوداء',    nameFr: 'Café noir',        nameEn: 'Black coffee',  suggestedPrice: 8 },
      { key: 'cafe-au-lait', nameAr: 'قهوة بالحليب (نص نص)', nameFr: 'Café au lait / Nos-Nos', nameEn: 'Café au lait', suggestedPrice: 10 },
      { key: 'cappuccino',  nameAr: 'كابوتشينو',      nameFr: 'Cappuccino',       nameEn: 'Cappuccino',    suggestedPrice: 15 },
      { key: 'espresso',    nameAr: 'إسبريسو',        nameFr: 'Espresso',         nameEn: 'Espresso',      suggestedPrice: 8 },
      { key: 'the-menthe',  nameAr: 'أتاي بالنعناع',   nameFr: 'Thé à la menthe',  nameEn: 'Mint tea',      suggestedPrice: 8 },
      { key: 'chocolat-chaud', nameAr: 'شوكولاطة ساخنة', nameFr: 'Chocolat chaud', nameEn: 'Hot chocolate', suggestedPrice: 15 },
    ],
  },
  {
    key: 'cold-drinks', icon: '🥤', nameAr: 'مشروبات باردة', nameFr: 'Boissons froides', nameEn: 'Cold drinks',
    products: [
      { key: 'jus-orange',  nameAr: 'عصير برتقال',    nameFr: "Jus d'orange",     nameEn: 'Orange juice',  suggestedPrice: 12 },
      { key: 'jus-avocat',  nameAr: 'عصير أفوكا',     nameFr: "Jus d'avocat",     nameEn: 'Avocado juice', suggestedPrice: 18 },
      { key: 'panache',     nameAr: 'بانشي',          nameFr: 'Panaché',          nameEn: 'Fruit mix juice', suggestedPrice: 18 },
      { key: 'citronnade',  nameAr: 'عصير الليمون',   nameFr: 'Citronnade',       nameEn: 'Lemonade',      suggestedPrice: 12 },
      { key: 'soda',        nameAr: 'مشروب غازي',     nameFr: 'Soda',             nameEn: 'Soda',          suggestedPrice: 8 },
      { key: 'eau-minerale', nameAr: 'ماء معدني',      nameFr: 'Eau minérale',     nameEn: 'Mineral water', suggestedPrice: 5 },
    ],
  },
  {
    key: 'breakfast', icon: '🥐', nameAr: 'فطور وسناكس', nameFr: 'Petit-déjeuner & snacks', nameEn: 'Breakfast & snacks',
    products: [
      { key: 'msemen',   nameAr: 'مسمن',   nameFr: 'Msemen',           nameEn: 'Msemen',           suggestedPrice: 5 },
      { key: 'beghrir',  nameAr: 'بغرير',  nameFr: 'Beghrir',          nameEn: 'Beghrir pancakes', suggestedPrice: 8 },
      { key: 'harcha',   nameAr: 'حرشة',   nameFr: 'Harcha',           nameEn: 'Harcha',           suggestedPrice: 5 },
      { key: 'sfenj',    nameAr: 'سفنج',   nameFr: 'Sfenj (beignets)', nameEn: 'Sfenj donuts',     suggestedPrice: 3 },
      { key: 'croissant', nameAr: 'كرواسون', nameFr: 'Croissant',       nameEn: 'Croissant',        suggestedPrice: 6 },
      { key: 'omelette', nameAr: 'أومليت', nameFr: 'Omelette',         nameEn: 'Omelette',         suggestedPrice: 15 },
    ],
  },
  {
    key: 'pastries', icon: '🍰', nameAr: 'حلويات', nameFr: 'Pâtisseries', nameEn: 'Pastries',
    products: [
      { key: 'corne-gazelle', nameAr: 'كعب الغزال', nameFr: 'Cornes de gazelle', nameEn: "Gazelle horns", suggestedPrice: 4 },
      { key: 'chebakia',      nameAr: 'شباكية',     nameFr: 'Chebakia',          nameEn: 'Chebakia',      suggestedPrice: 4 },
      { key: 'ghriba',        nameAr: 'غريبة',      nameFr: 'Ghriba',            nameEn: 'Ghriba cookies', suggestedPrice: 3 },
      { key: 'gateau-jour',   nameAr: 'حلوى اليوم',  nameFr: 'Gâteau du jour',    nameEn: "Cake of the day", suggestedPrice: 12 },
    ],
  },
]

const MOROCCO_RESTAURANT: CatalogCategory[] = [
  {
    key: 'starters', icon: '🥗', nameAr: 'مقبلات وشوربات', nameFr: 'Entrées & soupes', nameEn: 'Starters & soups',
    products: [
      { key: 'harira',   nameAr: 'حريرة',        nameFr: 'Harira',           nameEn: 'Harira soup',   suggestedPrice: 12 },
      { key: 'salade-marocaine', nameAr: 'سلطة مغربية', nameFr: 'Salade marocaine', nameEn: 'Moroccan salad', suggestedPrice: 15 },
      { key: 'zaalouk',  nameAr: 'زعلوك',        nameFr: 'Zaalouk',          nameEn: 'Zaalouk',       suggestedPrice: 15 },
      { key: 'briouates', nameAr: 'بريوات',       nameFr: 'Briouates',        nameEn: 'Briouates',     suggestedPrice: 20 },
    ],
  },
  {
    key: 'mains', icon: '🍲', nameAr: 'أطباق رئيسية', nameFr: 'Plats principaux', nameEn: 'Main dishes',
    products: [
      { key: 'tajine-poulet', nameAr: 'طاجين دجاج بالليمون والزيتون', nameFr: 'Tajine poulet citron-olives', nameEn: 'Chicken tajine, lemon & olives', suggestedPrice: 60 },
      { key: 'tajine-kefta',  nameAr: 'طاجين كفتة',   nameFr: 'Tajine kefta',      nameEn: 'Kefta tajine',   suggestedPrice: 55 },
      { key: 'couscous',      nameAr: 'كسكس',         nameFr: 'Couscous',          nameEn: 'Couscous',       suggestedPrice: 65 },
      { key: 'pastilla',      nameAr: 'بسطيلة',       nameFr: 'Pastilla',          nameEn: 'Pastilla',       suggestedPrice: 70 },
      { key: 'brochettes',    nameAr: 'مشاوي',         nameFr: 'Brochettes',        nameEn: 'Grilled skewers', suggestedPrice: 50 },
      { key: 'poisson-grille', nameAr: 'سمك مشوي',     nameFr: 'Poisson grillé',    nameEn: 'Grilled fish',   suggestedPrice: 70 },
      { key: 'tanjia',        nameAr: 'طنجية',         nameFr: 'Tanjia',            nameEn: 'Tanjia',         suggestedPrice: 60 },
    ],
  },
  {
    key: 'sides', icon: '🍚', nameAr: 'أطباق جانبية', nameFr: 'Accompagnements', nameEn: 'Sides',
    products: [
      { key: 'khobz',  nameAr: 'خبز مغربي', nameFr: 'Pain marocain', nameEn: 'Moroccan bread', suggestedPrice: 3 },
      { key: 'riz',    nameAr: 'أرز',        nameFr: 'Riz',           nameEn: 'Rice',           suggestedPrice: 15 },
      { key: 'frites', nameAr: 'بطاطا مقلية', nameFr: 'Frites',        nameEn: 'French fries',   suggestedPrice: 15 },
    ],
  },
  { key: 'hot-drinks', ...MOROCCO_CAFE[0]! },
  { key: 'cold-drinks', ...MOROCCO_CAFE[1]! },
]

const MOROCCO_PASTRY: CatalogCategory[] = [
  {
    key: 'moroccan-sweets', icon: '🧁', nameAr: 'حلويات مغربية', nameFr: 'Gâteaux marocains', nameEn: 'Moroccan sweets',
    products: MOROCCO_CAFE[3]!.products, // reuse the same pastry list, not a second definition
  },
  {
    key: 'western-pastry', icon: '🍰', nameAr: 'معجنات غربية', nameFr: 'Pâtisserie occidentale', nameEn: 'Western pastry',
    products: [
      { key: 'pain-chocolat', nameAr: 'بان أو شوكولا', nameFr: 'Pain au chocolat', nameEn: 'Chocolate croissant', suggestedPrice: 7 },
      { key: 'eclair',        nameAr: 'إكلير',         nameFr: 'Éclair',           nameEn: 'Éclair',              suggestedPrice: 15 },
      { key: 'mille-feuille', nameAr: 'ميل-فوي',       nameFr: 'Mille-feuille',     nameEn: 'Mille-feuille',       suggestedPrice: 18 },
      { key: 'cheesecake',    nameAr: 'تشيز كيك',      nameFr: 'Cheesecake',        nameEn: 'Cheesecake',          suggestedPrice: 25 },
      { key: 'tarte',         nameAr: 'تارت فواكه',    nameFr: 'Tarte aux fruits',  nameEn: 'Fruit tart',          suggestedPrice: 20 },
    ],
  },
]

const MOROCCO_FOOD_TRUCK: CatalogCategory[] = [
  {
    key: 'sandwiches', icon: '🌯', nameAr: 'سندويشات', nameFr: 'Sandwichs', nameEn: 'Sandwiches',
    products: [
      { key: 'sandwich-merguez', nameAr: 'سندويش مرقاز', nameFr: 'Sandwich merguez', nameEn: 'Merguez sandwich', suggestedPrice: 20 },
      { key: 'sandwich-kefta',   nameAr: 'سندويش كفتة',  nameFr: 'Sandwich kefta',   nameEn: 'Kefta sandwich',   suggestedPrice: 20 },
      { key: 'sandwich-poulet',  nameAr: 'سندويش دجاج',  nameFr: 'Sandwich poulet',  nameEn: 'Chicken sandwich', suggestedPrice: 22 },
      { key: 'tacos-marocain',   nameAr: 'تاكوس مغربي',  nameFr: 'Tacos marocain',   nameEn: 'Moroccan tacos',   suggestedPrice: 25 },
      { key: 'panini',           nameAr: 'بانيني',       nameFr: 'Panini',           nameEn: 'Panini',           suggestedPrice: 18 },
    ],
  },
  {
    key: 'fast-food', icon: '🍟', nameAr: 'وجبات سريعة', nameFr: 'Fast food', nameEn: 'Fast food',
    products: [
      { key: 'burger',  nameAr: 'برجر',      nameFr: 'Burger',   nameEn: 'Burger',   suggestedPrice: 30 },
      { key: 'frites-truck', nameAr: 'بطاطا مقلية', nameFr: 'Frites', nameEn: 'French fries', suggestedPrice: 12 },
      { key: 'hot-dog', nameAr: 'هوت دوغ',   nameFr: 'Hot-dog',  nameEn: 'Hot dog',  suggestedPrice: 18 },
    ],
  },
  { key: 'cold-drinks', ...MOROCCO_CAFE[1]! },
]

const MOROCCO_TRAITEUR: CatalogCategory[] = [
  {
    key: 'plateaux', icon: '🍱', nameAr: 'صواني', nameFr: 'Plateaux', nameEn: 'Platters',
    products: [
      { key: 'plateau-pastilla', nameAr: 'صينية بسطيلة', nameFr: 'Plateau de pastilla', nameEn: 'Pastilla platter', suggestedPrice: 350 },
      { key: 'plateau-tajines',  nameAr: 'صينية طواجن متنوعة', nameFr: 'Plateau de tajines assortis', nameEn: 'Assorted tajine platter', suggestedPrice: 400 },
      { key: 'plateau-salades',  nameAr: 'صينية سلطات مغربية', nameFr: 'Plateau de salades marocaines', nameEn: 'Moroccan salad platter', suggestedPrice: 200 },
      { key: 'buffet-couscous',  nameAr: 'بوفي كسكس',    nameFr: 'Buffet couscous',    nameEn: 'Couscous buffet', suggestedPrice: 500 },
    ],
  },
  {
    key: 'salted-bites', icon: '🥟', nameAr: 'مقبلات مالحة', nameFr: 'Pièces salées', nameEn: 'Salted bites',
    products: [
      { key: 'briouates-assorties', nameAr: 'بريوات متنوعة', nameFr: 'Briouates assorties', nameEn: 'Assorted briouates', suggestedPrice: 150 },
      { key: 'mini-pastillas', nameAr: 'بسطيلة صغيرة', nameFr: 'Mini pastillas', nameEn: 'Mini pastillas', suggestedPrice: 180 },
    ],
  },
  {
    key: 'event-desserts', icon: '🎂', nameAr: 'حلويات المناسبات', nameFr: 'Desserts événementiels', nameEn: 'Event desserts',
    products: [
      { key: 'piece-montee',  nameAr: 'بييس مونتي', nameFr: 'Pièce montée',        nameEn: 'Croquembouche', suggestedPrice: 600 },
      { key: 'plateau-fruits', nameAr: 'صينية فواكه', nameFr: 'Plateau de fruits',    nameEn: 'Fruit platter', suggestedPrice: 150 },
    ],
  },
]

const MOROCCO_HOTEL: CatalogCategory[] = [
  {
    key: 'room-service', icon: '🛎️', nameAr: 'خدمة الغرف', nameFr: 'Room service', nameEn: 'Room service',
    products: [
      { key: 'petit-dej-continental', nameAr: 'فطور قاري', nameFr: 'Petit-déjeuner continental', nameEn: 'Continental breakfast', suggestedPrice: 80 },
      { key: 'club-sandwich', nameAr: 'كلوب ساندويتش', nameFr: 'Club sandwich', nameEn: 'Club sandwich', suggestedPrice: 60 },
    ],
  },
  { key: 'hot-drinks', ...MOROCCO_CAFE[0]! },
  { key: 'cold-drinks', ...MOROCCO_CAFE[1]! },
  { key: 'mains', ...MOROCCO_RESTAURANT[1]! },
]

const CATALOGS: Record<string, Partial<Record<OnboardingBusinessType, CatalogCategory[]>>> = {
  MA: {
    CAFE:       MOROCCO_CAFE,
    RESTAURANT: MOROCCO_RESTAURANT,
    PASTRY:     MOROCCO_PASTRY,
    FOOD_TRUCK: MOROCCO_FOOD_TRUCK,
    TRAITEUR:   MOROCCO_TRAITEUR,
    HOTEL:      MOROCCO_HOTEL,
  },
}

export function getProductCatalog(country: string, businessType: string): CatalogCategory[] {
  const countryCatalog = CATALOGS[country.trim().toUpperCase()]
  if (!countryCatalog) return []
  return countryCatalog[businessType as OnboardingBusinessType] ?? []
}

export function hasProductCatalog(country: string, businessType: string): boolean {
  return getProductCatalog(country, businessType).length > 0
}

// Resolves a specific set of {categoryKey, productKeys[]} selections back
// into full CatalogCategory/CatalogProduct data from this same catalog —
// never trusts client-supplied names/prices for onboarding-created menu
// items.
export function resolveSelectedProducts(
  country: string, businessType: string, selections: { categoryKey: string; productKeys: string[] }[],
): { category: CatalogCategory; products: CatalogProduct[] }[] {
  const catalog = getProductCatalog(country, businessType)
  const resolved: { category: CatalogCategory; products: CatalogProduct[] }[] = []

  for (const selection of selections) {
    const category = catalog.find(c => c.key === selection.categoryKey)
    if (!category) continue
    const products = category.products.filter(p => selection.productKeys.includes(p.key))
    if (products.length > 0) resolved.push({ category, products })
  }

  return resolved
}
