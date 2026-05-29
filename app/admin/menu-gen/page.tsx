'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '../lang-context'
import {
  Globe, FileUp, Camera, Sparkles, ChevronRight, ChevronLeft,
  Loader2, Check, Edit2, Trash2, Plus, X, AlertTriangle,
  Zap, CreditCard, Lock, CheckCircle, RefreshCw, BookOpen,
  Eye, EyeOff, Tag, Flame, Leaf, Star
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Lang = 'ar' | 'fr' | 'en' | 'es'
type Path = 'url' | 'file' | 'camera' | 'manual'
type Stage = 'path-select' | 'input' | 'enhancing' | 'review' | 'done'

interface DraftItem {
  nameAr: string; nameEn: string; nameFr: string; nameEs: string
  descriptionAr?: string; descriptionEn?: string; descriptionFr?: string; descriptionEs?: string
  price: number; calories?: number; tags?: string[]
  category: string; imageUrl?: string
  _key: string
}

// ── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    title: 'محرك إعداد المنيو الذكي',
    sub:   'أنشئ قائمة طعام كاملة ومحسّنة بالذكاء الاصطناعي في دقائق',
    paths: {
      url:    { label: 'رابط الموقع', sub: 'استخراج المنيو من موقعك الإلكتروني تلقائياً' },
      file:   { label: 'ملف رقمي', sub: 'رفع Excel أو Word أو PDF' },
      camera: { label: 'صورة المنيو', sub: 'ارفع صورة أو صوّر قائمتك الورقية' },
      manual: { label: 'إدخال يدوي', sub: 'أدخل أسماء الوجبات وسيقترح النظام الأسعار تلقائياً' },
    },
    pathTitle: 'اختر طريقة إنشاء المنيو',
    urlLabel:  'رابط الموقع الإلكتروني',
    urlPh:     'https://example.com/menu',
    extract:   'استخراج المنيو',
    extracting:'جارٍ الاستخراج…',
    uploadFile:'رفع الملف (Excel / Word / PDF)',
    analyzing: 'جارٍ التحليل…',
    addPhoto:  'التقاط صورة بالكاميرا',
    uploadPhoto: 'رفع صورة من الجهاز',
    dragDrop:  'اسحب وأفلت الصور هنا أو',
    capture:   'تحليل الصور بالذكاء الاصطناعي',
    manualItems:'أسماء الوجبات (كل وجبة في سطر)',
    manualPh:  'مثال:\nقهوة عربية\nبيتزا مارغريتا\nعصير برتقال',
    suggestPrices: 'اقتراح أسعار تلقائياً',
    enhanceBtn: '✨ تحسين بالذكاء الاصطناعي (أوصاف، سعرات، وسوم)',
    enhancing: 'جارٍ التحسين بالذكاء الاصطناعي…',
    reviewTitle:'مراجعة المنيو المسودة',
    reviewSub: 'راجع وعدّل كل وجبة قبل النشر النهائي',
    publishDraft: 'حفظ كمسودة',
    publishNow: 'اعتماد ونشر المنيو 🚀',
    publishing: 'جارٍ النشر…',
    published: 'تم نشر المنيو بنجاح! 🎉',
    goMenu:    'الذهاب إلى إدارة المنيو',
    goDash:    'الذهاب للوحة التحكم',
    noItems:   'لا توجد وجبات — ارجع وأعد المحاولة',
    back:      'رجوع',
    items:     'وجبة',
    categories:'أقسام',
    modeTitle:       'كيف تريد تطبيق هذا المنيو؟',
    modeAdd:         'إضافة إلى المنيو الحالي',
    modeAddSub:      'يتم دمج الوجبات الجديدة مع المنيو الموجود',
    modeReplace:     'استبدال المنيو بالكامل',
    modeReplaceSub:  'يتم حذف كل الوجبات الحالية واستبدالها بهذا المنيو',
    modeReplaceWarn: 'تحذير: سيتم حذف المنيو الحالي نهائياً',
    existingItems:   'وجبة موجودة حالياً',
    ai:        'AI',
    price:     'السعر', calories: 'سعرات', tags: 'وسوم', category: 'القسم',
    editName:  'تعديل الاسم',
    kcal: 'kcal',
    tags_labels: { vegetarian: '🌱 نباتي', spicy: '🌶️ حار', popular: '⭐ الأكثر طلباً', new: '🆕 جديد', halal: '🕌 حلال', cold: '🧊 بارد', hot: '🔥 ساخن', sweet: '🍬 حلو' },
    paywall: {
      title: 'ميزة المطاعم الشاملة',
      sub:   'إضافة وجبات كاملة ونظام مطبخ KDS متاح فقط لباقة المطعم الشامل',
      features: ['🍽️ إدارة وجبات كاملة', '👨‍🍳 شاشة مطبخ KDS', '📊 تقارير الأداء', '💰 نظام عمولات الطاقم'],
      price:   '$25',
      upgrade: 'ترقية الحساب الآن',
      upgrading: 'جارٍ الترقية…',
      skip:    'لاحقاً',
      alreadyRestaurant: 'أنت بالفعل على باقة المطعم الشامل ✓',
    },
  },
  fr: {
    title: 'Moteur de Génération de Menu IA',
    sub:   'Créez un menu complet et optimisé par IA en quelques minutes',
    paths: {
      url:    { label: 'Lien du site web', sub: 'Extrayez automatiquement le menu de votre site' },
      file:   { label: 'Fichier numérique', sub: 'Importez Excel, Word ou PDF' },
      camera: { label: 'Photo du menu', sub: 'Importez ou photographiez votre menu papier' },
      manual: { label: 'Saisie manuelle', sub: 'Entrez les noms, l\'IA suggère les prix' },
    },
    pathTitle: 'Choisissez votre méthode',
    urlLabel:  'URL du site web',
    urlPh:     'https://example.com/menu',
    extract:   'Extraire le menu',
    extracting:'Extraction en cours…',
    uploadFile:'Télécharger (Excel / Word / PDF)',
    analyzing: 'Analyse en cours…',
    addPhoto:  'Prendre une photo',
    uploadPhoto: 'Importer depuis l\'appareil',
    dragDrop:  'Glissez-déposez les images ici ou',
    capture:   'Analyser les photos par IA',
    manualItems:'Noms des plats (un par ligne)',
    manualPh:  'Café arabique\nPizza Margherita\nJus d\'orange',
    suggestPrices: 'Suggérer des prix automatiquement',
    enhanceBtn: '✨ Améliorer avec l\'IA',
    enhancing: 'Amélioration IA en cours…',
    reviewTitle:'Révision du menu',
    reviewSub: 'Vérifiez et modifiez chaque plat avant publication',
    publishDraft: 'Sauvegarder comme brouillon',
    publishNow: 'Valider et publier le menu 🚀',
    publishing: 'Publication en cours…',
    published: 'Menu publié avec succès ! 🎉',
    goMenu:    'Gérer le menu',
    goDash:    'Tableau de bord',
    noItems:   'Aucun plat — revenez en arrière',
    back:      'Retour',
    items:     'plat(s)',
    categories:'catégories',
    modeTitle:       'Comment appliquer ce menu ?',
    modeAdd:         'Ajouter au menu existant',
    modeAddSub:      'Les nouveaux plats seront fusionnés avec le menu actuel',
    modeReplace:     'Remplacer tout le menu',
    modeReplaceSub:  'Tous les plats actuels seront supprimés et remplacés',
    modeReplaceWarn: 'Attention : le menu actuel sera définitivement supprimé',
    existingItems:   'plat(s) déjà dans le menu',
    ai:        'IA',
    price:     'Prix', calories: 'Calories', tags: 'Étiquettes', category: 'Catégorie',
    editName:  'Modifier',
    kcal: 'kcal',
    tags_labels: { vegetarian: '🌱 Végétarien', spicy: '🌶️ Épicé', popular: '⭐ Populaire', new: '🆕 Nouveau', halal: '🕌 Halal', cold: '🧊 Froid', hot: '🔥 Chaud', sweet: '🍬 Sucré' },
    paywall: {
      title: 'Fonctionnalité Restaurant',
      sub:   'Les plats complets et le KDS sont réservés au plan Restaurant',
      features: ['🍽️ Gestion des plats', '👨‍🍳 Écran cuisine KDS', '📊 Rapports détaillés', '💰 Commissions du personnel'],
      price:   '$25',
      upgrade: 'Mettre à niveau maintenant',
      upgrading: 'Mise à niveau…',
      skip:    'Plus tard',
      alreadyRestaurant: 'Vous êtes déjà sur le plan Restaurant ✓',
    },
  },
  en: {
    title: 'Smart Menu Generation Engine',
    sub:   'Create a complete, AI-enhanced menu in minutes',
    paths: {
      url:    { label: 'Website URL', sub: 'Auto-extract menu from your website' },
      file:   { label: 'Digital File', sub: 'Upload Excel, Word or PDF' },
      camera: { label: 'Menu Photo', sub: 'Upload or photograph your printed menu' },
      manual: { label: 'Manual Entry', sub: 'Enter dish names, AI suggests prices' },
    },
    pathTitle: 'Choose your menu creation method',
    urlLabel:  'Website URL',
    urlPh:     'https://example.com/menu',
    extract:   'Extract Menu',
    extracting:'Extracting…',
    uploadFile:'Upload File (Excel / Word / PDF)',
    analyzing: 'Analyzing…',
    addPhoto:  'Take Photo (Camera)',
    uploadPhoto: 'Upload from Device',
    dragDrop:  'Drag & drop images here or',
    capture:   'Analyze Photos with AI',
    manualItems:'Dish names (one per line)',
    manualPh:  'Arabic coffee\nMargherita pizza\nOrange juice',
    suggestPrices: 'Auto-suggest prices',
    enhanceBtn: '✨ AI Enhance (descriptions, calories, tags)',
    enhancing: 'AI enhancing your menu…',
    reviewTitle:'Menu Draft Review',
    reviewSub: 'Review and edit each item before final publish',
    publishDraft: 'Save as Draft',
    publishNow: 'Approve & Publish Menu 🚀',
    publishing: 'Publishing…',
    published: 'Menu published successfully! 🎉',
    goMenu:    'Go to Menu Management',
    goDash:    'Go to Dashboard',
    noItems:   'No items found — go back and retry',
    back:      'Back',
    items:     'item(s)',
    categories:'categories',
    modeTitle:       'How do you want to apply this menu?',
    modeAdd:         'Add to existing menu',
    modeAddSub:      'New items will be merged with your current menu',
    modeReplace:     'Replace entire menu',
    modeReplaceSub:  'All current items will be deleted and replaced',
    modeReplaceWarn: 'Warning: your current menu will be permanently deleted',
    existingItems:   'item(s) already in your menu',
    ai:        'AI',
    price:     'Price', calories: 'Calories', tags: 'Tags', category: 'Category',
    editName:  'Edit',
    kcal: 'kcal',
    tags_labels: { vegetarian: '🌱 Vegetarian', spicy: '🌶️ Spicy', popular: '⭐ Popular', new: '🆕 New', halal: '🕌 Halal', cold: '🧊 Cold', hot: '🔥 Hot', sweet: '🍬 Sweet' },
    paywall: {
      title: 'Restaurant-Tier Feature',
      sub:   'Full meal menus and KDS kitchen screen are available in the Restaurant plan only',
      features: ['🍽️ Full meal management', '👨‍🍳 KDS kitchen screen', '📊 Performance reports', '💰 Staff commission system'],
      price:   '$25',
      upgrade: 'Upgrade Account Now',
      upgrading: 'Upgrading…',
      skip:    'Skip for now',
      alreadyRestaurant: 'You are already on the Restaurant plan ✓',
    },
  },
  es: {
    title: 'Motor de Generación de Menú IA',
    sub:   'Crea un menú completo y optimizado por IA en minutos',
    paths: {
      url:    { label: 'URL del sitio web', sub: 'Extrae automáticamente el menú de tu sitio' },
      file:   { label: 'Archivo digital', sub: 'Sube Excel, Word o PDF' },
      camera: { label: 'Foto del menú', sub: 'Sube o fotografía tu menú impreso' },
      manual: { label: 'Entrada manual', sub: 'Ingresa nombres, la IA sugiere precios' },
    },
    pathTitle: 'Elige tu método',
    urlLabel:  'URL del sitio web',
    urlPh:     'https://example.com/menu',
    extract:   'Extraer menú',
    extracting:'Extrayendo…',
    uploadFile:'Subir archivo (Excel / Word / PDF)',
    analyzing: 'Analizando…',
    addPhoto:  'Tomar foto (cámara)',
    uploadPhoto: 'Subir desde dispositivo',
    dragDrop:  'Arrastra imágenes aquí o',
    capture:   'Analizar fotos con IA',
    manualItems:'Nombres de platos (uno por línea)',
    manualPh:  'Café árabe\nPizza Margarita\nJugo de naranja',
    suggestPrices: 'Sugerir precios automáticamente',
    enhanceBtn: '✨ Mejorar con IA',
    enhancing: 'Mejorando con IA…',
    reviewTitle:'Revisión del menú borrador',
    reviewSub: 'Revisa y edita cada plato antes de publicar',
    publishDraft: 'Guardar como borrador',
    publishNow: 'Aprobar y publicar menú 🚀',
    publishing: 'Publicando…',
    published: '¡Menú publicado con éxito! 🎉',
    goMenu:    'Gestionar menú',
    goDash:    'Panel de control',
    noItems:   'No hay platos — vuelve atrás',
    back:      'Atrás',
    items:     'plato(s)',
    categories:'categorías',
    modeTitle:       '¿Cómo aplicar este menú?',
    modeAdd:         'Agregar al menú existente',
    modeAddSub:      'Los nuevos platos se fusionarán con el menú actual',
    modeReplace:     'Reemplazar todo el menú',
    modeReplaceSub:  'Todos los platos actuales serán eliminados y reemplazados',
    modeReplaceWarn: 'Advertencia: tu menú actual será eliminado permanentemente',
    existingItems:   'plato(s) ya en el menú',
    ai:        'IA',
    price:     'Precio', calories: 'Calorías', tags: 'Etiquetas', category: 'Categoría',
    editName:  'Editar',
    kcal: 'kcal',
    tags_labels: { vegetarian: '🌱 Vegetariano', spicy: '🌶️ Picante', popular: '⭐ Popular', new: '🆕 Nuevo', halal: '🕌 Halal', cold: '🧊 Frío', hot: '🔥 Caliente', sweet: '🍬 Dulce' },
    paywall: {
      title: 'Función Restaurante',
      sub:   'Menús completos y KDS disponibles solo en el plan Restaurante',
      features: ['🍽️ Gestión de platos', '👨‍🍳 Pantalla cocina KDS', '📊 Informes de rendimiento', '💰 Comisiones del personal'],
      price:   '$25',
      upgrade: 'Actualizar ahora',
      upgrading: 'Actualizando…',
      skip:    'Más tarde',
      alreadyRestaurant: 'Ya estás en el plan Restaurante ✓',
    },
  },
}

