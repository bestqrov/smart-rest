"use client"

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, type ElementType } from 'react'
import { useRouter } from 'next/navigation'
import {
  QrCode, Zap, BarChart3, Star, CheckCircle, Menu, X,
  MessageCircle, ArrowRight, Loader2, ChefHat,
  CreditCard, Bell, Languages, Layers, TrendingUp,
  Shield, Phone, Mail, MapPin, ChevronDown, ChevronUp,
  Utensils, Coffee, Building2, ShoppingBag, Package,
  ThumbsUp, AlertTriangle, Wallet, Globe2, UserCircle, Share2,
  Clock, Calendar, Film,
  Upload, Brain, FileText, Send, ChevronRight,
} from 'lucide-react'

// ─── Types & i18n ──────────────────────────────────────────────────────────────

type Lang = 'en' | 'fr' | 'ar'

const T: Record<Lang, Record<string, string | string[]>> = {
  en: {
    tagline: 'Built for restaurants & cafés in Saudi Arabia, the UAE and Oman',
    h1a: 'Lower Costs. More Sales.', h1b: 'Fewer Order Mistakes.',
    h1c: '',
    desc: 'One dashboard for ordering, kitchen, staff, invoices and marketing — so your team serves faster and you see your numbers instantly.\n\nGuests order and pay by QR with mada, Apple Pay or card through your own Tap Payments, Moyasar or Stripe account — the money goes straight to you. Arabic & English interfaces, WhatsApp built in.',
    businessTypesLabel: 'Business Types',
    bizLabel: 'Supported Businesses', bizTitle: 'Which business do you run?',
    bizSub: 'SmartRestau adapts its dashboard and tools to your activity — you only see what helps you sell more.',
    bizLearnMore: 'Learn more',
    dynLabel: 'One Platform, Every Workflow',
    dynTitle: 'Less software to pay for. Less time switching screens.',
    dynSub: 'Pick your business type at signup and SmartRestau sets up the dashboard, modules, reports and KPIs that matter for it — replacing several separate tools with one.',
    cta1: 'Start Free Trial', cta2: 'Book a Demo', ctaDemo: 'Try Demo — No Login',
    trustBar: 'Arabic & English · mada, Apple Pay & cards · WhatsApp',
    badges: ['No contract', 'Quick setup', 'Arabic & English', 'No credit card'],
    whoLabel: 'Who Is It For', whoTitle: 'Better Results for Every F&B Business',
    whoSub: 'From a single café to a multi-branch chain — faster service, fewer mistakes, clearer numbers',
    howLabel: 'How It Works', howTitle: 'Up and Running in 5 Steps',
    howSub: 'From signup to taking orders — without long training or IT projects',
    featLabel: 'Modules', featTitle: 'Everything You Need to Run the Day',
    featSub: 'Ordering, kitchen, staff, invoices and marketing — working together so nothing gets lost',
    pricingLabel: 'Pricing', pricingTitle: 'Pricing in Your Local Currency',
    pricingSub: 'Plans for Saudi Arabia, the UAE and Oman · Talk to us for a quote · Custom pricing for chains',
    trialBig: '7-Day Free Trial', trialSub: 'See the difference in your own restaurant — no credit card, no commitment',
    trialBadges: ['✓ All modules included', '✓ Unlimited orders', '✓ Live support', '✓ Reports from day 1'],
    testimonialLabel: 'Success Stories', testimonialTitle: 'Restaurants Growing With SmartRestau',
    faqLabel: 'FAQ', faqTitle: 'Have a Question?',
    contactLabel: 'Contact', contactTitle: "We're Here to Help",
    contactSub: 'Talk to our team in Arabic or English — on WhatsApp or by email',
    finalTitle: 'Serve Faster. Sell More. Know Your Numbers.',
    finalSub: 'Start your free trial and run ordering, kitchen, staff and reports from one dashboard',
    finalCta1: 'Start My Free Trial →', finalCta2: 'Talk to Our Team',
    finalNote: 'No credit card · No contract · Cancel anytime',
    cookie: 'We use cookies to improve your experience and analytics. See our',
    cookieLink: 'Privacy Policy', cookieAccept: 'Accept', cookieDecline: 'Decline',
    navLogin: 'Login', navSignup: 'Start Free',
    systemOk: '🟢 All systems operational',
    privacy: 'Privacy Policy', terms: 'Terms of Service', legal: 'Legal Notice',
    allRights: 'All rights reserved',
    madeWith: 'Built for restaurants, cafés and hospitality businesses in the Gulf — Arabic & English',
    enterpriseTitle: 'Enterprise & Chain Plans',
    enterpriseDesc: 'Every branch in one view — consistent menus, central reports, custom branding, priority support',
    enterpriseCta: 'Contact Us for Custom Pricing',
    architectureLabel: 'Platform Architecture',
    architectureTitle: 'One Dashboard. Every Part of Your Operation.',
    architectureSub: 'Orders flow from the table to the kitchen to the invoice automatically — fewer mistakes, faster service, instant reports.',
    marketingEngineLabel: 'AI Food Marketing',
    marketingEngineTitle: 'Turn Every Dish Into a Marketing Campaign',
    marketingEngineSub: 'One photo. Ready-to-post content. Less spent on agencies.',
    marketingEngineResultTitle: 'Fresh content without hiring a content team.',
    marketingEngineResult: 'Create video ads, reels, captions and posts from your dish photos with AI — in Arabic and English — and keep your social accounts active without extra marketing costs.',
    marketingEngineCta: 'See It in Action →',
    statsLabel: 'Built for the Gulf',
  },
  fr: {
    tagline: "Conçu pour les restaurants et cafés en Arabie Saoudite, aux Émirats et à Oman",
    h1a: 'Moins de Coûts. Plus de Ventes.', h1b: "Moins d'Erreurs de Commande.",
    h1c: '',
    desc: "Un seul tableau de bord pour les commandes, la cuisine, le personnel, les factures et le marketing — votre équipe sert plus vite et vous voyez vos chiffres instantanément.\n\nVos clients commandent et paient par QR avec mada, Apple Pay ou carte via votre propre compte Tap Payments, Moyasar ou Stripe — l'argent arrive directement chez vous. Interfaces en arabe et en anglais, WhatsApp intégré.",
    businessTypesLabel: 'Types de Commerces',
    bizLabel: 'Commerces Pris en Charge', bizTitle: 'Quel commerce gérez-vous ?',
    bizSub: "SmartRestau adapte son tableau de bord et ses outils à votre activité — vous ne voyez que ce qui vous aide à vendre plus.",
    bizLearnMore: 'En savoir plus',
    dynLabel: 'Une Plateforme, Chaque Métier',
    dynTitle: 'Moins de logiciels à payer. Moins de temps perdu entre les écrans.',
    dynSub: "Choisissez votre type de commerce à l'inscription : SmartRestau configure le tableau de bord, les modules, les rapports et les KPI utiles pour vous — un seul outil au lieu de plusieurs.",
    cta1: 'Essai Gratuit', cta2: 'Réserver une Démo', ctaDemo: 'Essayer la Démo — Sans Inscription',
    trustBar: 'Arabe & anglais · mada, Apple Pay & cartes · WhatsApp',
    badges: ['Sans engagement', 'Mise en place rapide', 'Arabe & anglais', 'Sans carte bancaire'],
    whoLabel: 'Pour Qui', whoTitle: 'De Meilleurs Résultats pour Chaque Business F&B',
    whoSub: "Du café unique à la chaîne multi-sites — service plus rapide, moins d'erreurs, chiffres plus clairs",
    howLabel: 'Comment Ça Marche', howTitle: 'Opérationnel en 5 Étapes',
    howSub: "De l'inscription aux premières commandes — sans longue formation ni projet informatique",
    featLabel: 'Modules', featTitle: "Tout ce qu'il Faut pour Gérer la Journée",
    featSub: 'Commandes, cuisine, personnel, factures et marketing — connectés pour que rien ne se perde',
    pricingLabel: 'Tarifs', pricingTitle: 'Des Tarifs dans Votre Devise Locale',
    pricingSub: "Offres pour l'Arabie Saoudite, les Émirats et Oman · Contactez-nous pour un devis · Tarifs sur mesure pour les chaînes",
    trialBig: '7 Jours Gratuits', trialSub: 'Constatez la différence dans votre propre restaurant — sans carte bancaire, sans engagement',
    trialBadges: ['✓ Tous les modules inclus', '✓ Commandes illimitées', '✓ Support en direct', '✓ Rapports dès le 1er jour'],
    testimonialLabel: 'Success Stories', testimonialTitle: 'Des Restaurants qui Grandissent avec SmartRestau',
    faqLabel: 'FAQ', faqTitle: 'Une Question ?',
    contactLabel: 'Contact', contactTitle: 'Nous Sommes Là pour Vous',
    contactSub: 'Parlez à notre équipe en arabe ou en anglais — sur WhatsApp ou par email',
    finalTitle: 'Servez Plus Vite. Vendez Plus. Maîtrisez Vos Chiffres.',
    finalSub: 'Lancez votre essai gratuit et gérez commandes, cuisine, personnel et rapports depuis un seul tableau de bord',
    finalCta1: 'Démarrer Mon Essai Gratuit →', finalCta2: 'Parler à Notre Équipe',
    finalNote: 'Sans carte · Sans contrat · Annulation à tout moment',
    cookie: 'Nous utilisons des cookies pour améliorer votre expérience. Voir notre',
    cookieLink: 'Politique de Confidentialité', cookieAccept: 'Accepter', cookieDecline: 'Refuser',
    navLogin: 'Connexion', navSignup: 'Essai Gratuit',
    systemOk: '🟢 Tous les systèmes opérationnels',
    privacy: 'Politique de Confidentialité', terms: "Conditions d'Utilisation", legal: 'Mentions Légales',
    allRights: 'Tous droits réservés',
    madeWith: "Conçu pour les restaurants, cafés et commerces d'hôtellerie du Golfe — arabe & anglais",
    enterpriseTitle: 'Plans Entreprise & Chaînes',
    enterpriseDesc: 'Toutes vos branches en une vue — menus cohérents, rapports centralisés, marque personnalisée, support prioritaire',
    enterpriseCta: 'Nous Contacter pour un Devis Personnalisé',
    architectureLabel: 'Architecture Plateforme',
    architectureTitle: 'Un Tableau de Bord. Toute Votre Activité.',
    architectureSub: "Les commandes passent de la table à la cuisine puis à la facture automatiquement — moins d'erreurs, service plus rapide, rapports instantanés.",
    marketingEngineLabel: 'Marketing Culinaire IA',
    marketingEngineTitle: 'Transformez Chaque Plat en Campagne Marketing',
    marketingEngineSub: "Une photo. Du contenu prêt à publier. Moins de dépenses d'agence.",
    marketingEngineResultTitle: 'Du contenu frais sans recruter une équipe dédiée.',
    marketingEngineResult: "Créez vidéos, reels, légendes et posts à partir des photos de vos plats grâce à l'IA — en arabe et en anglais — et gardez vos réseaux actifs sans coûts marketing supplémentaires.",
    marketingEngineCta: 'Voir en Action →',
    statsLabel: 'Conçu pour le Golfe',
  },
  ar: {
    tagline: 'مصمَّم للمطاعم والمقاهي في السعودية والإمارات وعُمان',
    h1a: 'تكاليف أقل. مبيعات أكثر.', h1b: 'وأخطاء أقل في الطلبات.',
    h1c: '',
    desc: 'لوحة تحكم واحدة للطلبات والمطبخ والموظفين والفواتير والتسويق — ليخدم فريقك العملاء بسرعة أكبر وتطّلع على أرقامك فوراً.\n\nيطلب عملاؤك ويدفعون عبر رمز QR بمدى أو Apple Pay أو البطاقات من خلال حسابك الخاص في Tap Payments أو Moyasar أو Stripe — والمبالغ تصلك مباشرة. واجهات بالعربية والإنجليزية، وواتساب مدمج.',
    businessTypesLabel: 'أنواع الأنشطة',
    bizLabel: 'الأنشطة المدعومة', bizTitle: 'ما نوع نشاطك التجاري؟',
    bizSub: 'يتكيّف SmartRestau مع نشاطك تلقائياً — فلا ترى إلا ما يساعدك على زيادة مبيعاتك.',
    bizLearnMore: 'اعرف المزيد',
    dynLabel: 'منصة واحدة لكل الأنشطة',
    dynTitle: 'برامج أقل تدفع ثمنها. ووقت أقل بين الشاشات.',
    dynSub: 'اختر نوع نشاطك عند التسجيل، وسيجهّز SmartRestau لوحة التحكم والوحدات والتقارير والمؤشرات المناسبة لك — أداة واحدة بدلاً من عدة برامج.',
    cta1: 'ابدأ تجربتك المجانية', cta2: 'احجز عرضاً توضيحياً', ctaDemo: 'جرّب النسخة التجريبية — بدون تسجيل',
    trustBar: 'العربية والإنجليزية · مدى وApple Pay والبطاقات · واتساب',
    badges: ['بدون عقد', 'إعداد سريع', 'عربي وإنجليزي', 'بدون بطاقة ائتمان'],
    whoLabel: 'لمن هذه المنصة', whoTitle: 'نتائج أفضل لكل منشآت الأغذية والمشروبات',
    whoSub: 'من مقهى واحد إلى سلسلة متعددة الفروع — خدمة أسرع، أخطاء أقل، وأرقام أوضح',
    howLabel: 'كيف تعمل المنصة', howTitle: 'جاهز للعمل في 5 خطوات',
    howSub: 'من التسجيل إلى استقبال الطلبات — دون تدريب طويل أو مشاريع تقنية معقدة',
    featLabel: 'الوحدات', featTitle: 'كل ما تحتاجه لإدارة يومك',
    featSub: 'الطلبات والمطبخ والموظفون والفواتير والتسويق — مترابطة حتى لا يضيع شيء',
    pricingLabel: 'الأسعار', pricingTitle: 'أسعار بعملتك المحلية',
    pricingSub: 'باقات للسعودية والإمارات وعُمان · تواصل معنا للحصول على عرض سعر · تسعير خاص للسلاسل',
    trialBig: '7 أيام مجاناً', trialSub: 'لاحظ الفرق في مطعمك بنفسك — بدون بطاقة ائتمان وبدون التزام',
    trialBadges: ['✓ جميع الوحدات مفعّلة', '✓ طلبات غير محدودة', '✓ دعم مباشر', '✓ تقارير من اليوم الأول'],
    testimonialLabel: 'قصص نجاح', testimonialTitle: 'مطاعم تنمو مع SmartRestau',
    faqLabel: 'الأسئلة الشائعة', faqTitle: 'لديك سؤال؟',
    contactLabel: 'تواصل معنا', contactTitle: 'نحن هنا لمساعدتك',
    contactSub: 'تحدّث مع فريقنا بالعربية أو الإنجليزية — عبر واتساب أو البريد الإلكتروني',
    finalTitle: 'خدمة أسرع. مبيعات أكثر. أرقام واضحة.',
    finalSub: 'ابدأ تجربتك المجانية وأدِر الطلبات والمطبخ والموظفين والتقارير من لوحة تحكم واحدة',
    finalCta1: 'ابدأ تجربتي المجانية ←', finalCta2: 'تحدّث مع فريقنا',
    finalNote: 'بدون بطاقة ائتمان · بدون عقد · إلغاء في أي وقت',
    cookie: 'نستخدم ملفات تعريف الارتباط لتحسين تجربتك. راجع',
    cookieLink: 'سياسة الخصوصية', cookieAccept: 'قبول', cookieDecline: 'رفض',
    navLogin: 'تسجيل الدخول', navSignup: 'ابدأ مجاناً',
    systemOk: '🟢 جميع الأنظمة تعمل',
    privacy: 'سياسة الخصوصية', terms: 'شروط الاستخدام', legal: 'الإشعار القانوني',
    allRights: 'جميع الحقوق محفوظة',
    madeWith: 'مصمَّم للمطاعم والمقاهي ومنشآت الضيافة في الخليج — بالعربية والإنجليزية',
    enterpriseTitle: 'باقة المؤسسات والسلاسل',
    enterpriseDesc: 'جميع فروعك في شاشة واحدة — قوائم موحّدة، تقارير مركزية، هوية تجارية خاصة، ودعم بأولوية',
    enterpriseCta: 'تواصل معنا للتسعير المخصص',
    architectureLabel: 'بنية المنصة',
    architectureTitle: 'لوحة تحكم واحدة. لكل عمليات منشأتك.',
    architectureSub: 'ينتقل الطلب من الطاولة إلى المطبخ ثم إلى الفاتورة تلقائياً — أخطاء أقل، خدمة أسرع، وتقارير فورية.',
    marketingEngineLabel: 'التسويق الذكي للأطعمة',
    marketingEngineTitle: 'حوّل كل طبق إلى حملة تسويقية',
    marketingEngineSub: 'صورة واحدة. محتوى جاهز للنشر. وإنفاق أقل على الوكالات.',
    marketingEngineResultTitle: 'محتوى متجدد دون توظيف فريق محتوى.',
    marketingEngineResult: 'أنشئ إعلانات الفيديو والريلز والتعليقات والمنشورات من صور أطباقك بالذكاء الاصطناعي — بالعربية والإنجليزية — وحافظ على نشاط حساباتك دون تكاليف تسويق إضافية.',
    marketingEngineCta: 'شاهدها عملياً ←',
    statsLabel: 'مصمَّم للخليج',
  },
}

