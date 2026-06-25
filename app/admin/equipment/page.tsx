'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Wrench, Plus, ChevronDown, ChevronUp, Trash2, Edit3,
  AlertTriangle, CheckCircle2, Clock, XCircle, Loader2,
  RefreshCw, Shield, Snowflake,
  Flame, Coffee, Monitor, Package, Tag, CalendarDays,
  User, Phone, FileText, Link2, StickyNote, Hash,
  Truck, CreditCard, Hammer,
} from 'lucide-react'
import { useLang } from '../lang-context'

// ── i18n ──────────────────────────────────────────────────────────────────────
const T = {
  ar: {
    title:          'المعدات والصيانة',
    subtitle:       'تتبع أجهزتك وسجّل التدخلات الفنية',
    add:            'إضافة',
    save:           'حفظ',
    cancel:         'إلغاء',
    edit:           'تعديل',
    delete:         'حذف',
    refresh:        'تحديث',
    newEquip:       'معدة جديدة',
    editEquip:      'تعديل المعدة',
    total:          'المجموع',
    active:         'نشط',
    activeLbl:      'نشطة',
    maintenance:    'صيانة',
    brokenOrSAV:    'أعطال / SAV',
    warrantyAlert:  'ضمان < 30 يوم',
    purchaseVal:    'قيمة الشراء الإجمالية',
    maintCost:      'تكاليف الصيانة',
    noEquip:        'لا توجد معدات مسجّلة.',
    noEquipSub:     'انقر على "إضافة" للبدء.',
    noMaint:        'لا توجد تدخلات مسجّلة.',
    newMaint:       'تدخل جديد',
    addMaint:       'إضافة تدخل',
    deleteEquipMsg: 'حذف هذه المعدة وكامل سجلاتها؟',
    deleteMaintMsg: 'حذف هذا التدخل؟',
    warrantyExpired:'انتهى الضمان',
    warrantyUntil:  'الضمان حتى',
    interventions:  'تدخل',
    free:           'مجاني',
    nextService:    'الخدمة القادمة',
    viewReceipt:    'عرض الفاتورة',
    // form fields
    fName:          'الاسم *',
    fBrand:         'الماركة',
    fSerial:        'الرقم التسلسلي',
    fSupplier:      'المورد',
    fPurchaseDate:  'تاريخ الشراء',
    fPurchasePrice: 'سعر الشراء (MAD)',
    fWarranty:      'نهاية الضمان',
    fReceiptUrl:    'رابط الفاتورة',
    fCategory:      'الفئة *',
    fStatus:        'الحالة',
    fNotes:         'ملاحظات',
    fDate:          'التاريخ',
    fCost:          'التكلفة (MAD)',
    fTech:          'الفني',
    fTechPhone:     'هاتف الفني',
    fNextService:   'الخدمة التالية',
    fDescription:   'الوصف *',
    statusActive:   'نشط',
    statusMaint:    'صيانة',
    statusBroken:   'معطل',
    statusRetired:  'متقاعد',
  },
  fr: {
    title:          'Équipements & Maintenance',
    subtitle:       'Gérez vos machines et suivez les interventions.',
    add:            'Ajouter',
    save:           'Enregistrer',
    cancel:         'Annuler',
    edit:           'Modifier',
    delete:         'Supprimer',
    refresh:        'Actualiser',
    newEquip:       'Nouvel équipement',
    editEquip:      'Modifier l\'équipement',
    total:          'Total',
    active:         'Actif',
    activeLbl:      'Actifs',
    maintenance:    'Maintenance',
    brokenOrSAV:    'En panne / SAV',
    warrantyAlert:  'Garanties < 30j',
    purchaseVal:    'Valeur totale achetée',
    maintCost:      'Total coûts maintenance',
    noEquip:        'Aucun équipement enregistré.',
    noEquipSub:     'Cliquez sur "Ajouter" pour commencer.',
    noMaint:        'Aucune intervention enregistrée.',
    newMaint:       'Nouvelle intervention',
    addMaint:       'Ajouter une intervention',
    deleteEquipMsg: 'Supprimer cet équipement et tout son historique ?',
    deleteMaintMsg: 'Supprimer cette intervention ?',
    warrantyExpired:'Garantie expirée',
    warrantyUntil:  'Garantie jusqu\'au',
    interventions:  'intervention',
    free:           'Gratuit',
    nextService:    'Prochain service',
    viewReceipt:    'Voir la facture',
    fName:          'Nom *',
    fBrand:         'Marque',
    fSerial:        'N° Série',
    fSupplier:      'Fournisseur',
    fPurchaseDate:  'Date achat',
    fPurchasePrice: 'Prix achat (MAD)',
    fWarranty:      'Fin garantie',
    fReceiptUrl:    'URL facture',
    fCategory:      'Catégorie *',
    fStatus:        'Statut',
    fNotes:         'Notes',
    fDate:          'Date',
    fCost:          'Coût (MAD)',
    fTech:          'Technicien',
    fTechPhone:     'Tél. technicien',
    fNextService:   'Prochain service',
    fDescription:   'Description *',
    statusActive:   'Actif',
    statusMaint:    'Maintenance',
    statusBroken:   'En panne',
    statusRetired:  'Retraité',
  },
  en: {
    title:          'Equipment & Maintenance',
    subtitle:       'Track your machines and log service records.',
    add:            'Add',
    save:           'Save',
    cancel:         'Cancel',
    edit:           'Edit',
    delete:         'Delete',
    refresh:        'Refresh',
    newEquip:       'New equipment',
    editEquip:      'Edit equipment',
    total:          'Total',
    active:         'Active',
    activeLbl:      'Active',
    maintenance:    'Maintenance',
    brokenOrSAV:    'Broken / SAV',
    warrantyAlert:  'Warranty < 30d',
    purchaseVal:    'Total purchase value',
    maintCost:      'Total maintenance cost',
    noEquip:        'No equipment registered.',
    noEquipSub:     'Click "Add" to get started.',
    noMaint:        'No service records.',
    newMaint:       'New service record',
    addMaint:       'Add service record',
    deleteEquipMsg: 'Delete this equipment and all its records?',
    deleteMaintMsg: 'Delete this service record?',
    warrantyExpired:'Warranty expired',
    warrantyUntil:  'Warranty until',
    interventions:  'service record',
    free:           'Free',
    nextService:    'Next service',
    viewReceipt:    'View receipt',
    fName:          'Name *',
    fBrand:         'Brand',
    fSerial:        'Serial No.',
    fSupplier:      'Supplier',
    fPurchaseDate:  'Purchase date',
    fPurchasePrice: 'Purchase price (MAD)',
    fWarranty:      'Warranty end',
    fReceiptUrl:    'Receipt URL',
    fCategory:      'Category *',
    fStatus:        'Status',
    fNotes:         'Notes',
    fDate:          'Date',
    fCost:          'Cost (MAD)',
    fTech:          'Technician',
    fTechPhone:     'Tech phone',
    fNextService:   'Next service',
    fDescription:   'Description *',
    statusActive:   'Active',
    statusMaint:    'Maintenance',
    statusBroken:   'Broken',
    statusRetired:  'Retired',
  },
  es: {
    title:          'Equipos y Mantenimiento',
    subtitle:       'Gestiona tus máquinas y registra las intervenciones.',
    add:            'Añadir',
    save:           'Guardar',
    cancel:         'Cancelar',
    edit:           'Editar',
    delete:         'Eliminar',
    refresh:        'Actualizar',
    newEquip:       'Nuevo equipo',
    editEquip:      'Editar equipo',
    total:          'Total',
    active:         'Activo',
    activeLbl:      'Activos',
    maintenance:    'Mantenimiento',
    brokenOrSAV:    'Averiado / SAV',
    warrantyAlert:  'Garantía < 30d',
    purchaseVal:    'Valor total comprado',
    maintCost:      'Total costes mantenimiento',
    noEquip:        'Ningún equipo registrado.',
    noEquipSub:     'Haz clic en "Añadir" para empezar.',
    noMaint:        'Ninguna intervención registrada.',
    newMaint:       'Nueva intervención',
    addMaint:       'Añadir intervención',
    deleteEquipMsg: '¿Eliminar este equipo y todo su historial?',
    deleteMaintMsg: '¿Eliminar esta intervención?',
    warrantyExpired:'Garantía expirada',
    warrantyUntil:  'Garantía hasta',
    interventions:  'intervención',
    free:           'Gratis',
    nextService:    'Próximo servicio',
    viewReceipt:    'Ver factura',
    fName:          'Nombre *',
    fBrand:         'Marca',
    fSerial:        'Nº Serie',
    fSupplier:      'Proveedor',
    fPurchaseDate:  'Fecha compra',
    fPurchasePrice: 'Precio compra (MAD)',
    fWarranty:      'Fin garantía',
    fReceiptUrl:    'URL factura',
    fCategory:      'Categoría *',
    fStatus:        'Estado',
    fNotes:         'Notas',
    fDate:          'Fecha',
    fCost:          'Coste (MAD)',
    fTech:          'Técnico',
    fTechPhone:     'Tel. técnico',
    fNextService:   'Próximo servicio',
    fDescription:   'Descripción *',
    statusActive:   'Activo',
    statusMaint:    'Mantenimiento',
    statusBroken:   'Averiado',
    statusRetired:  'Retirado',
  },
}

