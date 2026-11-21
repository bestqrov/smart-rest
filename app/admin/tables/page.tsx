'use client'

import { useEffect, useRef, useState } from 'react'
import {
  QrCode, Download, Printer, Loader2, Plus, Minus,
  RefreshCw, CheckCircle, Layers, Unlink, PowerOff, Power, Pencil, X
} from 'lucide-react'
import { useLang } from '../lang-context'
import { makeBrandedQr, makeTableCard, type QrResult } from './brandedQr'

type Seat = { id: string; seatNumber: number; qrToken: string }
type TableRow = {
  id: string; tableNumber: number; zone: string | null; zoneId: string | null; isActive: boolean; qrToken: string
  capacity: number; displayType: number; isPickupCounter: boolean
  seats: Seat[]
  mergedIntoTableId: string | null
  mergedIntoTable?: { id: string; tableNumber: number } | null
  // live sessions (fetched separately)
  activeCount?: number
  vacantCount?: number
}
type ZoneOption = { id: string; name: string }

const DISPLAY_TYPE_LABELS: Record<number, string> = {
  1: '🃏 Carte', 2: '⛺ Tente', 3: '🎋 Support', 4: '🔮 Acrylique',
}

const T = {
  ar: {
    title: 'الطاولات والـ QR', refresh: 'تحديث',
    syncTitle: 'مزامنة الطاولات + QR',
    syncHint: 'يضيف الطاولات/المقاعد الناقصة ويحذف الزائدة (مع الحفاظ على الـ QR الحالية)',
    tableCount: 'عدد الطاولات', newSeats: 'مقاعد الطاولات الجديدة',
    applyAll: 'تطبيق هذا العدد على كل الطاولات الحالية أيضاً',
    sync: 'مزامنة', printQr: 'طباعة الـ QR',
    planLimit: (n: number) => `باقتك الحالية تسمح بـ ${n} طاولة كحد أقصى — رقِّ إلى الباقة الاحترافية لطاولات غير محدودة.`,
    syncFailed: 'فشل المزامنة', toggleFailed: 'فشل تغيير حالة الطاولة',
    summary: (n: number) => `${n} طاولة · QR واحد لكل طاولة (مقاعد ديناميكية) ·`,
    mergeTitle: 'دمج الطاولات (لمجموعات كبيرة)', mergeInto: 'دمج في:',
    pickMain: 'اختر الطاولة الرئيسية', merge: 'دمج', mergedNow: 'الطاولات المدمجة حالياً:', unmerge: 'فك الدمج',
    empty: 'لا توجد طاولات بعد. ابدأ بتوليد طاولاتك.',
    noZone: 'بدون منطقة', zoneCount: (n: number) => `(${n} طاولات)`,
    table: (n: number) => `طاولة ${n}`, active: 'نشطة', inactive: 'خاملة',
    mergedWith: (n: number | undefined) => `مدمجة مع T${n ?? ''}`,
    dCard: 'كارت', dTent: 'تنت', dStand: 'ستاند', dAcrylic: 'أكريليك',
    pickupHint: 'نقطة استلام (فود تراك) — رقم طلب بدل رقم طاولة',
    zone: 'المنطقة', save: 'حفظ', cancel: 'إلغاء', editHint: 'تعديل الطاقة ونوع الحامل',
    pickup: 'نقطة استلام', seats: (n: number) => `${n} مقاعد`,
    disableHint: 'تعطيل الطاولة (تصبح غير متاحة للطلب)', disable: 'تعطيل',
    enableHint: 'تفعيل الطاولة — تصبح متاحة للطلب ميدانياً', enable: 'تفعيل الطاولة',
    downloadQr: 'تحميل QR', chairs: 'عدد الكراسي:',
    scanToOrder: 'امسح الرمز للطلب', qrVerified: 'تم التحقق من قراءته', qrNoReader: 'صُمّم وفق قواعد القراءة (افتح الصفحة في Chrome للتحقق)', qrFallback: 'استُعمل تصميم أبسط لضمان القراءة',
    occupancy: (a: number, v: number | undefined) => `(${a} مشغول · ${v ?? 0} شاغر)`,
  },
  fr: {
    title: 'Tables & QR', refresh: 'Actualiser',
    syncTitle: 'Synchroniser tables + QR',
    syncHint: 'Ajoute les tables/places manquantes et supprime celles en trop (les QR existants sont conservés)',
    tableCount: 'Nombre de tables', newSeats: 'Places des nouvelles tables',
    applyAll: 'Appliquer aussi ce nombre à toutes les tables existantes',
    sync: 'Synchroniser', printQr: 'Imprimer les QR',
    planLimit: (n: number) => `Votre forfait actuel autorise ${n} tables maximum — passez au forfait Pro pour des tables illimitées.`,
    syncFailed: 'Échec de la synchronisation', toggleFailed: 'Impossible de changer le statut de la table',
    summary: (n: number) => `${n} tables · un QR par table (places dynamiques) ·`,
    mergeTitle: 'Fusionner des tables (grands groupes)', mergeInto: 'Fusionner dans :',
    pickMain: 'Choisir la table principale', merge: 'Fusionner', mergedNow: 'Tables actuellement fusionnées :', unmerge: 'Défusionner',
    empty: 'Aucune table pour le moment. Commencez par générer vos tables.',
    noZone: 'Sans zone', zoneCount: (n: number) => `(${n} tables)`,
    table: (n: number) => `Table ${n}`, active: 'Active', inactive: 'Inactive',
    mergedWith: (n: number | undefined) => `Fusionnée avec T${n ?? ''}`,
    dCard: 'Carte', dTent: 'Tente', dStand: 'Support', dAcrylic: 'Acrylique',
    pickupHint: 'Point de retrait (food truck) — numéro de commande au lieu du numéro de table',
    zone: 'Zone', save: 'Enregistrer', cancel: 'Annuler', editHint: 'Modifier la capacité et le type de support',
    pickup: 'Point de retrait', seats: (n: number) => `${n} places`,
    disableHint: 'Désactiver la table (plus disponible pour commander)', disable: 'Désactiver',
    enableHint: 'Activer la table — disponible pour commander sur place', enable: 'Activer la table',
    downloadQr: 'Télécharger le QR', chairs: 'Nombre de chaises :',
    scanToOrder: 'Scannez pour commander', qrVerified: 'Lecture vérifiée', qrNoReader: 'Conçu selon les règles de lisibilité (ouvrez dans Chrome pour vérifier)', qrFallback: 'Design simplifié utilisé pour garantir la lecture',
    occupancy: (a: number, v: number | undefined) => `(${a} occupée(s) · ${v ?? 0} libre(s))`,
  },
  en: {
    title: 'Tables & QR', refresh: 'Refresh',
    syncTitle: 'Sync tables + QR',
    syncHint: 'Adds missing tables/seats and removes extra ones (existing QR codes are kept)',
    tableCount: 'Number of tables', newSeats: 'Seats for new tables',
    applyAll: 'Also apply this number to all existing tables',
    sync: 'Sync', printQr: 'Print QR codes',
    planLimit: (n: number) => `Your current plan allows up to ${n} tables — upgrade to the Pro plan for unlimited tables.`,
    syncFailed: 'Sync failed', toggleFailed: 'Could not change the table status',
    summary: (n: number) => `${n} tables · one QR per table (dynamic seats) ·`,
    mergeTitle: 'Merge tables (for large groups)', mergeInto: 'Merge into:',
    pickMain: 'Choose the main table', merge: 'Merge', mergedNow: 'Currently merged tables:', unmerge: 'Unmerge',
    empty: 'No tables yet. Start by generating your tables.',
    noZone: 'No zone', zoneCount: (n: number) => `(${n} tables)`,
    table: (n: number) => `Table ${n}`, active: 'Active', inactive: 'Inactive',
    mergedWith: (n: number | undefined) => `Merged with T${n ?? ''}`,
    dCard: 'Card', dTent: 'Tent', dStand: 'Stand', dAcrylic: 'Acrylic',
    pickupHint: 'Pickup counter (food truck) — order number instead of table number',
    zone: 'Zone', save: 'Save', cancel: 'Cancel', editHint: 'Edit capacity and holder type',
    pickup: 'Pickup counter', seats: (n: number) => `${n} seats`,
    disableHint: 'Disable table (no longer available for ordering)', disable: 'Disable',
    enableHint: 'Enable table — becomes available for on-site ordering', enable: 'Enable table',
    downloadQr: 'Download QR', chairs: 'Chairs:',
    scanToOrder: 'Scan to order', qrVerified: 'Scan verified', qrNoReader: 'Built to scannability rules (open in Chrome to verify)', qrFallback: 'Simpler design used to guarantee scanning',
    occupancy: (a: number, v: number | undefined) => `(${a} occupied · ${v ?? 0} free)`,
  },
  es: {
    title: 'Mesas y QR', refresh: 'Actualizar',
    syncTitle: 'Sincronizar mesas + QR',
    syncHint: 'Añade las mesas/asientos que faltan y elimina los sobrantes (se conservan los QR actuales)',
    tableCount: 'Número de mesas', newSeats: 'Asientos de las mesas nuevas',
    applyAll: 'Aplicar también este número a todas las mesas existentes',
    sync: 'Sincronizar', printQr: 'Imprimir QR',
    planLimit: (n: number) => `Tu plan actual permite un máximo de ${n} mesas — mejora al plan Pro para mesas ilimitadas.`,
    syncFailed: 'Error al sincronizar', toggleFailed: 'No se pudo cambiar el estado de la mesa',
    summary: (n: number) => `${n} mesas · un QR por mesa (asientos dinámicos) ·`,
    mergeTitle: 'Unir mesas (para grupos grandes)', mergeInto: 'Unir en:',
    pickMain: 'Elige la mesa principal', merge: 'Unir', mergedNow: 'Mesas unidas actualmente:', unmerge: 'Separar',
    empty: 'Aún no hay mesas. Empieza generando tus mesas.',
    noZone: 'Sin zona', zoneCount: (n: number) => `(${n} mesas)`,
    table: (n: number) => `Mesa ${n}`, active: 'Activa', inactive: 'Inactiva',
    mergedWith: (n: number | undefined) => `Unida con T${n ?? ''}`,
    dCard: 'Tarjeta', dTent: 'Tienda', dStand: 'Soporte', dAcrylic: 'Acrílico',
    pickupHint: 'Punto de recogida (food truck) — número de pedido en lugar de número de mesa',
    zone: 'Zona', save: 'Guardar', cancel: 'Cancelar', editHint: 'Editar capacidad y tipo de soporte',
    pickup: 'Punto de recogida', seats: (n: number) => `${n} asientos`,
    disableHint: 'Desactivar mesa (deja de estar disponible para pedidos)', disable: 'Desactivar',
    enableHint: 'Activar mesa — disponible para pedidos en el local', enable: 'Activar mesa',
    downloadQr: 'Descargar QR', chairs: 'Número de sillas:',
    scanToOrder: 'Escanea para pedir', qrVerified: 'Lectura verificada', qrNoReader: 'Diseñado con reglas de legibilidad (abre en Chrome para verificar)', qrFallback: 'Se usó un diseño más simple para garantizar la lectura',
    occupancy: (a: number, v: number | undefined) => `(${a} ocupados · ${v ?? 0} libres)`,
  },
}


