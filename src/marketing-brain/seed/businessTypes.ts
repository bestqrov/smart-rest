/** Seed data for business types — matches the Prisma BusinessType enum used in the main app. */
export const BUSINESS_TYPES = [
  { slug: 'restaurant',  nameEn: 'Restaurant',  nameAr: 'مطعم',         nameFr: 'Restaurant',   icon: '🍽️', sortOrder: 1, isActive: true  },
  { slug: 'cafe',        nameEn: 'Café',        nameAr: 'مقهى',         nameFr: 'Café',         icon: '☕',  sortOrder: 2, isActive: true  },
  { slug: 'caterer',     nameEn: 'Caterer',     nameAr: 'مطبخ تجاري',   nameFr: 'Traiteur',     icon: '🎂',  sortOrder: 3, isActive: true  },
  { slug: 'bakery',      nameEn: 'Bakery',      nameAr: 'مخبزة',        nameFr: 'Boulangerie',  icon: '🥐',  sortOrder: 4, isActive: true  },
  { slug: 'food_truck',  nameEn: 'Food Truck',  nameAr: 'شاحنة طعام',   nameFr: 'Food Truck',   icon: '🚚',  sortOrder: 5, isActive: true  },
  { slug: 'hotel',       nameEn: 'Hotel',       nameAr: 'فندق',         nameFr: 'Hôtel',        icon: '🏨',  sortOrder: 6, isActive: true  },
  { slug: 'juice_bar',   nameEn: 'Juice Bar',   nameAr: 'بار عصائر',    nameFr: 'Bar à Jus',    icon: '🥤',  sortOrder: 7, isActive: false },
  { slug: 'fast_food',   nameEn: 'Fast Food',   nameAr: 'وجبات سريعة',  nameFr: 'Restauration Rapide', icon: '🍔', sortOrder: 8, isActive: false },
]