// ── Types ──────────────────────────────────────────────────────────────────────
type EquipStatus = 'active' | 'maintenance' | 'broken' | 'retired'

interface MaintenanceRecord {
  id:              string
  date:            string
  description:     string
  technicianName:  string | null
  technicianPhone: string | null
  cost:            number
  receiptUrl:      string | null
  nextServiceAt:   string | null
}

interface Equipment {
  id:              string
  name:            string
  category:        string
  brand:           string | null
  serialNumber:    string | null
  purchaseDate:    string | null
  purchasePrice:   number | null
  supplier:        string | null
  warrantyEndsAt:  string | null
  receiptUrl:      string | null
  photoUrl:        string | null
  status:          EquipStatus
  notes:           string | null
  maintenanceRecords: MaintenanceRecord[]
  _count:          { maintenanceRecords: number }
}

interface Summary {
  total:                number
  active:               number
  maintenance:          number
  broken:               number
  totalPurchaseValue:   number
  totalMaintenanceCost: number
  warrantyExpiringSoon: number
}

// ── Category meta ─────────────────────────────────────────────────────────────
const CAT_META: Record<string, { Icon: React.ElementType; bg: string; text: string; ring: string }> = {
  refrigeration: { Icon: Snowflake, bg: 'bg-cyan-500/15',    text: 'text-cyan-400',   ring: 'ring-cyan-500/30'   },
  cooking:       { Icon: Flame,     bg: 'bg-orange-500/15',  text: 'text-orange-400', ring: 'ring-orange-500/30' },
  coffee:        { Icon: Coffee,    bg: 'bg-amber-600/15',   text: 'text-amber-400',  ring: 'ring-amber-500/30'  },
  pos:           { Icon: Monitor,   bg: 'bg-violet-500/15',  text: 'text-violet-400', ring: 'ring-violet-500/30' },
  furniture:     { Icon: Package,   bg: 'bg-blue-500/15',    text: 'text-blue-400',   ring: 'ring-blue-500/30'   },
  other:         { Icon: Wrench,    bg: 'bg-slate-500/15',   text: 'text-slate-400',  ring: 'ring-slate-500/30'  },
}