function tl<T>(item: { en: T; fr: T; ar: T }, lang: Lang): T {
  return item[lang]
}

// ─── Theme system ──────────────────────────────────────────────────────────────

type LandingTheme = 'dark-green' | 'dark-navy' | 'light-blue'

const HERO_GRADIENT: Record<LandingTheme, string> = {
  'dark-green': 'linear-gradient(135deg, #030712 0%, #111827 60%, #052e16 100%)',
  'dark-navy':  'linear-gradient(135deg, #070d1a 0%, #0d1a3a 60%, #070d1a 100%)',
  'light-blue': 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
}

const H1_GRADIENT: Record<LandingTheme, string> = {
  'dark-green': 'linear-gradient(90deg, #34d399, #6ee7b7)',
  'dark-navy':  'linear-gradient(90deg, #60a5fa, #93c5fd)',
  'light-blue': 'linear-gradient(90deg, #fbbf24, #f59e0b)',
}

const HERO_GLOW: Record<LandingTheme, string> = {
  'dark-green': 'rgba(16,185,129,0.15)',
  'dark-navy':  'rgba(37,99,235,0.18)',
  'light-blue': 'transparent',
}

const THEME_ICONS: Record<LandingTheme, string> = {
  'dark-green': '🌿',
  'dark-navy':  '🌊',
  'light-blue': '☀️',
}

function getEmbedUrl(url: string): string {
  if (!url) return ''
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?\s]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1&color=white`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?color=10b981&title=0&byline=0`
  return url
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '1',       en: 'Dashboard for your whole operation', fr: 'Tableau de bord pour toute votre activité', ar: 'لوحة تحكم واحدة لكل عملياتك' },
  { value: 'AR · EN', en: 'Arabic & English interfaces',         fr: 'Interfaces arabe & anglais',               ar: 'واجهات عربية وإنجليزية' },
  { value: 'mada',    en: 'Apple Pay & cards, paid to you',      fr: 'Apple Pay & cartes, versés chez vous',     ar: 'وApple Pay والبطاقات — تصلك مباشرة' },
  { value: 'Live',    en: 'Sales & kitchen reports',             fr: 'Rapports ventes & cuisine',                ar: 'تقارير المبيعات والمطبخ فورية' },
]

const PERSONAS = [
  {
    icon: Utensils,
    en:  { title: 'Independent Restaurant', pain: 'Lost revenue from errors & slow ops', gain: 'Up and running quickly — more sales, fewer order mistakes' },
    fr:  { title: 'Restaurant Indépendant', pain: 'Revenus perdus à cause des erreurs et lenteurs', gain: 'Opérationnel rapidement — plus de ventes, moins d\'erreurs de commande' },
    ar:  { title: 'مطعم مستقل',            pain: 'إيرادات ضائعة بسبب الأخطاء والبطء',  gain: 'جاهز للعمل بسرعة — مبيعات أكثر وأخطاء أقل في الطلبات' },
    border: 'border-emerald-200 hover:border-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', gainColor: 'text-emerald-700',
  },
  {
    icon: Coffee,
    en:  { title: 'Café & Snack Bar',      pain: 'Slow service kills retention & tips', gain: 'QR ordering, faster service & a higher average ticket' },
    fr:  { title: 'Café & Snack',          pain: 'La lenteur tue la fidélisation et le ticket', gain: 'Commande par QR, service plus rapide, ticket moyen plus élevé' },
    ar:  { title: 'مقهى وسناك',            pain: 'الخدمة البطيئة تضر بالولاء والإيراد',  gain: 'طلب عبر QR، خدمة أسرع، ومتوسط فاتورة أعلى' },
    border: 'border-amber-200 hover:border-amber-500', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', gainColor: 'text-amber-700',
  },
  {
    icon: Building2,
    en:  { title: 'Hotel & Resort',        pain: 'Room service chaos & billing errors', gain: 'Automated operations, real-time reports, less revenue leakage' },
    fr:  { title: 'Hôtel & Resort',        pain: 'Chaos du service en chambre et erreurs de facturation', gain: 'Opérations automatisées, rapports en temps réel, moins de pertes' },
    ar:  { title: 'فندق ومنتجع',           pain: 'فوضى الغرف وأخطاء الفواتير',          gain: 'عمليات مؤتمتة، تقارير فورية، وتسرّب أقل في الإيرادات' },
    border: 'border-sky-200 hover:border-sky-500', iconBg: 'bg-sky-50', iconColor: 'text-sky-600', gainColor: 'text-sky-700',
  },
  {
    icon: ShoppingBag,
    en:  { title: 'Chain & Food Court',    pain: 'Managing multiple outlets is hard',   gain: 'AI command center — all branches, one dashboard, full control' },
    fr:  { title: 'Chaîne & Food Court',   pain: 'Gérer plusieurs points de vente',     gain: 'Poste de commande IA — toutes les branches, un seul tableau de bord' },
    ar:  { title: 'سلسلة وفود كورت',       pain: 'إدارة فروع متعددة صعبة ومرهقة',      gain: 'مركز قيادة ذكي — كل الفروع من لوحة تحكم واحدة' },
    border: 'border-rose-200 hover:border-rose-500', iconBg: 'bg-rose-50', iconColor: 'text-rose-600', gainColor: 'text-rose-700',
  },
]

const BUSINESS_CARDS = [
  {
    emoji: '🍽',
    en: { title: 'Restaurant', desc: 'Complete restaurant management with POS, QR Menu, Kitchen and Reservations.' },
    fr: { title: 'Restaurant', desc: 'Gestion complète : POS, Menu QR, Cuisine et Réservations.' },
    ar: { title: 'مطعم',       desc: 'إدارة شاملة: نقطة بيع، قائمة QR، المطبخ والحجوزات.' },
  },
  {
    emoji: '☕',
    en: { title: 'Café', desc: 'Fast service, QR ordering and customer loyalty.' },
    fr: { title: 'Café', desc: 'Service rapide, commande via QR et fidélité client.' },
    ar: { title: 'مقهى', desc: 'خدمة سريعة، طلب عبر QR وبرنامج ولاء الزبائن.' },
  },
  {
    emoji: '🍔',
    en: { title: 'Snack', desc: 'Fast ordering and simplified POS.' },
    fr: { title: 'Snack', desc: 'Commande rapide et POS simplifié.' },
    ar: { title: 'سناك',  desc: 'طلب سريع ونقطة بيع مبسطة.' },
  },
  {
    emoji: '🍱',
    en: { title: 'Traiteur', desc: 'Events, quotations, planning and production.' },
    fr: { title: 'Traiteur', desc: 'Événements, devis, planification et production.' },
    ar: { title: 'تريتور',   desc: 'مناسبات، عروض أسعار، تخطيط وإنتاج.' },
  },
  {
    emoji: '🏨',
    en: { title: 'Hôtel', desc: 'Restaurant, room service and hospitality workflows.' },
    fr: { title: 'Hôtel', desc: 'Restaurant, room service et opérations hôtelières.' },
    ar: { title: 'فندق',  desc: 'المطعم، خدمة الغرف وعمليات الضيافة.' },
  },
  {
    emoji: '🥐',
    en: { title: 'Pâtisserie', desc: 'Daily production and inventory management.' },
    fr: { title: 'Pâtisserie', desc: 'Production quotidienne et gestion des stocks.' },
    ar: { title: 'حلويات',     desc: 'إنتاج يومي وإدارة المخزون.' },
  },
  {
    emoji: '🥖',
    en: { title: 'Boulangerie', desc: 'Bakery production, stock and sales.' },
    fr: { title: 'Boulangerie', desc: 'Production, stock et ventes de boulangerie.' },
    ar: { title: 'مخبزة',       desc: 'إنتاج المخبزة، المخزون والمبيعات.' },
  },
]

const HOW_IT_WORKS = [
  { step: '01', icon: Mail,
    en: { title: 'Sign Up with Email',     desc: 'Create your account with your email address — quick verification, no friction.' },
    fr: { title: 'Inscription par Email',  desc: 'Créez votre compte avec votre adresse email — vérification rapide, sans friction.' },
    ar: { title: 'سجّل بالإيميل',          desc: 'أنشئ حسابك بعنوان بريدك الإلكتروني — تحقق سريع، بدون تعقيد.' },
  },
  { step: '02', icon: UserCircle,
    en: { title: 'Customise Your Profile', desc: 'Add your restaurant name, logo, colours and contact info — your brand, your identity.' },
    fr: { title: 'Personnalisez votre Profil', desc: 'Ajoutez nom, logo, couleurs et contacts — votre marque, votre identité.' },
    ar: { title: 'خصّص ملفك الشخصي',       desc: 'أضف اسم مطعمك، شعارك، ألوانك ومعلومات التواصل — هويتك، علامتك.' },
  },
  { step: '03', icon: QrCode,
    en: { title: 'Configure Your OS',      desc: 'Add your menu, set staff roles, link kitchen stations — your full operation in one setup.' },
    fr: { title: 'Configurez votre OS',    desc: 'Ajoutez votre menu, définissez les rôles staff et liez les stations cuisine — tout en une config.' },
    ar: { title: 'هيّئ نظام تشغيلك',       desc: 'أضف منيوك، عيّن أدوار الموظفين، اربط محطات المطبخ — كل عملياتك في إعداد واحد.' },
  },
  { step: '04', icon: Utensils,
    en: { title: 'Activate Your Tables',   desc: 'Print a QR sticker per table — customers scan to order and your OS manages everything.' },
    fr: { title: 'Activez vos Tables',     desc: 'Imprimez un QR par table — les clients scannent et votre OS gère tout le reste.' },
    ar: { title: 'فعّل طاولاتك',            desc: 'اطبع QR لكل طاولة — الزبون يمسح ويطلب، ونظامك يدير كل شيء.' },
  },
  { step: '05', icon: Zap,
    en: { title: 'Watch Your Business Run', desc: 'Orders, kitchen, staff and analytics — all live on your dashboard. Your OS handles the rest.' },
    fr: { title: 'Regardez votre Business Tourner', desc: 'Commandes, cuisine, staff et analytics — tout en direct. Votre OS gère le reste.' },
    ar: { title: 'شاهد مطعمك يعمل',         desc: 'طلبات، مطبخ، موظفين وإحصاءات — كل شيء مباشر على لوحتك. نظامك يتولى الباقي.' },
  },
]

