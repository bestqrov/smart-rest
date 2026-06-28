import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// -20 % discount rounded to nearest 0.50 unit
const dp = (x: number) => Math.round(x * 0.8 / 0.5) * 0.5

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
  { nameEn: 'Traditional Moroccan',  nameAr: 'أطباق  تقليدية', order: 3 },
  { nameEn: 'Grills & Sandwiches',   nameAr: 'مشاوي وسندويشات',       order: 4 },
  { nameEn: 'Hot Drinks',            nameAr: 'مشروبات ساخنة',         order: 5 },
  { nameEn: 'Cold Drinks & Juices',  nameAr: 'مشروبات باردة وعصائر', order: 6 },
  { nameEn: 'Desserts',              nameAr: 'الحلويات',               order: 7 },
]

const MA_PRODUCTS: PrdDef[] = [
  // Breakfast
  { cat: 'Breakfast', nameEn: 'Moroccan Breakfast Plate',  nameAr: 'فطور مغربي كامل',      price: dp(65),  description: 'مسمن، عسل، زيت أركان، جبن وأتاي — Msemen, honey, argan oil, cheese & mint tea' },
  { cat: 'Breakfast', nameEn: 'Msemen with Honey',         nameAr: 'مسمن بالعسل',           price: dp(30),  description: 'رغايف مقرمشة مع عسل الثُّمام — Crispy msemen drizzled with wild honey' },
  { cat: 'Breakfast', nameEn: 'Baghrir (1000 Holes)',      nameAr: 'بغرير',                 price: dp(28),  description: 'فطائر السميد الإسفنجية مع الزبدة والعسل' },
  { cat: 'Breakfast', nameEn: 'Avocado Toast',             nameAr: 'توست بالأفوكادو',       price: dp(55),  description: 'خبز محمص، أفوكادو مهروس، بيضة مسلوقة، فلفل حار' },
  { cat: 'Breakfast', nameEn: 'Croissant & Cappuccino',    nameAr: 'كرواسون وكابتشينو',     price: dp(45),  description: 'كرواسون زبدة طازج مع كابتشينو ناعم' },

  // Starters
  { cat: 'Starters & Salads', nameEn: 'Zaalouk',           nameAr: 'زعلوك',                 price: dp(35),  description: 'سلطة الباذنجان والطماطم المشوية بالكمون وزيت الزيتون' },
  { cat: 'Starters & Salads', nameEn: 'Taktouka',          nameAr: 'تكتوكة',                price: dp(35),  description: 'فلفل وطماطم مشوية بالثوم والتوابل' },
  { cat: 'Starters & Salads', nameEn: 'Briouats (4 pcs)',  nameAr: 'برويات (4 حبات)',       price: dp(40),  description: 'فطائر ورقة محشوة بالجبن والأعشاب' },
  { cat: 'Starters & Salads', nameEn: 'House Salad',       nameAr: 'سلطة المنزل',           price: dp(38),  description: 'خضراوات طازجة، طماطم، خيار، زيتون، صلصة الحمضيات' },

  // Traditional
  { cat: 'Traditional Moroccan', nameEn: 'Tajine Kefta & Egg',        nameAr: 'طاجين كفتة وبيض',        price: dp(90),  description: 'كفتة مبهّرة في صلصة الطماطم مع البيض' },
  { cat: 'Traditional Moroccan', nameEn: 'Tajine Chicken & Olives',   nameAr: 'طاجين دجاج وزيتون',      price: dp(95),  description: 'دجاج مطهو ببطء مع الليمون المحفوظ والزيتون' },
  { cat: 'Traditional Moroccan', nameEn: 'Lamb Couscous',             nameAr: 'كسكس بالخضر واللحم',     price: dp(110), description: 'كسكس مغربي أصيل بسبع خضراوات ولحم الغنم' },
  { cat: 'Traditional Moroccan', nameEn: 'Harira Soup',               nameAr: 'حريرة',                  price: dp(30),  description: 'شوربة الطماطم والعدس والحمص الكلاسيكية' },
  { cat: 'Traditional Moroccan', nameEn: 'Pastilla au Poulet',        nameAr: 'بسطيلة بالدجاج',         price: dp(85),  description: 'عجين ورقة محشو بالدجاج، لوز، قرفة وبيض' },

  // Grills
  { cat: 'Grills & Sandwiches', nameEn: 'Mixed Grill Platter', nameAr: 'طبق مشاوي مشكل',  price: dp(100), description: 'برochettes دجاج + مرقاز + كفتة مع فريت وصلصة' },
  { cat: 'Grills & Sandwiches', nameEn: 'Merguez Sandwich',    nameAr: 'سندويش مرقاز',    price: dp(45),  description: 'مرقاز حار في خبز مع حريصة وفريت' },
  { cat: 'Grills & Sandwiches', nameEn: 'Chicken Burger',      nameAr: 'برغر دجاج',       price: dp(58),  description: 'دجاج مقرمش، كول سلو، خيار مخلل، صلصة خاصة' },
  { cat: 'Grills & Sandwiches', nameEn: 'Frites (side)',        nameAr: 'فريت',            price: dp(22),  description: 'بطاطس مقلية ذهبية مع صلصة أيولي' },

  // Hot Drinks
  { cat: 'Hot Drinks', nameEn: 'Moroccan Mint Tea',  nameAr: 'أتاي مغربي',    price: dp(22), description: 'شاي أخضر بالنعناع الطازج والسكر — على الطريقة المغربية' },
  { cat: 'Hot Drinks', nameEn: 'Espresso',           nameAr: 'إسبريسو',       price: dp(18), description: 'شوت إسبريسو مركّز من أراביكا فاخرة' },
  { cat: 'Hot Drinks', nameEn: 'Cappuccino',         nameAr: 'كابتشينو',      price: dp(28), description: 'إسبريسو مع رغوة حليب مخملية' },
  { cat: 'Hot Drinks', nameEn: 'Café au Lait',       nameAr: 'قهوة بالحليب', price: dp(22), description: 'قهوة قوية مع حليب ساخن' },

  // Cold Drinks
  { cat: 'Cold Drinks & Juices', nameEn: 'Fresh Orange Juice', nameAr: 'عصير برتقال طازج', price: dp(25), description: '4 برتقالات مغربية طازجة — بدون سكر' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Avocado Smoothie',   nameAr: 'سموثي أفوكادو',    price: dp(38), description: 'أفوكادو كريمي مع حليب وعسل وماء الورد' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Lemon Mint Cooler',  nameAr: 'ليمون نعناع مثلج', price: dp(28), description: 'ليمون طازج ونعناع مع ماء غازي وثلج' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Iced Latte',         nameAr: 'آيس لاتيه',        price: dp(35), description: 'إسبريسو بارد مع حليب وثلج' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Mineral Water',      nameAr: 'ماء معدني',         price: dp(12), description: 'ساكن أو غازي' },

  // Desserts
  { cat: 'Desserts', nameEn: 'Chebakia',            nameAr: 'شباكية',          price: dp(25), description: 'حلوى السمسم والعسل المقلية بماء الزهر' },
  { cat: 'Desserts', nameEn: 'Kaab el Ghzal',       nameAr: 'كعب الغزال',      price: dp(28), description: 'معجنات هلالية محشوة باللوز مع السكر البودرة' },
  { cat: 'Desserts', nameEn: 'Crème Brûlée',        nameAr: 'كريم بروليه',     price: dp(40), description: 'كاسترد الفانيليا مع طبقة كراميل مكرملة' },
  { cat: 'Desserts', nameEn: 'Chocolate Lava Cake', nameAr: 'كيك الشوكولاتة', price: dp(45), description: 'كعكة شوكولاتة دافئة بمركز سائل' },
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
  { cat: 'Appetizers', nameEn: 'Hummus & Khobz',     nameAr: 'حمص بالطحينة',       price: dp(18), description: 'حمص ناعم بالطحينة وزيت الزيتون مع خبز عربي طازج' },
  { cat: 'Appetizers', nameEn: 'Mutabbal',            nameAr: 'متبل',               price: dp(18), description: 'باذنجان مشوي مهروس بالطحينة والثوم والليمون' },
  { cat: 'Appetizers', nameEn: 'Fattoush Salad',      nameAr: 'فتوش',               price: dp(22), description: 'سلطة الخضار الطازجة مع الخبز المحمص وصلصة الرمان' },
  { cat: 'Appetizers', nameEn: 'Soup of the Day',     nameAr: 'شوربة اليوم',        price: dp(20), description: 'شوربة طازجة تُحضَّر يومياً' },
  { cat: 'Appetizers', nameEn: 'Vine Leaves (12 pcs)', nameAr: 'ورق عنب (12 حبة)', price: dp(28), description: 'ورق عنب محشو بالأرز واللحم والتوابل' },

  // Traditional Saudi
  { cat: 'Traditional Saudi', nameEn: 'Kabsa Lamb',       nameAr: 'كبسة لحم غنم',    price: dp(75), description: 'أرز بسمتي بالتوابل السعودية مع لحم الغنم الطري' },
  { cat: 'Traditional Saudi', nameEn: 'Kabsa Chicken',    nameAr: 'كبسة دجاج',       price: dp(58), description: 'دجاج مشوي كامل على أرز الكبسة العطري' },
  { cat: 'Traditional Saudi', nameEn: 'Mandi Lamb',       nameAr: 'مندي لحم',        price: dp(85), description: 'لحم غنم مطهو ببطء فوق الفحم مع أرز المندي' },
  { cat: 'Traditional Saudi', nameEn: 'Jareesh',          nameAr: 'جريش',            price: dp(35), description: 'قمح مكسور مطهو مع الدجاج والتوابل — طبق نجدي أصيل' },
  { cat: 'Traditional Saudi', nameEn: 'Saleeg (White Rice)', nameAr: 'سليق',         price: dp(45), description: 'أرز أبيض مطهو بحليب الدجاج مع البهارات' },

  // Grills
  { cat: 'Grills & Kabsa', nameEn: 'Mixed Grill Platter', nameAr: 'مشاوي مشكلة',    price: dp(95), description: 'تشكيلة من كباب اللحم والدجاج والكفتة مع الأرز والخبز' },
  { cat: 'Grills & Kabsa', nameEn: 'Lamb Chops',          nameAr: 'ضلوع الخروف',    price: dp(110), description: 'ضلوع خروف مشوية بالتوابل السعودية مع الأرز' },
  { cat: 'Grills & Kabsa', nameEn: 'Grilled Chicken',     nameAr: 'دجاج مشوي',      price: dp(55), description: 'نصف دجاجة مشوية بالبهارات مع أرز أو خبز' },
  { cat: 'Grills & Kabsa', nameEn: 'Kofta Skewers',       nameAr: 'كفتة مشوية',     price: dp(48), description: 'كفتة لحم عجل مشوية مع صلصة الثوم والتحينة' },

  // Shawarma
  { cat: 'Shawarma & Sandwiches', nameEn: 'Chicken Shawarma',  nameAr: 'شاورما دجاج',  price: dp(22), description: 'شاورما دجاج بالثوم والمخللات في خبز عربي' },
  { cat: 'Shawarma & Sandwiches', nameEn: 'Meat Shawarma',     nameAr: 'شاورما لحم',   price: dp(28), description: 'شاورما لحم عجل بالطحينة والبندورة' },
  { cat: 'Shawarma & Sandwiches', nameEn: 'Falafel Sandwich',  nameAr: 'سندويش فلافل', price: dp(18), description: 'فلافل مقرمش مع السلطة والطحينة في خبز عربي' },

  // Coffee & Tea
  { cat: 'Arabic Coffee & Tea', nameEn: 'Arabic Coffee (Qahwa)', nameAr: 'قهوة عربية (قهوة)', price: dp(15), description: 'قهوة عربية أصيلة بالهيل والزعفران — يُقدَّم مع التمر' },
  { cat: 'Arabic Coffee & Tea', nameEn: 'Saudi Tea (Shai)',       nameAr: 'شاي سعودي',         price: dp(12), description: 'شاي بالنعناع أو السادة — كيفك' },
  { cat: 'Arabic Coffee & Tea', nameEn: 'Cappuccino',             nameAr: 'كابتشينو',          price: dp(22), description: 'إسبريسو مع رغوة حليب ناعمة' },
  { cat: 'Arabic Coffee & Tea', nameEn: 'Karak Chai',             nameAr: 'شاي كرك',           price: dp(14), description: 'شاي بالحليب والهيل — على الطريقة الخليجية' },

  // Juices
  { cat: 'Fresh Juices', nameEn: 'Fresh Mango Juice',    nameAr: 'عصير مانجو طازج',  price: dp(22), description: 'مانجو طازج كامل، بدون إضافات' },
  { cat: 'Fresh Juices', nameEn: 'Lemon Mint',           nameAr: 'ليمون نعناع',      price: dp(18), description: 'ليمون طازج مع نعناع وماء غازي' },
  { cat: 'Fresh Juices', nameEn: 'Watermelon Juice',     nameAr: 'عصير بطيخ',        price: dp(18), description: 'بطيخ طازج بدون سكر' },
  { cat: 'Fresh Juices', nameEn: 'Water (500ml)',         nameAr: 'ماء معدني',         price:  5, description: 'ماء معدني بارد' },

  // Sweets
  { cat: 'Arabic Sweets', nameEn: 'Luqaimat',           nameAr: 'لقيمات',           price: dp(22), description: 'كرات عجين مقلية مع ديبس التمر والسمسم' },
  { cat: 'Arabic Sweets', nameEn: 'Kunafa',              nameAr: 'كنافة',            price: dp(28), description: 'كنافة بالجبن مع شيرة الزهر' },
  { cat: 'Arabic Sweets', nameEn: 'Dates Platter',       nameAr: 'طبق تمور فاخر',   price: dp(35), description: 'تشكيلة من تمور المدينة والمجدول والسكري' },
  { cat: 'Arabic Sweets', nameEn: 'Umm Ali',             nameAr: 'أم علي',           price: dp(28), description: 'حلى الخبز بالحليب والمكسرات والزبيب — يُقدَّم ساخناً' },
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
  { cat: 'Cold Mezze', nameEn: 'Hummus Beiruti',    nameAr: 'حمص بيروتي',        price: dp(28), description: 'حمص ناعم بالطحينة وزيت الزيتون البكر مع البقدونس' },
  { cat: 'Cold Mezze', nameEn: 'Fattoush',          nameAr: 'فتوش',              price: dp(32), description: 'سلطة الخضار الطازجة والخبز المحمص بصلصة الرمان' },
  { cat: 'Cold Mezze', nameEn: 'Tabbouleh',         nameAr: 'تبولة',             price: dp(30), description: 'بقدونس طازج، برغل، طماطم، خيار، ليمون وزيت' },
  { cat: 'Cold Mezze', nameEn: 'Mixed Pickles',     nameAr: 'مخللات مشكلة',      price: dp(22), description: 'تشكيلة مخللات بيتية متنوعة' },

  // Hot Mezze
  { cat: 'Hot Mezze', nameEn: 'Falafel (8 pcs)',    nameAr: 'فلافل (8 حبات)',    price: dp(28), description: 'كرات حمص وفول مقلية بالأعشاب والتوابل' },
  { cat: 'Hot Mezze', nameEn: 'Cheese Sambousek',   nameAr: 'سمبوسك جبن',        price: dp(32), description: 'معجنات مثلثة محشوة بالجبن مع صلصة الثوم' },
  { cat: 'Hot Mezze', nameEn: 'Arayes',             nameAr: 'عرايس لحم',         price: dp(38), description: 'خبز عربي محشو بالكفتة والبهارات مشوي على الفحم' },
  { cat: 'Hot Mezze', nameEn: 'Manakish Zaatar',    nameAr: 'مناقيش زعتر',       price: dp(28), description: 'فطيرة الزعتر والزيت الطازجة من الفرن الحجري' },

  // Emirati Specialties
  { cat: 'Emirati Specialties', nameEn: 'Harees',          nameAr: 'هريس',           price: dp(55), description: 'قمح ولحم مطهو ببطء مع السمن والتوابل الإماراتية' },
  { cat: 'Emirati Specialties', nameEn: 'Biryani Emirati', nameAr: 'برياني إماراتي', price: dp(72), description: 'أرز بسمتي معطر بالزعفران مع الدجاج أو الخروف' },
  { cat: 'Emirati Specialties', nameEn: 'Thareed',         nameAr: 'ثريد لحم',       price: dp(65), description: 'خبز رقيق مع مرق لحم الغنم والخضار — طبق رمضاني أصيل' },
  { cat: 'Emirati Specialties', nameEn: 'Machboos Shrimp', nameAr: 'مجبوس ربيان',    price: dp(85), description: 'أرز البسمتي مع الروبيان الطازج وبهارات اللوومي' },

  // Grills & Seafood
  { cat: 'Grills & Seafood', nameEn: 'Hammour Fillet',     nameAr: 'فيليه هامور',    price: dp(95),  description: 'هامور خليجي طازج مشوي مع أرز الزعفران وصلصة الثوم' },
  { cat: 'Grills & Seafood', nameEn: 'Grilled Prawns',     nameAr: 'جمبري مشوي',     price: dp(88),  description: '6 جمبريات كبيرة مشوية بزيت الليمون والأعشاب' },
  { cat: 'Grills & Seafood', nameEn: 'Mixed Grill',         nameAr: 'مشاوي مشكلة',    price: dp(105), description: 'كباب دجاج ولحم عجل مع الخبز وصلصتان' },
  { cat: 'Grills & Seafood', nameEn: 'Lamb Ouzi',          nameAr: 'أوزي خروف',      price: dp(130), description: 'خروف كامل مطهو على البخار مع أرز البسمتي والمكسرات' },

  // Rice Dishes
  { cat: 'Rice Dishes', nameEn: 'Kabsa Chicken',     nameAr: 'كبسة دجاج',        price: dp(62), description: 'دجاج مع أرز الكبسة العطري بالتوابل الخليجية' },
  { cat: 'Rice Dishes', nameEn: 'Maklooba Lamb',     nameAr: 'مقلوبة لحم',       price: dp(75), description: 'أرز مقلوب مع اللحم والباذنجان والقرنبيط' },
  { cat: 'Rice Dishes', nameEn: 'Saffron Rice',      nameAr: 'أرز الزعفران',     price: dp(30), description: 'أرز بسمتي مع زعفران إيراني أصيل ومكسرات' },

  // Beverages
  { cat: 'Beverages', nameEn: 'Arabic Coffee',       nameAr: 'قهوة عربية',       price: dp(18), description: 'قهوة بيضاء بالهيل والزعفران مع التمر — الترحيب الإماراتي' },
  { cat: 'Beverages', nameEn: 'Karak Tea',           nameAr: 'شاي كرك',          price: dp(15), description: 'شاي بالحليب والهيل الأصيل' },
  { cat: 'Beverages', nameEn: 'Lemon Mint Juice',    nameAr: 'عصير ليمون نعناع', price: dp(22), description: 'ليمون طازج ونعناع مع ماء غازي وثلج مجروش' },
  { cat: 'Beverages', nameEn: 'Fresh Mango Lassi',   nameAr: 'لاسي مانجو',       price: dp(28), description: 'مانجو طازج مع لبن رائب وعسل' },
  { cat: 'Beverages', nameEn: 'Watermelon Juice',    nameAr: 'عصير بطيخ طازج',   price: dp(20), description: 'بطيخ أحمر طازج ممزوج بدون سكر' },
  { cat: 'Beverages', nameEn: 'Mineral Water',       nameAr: 'مياه معدنية',      price:  8, description: 'ساكنة أو غازية' },

  // Desserts
  { cat: 'Desserts', nameEn: 'Luqaimat',             nameAr: 'لقيمات',           price: dp(28), description: 'كرات عجين مقلية مغمورة بديبس التمر والسمسم' },
  { cat: 'Desserts', nameEn: 'Kunafa Nabulsieh',     nameAr: 'كنافة نابلسية',    price: dp(35), description: 'كنافة بالجبن العكاوي وشيرة الزهر — طازجة من الفرن' },
  { cat: 'Desserts', nameEn: 'Saffron Ice Cream',    nameAr: 'آيس كريم زعفران', price: dp(32), description: 'آيس كريم مصنوع يدوياً بالزعفران والهيل والفستق' },
  { cat: 'Desserts', nameEn: 'Date Cake',            nameAr: 'كيك التمر',        price: dp(38), description: 'كيك التمر الدافئ مع صلصة التوفي وآيس كريم الفانيليا' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// 🇩🇿  ALGERIA — مطعم القصبة، الجزائر  (currency: DZD)
// ═══════════════════════════════════════════════════════════════════════════════

const DZ_CATS: CatDef[] = [
  { nameEn: 'Breakfast',                  nameAr: 'الفطور',                    order: 1 },
  { nameEn: 'Soups & Starters',           nameAr: 'الشوربات والمقبلات',        order: 2 },
  { nameEn: 'Traditional Algerian',       nameAr: 'الأطباق الجزائرية التقليدية', order: 3 },
  { nameEn: 'Grills & Sandwiches',        nameAr: 'مشاوي وسندويشات',           order: 4 },
  { nameEn: 'Hot Drinks',                 nameAr: 'مشروبات ساخنة',             order: 5 },
  { nameEn: 'Cold Drinks & Juices',       nameAr: 'مشروبات باردة وعصائر',     order: 6 },
  { nameEn: 'Algerian Pastries',          nameAr: 'الحلويات الجزائرية',        order: 7 },
]

const DZ_PRODUCTS: PrdDef[] = [
  { cat: 'Breakfast', nameEn: 'Msemen with Honey & Butter', nameAr: 'مسمن بالعسل والزبدة', price: dp(180), description: 'رغائف مقرمشة مع عسل بلدي وزبدة طازجة' },
  { cat: 'Breakfast', nameEn: 'Algerian Café Crème', nameAr: 'قهوة كريم جزائرية', price: dp(150), description: 'إسبريسو مع حليب مع كرواسون الزبدة' },
  { cat: 'Breakfast', nameEn: 'Khobz Dar (Home Bread)', nameAr: 'خبز الدار', price: dp(120), description: 'خبز بيتي ساخن مع زيت الزيتون والجبن' },
  { cat: 'Soups & Starters', nameEn: 'Chorba Frik', nameAr: 'شوربة فريك', price: dp(200), description: 'شوربة القمح المجروش مع الدجاج والكزبرة' },
  { cat: 'Soups & Starters', nameEn: 'Harira Algérienne', nameAr: 'حريرة جزائرية', price: dp(180), description: 'شوربة الطماطم والحمص والعدس بالكرفس' },
  { cat: 'Soups & Starters', nameEn: 'Salata Méchouia', nameAr: 'سلطة مشوية', price: dp(220), description: 'فلفل وطماطم مشوية بالثوم وزيت الزيتون' },
  { cat: 'Soups & Starters', nameEn: 'Dolma (4 pcs)', nameAr: 'دولمة (4 حبات)', price: dp(280), description: 'فلفل ألوان محشو بالأرز واللحم المفروم والبهارات' },
  { cat: 'Traditional Algerian', nameEn: 'Couscous à l\'Agneau', nameAr: 'كسكس بلحم الغنم', price: dp(900), description: 'كسكس جزائري بسبع خضراوات ولحم الغنم الطري' },
  { cat: 'Traditional Algerian', nameEn: 'Tajine Zitoune', nameAr: 'طاجين زيتون', price: dp(800), description: 'دجاج مطهو مع زيتون أخضر وليمون ومشمش مجفف' },
  { cat: 'Traditional Algerian', nameEn: 'Chakhchouka', nameAr: 'شخشوخة', price: dp(500), description: 'طماطم وفلفل مع البيض المقلي والبهارات' },
  { cat: 'Traditional Algerian', nameEn: 'Rechta aux Légumes', nameAr: 'رشتة بالخضر', price: dp(600), description: 'معكرونة رفيعة مصنوعة يدوياً مع خضروات موسمية' },
  { cat: 'Traditional Algerian', nameEn: 'Berkoukes (Lamb)', nameAr: 'بركوكس باللحم', price: dp(700), description: 'حبات عجين مطهوة مع مرق الخروف والخضروات' },
  { cat: 'Grills & Sandwiches', nameEn: 'Mixed Grill Platter', nameAr: 'مشاوي مشكلة', price: dp(750), description: 'مرقاز + كباب لحم + دجاج مشوي مع الفريت' },
  { cat: 'Grills & Sandwiches', nameEn: 'Merguez Sandwich', nameAr: 'سندويش مرقاز', price: dp(350), description: 'مرقاز حار في خبز فرنسي مع حريصة وخضروات' },
  { cat: 'Grills & Sandwiches', nameEn: 'Hamburger Maison', nameAr: 'برغر منزلي', price: dp(550), description: 'برغر لحم عجل مع الجبن والخضروات والصلصة الخاصة' },
  { cat: 'Hot Drinks', nameEn: 'Café Express', nameAr: 'قهوة إكسبريس', price: dp(150), description: 'إسبريسو مركّز من أراببكا عالية الجودة' },
  { cat: 'Hot Drinks', nameEn: 'Thé à la Menthe', nameAr: 'شاي بالنعناع', price: dp(120), description: 'شاي أخضر بالنعناع الطازج على الطريقة الجزائرية' },
  { cat: 'Hot Drinks', nameEn: 'Café au Lait', nameAr: 'قهوة بالحليب', price: dp(180), description: 'قهوة قوية مع حليب ساخن وكريمة' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Citronnade Maison', nameAr: 'عصير الليمون البيتي', price: dp(200), description: 'ليمون طازج مع نعناع ومياه غازية وثلج' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Fresh Orange Juice', nameAr: 'عصير برتقال طازج', price: dp(250), description: 'برتقال جزائري طازج بدون سكر' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Mineral Water', nameAr: 'مياه معدنية', price: dp(80), description: 'ساكنة أو غازية' },
  { cat: 'Algerian Pastries', nameEn: 'Makroud au Miel', nameAr: 'مقروض بالعسل', price: dp(150), description: 'حلوى السميد والتمر المقلية بالعسل البلدي' },
  { cat: 'Algerian Pastries', nameEn: 'Zlabia', nameAr: 'زلابية', price: dp(120), description: 'عجين مقلي محلى بشيرة العسل والماء الزهر' },
  { cat: 'Algerian Pastries', nameEn: 'Baklawa Algérienne', nameAr: 'بقلاوة جزائرية', price: dp(200), description: 'طبقات الفيلو باللوز والفستق وشيرة الزهر' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// 🇹🇳  TUNISIA — مطعم سيدي بوسعيد، تونس  (currency: TND)
// ═══════════════════════════════════════════════════════════════════════════════

const TN_CATS: CatDef[] = [
  { nameEn: 'Starters',               nameAr: 'المقبلات',                  order: 1 },
  { nameEn: 'Salads',                  nameAr: 'السلطات',                   order: 2 },
  { nameEn: 'Traditional Tunisian',    nameAr: 'الأطباق التونسية التقليدية', order: 3 },
  { nameEn: 'Grills & Sandwiches',     nameAr: 'مشاوي وسندويشات',          order: 4 },
  { nameEn: 'Hot Drinks',              nameAr: 'مشروبات ساخنة',            order: 5 },
  { nameEn: 'Fresh Juices',            nameAr: 'عصائر طازجة',              order: 6 },
  { nameEn: 'Pastries & Desserts',     nameAr: 'حلويات ومعجنات',           order: 7 },
]

const TN_PRODUCTS: PrdDef[] = [
  { cat: 'Starters', nameEn: 'Brik à l\'Oeuf', nameAr: 'بريك بالبيض', price: dp(6), description: 'ورقة مقرمشة محشوة بالبيض والتونة والبقدونس' },
  { cat: 'Starters', nameEn: 'Lablabi (Bowl)', nameAr: 'لبلابي', price: dp(7), description: 'حمص في مرق الكمون مع الخبز والبيض والكبر' },
  { cat: 'Starters', nameEn: 'Fricassé Tunisien', nameAr: 'فريكاسي تونسي', price: dp(5), description: 'خبز مقلي محشو بالتونة والزيتون والبيض المسلوق' },
  { cat: 'Starters', nameEn: 'Harissa & Khobz', nameAr: 'حريصة وخبز', price: dp(4), description: 'حريصة تونسية مصنوعة يدوياً مع خبز طازج وزيت الزيتون' },
  { cat: 'Salads', nameEn: 'Salade Tunisienne', nameAr: 'سلطة تونسية', price: dp(7), description: 'طماطم وخيار وبصل وفلفل مع تونة وزيتون وزيت الزيتون' },
  { cat: 'Salads', nameEn: 'Salade Méchouia', nameAr: 'سلطة مشوية', price: dp(8), description: 'فلفل وطماطم مشوية بالثوم والكمون وزيت الزيتون' },
  { cat: 'Traditional Tunisian', nameEn: 'Couscous au Poisson', nameAr: 'كسكس بالسمك', price: dp(22), description: 'كسكس تونسي مع سمك البلطي وشوربة الخضار الحارة' },
  { cat: 'Traditional Tunisian', nameEn: 'Ojja Merguez', nameAr: 'عجة مرقاز', price: dp(16), description: 'مرقاز في صلصة الطماطم الحارة مع البيض والفلفل' },
  { cat: 'Traditional Tunisian', nameEn: 'Kafteji', nameAr: 'كفتاجي', price: dp(14), description: 'خضروات مقلية (قرع، بطاطس، فلفل) مع البيض والتونة' },
  { cat: 'Traditional Tunisian', nameEn: 'Couscous à l\'Agneau', nameAr: 'كسكس بلحم الغنم', price: dp(25), description: 'كسكس تونسي تقليدي مع لحم الغنم وخضروات موسمية' },
  { cat: 'Traditional Tunisian', nameEn: 'Chakchouka Tunisienne', nameAr: 'شكشوكة تونسية', price: dp(13), description: 'بيض مقلي في صلصة الفلفل والطماطم الحارة' },
  { cat: 'Grills & Sandwiches', nameEn: 'Brochettes Mixtes', nameAr: 'مشاوي مشكلة', price: dp(18), description: 'تشكيلة من مرقاز وكباب وفيليه دجاج مع الفريت' },
  { cat: 'Grills & Sandwiches', nameEn: 'Sandwich Merguez', nameAr: 'سندويش مرقاز', price: dp(8), description: 'مرقاز مشوي في خبز فرنسي مع حريصة وطماطم' },
  { cat: 'Grills & Sandwiches', nameEn: 'Sandwich Kefta', nameAr: 'سندويش كفتة', price: dp(9), description: 'كفتة مشوية مع حريصة وخضار طازجة' },
  { cat: 'Hot Drinks', nameEn: 'Café Express', nameAr: 'قهوة إكسبريس', price: dp(3), description: 'قهوة مركّزة تونسية الطريقة' },
  { cat: 'Hot Drinks', nameEn: 'Thé à la Menthe', nameAr: 'شاي بالنعناع', price: dp(3), description: 'شاي أخضر بالنعناع والصنوبر' },
  { cat: 'Hot Drinks', nameEn: 'Café au Lait', nameAr: 'قهوة بالحليب', price: dp(4), description: 'قهوة تونسية مع حليب ساخن' },
  { cat: 'Fresh Juices', nameEn: 'Citronnade à la Menthe', nameAr: 'ليمون بالنعناع', price: dp(6), description: 'ليمون طازج مع نعناع وثلج' },
  { cat: 'Fresh Juices', nameEn: 'Jus d\'Orange Frais', nameAr: 'عصير برتقال طازج', price: dp(7), description: 'برتقال طازج معصور لحظياً' },
  { cat: 'Fresh Juices', nameEn: 'Eau Minérale', nameAr: 'مياه معدنية', price: dp(2), description: 'ساكنة أو غازية' },
  { cat: 'Pastries & Desserts', nameEn: 'Makroud au Miel', nameAr: 'مقروض بالعسل', price: dp(5), description: 'حلوى السميد والتمر بالعسل وماء الزهر' },
  { cat: 'Pastries & Desserts', nameEn: 'Assida Zgougou', nameAr: 'عصيدة الزقوق', price: dp(8), description: 'عصيدة الصنوبر التونسية التقليدية مع الكريمة' },
  { cat: 'Pastries & Desserts', nameEn: 'Baklawa Tunisienne', nameAr: 'بقلاوة تونسية', price: dp(6), description: 'معجنات الفيلو باللوز والفستق وشيرة الزهر' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// 🇱🇾  LIBYA — مطعم طرابلس، طرابلس  (currency: LYD)
// ═══════════════════════════════════════════════════════════════════════════════

const LY_CATS: CatDef[] = [
  { nameEn: 'Starters & Soups',       nameAr: 'المقبلات والشوربات',        order: 1 },
  { nameEn: 'Traditional Libyan',     nameAr: 'الأطباق الليبية التقليدية', order: 2 },
  { nameEn: 'Grills & Rice',          nameAr: 'مشاوي وأرز',                order: 3 },
  { nameEn: 'Sandwiches & Fast Food', nameAr: 'سندويشات ووجبات سريعة',    order: 4 },
  { nameEn: 'Hot Drinks',             nameAr: 'مشروبات ساخنة',             order: 5 },
  { nameEn: 'Cold Drinks & Juices',   nameAr: 'مشروبات باردة وعصائر',     order: 6 },
  { nameEn: 'Desserts & Sweets',      nameAr: 'حلويات وحلوى',             order: 7 },
]

const LY_PRODUCTS: PrdDef[] = [
  { cat: 'Starters & Soups', nameEn: 'Sharba Libiya', nameAr: 'شوربة ليبية', price: dp(8), description: 'شوربة الطماطم واللحم بالمعكرونة والكزبرة — الطبق الرمضاني الليبي' },
  { cat: 'Starters & Soups', nameEn: 'Salata Arabiyya', nameAr: 'سلطة عربية', price: dp(6), description: 'طماطم وخيار وبصل وفلفل مع زيت الزيتون والليمون' },
  { cat: 'Starters & Soups', nameEn: 'Hummus bil Tahini', nameAr: 'حمص بالطحينة', price: dp(7), description: 'حمص ناعم بالطحينة وزيت الزيتون والكمون' },
  { cat: 'Traditional Libyan', nameEn: 'Bazin', nameAr: 'بازين', price: dp(12), description: 'عجينة الشعير المطبوخة مع مرق اللحم والبيض — الطبق الوطني الليبي' },
  { cat: 'Traditional Libyan', nameEn: 'Asida with Rub & Honey', nameAr: 'عصيدة بالرب والعسل', price: dp(10), description: 'عصيدة القمح بالرب (ديبس التمر) والعسل البلدي' },
  { cat: 'Traditional Libyan', nameEn: 'Mbakbaka', nameAr: 'مبكبكة', price: dp(15), description: 'معكرونة في مرق الطماطم الحار مع اللحم والخضروات' },
  { cat: 'Traditional Libyan', nameEn: 'Couscous Tarablusi', nameAr: 'كسكس طرابلسي', price: dp(20), description: 'كسكس طرابلسي بلحم الغنم والخضار والتوابل الليبية' },
  { cat: 'Traditional Libyan', nameEn: 'Usban (Stuffed Intestine)', nameAr: 'عصبان', price: dp(18), description: 'أمعاء محشوة بالأرز والأعشاب مطبوخة في المرق' },
  { cat: 'Grills & Rice', nameEn: 'Kofta Mshwiya', nameAr: 'كفتة مشوية', price: dp(18), description: 'كفتة اللحم المتبلة مشوية على الفحم مع الخبز' },
  { cat: 'Grills & Rice', nameEn: 'Mixed Grill', nameAr: 'مشاوي مشكلة', price: dp(25), description: 'تشكيلة من كباب وكفتة ودجاج مشوي مع الأرز' },
  { cat: 'Grills & Rice', nameEn: 'Lamb Kabsa', nameAr: 'كبسة لحم', price: dp(22), description: 'أرز الكبسة مع لحم الغنم والتوابل الليبية' },
  { cat: 'Sandwiches & Fast Food', nameEn: 'Sandwich Kofta', nameAr: 'سندويش كفتة', price: dp(8), description: 'كفتة مشوية في خبز مع الطماطم والبقدونس والطحينة' },
  { cat: 'Sandwiches & Fast Food', nameEn: 'Shawarma Dajaj', nameAr: 'شاورما دجاج', price: dp(10), description: 'شاورما دجاج بالثوم والخضار في خبز عربي' },
  { cat: 'Hot Drinks', nameEn: 'Libyan Tea (Atay)', nameAr: 'أتاي ليبي', price: dp(3), description: 'شاي أخضر بالنعناع مع الصنوبر — يُقدَّم ثلاث مرات' },
  { cat: 'Hot Drinks', nameEn: 'Arabic Coffee', nameAr: 'قهوة عربية', price: dp(4), description: 'قهوة بالهيل والزنجبيل — يُقدَّم مع التمر' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Fresh Orange Juice', nameAr: 'عصير برتقال طازج', price: dp(5), description: 'برتقال طازج معصور لحظياً' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Lemon Mint', nameAr: 'ليمون نعناع', price: dp(5), description: 'ليمون طازج مع نعناع وماء غازي' },
  { cat: 'Cold Drinks & Juices', nameEn: 'Mineral Water', nameAr: 'مياه معدنية', price: dp(2), description: 'ساكنة أو غازية' },
  { cat: 'Desserts & Sweets', nameEn: 'Zlabia', nameAr: 'زلابية', price: dp(5), description: 'عجين مقلي مغموس بالعسل وماء الزهر' },
  { cat: 'Desserts & Sweets', nameEn: 'Basbousa', nameAr: 'بسبوسة', price: dp(6), description: 'حلوى السميد بجوز الهند والقطر والمكسرات' },
  { cat: 'Desserts & Sweets', nameEn: 'Qashta Cream', nameAr: 'قشطة بالعسل', price: dp(7), description: 'قشطة طازجة مع عسل بلدي وفستق حلبي' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// 🇪🇬  EGYPT — مطعم النيل، القاهرة  (currency: EGP)
// ═══════════════════════════════════════════════════════════════════════════════

const EG_CATS: CatDef[] = [
  { nameEn: 'Egyptian Breakfast',     nameAr: 'الفطور المصري',              order: 1 },
  { nameEn: 'Street Food Classics',   nameAr: 'أكل الشارع المصري',          order: 2 },
  { nameEn: 'Main Dishes',            nameAr: 'الأطباق الرئيسية',           order: 3 },
  { nameEn: 'Grills',                 nameAr: 'المشاوي',                    order: 4 },
  { nameEn: 'Hot Drinks',             nameAr: 'مشروبات ساخنة',             order: 5 },
  { nameEn: 'Fresh Juices & Drinks',  nameAr: 'عصائر ومشروبات باردة',      order: 6 },
  { nameEn: 'Desserts',               nameAr: 'الحلويات',                   order: 7 },
]

const EG_PRODUCTS: PrdDef[] = [
  { cat: 'Egyptian Breakfast', nameEn: 'Ful Medames', nameAr: 'فول مدمس', price: dp(25), description: 'فول بلدي بزيت الزيتون والكمون والليمون — وجبة مصر الصباحية' },
  { cat: 'Egyptian Breakfast', nameEn: 'Ta\'ameya (Falafel)', nameAr: 'طعمية', price: dp(30), description: 'فلافل الفول الأخضر المصرية الأصيلة — مقرمشة ومتبلة' },
  { cat: 'Egyptian Breakfast', nameEn: 'Ful & Ta\'ameya Combo', nameAr: 'كومبو فول وطعمية', price: dp(50), description: 'فول مدمس مع طعمية وخبز بلدي وطحينة وطماطم' },
  { cat: 'Egyptian Breakfast', nameEn: 'Feteer Meshaltet', nameAr: 'فطير مشلتت', price: dp(55), description: 'فطير مصري طازج بالزبدة مع عسل أو جبنة' },
  { cat: 'Street Food Classics', nameEn: 'Koshari (Regular)', nameAr: 'كشري', price: dp(35), description: 'أرز وعدس ومكرونة وصلصة طماطم حارة وبصل مقلي — الطبق الوطني' },
  { cat: 'Street Food Classics', nameEn: 'Koshari (Large)', nameAr: 'كشري كبير', price: dp(50), description: 'كشري بورشن كبير مع صلصة إضافية وبصل إضافي' },
  { cat: 'Street Food Classics', nameEn: 'Hawawshi', nameAr: 'حواوشي', price: dp(45), description: 'خبز بلدي محشو باللحم المفروم والبصل والبهارات — مشوي بالفرن' },
  { cat: 'Main Dishes', nameEn: 'Molokhiya with Chicken', nameAr: 'ملوخية بالدجاج', price: dp(80), description: 'ملوخية خضراء طازجة مع دجاج مشوي وأرز أبيض وخبز' },
  { cat: 'Main Dishes', nameEn: 'Mahshi (Mixed Stuffed Veg)', nameAr: 'محشي مشكل', price: dp(70), description: 'كوسة وورق عنب وفلفل محشو بالأرز واللحم والبهارات' },
  { cat: 'Main Dishes', nameEn: 'Hamam Meshwi (Grilled Pigeon)', nameAr: 'حمام مشوي', price: dp(120), description: 'حمامة مشوية محشوة بالأرز والكبد والأعشاب' },
  { cat: 'Main Dishes', nameEn: 'Fried Fish (Bolti)', nameAr: 'سمك بلطي مقلي', price: dp(85), description: 'سمكة بلطي طازجة مقلية مع سلطة وأرز وطحينة' },
  { cat: 'Grills', nameEn: 'Kofta & Shish Tawook', nameAr: 'كفتة وشيش طاووق', price: dp(95), description: 'كفتة اللحم مع دجاج متبل مشوي على الفحم مع أرز' },
  { cat: 'Grills', nameEn: 'Mixed Grill Platter', nameAr: 'مشاوي مشكلة', price: dp(110), description: 'كفتة + شيش لحم + شيش دجاج + سجق مشوي' },
  { cat: 'Grills', nameEn: 'Grilled Kebab', nameAr: 'كباب مشوي', price: dp(90), description: 'كباب لحم عجل على الفحم مع الفريت والسلطة' },
  { cat: 'Hot Drinks', nameEn: 'Karkadeh (Hibiscus)', nameAr: 'كركديه', price: dp(25), description: 'كركديه ساخن أو بارد — شراب مصر الأحمر الأيقوني' },
  { cat: 'Hot Drinks', nameEn: 'Sahlab', nameAr: 'سحلب', price: dp(35), description: 'مشروب الأوركيد الدافئ بالحليب والمكسرات وجوز الهند' },
  { cat: 'Hot Drinks', nameEn: 'Egyptian Tea (Shai)', nameAr: 'شاي مصري', price: dp(15), description: 'شاي أسود مركّز بالنعناع — يُقدَّم بالسكر على الجانب' },
  { cat: 'Fresh Juices & Drinks', nameEn: 'Sugarcane Juice', nameAr: 'عصير قصب', price: dp(30), description: 'عصير قصب السكر الطازج المعصور أمامك' },
  { cat: 'Fresh Juices & Drinks', nameEn: 'Mango Juice', nameAr: 'عصير مانجو', price: dp(40), description: 'مانجو مصري أصيل طازج ومعصور' },
  { cat: 'Fresh Juices & Drinks', nameEn: 'Lemon Mint', nameAr: 'ليمون بالنعناع', price: dp(30), description: 'ليمون طازج مع نعناع وماء غازي' },
  { cat: 'Fresh Juices & Drinks', nameEn: 'Mineral Water', nameAr: 'مياه معدنية', price: dp(12), description: 'ساكنة أو غازية' },
  { cat: 'Desserts', nameEn: 'Om Ali', nameAr: 'أم علي', price: dp(50), description: 'خبز الفينو بالحليب والكريمة والمكسرات مخبوز ساخن' },
  { cat: 'Desserts', nameEn: 'Basbousa', nameAr: 'بسبوسة', price: dp(35), description: 'بسبوسة جوز الهند بالقطر وماء الزهر' },
  { cat: 'Desserts', nameEn: 'Konafa bil-Cream', nameAr: 'كنافة بالكريمة', price: dp(55), description: 'كنافة ناعمة محشوة بالكريمة الطازجة وشيرة الزهر' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// 🇸🇳  SENEGAL — Restaurant Teranga، داكار  (currency: XOF)
// ═══════════════════════════════════════════════════════════════════════════════

const SN_CATS: CatDef[] = [
  { nameEn: 'Starters & Salads',          nameAr: 'مقبلات وسلطات',             order: 1 },
  { nameEn: 'Traditional Senegalese',     nameAr: 'الأطباق السنغالية التقليدية', order: 2 },
  { nameEn: 'Grills & Brochettes',        nameAr: 'مشاوي وبرشات',              order: 3 },
  { nameEn: 'Sandwiches',                 nameAr: 'سندويشات',                  order: 4 },
  { nameEn: 'Hot Drinks',                 nameAr: 'مشروبات ساخنة',             order: 5 },
  { nameEn: 'Traditional Drinks & Juices', nameAr: 'مشروبات تقليدية وعصائر',  order: 6 },
  { nameEn: 'Desserts',                   nameAr: 'الحلويات',                  order: 7 },
]

const SN_PRODUCTS: PrdDef[] = [
  { cat: 'Starters & Salads', nameEn: 'Accras de Crevettes', nameAr: 'بفريتير الروبيان', price: dp(1500), description: 'كرات الروبيان المقلية المتبلة بالبهارات الإفريقية' },
  { cat: 'Starters & Salads', nameEn: 'Salade Verte Maison', nameAr: 'سلطة خضراء بيتية', price: dp(1000), description: 'خضروات طازجة مع صلصة الخردل والليمون' },
  { cat: 'Starters & Salads', nameEn: 'Thiakry (Starter)', nameAr: 'تياكري مقبلات', price: dp(1200), description: 'كسكس دخن مخمر مع لبن الزبادي — حلو ومنعش' },
  { cat: 'Traditional Senegalese', nameEn: 'Thiéboudienne (Fish & Rice)', nameAr: 'تييبوديين — الطبق الوطني', price: dp(3500), description: 'أرز مطهو في مرق السمك مع الخضروات — الطبق الوطني السنغالي' },
  { cat: 'Traditional Senegalese', nameEn: 'Yassa Poulet', nameAr: 'ياسا دجاج', price: dp(3000), description: 'دجاج مشوي في صلصة البصل والليمون والخردل مع الأرز' },
  { cat: 'Traditional Senegalese', nameEn: 'Mafé Agneau', nameAr: 'مافيه لحم غنم', price: dp(3500), description: 'يخنة لحم الغنم في صلصة الفول السوداني مع الأرز' },
  { cat: 'Traditional Senegalese', nameEn: 'Thiou Poisson', nameAr: 'تيو سمك', price: dp(2800), description: 'سمك في صلصة طماطم غنية مع الأرز والخضروات' },
  { cat: 'Traditional Senegalese', nameEn: 'Domoda (Peanut Stew)', nameAr: 'دومودا — يخنة الفول السوداني', price: dp(2500), description: 'يخنة اللحم مع صلصة الفول السوداني والطماطم والخضار' },
  { cat: 'Traditional Senegalese', nameEn: 'Caldou (Fish Broth)', nameAr: 'كالدو — مرق السمك', price: dp(2200), description: 'مرق سمك خفيف بالليمون والأرز — طبق ساحلي داكار' },
  { cat: 'Grills & Brochettes', nameEn: 'Brochettes Boeuf', nameAr: 'شيش لحم بقر', price: dp(2500), description: 'شيش لحم بقر متبل على الفحم مع صلصة الديجون' },
  { cat: 'Grills & Brochettes', nameEn: 'Poisson Braisé', nameAr: 'سمك مشوي', price: dp(3000), description: 'سمكة طازجة مشوية بأعشاب داكار مع أتيكي' },
  { cat: 'Sandwiches', nameEn: 'Sandwich Dibi', nameAr: 'سندويش ديبي', price: dp(1500), description: 'لحم الغنم المشوي في الخبز مع البصل والخردل السنغالي' },
  { cat: 'Sandwiches', nameEn: 'Sandwich Thon-Alloco', nameAr: 'سندويش تونة-ألوكو', price: dp(1200), description: 'تونة مع موز مقلي وحريصة في الخبز الفرنسي' },
  { cat: 'Hot Drinks', nameEn: 'Café Touba', nameAr: 'قهوة طوبا', price: dp(500), description: 'قهوة سنغالية مميزة بالقرنفل والفلفل الأسود — مقدسة ومنعشة' },
  { cat: 'Hot Drinks', nameEn: 'Thé Vert Attaya', nameAr: 'أتايا — شاي الضيافة', price: dp(500), description: 'شاي أخضر بالنعناع يُقدَّم ثلاث مرات في الجلسة' },
  { cat: 'Traditional Drinks & Juices', nameEn: 'Bissap (Hibiscus)', nameAr: 'بيساب — عصير الكركديه', price: dp(800), description: 'عصير الكركديه الطازج المحلى بالسكر — المشروب الوطني السنغالي' },
  { cat: 'Traditional Drinks & Juices', nameEn: 'Ginger Juice (Gnamakoudji)', nameAr: 'عصير الزنجبيل', price: dp(800), description: 'زنجبيل طازج مع ليمون وسكر — منشط وصحي' },
  { cat: 'Traditional Drinks & Juices', nameEn: 'Bouye (Baobab Juice)', nameAr: 'عصير البوباب', price: dp(1000), description: 'عصير ثمرة شجرة البوباب الغنية بفيتامين C' },
  { cat: 'Traditional Drinks & Juices', nameEn: 'Mineral Water', nameAr: 'مياه معدنية', price: dp(500), description: 'ساكنة أو غازية' },
  { cat: 'Desserts', nameEn: 'Thiakry (Sweet Millet)', nameAr: 'تياكري — كسكس دخن محلى', price: dp(1200), description: 'كسكس الدخن المخمر مع لبن الزبادي والزبيب والجوز' },
  { cat: 'Desserts', nameEn: 'Beignets Maison', nameAr: 'بنييه بيتية', price: dp(800), description: 'دونات مقلية طازجة محلاة بمربى الفواكه' },
  { cat: 'Desserts', nameEn: 'Ngalax', nameAr: 'نغالاكس', price: dp(1000), description: 'كسكس بزبدة الفول السوداني والسكر وماء الزهر — حلوى الأعياد' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// 🇨🇮  CÔTE D'IVOIRE — Maquis Le Baobab، أبيدجان  (currency: XOF)
// ═══════════════════════════════════════════════════════════════════════════════

const CI_CATS: CatDef[] = [
  { nameEn: 'Starters',                   nameAr: 'المقبلات',                   order: 1 },
  { nameEn: 'Ivorian Traditional Dishes', nameAr: 'الأطباق الإيفوارية التقليدية', order: 2 },
  { nameEn: 'Grills & Brochettes',        nameAr: 'مشاوي وبرشات',               order: 3 },
  { nameEn: 'Fast Plates',                nameAr: 'أطباق سريعة',                order: 4 },
  { nameEn: 'Hot Drinks',                 nameAr: 'مشروبات ساخنة',              order: 5 },
  { nameEn: 'Fresh Drinks & Juices',      nameAr: 'مشروبات طازجة وعصائر',      order: 6 },
  { nameEn: 'Desserts',                   nameAr: 'الحلويات',                   order: 7 },
]

const CI_PRODUCTS: PrdDef[] = [
  { cat: 'Starters', nameEn: 'Alloco (Fried Plantain)', nameAr: 'ألوكو — موز مقلي', price: dp(1000), description: 'موز مقلي بالزيت الذهبي مع صلصة الفلفل الحار' },
  { cat: 'Starters', nameEn: 'Salade Ivoirienne', nameAr: 'سلطة إيفوارية', price: dp(1200), description: 'خضروات طازجة مع أفوكادو وبيضة وصلصة الليمون' },
  { cat: 'Starters', nameEn: 'Acras de Morue', nameAr: 'بفريتير السمك المملح', price: dp(1500), description: 'كرات السمك المملح المقلية المتبلة' },
  { cat: 'Ivorian Traditional Dishes', nameEn: 'Garba (Attiéké + Thon)', nameAr: 'غاربا — أتيكي وتونة', price: dp(2000), description: 'كسكس الكسافا (أتيكي) مع تونة مشوية — الطبق الشعبي رقم 1 في أبيدجان' },
  { cat: 'Ivorian Traditional Dishes', nameEn: 'Attiéké au Poisson Braisé', nameAr: 'أتيكي مع سمك مشوي', price: dp(3000), description: 'كسكس الكسافا مع سمكة مشوية كاملة وصلصة الطماطم' },
  { cat: 'Ivorian Traditional Dishes', nameEn: 'Kedjenou Poulet', nameAr: 'كيدجينو دجاج', price: dp(3500), description: 'دجاج مطهو ببطء بالأعشاب والفلفل في وعاء مغلق — طبق إيفواري أصيل' },
  { cat: 'Ivorian Traditional Dishes', nameEn: 'Foutou Igname Sauce Graine', nameAr: 'فوتو إينيام بصلصة النخيل', price: dp(2500), description: 'عجينة اليام مع صلصة بذور النخيل والدجاج' },
  { cat: 'Ivorian Traditional Dishes', nameEn: 'Riz Sauce Arachide', nameAr: 'أرز بصلصة الفول السوداني', price: dp(2000), description: 'أرز مع صلصة الفول السوداني الغنية واللحم' },
  { cat: 'Ivorian Traditional Dishes', nameEn: 'Aloko Chicken', nameAr: 'دجاج بالموز المقلي', price: dp(2800), description: 'دجاج مشوي مع موز مقلي وأرز وصلصة الفلفل' },
  { cat: 'Grills & Brochettes', nameEn: 'Brochettes Boeuf', nameAr: 'شيش لحم بقر', price: dp(2000), description: 'شيش لحم بقر مشوي على الفحم مع الموز المقلي' },
  { cat: 'Grills & Brochettes', nameEn: 'Poisson Braisé Entier', nameAr: 'سمكة مشوية كاملة', price: dp(3500), description: 'سمكة طازجة مشوية بأعشاب ساحل العاج مع أتيكي' },
  { cat: 'Grills & Brochettes', nameEn: 'Poulet Braisé (Half)', nameAr: 'نصف دجاجة مشوية', price: dp(2500), description: 'نصف دجاجة مشوية بالأعشاب مع أرز أو أتيكي' },
  { cat: 'Fast Plates', nameEn: 'Riz Sauté Légumes', nameAr: 'أرز مقلي بالخضار', price: dp(1500), description: 'أرز مقلي بالخضار والبيض والصلصة الخاصة' },
  { cat: 'Fast Plates', nameEn: 'Sandwich Alloco-Thon', nameAr: 'سندويش ألوكو وتونة', price: dp(1200), description: 'خبز فرنسي مع موز مقلي وتونة وصلصة حارة' },
  { cat: 'Hot Drinks', nameEn: 'Café Ivoirien', nameAr: 'قهوة إيفوارية', price: dp(500), description: 'قهوة من حبوب ساحل العاج الأصيلة' },
  { cat: 'Hot Drinks', nameEn: 'Thé au Gingembre', nameAr: 'شاي بالزنجبيل', price: dp(600), description: 'شاي بالزنجبيل الطازج والعسل' },
  { cat: 'Fresh Drinks & Juices', nameEn: 'Gnamakoudji (Ginger Juice)', nameAr: 'غنامكودجي — عصير الزنجبيل', price: dp(800), description: 'زنجبيل طازج مع ليمون وسكر — المشروب التقليدي المنشط' },
  { cat: 'Fresh Drinks & Juices', nameEn: 'Jus de Bissap', nameAr: 'عصير الكركديه', price: dp(800), description: 'كركديه طازج محلى — أحمر وبارد ومنعش' },
  { cat: 'Fresh Drinks & Juices', nameEn: 'Jus de Tamarin', nameAr: 'عصير التمر هندي', price: dp(800), description: 'تمر هندي طازج حامض ومحلى — لا مثيل له في الحرارة' },
  { cat: 'Fresh Drinks & Juices', nameEn: 'Mineral Water', nameAr: 'مياه معدنية', price: dp(500), description: 'ساكنة أو غازية' },
  { cat: 'Desserts', nameEn: 'Beignets Soufflés', nameAr: 'بنييه إيفوارية', price: dp(800), description: 'دونات مقلية طازجة منفوخة مع سكر البودرة' },
  { cat: 'Desserts', nameEn: 'Banane Flambée', nameAr: 'موز محرق بالكراميل', price: dp(1500), description: 'موز مقلي بالزبدة والسكر البني وعصير الليمون' },
  { cat: 'Desserts', nameEn: 'Gâteau au Coco', nameAr: 'كيك جوز الهند', price: dp(1200), description: 'كعكة جوز الهند الطازجة الإيفوارية' },
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

  const passwordHash = await hashPassword(adminPassword)
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existingUser) {
    await prisma.user.create({ data: { email: adminEmail, passwordHash, cafeId: cafe.id } })
    console.log(`  👤 Admin created: ${adminEmail} / ${adminPassword}`)
  } else {
    await prisma.user.update({ where: { email: adminEmail }, data: { passwordHash, cafeId: cafe.id } })
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
    // Find by role (unique per demo cafe) — handles rename from old "Demo Cashier" style names
    const exists = await prisma.staff.findFirst({ where: { cafeId, role: s.role, isActive: true } })
    if (!exists) {
      const pinCode = await bcrypt.hash(s.pin, 10)
      await prisma.staff.create({ data: { cafeId, name: s.name, role: s.role, pinCode, pinDisplay: s.pin, isActive: true } })
      console.log(`  🪪 Staff created: ${s.name} (PIN: ${s.pin})`)
    } else {
      // Rename + backfill pinDisplay if name is old English style or pinDisplay missing
      const needsUpdate = exists.name !== s.name || !exists.pinDisplay
      if (needsUpdate) {
        await prisma.staff.update({ where: { id: exists.id }, data: { name: s.name, pinDisplay: s.pin } })
        console.log(`  🪪 Staff updated: ${exists.name} → ${s.name}`)
      } else {
        console.log(`  🪪 Staff ok: ${s.name}`)
      }
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
    } else {
      await prisma.product.update({ where: { id: exists.id }, data: { price: p.price } })
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
// Premium Plans
// ═══════════════════════════════════════════════════════════════════════════════

async function seedPremiumPlans() {
  const plans = [
    { country: 'MA', currency: 'MAD', monthlyPrice: 199   },
    { country: 'SN', currency: 'XOF', monthlyPrice: 13000 },
    { country: 'SA', currency: 'SAR', monthlyPrice: 159   },
    { country: 'AE', currency: 'AED', monthlyPrice: 159   },
    { country: 'EU', currency: 'EUR', monthlyPrice: 159   },
  ]
  for (const plan of plans) {
    await prisma.premiumPlan.upsert({
      where:  { country: plan.country },
      update: {},
      create: { ...plan, hasMarketing: true, hasCertification: true, hasAnalytics: true, hasNoCommission: true },
    })
  }
  console.log('✅ PremiumPlans seeded')
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL missing'); process.exit(1) }
  console.log('🌱 Seeding demo cafe…\n')

  // ── 🇲🇦 Morocco ──────────────────────────────────────────────────────────────
  console.log('🇲🇦  Morocco — Café de la Plage (Agadir)')
  const maCafe = await upsertCafe({ subdomain: 'plage', name: 'Café de la Plage', country: 'MA', currency: 'MAD', lat: 30.4277, lng: -9.5981, adminEmail: 'plage@demo.com', adminPassword: 'demo1234' })
  const maStats = await upsertMenu(maCafe.id, MA_CATS, MA_PRODUCTS)
  console.log(`  ✅ ${maStats.cats} categories · ${maStats.products} products`)
  await upsertTablesAndSeats(maCafe.id, 'plage')
  await upsertDemoStaff(maCafe.id)

  console.log('\n🎉 Demo cafe seeded.')

  await seedPremiumPlans()
}

export default main

// Run directly via ts-node
if (require.main === module) {
  main()
    .catch((e) => { console.error('Seed error:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
}