function getCatMeta(cat: string) {
  return CAT_META[cat] ?? CAT_META.other
}

function getCategories(lang: string) {
  const ar = lang === 'ar', fr = lang === 'fr', es = lang === 'es'
  return [
    { value: 'refrigeration', label: `❄️  ${ar ? 'تبريد' : fr ? 'Réfrigération' : es ? 'Refrigeración' : 'Refrigeration'}` },
    { value: 'cooking',       label: `🔥  ${ar ? 'طبخ' : fr ? 'Cuisson' : es ? 'Cocción' : 'Cooking'}` },
    { value: 'coffee',        label: `☕  ${ar ? 'قهوة' : fr ? 'Café' : es ? 'Café' : 'Coffee'}` },
    { value: 'pos',           label: `🖥️  ${ar ? 'POS / كاشير' : fr ? 'POS / Caisse' : es ? 'POS / Caja' : 'POS / Register'}` },
    { value: 'furniture',     label: `🪑  ${ar ? 'أثاث' : fr ? 'Mobilier' : es ? 'Mobiliario' : 'Furniture'}` },
    { value: 'other',         label: `🔧  ${ar ? 'أخرى' : fr ? 'Autre' : es ? 'Otro' : 'Other'}` },
  ]
}

// ── Status meta ───────────────────────────────────────────────────────────────
function getStatusMeta(t: typeof T['ar']): Record<EquipStatus, { label: string; bg: string; text: string; Icon: React.ElementType }> {
  return {
    active:      { label: t.statusActive, bg: 'bg-emerald-500/15', text: 'text-emerald-400', Icon: CheckCircle2 },
    maintenance: { label: t.statusMaint,  bg: 'bg-amber-500/15',   text: 'text-amber-400',   Icon: Clock        },
    broken:      { label: t.statusBroken, bg: 'bg-rose-500/15',    text: 'text-rose-400',     Icon: XCircle      },
    retired:     { label: t.statusRetired,bg: 'bg-slate-500/15',   text: 'text-slate-400',   Icon: XCircle      },
  }
}