const FEATURES = [
  { icon: BarChart3,
    en: { title: 'AI Revenue Analytics',     desc: 'Know top dishes, peak hours, and real margin per table — live data that drives decisions.' },
    fr: { title: 'Analytics IA des Revenus', desc: 'Identifiez vos plats phares, heures de pointe et marge réelle par table — données live.' },
    ar: { title: 'تحليلات الإيرادات الذكية', desc: 'اعرف الأطباق الأكثر مبيعاً، أوقات الذروة، والهامش الحقيقي لكل طاولة — بيانات فورية.' },
  },
  { icon: TrendingUp,
    en: { title: 'Smart Costing Engine',     desc: 'Auto-calculate dish costs vs price — know your real margins and stop bleeding money.' },
    fr: { title: 'Moteur de Costing Intelligent', desc: 'Calculez automatiquement le coût vs prix — connaissez vos vraies marges.' },
    ar: { title: 'محرك التكلفة الذكي',       desc: 'احسب تكلفة كل طبق مقابل سعره تلقائياً — اعرف هامش ربحك الحقيقي.' },
  },
  { icon: Package,
    en: { title: 'Auto Stock Deduction',     desc: 'Every order auto-deducts ingredient stock — real-time inventory, zero manual counting.' },
    fr: { title: 'Déduction Stock Auto',      desc: 'Chaque commande déduit le stock automatiquement — inventaire en temps réel.' },
    ar: { title: 'خصم المخزون التلقائي',     desc: 'كل طلب يخصم مكوناته من المخزون تلقائياً — متابعة فورية، لا جرد يدوي.' },
  },
  { icon: Zap,
    en: { title: 'Instant Kitchen Orders',   desc: 'Orders hit the kitchen in milliseconds with audio alert & KDS screen — zero delays.' },
    fr: { title: 'Commandes Cuisine Instantanées', desc: "Les commandes atteignent la cuisine en millisecondes — alerte audio et écran KDS." },
    ar: { title: 'طلبات فورية للمطبخ',       desc: 'الطلب يصل للمطبخ في الثانية مع صوت تنبيه وشاشة KDS — صفر تأخير.' },
  },
  { icon: ChefHat,
    en: { title: 'Kitchen Display (KDS)',     desc: 'Dedicated kitchen screen shows orders in sequence with prep timers — full operational control.' },
    fr: { title: 'Écran Cuisine (KDS)',        desc: "Écran dédié à la cuisine affichant les commandes en séquence avec minuteries." },
    ar: { title: 'شاشة المطبخ KDS',          desc: 'شاشة مخصصة للمطبخ تعرض الطلبات بالترتيب مع توقيت الإعداد — تحكم كامل.' },
  },
  { icon: Star,
    en: { title: 'Auto Google Reviews',      desc: 'Prompt guests to leave a Google review after every order — higher ranking, more customers.' },
    fr: { title: 'Avis Google Auto',          desc: 'Incitez les clients à laisser un avis Google après chaque commande — meilleur classement.' },
    ar: { title: 'تقييمات Google تلقائية',   desc: 'نشجع زبائنك على كتابة تقييم بعد كل طلب — ترتيب أعلى، زبائن أكثر.' },
  },
  { icon: Share2,
    en: { title: 'Automated Marketing Engine', desc: 'Turn every guest into a marketing channel — auto-prompt shares on Instagram, friend invites, and viral reach. Free ads at every table.' },
    fr: { title: 'Moteur Marketing Automatisé', desc: 'Transformez chaque client en canal marketing — partages Instagram automatiques, invitations, portée virale. Pub gratuite à chaque table.' },
    ar: { title: 'محرك تسويق آلي',           desc: 'كل زبون يصبح قناة تسويقية تلقائية — مشاركة إنستغرام، دعوة أصدقاء، وصول فيروسي. إعلان مجاني على كل طاولة.' },
  },
  { icon: ThumbsUp,
    en: { title: 'Customer Retention System', desc: 'Collect post-order ratings & comments — catch problems before they go public, keep customers coming back.' },
    fr: { title: 'Système de Fidélisation Client', desc: "Collectez notes et commentaires après commande — détectez les problèmes avant qu'ils deviennent publics." },
    ar: { title: 'نظام الاحتفاظ بالزبائن',   desc: 'اجمع التقييمات والتعليقات بعد كل طلب — اكتشف المشاكل مبكراً واحتفظ بزبائنك.' },
  },
  { icon: AlertTriangle,
    en: { title: 'Anti-Fraud Engine',        desc: 'Detects duplicate orders, suspicious patterns & fake reviews automatically — protect your revenue.' },
    fr: { title: 'Moteur Anti-Fraude',        desc: 'Détecte doublons, comportements suspects et faux avis automatiquement — protégez vos revenus.' },
    ar: { title: 'محرك مكافحة الاحتيال',    desc: 'يكشف الطلبات المكررة والأنماط المشبوهة والتقييمات المزيفة تلقائياً — حماية كاملة.' },
  },
  { icon: Wallet,
    en: { title: 'Get Paid Directly',        desc: 'mada, Apple Pay and cards through your own Tap Payments, Moyasar or Stripe account — payments go straight to you.' },
    fr: { title: 'Paiement Direct',          desc: 'mada, Apple Pay et cartes via votre propre compte Tap Payments, Moyasar ou Stripe — les paiements arrivent directement chez vous.' },
    ar: { title: 'تحصيل مباشر لأموالك',      desc: 'مدى وApple Pay والبطاقات عبر حسابك الخاص في Tap Payments أو Moyasar أو Stripe — المدفوعات تصلك مباشرة.' },
  },
  { icon: Languages,
    en: { title: 'Multilingual Operations',  desc: 'Arabic, French, English across the full OS — menu, staff screens, and analytics all localized.' },
    fr: { title: 'Opérations Multilingues',   desc: 'Arabe, français, anglais sur tout l\'OS — menu, écrans staff et analytics localisés.' },
    ar: { title: 'عمليات متعددة اللغات',     desc: 'العربية والفرنسية والإنجليزية في كل النظام — منيو، شاشات الموظفين وإحصاءات محلية.' },
  },
  { icon: Bell,
    en: { title: 'Waiter Call Button',       desc: 'One tap calls the waiter — better service experience, higher tips, stronger retention.' },
    fr: { title: "Bouton d'Appel Serveur",   desc: "Un tap appelle le serveur — meilleure expérience, plus de pourboires, fidélisation." },
    ar: { title: 'استدعاء النادل',            desc: 'زر واحد يستدعي النادل — تجربة أفضل، إكراميات أكثر، ولاء أقوى.' },
  },
  { icon: CreditCard,
    en: { title: 'Bill Request',             desc: 'Guests request the bill from their phone — faster table turnover, more covers per night.' },
    fr: { title: "Demande d'Addition",        desc: "Les clients demandent l'addition depuis leur téléphone — rotation plus rapide des tables." },
    ar: { title: 'طلب الحساب',               desc: 'الزبون يطلب الحساب من هاتفه — دوران طاولات أسرع، وتغطية أكثر في الليلة الواحدة.' },
  },
  { icon: Layers,
    en: { title: 'Table Merging',            desc: 'Large groups? Merge tables in one tap — single unified bill, zero collection confusion.' },
    fr: { title: 'Fusion de Tables',          desc: 'Grands groupes ? Fusionnez les tables en un tap — une facture unifiée, zéro confusion.' },
    ar: { title: 'دمج الطاولات',             desc: 'مجموعات كبيرة؟ ادمج الطاولات بضغطة — فاتورة موحدة، لا ارتباك في التحصيل.' },
  },
  { icon: QrCode,
    en: { title: 'Smart Menu (QR · No App)', desc: 'Part of the Smart Menu module — guests scan to browse and order instantly, no download needed. Works on any phone.' },
    fr: { title: 'Smart Menu (QR · Sans App)', desc: 'Inclus dans le module Smart Menu — les clients scannent et commandent, aucun téléchargement.' },
    ar: { title: 'Smart Menu (QR · بدون تطبيق)', desc: 'ضمن وحدة Smart Menu — الزبون يمسح ويطلب فوراً، بدون تحميل أو تسجيل.' },
  },
]

// ─── Platform Architecture ────────────────────────────────────────────────────

type ModuleLang = { en: string; fr: string; ar: string }
type ModuleFeatLang = { en: string[]; fr: string[]; ar: string[] }

const PLATFORM_MODULES: {
  Icon: ElementType
  prefix: string
  isAi: boolean
  name: ModuleLang
  features: ModuleFeatLang
  iconBg: string; iconColor: string; labelColor: string; border: string; dotColor: string
}[] = [
  {
    Icon: QrCode, prefix: 'SMART', isAi: false,
    name: { en: 'MENU', fr: 'MENU', ar: 'قائمة الطعام' },
    features: {
      en: ['QR Menu', 'Digital Menu', 'Multi-language Menu'],
      fr: ['Menu QR', 'Menu Digital', 'Menu Multilingue'],
      ar: ['منيو QR', 'منيو رقمي', 'منيو متعدد اللغات'],
    },
    iconBg: 'bg-emerald-900/60', iconColor: 'text-emerald-400',
    labelColor: 'text-emerald-500', border: 'border-emerald-700/40', dotColor: 'bg-emerald-400',
  },
  {
    Icon: CreditCard, prefix: 'SMART', isAi: false,
    name: { en: 'POS', fr: 'POS', ar: 'نقطة البيع' },
    features: {
      en: ['Orders', 'Payments', 'Receipts', 'Sales Tracking'],
      fr: ['Commandes', 'Paiements', 'Reçus', 'Suivi Ventes'],
      ar: ['الطلبات', 'المدفوعات', 'الإيصالات', 'تتبع المبيعات'],
    },
    iconBg: 'bg-blue-900/60', iconColor: 'text-blue-400',
    labelColor: 'text-blue-500', border: 'border-blue-700/40', dotColor: 'bg-blue-400',
  },
  {
    Icon: UserCircle, prefix: 'SMART', isAi: false,
    name: { en: 'STAFF', fr: 'STAFF', ar: 'الموظفون' },
    features: {
      en: ['Employees', 'Attendance', 'Scheduling', 'Roles & Permissions'],
      fr: ['Employés', 'Présence', 'Planning', 'Rôles & Permissions'],
      ar: ['الموظفون', 'الحضور', 'الجدولة', 'الأدوار والصلاحيات'],
    },
    iconBg: 'bg-violet-900/60', iconColor: 'text-violet-400',
    labelColor: 'text-violet-500', border: 'border-violet-700/40', dotColor: 'bg-violet-400',
  },
  {
    Icon: Calendar, prefix: 'SMART', isAi: false,
    name: { en: 'RESERVATIONS', fr: 'RÉSERVATIONS', ar: 'الحجوزات' },
    features: {
      en: ['Table Booking', 'Customer Management'],
      fr: ['Réservation Table', 'Gestion Clients'],
      ar: ['حجز الطاولات', 'إدارة العملاء'],
    },
    iconBg: 'bg-sky-900/60', iconColor: 'text-sky-400',
    labelColor: 'text-sky-500', border: 'border-sky-700/40', dotColor: 'bg-sky-400',
  },
  {
    Icon: BarChart3, prefix: 'SMART', isAi: false,
    name: { en: 'ANALYTICS', fr: 'ANALYTICS', ar: 'الإحصاءات' },
    features: {
      en: ['Revenue Tracking', 'Performance Reports', 'Customer Insights'],
      fr: ['Suivi Revenus', 'Rapports Performance', 'Insights Clients'],
      ar: ['تتبع الإيرادات', 'تقارير الأداء', 'رؤى العملاء'],
    },
    iconBg: 'bg-amber-900/60', iconColor: 'text-amber-400',
    labelColor: 'text-amber-500', border: 'border-amber-700/40', dotColor: 'bg-amber-400',
  },
  {
    Icon: Zap, prefix: 'SMART', isAi: true,
    name: { en: 'MARKETING AI', fr: 'MARKETING IA', ar: 'التسويق الذكي' },
    features: {
      en: ['Campaign Generation', 'Social Media Content', 'Promotions'],
      fr: ['Génération Campagnes', 'Contenu Social', 'Promotions'],
      ar: ['توليد الحملات', 'محتوى السوشيال', 'العروض الترويجية'],
    },
    iconBg: 'bg-pink-900/60', iconColor: 'text-pink-400',
    labelColor: 'text-pink-500', border: 'border-pink-700/40', dotColor: 'bg-pink-400',
  },
  {
    Icon: Film, prefix: 'SMART', isAi: true,
    name: { en: 'VIDEO AI', fr: 'VIDÉO IA', ar: 'الفيديو الذكي' },
    features: {
      en: ['Dish Video Creation', 'Promotional Videos', 'Reels Generation'],
      fr: ['Vidéos de Plats', 'Vidéos Promotionnelles', 'Génération Reels'],
      ar: ['فيديوهات الأطباق', 'فيديوهات ترويجية', 'توليد ريلز'],
    },
    iconBg: 'bg-rose-900/60', iconColor: 'text-rose-400',
    labelColor: 'text-rose-500', border: 'border-rose-700/40', dotColor: 'bg-rose-400',
  },
  {
    Icon: Globe2, prefix: 'SMART', isAi: false,
    name: { en: 'SOCIAL', fr: 'SOCIAL', ar: 'السوشيال' },
    features: {
      en: ['Facebook Publishing', 'Instagram Publishing', 'TikTok Publishing', 'YouTube Shorts Publishing'],
      fr: ['Publication Facebook', 'Publication Instagram', 'Publication TikTok', 'YouTube Shorts'],
      ar: ['نشر فيسبوك', 'نشر إنستغرام', 'نشر تيك توك', 'يوتيوب شورتس'],
    },
    iconBg: 'bg-indigo-900/60', iconColor: 'text-indigo-400',
    labelColor: 'text-indigo-500', border: 'border-indigo-700/40', dotColor: 'bg-indigo-400',
  },
  {
    Icon: Building2, prefix: 'SMART', isAi: false,
    name: { en: 'MULTI-BRANCH', fr: 'MULTI-BRANCH', ar: 'متعدد الفروع' },
    features: {
      en: ['Restaurant Chains', 'Franchise Management'],
      fr: ['Chaînes de Restaurants', 'Gestion Franchise'],
      ar: ['سلاسل المطاعم', 'إدارة الفرنشايز'],
    },
    iconBg: 'bg-teal-900/60', iconColor: 'text-teal-400',
    labelColor: 'text-teal-500', border: 'border-teal-700/40', dotColor: 'bg-teal-400',
  },
  {
    Icon: Layers, prefix: 'SMART', isAi: false,
    name: { en: 'WHITE LABEL', fr: 'WHITE LABEL', ar: 'وايت ليبل' },
    features: {
      en: ['Agencies', 'Resellers', 'Restaurant Consultants'],
      fr: ['Agences', 'Revendeurs', 'Consultants Restaurant'],
      ar: ['الوكالات', 'الموزعون', 'مستشارو المطاعم'],
    },
    iconBg: 'bg-gray-700/60', iconColor: 'text-gray-300',
    labelColor: 'text-gray-400', border: 'border-gray-600/40', dotColor: 'bg-gray-400',
  },
]

