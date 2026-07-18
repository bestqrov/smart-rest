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
      { key: 'cafe-creme',  nameAr: 'قهوة كريم (نص نص)', nameFr: 'Café crème (Nos-Nos)', nameEn: 'Café crème',   suggestedPrice: 10 },
      { key: 'cafe-noir',   nameAr: 'قهوة سوداء / إكسبريس', nameFr: 'Café noir / Express', nameEn: 'Black coffee / Espresso', suggestedPrice: 8 },
      { key: 'cafe-casse',  nameAr: 'قهوة مهرنسة',   nameFr: 'Café cassé',        nameEn: 'Café cassé',    suggestedPrice: 8 },
      { key: 'cafe-au-lait', nameAr: 'قهوة بالحليب', nameFr: 'Café au lait', nameEn: 'Café au lait', suggestedPrice: 10 },
      { key: 'cappuccino',  nameAr: 'كابوتشينو',      nameFr: 'Cappuccino',       nameEn: 'Cappuccino',    suggestedPrice: 15 },
      { key: 'the-menthe',  nameAr: 'أتاي بالنعناع',   nameFr: 'Thé à la menthe',  nameEn: 'Mint tea',      suggestedPrice: 8 },
      { key: 'the-chiba',   nameAr: 'أتاي بالشيبة',   nameFr: 'Thé absinthe / Chiba', nameEn: 'Absinthe tea (winter)', suggestedPrice: 8 },
      { key: 'chocolat-chaud', nameAr: 'شوكولاطة ساخنة', nameFr: 'Chocolat chaud', nameEn: 'Hot chocolate', suggestedPrice: 15 },
      { key: 'louiza',      nameAr: 'لويزة / أعشاب',  nameFr: 'Verveine / Tisane', nameEn: 'Herbal tea',    suggestedPrice: 8 },
    ],
  },
  {
    key: 'cold-drinks', icon: '🥤', nameAr: 'مشروبات باردة', nameFr: 'Boissons froides', nameEn: 'Cold drinks',
    products: [
      { key: 'jus-orange',  nameAr: 'عصير برتقال طازج', nameFr: "Jus d'orange frais", nameEn: 'Fresh orange juice', suggestedPrice: 12 },
      { key: 'jus-avocat',  nameAr: 'عصير أفوكا (نيتير / بالمكسرات)', nameFr: "Jus d'avocat (nature / aux fruits secs)", nameEn: 'Avocado juice', suggestedPrice: 18 },
      { key: 'panache',     nameAr: 'بانشي',          nameFr: 'Panaché',          nameEn: 'Fruit mix juice', suggestedPrice: 18 },
      { key: 'citronnade',  nameAr: 'عصير الليمون بالنعناع', nameFr: 'Jus de citron / menthe', nameEn: 'Lemon & mint juice', suggestedPrice: 12 },
      { key: 'eau-minerale', nameAr: 'ماء معدني',      nameFr: 'Eau minérale (petite / grande)', nameEn: 'Mineral water', suggestedPrice: 5 },
      { key: 'eau-gazeuse', nameAr: 'ماء غازي',       nameFr: 'Eau gazeuse (Oulmès)', nameEn: 'Sparkling water', suggestedPrice: 8 },
      { key: 'soda',        nameAr: 'مشروب غازي',     nameFr: 'Soda / canette',   nameEn: 'Soda can',      suggestedPrice: 8 },
    ],
  },
  {
    key: 'breakfast', icon: '🥐', nameAr: 'فطور وسناكس', nameFr: 'Petit-déjeuner & snacks', nameEn: 'Breakfast & snacks',
    products: [
      { key: 'ftour-beldi',  nameAr: 'فطور بلدي', nameFr: 'Ftour beldi (khobz, zit, jben, bessara)', nameEn: 'Traditional breakfast set', suggestedPrice: 35 },
      { key: 'ftour-continental', nameAr: 'فطور قاري', nameFr: 'Petit-déjeuner continental', nameEn: 'Continental breakfast', suggestedPrice: 30 },
      { key: 'msemen',   nameAr: 'مسمن',   nameFr: 'Msemen',           nameEn: 'Msemen',           suggestedPrice: 5 },
      { key: 'beghrir',  nameAr: 'بغرير',  nameFr: 'Beghrir',          nameEn: 'Beghrir pancakes', suggestedPrice: 8 },
      { key: 'harcha',   nameAr: 'حرشة',   nameFr: 'Harcha',           nameEn: 'Harcha',           suggestedPrice: 5 },
      { key: 'sfenj',    nameAr: 'سفنج',   nameFr: 'Sfenj (beignets)', nameEn: 'Sfenj donuts',     suggestedPrice: 3 },
      { key: 'croissant', nameAr: 'كرواسون', nameFr: 'Croissant',       nameEn: 'Croissant',        suggestedPrice: 6 },
      { key: 'pain-chocolat', nameAr: 'بان أو شوكولا', nameFr: 'Pain au chocolat', nameEn: 'Chocolate croissant', suggestedPrice: 7 },
      { key: 'omelette', nameAr: 'أومليت', nameFr: 'Omelette',         nameEn: 'Omelette',         suggestedPrice: 15 },
      { key: 'bid-mghli', nameAr: 'بيض بالخليع / مغلي', nameFr: 'Œufs (khli3 / mghli)', nameEn: 'Eggs (khlii / poached)', suggestedPrice: 15 },
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
  {
    key: 'fast-food', icon: '🥪', nameAr: 'وجبات سريعة وسندويشات', nameFr: 'Sandwichs & fast-food', nameEn: 'Sandwiches & fast food',
    products: [
      { key: 'sandwich-thon-oeuf', nameAr: 'سندويش التونة / البيض / البطاطا', nameFr: 'Sandwich thon / œuf / batata', nameEn: 'Tuna / egg / potato sandwich', suggestedPrice: 20 },
      { key: 'sandwich-bocadillo', nameAr: 'سندويش بوكاديو', nameFr: 'Bocadillo',        nameEn: 'Bocadillo sandwich', suggestedPrice: 22 },
      { key: 'panini-poulet',     nameAr: 'بانيني دجاج / شاورما', nameFr: 'Panini poulet / chawarma', nameEn: 'Chicken / shawarma panini', suggestedPrice: 25 },
      { key: 'tacos-marocain',    nameAr: 'تاكوس (بسيط / مضاعف)', nameFr: 'Tacos (simple / double)', nameEn: 'Tacos (simple / double)', suggestedPrice: 28 },
      { key: 'pizza-margherita',  nameAr: 'بيتزا مارغريتا / دجاج', nameFr: 'Pizza margherita / poulet', nameEn: 'Margherita / chicken pizza', suggestedPrice: 40 },
      { key: 'burger-classique',  nameAr: 'برجر كلاسيك / تشيز', nameFr: 'Burger classique / cheese', nameEn: 'Classic / cheese burger', suggestedPrice: 30 },
    ],
  },
  {
    key: 'extras', icon: '➕', nameAr: 'إضافات', nameFr: 'Suppléments / Extras', nameEn: 'Extras / Add-ons',
    products: [
      { key: 'extra-zitoun',  nameAr: 'زيتون زايد',   nameFr: 'Supplément olives',   nameEn: 'Extra olives',   suggestedPrice: 3 },
      { key: 'extra-fromage', nameAr: 'فروماج زايد',  nameFr: 'Supplément fromage',  nameEn: 'Extra cheese',   suggestedPrice: 5 },
      { key: 'extra-khlii',   nameAr: 'خليع زايد',    nameFr: 'Supplément khli3',    nameEn: 'Extra khlii',    suggestedPrice: 8 },
      { key: 'extra-mksarat', nameAr: 'مكسرات فالعصير', nameFr: 'Fruits secs (jus)', nameEn: 'Nuts topping (juice)', suggestedPrice: 5 },
      { key: 'extra-miel',    nameAr: 'عسل زايد',     nameFr: 'Supplément miel',     nameEn: 'Extra honey',    suggestedPrice: 3 },
    ],
  },
]

const MOROCCO_RESTAURANT: CatalogCategory[] = [
  {
    key: 'starters', icon: '🥗', nameAr: 'مقبلات وشوربات', nameFr: 'Entrées & soupes', nameEn: 'Starters & soups',
    products: [
      { key: 'harira',   nameAr: 'حريرة',        nameFr: 'Harira marocaine', nameEn: 'Harira soup',   suggestedPrice: 12 },
      { key: 'soupe-poisson', nameAr: 'شوربة سمك', nameFr: 'Soupe de poissons', nameEn: 'Fish soup', suggestedPrice: 25 },
      { key: 'salade-marocaine', nameAr: 'سلطة مغربية', nameFr: 'Salade marocaine', nameEn: 'Moroccan salad', suggestedPrice: 15 },
      { key: 'zaalouk',  nameAr: 'زعلوك / تكتوكة',  nameFr: 'Zaalouk / Taktouka', nameEn: 'Zaalouk / Taktouka', suggestedPrice: 15 },
      { key: 'salade-composee', nameAr: 'سلطة سيزار / مشكلة', nameFr: 'Salade César / composée', nameEn: 'Caesar / mixed salad', suggestedPrice: 25 },
      { key: 'briouates', nameAr: 'بريوات',       nameFr: 'Briouates',        nameEn: 'Briouates',     suggestedPrice: 20 },
    ],
  },
  {
    key: 'mains', icon: '🍲', nameAr: 'أطباق رئيسية', nameFr: 'Plats principaux', nameEn: 'Main dishes',
    products: [
      { key: 'tajine-poulet', nameAr: 'طاجين دجاج (بالبرقوق / الزيتون والحامض)', nameFr: 'Tajine poulet (berqouq / citron-olives)', nameEn: 'Chicken tajine (prune / lemon-olive)', suggestedPrice: 60 },
      { key: 'tajine-viande', nameAr: 'طاجين لحم (بالبرقوق واللوز / الجلبانة)', nameFr: 'Tajine viande (berqouq-amandes / petits pois)', nameEn: 'Beef tajine (prune-almond / peas)', suggestedPrice: 65 },
      { key: 'tajine-kefta',  nameAr: 'طاجين كفتة بالبيض والماتيشة',   nameFr: 'Tajine kefta (œuf, tomate)',      nameEn: 'Kefta tajine (egg & tomato)',   suggestedPrice: 55 },
      { key: 'couscous',      nameAr: 'كسكس (دجاج / لحم / سبع خضاري / تفاية)', nameFr: 'Couscous (poulet / viande / 7 légumes / tfaya)', nameEn: 'Couscous (chicken / beef / veg / tfaya)', suggestedPrice: 65 },
      { key: 'pastilla',      nameAr: 'بسطيلة (دجاج / مأكولات بحرية)', nameFr: 'Pastilla (poulet / fruits de mer)', nameEn: 'Pastilla (chicken / seafood)', suggestedPrice: 70 },
      { key: 'rafissa',       nameAr: 'رفيسة بالدجاج البلدي', nameFr: 'Rafissa au poulet beldi', nameEn: 'Rafissa with farm chicken', suggestedPrice: 70 },
      { key: 'brochettes',    nameAr: 'مشاوي (ديك رومي / كفتة / كبدة)', nameFr: 'Brochettes (dinde / kefta / foie)', nameEn: 'Grilled skewers (turkey / kefta / liver)', suggestedPrice: 50 },
      { key: 'demi-poulet',   nameAr: 'نصف دجاجة مشوية بالفريت', nameFr: 'Demi-poulet rôti & frites', nameEn: 'Half roast chicken & fries', suggestedPrice: 55 },
      { key: 'friture-poisson', nameAr: 'فريتور سمك (سردين، كالامار، جمبري، سول)', nameFr: 'Friture de poisson (sardine, calamar, crevettes, sole)', nameEn: 'Fried seafood platter', suggestedPrice: 75 },
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
  {
    key: 'desserts', icon: '🍮', nameAr: 'حلويات ومثلجات', nameFr: 'Desserts & pâtisseries', nameEn: 'Desserts & pastries',
    products: [
      ...MOROCCO_CAFE[3]!.products,
      { key: 'flan-caramel', nameAr: 'فلان كراميل / سلطة فواكه', nameFr: 'Flan caramel / Salade de fruits', nameEn: 'Caramel flan / fruit salad', suggestedPrice: 18 },
      { key: 'glace',        nameAr: 'مثلجات (كرات)', nameFr: 'Glaces / sorbets (boules)', nameEn: 'Ice cream / sorbet scoops', suggestedPrice: 15 },
      { key: 'tarte-chocolat', nameAr: 'تارت ليمون / شوكولاطة', nameFr: 'Tarte au citron / chocolat', nameEn: 'Lemon / chocolate tart', suggestedPrice: 22 },
    ],
  },
  { key: 'hot-drinks', ...MOROCCO_CAFE[0]! },
  { key: 'cold-drinks', ...MOROCCO_CAFE[1]! },
  { key: 'extras', ...MOROCCO_CAFE[5]! },
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

// Hotel menus split by service mode (src/routes/auth.ts's Cafe.hotelServiceMode):
// ROOM_SERVICE = in-room ordering only, ON_SITE = hotel's own restaurant/café/bar,
// BOTH (or unset, for legacy accounts) = the union of the two. Distinct from
// MOROCCO_RESTAURANT/MOROCCO_CAFE — a hotel guest menu needs its own framing
// (in-room dining hours, minibar, late-night) even where dish names overlap.
const MOROCCO_HOTEL_ROOM_SERVICE: CatalogCategory[] = [
  {
    key: 'room-service-breakfast', icon: '🥐', nameAr: 'فطور الغرف', nameFr: 'Petit-déjeuner en chambre', nameEn: 'In-room breakfast',
    products: [
      { key: 'petit-dej-continental', nameAr: 'فطور قاري', nameFr: 'Petit-déjeuner continental', nameEn: 'Continental breakfast', suggestedPrice: 90 },
      { key: 'petit-dej-marocain', nameAr: 'فطور مغربي كامل', nameFr: 'Petit-déjeuner marocain complet', nameEn: 'Full Moroccan breakfast', suggestedPrice: 110 },
      { key: 'petit-dej-anglais', nameAr: 'فطور إنجليزي', nameFr: 'Petit-déjeuner anglais', nameEn: 'English breakfast', suggestedPrice: 130 },
      { key: 'oeufs-choix', nameAr: 'بيض حسب الاختيار (أومليت / مسلوق / مقلي)', nameFr: 'Œufs au choix (omelette / à la coque / au plat)', nameEn: 'Eggs your way (omelette / boiled / fried)', suggestedPrice: 60 },
      { key: 'viennoiserie-panier', nameAr: 'سلة معجنات', nameFr: 'Panier de viennoiseries', nameEn: 'Pastry basket', suggestedPrice: 45 },
      { key: 'fruits-frais', nameAr: 'صحن فواكه طازجة', nameFr: 'Assiette de fruits frais', nameEn: 'Fresh fruit plate', suggestedPrice: 50 },
    ],
  },
  {
    key: 'room-service-all-day', icon: '🍽️', nameAr: 'قائمة اليوم كامل بالغرفة', nameFr: 'Carte all-day dining', nameEn: 'All-day in-room dining',
    products: [
      { key: 'club-sandwich', nameAr: 'كلوب ساندويتش', nameFr: 'Club sandwich', nameEn: 'Club sandwich', suggestedPrice: 90 },
      { key: 'salade-cesar-chambre', nameAr: 'سلطة سيزار', nameFr: 'Salade César', nameEn: 'Caesar salad', suggestedPrice: 85 },
      { key: 'burger-chambre', nameAr: 'برجر شيف', nameFr: "Burger de l'hôtel", nameEn: "House burger", suggestedPrice: 110 },
      { key: 'pates-chambre', nameAr: 'باستا (بولونيز / أربياتا)', nameFr: 'Pâtes (bolognaise / arrabiata)', nameEn: 'Pasta (bolognese / arrabbiata)', suggestedPrice: 95 },
      { key: 'tajine-chambre', nameAr: 'طاجين دجاج بالزيتون', nameFr: 'Tajine de poulet aux olives', nameEn: 'Chicken tajine with olives', suggestedPrice: 120 },
      { key: 'soupe-du-jour', nameAr: 'شوربة اليوم', nameFr: 'Soupe du jour', nameEn: 'Soup of the day', suggestedPrice: 55 },
    ],
  },
  {
    key: 'minibar-snacks', icon: '🍫', nameAr: 'ميني بار وسناكس', nameFr: 'Minibar & en-cas', nameEn: 'Minibar & snacks',
    products: [
      { key: 'chips-minibar', nameAr: 'شيبس', nameFr: 'Chips', nameEn: 'Chips', suggestedPrice: 30 },
      { key: 'chocolat-minibar', nameAr: 'شوكولاطة', nameFr: 'Barre chocolatée', nameEn: 'Chocolate bar', suggestedPrice: 35 },
      { key: 'noix-minibar', nameAr: 'مكسرات مشكلة', nameFr: 'Mélange de noix', nameEn: 'Mixed nuts', suggestedPrice: 40 },
      { key: 'eau-minerale', nameAr: 'ماء معدني', nameFr: 'Eau minérale', nameEn: 'Mineral water', suggestedPrice: 20 },
      { key: 'soda-minibar', nameAr: 'مشروب غازي', nameFr: 'Soda', nameEn: 'Soft drink', suggestedPrice: 25 },
      { key: 'biere-minibar', nameAr: 'جعة', nameFr: 'Bière', nameEn: 'Beer', suggestedPrice: 50 },
    ],
  },
  {
    key: 'late-night', icon: '🌙', nameAr: 'قائمة الليل', nameFr: 'Carte de nuit', nameEn: 'Late-night menu',
    products: [
      { key: 'sandwich-nuit', nameAr: 'سندويش سريع', nameFr: 'Sandwich rapide', nameEn: 'Quick sandwich', suggestedPrice: 70 },
      { key: 'soupe-nuit', nameAr: 'حريرة ساخنة', nameFr: 'Harira chaude', nameEn: 'Hot harira soup', suggestedPrice: 45 },
      { key: 'the-tisane-nuit', nameAr: 'أتاي / أعشاب', nameFr: 'Thé / tisane', nameEn: 'Tea / herbal infusion', suggestedPrice: 25 },
    ],
  },
]

const MOROCCO_HOTEL_ON_SITE: CatalogCategory[] = [
  { key: 'hotel-hot-drinks', ...MOROCCO_CAFE[0]! },
  { key: 'hotel-cold-drinks', ...MOROCCO_CAFE[1]! },
  { key: 'hotel-starters', ...MOROCCO_RESTAURANT[0]! },
  { key: 'hotel-mains', ...MOROCCO_RESTAURANT[1]! },
  { key: 'hotel-desserts', ...MOROCCO_RESTAURANT[3]! },
  {
    key: 'hotel-bar', icon: '🍸', nameAr: 'بار الفندق', nameFr: 'Bar de l\'hôtel', nameEn: 'Hotel bar',
    products: [
      { key: 'cocktail-sans-alcool', nameAr: 'كوكتيل بدون كحول', nameFr: 'Cocktail sans alcool', nameEn: 'Mocktail', suggestedPrice: 60 },
      { key: 'biere-bar', nameAr: 'جعة', nameFr: 'Bière', nameEn: 'Beer', suggestedPrice: 55 },
      { key: 'vin-verre', nameAr: 'كأس نبيذ', nameFr: 'Verre de vin', nameEn: 'Glass of wine', suggestedPrice: 70 },
      { key: 'jus-frais-bar', nameAr: 'عصير طازج', nameFr: 'Jus frais', nameEn: 'Fresh juice', suggestedPrice: 35 },
    ],
  },
]

const MOROCCO_HOTEL: CatalogCategory[] = [...MOROCCO_HOTEL_ROOM_SERVICE, ...MOROCCO_HOTEL_ON_SITE]

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

const HOTEL_CATALOGS_BY_MODE: Record<string, Record<string, CatalogCategory[]>> = {
  MA: {
    ROOM_SERVICE: MOROCCO_HOTEL_ROOM_SERVICE,
    ON_SITE:      MOROCCO_HOTEL_ON_SITE,
    BOTH:         MOROCCO_HOTEL,
  },
}

// hotelServiceMode ('ROOM_SERVICE' | 'ON_SITE' | 'BOTH') narrows the Hotel
// catalog to only the categories relevant to how the hotel actually
// operates — undefined/unrecognised falls back to the full combined list
// (legacy accounts created before hotelServiceMode existed).
export function getProductCatalog(country: string, businessType: string, hotelServiceMode?: string): CatalogCategory[] {
  const countryCode = country.trim().toUpperCase()
  if (businessType === 'HOTEL' && hotelServiceMode) {
    const modeCatalog = HOTEL_CATALOGS_BY_MODE[countryCode]?.[hotelServiceMode]
    if (modeCatalog) return modeCatalog
  }
  const countryCatalog = CATALOGS[countryCode]
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
  country: string, businessType: string, selections: { categoryKey: string; productKeys: string[] }[], hotelServiceMode?: string,
): { category: CatalogCategory; products: CatalogProduct[] }[] {
  const catalog = getProductCatalog(country, businessType, hotelServiceMode)
  const resolved: { category: CatalogCategory; products: CatalogProduct[] }[] = []

  for (const selection of selections) {
    const category = catalog.find(c => c.key === selection.categoryKey)
    if (!category) continue
    const products = category.products.filter(p => selection.productKeys.includes(p.key))
    if (products.length > 0) resolved.push({ category, products })
  }

  return resolved
}