// ── Utils ──────────────────────────────────────────────────────────────────────
function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

function fmt(date: string | null, lang: string) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(
    lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB',
    { day: '2-digit', month: 'short', year: 'numeric' }
  )
}

function isWarrantyExpiringSoon(warrantyEndsAt: string | null) {
  if (!warrantyEndsAt) return false
  const d = new Date(warrantyEndsAt)
  const now = new Date()
  return d > now && d < new Date(now.getTime() + 30 * 86400000)
}

function isWarrantyExpired(warrantyEndsAt: string | null) {
  if (!warrantyEndsAt) return false
  return new Date(warrantyEndsAt) < new Date()
}

const EMPTY_EQUIP = {
  name: '', category: 'other', brand: '', serialNumber: '',
  purchaseDate: '', purchasePrice: '', supplier: '',
  warrantyEndsAt: '', receiptUrl: '', photoUrl: '', status: 'active' as EquipStatus, notes: '',
}

const EMPTY_MAINT = {
  date: '', description: '', technicianName: '', technicianPhone: '',
  cost: '', receiptUrl: '', nextServiceAt: '',
}

// ── Input / Select shared style ───────────────────────────────────────────────
const inputCls = 'w-full bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-colors'
const selectCls = 'w-full bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-colors'
const labelCls  = 'flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5'