// ─── AI Marketing Engine Steps ───────────────────────────────────────────────

const AI_MARKETING_STEPS: {
  step: string
  Icon: ElementType
  title: { en: string; fr: string; ar: string }
  items: { en: string[]; fr: string[]; ar: string[] }
  clr: { text: string; bg: string; border: string; ring: string; dot: string; num: string }
}[] = [
  {
    step: '01', Icon: Upload,
    title: { en: 'Upload a Dish Photo', fr: 'Uploadez une Photo de Plat', ar: 'ارفع صورة الطبق' },
    items: {
      en: ['From your phone or camera', 'Any cuisine, any style', 'One click upload'],
      fr: ['Depuis votre téléphone', 'Toutes cuisines', 'Upload en un clic'],
      ar: ['من هاتفك أو كاميرتك', 'أي مطبخ، أي أسلوب', 'رفع بنقرة واحدة'],
    },
    clr: { text: 'text-emerald-400', bg: 'bg-emerald-900/40', border: 'border-emerald-700/50', ring: 'ring-emerald-700/30', dot: 'bg-emerald-400', num: 'text-emerald-500' },
  },
  {
    step: '02', Icon: Brain,
    title: { en: 'AI Analyzes Instantly', fr: "L'IA Analyse Instantanément", ar: 'الذكاء يحلّل فوراً' },
    items: {
      en: ['Ingredients & presentation', 'Colors & visual mood', 'Restaurant style & brand'],
      fr: ['Ingrédients & présentation', 'Couleurs & ambiance', 'Style & marque'],
      ar: ['المكونات والتقديم', 'الألوان والمزاج البصري', 'أسلوب المطعم وعلامته'],
    },
    clr: { text: 'text-blue-400', bg: 'bg-blue-900/40', border: 'border-blue-700/50', ring: 'ring-blue-700/30', dot: 'bg-blue-400', num: 'text-blue-500' },
  },
  {
    step: '03', Icon: FileText,
    title: { en: 'AI Generates Content', fr: "L'IA Génère le Contenu", ar: 'الذكاء يولّد المحتوى' },
    items: {
      en: ['Marketing text & captions', 'Social media posts', 'Ad concepts & promos'],
      fr: ['Textes marketing', 'Publications sociales', 'Concepts pub & promos'],
      ar: ['نصوص تسويقية', 'منشورات السوشيال', 'مفاهيم إعلانية وعروض'],
    },
    clr: { text: 'text-violet-400', bg: 'bg-violet-900/40', border: 'border-violet-700/50', ring: 'ring-violet-700/30', dot: 'bg-violet-400', num: 'text-violet-500' },
  },
  {
    step: '04', Icon: Film,
    title: { en: 'AI Creates Visuals', fr: "L'IA Crée les Visuels", ar: 'الذكاء يصنع المرئيات' },
    items: {
      en: ['Video Ads', 'Instagram Reels', 'TikTok Videos', 'Facebook Posts', 'Story Content'],
      fr: ['Vidéos Publicitaires', 'Instagram Reels', 'Vidéos TikTok', 'Posts Facebook', 'Stories'],
      ar: ['إعلانات فيديو', 'ريلز إنستغرام', 'فيديوهات تيك توك', 'منشورات فيسبوك', 'ستوري'],
    },
    clr: { text: 'text-rose-400', bg: 'bg-rose-900/40', border: 'border-rose-700/50', ring: 'ring-rose-700/30', dot: 'bg-rose-400', num: 'text-rose-500' },
  },
  {
    step: '05', Icon: Send,
    title: { en: 'AI Publishes on Schedule', fr: "L'IA Publie Automatiquement", ar: 'الذكاء ينشر بجدول تلقائي' },
    items: {
      en: ['Optimal posting times', 'All platforms at once', 'Zero manual work'],
      fr: ['Heures optimales', 'Toutes plateformes', 'Zéro travail manuel'],
      ar: ['أوقات نشر مثلى', 'كل المنصات دفعة واحدة', 'صفر عمل يدوي'],
    },
    clr: { text: 'text-amber-400', bg: 'bg-amber-900/40', border: 'border-amber-700/50', ring: 'ring-amber-700/30', dot: 'bg-amber-400', num: 'text-amber-500' },
  },
]

const OUTPUT_FORMATS = [
  { label: 'Video Ad',        ratio: '16:9', color: 'from-rose-900/60 to-rose-800/30',    border: 'border-rose-700/40',    icon: Film,         iconColor: 'text-rose-400'    },
  { label: 'Instagram Reel',  ratio: '9:16', color: 'from-pink-900/60 to-fuchsia-900/30', border: 'border-pink-700/40',    icon: Film,         iconColor: 'text-pink-400'    },
  { label: 'TikTok Video',    ratio: '9:16', color: 'from-gray-800/80 to-gray-900/60',    border: 'border-gray-600/40',    icon: Film,         iconColor: 'text-white'       },
  { label: 'Facebook Post',   ratio: '1:1',  color: 'from-blue-900/60 to-blue-800/30',    border: 'border-blue-700/40',    icon: Share2,       iconColor: 'text-blue-400'    },
  { label: 'Story Content',   ratio: '9:16', color: 'from-amber-900/60 to-orange-900/30', border: 'border-amber-700/40',   icon: Globe2,       iconColor: 'text-amber-400'   },
] as const

const PLAN_NAMES = [
  { en: 'Starter',  fr: 'Starter',  ar: 'أساسي'   },
  { en: 'Pro',      fr: 'Pro',      ar: 'احترافي' },
  { en: 'Business', fr: 'Business', ar: 'أعمال'   },
] as const

function buildPlans(prices: [string, string, string], currency: string) {
  return PLAN_NAMES.map((name, i) => ({ name, price: prices[i], currency }))
}

// TODO(pricing): Gulf prices pending owner decision — plans show "contact us" until then.
const MARKETS = [
  {
    flag: '🇸🇦', currency: 'SAR',
    en: { country: 'Saudi Arabia', cities: 'Riyadh · Jeddah · Dammam · Mecca · Medina' },
    fr: { country: 'Arabie Saoudite', cities: 'Riyad · Djeddah · Dammam · La Mecque · Médine' },
    ar: { country: 'السعودية',        cities: 'الرياض · جدة · الدمام · مكة · المدينة' },
    color: 'from-green-700 to-green-900',
    plans: buildPlans(['', '', ''], 'SAR'),
  },
  {
    flag: '🇦🇪', currency: 'AED',
    en: { country: 'UAE',       cities: 'Dubai · Abu Dhabi · Sharjah · Ajman' },
    fr: { country: 'Émirats',   cities: 'Dubaï · Abu Dhabi · Sharjah · Ajman' },
    ar: { country: 'الإمارات',  cities: 'دبي · أبوظبي · الشارقة · عجمان' },
    color: 'from-red-700 to-red-900',
    plans: buildPlans(['', '', ''], 'AED'),
  },
  {
    flag: '🇴🇲', currency: 'OMR',
    en: { country: 'Oman', cities: 'Muscat · Salalah · Sohar · Nizwa' },
    fr: { country: 'Oman', cities: 'Mascate · Salalah · Sohar · Nizwa' },
    ar: { country: 'عُمان', cities: 'مسقط · صلالة · صحار · نزوى' },
    color: 'from-rose-700 to-rose-900',
    plans: buildPlans(['', '', ''], 'OMR'),
  },
]

// Fabricated testimonials removed (Gulf relaunch). Real ones can still be supplied via cfg.testimonials.
const TESTIMONIALS: LandingConfig['testimonials'] = []

const FAQS = [
  {
    en: { q: 'Do guests need to download an app?', a: 'No. The menu opens directly in the phone browser when scanning the QR — no download, no account.' },
    fr: { q: "Les clients doivent-ils télécharger une app ?", a: "Non. Le menu s'ouvre directement dans le navigateur après scan du QR — aucun téléchargement." },
    ar: { q: 'هل يحتاج الزبون لتحميل تطبيق؟', a: 'لا، قائمة الطعام يفتح مباشرة في متصفح الهاتف عند مسح QR — بدون أي تحميل أو تسجيل.' },
  },
  {
    en: { q: 'How does billing work?', a: 'Start with a 7-day free trial. After that, plans are billed in your local currency (SAR, AED or OMR) — contact us for current pricing.' },
    fr: { q: 'Comment fonctionne la facturation ?', a: "Essai gratuit de 7 jours. Ensuite, les offres sont facturées dans votre devise locale (SAR, AED ou OMR) — contactez-nous pour les tarifs actuels." },
    ar: { q: 'كيف يعمل نظام الفوترة؟', a: 'ابدأ بتجربة مجانية لمدة 7 أيام. بعدها تُحتسب الباقات بعملتك المحلية (ريال سعودي أو درهم إماراتي أو ريال عُماني) — تواصل معنا لمعرفة الأسعار الحالية.' },
  },
  {
    en: { q: 'Can I update the menu anytime?', a: 'Yes, from your phone or computer you can add/remove/edit items instantly from anywhere.' },
    fr: { q: 'Puis-je modifier le menu à tout moment ?', a: 'Oui, depuis votre téléphone ou ordinateur vous pouvez ajouter/supprimer/modifier instantanément.' },
    ar: { q: 'هل يمكنني تعديل قائمة الطعام في أي وقت؟', a: 'نعم، من لوحة التحكم على هاتفك يمكنك إضافة وحذف وتعديل الأصناف فوراً.' },
  },
  {
    en: { q: 'Does it support multiple branches?', a: 'Yes. Each branch has its own account and menu with a separate dashboard. Enterprise plans allow managing all branches from one account.' },
    fr: { q: 'Supporte-t-il plusieurs agences ?', a: 'Oui. Chaque agence a son propre compte et menu. Les plans Enterprise permettent de tout gérer depuis un seul compte.' },
    ar: { q: 'هل يدعم النظام عدة فروع؟', a: 'نعم، كل فرع عنده حسابه وقائمته الخاص. باقة المؤسسات تتيح إدارة كل الفروع من حساب واحد.' },
  },
  {
    en: { q: 'Is support available in Arabic?', a: 'Absolutely — the platform has Arabic and English interfaces, and our team supports you in Arabic and English via WhatsApp and email.' },
    fr: { q: 'Le support est-il disponible en arabe ?', a: "Absolument — la plateforme dispose d'interfaces en arabe et en anglais, et notre équipe vous accompagne en arabe et en anglais via WhatsApp et email." },
    ar: { q: 'هل الدعم متاح بالعربية؟', a: 'بالتأكيد — المنصة بواجهات عربية وإنجليزية، وفريقنا يدعمك بالعربية والإنجليزية عبر واتساب والبريد الإلكتروني.' }
  },
  {
    en: { q: 'How do guests pay?', a: 'With mada, Apple Pay or card, through your own Tap Payments, Moyasar or Stripe account. You connect your account once and payments go directly to you — we never hold your money.' },
    fr: { q: 'Comment les clients paient-ils ?', a: "Par mada, Apple Pay ou carte, via votre propre compte Tap Payments, Moyasar ou Stripe. Vous connectez votre compte une fois et les paiements arrivent directement chez vous — nous ne détenons jamais votre argent." },
    ar: { q: 'كيف يدفع العملاء؟', a: 'بمدى أو Apple Pay أو البطاقات عبر حسابك الخاص في Tap Payments أو Moyasar أو Stripe. تربط حسابك مرة واحدة وتصلك المدفوعات مباشرة — لا نحتفظ بأموالك أبداً.' },
  },
  {
    en: { q: 'What about GDPR compliance?', a: 'SmartMenu is GDPR-compliant. We store minimal data, offer cookie consent, and never sell user data. See our Privacy Policy for details.' },
    fr: { q: 'Quid de la conformité RGPD ?', a: 'SmartMenu est conforme au RGPD. Nous stockons un minimum de données et ne vendons jamais les données. Consultez notre Politique de Confidentialité.' },
    ar: { q: 'هل المنصة متوافقة مع GDPR؟', a: 'نعم، SmartMenu متوافق مع GDPR. نحن نحفظ أقل البيانات ولا نبيعها أبداً. راجع سياسة الخصوصية للتفاصيل.' },
  },
]

// ─── Landing config (loaded from DB, overrides static defaults) ───────────────