/**
 * Artistic "stealth" QR — data modules as orange circles, finder patterns as
 * navy rounded squares, large centre logo. Looks like a branded logo element
 * but scans fine (errorCorrectionLevel H tolerates 30% occlusion).
 */
export default function TablesPage() {
  const { lang, isRTL } = useLang()
  const t = T[lang]
  const [tables, setTables]       = useState<TableRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [tableCount, setTableCount] = useState(5)
  const [defaultCapacity, setDefaultCapacity] = useState(4)
  // Off by default: re-syncing the table count must not overwrite seats set per table.
  const [applyCapacityToAll, setApplyCapacityToAll] = useState(false)
  const [qrImages, setQrImages]   = useState<Record<string, string>>({})
  const [qrMeta, setQrMeta]       = useState<Record<string, Pick<QrResult, 'variant' | 'verified'>>>({})
  const [qrCards, setQrCards]     = useState<Record<string, string>>({})   // print/download card per table
  const [brand, setBrand]         = useState<{ color: string | null; name: string }>({ color: null, name: '' })
  const brandRef = useRef<{ color: string | null; name: string }>({ color: null, name: '' })
  const [subdomain, setSubdomain] = useState('')
  const [cafeLogoUrl, setCafeLogoUrl] = useState<string | null>(null)
  const [mergeSource, setMergeSource] = useState<string[]>([])
  const [mergeTarget, setMergeTarget] = useState<string | null>(null)
  const [syncError, setSyncError]   = useState<string | null>(null)
  const [merging, setMerging]       = useState(false)
  // Per-table inline editor state
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editCapacity, setEditCapacity] = useState(4)
  const [editDisplay,  setEditDisplay]  = useState(1)
  const [editPickup,   setEditPickup]   = useState(false)
  const [editZoneId,   setEditZoneId]   = useState<string>('')
  const [savingId, setSavingId]         = useState<string | null>(null)
  const [zones, setZones]               = useState<ZoneOption[]>([])

  function authHeader() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  function syncCountInputs(data: TableRow[]) {
    if (data.length === 0) return
    setTableCount(data.length)
    setDefaultCapacity(data[0].capacity)
  }

  async function loadTables() {
    setLoading(true)
    const r = await fetch('/api/tables', { headers: authHeader() })
    if (r.ok) {
      const data: TableRow[] = await r.json()
      setTables(data)
      syncCountInputs(data)
      await renderQrCodes(data, subdomain)
      loadSessions(data)
    }
    setLoading(false)
  }

  async function renderQrCodes(data: TableRow[], sub = subdomain, logo = cafeLogoUrl) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const b = brandRef.current
    const imgs: Record<string, string> = {}
    const meta: Record<string, Pick<QrResult, 'variant' | 'verified'>> = {}
    const cards: Record<string, string> = {}
    for (const row of data) {
      // Single QR per table — uses Table.qrToken (not per-seat)
      const url = `${origin}/${sub}/t/${row.tableNumber}?token=${row.qrToken}`
      try {
        const qr = await makeBrandedQr(url, { logoUrl: logo, color: b.color })
        imgs[row.qrToken] = qr.dataUrl
        meta[row.qrToken] = { variant: qr.variant, verified: qr.verified }
        cards[row.qrToken] = await makeTableCard(qr.dataUrl, {
          cafeName: b.name, tableLabel: t.table(row.tableNumber), cta: t.scanToOrder,
          color: b.color, logoUrl: logo, rtl: isRTL,
        })
      } catch {}
    }
    setQrImages(imgs); setQrMeta(meta); setQrCards(cards)
  }

  async function loadSessions(data: TableRow[]) {
    const updated = await Promise.all(data.map(async t => {
      try {
        const r = await fetch(`/api/admin/tables/${t.id}/sessions`, { headers: authHeader() })
        if (r.ok) {
          const s = await r.json()
          return { ...t, activeCount: s.activeCount, vacantCount: s.vacantCount }
        }
      } catch {}
      return t
    }))
    setTables(updated)
  }

  useEffect(() => {
    ;(async () => {
      const token = localStorage.getItem('token')
      const sub   = localStorage.getItem('subdomain') || ''
      setSubdomain(sub)
      setLoading(true)

      const profileRes = await fetch('/api/admin/cafe/profile', { headers: { Authorization: `Bearer ${token}` } })
      const profile = profileRes.ok ? await profileRes.json() : null
      const logo = profile?.logoUrl ?? null
      setCafeLogoUrl(logo)
      const b = { color: profile?.accentColor ?? null, name: profile?.businessName || profile?.name || '' }
      setBrand(b)
      brandRef.current = b

      const r = await fetch('/api/tables', { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) {
        const data: TableRow[] = await r.json()
        setTables(data)
        syncCountInputs(data)
        await renderQrCodes(data, sub, logo)
      }

      const zonesRes = await fetch('/api/zones', { headers: { Authorization: `Bearer ${token}` } })
      if (zonesRes.ok) {
        const zonesData = await zonesRes.json()
        setZones(zonesData.map((z: any) => ({ id: z.id, name: z.name })))
      }

      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generate() {
    setSyncError(null)
    setGenerating(true)
    const r = await fetch('/api/tables/sync', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableCount, capacity: defaultCapacity, applyCapacityToAll })
    })
    if (r.ok) {
      const data = await r.json()
      setTables(data.tables)
      await renderQrCodes(data.tables, subdomain)
      loadSessions(data.tables)
    } else {
      const body = await r.json().catch(() => ({}))
      setSyncError(body.code === 'PLAN_TABLE_LIMIT'
        ? t.planLimit(body.maxTables)
        : (body.error || t.syncFailed))
    }
    setGenerating(false)
  }

  async function saveTableEdit(tableId: string) {
    setSavingId(tableId)
    const r = await fetch(`/api/admin/tables/${tableId}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capacity: editCapacity, displayType: editDisplay, isPickupCounter: editPickup,
        zoneId: editZoneId || null,
      })
    })
    if (r.ok) {
      const updated = await r.json()
      setTables(prev => prev.map(t =>
        t.id === tableId
          ? { ...t, capacity: updated.capacity, displayType: updated.displayType, isPickupCounter: updated.isPickupCounter, zoneId: updated.zoneId, zone: updated.zone }
          : t
      ))
      setEditingId(null)
    }
    setSavingId(null)
  }

  async function handleMerge() {
    if (!mergeTarget || mergeSource.length === 0) return
    setMerging(true)
    await fetch('/api/tables/merge', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceTableIds: mergeSource, targetTableId: mergeTarget })
    })
    setMergeSource([]); setMergeTarget(null)
    await loadTables()
    setMerging(false)
  }

  async function handleUnmerge(tableId: string) {
    await fetch('/api/tables/unmerge', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetTableId: tableId })
    })
    await loadTables()
  }

  function toggleMergeSource(id: string) {
    setMergeSource(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function toggleActive(tableId: string, activate: boolean) {
    const r = await fetch(`/api/admin/tables/${tableId}/activate`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ activate })
    })
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      alert(body.error || t.toggleFailed)
      return
    }
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, isActive: activate } : t))
  }

  function printQr() {
    const w = window.open('', '_blank')!
    w.document.write(`<html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}"><head><title>QR Tables — Smart Resto</title>
    <style>
      body { margin: 0; font-family: sans-serif; background: #fff; }
      .grid { display: flex; flex-wrap: wrap; gap: 16px; padding: 20px; }
      .card { border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; text-align: center; width: 230px; break-inside: avoid; }
      .card img { width: 230px; height: auto; display: block; }
      .table { font-weight: 900; font-size: 18px; color: #064e3b; margin-top: 8px; }
      .cap { font-size: 11px; color: #6b7280; margin-top: 4px; }
      @media print { @page { margin: 8mm; } }
    </style></head><body><div class="grid">`)
    // ONE QR per table (dynamic seat assignment on scan)
    tables.forEach(row => {
      const img = qrCards[row.qrToken] || qrImages[row.qrToken] || ''
      w.document.write(`<div class="card"><img src="${img}" /></div>`)
    })
    w.document.write('</div></body></html>')
    w.document.close()
    w.print()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  )

  const mergedTableIds = new Set(tables.filter(t => t.mergedIntoTableId).map(t => t.id))

  // ── Group tables by zone, preserving first-seen order; tables without a zone go last ──
  const zoneOrder: string[] = []
  const zoneGroups = new Map<string, TableRow[]>()
  for (const t of tables) {
    const key = t.zone || ''
    if (!zoneGroups.has(key)) { zoneGroups.set(key, []); zoneOrder.push(key) }
    zoneGroups.get(key)!.push(t)
  }
  if (zoneGroups.has('')) { zoneOrder.splice(zoneOrder.indexOf(''), 1); zoneOrder.push('') }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-gray-900">{t.title}</h1>
        <button onClick={loadTables} aria-label={t.refresh} title={t.refresh} className="text-gray-400 hover:text-emerald-600 transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* ── Generate form ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-emerald-600" /> {t.syncTitle}
        </h2>
        <p className="text-xs text-gray-400 mb-4">{t.syncHint}</p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t.tableCount}</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setTableCount(c => Math.max(1, c - 1))} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600"><Minus className="w-4 h-4" /></button>
              <span className="w-8 text-center font-bold text-gray-800">{tableCount}</span>
              <button onClick={() => setTableCount(c => c + 1)} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t.newSeats}</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setDefaultCapacity(c => Math.max(1, c - 1))} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600"><Minus className="w-4 h-4" /></button>
              <span className="w-8 text-center font-bold text-gray-800">{defaultCapacity}</span>
              <button onClick={() => setDefaultCapacity(c => Math.min(20, c + 1))} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600"><Plus className="w-4 h-4" /></button>
            </div>
            <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
              <input type="checkbox" checked={applyCapacityToAll} onChange={e => setApplyCapacityToAll(e.target.checked)} />
              {t.applyAll}
            </label>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-60"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {t.sync}
          </button>
          {tables.length > 0 && (
            <button
              onClick={printQr}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 hover:border-emerald-400 hover:text-emerald-700 px-5 py-2.5 rounded-xl font-semibold transition-colors"
            >
              <Printer className="w-4 h-4" /> {t.printQr}
            </button>
          )}
        </div>
        {syncError && (
          <p className="text-xs text-red-500 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{syncError}</p>
        )}
        {tables.length > 0 && !syncError && (
          <p className="text-xs text-gray-400 mt-3">
            {t.summary(tables.length)}{' '}
            <span className="text-emerald-600 font-mono">{typeof window !== 'undefined' ? window.location.origin : ''}/{subdomain}/t/:n?token=…</span>
          </p>
        )}
      </div>

      {/* ── Table merge tool ─────────────────────────────────────── */}
      {tables.length > 1 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Layers className="w-5 h-5 text-violet-600" /> {t.mergeTitle}
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {tables.filter(t => !t.mergedIntoTableId).map(t => (
              <button
                key={t.id}
                onClick={() => toggleMergeSource(t.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  mergeSource.includes(t.id)
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'border-gray-200 text-gray-700 hover:border-violet-400'
                }`}
              >
                T{t.tableNumber}
              </button>
            ))}
          </div>
          {mergeSource.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-500">{t.mergeInto}</span>
              <select
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                value={mergeTarget || ''}
                onChange={e => setMergeTarget(e.target.value || null)}
              >
                <option value="">{t.pickMain}</option>
                {tables.filter(t => !mergeSource.includes(t.id) && !t.mergedIntoTableId).map(t => (
                  <option key={t.id} value={t.id}>T{t.tableNumber}</option>
                ))}
              </select>
              <button
                onClick={handleMerge}
                disabled={!mergeTarget || merging}
                className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : t.merge}
              </button>
            </div>
          )}
          {tables.some(t => t.mergedIntoTableId) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">{t.mergedNow}</p>
              <div className="flex flex-wrap gap-2">
                {tables.filter(m => m.mergedIntoTableId).map(m => (
                  <div key={m.id} className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-xs">
                    <span className="text-amber-800">T{m.tableNumber} → T{m.mergedIntoTable?.tableNumber}</span>
                    <button onClick={() => handleUnmerge(m.id)} className="text-amber-500 hover:text-red-500 ms-1" aria-label={t.unmerge} title={t.unmerge}>
                      <Unlink className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── QR grid ──────────────────────────────────────────────── */}
      {tables.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t.empty}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {zoneOrder.map(zoneKey => (
          <div key={zoneKey || '__none__'} className="space-y-4">
            {zoneOrder.length > 1 && (
              <h2 className="flex items-center gap-2 text-sm font-bold text-violet-700 border-b border-violet-100 pb-2">
                📍 {zoneKey || t.noZone}
                <span className="text-xs font-normal text-gray-400">{t.zoneCount(zoneGroups.get(zoneKey)!.length)}</span>
              </h2>
            )}
          {zoneGroups.get(zoneKey)!.map(table => (
            <div key={table.id} className={`rounded-2xl p-5 shadow-sm border transition-colors ${
              !table.isActive
                ? 'bg-gray-50 border-gray-200 opacity-75'
                : table.mergedIntoTableId
                  ? 'bg-amber-50/30 border-amber-200'
                  : 'bg-white border-gray-100'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-800">{t.table(table.tableNumber)}</h3>

                  {table.zone && (
                    <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-medium">
                      📍 {table.zone}
                    </span>
                  )}

                  {/* ── Activation badge ── */}
                  {table.isActive ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      <Power className="w-3 h-3" /> {t.active}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                      <PowerOff className="w-3 h-3" /> {t.inactive}
                    </span>
                  )}

                  {table.mergedIntoTableId && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      {t.mergedWith(table.mergedIntoTable?.tableNumber)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Live session count */}
                  {table.activeCount !== undefined && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      🪑 {table.activeCount}/{table.capacity}
                    </span>
                  )}

                  {/* ── Per-table capacity / displayType editor ── */}
                  {editingId === table.id ? (
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1">
                      {/* Capacity spinner */}
                      <button onClick={() => setEditCapacity(v => Math.max(1, v - 1))} className="text-gray-500 hover:text-gray-800"><Minus className="w-3 h-3" /></button>
                      <span className="w-5 text-center text-xs font-bold text-gray-800">{editCapacity}</span>
                      <button onClick={() => setEditCapacity(v => Math.min(20, v + 1))} className="text-gray-500 hover:text-gray-800"><Plus className="w-3 h-3" /></button>
                      <span className="text-gray-300 mx-0.5">|</span>
                      {/* Display type */}
                      <select
                        value={editDisplay}
                        onChange={e => setEditDisplay(Number(e.target.value))}
                        className="text-xs border-0 bg-transparent text-gray-700 focus:outline-none"
                      >
                        <option value={1}>🃏 {t.dCard}</option>
                        <option value={2}>⛺ {t.dTent}</option>
                        <option value={3}>🎋 {t.dStand}</option>
                        <option value={4}>🔮 {t.dAcrylic}</option>
                      </select>
                      <span className="text-gray-300 mx-0.5">|</span>
                      <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer" title={t.pickupHint}>
                        <input type="checkbox" checked={editPickup} onChange={e => setEditPickup(e.target.checked)} className="w-3.5 h-3.5 accent-amber-500" />
                        🚚
                      </label>
                      <span className="text-gray-300 mx-0.5">|</span>
                      {/* Zone assignment — real Zone relation, not free text */}
                      <select
                        value={editZoneId}
                        onChange={e => setEditZoneId(e.target.value)}
                        className="text-xs border-0 bg-transparent text-gray-700 focus:outline-none max-w-[100px]"
                        title={t.zone}
                      >
                        <option value="">{t.noZone}</option>
                        {zones.map(z => (
                          <option key={z.id} value={z.id}>{z.name}</option>
                        ))}
                      </select>
                      <span className="text-gray-300 mx-0.5">|</span>
                      <button
                        onClick={() => saveTableEdit(table.id)}
                        disabled={savingId === table.id}
                        className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50" aria-label={t.save} title={t.save}
                      >
                        {savingId === table.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      </button>
                      <button onClick={() => setEditingId(null)} aria-label={t.cancel} title={t.cancel} className="text-gray-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(table.id); setEditCapacity(table.capacity); setEditDisplay(table.displayType); setEditPickup(table.isPickupCounter); setEditZoneId(table.zoneId || '') }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-700 border border-gray-100 hover:border-emerald-300 px-2 py-1 rounded-lg transition-colors"
                      title={t.editHint}
                    >
                      <Pencil className="w-3 h-3" /> {table.isPickupCounter ? `🚚 ${t.pickup}` : t.seats(table.capacity)}
                    </button>
                  )}

                  {/* ── Manager activation toggle ── */}
                  {table.isActive ? (
                    <button
                      onClick={() => toggleActive(table.id, false)}
                      className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 px-3 py-1.5 rounded-lg transition-colors"
                      title={t.disableHint}
                    >
                      <PowerOff className="w-3.5 h-3.5" /> {t.disable}
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleActive(table.id, true)}
                      className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors font-semibold"
                      title={t.enableHint}
                    >
                      <Power className="w-3.5 h-3.5" /> {t.enable}
                    </button>
                  )}
                </div>
              </div>

              {/* Single QR per table — dynamic seat allocation on scan */}
              <div className={`flex items-start gap-6 ${!table.isActive ? 'pointer-events-none' : ''}`}>
                {/* QR code */}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  {qrImages[table.qrToken] ? (
                    <div className="relative">
                      <img
                        src={qrImages[table.qrToken]}
                        alt={`T${table.tableNumber}`}
                        className={`w-32 h-32 rounded-xl border-2 ${!table.isActive ? 'border-gray-200 grayscale' : 'border-emerald-100'}`}
                      />
                      {!table.isActive && (
                        <div className="absolute inset-0 rounded-xl bg-gray-100/70 flex items-center justify-center">
                          <span className="text-2xl">🔒</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-32 h-32 bg-gray-100 rounded-xl flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  )}
                  {table.isActive && qrImages[table.qrToken] && (
                    <a href={qrCards[table.qrToken] || qrImages[table.qrToken]} download={`Table-${table.tableNumber}.png`}
                      className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5">
                      <Download className="w-3 h-3" /> {t.downloadQr}
                    </a>
                  )}
                  {qrMeta[table.qrToken] && (
                    <p className={`text-[10px] text-center max-w-[9rem] leading-tight ${qrMeta[table.qrToken].verified === true && qrMeta[table.qrToken].variant === 'branded' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {qrMeta[table.qrToken].verified === null ? t.qrNoReader
                        : qrMeta[table.qrToken].variant !== 'branded' ? t.qrFallback
                        : '✓ ' + t.qrVerified}
                    </p>
                  )}
                </div>

                {/* Live seat map */}
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">
                    🪑 {t.chairs} <span className="font-bold text-gray-900">{table.capacity}</span>
                    {table.activeCount !== undefined && (
                      <span className="ms-2 text-emerald-600 font-semibold">
                        {t.occupancy(table.activeCount, table.vacantCount)}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: table.capacity }, (_, i) => {
                      const seatN = i + 1
                      const occupied = table.activeCount !== undefined && seatN <= table.activeCount
                      return (
                        <div key={seatN} className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold border
                          ${occupied ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                          {seatN}
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-300 mt-3 font-mono truncate">
                    {typeof window !== 'undefined' ? window.location.origin : ''}/{subdomain}/t/{table.tableNumber}?token={table.qrToken.slice(0,8)}…
                  </p>
                </div>
              </div>
            </div>
          ))}
          </div>
          ))}
        </div>
      )}
    </div>
  )
}