// ── Component ─────────────────────────────────────────────────────────────────
export default function EquipmentPage() {
  const { lang, isRTL } = useLang()
  const t = { ...T[lang as keyof typeof T] ?? T.fr, lang }

  const [items,         setItems]         = useState<Equipment[]>([])
  const [summary,       setSummary]       = useState<Summary | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [expanded,      setExpanded]      = useState<string | null>(null)
  const [showForm,      setShowForm]      = useState(false)
  const [editItem,      setEditItem]      = useState<Equipment | null>(null)
  const [equipForm,     setEquipForm]     = useState({ ...EMPTY_EQUIP })
  const [maintForms,    setMaintForms]    = useState<Record<string, typeof EMPTY_MAINT>>({})
  const [showMaintForm, setShowMaintForm] = useState<string | null>(null)
  const [saving,        setSaving]        = useState(false)

  const CATEGORIES  = getCategories(lang)
  const STATUS_META = getStatusMeta(T[lang as keyof typeof T] ?? T.fr)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [eqRes, sumRes] = await Promise.all([
        fetch('/api/v1/equipment',               { headers: authHeader() }),
        fetch('/api/v1/equipment/summary/stats', { headers: authHeader() }),
      ])
      if (eqRes.ok)  setItems((await eqRes.json()).items ?? [])
      if (sumRes.ok) setSummary(await sumRes.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveEquip() {
    setSaving(true)
    try {
      const body = {
        ...equipForm,
        purchasePrice:  equipForm.purchasePrice  ? Number(equipForm.purchasePrice)  : null,
        purchaseDate:   equipForm.purchaseDate   || null,
        warrantyEndsAt: equipForm.warrantyEndsAt || null,
        brand:          equipForm.brand          || null,
        serialNumber:   equipForm.serialNumber   || null,
        supplier:       equipForm.supplier       || null,
        receiptUrl:     equipForm.receiptUrl     || null,
        photoUrl:       equipForm.photoUrl       || null,
        notes:          equipForm.notes          || null,
      }
      const url    = editItem ? `/api/v1/equipment/${editItem.id}` : '/api/v1/equipment'
      const method = editItem ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowForm(false); setEditItem(null); setEquipForm({ ...EMPTY_EQUIP }); await load()
      }
    } finally { setSaving(false) }
  }

  async function deleteEquip(id: string) {
    if (!confirm(t.deleteEquipMsg)) return
    await fetch(`/api/v1/equipment/${id}`, { method: 'DELETE', headers: authHeader() })
    await load()
  }

  async function saveMaint(equipId: string) {
    const f = maintForms[equipId] ?? { ...EMPTY_MAINT }
    setSaving(true)
    try {
      const res = await fetch(`/api/v1/equipment/${equipId}/maintenance`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          cost:            f.cost          ? Number(f.cost) : 0,
          date:            f.date          || null,
          nextServiceAt:   f.nextServiceAt || null,
          technicianName:  f.technicianName  || null,
          technicianPhone: f.technicianPhone || null,
          receiptUrl:      f.receiptUrl    || null,
        }),
      })
      if (res.ok) {
        setShowMaintForm(null)
        setMaintForms(prev => ({ ...prev, [equipId]: { ...EMPTY_MAINT } }))
        await load()
      }
    } finally { setSaving(false) }
  }

  async function deleteMaint(equipId: string, recordId: string) {
    if (!confirm(t.deleteMaintMsg)) return
    await fetch(`/api/v1/equipment/${equipId}/maintenance/${recordId}`, {
      method: 'DELETE', headers: authHeader(),
    })
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={36} />
      </div>
    )
  }

  return (
    <div className={`max-w-5xl mx-auto px-4 py-8 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 ring-1 ring-blue-500/30">
            <Wrench className="text-blue-400" size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            title={t.refresh}
            className="p-2.5 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 text-slate-400 hover:text-white border border-slate-600 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => { setShowForm(true); setEditItem(null); setEquipForm({ ...EMPTY_EQUIP }) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 transition-colors"
          >
            <Plus size={15} /> {t.add}
          </button>
        </div>
      </div>

      {/* ── Summary stats ── */}
      {summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t.total,         value: summary.total,                        Icon: Package,       bg: 'bg-slate-700/60',    text: 'text-white',        border: 'border-slate-600'       },
              { label: t.activeLbl,     value: summary.active,                       Icon: CheckCircle2,  bg: 'bg-emerald-500/10',  text: 'text-emerald-400',  border: 'border-emerald-500/20'  },
              { label: t.brokenOrSAV,   value: summary.maintenance + summary.broken, Icon: AlertTriangle, bg: 'bg-amber-500/10',    text: 'text-amber-400',    border: 'border-amber-500/20'    },
              { label: t.warrantyAlert, value: summary.warrantyExpiringSoon,         Icon: Shield,        bg: 'bg-rose-500/10',     text: 'text-rose-400',     border: 'border-rose-500/20'     },
            ].map(c => (
              <div key={c.label} className={`rounded-2xl border ${c.border} ${c.bg} p-4 flex items-start gap-3`}>
                <div className={`mt-0.5 ${c.text}`}><c.Icon size={18} /></div>
                <div>
                  <p className="text-xs text-slate-400">{c.label}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${c.text}`}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/15"><CreditCard className="text-blue-400" size={18} /></div>
              <div>
                <p className="text-xs text-slate-400">{t.purchaseVal}</p>
                <p className="text-lg font-bold text-white">{summary.totalPurchaseValue.toLocaleString()} <span className="text-sm text-slate-400">MAD</span></p>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/15"><Hammer className="text-amber-400" size={18} /></div>
              <div>
                <p className="text-xs text-slate-400">{t.maintCost}</p>
                <p className="text-lg font-bold text-amber-400">{summary.totalMaintenanceCost.toLocaleString()} <span className="text-sm text-amber-500/70">MAD</span></p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Equipment form ── */}
      {showForm && (
        <div className="rounded-2xl border border-blue-500/30 bg-slate-800/80 shadow-xl shadow-blue-500/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-blue-500/10 to-violet-500/5 flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-blue-500/20"><Edit3 className="text-blue-400" size={16} /></div>
            <h2 className="text-base font-semibold text-white">{editItem ? t.editEquip : t.newEquip}</h2>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { key: 'name',           label: t.fName,          type: 'text',   Icon: Tag           },
                { key: 'brand',          label: t.fBrand,         type: 'text',   Icon: Hash          },
                { key: 'serialNumber',   label: t.fSerial,        type: 'text',   Icon: Hash          },
                { key: 'supplier',       label: t.fSupplier,      type: 'text',   Icon: Truck         },
                { key: 'purchaseDate',   label: t.fPurchaseDate,  type: 'date',   Icon: CalendarDays  },
                { key: 'purchasePrice',  label: t.fPurchasePrice, type: 'number', Icon: CreditCard    },
                { key: 'warrantyEndsAt', label: t.fWarranty,      type: 'date',   Icon: Shield        },
                { key: 'receiptUrl',     label: t.fReceiptUrl,    type: 'url',    Icon: Link2         },
              ] as { key: keyof typeof EMPTY_EQUIP; label: string; type: string; Icon: React.ElementType }[]).map(f => (
                <div key={f.key}>
                  <label className={labelCls}><f.Icon size={12} /> {f.label}</label>
                  <input
                    type={f.type}
                    value={equipForm[f.key] as string}
                    onChange={e => setEquipForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              ))}

              <div>
                <label className={labelCls}><Package size={12} /> {t.fCategory}</label>
                <select
                  value={equipForm.category}
                  onChange={e => setEquipForm(prev => ({ ...prev, category: e.target.value }))}
                  className={selectCls}
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value} className="bg-slate-800">{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}><CheckCircle2 size={12} /> {t.fStatus}</label>
                <select
                  value={equipForm.status}
                  onChange={e => setEquipForm(prev => ({ ...prev, status: e.target.value as EquipStatus }))}
                  className={selectCls}
                >
                  <option value="active"      className="bg-slate-800">{t.statusActive}</option>
                  <option value="maintenance" className="bg-slate-800">{t.statusMaint}</option>
                  <option value="broken"      className="bg-slate-800">{t.statusBroken}</option>
                  <option value="retired"     className="bg-slate-800">{t.statusRetired}</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}><StickyNote size={12} /> {t.fNotes}</label>
              <textarea
                value={equipForm.notes}
                onChange={e => setEquipForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className={inputCls}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={saveEquip}
                disabled={saving || !equipForm.name}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-colors"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                {t.save}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditItem(null) }}
                className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-sm transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Equipment list ── */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-14 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-700/60 flex items-center justify-center mb-4">
            <Wrench className="text-slate-500" size={28} />
          </div>
          <p className="text-slate-300 text-sm font-medium">{t.noEquip}</p>
          <p className="text-slate-500 text-xs mt-1">{t.noEquipSub}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const catMeta    = getCatMeta(item.category)
            const CatIcon    = catMeta.Icon
            const statusMeta = STATUS_META[item.status] ?? STATUS_META.active
            const StatusIcon = statusMeta.Icon
            const isOpen     = expanded === item.id
            const warnSoon   = isWarrantyExpiringSoon(item.warrantyEndsAt)
            const warnExp    = isWarrantyExpired(item.warrantyEndsAt)
            const mf         = maintForms[item.id] ?? { ...EMPTY_MAINT }
            const catLabel   = CATEGORIES.find(c => c.value === item.category)?.label ?? item.category

            return (
              <div key={item.id} className="rounded-2xl border border-slate-700 bg-slate-800/50 overflow-hidden hover:border-slate-600 transition-colors">

                {/* ── Row ── */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                >
                  {/* Category icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${catMeta.bg} ring-1 ${catMeta.ring}`}>
                    <CatIcon className={catMeta.text} size={18} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{item.name}</span>
                      {item.brand && <span className="text-xs text-slate-400">{item.brand}</span>}
                      <span className="text-xs text-slate-500">{catLabel}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {/* Status badge */}
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.text}`}>
                        <StatusIcon size={10} /> {statusMeta.label}
                      </span>
                      {item.purchasePrice != null && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <CreditCard size={10} /> {item.purchasePrice.toLocaleString()} MAD
                        </span>
                      )}
                      {item.warrantyEndsAt && (
                        <span className={`text-xs flex items-center gap-1 ${warnExp ? 'text-slate-500' : warnSoon ? 'text-rose-400' : 'text-slate-400'}`}>
                          <Shield size={10} />
                          {warnExp ? t.warrantyExpired : `${t.warrantyUntil} ${fmt(item.warrantyEndsAt, lang)}`}
                          {warnSoon && !warnExp && ' ⚠️'}
                        </span>
                      )}
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Hammer size={10} />
                        {item._count.maintenanceRecords} {t.interventions}{item._count.maintenanceRecords !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setEditItem(item)
                        setEquipForm({
                          name:           item.name,
                          category:       item.category,
                          brand:          item.brand          ?? '',
                          serialNumber:   item.serialNumber   ?? '',
                          purchaseDate:   item.purchaseDate   ? item.purchaseDate.slice(0, 10) : '',
                          purchasePrice:  item.purchasePrice  != null ? String(item.purchasePrice) : '',
                          supplier:       item.supplier       ?? '',
                          warrantyEndsAt: item.warrantyEndsAt ? item.warrantyEndsAt.slice(0, 10) : '',
                          receiptUrl:     item.receiptUrl     ?? '',
                          photoUrl:       item.photoUrl       ?? '',
                          status:         item.status,
                          notes:          item.notes          ?? '',
                        })
                        setShowForm(true)
                      }}
                      className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 border border-slate-600 hover:border-blue-500/30 transition-colors"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteEquip(item.id) }}
                      className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-600 hover:border-rose-500/30 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                    <div className="text-slate-500 ml-1">
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>
                </div>

                {/* ── Expanded: maintenance records ── */}
                {isOpen && (
                  <div className="border-t border-slate-700 p-4 space-y-3 bg-slate-900/40">

                    {item.maintenanceRecords.length === 0 ? (
                      <p className="text-sm text-slate-500 py-2">{t.noMaint}</p>
                    ) : (
                      <div className="space-y-2">
                        {item.maintenanceRecords.map(r => (
                          <div key={r.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 flex gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                              <Hammer className="text-amber-400" size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-white flex items-center gap-1">
                                  <CalendarDays size={10} className="text-slate-400" /> {fmt(r.date, lang)}
                                </span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.cost > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-600/50 text-slate-400'}`}>
                                  {r.cost > 0 ? `${r.cost.toLocaleString()} MAD` : t.free}
                                </span>
                                {r.technicianName  && <span className="text-xs text-slate-400 flex items-center gap-1"><User size={10} /> {r.technicianName}</span>}
                                {r.technicianPhone && <span className="text-xs text-slate-500 flex items-center gap-1"><Phone size={10} /> {r.technicianPhone}</span>}
                              </div>
                              <p className="text-sm text-slate-300 mt-1">{r.description}</p>
                              {r.nextServiceAt && (
                                <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                                  <CalendarDays size={10} /> {t.nextService}: {fmt(r.nextServiceAt, lang)}
                                </p>
                              )}
                              {r.receiptUrl && (
                                <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer"
                                   className="text-xs text-emerald-400 hover:underline mt-1 inline-flex items-center gap-1">
                                  <FileText size={10} /> {t.viewReceipt}
                                </a>
                              )}
                            </div>
                            <button
                              onClick={() => deleteMaint(item.id, r.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Maintenance form ── */}
                    {showMaintForm === item.id ? (
                      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-lg bg-amber-500/20"><Hammer className="text-amber-400" size={14} /></div>
                          <h3 className="text-sm font-semibold text-white">{t.newMaint}</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {([
                            { key: 'date',            label: t.fDate,        type: 'date',   Icon: CalendarDays },
                            { key: 'cost',            label: t.fCost,        type: 'number', Icon: CreditCard   },
                            { key: 'technicianName',  label: t.fTech,        type: 'text',   Icon: User         },
                            { key: 'technicianPhone', label: t.fTechPhone,   type: 'tel',    Icon: Phone        },
                            { key: 'nextServiceAt',   label: t.fNextService, type: 'date',   Icon: CalendarDays },
                            { key: 'receiptUrl',      label: t.fReceiptUrl,  type: 'url',    Icon: Link2        },
                          ] as { key: keyof typeof EMPTY_MAINT; label: string; type: string; Icon: React.ElementType }[]).map(f => (
                            <div key={f.key}>
                              <label className={labelCls}><f.Icon size={12} /> {f.label}</label>
                              <input
                                type={f.type}
                                value={mf[f.key]}
                                onChange={e => setMaintForms(prev => ({
                                  ...prev,
                                  [item.id]: { ...(prev[item.id] ?? EMPTY_MAINT), [f.key]: e.target.value }
                                }))}
                                className="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 transition-colors"
                              />
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className={labelCls}><FileText size={12} /> {t.fDescription}</label>
                          <textarea
                            value={mf.description}
                            onChange={e => setMaintForms(prev => ({
                              ...prev,
                              [item.id]: { ...(prev[item.id] ?? EMPTY_MAINT), description: e.target.value }
                            }))}
                            rows={2}
                            className="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 transition-colors"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveMaint(item.id)}
                            disabled={saving || !mf.description}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white text-sm font-semibold transition-colors shadow-md shadow-amber-500/20"
                          >
                            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                            {t.save}
                          </button>
                          <button
                            onClick={() => setShowMaintForm(null)}
                            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-sm transition-colors"
                          >
                            {t.cancel}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowMaintForm(item.id)}
                        className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <Plus size={14} /> {t.addMaint}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
