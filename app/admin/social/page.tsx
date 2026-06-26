'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Share2, Loader2, RefreshCw, ExternalLink, CheckCircle2,
  Clock, Inbox, Link2, BarChart3, XCircle, X, Play,
  Star, Image, Video, Search,
  SlidersHorizontal, ThumbsUp, ThumbsDown, AlertTriangle,
  Save, CheckCircle, Upload, Info, ToggleLeft, ToggleRight,
  TrendingUp, Users, Zap, Globe,
} from 'lucide-react'
import { useLang } from '../lang-context'

function IgIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function FbIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'published' | 'scheduled' | 'queue' | 'accounts' | 'analytics'

type Campaign = {
  id:           string
  productName:  string
  productPrice: number
  imageUrl:     string | null
  country:      string
  caption:      string | null
  videoUrl:     string | null
  hasWatermark: boolean
  status:       'pending' | 'rendering' | 'published' | 'failed'
  platforms:    string[]
  socialLinks:  Record<string, string> | null
  createdAt:    string
}

type Review = {
  id:                          string
  imageUrl:                    string | null
  qrCodeUrl:                   string | null
  reviewText:                  string
  rating:                      number
  userConsentGranted:          boolean
  isPublishedToClientSocial:   boolean
  publishedToClientSocialAt:   string | null
  isPublishedToSmartRestoBlog: boolean
  moderationStatus:            'pending' | 'approved' | 'rejected'
  moderatedAt:                 string | null
  createdAt:                   string
  reservation:                 { name: string; phone: string } | null
}