function authHeader() {
  const tk = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return { Authorization: `Bearer ${tk ?? ''}`, 'Content-Type': 'application/json' }
}

const TAG_ICONS: Record<string, string> = { vegetarian: '🌱', spicy: '🌶️', popular: '⭐', new: '🆕', halal: '🕌', cold: '🧊', hot: '🔥', sweet: '🍬' }

// ── Paywall component ─────────────────────────────────────────────────────────

function PaywallOverlay({ t, onUpgrade, onSkip, tier }: {
  t: typeof T['en']['paywall']; onUpgrade: () => Promise<void>; onSkip: () => void; tier: string
}) {
  const [upgrading, setUpgrading] = useState(false)
  const [done, setDone] = useState(tier === 'RESTAURANT')

  async function handleUpgrade() {
    setUpgrading(true)
    await onUpgrade()
    setDone(true)
    setUpgrading(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5">
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-800">{t.title}</h2>
          <p className="text-slate-500 text-sm mt-1">{t.sub}</p>
        </div>

        <ul className="space-y-2">
          {t.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> {f}
            </li>
          ))}
        </ul>

        {done ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center text-emerald-700 font-semibold">
            {t.alreadyRestaurant}
          </div>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-3xl font-extrabold text-amber-600">{t.price}</p>
              <p className="text-xs text-amber-500 mt-0.5">دفعة واحدة — Paiement unique — One-time payment</p>
            </div>

            <button onClick={handleUpgrade} disabled={upgrading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95">
              {upgrading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.upgrading}</>
                : <><CreditCard className="w-4 h-4" /> {t.upgrade} — {t.price}</>
              }
            </button>
          </>
        )}

        <button onClick={onSkip} className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">
          {t.skip}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MenuGenPage() {
  const router  = useRouter()
  const fileRef    = useRef<HTMLInputElement>(null)
  const camRef     = useRef<HTMLInputElement>(null)
  const imgUploadRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const { lang, isRTL } = useLang()
  const t = T[lang]

  const [stage,  setStage]  = useState<Stage>('path-select')
  const [path,   setPath]   = useState<Path>('url')
  const [loading, setLoading] = useState(false)
  const [errMsg,  setErrMsg]  = useState('')

  // Cafe tier
  const [tier,    setTier]    = useState<'CAFE'|'RESTAURANT'>('CAFE')
  const [country, setCountry] = useState('MA')
  const [currency, setCurrency] = useState('MAD')
  const [showPaywall, setShowPaywall] = useState(false)

  // Input state
  const [urlInput, setUrlInput] = useState('')
  const [fileObj,  setFileObj]  = useState<File | null>(null)
  const [camImages, setCamImages] = useState<{ data: string; mimeType: string; preview: string }[]>([])
  const [manualText, setManualText] = useState('')

  // Draft items
  const [items, setItems]    = useState<DraftItem[]>([])
  const [enhanced, setEnhanced] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished]   = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)

  // Publish mode
  const [publishMode, setPublishMode] = useState<'add' | 'replace'>('add')
  const [existingCount, setExistingCount] = useState(0)

  // Load cafe tier and existing menu count on mount
  useEffect(() => {
    fetch('/api/admin/cafe/tier', { headers: authHeader() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.tier) setTier(d.tier)
        if (d?.country)  setCountry(d.country)
        if (d?.currency) setCurrency(d.currency)
      })
    fetch('/api/admin/menu', { headers: authHeader() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d)) {
          const count = d.reduce((sum: number, cat: any) => sum + (cat.products?.length ?? 0), 0)
          setExistingCount(count)
        }
      })
  }, [])

  function key(item: Omit<DraftItem, '_key'>, i: number) { return `${item.nameEn}-${i}` }

  // ── Path: URL extraction ──────────────────────────────────────────────────
  async function extractFromUrl() {
    if (!urlInput.trim()) return
    setLoading(true); setErrMsg('')
    try {
      const res  = await fetch('/api/admin/menu-gen/from-url', { method: 'POST', headers: authHeader(), body: JSON.stringify({ url: urlInput }) })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data.error ?? 'Failed'); return }
      setItems(data.items.map((it: any, i: number) => ({ ...it, _key: key(it, i) })))
      setStage('review')
    } catch { setErrMsg('Network error') }
    finally { setLoading(false) }
  }

  // ── Path: File upload ─────────────────────────────────────────────────────
  async function extractFromFile() {
    if (!fileObj) return
    setLoading(true); setErrMsg('')
    try {
      const form = new FormData(); form.append('file', fileObj)
      const res  = await fetch('/api/admin/menu-gen/from-file', {
        method: 'POST', headers: { Authorization: authHeader().Authorization }, body: form
      })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data.error ?? 'Failed'); return }
      setItems(data.items.map((it: any, i: number) => ({ ...it, _key: key(it, i) })))
      setStage('review')
    } catch { setErrMsg('Network error') }
    finally { setLoading(false) }
  }

  // ── Path: Camera / images ─────────────────────────────────────────────────
  function readImageFiles(files: File[]) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (!imageFiles.length) return
    Promise.all(imageFiles.map(f => new Promise<{ data: string; mimeType: string; preview: string }>((res) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        res({ data: base64, mimeType: f.type, preview: reader.result as string })
      }
      reader.readAsDataURL(f)
    }))).then(imgs => setCamImages(prev => [...prev, ...imgs]))
  }

  function handleCamCapture(e: React.ChangeEvent<HTMLInputElement>) {
    readImageFiles(Array.from(e.target.files ?? []))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    readImageFiles(Array.from(e.dataTransfer.files))
  }

  async function extractFromImages() {
    if (!camImages.length) return
    setLoading(true); setErrMsg('')
    try {
      const res  = await fetch('/api/admin/menu-gen/from-images', {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ images: camImages.map(({ data, mimeType }) => ({ data, mimeType })) })
      })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data.error ?? 'Failed'); return }
      setItems(data.items.map((it: any, i: number) => ({ ...it, _key: key(it, i) })))
      setStage('review')
    } catch { setErrMsg('Network error') }
    finally { setLoading(false) }
  }

  // ── Path: Manual + geo-pricing ────────────────────────────────────────────
  async function extractManual() {
    const lines = manualText.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return
    setLoading(true); setErrMsg('')
    try {
      const rawItems = lines.map((l, i) => ({ nameAr: l, nameEn: l, nameFr: l, nameEs: l, category: 'General', price: 0 }))

      // First: geo-price suggest
      const priceRes  = await fetch('/api/admin/menu-gen/price-suggest', {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ items: rawItems, country, currency, city: '' })
      })
      const priceData = await priceRes.json()
      const prices: { index: number; price: number }[] = priceData.prices ?? []
      const priced = rawItems.map((it, i) => {
        const p = prices.find(p => p.index === i)
        return { ...it, price: p?.price ?? 0 }
      })
      setItems(priced.map((it, i) => ({ ...it, _key: key(it, i) })))
      setStage('review')
    } catch { setErrMsg('Network error') }
    finally { setLoading(false) }
  }

  // ── AI Enhance ────────────────────────────────────────────────────────────
  async function enhance() {
    setStage('enhancing')
    setErrMsg('')
    try {
      const res  = await fetch('/api/admin/menu-gen/enhance', {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ items, country, currency })
      })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data.error ?? 'Enhancement failed'); setStage('review'); return }
      setItems((data.items as any[]).map((it, i) => ({ ...it, _key: `enhanced-${i}` })))
      setEnhanced(true)
      setStage('review')
    } catch { setErrMsg('Enhancement failed'); setStage('review') }
  }

  // ── Publish ───────────────────────────────────────────────────────────────
  async function publish(publishNow: boolean) {
    setPublishing(true); setErrMsg('')
    try {
      const res = await fetch('/api/admin/menu-gen/publish-draft', {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ items, publishNow, mode: publishMode })
      })
      if (!res.ok) { const d = await res.json(); setErrMsg(d.error ?? 'Publish failed'); return }
      setPublished(true); setStage('done')
    } catch { setErrMsg('Publish failed') }
    finally { setPublishing(false) }
  }

  // ── Upgrade tier ──────────────────────────────────────────────────────────
  async function upgradeTier() {
    await fetch('/api/admin/cafe/tier-upgrade', { method: 'PATCH', headers: authHeader() })
    setTier('RESTAURANT')
  }

  // ── Item editing helpers ──────────────────────────────────────────────────
  function updateItem(k: string, field: keyof DraftItem, val: any) {
    setItems(prev => prev.map(it => it._key === k ? { ...it, [field]: val } : it))
  }
  function removeItem(k: string) { setItems(prev => prev.filter(it => it._key !== k)) }

  const categories = [...new Set(items.map(it => it.category))].filter(Boolean)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

      {/* Paywall */}
      {showPaywall && (
        <PaywallOverlay t={t.paywall} tier={tier}
          onUpgrade={upgradeTier}
          onSkip={() => setShowPaywall(false)}
        />
      )}

      {/* Sticky header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-800 text-base leading-none">{t.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{t.sub}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tier badge */}
          <button onClick={() => setShowPaywall(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              tier === 'RESTAURANT'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}>
            {tier === 'RESTAURANT' ? '🍽️ Restaurant' : '☕ Cafe'}
            {tier === 'CAFE' && <Lock className="w-3 h-3" />}
          </button>

        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

        {/* ── Stage: Path Selection ── */}
        {stage === 'path-select' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-700">{t.pathTitle}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {(['url','file','camera','manual'] as Path[]).map(p => {
                const icons = { url: Globe, file: FileUp, camera: Camera, manual: BookOpen }
                const colors = { url: 'blue', file: 'violet', camera: 'emerald', manual: 'amber' }
                const Icon = icons[p]
                const col  = colors[p]
                return (
                  <button key={p} onClick={() => { setPath(p); setStage('input') }}
                    className={`relative bg-white rounded-2xl p-5 border-2 text-start hover:shadow-md transition-all hover:-translate-y-0.5 ${
                      path === p ? `border-${col}-400 shadow-md` : 'border-slate-100'
                    }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-${col}-50`}>
                      <Icon className={`w-5 h-5 text-${col}-600`} />
                    </div>
                    <p className="font-bold text-slate-800 text-sm">{t.paths[p].label}</p>
                    <p className="text-xs text-slate-400 mt-1">{t.paths[p].sub}</p>

                    {/* Lock for CAFE trying camera/file (needs RESTAURANT for full feature set) */}
                    {tier === 'CAFE' && p === 'manual' && (
                      <div className="absolute top-2 end-2 w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center">
                        <Zap className="w-3 h-3 text-amber-500" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Stage: Input ── */}
        {stage === 'input' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2">
              <button onClick={() => setStage('path-select')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              <h2 className="font-bold text-slate-800">{t.paths[path].label}</h2>
            </div>

            {/* URL input */}
            {path === 'url' && (
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-600">{t.urlLabel}</label>
                <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  placeholder={t.urlPh} onKeyDown={e => e.key === 'Enter' && extractFromUrl()}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                <button onClick={extractFromUrl} disabled={loading || !urlInput.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.extracting}</> : <><Globe className="w-4 h-4" /> {t.extract}</>}
                </button>
              </div>
            )}

            {/* File upload */}
            {path === 'file' && (
              <div className="space-y-3">
                <button onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-300 hover:border-violet-400 rounded-2xl p-8 text-center transition-colors">
                  <FileUp className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="font-semibold text-slate-600 text-sm">{t.uploadFile}</p>
                  {fileObj && <p className="text-xs text-violet-600 mt-2 font-medium">✓ {fileObj.name}</p>}
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.pdf,.docx,.doc,.csv,.txt" className="hidden"
                  onChange={e => setFileObj(e.target.files?.[0] ?? null)} />
                {fileObj && (
                  <button onClick={extractFromFile} disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.analyzing}</> : <><Sparkles className="w-4 h-4" /> {t.extract}</>}
                  </button>
                )}
              </div>
            )}

            {/* Camera / Image Upload */}
            {path === 'camera' && (
              <div className="space-y-4">

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => imgUploadRef.current?.click()}
                  className={`relative w-full border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/40'
                  }`}
                >
                  <Camera className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-600">{t.dragDrop}</p>
                  <p className="text-xs text-emerald-600 font-bold mt-1 underline">{t.uploadPhoto}</p>
                  <p className="text-xs text-slate-400 mt-2">JPG · PNG · WEBP · HEIC — max 10 MB / image</p>
                </div>

                {/* Hidden inputs */}
                <input ref={imgUploadRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { readImageFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
                <input ref={camRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
                  onChange={handleCamCapture} />

                {/* Mobile camera button */}
                <button onClick={e => { e.stopPropagation(); camRef.current?.click() }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-sm transition-colors w-full justify-center">
                  <Camera className="w-4 h-4" /> {t.addPhoto}
                </button>

                {/* Previews */}
                {camImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {camImages.map((img, i) => (
                      <div key={i} className="relative w-24 h-24">
                        <img src={img.preview} className="w-full h-full rounded-xl object-cover border-2 border-emerald-200 shadow-sm" alt="" />
                        <button onClick={() => setCamImages(p => p.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -end-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Analyze button */}
                {camImages.length > 0 && (
                  <button onClick={extractFromImages} disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20">
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.analyzing}</>
                      : <><Sparkles className="w-4 h-4" /> {t.capture} ({camImages.length} {camImages.length === 1 ? 'image' : 'images'})</>
                    }
                  </button>
                )}
              </div>
            )}

            {/* Manual */}
            {path === 'manual' && (
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-600">{t.manualItems}</label>
                <textarea value={manualText} onChange={e => setManualText(e.target.value)}
                  placeholder={t.manualPh} rows={8}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none font-mono" />
                <button onClick={extractManual} disabled={loading || !manualText.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.extracting}</> : <><Zap className="w-4 h-4" /> {t.suggestPrices}</>}
                </button>
              </div>
            )}

            {errMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {errMsg}
              </div>
            )}
          </div>
        )}

        {/* ── Stage: Enhancing ── */}
        {stage === 'enhancing' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" />
            </div>
            <p className="font-bold text-slate-700 text-lg">{t.enhancing}</p>
            <div className="flex justify-center gap-1">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Stage: Review ── */}
        {stage === 'review' && (
          <div className="space-y-4">
            {/* Review header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-bold text-slate-800 text-lg">{t.reviewTitle}</h2>
                <p className="text-sm text-slate-400">{t.reviewSub}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
                  {items.length} {t.items} · {categories.length} {t.categories}
                </span>
                {!enhanced && (
                  <button onClick={enhance}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white rounded-xl text-sm font-bold transition-all active:scale-95">
                    <Sparkles className="w-4 h-4" /> {t.enhanceBtn}
                  </button>
                )}
                {enhanced && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-violet-600 bg-violet-50 px-3 py-1.5 rounded-full border border-violet-100">
                    <Check className="w-3.5 h-3.5" /> {t.ai} Enhanced
                  </span>
                )}
              </div>
            </div>

            {items.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>{t.noItems}</p>
                <button onClick={() => setStage('input')} className="mt-3 text-sm text-amber-600 font-semibold hover:text-amber-700">
                  ← {t.back}
                </button>
              </div>
            )}

            {/* Group by category */}
            {categories.map(cat => (
              <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-5 py-3">
                  <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    {cat}
                    <span className="text-xs font-normal text-slate-400">({items.filter(it => it.category === cat).length})</span>
                  </h3>
                </div>
                <div className="divide-y divide-slate-50">
                  {items.filter(it => it.category === cat).map(item => (
                    <ItemRow key={item._key} item={item} lang={lang} isRTL={isRTL} t={t}
                      editing={editingKey === item._key}
                      onEdit={() => setEditingKey(editingKey === item._key ? null : item._key)}
                      onUpdate={(f, v) => updateItem(item._key, f, v)}
                      onRemove={() => removeItem(item._key)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {errMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {errMsg}
              </div>
            )}

            {/* Publish mode selector */}
            {items.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                <p className="font-semibold text-slate-700 text-sm">{t.modeTitle}</p>
                {existingCount > 0 && (
                  <p className="text-xs text-slate-400">{existingCount} {t.existingItems}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPublishMode('add')}
                    className={`rounded-xl border-2 p-3 text-start transition-all ${
                      publishMode === 'add'
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 hover:border-emerald-200'
                    }`}>
                    <p className={`font-bold text-sm ${publishMode === 'add' ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {publishMode === 'add' && <Check className="w-3.5 h-3.5 inline me-1" />}
                      {t.modeAdd}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.modeAddSub}</p>
                  </button>
                  <button
                    onClick={() => setPublishMode('replace')}
                    className={`rounded-xl border-2 p-3 text-start transition-all ${
                      publishMode === 'replace'
                        ? 'border-red-400 bg-red-50'
                        : 'border-slate-200 hover:border-red-200'
                    }`}>
                    <p className={`font-bold text-sm ${publishMode === 'replace' ? 'text-red-700' : 'text-slate-700'}`}>
                      {publishMode === 'replace' && <Check className="w-3.5 h-3.5 inline me-1" />}
                      {t.modeReplace}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.modeReplaceSub}</p>
                  </button>
                </div>
                {publishMode === 'replace' && existingCount > 0 && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-xs font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {t.modeReplaceWarn}
                  </div>
                )}
              </div>
            )}

            {/* Publish buttons */}
            {items.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => publish(false)} disabled={publishing}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all disabled:opacity-50">
                  {t.publishDraft}
                </button>
                <button onClick={() => publish(true)} disabled={publishing}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2">
                  {publishing
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.publishing}</>
                    : t.publishNow}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Stage: Done ── */}
        {stage === 'done' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center space-y-5">
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <div>
              <p className="font-extrabold text-slate-800 text-2xl">{t.published}</p>
              <p className="text-slate-400 text-sm mt-1">{items.length} {t.items} · {categories.length} {t.categories}</p>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => router.push('/admin/menu')}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-bold transition-all">
                {t.goMenu}
              </button>
              <button onClick={() => router.push('/admin/dashboard')}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all">
                {t.goDash}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ── ItemRow ───────────────────────────────────────────────────────────────────

function ItemRow({ item, lang, isRTL, t, editing, onEdit, onUpdate, onRemove }: {
  item: DraftItem; lang: Lang; isRTL: boolean; t: typeof T['en']
  editing: boolean; onEdit: () => void
  onUpdate: (f: keyof DraftItem, v: any) => void
  onRemove: () => void
}) {
  const name = lang === 'ar' ? item.nameAr : lang === 'fr' ? item.nameFr : lang === 'es' ? item.nameEs : item.nameEn
  const desc = lang === 'ar' ? item.descriptionAr : lang === 'fr' ? item.descriptionFr : lang === 'es' ? item.descriptionEs : item.descriptionEn

  return (
    <div className="px-5 py-3">
      <div className="flex items-start gap-3">
        {/* Name + desc */}
        <div className="flex-1 min-w-0">
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
            <span className="font-semibold text-slate-800 text-sm truncate">{name}</span>
            {item.tags?.map(tag => (
              <span key={tag} className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full shrink-0">
                {TAG_ICONS[tag] ?? tag}
              </span>
            ))}
          </div>
          {desc && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{desc}</p>}
          {item.calories != null && item.calories > 0 && (
            <span className="text-xs text-orange-400 font-medium">{item.calories} {t.kcal}</span>
          )}
        </div>

        {/* Price */}
        <div className="shrink-0 text-right">
          {editing ? (
            <input type="number" min="0" step="0.5" value={item.price}
              onChange={e => onUpdate('price', parseFloat(e.target.value) || 0)}
              className="w-20 text-right px-2 py-1 border border-amber-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400" />
          ) : (
            <span className="font-bold text-amber-600 text-sm">{item.price > 0 ? item.price.toFixed(2) : '—'}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRemove} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded editing */}
      {editing && (
        <div className="mt-3 bg-slate-50 rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400">🇸🇦 AR</label>
              <input value={item.nameAr} onChange={e => onUpdate('nameAr', e.target.value)}
                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs text-slate-400">🇬🇧 EN</label>
              <input value={item.nameEn} onChange={e => onUpdate('nameEn', e.target.value)}
                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs text-slate-400">🇫🇷 FR</label>
              <input value={item.nameFr} onChange={e => onUpdate('nameFr', e.target.value)}
                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs text-slate-400">🇪🇸 ES</label>
              <input value={item.nameEs} onChange={e => onUpdate('nameEs', e.target.value)}
                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">{t.category}</label>
            <input value={item.category} onChange={e => onUpdate('category', e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400">{t.price}</label>
              <input type="number" min="0" step="0.5" value={item.price}
                onChange={e => onUpdate('price', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs text-slate-400">{t.calories}</label>
              <input type="number" min="0" value={item.calories ?? ''} placeholder="0"
                onChange={e => onUpdate('calories', parseInt(e.target.value) || 0)}
                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400" />
            </div>
          </div>
          {/* Tags */}
          <div>
            <label className="text-xs text-slate-400">{t.tags}</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.keys(TAG_ICONS).map(tag => {
                const active = item.tags?.includes(tag)
                return (
                  <button key={tag} type="button"
                    onClick={() => onUpdate('tags', active ? (item.tags ?? []).filter(t => t !== tag) : [...(item.tags ?? []), tag])}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${active ? 'bg-amber-100 border-amber-400 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:border-amber-200'}`}>
                    {TAG_ICONS[tag]}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
