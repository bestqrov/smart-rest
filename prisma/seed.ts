import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CatDef = { nameEn: string; nameAr: string; order: number }
type PrdDef = { cat: string; nameEn: string; nameAr: string; price: number; description: string }

// ═══════════════════════════════════════════════════════════════════════════════
// 🇲🇦  MOROCCO — Café de la Plage, Agadir  (currency: MAD)
// ═══════════════════════════════════════════════════════════════════════════════

const MA_CATS: CatDef[] = [
  { nameEn: 'Breakfast',             nameAr: 'الفطور',                order: 1 },
  { nameEn: 'Starters & Salads',     nameAr: 'المقبلات والسلطات',     order: 2 },
  { nameEn: 'Traditional Moroccan',  nameAr: 'أطباق مغربية تقليدية', order: 3 },
  { nameEn: 'Grills & Sandwiches',   nameAr: 'مشاوي وسندويشات',       order: 4 },
  { nameEn: 'Hot Drinks',            nameAr: 'مشروبات ساخنة',         order: 5 },
  { nameEn: 'Cold Drinks & Juices',  nameAr: 'مشروبات باردة وعصائر', order: 6 },
  { nameEn: 'Desserts',              nameAr: 'الحلويات',               order: 7 },
]

const MA_PRODUCTS: PrdDef[] = [
  // Breakfast
  { cat: 'Breakfast', nameEn: 'Moroccan Breakfast Plate',  nameAr: 'فطور مغربي كامل',      price: 65,  description: 'مسمن، عسل، زيت أركان، جبن وأتاي — Msemen, honey, argan oil, cheese & mint tea' },
  { cat: 'Breakfast', nameEn: 'Msemen with Honey',         nameAr: 'مسمن بالعسل',           price: 30,  description: 'رغايف مقرمشة مع عسل الثُّمام — Crispy msemen drizzled with wild honey' },
  { cat: 'Breakfast', nameEn: 'Baghrir (1000 Holes)',      nameAr: 'بغرير',                 price: 28,  description: 'فطائر السميد الإسفنجية مع الزبدة والعسل' },
  { cat: 'Breakfast', nameEn: 'Avocado Toast',             nameAr: 'توست بالأفوكادو',       price: 55,  description: 'خبز محمص، أفوكادو مهروس، بيضة مسلوقة، فلفل حار' },
  { cat: 'Breakfast', nameEn: 'Croissant & Cappuccino',    nameAr: 'كرواسون وكابتشينو',     price: 45,  description: 'كرواسون زبدة طازج مع كابتشينو ناعم' },

  // Starters
  { cat: 'Starters & Salads', nameEn: 'Zaalouk',           nameAr: 'زعلوك',                 price: 35,  description: 'سلطة الباذنجان والطماطم المشوية بالكمون وزيت الزيتون' },
  { cat: 'Starters & Salads', nameEn: 'Taktouka',          nameAr: 'تكتوكة',                price: 35,  description: 'فلفل وطماطم مشوية بالثوم والتوابل' },
  { cat: 'Starters & Salads', nameEn: 'Briouats (4 pcs)',  nameAr: 'برويات (4 حبات)',       price: 40,  description: 'فطائر ورقة محشوة بالجبن والأعشاب' },
  { cat: 'Starters & Salads', nameEn: 'House Salad',       nameAr: 'سلطة المنزل',           price: 38,  description: 'خضراوات طازجة، طماطم، خيار، زيتون، صلصة الحمضيات' },

  // Traditional
  { cat: 'Traditional Moroccan', nameEn: 'Tajine Kefta & Egg',        nameAr: 'طاجين كفتة وبيض',        price: 90,  description: 'كفتة مبهّرة في صلصة الطماطم مع البيض' },
  { cat: 'Traditional Moroccan', nameEn: 'Tajine Chicken & Olives',   nameAr: 'طاجين دجاج وزيتون',      price: 95,  description: 'دجاج مطهو ببطء مع الليمون المحفوظ والزيتون' },
  { cat: 'Traditional Moroccan', nameEn: 'Lamb Couscous',             nameAr: 'كسكس بالخضر واللحم',     price: 110, description: 'كسكس مغربي أصيل بسبع خضراوات ولحم الغنم' },
  { cat: 'Traditional Moroccan', nameEn: 'Harira Soup',               nameAr: 'حريرة',                  price: 30,  description: 'شوربة الطماطم والعدس والحمص الكلاسيكية' },
  { cat: 'Traditional Moroccan', nameEn: 'Pastilla au Poulet',        nameAr: 'بسطيلة بالدجاج',         price: 85,  description: 'عجين ورقة محشو بالدجاج، لوز، قرفة وبيض' },

  // Grills
  { cat: 'Grills & Sandwiches', nameEn: 'Mixed Grill Platter', nameAr: 'طبق مشاوي مشكل',  price: 100, description: 'برochettes دجاج + مرقاز + كفتة مع فريت وصلصة' },
  { cat: 'Grills & Sandwiches', nameEn: 'Merguez Sandwich',    nameAr: 'سندويش مرقاز',    price: 45,  description: 'مرقاز حار في خبز مع حريصة وفريت' },
  { cat: 'Grills & Sandwiches', nameEn: 'Chicken Burger',      nameAr: 'برغر دجاج',       price: 58,  description: 'دجاج مقرمش، كول سلو، خيار مخلل، صلصة خاصة' },
  { cat: 'Grills & Sandwiches', nameEn: 'Frites (side)',        nameAr: 'فريت',            price: 22,  description: 'بطاطس مقلية ذهبية مع صلصة أيولي' },

  // Hot Drinks
  { cat: 'Hot Drinks', nameEn: 'Moroccan Mint Tea',  nameAr: 'أتاي مغربي',    price: 22, description: 'شاي أخضر بالنعناع الطازج والسكر — على الطريقة المغربية' },
  { cat: 'Hot Drinks', nameEn: 'Espresso',           nameAr: 'إسبريسو',       price: 18, description: 'شوت إسبريسو مركّز من أراביكا فاخرة' },
  { cat: 'Hot Drinks', nameEn: 'Cappuccino',         nameAr: 'كابتشينو',      price: 28, description: 'إسبريسو مع رغوة حليب مخملية' },
  { cat: 'Hot Drinks', nameEn: 'Café au Lait',       nameAr: 'قهوة بالحليب', price: 22, description: 'قهوة قوية مع حليب ساخن' },

  // Cold Drinks
  { cat: 'Cold Drinks & Juices', nameEn: 'Fresh Orange Juice', nameAr: 'عصير برتقال طازج', price: 25, description: '4 برتقالات مغربية طازجة — بدون سكر' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Avocado Smoothie',   nameAr: 'سموثي أفوكادو',    price: 38, description: 'أفوكادو كريمي مع حليب وعسل وماء الورد' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Lemon Mint Cooler',  nameAr: 'ليمون نعناع مثلج', price: 28, description: 'ليمون طازج ونعناع مع ماء غازي وثلج' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Iced Latte',         nameAr: 'آيس لاتيه',        price: 35, description: 'إسبريسو بارد مع حليب وثلج' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Mineral Water',      nameAr: 'ماء معدني',         price: 12, description: 'ساكن أو غازي' },

  // Desserts
  { cat: 'Desserts', nameEn: 'Chebakia',            nameAr: 'شباكية',          price: 25, description: 'حلوى السمسم والعسل المقلية بماء الزهر' },
  { cat: 'Desserts', nameEn: 'Kaab el Ghzal',       nameAr: 'كعب الغزال',      price: 28, description: 'معجنات هلالية محشوة باللوز مع السكر البودرة' },
  { cat: 'Desserts', nameEn: 'Crème Brûlée',        nameAr: 'كريم بروليه',     price: 40, description: 'كاسترد الفانيليا مع طبقة كراميل مكرملة' },
  { cat: 'Desserts', nameEn: 'Chocolate Lava Cake', nameAr: 'كيك الشوكولاتة', price: 45, description: 'كعكة شوكولاتة دافئة بمركز سائل' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// 🇸🇦  SAUDI ARABIA — مطعم نجد الأصيل، الرياض  (currency: SAR)
// ═══════════════════════════════════════════════════════════════════════════════

const SA_CATS: CatDef[] = [
  { nameEn: 'Appetizers',         nameAr: 'المقبلات',          order: 1 },
  { nameEn: 'Traditional Saudi',  nameAr: 'الأطباق السعودية',  order: 2 },
  { nameEn: 'Grills & Kabsa',     nameAr: 'المشاوي والكبسة',   order: 3 },
  { nameEn: 'Shawarma & Sandwiches', nameAr: 'شاورما وسندويشات', order: 4 },
  { nameEn: 'Arabic Coffee & Tea', nameAr: 'القهوة العربية والشاي', order: 5 },
  { nameEn: 'Fresh Juices',       nameAr: 'العصائر الطازجة',   order: 6 },
  { nameEn: 'Arabic Sweets',      nameAr: 'الحلوى العربية',    order: 7 },
]

const SA_PRODUCTS: PrdDef[] = [
  // Appetizers
  { cat: 'Appetizers', nameEn: 'Hummus & Khobz',     nameAr: 'حمص بالطحينة',       price: 18, description: 'حمص ناعم بالطحينة وزيت الزيتون مع خبز عربي طازج' },
  { cat: 'Appetizers', nameEn: 'Mutabbal',            nameAr: 'متبل',               price: 18, description: 'باذنجان مشوي مهروس بالطحينة والثوم والليمون' },
  { cat: 'Appetizers', nameEn: 'Fattoush Salad',      nameAr: 'فتوش',               price: 22, description: 'سلطة الخضار الطازجة مع الخبز المحمص وصلصة الرمان' },
  { cat: 'Appetizers', nameEn: 'Soup of the Day',     nameAr: 'شوربة اليوم',        price: 20, description: 'شوربة طازجة تُحضَّر يومياً' },
  { cat: 'Appetizers', nameEn: 'Vine Leaves (12 pcs)', nameAr: 'ورق عنب (12 حبة)', price: 28, description: 'ورق عنب محشو بالأرز واللحم والتوابل' },

  // Traditional Saudi
  { cat: 'Traditional Saudi', nameEn: 'Kabsa Lamb',       nameAr: 'كبسة لحم غنم',    price: 75, description: 'أرز بسمتي بالتوابل السعودية مع لحم الغنم الطري' },
  { cat: 'Traditional Saudi', nameEn: 'Kabsa Chicken',    nameAr: 'كبسة دجاج',       price: 58, description: 'دجاج مشوي كامل على أرز الكبسة العطري' },
  { cat: 'Traditional Saudi', nameEn: 'Mandi Lamb',       nameAr: 'مندي لحم',        price: 85, description: 'لحم غنم مطهو ببطء فوق الفحم مع أرز المندي' },
  { cat: 'Traditional Saudi', nameEn: 'Jareesh',          nameAr: 'جريش',            price: 35, description: 'قمح مكسور مطهو مع الدجاج والتوابل — طبق نجدي أصيل' },
  { cat: 'Traditional Saudi', nameEn: 'Saleeg (White Rice)', nameAr: 'سليق',         price: 45, description: 'أرز أبيض مطهو بحليب الدجاج مع البهارات' },

  // Grills
  { cat: 'Grills & Kabsa', nameEn: 'Mixed Grill Platter', nameAr: 'مشاوي مشكلة',    price: 95, description: 'تشكيلة من كباب اللحم والدجاج والكفتة مع الأرز والخبز' },
  { cat: 'Grills & Kabsa', nameEn: 'Lamb Chops',          nameAr: 'ضلوع الخروف',    price: 110, description: 'ضلوع خروف مشوية بالتوابل السعودية مع الأرز' },
  { cat: 'Grills & Kabsa', nameEn: 'Grilled Chicken',     nameAr: 'دجاج مشوي',      price: 55, description: 'نصف دجاجة مشوية بالبهارات مع أرز أو خبز' },
  { cat: 'Grills & Kabsa', nameEn: 'Kofta Skewers',       nameAr: 'كفتة مشوية',     price: 48, description: 'كفتة لحم عجل مشوية مع صلصة الثوم والتحينة' },

  // Shawarma
  { cat: 'Shawarma & Sandwiches', nameEn: 'Chicken Shawarma',  nameAr: 'شاورما دجاج',  price: 22, description: 'شاورما دجاج بالثوم والمخللات في خبز عربي' },
  { cat: 'Shawarma & Sandwiches', nameEn: 'Meat Shawarma',     nameAr: 'شاورما لحم',   price: 28, description: 'شاورما لحم عجل بالطحينة والبندورة' },
  { cat: 'Shawarma & Sandwiches', nameEn: 'Falafel Sandwich',  nameAr: 'سندويش فلافل', price: 18, description: 'فلافل مقرمش مع السلطة والطحينة في خبز عربي' },

  // Coffee & Tea
  { cat: 'Arabic Coffee & Tea', nameEn: 'Arabic Coffee (Qahwa)', nameAr: 'قهوة عربية (قهوة)', price: 15, description: 'قهوة عربية أصيلة بالهيل والزعفران — يُقدَّم مع التمر' },
  { cat: 'Arabic Coffee & Tea', nameEn: 'Saudi Tea (Shai)',       nameAr: 'شاي سعودي',         price: 12, description: 'شاي بالنعناع أو السادة — كيفك' },
  { cat: 'Arabic Coffee & Tea', nameEn: 'Cappuccino',             nameAr: 'كابتشينو',          price: 22, description: 'إسبريسو مع رغوة حليب ناعمة' },
  { cat: 'Arabic Coffee & Tea', nameEn: 'Karak Chai',             nameAr: 'شاي كرك',           price: 14, description: 'شاي بالحليب والهيل — على الطريقة الخليجية' },

  // Juices
  { cat: 'Fresh Juices', nameEn: 'Fresh Mango Juice',    nameAr: 'عصير مانجو طازج',  price: 22, description: 'مانجو طازج كامل، بدون إضافات' },
  { cat: 'Fresh Juices', nameEn: 'Lemon Mint',           nameAr: 'ليمون نعناع',      price: 18, description: 'ليمون طازج مع نعناع وماء غازي' },
  { cat: 'Fresh Juices', nameEn: 'Watermelon Juice',     nameAr: 'عصير بطيخ',        price: 18, description: 'بطيخ طازج بدون سكر' },
  { cat: 'Fresh Juices', nameEn: 'Water (500ml)',         nameAr: 'ماء معدني',         price:  5, description: 'ماء معدني بارد' },

  // Sweets
  { cat: 'Arabic Sweets', nameEn: 'Luqaimat',           nameAr: 'لقيمات',           price: 22, description: 'كرات عجين مقلية مع ديبس التمر والسمسم' },
  { cat: 'Arabic Sweets', nameEn: 'Kunafa',              nameAr: 'كنافة',            price: 28, description: 'كنافة بالجبن مع شيرة الزهر' },
  { cat: 'Arabic Sweets', nameEn: 'Dates Platter',       nameAr: 'طبق تمور فاخر',   price: 35, description: 'تشكيلة من تمور المدينة والمجدول والسكري' },
  { cat: 'Arabic Sweets', nameEn: 'Umm Ali',             nameAr: 'أم علي',           price: 28, description: 'حلى الخبز بالحليب والمكسرات والزبيب — يُقدَّم ساخناً' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// 🇦🇪  UAE — مطعم الخليج، دبي  (currency: AED)
// ═══════════════════════════════════════════════════════════════════════════════

const AE_CATS: CatDef[] = [
  { nameEn: 'Cold Mezze',          nameAr: 'المقبلات الباردة',     order: 1 },
  { nameEn: 'Hot Mezze',           nameAr: 'المقبلات الساخنة',     order: 2 },
  { nameEn: 'Emirati Specialties', nameAr: 'الأطباق الإماراتية',   order: 3 },
  { nameEn: 'Grills & Seafood',    nameAr: 'المشاوي والمأكولات البحرية', order: 4 },
  { nameEn: 'Rice Dishes',         nameAr: 'أطباق الأرز',           order: 5 },
  { nameEn: 'Beverages',           nameAr: 'المشروبات',             order: 6 },
  { nameEn: 'Desserts',            nameAr: 'الحلويات',              order: 7 },
]

const AE_PRODUCTS: PrdDef[] = [
  // Cold Mezze
  { cat: 'Cold Mezze', nameEn: 'Hummus Beiruti',    nameAr: 'حمص بيروتي',        price: 28, description: 'حمص ناعم بالطحينة وزيت الزيتون البكر مع البقدونس' },
  { cat: 'Cold Mezze', nameEn: 'Fattoush',          nameAr: 'فتوش',              price: 32, description: 'سلطة الخضار الطازجة والخبز المحمص بصلصة الرمان' },
  { cat: 'Cold Mezze', nameEn: 'Tabbouleh',         nameAr: 'تبولة',             price: 30, description: 'بقدونس طازج، برغل، طماطم، خيار، ليمون وزيت' },
  { cat: 'Cold Mezze', nameEn: 'Mixed Pickles',     nameAr: 'مخللات مشكلة',      price: 22, description: 'تشكيلة مخللات بيتية متنوعة' },

  // Hot Mezze
  { cat: 'Hot Mezze', nameEn: 'Falafel (8 pcs)',    nameAr: 'فلافل (8 حبات)',    price: 28, description: 'كرات حمص وفول مقلية بالأعشاب والتوابل' },
  { cat: 'Hot Mezze', nameEn: 'Cheese Sambousek',   nameAr: 'سمبوسك جبن',        price: 32, description: 'معجنات مثلثة محشوة بالجبن مع صلصة الثوم' },
  { cat: 'Hot Mezze', nameEn: 'Arayes',             nameAr: 'عرايس لحم',         price: 38, description: 'خبز عربي محشو بالكفتة والبهارات مشوي على الفحم' },
  { cat: 'Hot Mezze', nameEn: 'Manakish Zaatar',    nameAr: 'مناقيش زعتر',       price: 28, description: 'فطيرة الزعتر والزيت الطازجة من الفرن الحجري' },

  // Emirati Specialties
  { cat: 'Emirati Specialties', nameEn: 'Harees',          nameAr: 'هريس',           price: 55, description: 'قمح ولحم مطهو ببطء مع السمن والتوابل الإماراتية' },
  { cat: 'Emirati Specialties', nameEn: 'Biryani Emirati', nameAr: 'برياني إماراتي', price: 72, description: 'أرز بسمتي معطر بالزعفران مع الدجاج أو الخروف' },
  { cat: 'Emirati Specialties', nameEn: 'Thareed',         nameAr: 'ثريد لحم',       price: 65, description: 'خبز رقيق مع مرق لحم الغنم والخضار — طبق رمضاني أصيل' },
  { cat: 'Emirati Specialties', nameEn: 'Machboos Shrimp', nameAr: 'مجبوس ربيان',    price: 85, description: 'أرز البسمتي مع الروبيان الطازج وبهارات اللوومي' },

  // Grills & Seafood
  { cat: 'Grills & Seafood', nameEn: 'Hammour Fillet',     nameAr: 'فيليه هامور',    price: 95,  description: 'هامور خليجي طازج مشوي مع أرز الزعفران وصلصة الثوم' },
  { cat: 'Grills & Seafood', nameEn: 'Grilled Prawns',     nameAr: 'جمبري مشوي',     price: 88,  description: '6 جمبريات كبيرة مشوية بزيت الليمون والأعشاب' },
  { cat: 'Grills & Seafood', nameEn: 'Mixed Grill',         nameAr: 'مشاوي مشكلة',    price: 105, description: 'كباب دجاج ولحم عجل مع الخبز وصلصتان' },
  { cat: 'Grills & Seafood', nameEn: 'Lamb Ouzi',          nameAr: 'أوزي خروف',      price: 130, description: 'خروف كامل مطهو على البخار مع أرز البسمتي والمكسرات' },

  // Rice Dishes
  { cat: 'Rice Dishes', nameEn: 'Kabsa Chicken',     nameAr: 'كبسة دجاج',        price: 62, description: 'دجاج مع أرز الكبسة العطري بالتوابل الخليجية' },
  { cat: 'Rice Dishes', nameEn: 'Maklooba Lamb',     nameAr: 'مقلوبة لحم',       price: 75, description: 'أرز مقلوب مع اللحم والباذنجان والقرنبيط' },
  { cat: 'Rice Dishes', nameEn: 'Saffron Rice',      nameAr: 'أرز الزعفران',     price: 30, description: 'أرز بسمتي مع زعفران إيراني أصيل ومكسرات' },

  // Beverages
  { cat: 'Beverages', nameEn: 'Arabic Coffee',       nameAr: 'قهوة عربية',       price: 18, description: 'قهوة بيضاء بالهيل والزعفران مع التمر — الترحيب الإماراتي' },
  { cat: 'Beverages', nameEn: 'Karak Tea',           nameAr: 'شاي كرك',          price: 15, description: 'شاي بالحليب والهيل الأصيل' },
  { cat: 'Beverages', nameEn: 'Lemon Mint Juice',    nameAr: 'عصير ليمون نعناع', price: 22, description: 'ليمون طازج ونعناع مع ماء غازي وثلج مجروش' },
  { cat: 'Beverages', nameEn: 'Fresh Mango Lassi',   nameAr: 'لاسي مانجو',       price: 28, description: 'مانجو طازج مع لبن رائب وعسل' },
  { cat: 'Beverages', nameEn: 'Watermelon Juice',    nameAr: 'عصير بطيخ طازج',   price: 20, description: 'بطيخ أحمر طازج ممزوج بدون سكر' },
  { cat: 'Beverages', nameEn: 'Mineral Water',       nameAr: 'مياه معدنية',      price:  8, description: 'ساكنة أو غازية' },

  // Desserts
  { cat: 'Desserts', nameEn: 'Luqaimat',             nameAr: 'لقيمات',           price: 28, description: 'كرات عجين مقلية مغمورة بديبس التمر والسمسم' },
  { cat: 'Desserts', nameEn: 'Kunafa Nabulsieh',     nameAr: 'كنافة نابلسية',    price: 35, description: 'كنافة بالجبن العكاوي وشيرة الزهر — طازجة من الفرن' },
  { cat: 'Desserts', nameEn: 'Saffron Ice Cream',    nameAr: 'آيس كريم زعفران', price: 32, description: 'آيس كريم مصنوع يدوياً بالزعفران والهيل والفستق' },
  { cat: 'Desserts', nameEn: 'Date Cake',            nameAr: 'كيك التمر',        price: 38, description: 'كيك التمر الدافئ مع صلصة التوفي وآيس كريم الفانيليا' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

async function upsertCafe(data: {
  subdomain: string; name: string; country: string; currency: string
  lat?: number; lng?: number
  adminEmail: string; adminPassword: string
}) {
  const { adminEmail, adminPassword, ...cafeData } = data

  const cafe = await prisma.cafe.upsert({
    where: { subdomain: cafeData.subdomain },
    update: { name: cafeData.name, currency: cafeData.currency, isActive: true },
    create: { ...cafeData, isActive: true, billingStatus: 'GRACE_PERIOD' },
  })

  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existingUser) {
    const passwordHash = await hashPassword(adminPassword)
    await prisma.user.create({ data: { email: adminEmail, passwordHash, cafeId: cafe.id } })
    console.log(`  👤 Admin created: ${adminEmail} / ${adminPassword}`)
  } else {
    console.log(`  👤 Admin exists:  ${adminEmail}`)
  }

  return cafe
}

// Demo staff: cashier PIN 1234 · waiter PIN 2222 · supervisor PIN 3333
const DEMO_STAFF = [
  { name: 'Demo Cashier',    role: 'CASHIER'    as const, pin: '1234' },
  { name: 'Demo Waiter',     role: 'WAITER'     as const, pin: '2222' },
  { name: 'Demo Supervisor', role: 'SUPERVISOR' as const, pin: '3333' },
]

async function upsertDemoStaff(cafeId: string) {
  for (const s of DEMO_STAFF) {
    const exists = await prisma.staff.findFirst({ where: { cafeId, name: s.name } })
    if (!exists) {
      const pinCode = await bcrypt.hash(s.pin, 10)
      await prisma.staff.create({ data: { cafeId, name: s.name, role: s.role, pinCode, isActive: true } })
      console.log(`  🪪 Staff created: ${s.name} (PIN: ${s.pin})`)
    } else {
      console.log(`  🪪 Staff exists:  ${s.name}`)
    }
  }
}

async function upsertMenu(cafeId: string, cats: CatDef[], products: PrdDef[]) {
  const catMap: Record<string, string> = {}
  for (const c of cats) {
    let cat = await prisma.category.findFirst({ where: { cafeId, nameEn: c.nameEn } })
    if (!cat) {
      cat = await prisma.category.create({ data: { cafeId, nameEn: c.nameEn, nameAr: c.nameAr, order: c.order } })
      console.log(`    + ${c.nameEn}`)
    }
    catMap[c.nameEn] = cat.id
  }

  let created = 0
  for (const p of products) {
    const categoryId = catMap[p.cat]
    if (!categoryId) continue
    const exists = await prisma.product.findFirst({ where: { categoryId, nameEn: p.nameEn } })
    if (!exists) {
      await prisma.product.create({ data: { categoryId, nameEn: p.nameEn, nameAr: p.nameAr, description: p.description, price: p.price, isAvailable: true } })
      created++
    }
  }
  return { cats: cats.length, products: created }
}

async function upsertTablesAndSeats(cafeId: string, subdomain: string, tableCount = 5, seatsPerTable = 4) {
  console.log(`\n  📋 QR test URLs:`)
  for (let tNum = 1; tNum <= tableCount; tNum++) {
    let table = await prisma.table.findFirst({ where: { cafeId, tableNumber: tNum } })
    if (!table) table = await prisma.table.create({ data: { cafeId, tableNumber: tNum, qrToken: randomUUID(), isActive: true } })

    for (let sNum = 1; sNum <= seatsPerTable; sNum++) {
      let seat = await prisma.seat.findFirst({ where: { tableId: table.id, seatNumber: sNum } })
      if (!seat) seat = await prisma.seat.create({ data: { cafeId, tableId: table.id, seatNumber: sNum, qrToken: randomUUID() } })
      if (sNum === 1) console.log(`     T${tNum}/S1 → http://localhost:4000/${subdomain}/t/${tNum}/s/1?token=${seat.qrToken}`)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL missing'); process.exit(1) }
  console.log('🌱 Seeding 3 demo cafes…\n')

  // ── 🇲🇦 Morocco ──────────────────────────────────────────────────────────────
  console.log('🇲🇦  Morocco — Café de la Plage (Agadir)')
  const maCafe = await upsertCafe({ subdomain: 'plage', name: 'Café de la Plage', country: 'MA', currency: 'MAD', lat: 30.4277, lng: -9.5981, adminEmail: 'plage@demo.com', adminPassword: 'demo1234' })
  const maStats = await upsertMenu(maCafe.id, MA_CATS, MA_PRODUCTS)
  console.log(`  ✅ ${maStats.cats} categories · ${maStats.products} products`)
  await upsertTablesAndSeats(maCafe.id, 'plage')
  await upsertDemoStaff(maCafe.id)

  // ── 🇸🇦 Saudi Arabia ──────────────────────────────────────────────────────────
  console.log('\n🇸🇦  Saudi Arabia — مطعم نجد الأصيل (Riyadh)')
  const saCafe = await upsertCafe({ subdomain: 'najd', name: 'مطعم نجد الأصيل', country: 'SA', currency: 'SAR', lat: 24.7136, lng: 46.6753, adminEmail: 'najd@demo.com', adminPassword: 'demo1234' })
  const saStats = await upsertMenu(saCafe.id, SA_CATS, SA_PRODUCTS)
  console.log(`  ✅ ${saStats.cats} categories · ${saStats.products} products`)
  await upsertTablesAndSeats(saCafe.id, 'najd')
  await upsertDemoStaff(saCafe.id)

  // ── 🇦🇪 UAE ───────────────────────────────────────────────────────────────────
  console.log('\n🇦🇪  UAE — مطعم الخليج (Dubai)')
  const aeCafe = await upsertCafe({ subdomain: 'khalij', name: 'مطعم الخليج', country: 'AE', currency: 'AED', lat: 25.2048, lng: 55.2708, adminEmail: 'khalij@demo.com', adminPassword: 'demo1234' })
  const aeStats = await upsertMenu(aeCafe.id, AE_CATS, AE_PRODUCTS)
  console.log(`  ✅ ${aeStats.cats} categories · ${aeStats.products} products`)
  await upsertTablesAndSeats(aeCafe.id, 'khalij')
  await upsertDemoStaff(aeCafe.id)

  console.log('\n🎉 All 3 cafes seeded.')
}

export default main

// Run directly via ts-node
if (require.main === module) {
  main()
    .catch((e) => { console.error('Seed error:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
}