type LandingConfig = {
  stats?: { value: string; en: string; fr: string; ar: string }[]
  testimonials?: { name: string; role: { en: string; fr: string; ar: string }; rating: number; text: { en: string; fr: string; ar: string }; avatarUrl?: string }[]
  contact?: { whatsapp?: string; email?: string; location?: { en: string; fr: string; ar: string } }
  heroImageUrl?: string
  platformImageUrl?: string
  logoImageUrl?: string
  promoVideoUrl?: string
  text?: {
    ar?: { tagline?: string; h1a?: string; h1b?: string; h1c?: string; desc?: string; cta1?: string; cta2?: string; trustBar?: string; featTitle?: string; featSub?: string }
    en?: { tagline?: string; h1a?: string; h1b?: string; h1c?: string; desc?: string; cta1?: string; cta2?: string; trustBar?: string; featTitle?: string; featSub?: string }
    fr?: { tagline?: string; h1a?: string; h1b?: string; h1c?: string; desc?: string; cta1?: string; cta2?: string; trustBar?: string; featTitle?: string; featSub?: string }
  }
  faqs?: { en: { q: string; a: string }; fr: { q: string; a: string }; ar: { q: string; a: string } }[]
  footer?: {
    brandName?: string
    flags?: string[]
    whatsapp?: string
    email?: string
    copyright?: string
  }
}

// ─── Cookie Banner ─────────────────────────────────────────────────────────────