type CafeProfile = {
  logoUrl:            string | null
  hasSocialShareAddon: boolean
  socialLinks:        { instagram?: string; snapchat?: string; facebook?: string } | null
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title:          'إدارة الشبكات الاجتماعية',
    subtitle:       'نشر المحتوى · الجدولة · التحليلات',
    tabPublished:   'المنشور',
    tabScheduled:   'المجدول',
    tabQueue:       'قيد المراجعة',
    tabAccounts:    'الحسابات',
    tabAnalytics:   'الإحصاءات',
    published:      'منشور',
    scheduled:      'مجدول',
    rendering:      'جارٍ المعالجة',
    pending:        'في الانتظار',
    failed:         'فشل',
    approved:       'معتمد',
    rejected:       'مرفوض',
    approve:        'اعتماد',
    reject:         'رفض',
    searchPlh:      'بحث…',
    filterAll:      'الكل',
    filterVideos:   'فيديو',
    filterReviews:  'تقييمات',
    noContent:      'لا يوجد محتوى',
    noContentSub:   'لم يتم نشر أي محتوى بعد',
    noQueue:        'لا توجد عناصر للمراجعة',
    noQueueSub:     'ستظهر التقييمات الجديدة هنا',
    noScheduled:    'لا يوجد محتوى مجدول',
    noScheduledSub: 'قم بإنشاء فيديو ترويجي لبدء الجدولة',
    noResults:      'لا توجد نتائج',
    noResultsSub:   'جرب تغيير البحث أو الفلتر',
    watchVideo:     'مشاهدة',
    viewPost:       'عرض المنشور',
    video:          'فيديو ترويجي',
    review:         'تقييم',
    rating:         'التقييم',
    customer:       'الزبون',
    platforms:      'المنصات',
    createdAt:      'تاريخ الإنشاء',
    publishedAt:    'تاريخ النشر',
    status:         'الحالة',
    close:          'إغلاق',
    socialHandles:  'حسابات التواصل الاجتماعي',
    instagram:      'انستقرام',
    snapchat:       'سناب شات',
    facebook:       'فيسبوك',
    logoTitle:      'شعار المطعم',
    logoSub:        'يُعرض في الـ Navbar · POS · منيو الزبائن · وكعلامة مائية',
    uploadLogo:     'رفع الشعار',
    logoUrlLabel:   'أو رابط مباشر',
    viralTitle:     'الدفع مقابل الانتشار الذكي',
    viralSub:       'تُحمَّل رسوم رمزية فقط عند كل إجراء اجتماعي يُنشئه الزبناء (مشاركة · متابعة · منشور).',
    viralPrice:     '0.50 درهم / إجراء (المغرب) · 1.00 ريال (الخليج)',
    viralOn:        'مفعّل — سيتم تحميلك عند كل إجراء اجتماعي يُكتشف تلقائياً.',
    save:           'حفظ',
    saved:          'تم الحفظ',
    saving:         'جارٍ الحفظ…',
    totalPublished: 'إجمالي المنشور',
    totalVideos:    'فيديوهات منشورة',
    totalReviews:   'تقييمات منشورة',
    pendingReviews: 'تقييمات معلقة',
    successRate:    'نسبة النجاح',
    platformBreak:  'توزيع المنصات',
    recentActivity: 'النشاط الأخير',
    dimRecComm:     'أبعاد الشعار الموصى بها',
    dim512:         '• الحجم الأمثل: 512 × 512 px (مربع)',
    dimPng:         '• الصيغة المفضلة: PNG بخلفية شفافة',
    dim2mb:         '• الحد الأقصى: 2 MB',
    dimAuto:        '• يتم تغيير الحجم تلقائياً دون تشويه',
    preview:        'معاينة',
    logoOrUrl:      'أو رابط مباشر للشعار',
    watermark:      'علامة مائية',
    consent:        'موافقة GDPR',
    stuckLabel:     (m: number) => `متأخر ${m} د`,
  },
  fr: {
    title:          'Gestion des réseaux sociaux',
    subtitle:       'Publication · Planification · Analytique',
    tabPublished:   'Publié',
    tabScheduled:   'Planifié',
    tabQueue:       'File d\'attente',
    tabAccounts:    'Comptes',
    tabAnalytics:   'Analytique',
    published:      'Publié',
    scheduled:      'Planifié',
    rendering:      'En cours',
    pending:        'En attente',
    failed:         'Échoué',
    approved:       'Approuvé',
    rejected:       'Rejeté',
    approve:        'Approuver',
    reject:         'Rejeter',
    searchPlh:      'Rechercher…',
    filterAll:      'Tout',
    filterVideos:   'Vidéos',
    filterReviews:  'Avis',
    noContent:      'Aucun contenu',
    noContentSub:   'Aucun contenu publié pour l\'instant',
    noQueue:        'File vide',
    noQueueSub:     'Les nouveaux avis apparaîtront ici',
    noScheduled:    'Rien de planifié',
    noScheduledSub: 'Générez une vidéo promo pour commencer',
    noResults:      'Aucun résultat',
    noResultsSub:   'Modifiez la recherche ou le filtre',
    watchVideo:     'Voir',
    viewPost:       'Voir le post',
    video:          'Vidéo promo',
    review:         'Avis',
    rating:         'Note',
    customer:       'Client',
    platforms:      'Plateformes',
    createdAt:      'Créé le',
    publishedAt:    'Publié le',
    status:         'Statut',
    close:          'Fermer',
    socialHandles:  'Comptes sociaux',
    instagram:      'Instagram',
    snapchat:       'Snapchat',
    facebook:       'Facebook',
    logoTitle:      'Logo du restaurant',
    logoSub:        'Affiché dans Navbar · POS · Menu client · filigrane',
    uploadLogo:     'Télécharger le logo',
    logoUrlLabel:   'Ou URL directe',
    viralTitle:     'Pay-per-viral-action',
    viralSub:       'Vous n\'êtes facturé que lorsque des clients créent des actions sociales (partage · abonnement · post).',
    viralPrice:     '0.50 DH / action (Maroc) · 1.00 SAR (Golfe)',
    viralOn:        'Activé — vous serez facturé à chaque action sociale détectée automatiquement.',
    save:           'Enregistrer',
    saved:          'Enregistré',
    saving:         'Enregistrement…',
    totalPublished: 'Total publié',
    totalVideos:    'Vidéos publiées',
    totalReviews:   'Avis publiés',
    pendingReviews: 'Avis en attente',
    successRate:    'Taux de succès',
    platformBreak:  'Répartition par plateforme',
    recentActivity: 'Activité récente',
    dimRecComm:     'Dimensions recommandées',
    dim512:         '• Optimal : 512 × 512 px (carré)',
    dimPng:         '• Format conseillé : PNG fond transparent',
    dim2mb:         '• Taille max : 2 MB',
    dimAuto:        '• Redimensionné automatiquement',
    preview:        'Aperçu',
    logoOrUrl:      'Ou URL directe du logo',
    watermark:      'Filigrane',
    consent:        'Consentement GDPR',
    stuckLabel:     (m: number) => `Bloqué ${m} min`,
  },
  en: {
    title:          'Social Media Management',
    subtitle:       'Publishing · Scheduling · Analytics',
    tabPublished:   'Published',
    tabScheduled:   'Scheduled',
    tabQueue:       'Queue',
    tabAccounts:    'Accounts',
    tabAnalytics:   'Analytics',
    published:      'Published',
    scheduled:      'Scheduled',
    rendering:      'Rendering',
    pending:        'Pending',
    failed:         'Failed',
    approved:       'Approved',
    rejected:       'Rejected',
    approve:        'Approve',
    reject:         'Reject',
    searchPlh:      'Search…',
    filterAll:      'All',
    filterVideos:   'Videos',
    filterReviews:  'Reviews',
    noContent:      'No content',
    noContentSub:   'Nothing published yet',
    noQueue:        'Queue is empty',
    noQueueSub:     'New reviews will appear here',
    noScheduled:    'Nothing scheduled',
    noScheduledSub: 'Generate a promo video to start scheduling',
    noResults:      'No results',
    noResultsSub:   'Try a different search or filter',
    watchVideo:     'Watch',
    viewPost:       'View post',
    video:          'Promo video',
    review:         'Review',
    rating:         'Rating',
    customer:       'Customer',
    platforms:      'Platforms',
    createdAt:      'Created',
    publishedAt:    'Published',
    status:         'Status',
    close:          'Close',
    socialHandles:  'Social accounts',
    instagram:      'Instagram',
    snapchat:       'Snapchat',
    facebook:       'Facebook',
    logoTitle:      'Restaurant logo',
    logoSub:        'Used in Navbar · POS · Customer menu · watermark',
    uploadLogo:     'Upload logo',
    logoUrlLabel:   'Or direct URL',
    viralTitle:     'Pay-per-viral-action',
    viralSub:       'You are only charged when customers create social actions (share · follow · post).',
    viralPrice:     '0.50 MAD / action (Morocco) · 1.00 SAR (Gulf)',
    viralOn:        'Active — you will be charged per social action detected automatically.',
    save:           'Save',
    saved:          'Saved!',
    saving:         'Saving…',
    totalPublished: 'Total published',
    totalVideos:    'Published videos',
    totalReviews:   'Published reviews',
    pendingReviews: 'Pending reviews',
    successRate:    'Success rate',
    platformBreak:  'Platform breakdown',
    recentActivity: 'Recent activity',
    dimRecComm:     'Recommended dimensions',
    dim512:         '• Optimal: 512 × 512 px (square)',
    dimPng:         '• Preferred: PNG with transparent background',
    dim2mb:         '• Max size: 2 MB',
    dimAuto:        '• Resized automatically without distortion',
    preview:        'Preview',
    logoOrUrl:      'Or direct logo URL',
    watermark:      'Watermark',
    consent:        'GDPR consent',
    stuckLabel:     (m: number) => `Stuck ${m} min`,
  },
  es: {
    title:          'Gestión de Redes Sociales',
    subtitle:       'Publicación · Programación · Analítica',
    tabPublished:   'Publicado',
    tabScheduled:   'Programado',
    tabQueue:       'Cola',
    tabAccounts:    'Cuentas',
    tabAnalytics:   'Analítica',
    published:      'Publicado',
    scheduled:      'Programado',
    rendering:      'Procesando',
    pending:        'Pendiente',
    failed:         'Fallido',
    approved:       'Aprobado',
    rejected:       'Rechazado',
    approve:        'Aprobar',
    reject:         'Rechazar',
    searchPlh:      'Buscar…',
    filterAll:      'Todo',
    filterVideos:   'Videos',
    filterReviews:  'Reseñas',
    noContent:      'Sin contenido',
    noContentSub:   'Nada publicado todavía',
    noQueue:        'Cola vacía',
    noQueueSub:     'Las nuevas reseñas aparecerán aquí',
    noScheduled:    'Nada programado',
    noScheduledSub: 'Genera un video promo para empezar',
    noResults:      'Sin resultados',
    noResultsSub:   'Prueba otro filtro o búsqueda',
    watchVideo:     'Ver',
    viewPost:       'Ver publicación',
    video:          'Video promo',
    review:         'Reseña',
    rating:         'Calificación',
    customer:       'Cliente',
    platforms:      'Plataformas',
    createdAt:      'Creado',
    publishedAt:    'Publicado',
    status:         'Estado',
    close:          'Cerrar',
    socialHandles:  'Cuentas sociales',
    instagram:      'Instagram',
    snapchat:       'Snapchat',
    facebook:       'Facebook',
    logoTitle:      'Logo del restaurante',
    logoSub:        'Mostrado en Navbar · POS · Menú cliente · marca de agua',
    uploadLogo:     'Subir logo',
    logoUrlLabel:   'O URL directa',
    viralTitle:     'Pago por acción viral',
    viralSub:       'Solo se te cobra cuando los clientes crean acciones sociales (compartir · seguir · publicar).',
    viralPrice:     '0.50 DH / acción (Marruecos) · 1.00 SAR (Golfo)',
    viralOn:        'Activo — se te cobrará por cada acción social detectada automáticamente.',
    save:           'Guardar',
    saved:          '¡Guardado!',
    saving:         'Guardando…',
    totalPublished: 'Total publicado',
    totalVideos:    'Videos publicados',
    totalReviews:   'Reseñas publicadas',
    pendingReviews: 'Reseñas pendientes',
    successRate:    'Tasa de éxito',
    platformBreak:  'Desglose por plataforma',
    recentActivity: 'Actividad reciente',
    dimRecComm:     'Dimensiones recomendadas',
    dim512:         '• Óptimo: 512 × 512 px (cuadrado)',
    dimPng:         '• Preferido: PNG con fondo transparente',
    dim2mb:         '• Tamaño máximo: 2 MB',
    dimAuto:        '• Redimensionado automáticamente',
    preview:        'Vista previa',
    logoOrUrl:      'O URL directa del logo',
    watermark:      'Marca de agua',
    consent:        'Consentimiento GDPR',
    stuckLabel:     (m: number) => `Atascado ${m} min`,
  },
} as const

