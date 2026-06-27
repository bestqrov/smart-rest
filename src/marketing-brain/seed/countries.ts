/** Seed data for target countries (MENA + Africa initial set). */
export const COUNTRIES = [
  // ── MENA ──────────────────────────────────────────────────────────────────
  {
    code: 'MA', nameEn: 'Morocco',      nameAr: 'المغرب',       nameFr: 'Maroc',
    currency: 'MAD', phonePrefix: '+212', region: 'MENA', isActive: true,
  },
  {
    code: 'TN', nameEn: 'Tunisia',      nameAr: 'تونس',         nameFr: 'Tunisie',
    currency: 'TND', phonePrefix: '+216', region: 'MENA', isActive: true,
  },
  {
    code: 'DZ', nameEn: 'Algeria',      nameAr: 'الجزائر',      nameFr: 'Algérie',
    currency: 'DZD', phonePrefix: '+213', region: 'MENA', isActive: true,
  },
  {
    code: 'EG', nameEn: 'Egypt',        nameAr: 'مصر',          nameFr: 'Égypte',
    currency: 'EGP', phonePrefix: '+20',  region: 'MENA', isActive: true,
  },
  {
    code: 'LY', nameEn: 'Libya',        nameAr: 'ليبيا',        nameFr: 'Libye',
    currency: 'LYD', phonePrefix: '+218', region: 'MENA', isActive: false,
  },
  // ── GULF ──────────────────────────────────────────────────────────────────
  {
    code: 'SA', nameEn: 'Saudi Arabia', nameAr: 'المملكة العربية السعودية', nameFr: 'Arabie Saoudite',
    currency: 'SAR', phonePrefix: '+966', region: 'GULF', isActive: true,
  },
  {
    code: 'AE', nameEn: 'UAE',          nameAr: 'الإمارات',     nameFr: 'Émirats Arabes Unis',
    currency: 'AED', phonePrefix: '+971', region: 'GULF', isActive: true,
  },
  {
    code: 'KW', nameEn: 'Kuwait',       nameAr: 'الكويت',       nameFr: 'Koweït',
    currency: 'KWD', phonePrefix: '+965', region: 'GULF', isActive: true,
  },
  {
    code: 'QA', nameEn: 'Qatar',        nameAr: 'قطر',          nameFr: 'Qatar',
    currency: 'QAR', phonePrefix: '+974', region: 'GULF', isActive: true,
  },
  {
    code: 'BH', nameEn: 'Bahrain',      nameAr: 'البحرين',      nameFr: 'Bahreïn',
    currency: 'BHD', phonePrefix: '+973', region: 'GULF', isActive: false,
  },
  {
    code: 'OM', nameEn: 'Oman',         nameAr: 'عُمان',        nameFr: 'Oman',
    currency: 'OMR', phonePrefix: '+968', region: 'GULF', isActive: false,
  },
  // ── AFRICA ────────────────────────────────────────────────────────────────
  {
    code: 'SN', nameEn: 'Senegal',      nameAr: 'السنغال',      nameFr: 'Sénégal',
    currency: 'XOF', phonePrefix: '+221', region: 'AFRICA', isActive: true,
  },
  {
    code: 'CI', nameEn: "Côte d'Ivoire", nameAr: 'ساحل العاج',  nameFr: "Côte d'Ivoire",
    currency: 'XOF', phonePrefix: '+225', region: 'AFRICA', isActive: true,
  },
  {
    code: 'CM', nameEn: 'Cameroon',     nameAr: 'الكاميرون',    nameFr: 'Cameroun',
    currency: 'XAF', phonePrefix: '+237', region: 'AFRICA', isActive: false,
  },
  {
    code: 'MR', nameEn: 'Mauritania',   nameAr: 'موريتانيا',    nameFr: 'Mauritanie',
    currency: 'MRU', phonePrefix: '+222', region: 'AFRICA', isActive: false,
  },
  // ── EUROPE ────────────────────────────────────────────────────────────────
  {
    code: 'FR', nameEn: 'France',       nameAr: 'فرنسا',        nameFr: 'France',
    currency: 'EUR', phonePrefix: '+33',  region: 'EUROPE', isActive: true,
  },
  {
    code: 'BE', nameEn: 'Belgium',      nameAr: 'بلجيكا',       nameFr: 'Belgique',
    currency: 'EUR', phonePrefix: '+32',  region: 'EUROPE', isActive: false,
  },
]