function CookieBanner({ lang, t }: { lang: Lang; t: (k: string) => string }) {
  const [visible, setVisible] = useState(false)
  const isRtl = lang === 'ar'

  useEffect(() => {
    if (!localStorage.getItem('sm_cookie_consent')) setVisible(true)
  }, [])

  function accept() { localStorage.setItem('sm_cookie_consent', 'accepted'); setVisible(false) }
  function decline() { localStorage.setItem('sm_cookie_consent', 'declined'); setVisible(false) }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-gray-900/95 backdrop-blur border-t border-gray-700 px-4 py-4">
      <div className={`max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4 justify-between ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
        <p className={`text-gray-300 text-sm flex-1 ${isRtl ? 'text-right' : ''}`}>
          {t('cookie')}{' '}
          <a href="/privacy" className="underline" style={{ color: 'var(--ca)' }}>{t('cookieLink')}</a>.
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={decline} className="px-4 py-2 text-sm text-gray-400 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors">{t('cookieDecline')}</button>
          <button onClick={accept} className="px-5 py-2 text-sm text-white font-semibold rounded-lg transition-colors" style={{ background: 'var(--cp)' }}>{t('cookieAccept')}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('en')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [ctaLoading, setCtaLoading] = useState(false)
  const [ctaError, setCtaError] = useState('')
  const [demoLoading, setDemoLoading] = useState(false)
  const [theme, setTheme] = useState<LandingTheme>('dark-green')

  useEffect(() => {
    const saved = localStorage.getItem('landing-theme') as LandingTheme | null
    if (saved && ['dark-green', 'dark-navy', 'light-blue'].includes(saved)) setTheme(saved)
  }, [])

  function switchTheme(t: LandingTheme) {
    setTheme(t)
    localStorage.setItem('landing-theme', t)
  }

  async function startDemo() {
    setDemoLoading(true)
    try {
      const res = await fetch('/api/demo-login', { method: 'POST' })
      if (!res.ok) { setDemoLoading(false); return }
      const { token, cafeId, isDemo } = await res.json()
      localStorage.setItem('token', token)
      localStorage.setItem('cafeId', cafeId)
      localStorage.setItem('isDemo', isDemo ? '1' : '')
      localStorage.setItem('sm_admin_lang', lang)
      router.push('/admin/dashboard')
    } catch {
      setDemoLoading(false)
    }
  }
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [cfg, setCfg] = useState<LandingConfig>({})

  useEffect(() => {
    fetch('/api/public/landing-config')
      .then(r => r.ok ? r.json() : {})
      .then(d => setCfg(d ?? {}))
      .catch(() => {})
  }, [])

  const stats           = cfg.stats        ?? STATS
  const testimonials    = cfg.testimonials ?? TESTIMONIALS
  const heroImageUrl    = cfg.heroImageUrl    ?? '/assets/mobile.png'
  const platformImageUrl = cfg.platformImageUrl ?? ''
  const logoImageUrl     = cfg.logoImageUrl     ?? '/assets/logo.png'
  const promoVideoUrl    = cfg.promoVideoUrl    ?? ''
  const promoEmbedUrl    = getEmbedUrl(promoVideoUrl)
  const contactPhone  = cfg.contact?.whatsapp ?? '+34 664 546 849'
  const contactEmail  = cfg.contact?.email    ?? 'SmartRestau@gmail.com'
  const footerBrand   = cfg.footer?.brandName ?? 'SmartMenu'
  const footerFlags   = cfg.footer?.flags
    ? (Array.isArray(cfg.footer.flags) ? cfg.footer.flags : String(cfg.footer.flags).split(',').map(f => f.trim()).filter(Boolean))
    : ['🇲🇦','🇸🇦','🇦🇪','🇸🇳','🇨🇮','🇰🇪']
  const footerPhone   = cfg.footer?.whatsapp  ?? contactPhone
  const footerEmail   = cfg.footer?.email     ?? contactEmail
  const footerCopy    = cfg.footer?.copyright ?? `© ${new Date().getFullYear()} SmartRestau`

  const isRtl = lang === 'ar'

  function t(key: string): string {
    const override = (cfg.text as any)?.[lang]?.[key]
    if (override) return override
    const val = T[lang][key]
    return Array.isArray(val) ? val.join(', ') : val ?? key
  }
  function ta(key: string): string[] {
    const val = T[lang][key]
    return Array.isArray(val) ? val : [String(val)]
  }

  function handleEmailCta(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    router.push(`/signup?email=${encodeURIComponent(email.trim())}`)
  }

  const LANGS: { code: Lang; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'fr', label: 'FR' },
    { code: 'ar', label: 'AR' },
  ]

  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} data-theme={theme} className="min-h-screen font-sans overflow-x-hidden" style={{ background: 'var(--cb)', color: 'var(--ct)' }}>
      {/* dangerouslySetInnerHTML: as a JSX text child, the server HTML-escapes
          the quotes in main[data-theme="…"] (&quot;) while the client doesn't,
          which throws a hydration "text content does not match" error. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes heroFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1);    }
        }
        .hero-title-mobile { animation: heroFadeUp 0.55s cubic-bezier(.22,1,.36,1) both; }
        .hero-visual       { animation: heroFadeIn 0.65s cubic-bezier(.22,1,.36,1) 0.18s both; }
        .hero-text-body    { animation: heroFadeUp 0.55s cubic-bezier(.22,1,.36,1) 0.32s both; }
        main[data-theme="dark-green"] {
          --cp: #10b981; --cp-h: #34d399;
          --ca: #34d399; --cg: #34d399;
          --cb: #030712; --cs: #111827;
          --cn: rgba(3,7,18,0.97);
          --cbr: rgba(52,211,153,0.2);
          --ct: #f9fafb; --ctm: #9ca3af;
        }
        main[data-theme="dark-navy"] {
          --cp: #2563eb; --cp-h: #3b82f6;
          --ca: #60a5fa; --cg: #f59e0b;
          --cb: #070d1a; --cs: #0d1526;
          --cn: rgba(7,13,26,0.97);
          --cbr: rgba(37,99,235,0.25);
          --ct: #f8fafc; --ctm: #94a3b8;
        }
        main[data-theme="light-blue"] {
          --cp: #1d4ed8; --cp-h: #2563eb;
          --ca: #1d4ed8; --cg: #d97706;
          --cb: #f8fafc; --cs: #ffffff;
          --cn: rgba(255,255,255,0.98);
          --cbr: #bfdbfe;
          --ct: #0f172a; --ctm: #475569;
        }
      ` }} />

      <CookieBanner lang={lang} t={t} />

      {/* ── Top bar ── */}
      <div className="bg-gray-900 text-gray-400 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contactPhone}</span>
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {contactEmail}</span>
            <span className="hidden sm:inline"><Globe2 className="w-3 h-3 inline mr-1" />MA · SA · AE · SN · CI · GA · KE</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium" style={{ color: 'var(--ca)' }}>{t('systemOk')}</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-500">SSL · GDPR · PCI DSS</span>
          </div>
        </div>
      </div>

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-40 backdrop-blur shadow-sm border-b" style={{ background: 'var(--cn)', borderColor: 'var(--cbr)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Image src={logoImageUrl} alt="SmartRestau" width={38} height={38} className="rounded-xl shadow-sm object-contain" unoptimized />
            <div className="leading-tight">
              <span className="font-extrabold text-lg tracking-tight" style={{ color: 'var(--ct)' }}>SmartRestau</span>
              <span className="hidden sm:block text-[10px] font-semibold leading-none" style={{ color: 'var(--ca)' }}>AI OS · OPERATE · GROW</span>
            </div>
          </div>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-5 text-[13px] font-medium" style={{ color: 'var(--ctm)' }}>
            <a href="#who"      className="whitespace-nowrap transition-colors hover:opacity-100" style={{ color: 'var(--ctm)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--ca)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--ctm)')}>{t('whoLabel')}</a>
            <a href="#platform" className="whitespace-nowrap transition-colors" style={{ color: 'var(--ctm)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--ca)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--ctm)')}>{t('architectureLabel')}</a>
            <a href="#features" className="whitespace-nowrap transition-colors" style={{ color: 'var(--ctm)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--ca)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--ctm)')}>{t('featLabel')}</a>
            <a href="#business-types" className="whitespace-nowrap transition-colors" style={{ color: 'var(--ctm)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--ca)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--ctm)')}>{t('businessTypesLabel')}</a>
            <a href="#how"      className="whitespace-nowrap transition-colors" style={{ color: 'var(--ctm)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--ca)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--ctm)')}>{t('howLabel')}</a>
            <a href="#pricing"  className="whitespace-nowrap transition-colors" style={{ color: 'var(--ctm)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--ca)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--ctm)')}>{t('pricingLabel')}</a>
            <a href="#contact"  className="whitespace-nowrap transition-colors" style={{ color: 'var(--ctm)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--ca)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--ctm)')}>{t('contactLabel')}</a>
          </div>

          {/* Right: lang switcher + theme switcher + CTAs */}
          <div className="flex items-center gap-2">
            {/* Language switcher */}
            <div className="flex items-center bg-black/10 rounded-lg p-0.5 text-xs font-bold">
              {LANGS.map(l => (
                <button key={l.code} onClick={() => setLang(l.code)}
                  className={`px-2.5 py-1.5 rounded-md transition-all ${lang === l.code ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {l.label}
                </button>
              ))}
            </div>
            {/* Theme switcher (desktop) */}
            <div className="hidden lg:flex items-center bg-black/10 rounded-lg p-0.5">
              {(['dark-green', 'dark-navy', 'light-blue'] as LandingTheme[]).map(th => (
                <button
                  key={th}
                  onClick={() => switchTheme(th)}
                  title={th}
                  className={`px-2 py-1.5 rounded-md text-sm transition-all ${theme === th ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-80'}`}
                >
                  {THEME_ICONS[th]}
                </button>
              ))}
            </div>
            <div className="hidden lg:flex items-center gap-2">
              <Link href="/login" className="text-sm font-medium px-3 py-2 transition-colors" style={{ color: 'var(--ctm)' }}>{t('navLogin')}</Link>
              <Link href="/signup" className="text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm" style={{ background: 'var(--cp)' }}>{t('navSignup')}</Link>
            </div>
            <button className="lg:hidden p-2 rounded-lg hover:bg-black/10" style={{ color: 'var(--ct)' }} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t px-4 py-4 space-y-3" style={{ background: 'var(--cs)', borderColor: 'var(--cbr)' }}>
            {[['#who', t('whoLabel')], ['#platform', t('architectureLabel')], ['#features', t('featLabel')], ['#business-types', t('businessTypesLabel')], ['#how', t('howLabel')], ['#pricing', t('pricingLabel')], ['#contact', t('contactLabel')]].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="block font-medium py-1.5" style={{ color: 'var(--ct)' }}>{label}</a>
            ))}
            {/* Theme switcher (mobile) */}
            <div className="flex items-center gap-2 pt-1">
              {(['dark-green', 'dark-navy', 'light-blue'] as LandingTheme[]).map(th => (
                <button
                  key={th}
                  onClick={() => { switchTheme(th); setMobileMenuOpen(false) }}
                  className={`flex-1 py-2 rounded-lg text-center text-base transition-all border ${theme === th ? 'text-white border-transparent' : 'border-transparent opacity-60'}`}
                  style={theme === th ? { background: 'var(--cp)' } : { background: 'var(--cs)', borderColor: 'var(--cbr)' }}
                >
                  {THEME_ICONS[th]}
                </button>
              ))}
            </div>
            <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="block text-white text-center py-3 rounded-xl font-bold mt-2" style={{ background: 'var(--cp)' }}>{t('navSignup')}</Link>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ECOSYSTEM SHOWCASE */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 relative overflow-hidden" style={{ background: 'var(--cb)' }}>
        {/* dot grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        {/* ambient center glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] rounded-full blur-[140px] pointer-events-none" style={{ background: HERO_GLOW[theme] }} />

        <div className="relative max-w-7xl mx-auto px-4">

          {/* Section header */}
          <div className="text-center mb-14">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-5">
              {lang === 'ar' ? (
                <>كل ما يحتاجه نشاطك.<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>في نظام واحد.</span></>
              ) : lang === 'fr' ? (
                <>Tout ce dont votre commerce a besoin.<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>Dans un seul OS.</span></>
              ) : (
                <>Everything Your Business Needs.<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>One Unified OS.</span></>
              )}
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              {lang === 'ar'
                ? 'من القوائم الذكية وشاشات المطبخ إلى التسويق بالذكاء الاصطناعي والنشر التلقائي — كل شيء متصل وكل شيء مؤتمت.'
                : lang === 'fr'
                ? 'Des menus intelligents aux écrans cuisine, en passant par le marketing IA et la publication sociale — tout connecté, tout automatisé.'
                : 'From smart menus and kitchen displays to AI marketing and social publishing — all connected, all automated.'}
            </p>
          </div>

          {/* Image showcase */}
          <div className="relative">
            {/* outer glow ring */}
            <div className="absolute -inset-6 rounded-3xl blur-2xl" style={{ background: HERO_GLOW[theme] }} />
            {/* mid glow */}
            <div className="absolute -inset-2 rounded-2xl" style={{ background: 'var(--cbr)', opacity: 0.3 }} />
            {/* image frame */}
            <div className="relative rounded-2xl overflow-hidden border ring-1 ring-white/5" style={{ borderColor: 'var(--cbr)' }}>
              <Image
                src="/assets/smartrest.png"
                alt="Smart Resto — Complete Restaurant OS"
                width={1400}
                height={900}
                className="w-full h-auto object-cover"
                priority
                unoptimized
              />
              {/* subtle bottom fade */}
              <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-gray-950/60 to-transparent" />
            </div>
          </div>

          {/* Benefits bar */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {([
              { icon: TrendingUp, en: 'Increase Revenue',     fr: 'Augmenter les Revenus',  ar: 'زيادة الإيرادات',     color: 'emerald' },
              { icon: CheckCircle,icon2: CheckCircle, en: 'Reduce Errors',         fr: 'Réduire les Erreurs',    ar: 'تقليل الأخطاء',      color: 'blue'    },
              { icon: Clock,      en: 'Save Time',            fr: 'Gagner du Temps',         ar: 'توفير الوقت',         color: 'amber'   },
              { icon: Layers,     en: 'Control Operations',   fr: 'Contrôler les Opérations',ar: 'التحكم في العمليات',  color: 'violet'  },
              { icon: Star,       en: 'Delight Customers',    fr: 'Ravir les Clients',        ar: 'إسعاد الزبائن',       color: 'rose'    },
              { icon: Zap,        en: 'Grow Your Brand',      fr: 'Développer votre Marque',  ar: 'تنمية علامتك',       color: 'teal'    },
            ] as const).map(({ icon: Icon, en: enL, fr: frL, ar: arL, color }) => {
              const label = lang === 'ar' ? arL : lang === 'fr' ? frL : enL
              const colorMap: Record<string, { bg: string; text: string; border: string }> = {
                emerald: { bg: 'bg-emerald-900/40', text: 'text-emerald-300', border: 'border-emerald-700/40' },
                blue:    { bg: 'bg-blue-900/40',    text: 'text-blue-300',    border: 'border-blue-700/40'    },
                amber:   { bg: 'bg-amber-900/40',   text: 'text-amber-300',   border: 'border-amber-700/40'   },
                violet:  { bg: 'bg-violet-900/40',  text: 'text-violet-300',  border: 'border-violet-700/40'  },
                rose:    { bg: 'bg-rose-900/40',    text: 'text-rose-300',    border: 'border-rose-700/40'    },
                teal:    { bg: 'bg-teal-900/40',    text: 'text-teal-300',    border: 'border-teal-700/40'    },
              }
              const c = colorMap[color]
              return (
                <div key={enL} className={`flex flex-col items-center gap-2.5 ${c.bg} border ${c.border} rounded-2xl px-4 py-5 text-center`}>
                  <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${c.text}`} />
                  </div>
                  <span className={`text-sm font-semibold ${c.text} leading-tight`}>{label}</span>
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HERO */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: HERO_GRADIENT[theme] }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[120px]" style={{ background: HERO_GLOW[theme] }} />

        <div className={`relative max-w-7xl mx-auto px-4 pt-10 pb-14 lg:pt-16 lg:pb-20 flex flex-col ${isRtl ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-5 lg:gap-16`}>

          {/* ── Mobile-first: tagline + title FIRST on small screens ── */}
          <div className="lg:hidden w-full text-center hero-title-mobile">
            <div className="inline-flex items-center gap-2 border px-4 py-1.5 rounded-full text-sm font-medium mb-4" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--ca)' }} />
              {t('tagline')}
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.1] text-white mt-1">
              {t('h1a')}
              <span className="block bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>{t('h1b')}</span>
            </h1>
          </div>

          {/* ── Text column (desktop: full left col; mobile: desc+CTAs below visual) ── */}
          <div className={`flex-1 ${isRtl ? 'text-right' : 'text-left'} text-center lg:text-inherit order-3 lg:order-none hero-text-body`}>

            {/* Desktop-only title */}
            <div className="hidden lg:block">
              <div className="inline-flex items-center gap-2 border px-4 py-1.5 rounded-full text-sm font-medium mb-7" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--ca)' }} />
                {t('tagline')}
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] text-white">
                {t('h1a')}
                <span className="block bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>{t('h1b')}</span>
              </h1>
            </div>

            <p className="mt-5 text-base sm:text-lg text-gray-400 leading-relaxed max-w-lg whitespace-pre-line">{t('desc')}</p>

            <div className={`mt-7 flex flex-col sm:flex-row gap-3 justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'}`}>
              <Link href="/signup" className="flex items-center justify-center gap-2 text-white font-bold px-7 py-3.5 rounded-xl shadow-xl transition-all text-base" style={{ background: 'var(--cp)' }}>
                {t('cta1')} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Trust bar */}
            <p className={`mt-5 text-gray-500 text-sm flex items-center gap-2 justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'}`}>
              <span className="flex gap-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
              </span>
              {t('trustBar')}
            </p>

            <div className={`mt-4 flex flex-wrap gap-2 justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'}`}>
              {ta('badges').map(b => (
                <span key={b} className="flex items-center gap-1.5 bg-white/8 text-gray-300 border border-white/10 px-3 py-1.5 rounded-full text-xs font-medium">
                  <CheckCircle className="w-3 h-3 shrink-0" style={{ color: 'var(--ca)' }} /> {b}
                </span>
              ))}
            </div>
          </div>

          {/* ── Dashboard visual — order-2 on mobile = after title, before text ── */}
          <div className="flex-1 flex items-center justify-center mt-1 lg:mt-0 order-2 lg:order-none hero-visual">
            <div className="relative w-full max-w-sm lg:max-w-xl xl:max-w-2xl">
              <div className="absolute -inset-8 rounded-3xl blur-3xl" style={{ background: HERO_GLOW[theme] }} />
              <div className="absolute -inset-16 rounded-3xl bg-teal-500/8 blur-[80px]" />

              {/* Dashboard frame */}
              <div className="relative bg-gray-900/90 border border-gray-700/60 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm">

                {/* Window chrome */}
                <div className="bg-gray-800/80 px-4 py-2.5 flex items-center gap-3 border-b border-gray-700/50">
                  <div className="flex gap-1.5 shrink-0">
                    <span className="w-3 h-3 rounded-full bg-red-500/80" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <span className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <span className="text-[11px] text-gray-400 font-medium bg-gray-700/50 px-3 py-0.5 rounded-full">SmartRestau OS — Dashboard</span>
                  </div>
                </div>

                {/* KPI row */}
                <div className="p-3 grid grid-cols-3 gap-2">
                  <div className="bg-emerald-900/40 border border-emerald-700/30 rounded-xl p-3 text-center">
                    <p className="text-emerald-400 text-[9px] font-bold uppercase tracking-wider mb-1">Revenue</p>
                    <p className="text-white text-lg font-extrabold">+32%</p>
                  </div>
                  <div className="bg-blue-900/40 border border-blue-700/30 rounded-xl p-3 text-center">
                    <p className="text-blue-400 text-[9px] font-bold uppercase tracking-wider mb-1">Orders</p>
                    <p className="text-white text-lg font-extrabold">1,248</p>
                  </div>
                  <div className="bg-amber-900/40 border border-amber-700/30 rounded-xl p-3 text-center">
                    <p className="text-amber-400 text-[9px] font-bold uppercase tracking-wider mb-1">Tables</p>
                    <p className="text-white text-lg font-extrabold">24 / 24</p>
                  </div>
                </div>

                {/* Module grid */}
                <div className="px-3 pb-3 grid grid-cols-4 gap-2">
                  {([
                    { icon: CreditCard, label: 'POS',            color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-800/40', badge: 'LIVE',       badgeColor: 'bg-emerald-500/20 text-emerald-300' },
                    { icon: UserCircle, label: 'Staff Mgmt',     color: 'text-blue-400',    bg: 'bg-blue-900/30 border-blue-800/40',       badge: '12 active',  badgeColor: 'bg-blue-500/20 text-blue-300'    },
                    { icon: Clock,      label: 'Attendance',     color: 'text-violet-400',  bg: 'bg-violet-900/30 border-violet-800/40',   badge: 'AI',         badgeColor: 'bg-violet-500/20 text-violet-300'},
                    { icon: Calendar,   label: 'Reservations',   color: 'text-sky-400',     bg: 'bg-sky-900/30 border-sky-800/40',         badge: '8 today',    badgeColor: 'bg-sky-500/20 text-sky-300'     },
                    { icon: BarChart3,  label: 'Analytics',      color: 'text-amber-400',   bg: 'bg-amber-900/30 border-amber-800/40',     badge: 'Live',       badgeColor: 'bg-amber-500/20 text-amber-300' },
                    { icon: Zap,        label: 'AI Marketing',   color: 'text-pink-400',    bg: 'bg-pink-900/30 border-pink-800/40',       badge: 'Auto',       badgeColor: 'bg-pink-500/20 text-pink-300'   },
                    { icon: Film,       label: 'Video Studio',   color: 'text-rose-400',    bg: 'bg-rose-900/30 border-rose-800/40',       badge: 'AI',         badgeColor: 'bg-rose-500/20 text-rose-300'   },
                    { icon: Building2,  label: 'Multi-Branch',   color: 'text-teal-400',    bg: 'bg-teal-900/30 border-teal-800/40',       badge: '3 branches', badgeColor: 'bg-teal-500/20 text-teal-300'   },
                  ] as const).map(({ icon: Icon, label, color, bg, badge, badgeColor }) => (
                    <div key={label} className={`${bg} border rounded-xl p-3 flex flex-col gap-2`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                      <p className="text-white text-[11px] font-bold leading-tight">{label}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeColor} w-fit`}>{badge}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* STATS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-10" style={{ background: 'var(--cp)' }}>
        <div className="max-w-5xl mx-auto px-4">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest text-center mb-6">{t('statsLabel')}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map(s => (
              <div key={s.value}>
                <div className="text-4xl font-extrabold text-white">{s.value}</div>
                <div className="text-white/70 text-sm mt-1 font-medium">{tl(s, lang)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PROMO VIDEO */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {promoEmbedUrl && (
        <section className="py-24 relative overflow-hidden" style={{ background: 'var(--cs)' }}>
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full blur-[130px] pointer-events-none" style={{ background: HERO_GLOW[theme] }} />

          <div className="relative max-w-5xl mx-auto px-4">

            {/* Header */}
            <div className="text-center mb-14">
              <span className="inline-block border px-4 py-1.5 rounded-full text-sm font-semibold mb-5" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>
                {lang === 'ar' ? 'شاهده مباشرة' : lang === 'fr' ? 'Voir en Action' : 'See It in Action'}
              </span>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
                {lang === 'ar' ? (
                  <>شاهد كيف يحوّل SmartRestau<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>مطعمك في أقل من 30 دقيقة</span></>
                ) : lang === 'fr' ? (
                  <>Regardez comment SmartRestau<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>transforme un restaurant en 30 min</span></>
                ) : (
                  <>Watch How SmartRestau<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>Transforms a Restaurant in 30 Min</span></>
                )}
              </h2>
              <p className="text-gray-400 text-lg max-w-xl mx-auto">
                {lang === 'ar'
                  ? 'من الإعداد الأول إلى أول طلب حقيقي — شاهد كل شيء بالكامل.'
                  : lang === 'fr'
                  ? 'De la première config au premier vrai ticket — regardez tout en direct.'
                  : 'From first setup to first real ticket — watch the full walkthrough.'}
              </p>
            </div>

            {/* Browser-frame video */}
            <div className="relative">
              {/* outer glow */}
              <div className="absolute -inset-6 rounded-3xl blur-2xl" style={{ background: HERO_GLOW[theme] }} />
              {/* frame */}
              <div className="relative rounded-2xl overflow-hidden border border-gray-700/70 shadow-[0_0_60px_rgba(16,185,129,0.12)] ring-1 ring-white/5 bg-gray-950">
                {/* window chrome */}
                <div className="bg-gray-800/90 px-4 py-3 flex items-center gap-3 border-b border-gray-700/60">
                  <div className="flex gap-1.5 shrink-0">
                    <span className="w-3 h-3 rounded-full bg-red-500/80" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <span className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <span className="text-[11px] text-gray-400 bg-gray-700/50 px-3 py-0.5 rounded-full font-medium">
                      SmartRestau — Platform Demo
                    </span>
                  </div>
                  <span className="text-[10px] font-bold shrink-0" style={{ color: 'var(--ca)' }}>● LIVE</span>
                </div>
                {/* 16:9 responsive iframe */}
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={promoEmbedUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    title="SmartRestau Demo"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* CTA below video */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="flex items-center gap-2 text-white font-bold px-8 py-3.5 rounded-xl shadow-xl transition-all text-base" style={{ background: 'var(--cp)' }}>
                {t('cta1')} <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={startDemo}
                disabled={demoLoading}
                className="flex items-center gap-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 font-semibold px-8 py-3.5 rounded-xl transition-all text-base disabled:opacity-60"
              >
                {demoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('ctaDemo')}
              </button>
            </div>

          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* WHO IS IT FOR — PERSONAS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="who" className="py-24" style={{ background: 'var(--cs)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className={`mb-14 ${isRtl ? 'text-right' : 'text-left'} text-center`}>
            <span className="inline-block border px-4 py-1 rounded-full text-sm font-semibold mb-4" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>{t('whoLabel')}</span>
            <h2 className="text-4xl font-extrabold text-gray-900">{t('whoTitle')}</h2>
            <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto">{t('whoSub')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PERSONAS.map((p, i) => {
              const Icon = p.icon
              const d = tl(p, lang)
              return (
                <div key={i} className={`border-2 rounded-2xl p-6 transition-all cursor-pointer group bg-white ${p.border}`}>
                  <div className={`w-12 h-12 rounded-xl ${p.iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-6 h-6 ${p.iconColor}`} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-4">{d.title}</h3>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm text-gray-500">
                      <span className="shrink-0 mt-0.5 text-red-400 font-bold">✗</span>
                      <span>{d.pain}</span>
                    </div>
                    <div className={`flex items-start gap-2 text-sm font-semibold ${p.gainColor}`}>
                      <span className="shrink-0 mt-0.5">✓</span>
                      <span>{d.gain}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PLATFORM ARCHITECTURE */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="platform" className="py-24 relative overflow-hidden" style={{ background: 'var(--cb)' }}>
        {/* bg dot grid */}
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* ambient glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px]" style={{ background: HERO_GLOW[theme] }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />

        <div className="relative max-w-7xl mx-auto px-4">

          {/* Header */}
          <div className="text-center mb-16">
            <span className="inline-block border px-4 py-1 rounded-full text-sm font-semibold mb-5" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>
              {t('architectureLabel')}
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
              {lang === 'ar'
                ? <>منصة واحدة. <span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>كل عمليات نشاطك.</span></>
                : lang === 'fr'
                ? <>Une Plateforme. <span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>Toutes les Opérations.</span></>
                : <>One Platform. <span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>Every Business Operation.</span></>
              }
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t('architectureSub')}</p>
          </div>

          {/* Module grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {PLATFORM_MODULES.map((mod) => (
              <div
                key={mod.name.en}
                className={`group relative bg-gray-900/70 border ${mod.border} rounded-2xl p-5 hover:bg-gray-900 hover:scale-[1.02] transition-all duration-200 cursor-default overflow-hidden`}
              >
                {/* subtle inner glow on hover */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`}
                  style={{ background: `radial-gradient(circle at 30% 20%, ${mod.iconColor.replace('text-', '').replace('-400', '')} 0%, transparent 70%)`, opacity: 0 }} />

                {/* Icon */}
                <div className={`w-11 h-11 ${mod.iconBg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                  <mod.Icon className={`w-5 h-5 ${mod.iconColor}`} />
                </div>

                {/* Module name */}
                <div className="mb-3">
                  <p className={`text-[9px] font-extrabold uppercase tracking-[0.15em] ${mod.labelColor} mb-0.5`}>
                    {mod.prefix}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-white font-extrabold text-sm leading-tight">{mod.name[lang]}</h3>
                    {mod.isAi && (
                      <span className="inline-flex items-center text-[9px] font-extrabold border px-1.5 py-0.5 rounded-full leading-none" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>
                        AI
                      </span>
                    )}
                  </div>
                </div>

                {/* Feature list */}
                <ul className="space-y-1.5">
                  {mod.features[lang].map((feat) => (
                    <li key={feat} className={`flex items-center gap-2 text-[11px] text-gray-400 leading-tight ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <span className={`w-1 h-1 rounded-full ${mod.dotColor} shrink-0`} />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom connector line */}
          <div className="mt-12 flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
            <span className="text-gray-500 text-xs font-semibold uppercase tracking-widest whitespace-nowrap">
              {lang === 'ar' ? 'كل الوحدات متصلة • بيانات موحدة • لوحة تحكم واحدة'
                : lang === 'fr' ? 'Tous les modules connectés • Données unifiées • Un seul dashboard'
                : 'All modules connected • Unified data • Single dashboard'}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="how" className="py-24" style={{ background: 'var(--cs)' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className={`mb-16 text-center`}>
            <span className="inline-block bg-amber-100 text-amber-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">{t('howLabel')}</span>
            <h2 className="text-4xl font-extrabold" style={{ color: 'var(--ct)' }}>{t('howTitle')}</h2>
            <p className="mt-3 text-lg" style={{ color: 'var(--ctm)' }}>{t('howSub')}</p>
          </div>
          <div className="relative">
            <div className="hidden lg:block absolute top-11 left-[12.5%] right-[12.5%] h-0.5" style={{ background: `linear-gradient(90deg, transparent, var(--ca), transparent)` }} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {HOW_IT_WORKS.map((step, i) => {
                const Icon = step.icon
                const d = tl(step, lang)
                return (
                  <div key={i} className="flex flex-col items-center text-center">
                    <div className="w-22 h-22 relative mb-5">
                      <div className="w-20 h-20 rounded-2xl text-white flex flex-col items-center justify-center shadow-lg mx-auto" style={{ background: 'var(--cp)' }}>
                        <Icon className="w-7 h-7" />
                        <span className="text-[10px] font-bold opacity-60 mt-1">{step.step}</span>
                      </div>
                    </div>
                    <h3 className="font-bold text-base mb-2" style={{ color: 'var(--ct)' }}>{d.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--ctm)' }}>{d.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FEATURES */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-24" style={{ background: 'var(--cs)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className={`mb-16 text-center`}>
            <span className="inline-block border px-4 py-1 rounded-full text-sm font-semibold mb-4" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>{t('featLabel')}</span>
            <h2 className="text-4xl font-extrabold" style={{ color: 'var(--ct)' }}>{t('featTitle')}</h2>
            <p className="mt-3 text-lg max-w-2xl mx-auto" style={{ color: 'var(--ctm)' }}>{t('featSub')}</p>
            {platformImageUrl && (
              <div className="mt-10 flex justify-center">
                <Image
                  src={platformImageUrl}
                  alt="Platform overview"
                  width={900}
                  height={500}
                  className="w-full max-w-3xl h-auto rounded-2xl shadow-lg object-contain"
                  unoptimized
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              const d = tl(f, lang)
              return (
                <div key={i} className={`rounded-2xl p-5 border hover:shadow-md transition-all group ${isRtl ? 'text-right' : ''}`} style={{ background: 'var(--cs)', borderColor: 'var(--cbr)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors" style={{ background: 'var(--cbr)' }}>
                    <Icon className="w-5 h-5" style={{ color: 'var(--ca)' }} />
                  </div>
                  <h4 className="font-bold text-sm mb-1" style={{ color: 'var(--ct)' }}>{d.title}</h4>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--ctm)' }}>{d.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* BUSINESS TYPES — WHICH BUSINESS DO YOU MANAGE */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="business-types" className="py-24" style={{ background: 'var(--cb)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-14 text-center">
            <span className="inline-block border px-4 py-1 rounded-full text-sm font-semibold mb-4" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>{t('bizLabel')}</span>
            <h2 className="text-4xl font-extrabold" style={{ color: 'var(--ct)' }}>{t('bizTitle')}</h2>
            <p className="mt-3 text-lg max-w-2xl mx-auto" style={{ color: 'var(--ctm)' }}>{t('bizSub')}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {BUSINESS_CARDS.map((b, i) => {
              const d = tl(b, lang)
              return (
                <div key={i} className={`group rounded-2xl p-5 border hover:shadow-lg transition-all cursor-default ${isRtl ? 'text-right' : ''}`} style={{ background: 'var(--cs)', borderColor: 'var(--cbr)' }}>
                  <div className="text-3xl mb-3 group-hover:scale-110 transition-transform origin-left">{b.emoji}</div>
                  <h3 className="font-bold text-base mb-1.5" style={{ color: 'var(--ct)' }}>{d.title}</h3>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--ctm)' }}>{d.desc}</p>
                  <Link href="/signup" className="inline-flex items-center gap-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--ca)' }}>
                    {t('bizLearnMore')} <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              )
            })}
          </div>

          {/* Dynamic explanation */}
          <div className="mt-16 rounded-3xl border p-8 lg:p-12 text-center" style={{ background: 'var(--cs)', borderColor: 'var(--cbr)' }}>
            <span className="inline-block border px-4 py-1 rounded-full text-sm font-semibold mb-4" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>{t('dynLabel')}</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold mb-3" style={{ color: 'var(--ct)' }}>{t('dynTitle')}</h3>
            <p className="text-base max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--ctm)' }}>{t('dynSub')}</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* AI FOOD MARKETING ENGINE */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="marketing-engine" className="py-24 relative overflow-hidden" style={{ background: 'var(--cb)' }}>
        {/* bg grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* ambient glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-rose-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-600/8 rounded-full blur-[100px]" />

        <div className="relative max-w-7xl mx-auto px-4">

          {/* ── Header ── */}
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-rose-900/50 text-rose-400 border border-rose-700/40 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
              <Zap className="w-3.5 h-3.5" />
              {t('marketingEngineLabel')}
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
              {lang === 'ar'
                ? <>حوّل كل طبق إلى <span className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">حملة تسويقية</span></>
                : lang === 'fr'
                ? <>Transformez Chaque Plat en <span className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">Campagne Marketing</span></>
                : <>Turn Every Dish Into a <span className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">Marketing Campaign</span></>
              }
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">{t('marketingEngineSub')}</p>
          </div>

          {/* ── Workflow pipeline ── */}
          <div className="relative">
            {/* connector line — desktop only */}
            <div className="hidden lg:block absolute top-[52px] left-[10%] right-[10%] h-px" style={{ background: `linear-gradient(90deg, var(--cbr), var(--ca), var(--cg))` }} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {AI_MARKETING_STEPS.map((s, i) => {
                const Icon = s.Icon
                return (
                  <div key={i} className={`relative group bg-gray-900/80 border ${s.clr.border} rounded-2xl p-5 hover:bg-gray-900 hover:scale-[1.02] transition-all duration-200`}>
                    {/* step badge + icon */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 ${s.clr.bg} ring-1 ${s.clr.ring} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-5 h-5 ${s.clr.text}`} />
                      </div>
                      <span className={`text-xs font-extrabold uppercase tracking-widest ${s.clr.num}`}>{s.step}</span>
                    </div>

                    {/* title */}
                    <h3 className={`font-extrabold text-white text-sm mb-3 leading-snug ${isRtl ? 'text-right' : ''}`}>
                      {s.title[lang]}
                    </h3>

                    {/* items */}
                    <ul className={`space-y-1.5 ${isRtl ? 'text-right' : ''}`}>
                      {s.items[lang].map(item => (
                        <li key={item} className={`flex items-center gap-2 text-[11px] text-gray-400 leading-tight ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <span className={`w-1 h-1 rounded-full ${s.clr.dot} shrink-0`} />
                          {item}
                        </li>
                      ))}
                    </ul>

                    {/* connector arrow — between cards on large screens */}
                    {i < AI_MARKETING_STEPS.length - 1 && (
                      <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Output format showcase ── */}
          <div className="mt-10">
            <p className={`text-center text-xs font-bold uppercase tracking-widest text-gray-500 mb-5`}>
              {lang === 'ar' ? 'تنسيقات المحتوى المُولَّدة تلقائياً'
                : lang === 'fr' ? 'Formats de contenu générés automatiquement'
                : 'Content formats generated automatically'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {OUTPUT_FORMATS.map(fmt => {
                const FmtIcon = fmt.icon
                const is916 = fmt.ratio === '9:16'
                return (
                  <div key={fmt.label}
                    className={`group bg-gradient-to-br ${fmt.color} border ${fmt.border} rounded-2xl p-4 flex flex-col items-center gap-3 hover:scale-[1.03] transition-all cursor-default`}>
                    {/* format preview box */}
                    <div className={`${is916 ? 'w-10 h-16' : fmt.ratio === '1:1' ? 'w-12 h-12' : 'w-16 h-10'} bg-black/30 rounded-lg border border-white/10 flex items-center justify-center`}>
                      <FmtIcon className={`${is916 ? 'w-4 h-4' : 'w-5 h-5'} ${fmt.iconColor}`} />
                    </div>
                    <div className="text-center">
                      <p className="text-white text-xs font-bold leading-tight">{fmt.label}</p>
                      <span className="text-gray-500 text-[9px] font-mono">{fmt.ratio}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Result callout ── */}
          <div className="mt-14 relative overflow-hidden rounded-3xl">
            {/* layered bg */}
            <div className="absolute inset-0 bg-gradient-to-br from-rose-950/80 via-gray-900/90 to-amber-950/60" />
            <div className="absolute inset-0 opacity-[0.06]"
              style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-24 bg-rose-500/20 blur-[60px]" />

            <div className={`relative px-8 py-10 text-center ${isRtl ? 'text-right' : ''}`}>
              {/* zero-cost stat */}
              <div className="flex items-center justify-center gap-6 mb-5 flex-wrap">
                {(['0', '0', '0'] as const).map((n, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-5xl font-black text-white leading-none">{n}</span>
                    <span className="text-gray-400 text-xs font-semibold mt-1">
                      {i === 0
                        ? (lang === 'ar' ? 'مصمم' : lang === 'fr' ? 'Designer' : 'Designers')
                        : i === 1
                        ? (lang === 'ar' ? 'مصوّر' : lang === 'fr' ? 'Vidéaste' : 'Videographers')
                        : (lang === 'ar' ? 'مدير سوشيال' : lang === 'fr' ? 'Community Mgr' : 'Social Mgr')}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-white text-xl sm:text-2xl font-extrabold mb-3 max-w-2xl mx-auto leading-snug">
                {t('marketingEngineResultTitle')}
              </p>
              <p className="text-gray-400 text-base max-w-2xl mx-auto leading-relaxed mb-7">
                {t('marketingEngineResult')}
              </p>

              <Link href="/signup"
                className="inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-400 text-white font-bold px-8 py-3.5 rounded-xl shadow-xl shadow-rose-900/40 transition-all text-sm">
                {t('marketingEngineCta')} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PRICING / MARKETS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-24" style={{ background: 'var(--cs)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">{t('pricingLabel')}</span>
            <h2 className="text-4xl font-extrabold text-gray-900">{t('pricingTitle')}</h2>
            <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto">{t('pricingSub')}</p>
          </div>

          {/* Trial banner */}
          <div className="rounded-3xl p-8 mb-10 text-center text-white" style={{ background: `linear-gradient(135deg, var(--cp), var(--cp-h))` }}>
            <div className="text-5xl font-extrabold mb-2">{t('trialBig')}</div>
            <div className="text-white/80 text-lg mb-5">{t('trialSub')}</div>
            <div className="flex flex-wrap gap-3 justify-center text-sm">
              {ta('trialBadges').map(b => (
                <span key={b} className="bg-white/20 px-4 py-1.5 rounded-full">{b}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {MARKETS.map((m, idx) => {
              const d = tl(m, lang)
              return (
                <div key={idx} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white">
                  <div className={`bg-gradient-to-br ${m.color} px-6 py-5`}>
                    <div className="text-3xl mb-2">{m.flag}</div>
                    <h3 className="text-white font-extrabold text-lg">{d.country}</h3>
                    <p className="text-white/60 text-xs mt-1">{d.cities}</p>
                  </div>
                  <div className="px-5 py-4">
                    <div className="space-y-2 mb-3">
                      {m.plans.map((p, pi) => (
                        <div key={pi} className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">{tl(p.name, lang)}</span>
                          <span className="font-bold text-xs" style={{ color: 'var(--cp)' }}>
                            {p.price
                              ? `${p.price} ${p.currency} ${lang === 'ar' ? '/ شهرياً' : lang === 'fr' ? '/ mois' : '/ month'}`
                              : (lang === 'ar' ? `بالـ ${p.currency} · تواصل معنا` : lang === 'fr' ? `En ${p.currency} · Nous contacter` : `In ${p.currency} · Contact us`)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Link href="/signup" className="block text-center bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-xl font-bold text-xs transition-colors">
                      {lang === 'ar' ? `ابدأ في ${d.country}` : lang === 'fr' ? `Démarrer en ${d.country}` : `Start in ${d.country}`}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Enterprise */}
          <div className="mt-6 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-white">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-xl text-gray-900 mb-2">{t('enterpriseTitle')}</h3>
            <p className="text-gray-500 max-w-xl mx-auto mb-5 text-sm">{t('enterpriseDesc')}</p>
            <a href="#contact" className="inline-flex items-center gap-2 border-2 border-gray-900 text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-gray-900 hover:text-white transition-all text-sm">
              {t('enterpriseCta')} <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TESTIMONIALS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {testimonials.length > 0 && <section className="py-24" style={{ background: 'var(--cs)' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block bg-amber-100 text-amber-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">{t('testimonialLabel')}</span>
            <h2 className="text-4xl font-extrabold" style={{ color: 'var(--ct)' }}>{t('testimonialTitle')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((tm, i) => (
              <div key={i} className={`rounded-2xl p-6 border ${isRtl ? 'text-right' : ''}`} style={{ background: 'var(--cb)', borderColor: 'var(--cbr)' }}>
                <div className={`flex gap-1 mb-4 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                  {Array.from({ length: tm.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5">"{tl(tm.text, lang)}"</p>
                <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {tm.avatarUrl
                    ? <img src={tm.avatarUrl} alt={tm.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    : <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white" style={{ background: 'var(--cp)' }}>{tm.name[0]}</div>
                  }
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{tm.name}</p>
                    <p className="text-gray-400 text-xs">{tl(tm.role, lang)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* EMAIL CTA */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 relative overflow-hidden" style={{ background: HERO_GRADIENT[theme] }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative max-w-2xl mx-auto px-4 text-center">

          <div className="inline-flex items-center gap-2 border px-5 py-2 rounded-full text-sm mb-8" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>
            <Mail className="w-4 h-4" />
            {lang === 'ar' ? 'شغّل نظام مطعمك — بدون بطاقة بنكية'
              : lang === 'fr' ? 'Lancez votre OS restaurant — sans carte bancaire'
              : 'Launch your restaurant OS — no credit card required'}
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            {t('finalTitle')}<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>
              {lang === 'ar' ? 'ابدأ بإيميلك فقط' : lang === 'fr' ? 'Démarrez avec votre Email' : 'Start With Your Email'}
            </span>
          </h2>

          <p className="text-white/70 mb-10 text-lg">
            {lang === 'ar' ? 'أدخل إيميلك وشغّل نظام مطعمك فوراً — طلبات، مطبخ، موظفين، تسويق وحسابات في مكان واحد.'
              : lang === 'fr' ? "Entrez votre email et lancez votre OS restaurant instantanément — commandes, cuisine, staff, marketing et finances au même endroit."
              : 'Enter your email and launch your full restaurant OS instantly — orders, kitchen, staff, marketing and finances in one place.'}
          </p>

          <form onSubmit={handleEmailCta} className="max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Mail className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={lang === 'ar' ? 'your@email.com' : lang === 'fr' ? 'votre@email.com' : 'your@email.com'}
                  required
                  dir="ltr"
                  className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-4 rounded-2xl text-gray-900 text-base focus:outline-none bg-white`}
                />
              </div>
              <button type="submit" disabled={ctaLoading}
                className="flex items-center justify-center gap-2 disabled:bg-gray-600 text-white font-bold px-6 py-4 rounded-2xl transition-all shadow-xl whitespace-nowrap" style={{ background: 'var(--cp)' }}>
                {ctaLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                {ctaLoading ? '...'
                  : lang === 'ar' ? 'ابدأ مجاناً'
                  : lang === 'fr' ? 'Commencer'
                  : 'Get Started'}
              </button>
            </div>
            {ctaError && <p className="mt-3 text-red-400 text-sm">{ctaError}</p>}
            <p className="mt-4 text-white/50 text-xs">{t('finalNote')}</p>
          </form>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FAQ */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24" style={{ background: 'var(--cs)' }}>
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1 rounded-full text-sm font-semibold mb-4" style={{ background: 'var(--cbr)', color: 'var(--ctm)' }}>{t('faqLabel')}</span>
            <h2 className="text-4xl font-extrabold" style={{ color: 'var(--ct)' }}>{t('faqTitle')}</h2>
          </div>
          <div className="space-y-3">
            {(cfg.faqs && cfg.faqs.length > 0 ? cfg.faqs : FAQS).map((faq, i) => {
              const d = tl(faq, lang)
              return (
                <div key={i} className="border rounded-2xl overflow-hidden transition-all" style={{ borderColor: openFaq === i ? 'var(--ca)' : 'var(--cbr)' }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className={`w-full flex items-center justify-between px-6 py-4 gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span className={`font-semibold text-sm flex-1 ${isRtl ? 'text-right' : 'text-left'}`} style={{ color: 'var(--ct)' }}>{d.q}</span>
                    {openFaq === i ? <ChevronUp className="w-5 h-5 shrink-0" style={{ color: 'var(--ca)' }} /> : <ChevronDown className="w-5 h-5 shrink-0" style={{ color: 'var(--ctm)' }} />}
                  </button>
                  {openFaq === i && (
                    <div className={`px-6 pb-4 text-sm leading-relaxed border-t pt-3 ${isRtl ? 'text-right' : ''}`} style={{ color: 'var(--ctm)', borderColor: 'var(--cbr)' }}>
                      {d.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CONTACT */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="contact" className="py-24" style={{ background: 'var(--cs)' }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block border px-4 py-1 rounded-full text-sm font-semibold mb-4" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>{t('contactLabel')}</span>
            <h2 className="text-4xl font-extrabold" style={{ color: 'var(--ct)' }}>{t('contactTitle')}</h2>
            <p className="mt-3" style={{ color: 'var(--ctm)' }}>{t('contactSub')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: MessageCircle, label: 'WhatsApp', value: contactPhone, sub: lang === 'ar' ? 'رد خلال دقائق' : lang === 'fr' ? 'Réponse en minutes' : 'Response in minutes', color: 'text-green-600', bg: 'bg-green-50' },
              { icon: Mail, label: lang === 'ar' ? 'البريد الإلكتروني' : 'Email', value: contactEmail, sub: lang === 'ar' ? 'رد خلال ساعة' : lang === 'fr' ? 'Réponse en 1h' : 'Reply within 1 hour', color: 'text-blue-600', bg: 'bg-blue-50' },
              { icon: MapPin, label: lang === 'ar' ? 'العنوان' : lang === 'fr' ? 'Adresse' : 'Address', value: lang === 'ar' ? 'حي محمدي 231، الدار البيضاء' : lang === 'fr' ? 'Hay Mohamedi 231, Casablanca' : 'Hay Mohamedi 231, Casablanca', sub: 'Casablanca, Morocco 🇲🇦', color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((c, i) => {
              const Icon = c.icon
              return (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                  <div className={`w-13 h-13 ${c.bg} rounded-2xl flex items-center justify-center mx-auto mb-4 w-14 h-14`}>
                    <Icon className={`w-6 h-6 ${c.color}`} />
                  </div>
                  <p className="font-bold text-gray-900 mb-1 text-sm">{c.label}</p>
                  <p className={`font-semibold text-sm ${c.color} mb-1`}>{c.value}</p>
                  <p className="text-gray-400 text-xs">{c.sub}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FINAL CTA */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 relative overflow-hidden" style={{ background: `linear-gradient(135deg, var(--cp), var(--cp-h))` }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">{t('finalTitle')}</h2>
          <p className="text-white/80 text-xl mb-10">{t('finalSub')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="bg-white hover:bg-gray-50 font-extrabold px-10 py-4 rounded-2xl text-base transition-all shadow-xl" style={{ color: 'var(--cp)' }}>{t('finalCta1')}</Link>
            <a href="#contact" className="border-2 border-white/50 hover:border-white text-white font-bold px-10 py-4 rounded-2xl text-base transition-all">{t('finalCta2')}</a>
          </div>
          <p className="mt-6 text-white/60 text-sm">{t('finalNote')}</p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-gray-950 text-gray-400 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-10 mb-12 ${isRtl ? 'text-right' : ''}`}>
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className={`flex items-center gap-2 mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <Image src={logoImageUrl} alt={footerBrand} width={36} height={36} className="rounded-xl object-contain" unoptimized />
                <span className="text-white font-extrabold text-lg">{footerBrand}</span>
              </div>
              <p className="text-sm leading-relaxed mb-4">{t('madeWith')}</p>
              <div className={`flex gap-2 flex-wrap ${isRtl ? 'justify-end' : ''}`}>
                {footerFlags.map(f => <span key={f} className="text-lg">{f}</span>)}
              </div>
              {/* Compliance badges */}
              <div className={`flex gap-2 mt-4 flex-wrap ${isRtl ? 'justify-end' : ''}`}>
                {['SSL', 'GDPR', 'PCI DSS'].map(b => (
                  <span key={b} className="text-[10px] font-bold border border-gray-700 text-gray-500 px-2 py-0.5 rounded flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" /> {b}
                  </span>
                ))}
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">{t('featLabel')}</h4>
              <ul className="space-y-2 text-sm">
                {(lang === 'ar'
                  ? ['الوحدات', 'الأسعار', 'لوحة التحكم', 'شاشة المطبخ KDS', 'تحليلات الإيرادات']
                  : lang === 'fr'
                  ? ['Modules', 'Tarifs', 'Dashboard', 'Écran Cuisine', 'Analytics IA']
                  : ['Modules', 'Pricing', 'Dashboard', 'Kitchen Screen', 'AI Analytics']
                ).map(l => <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>)}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">{lang === 'ar' ? 'الشركة' : lang === 'fr' ? 'Société' : 'Company'}</h4>
              <ul className="space-y-2 text-sm">
                {(lang === 'ar'
                  ? ['من نحن', 'تواصل معنا', 'الدعم الفني', t('privacy'), t('terms'), t('legal')]
                  : lang === 'fr'
                  ? ['À propos', 'Contact', 'Support', t('privacy'), t('terms'), t('legal')]
                  : ['About Us', 'Contact', 'Support', t('privacy'), t('terms'), t('legal')]
                ).map(l => <li key={l}><a href={l === t('privacy') ? '/privacy' : l === t('terms') ? '/terms' : l === t('legal') ? '/legal' : '#'} className="hover:text-white transition-colors">{l}</a></li>)}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">{t('contactLabel')}</h4>
              <ul className="space-y-3 text-sm">
                <li className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}><Phone className="w-4 h-4 shrink-0" style={{ color: 'var(--ca)' }} /> {footerPhone}</li>
                <li className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}><Mail className="w-4 h-4 shrink-0" style={{ color: 'var(--ca)' }} /> {footerEmail}</li>
                <li className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}><MessageCircle className="w-4 h-4 text-green-500 shrink-0" /> WhatsApp</li>
                <li className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}><Globe2 className="w-4 h-4 text-blue-500 shrink-0" /> AR · FR · EN</li>
              </ul>
            </div>
          </div>

          <div className={`border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
            <span>{footerCopy} — {t('allRights')}</span>
            <div className="flex items-center gap-4 text-gray-600">
              <a href="/privacy" className="hover:text-gray-400 transition-colors">{t('privacy')}</a>
              <span>·</span>
              <a href="/terms" className="hover:text-gray-400 transition-colors">{t('terms')}</a>
              <span>·</span>
              <a href="/legal" className="hover:text-gray-400 transition-colors">{t('legal')}</a>
            </div>
          </div>
        </div>
      </footer>

    </main>
  )
}