type Lang = keyof typeof T
type Strings = typeof T[Lang]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

function platformIcon(p: string, size = 12) {
  if (p === 'instagram') return <IgIcon size={size} className="text-pink-400" />
  if (p === 'facebook')  return <FbIcon size={size} className="text-blue-400" />
  if (p === 'snapchat')  return <span className="text-yellow-400 font-bold leading-none" style={{ fontSize: size }}>👻</span>
  if (p === 'tiktok')    return <span className="text-white font-bold leading-none"      style={{ fontSize: size }}>♪</span>
  return <Globe size={size} className="text-slate-400" />
}

function fmtDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(
    lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB',
    { day: '2-digit', month: 'short', year: 'numeric' },
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={10} className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />
      ))}
    </span>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon: Icon }: {
  label: string; value: string | number; color: string; icon: React.ElementType
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl px-4 py-3 flex-1 min-w-[120px]">
      <div className="flex items-center justify-between mb-1">
        <Icon size={14} className={color} />
      </div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-slate-500 text-xs mt-0.5 font-medium truncate">{label}</p>
    </div>
  )
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({ c, t, isRTL, onClick }: {
  c: Campaign; t: Strings; isRTL: boolean; onClick: () => void
}) {
  const isLive  = c.status === 'pending' || c.status === 'rendering'
  const ageMin  = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 60_000)
  const isStuck = isLive && ageMin > 10

  return (
    <div
      onClick={onClick}
      className={`group rounded-2xl overflow-hidden border bg-slate-900 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5 ${
        isStuck ? 'border-rose-500/40' : 'border-slate-700/60 hover:border-sky-500/40'
      }`}
    >
      <div className="relative w-full aspect-video bg-slate-800">
        {c.imageUrl
          ? <img src={c.imageUrl} alt={c.productName} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Video className="text-slate-700" size={28} /></div>
        }
        <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold backdrop-blur-sm bg-slate-800/80 text-slate-300`}>
          <Video size={10} /> {t.video}
        </div>
        {c.hasWatermark && (
          <div className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'} px-1.5 py-0.5 rounded-lg text-[10px] bg-amber-500/80 text-amber-100 backdrop-blur-sm`}>
            {t.watermark}
          </div>
        )}
        {c.videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Play className="text-white" size={16} fill="white" />
            </div>
          </div>
        )}
        {isLive && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
            <div className={`h-full bg-sky-500 animate-pulse`} style={{ width: c.status === 'rendering' ? '65%' : '20%' }} />
          </div>
        )}
        {isStuck && (
          <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-rose-500/80 text-rose-100 text-xs text-center backdrop-blur-sm">
            {t.stuckLabel(ageMin)}
          </div>
        )}
      </div>

      <div className="p-3 space-y-1.5">
        <p className="font-semibold text-white text-sm line-clamp-1">{c.productName}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {c.platforms.map(p => (
            <span key={p} className="flex items-center gap-1 text-xs text-slate-500 capitalize">
              {platformIcon(p, 11)} {p}
            </span>
          ))}
        </div>
        <p className="text-xs text-slate-600">{fmtDate(c.createdAt, 'en')}</p>
        {c.socialLinks && Object.keys(c.socialLinks).length > 0 && (
          <div className="flex gap-2 pt-0.5" onClick={e => e.stopPropagation()}>
            {Object.entries(c.socialLinks).slice(0, 3).map(([platform, url]) => (
              <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors capitalize">
                <ExternalLink size={9} /> {platform}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Review Card ──────────────────────────────────────────────────────────────

function ReviewCard({ r, t, isRTL, onApprove, onReject, approving, rejecting, onClick }: {
  r: Review; t: Strings; isRTL: boolean; onClick: () => void
  onApprove?: () => void; onReject?: () => void
  approving?: boolean; rejecting?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className="group rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-sky-500/40"
    >
      <div className="relative w-full aspect-video bg-slate-800">
        {r.imageUrl
          ? <img src={r.imageUrl} alt="review" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Image className="text-slate-700" size={28} /></div>
        }
        <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold backdrop-blur-sm bg-slate-800/80 text-slate-300`}>
          <Star size={10} className="text-amber-400 fill-amber-400" /> {t.review}
        </div>
        {!r.userConsentGranted && (
          <div className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'} px-1.5 py-0.5 rounded-lg text-[10px] bg-violet-500/80 text-violet-100 backdrop-blur-sm`}>
            {t.consent}
          </div>
        )}
      </div>

      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Stars rating={r.rating} />
          {r.reservation && (
            <span className="text-xs text-slate-500 truncate">{r.reservation.name}</span>
          )}
        </div>
        {r.reviewText && (
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{r.reviewText}</p>
        )}
        <p className="text-xs text-slate-600">{fmtDate(r.createdAt, 'en')}</p>

        {/* Moderation actions */}
        {(onApprove || onReject) && (
          <div className="flex gap-2 pt-1 border-t border-slate-800" onClick={e => e.stopPropagation()}>
            {onApprove && (
              <button
                onClick={onApprove}
                disabled={approving}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium transition-colors disabled:opacity-40"
              >
                {approving ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
                {t.approve}
              </button>
            )}
            {onReject && (
              <button
                onClick={onReject}
                disabled={rejecting}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 text-xs font-medium transition-colors disabled:opacity-40"
              >
                {rejecting ? <Loader2 size={12} className="animate-spin" /> : <ThumbsDown size={12} />}
                {t.reject}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ item, type, t, lang, isRTL, onClose, onApprove, onReject, moderating }: {
  item:       Campaign | Review
  type:       'campaign' | 'review'
  t:          Strings
  lang:       string
  isRTL:      boolean
  onClose:    () => void
  onApprove?: () => void
  onReject?:  () => void
  moderating: boolean
}) {
  const isCampaign = type === 'campaign'
  const c = isCampaign ? item as Campaign : null
  const r = !isCampaign ? item as Review : null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {isCampaign ? <Video size={15} className="text-sky-400" /> : <Star size={15} className="text-amber-400" />}
            <h3 className="text-white font-bold text-sm">{isCampaign ? t.video : t.review}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Media */}
        <div className="relative w-full aspect-video bg-slate-800">
          {(c?.imageUrl || r?.imageUrl) ? (
            <img src={c?.imageUrl ?? r?.imageUrl ?? ''} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isCampaign ? <Video className="text-slate-700" size={40} /> : <Image className="text-slate-700" size={40} />}
            </div>
          )}
          {c?.videoUrl && (
            <a href={c.videoUrl} target="_blank" rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center bg-black/50 hover:bg-black/40 transition-colors">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <Play className="text-white" size={24} fill="white" />
              </div>
            </a>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[40vh] overflow-y-auto">
          {isCampaign && c && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500 text-xs font-medium mb-1">{t.video}</p>
                  <p className="text-white font-semibold text-sm">{c.productName}</p>
                  <p className="text-slate-400 text-xs font-mono">{c.productPrice.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-medium mb-1">{t.platforms}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {c.platforms.map(p => (
                      <span key={p} className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg capitalize">
                        {platformIcon(p, 11)} {p}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-medium mb-1">{t.createdAt}</p>
                  <p className="text-slate-300 text-xs">{fmtDate(c.createdAt, lang)}</p>
                </div>
              </div>
              {c.caption && (
                <div>
                  <p className="text-slate-500 text-xs font-medium mb-1.5">Caption</p>
                  <p className="text-slate-300 text-sm leading-relaxed bg-slate-800/60 rounded-xl px-3 py-2.5">{c.caption}</p>
                </div>
              )}
              {c.socialLinks && Object.keys(c.socialLinks).length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs font-medium mb-1.5">{t.viewPost}</p>
                  <div className="space-y-1.5">
                    {Object.entries(c.socialLinks).map(([platform, url]) => (
                      <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between bg-slate-800/60 rounded-xl px-3 py-2 hover:bg-slate-800 transition-colors group">
                        <span className="text-slate-300 text-xs capitalize font-medium flex items-center gap-2">
                          {platformIcon(platform, 12)} {platform}
                        </span>
                        <ExternalLink size={12} className="text-slate-600 group-hover:text-sky-400 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!isCampaign && r && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500 text-xs font-medium mb-1">{t.rating}</p>
                  <div className="flex items-center gap-1.5">
                    <Stars rating={r.rating} />
                    <span className="text-white font-bold text-sm">{r.rating}/5</span>
                  </div>
                </div>
                {r.reservation && (
                  <div>
                    <p className="text-slate-500 text-xs font-medium mb-1">{t.customer}</p>
                    <p className="text-white text-sm font-medium">{r.reservation.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500 text-xs font-medium mb-1">{t.status}</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${
                    r.moderationStatus === 'approved' ? 'bg-emerald-500/15 text-emerald-400'
                    : r.moderationStatus === 'rejected' ? 'bg-rose-500/15 text-rose-400'
                    : 'bg-slate-700/60 text-slate-300'
                  }`}>
                    {r.moderationStatus === 'approved' ? t.approved
                     : r.moderationStatus === 'rejected' ? t.rejected
                     : t.pending}
                  </span>
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-medium mb-1">{t.createdAt}</p>
                  <p className="text-slate-300 text-xs">{fmtDate(r.createdAt, lang)}</p>
                </div>
              </div>
              {r.reviewText && (
                <div>
                  <p className="text-slate-500 text-xs font-medium mb-1.5">{t.review}</p>
                  <p className="text-slate-300 text-sm leading-relaxed bg-slate-800/60 rounded-xl px-3 py-2.5">{r.reviewText}</p>
                </div>
              )}
              {r.isPublishedToClientSocial && r.publishedToClientSocialAt && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <p className="text-emerald-300 text-xs">{t.publishedAt}: {fmtDate(r.publishedToClientSocialAt, lang)}</p>
                </div>
              )}
              {!r.userConsentGranted && (
                <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2">
                  <AlertTriangle size={13} className="text-violet-400 shrink-0" />
                  <p className="text-violet-300 text-xs">{t.consent}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between gap-3">
          {!isCampaign && r && r.moderationStatus === 'pending' && onApprove && onReject ? (
            <div className="flex gap-2">
              <button onClick={onApprove} disabled={moderating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium transition-colors disabled:opacity-40">
                {moderating ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
                {t.approve}
              </button>
              <button onClick={onReject} disabled={moderating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 text-xs font-medium transition-colors disabled:opacity-40">
                {moderating ? <Loader2 size={12} className="animate-spin" /> : <ThumbsDown size={12} />}
                {t.reject}
              </button>
            </div>
          ) : <span />}
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors">
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Connected Accounts Tab ───────────────────────────────────────────────────

function AccountsTab({ t, isRTL }: { t: Strings; isRTL: boolean }) {
  const [profile,     setProfile]     = useState<CafeProfile | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [logoPreview, setLogoPreview] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/cafe/profile', { headers: authHeader() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          const sl = (d.socialLinks as CafeProfile['socialLinks']) || {}
          setProfile({ logoUrl: d.logoUrl || '', hasSocialShareAddon: d.hasSocialShareAddon || false, socialLinks: sl })
          if (d.logoUrl) setLogoPreview(d.logoUrl)
        }
        setLoading(false)
      })
  }, [])

  function setSocial(key: 'instagram' | 'snapchat' | 'facebook', value: string) {
    setProfile(p => p ? { ...p, socialLinks: { ...p.socialLinks, [key]: value } } : p)
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setLogoPreview(url)
      setProfile(p => p ? { ...p, logoUrl: url } : p)
    }
    reader.readAsDataURL(file)
  }

  async function save() {
    if (!profile) return
    setSaving(true)
    await fetch('/api/admin/cafe/profile', {
      method:  'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ logoUrl: profile.logoUrl, hasSocialShareAddon: profile.hasSocialShareAddon, socialLinks: profile.socialLinks }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-sky-500" size={32} />
    </div>
  )
  if (!profile) return null

  return (
    <div className="space-y-5 max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Social handles */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-white text-sm">{t.socialHandles}</h2>

        {([
          { key: 'instagram', label: t.instagram, icon: <IgIcon size={15} className="text-pink-400" />, prefix: '@' },
          { key: 'snapchat',  label: t.snapchat,  icon: <span className="text-yellow-400 text-sm">👻</span>,   prefix: '@' },
          { key: 'facebook',  label: t.facebook,  icon: <FbIcon size={15} className="text-blue-400" />,  prefix: 'facebook.com/' },
        ] as const).map(({ key, label, icon, prefix }) => (
          <div key={key}>
            <label className="text-xs text-slate-400 font-medium mb-1.5 flex items-center gap-1.5">{icon} {label}</label>
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden focus-within:border-sky-500/60 transition-colors">
              <span className="px-3 text-slate-500 text-xs border-r border-slate-700 py-2.5 shrink-0 select-none">{prefix}</span>
              <input
                type="text"
                value={(profile.socialLinks?.[key]) || ''}
                onChange={e => setSocial(key, e.target.value)}
                placeholder={`your_restaurant`}
                className="flex-1 px-3 py-2.5 text-sm text-white bg-transparent outline-none placeholder-slate-600"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Logo */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="font-bold text-white text-sm">{t.logoTitle}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t.logoSub}</p>
        </div>
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-20 h-20">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-20 h-20 object-contain rounded-xl border border-slate-700 bg-slate-800" />
            ) : (
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center bg-slate-800 gap-1">
                <Upload size={18} className="text-slate-600" />
                <span className="text-[10px] text-slate-600">{t.preview}</span>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 border border-slate-600 text-slate-300 hover:border-sky-500/60 hover:text-white px-4 py-2 rounded-xl text-xs font-medium transition-colors"
            >
              <Upload size={13} /> {t.uploadLogo}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoFile} />
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 space-y-0.5">
              <p className="text-xs font-semibold text-amber-400">{t.dimRecComm}</p>
              {[t.dim512, t.dimPng, t.dim2mb, t.dimAuto].map((line, i) => (
                <p key={i} className="text-xs text-amber-400/70">{line}</p>
              ))}
            </div>
            <div>
              <label className="text-xs text-slate-500">{t.logoOrUrl}</label>
              <input
                type="url"
                value={profile.logoUrl?.startsWith('data:') ? '' : (profile.logoUrl || '')}
                onChange={e => { setProfile(p => p ? { ...p, logoUrl: e.target.value } : p); setLogoPreview(e.target.value) }}
                placeholder="https://example.com/logo.png"
                className="w-full mt-1 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white bg-slate-900 outline-none focus:border-sky-500/60 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pay-per-viral toggle */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-white text-sm">{t.viralTitle}</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t.viralSub}</p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400/80">
              <Info size={11} /> {t.viralPrice}
            </div>
          </div>
          <button onClick={() => setProfile(p => p ? { ...p, hasSocialShareAddon: !p.hasSocialShareAddon } : p)} className="shrink-0">
            {profile.hasSocialShareAddon
              ? <ToggleRight size={36} className="text-sky-400" />
              : <ToggleLeft  size={36} className="text-slate-600" />}
          </button>
        </div>
        {profile.hasSocialShareAddon && (
          <div className="mt-3 bg-sky-500/10 border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-sky-300 flex items-center gap-2">
            <CheckCircle size={12} className="text-sky-400 shrink-0" /> {t.viralOn}
          </div>
        )}
      </div>

      <div className={`flex ${isRTL ? 'justify-start' : 'justify-end'}`}>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle size={15} /> : <Save size={15} />}
          {saving ? t.saving : saved ? t.saved : t.save}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SocialPage() {
  const { lang, isRTL } = useLang() as { lang: Lang; isRTL: boolean }
  const t = T[lang] ?? T.fr

  const [tab,          setTab]          = useState<Tab>('published')
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([])
  const [approved,     setApproved]     = useState<Review[]>([])
  const [pending,      setPending]      = useState<Review[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState<'all' | 'videos' | 'reviews'>('all')
  const [detail,       setDetail]       = useState<{ item: Campaign | Review; type: 'campaign' | 'review' } | null>(null)
  const [moderating,   setModerating]   = useState<string | null>(null)

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [campRes, approvedRes, pendingRes] = await Promise.all([
        fetch('/api/marketing/campaigns?limit=50',                   { headers: authHeader() }),
        fetch('/api/admin/review-gallery?status=approved&limit=50',  { headers: authHeader() }),
        fetch('/api/admin/review-gallery?status=pending&limit=50',   { headers: authHeader() }),
      ])
      if (campRes.ok)     setCampaigns((await campRes.json()).items ?? [])
      if (approvedRes.ok) setApproved((await approvedRes.json()).reviews ?? [])
      if (pendingRes.ok)  setPending((await pendingRes.json()).reviews ?? [])
      if (!campRes.ok && !approvedRes.ok) setError('Failed to load')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Moderation ─────────────────────────────────────────────────────────────
  async function moderate(id: string, action: 'approve' | 'reject') {
    setModerating(id)
    try {
      const res = await fetch(`/api/admin/review-gallery/${id}/moderate`, {
        method:  'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action }),
      })
      if (!res.ok) return
      // Move from pending to approved or remove
      const review = pending.find(r => r.id === id)
      if (review) {
        setPending(prev => prev.filter(r => r.id !== id))
        if (action === 'approve') {
          setApproved(prev => [{ ...review, moderationStatus: 'approved' }, ...prev])
        }
      }
      if (detail?.item.id === id) setDetail(null)
    } finally {
      setModerating(null)
    }
  }

  // ── Tab data ───────────────────────────────────────────────────────────────
  const publishedCampaigns = useMemo(() => campaigns.filter(c => c.status === 'published'), [campaigns])
  const scheduledCampaigns = useMemo(() => campaigns.filter(c => c.status === 'pending'),   [campaigns])
  const renderingCampaigns = useMemo(() => campaigns.filter(c => c.status === 'rendering'), [campaigns])

  const publishedReviews  = useMemo(() => approved.filter(r => r.isPublishedToClientSocial),  [approved])
  const scheduledReviews  = useMemo(() => approved.filter(r => !r.isPublishedToClientSocial), [approved])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalPub  = publishedCampaigns.length + publishedReviews.length
    const totalVids = publishedCampaigns.length
    const totalRevs = publishedReviews.length
    const pendCount = pending.length
    const totalCamp = campaigns.length
    const rate = totalCamp > 0 ? Math.round((publishedCampaigns.length / totalCamp) * 100) : 0

    // Platform breakdown from published campaigns
    const platformMap: Record<string, number> = {}
    publishedCampaigns.forEach(c => c.platforms.forEach(p => { platformMap[p] = (platformMap[p] ?? 0) + 1 }))

    return { totalPub, totalVids, totalRevs, pendCount, rate, platformMap }
  }, [publishedCampaigns, publishedReviews, pending, campaigns])

  // ── Search + filter for content tabs ──────────────────────────────────────
  function filterItems(camps: Campaign[], revs: Review[]) {
    const q = search.toLowerCase()
    const filteredC = camps.filter(c => {
      if (typeFilter === 'reviews') return false
      return !q || c.productName.toLowerCase().includes(q)
    })
    const filteredR = revs.filter(r => {
      if (typeFilter === 'videos') return false
      return !q || r.reviewText.toLowerCase().includes(q) || (r.reservation?.name.toLowerCase().includes(q) ?? false)
    })
    return { filteredC, filteredR }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-sky-500" size={36} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <XCircle className="text-rose-400" size={40} />
        <p className="text-slate-300 font-medium">{error}</p>
        <button onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition-colors">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  // Determine grid content for current tab
  const isContentTab = tab === 'published' || tab === 'scheduled' || tab === 'queue'
  const currCamps = tab === 'published' ? publishedCampaigns : tab === 'scheduled' ? scheduledCampaigns : renderingCampaigns
  const currRevs  = tab === 'published' ? publishedReviews   : tab === 'scheduled' ? scheduledReviews   : pending
  const { filteredC, filteredR } = filterItems(currCamps, tab === 'queue' ? pending : currRevs)
  const totalFiltered = filteredC.length + filteredR.length

  const TABS: { key: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'published', label: t.tabPublished,  icon: CheckCircle2,  badge: publishedCampaigns.length + publishedReviews.length },
    { key: 'scheduled', label: t.tabScheduled,  icon: Clock,         badge: scheduledCampaigns.length + scheduledReviews.length },
    { key: 'queue',     label: t.tabQueue,       icon: Inbox,         badge: renderingCampaigns.length + pending.length },
    { key: 'accounts',  label: t.tabAccounts,    icon: Link2 },
    { key: 'analytics', label: t.tabAnalytics,   icon: BarChart3 },
  ]

  return (
    <div
      className={`max-w-5xl mx-auto px-4 py-8 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
            <Share2 className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">{t.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{t.subtitle}</p>
          </div>
        </div>
        <button onClick={loadData}
          className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Stats row (always visible) ── */}
      <div className="flex gap-3 flex-wrap">
        <StatCard label={t.totalPublished} value={stats.totalPub}  color="text-sky-400"     icon={TrendingUp} />
        <StatCard label={t.totalVideos}    value={stats.totalVids} color="text-fuchsia-400" icon={Video}      />
        <StatCard label={t.totalReviews}   value={stats.totalRevs} color="text-amber-400"   icon={Star}       />
        <StatCard label={t.pendingReviews} value={stats.pendCount} color="text-rose-400"    icon={Inbox}      />
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-1 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-1 flex-wrap">
        {TABS.map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              tab === key
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
            {badge !== undefined && badge > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                tab === key ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'
              }`}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content Tabs ── */}
      {isContentTab && (
        <>
          {/* Search + filter */}
          {(currCamps.length + (tab === 'queue' ? pending : currRevs).length) > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search size={13} className={`absolute top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none ${isRTL ? 'right-3' : 'left-3'}`} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t.searchPlh}
                  className={`w-full bg-slate-800 border border-slate-700 rounded-xl py-2 text-sm text-white placeholder-slate-500
                    focus:outline-none focus:border-sky-500/60 transition-colors ${isRTL ? 'pr-8 pl-8' : 'pl-8 pr-8'}`}
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-500 hover:text-white ${isRTL ? 'left-2' : 'right-2'}`}>
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="relative">
                <SlidersHorizontal size={13} className={`absolute top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none ${isRTL ? 'right-3' : 'left-3'}`} />
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
                  className={`bg-slate-800 border border-slate-700 rounded-xl py-2 text-sm text-white focus:outline-none focus:border-sky-500/60 transition-colors appearance-none ${isRTL ? 'pr-8 pl-4' : 'pl-8 pr-4'}`}
                >
                  <option value="all">{t.filterAll}</option>
                  <option value="videos">{t.filterVideos}</option>
                  <option value="reviews">{t.filterReviews}</option>
                </select>
              </div>

              <span className="text-xs text-slate-500 ml-auto flex items-center gap-1">
                <BarChart3 size={12} /> {totalFiltered}
              </span>
            </div>
          )}

          {/* Grid */}
          {totalFiltered === 0 && (search || typeFilter !== 'all') ? (
            <div className="rounded-3xl border border-slate-700/60 bg-slate-800/30 p-12 text-center">
              <Search className="text-slate-600 mx-auto mb-3" size={24} />
              <p className="text-slate-300 font-medium">{t.noResults}</p>
              <p className="text-slate-500 text-sm mt-1">{t.noResultsSub}</p>
            </div>
          ) : currCamps.length === 0 && (tab === 'queue' ? pending : currRevs).length === 0 ? (
            <div className="rounded-3xl border border-slate-700/60 bg-slate-800/30 p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
                {tab === 'queue' ? <Inbox className="text-slate-600" size={24} /> : tab === 'scheduled' ? <Clock className="text-slate-600" size={24} /> : <CheckCircle2 className="text-slate-600" size={24} />}
              </div>
              <p className="text-slate-300 font-medium">{tab === 'queue' ? t.noQueue : tab === 'scheduled' ? t.noScheduled : t.noContent}</p>
              <p className="text-slate-500 text-sm mt-1">{tab === 'queue' ? t.noQueueSub : tab === 'scheduled' ? t.noScheduledSub : t.noContentSub}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredC.map(c => (
                <CampaignCard key={c.id} c={c} t={t} isRTL={isRTL} onClick={() => setDetail({ item: c, type: 'campaign' })} />
              ))}
              {filteredR.map(r => (
                <ReviewCard
                  key={r.id} r={r} t={t} isRTL={isRTL}
                  onClick={() => setDetail({ item: r, type: 'review' })}
                  onApprove={tab === 'queue' ? () => moderate(r.id, 'approve') : undefined}
                  onReject ={tab === 'queue' ? () => moderate(r.id, 'reject')  : undefined}
                  approving={moderating === r.id}
                  rejecting={moderating === r.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Connected Accounts ── */}
      {tab === 'accounts' && <AccountsTab t={t} isRTL={isRTL} />}

      {/* ── Analytics ── */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {/* Extended stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t.totalPublished, value: stats.totalPub,  color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
              { label: t.totalVideos,    value: stats.totalVids, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20' },
              { label: t.totalReviews,   value: stats.totalRevs, color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
              { label: t.successRate,    value: `${stats.rate}%`,color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            ].map(({ label, value, color, bg, border }) => (
              <div key={label} className={`${bg} border ${border} rounded-2xl px-4 py-4 text-center`}>
                <p className={`text-3xl font-black ${color}`}>{value}</p>
                <p className="text-slate-400 text-xs mt-1 font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Platform breakdown */}
          {Object.keys(stats.platformMap).length > 0 && (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
              <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <Users size={14} className="text-sky-400" /> {t.platformBreak}
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.platformMap).sort(([,a],[,b]) => b - a).map(([platform, count]) => {
                  const max = Math.max(...Object.values(stats.platformMap))
                  const pct = Math.round((count / max) * 100)
                  return (
                    <div key={platform} className="flex items-center gap-3">
                      <div className="w-24 flex items-center gap-1.5 text-xs text-slate-400 capitalize shrink-0">
                        {platformIcon(platform, 13)} {platform}
                      </div>
                      <div className="flex-1 h-2 bg-slate-700/60 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-6 text-right shrink-0">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent activity */}
          {(publishedCampaigns.length + publishedReviews.length) > 0 && (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
              <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <Zap size={14} className="text-sky-400" /> {t.recentActivity}
              </h3>
              <div className="space-y-2">
                {[
                  ...publishedCampaigns.slice(0, 5).map(c => ({
                    id: c.id, type: 'video' as const, label: c.productName,
                    date: c.createdAt, platforms: c.platforms,
                  })),
                  ...publishedReviews.slice(0, 5).map(r => ({
                    id: r.id, type: 'review' as const, label: r.reviewText || `${r.rating}★`,
                    date: r.publishedToClientSocialAt ?? r.createdAt, platforms: [],
                  })),
                ]
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 8)
                  .map(item => (
                    <div key={item.id} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${item.type === 'video' ? 'bg-fuchsia-500/20' : 'bg-amber-500/20'}`}>
                        {item.type === 'video'
                          ? <Video size={13} className="text-fuchsia-400" />
                          : <Star  size={13} className="text-amber-400 fill-amber-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-300 text-xs font-medium truncate">{item.label}</p>
                        {item.platforms.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {item.platforms.map((p: string) => <span key={p}>{platformIcon(p, 10)}</span>)}
                          </div>
                        )}
                      </div>
                      <span className="text-slate-600 text-xs shrink-0">{fmtDate(item.date, lang)}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {stats.totalPub === 0 && (
            <div className="rounded-3xl border border-slate-700/60 bg-slate-800/30 p-16 text-center">
              <BarChart3 className="text-slate-600 mx-auto mb-3" size={28} />
              <p className="text-slate-300 font-medium">{t.noContent}</p>
              <p className="text-slate-500 text-sm mt-1">{t.noContentSub}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <DetailModal
          item={detail.item}
          type={detail.type}
          t={t}
          lang={lang}
          isRTL={isRTL}
          onClose={() => setDetail(null)}
          onApprove={detail.type === 'review' && (detail.item as Review).moderationStatus === 'pending'
            ? () => moderate(detail.item.id, 'approve') : undefined}
          onReject={detail.type === 'review' && (detail.item as Review).moderationStatus === 'pending'
            ? () => moderate(detail.item.id, 'reject') : undefined}
          moderating={moderating === detail.item.id}
        />
      )}
    </div>
  )
}
