'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import {
  ArrowRight, Users, Plus, Trash2, Download, Printer,
  Loader2, CheckCircle2, QrCode, MapPin, CalendarDays,
  Phone, Upload, X, Lock, CheckCheck, TrendingUp, Wallet,
  AlertTriangle, Pencil, MessageCircle, Send
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Guest = {
  id: string; name: string; phone: string; email: string
  tableNumber: number | null; seatNumber: number | null
  dietaryReq: string; checkedIn: boolean; qrToken: string
  invitationSentAt: string | null
}

type Event = {
  id: string; name: string; type: string; date: string
  venue: string; guestCount: number; status: string
  clientName: string; clientPhone: string; clientEmail: string
  quotedPrice: number | null; depositPaid: number | null
  actualAttendees: number | null; commissionAmount: number | null
  notes: string
  invitationMessage: string
  guests: Guest[]
}

type Card = {
  guestId: string; guestName: string; phone: string
  tableNumber: number | null; seatNumber: number | null
  dietaryReq: string; checkedIn: boolean; qrUrl: string; qrToken: string
}

type MenuItem = {
  id: string; category: string; name: string; description: string; order: number
}
type EventMenu = {
  menuPackageName: string; pricePerGuest: number | null; guestCount: number; items: MenuItem[]
}

const MENU_CATEGORIES = [
  { value: 'STARTER', label: 'مقبلات' },
  { value: 'MAIN',    label: 'طبق رئيسي' },
  { value: 'DESSERT', label: 'حلويات' },
  { value: 'DRINK',   label: 'مشروبات' },
  { value: 'OTHER',   label: 'أخرى' },
] as const

type EventServiceRow = {
  id: string; name: string; details: string; vendor: string
  cost: number | null; status: string
}

type PaymentRow = {
  id: string; label: string; amount: number
  dueDate: string | null; paidDate: string | null; method: string; status: string
}

type TaskRow = {
  id: string; title: string; dueDate: string | null; done: boolean; doneAt: string | null
}

type StaffAssignmentRow = {
  id: string; role: string; notes: string
  staff: { id: string; name: string; role: string }
}
type AvailableStaff = { id: string; name: string; role: string }

const SERVICE_STATUS = [
  { value: 'NEEDED',    label: 'مطلوب',  color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'CONFIRMED', label: 'مؤكد',   color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'DONE',      label: 'تم',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
] as const

const SERVICE_SUGGESTIONS = ['ديكور', 'صوت', 'DJ', 'تصوير', 'إضاءة', 'ورود']

const EVENT_TYPES = [
  { value: 'WEDDING',   label: 'زفاف' },
  { value: 'CORPORATE', label: 'شركة' },
  { value: 'BIRTHDAY',  label: 'عيد ميلاد' },
  { value: 'REUNION',   label: 'لقاء' },
  { value: 'GALA',      label: 'حفل رسمي' },
  { value: 'OTHER',     label: 'أخرى' },
] as const

const EVENT_STATUSES = [
  { value: 'DRAFT',     label: 'مسودة' },
  { value: 'CONFIRMED', label: 'مؤكدة' },
  { value: 'ACTIVE',    label: 'جارية' },
  { value: 'COMPLETED', label: 'منتهية' },
  { value: 'CANCELLED', label: 'ملغاة' },
] as const

const DEFAULT_INVITATION_TEMPLATE =
  'مرحبا {{name}} 🎉\nمدعو/ة لحفلة {{event}} يوم {{date}} فـ {{venue}}.\nكنتسناوك!'

function toDatetimeLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة', CONFIRMED: 'مؤكدة', ACTIVE: 'جارية',
  COMPLETED: 'منتهية', CANCELLED: 'ملغاة'
}
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', CONFIRMED: 'bg-blue-50 text-blue-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700', COMPLETED: 'bg-violet-50 text-violet-700',
  CANCELLED: 'bg-red-50 text-red-500'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ar-MA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [event,    setEvent]    = useState<Event | null>(null)
  const [cards,    setCards]    = useState<Card[]>([])
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<'guests' | 'menu' | 'services' | 'payments' | 'tasks' | 'staff' | 'invitations' | 'cards' | 'finance'>('guests')

  // event menu package
  const [menu,          setMenu]          = useState<EventMenu | null>(null)
  const [packageName,   setPackageName]   = useState('')
  const [packagePrice,  setPackagePrice]  = useState('')
  const [savingPackage, setSavingPackage] = useState(false)
  const [newItemCat,    setNewItemCat]    = useState<string>('MAIN')
  const [newItemName,   setNewItemName]   = useState('')
  const [newItemDesc,   setNewItemDesc]   = useState('')
  const [addingItem,    setAddingItem]    = useState(false)

  // extra services (décor, sound, DJ...)
  const [services,       setServices]       = useState<EventServiceRow[] | null>(null)
  const [newSvcName,     setNewSvcName]     = useState('')
  const [newSvcDetails,  setNewSvcDetails]  = useState('')
  const [newSvcVendor,   setNewSvcVendor]   = useState('')
  const [newSvcCost,     setNewSvcCost]     = useState('')
  const [addingSvc,      setAddingSvc]      = useState(false)

  // payments (installments)
  const [payments,      setPayments]      = useState<PaymentRow[] | null>(null)
  const [newPayLabel,   setNewPayLabel]   = useState('')
  const [newPayAmount,  setNewPayAmount]  = useState('')
  const [newPayDue,     setNewPayDue]     = useState('')
  const [addingPay,     setAddingPay]     = useState(false)

  // tasks (checklist)
  const [tasks,         setTasks]         = useState<TaskRow[] | null>(null)
  const [newTaskTitle,  setNewTaskTitle]  = useState('')
  const [newTaskDue,    setNewTaskDue]    = useState('')
  const [addingTask,    setAddingTask]    = useState(false)

  // staff assignment
  const [staffList,       setStaffList]       = useState<StaffAssignmentRow[] | null>(null)
  const [availableStaff,  setAvailableStaff]  = useState<AvailableStaff[]>([])
  const [pickStaffId,     setPickStaffId]     = useState('')
  const [pickStaffRole,   setPickStaffRole]   = useState('')
  const [assigningStaff,  setAssigningStaff]  = useState(false)

  // invitations
  const [invMessage,     setInvMessage]     = useState('')
  const [savingInv,      setSavingInv]      = useState(false)
  const [sendingBulkInv, setSendingBulkInv] = useState(false)
  const [bulkInvResult,  setBulkInvResult]  = useState<{ total: number; sent: number; skipped: number } | null>(null)

  // add guest form
  const [showAddGuest,   setShowAddGuest]   = useState(false)
  const [addingGuest,    setAddingGuest]    = useState(false)
  const [guestName,      setGuestName]      = useState('')
  const [guestTable,     setGuestTable]     = useState('')
  const [guestSeat,      setGuestSeat]      = useState('')
  const [guestDietary,   setGuestDietary]   = useState('')
  const [guestPhone,     setGuestPhone]     = useState('')

  // bulk import
  const [bulkText,  setBulkText]  = useState('')
  const [showBulk,  setShowBulk]  = useState(false)
  const [importing, setImporting] = useState(false)

  // close event
  const [closing, setClosing] = useState(false)

  // edit event
  const [showEdit,   setShowEdit]   = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '', type: 'WEDDING', date: '', venue: '', guestCount: '', status: 'DRAFT',
    clientName: '', clientPhone: '', clientEmail: '',
    quotedPrice: '', depositPaid: '', notes: '',
  })

  const currency = typeof window !== 'undefined' ? (localStorage.getItem('currency') ?? 'MAD') : 'MAD'

  function auth() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/traiteur/events/${id}`, { headers: auth() })
    if (r.ok) {
      const data: Event = await r.json()
      setEvent(data)
    }
    setLoading(false)
  }

  async function loadCards() {
    const r = await fetch(`/api/traiteur/events/${id}/cards`, { headers: auth() })
    if (r.ok) {
      const data = await r.json()
      setCards(data.cards)
      // Generate QR images
      const imgs: Record<string, string> = {}
      for (const card of data.cards) {
        try {
          imgs[card.qrToken] = await QRCode.toDataURL(card.qrUrl, {
            width: 200, margin: 1,
            color: { dark: '#4c1d95', light: '#ffffff' }
          })
        } catch {}
      }
      setQrImages(imgs)
    }
  }

  async function loadMenu() {
    const r = await fetch(`/api/traiteur/events/${id}/menu`, { headers: auth() })
    if (r.ok) {
      const data: EventMenu = await r.json()
      setMenu(data)
      setPackageName(data.menuPackageName)
      setPackagePrice(data.pricePerGuest != null ? String(data.pricePerGuest) : '')
    }
  }

  async function loadServices() {
    const r = await fetch(`/api/traiteur/events/${id}/services`, { headers: auth() })
    if (r.ok) setServices(await r.json())
  }

  async function loadPayments() {
    const r = await fetch(`/api/traiteur/events/${id}/payments`, { headers: auth() })
    if (r.ok) setPayments(await r.json())
  }

  async function loadTasks() {
    const r = await fetch(`/api/traiteur/events/${id}/tasks`, { headers: auth() })
    if (r.ok) setTasks(await r.json())
  }

  async function loadStaff() {
    const [r1, r2] = await Promise.all([
      fetch(`/api/traiteur/events/${id}/staff`, { headers: auth() }),
      fetch(`/api/traiteur/events/${id}/staff/available`, { headers: auth() }),
    ])
    if (r1.ok) setStaffList(await r1.json())
    if (r2.ok) setAvailableStaff(await r2.json())
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (tab === 'cards' && cards.length === 0) loadCards()
    if (tab === 'menu' && menu === null) loadMenu()
    if (tab === 'services' && services === null) loadServices()
    if (tab === 'payments' && payments === null) loadPayments()
    if (tab === 'tasks' && tasks === null) loadTasks()
    if (tab === 'staff' && staffList === null) loadStaff()
    if (tab === 'invitations' && !invMessage && event) setInvMessage(event.invitationMessage || DEFAULT_INVITATION_TEMPLATE)
  }, [tab])

  async function saveInvitationTemplate() {
    setSavingInv(true)
    await fetch(`/api/traiteur/events/${id}/invitation-template`, {
      method: 'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: invMessage })
    })
    setSavingInv(false)
  }

  function renderInvitationPreview(name: string) {
    if (!event) return ''
    return invMessage
      .split('{{name}}').join(name)
      .split('{{event}}').join(event.name)
      .split('{{date}}').join(fmtDate(event.date))
      .split('{{venue}}').join(event.venue)
  }

  function waLink(guest: Guest) {
    const text = encodeURIComponent(renderInvitationPreview(guest.name))
    const phone = guest.phone.replace(/[^0-9]/g, '')
    return `https://wa.me/${phone}?text=${text}`
  }

  async function markInvitationSent(guestId: string) {
    await fetch(`/api/traiteur/events/${id}/guests/${guestId}/invitation-sent`, { method: 'POST', headers: auth() })
    await load()
  }

  async function sendBulkInvitations() {
    setSendingBulkInv(true); setBulkInvResult(null)
    await saveInvitationTemplate()
    const r = await fetch(`/api/traiteur/events/${id}/invitations/send`, {
      method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({})
    })
    if (r.ok) { setBulkInvResult(await r.json()); await load() }
    setSendingBulkInv(false)
  }

  async function addPayment() {
    if (!newPayLabel.trim() || !newPayAmount.trim()) return
    setAddingPay(true)
    const r = await fetch(`/api/traiteur/events/${id}/payments`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label:  newPayLabel.trim(),
        amount: Number(newPayAmount),
        dueDate: newPayDue || undefined,
      })
    })
    if (r.ok) { await loadPayments(); setNewPayLabel(''); setNewPayAmount(''); setNewPayDue('') }
    setAddingPay(false)
  }

  async function markPaymentPaid(paymentId: string) {
    await fetch(`/api/traiteur/events/${id}/payments/${paymentId}`, {
      method: 'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ markPaid: true })
    })
    await loadPayments()
  }

  async function deletePayment(paymentId: string) {
    if (!confirm('حذف هاد الدفعة؟')) return
    await fetch(`/api/traiteur/events/${id}/payments/${paymentId}`, { method: 'DELETE', headers: auth() })
    await loadPayments()
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return
    setAddingTask(true)
    const r = await fetch(`/api/traiteur/events/${id}/tasks`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTaskTitle.trim(), dueDate: newTaskDue || undefined })
    })
    if (r.ok) { await loadTasks(); setNewTaskTitle(''); setNewTaskDue('') }
    setAddingTask(false)
  }

  async function toggleTask(taskId: string, done: boolean) {
    await fetch(`/api/traiteur/events/${id}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ done })
    })
    await loadTasks()
  }

  async function deleteTask(taskId: string) {
    await fetch(`/api/traiteur/events/${id}/tasks/${taskId}`, { method: 'DELETE', headers: auth() })
    await loadTasks()
  }

  async function assignStaff() {
    if (!pickStaffId) return
    setAssigningStaff(true)
    const r = await fetch(`/api/traiteur/events/${id}/staff`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: pickStaffId, role: pickStaffRole.trim() })
    })
    if (r.ok) { await loadStaff(); setPickStaffId(''); setPickStaffRole('') }
    setAssigningStaff(false)
  }

  async function unassignStaff(assignmentId: string) {
    await fetch(`/api/traiteur/events/${id}/staff/${assignmentId}`, { method: 'DELETE', headers: auth() })
    await loadStaff()
  }

  async function addService() {
    if (!newSvcName.trim()) return
    setAddingSvc(true)
    const r = await fetch(`/api/traiteur/events/${id}/services`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:    newSvcName.trim(),
        details: newSvcDetails.trim(),
        vendor:  newSvcVendor.trim(),
        cost:    newSvcCost.trim() ? Number(newSvcCost) : undefined,
      })
    })
    if (r.ok) {
      await loadServices()
      setNewSvcName(''); setNewSvcDetails(''); setNewSvcVendor(''); setNewSvcCost('')
    }
    setAddingSvc(false)
  }

  async function updateServiceStatus(serviceId: string, status: string) {
    await fetch(`/api/traiteur/events/${id}/services/${serviceId}`, {
      method: 'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    await loadServices()
  }

  async function deleteService(serviceId: string) {
    if (!confirm('حذف هاد الخدمة؟')) return
    await fetch(`/api/traiteur/events/${id}/services/${serviceId}`, { method: 'DELETE', headers: auth() })
    await loadServices()
  }

  async function savePackage() {
    setSavingPackage(true)
    const r = await fetch(`/api/traiteur/events/${id}/menu`, {
      method: 'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menuPackageName: packageName,
        pricePerGuest:   packagePrice.trim() ? Number(packagePrice) : null,
      })
    })
    if (r.ok) await loadMenu()
    setSavingPackage(false)
  }

  async function addMenuItem() {
    if (!newItemName.trim()) return
    setAddingItem(true)
    const r = await fetch(`/api/traiteur/events/${id}/menu/items`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: newItemCat, name: newItemName.trim(), description: newItemDesc.trim() })
    })
    if (r.ok) { await loadMenu(); setNewItemName(''); setNewItemDesc('') }
    setAddingItem(false)
  }

  async function deleteMenuItem(itemId: string) {
    if (!confirm('حذف هذا الطبق من الباقة؟')) return
    await fetch(`/api/traiteur/events/${id}/menu/items/${itemId}`, { method: 'DELETE', headers: auth() })
    await loadMenu()
  }

  async function addGuest() {
    if (!guestName.trim()) return
    setAddingGuest(true)
    const r = await fetch(`/api/traiteur/events/${id}/guests`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        guestName.trim(),
        phone:       guestPhone,
        tableNumber: guestTable ? Number(guestTable) : undefined,
        seatNumber:  guestSeat  ? Number(guestSeat)  : undefined,
        dietaryReq:  guestDietary,
      })
    })
    if (r.ok) {
      await load()
      setGuestName(''); setGuestPhone(''); setGuestTable(''); setGuestSeat(''); setGuestDietary('')
      setShowAddGuest(false)
    }
    setAddingGuest(false)
  }

  async function deleteGuest(guestId: string) {
    if (!confirm('حذف هذا الضيف؟')) return
    await fetch(`/api/traiteur/events/${id}/guests/${guestId}`, {
      method: 'DELETE', headers: auth()
    })
    await load()
  }

  async function bulkImport() {
    const lines = bulkText.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) return
    setImporting(true)

    // Format: "Name, tableNumber, seatNumber, dietaryReq" per line
    const guests = lines.map((line, i) => {
      const parts = line.split(',').map(p => p.trim())
      return {
        name:        parts[0] || `ضيف ${i + 1}`,
        tableNumber: parts[1] ? Number(parts[1]) : undefined,
        seatNumber:  parts[2] ? Number(parts[2]) : undefined,
        dietaryReq:  parts[3] ?? '',
      }
    })

    const r = await fetch(`/api/traiteur/events/${id}/guests/bulk`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ guests })
    })
    if (r.ok) {
      await load()
      setBulkText('')
      setShowBulk(false)
    }
    setImporting(false)
  }

  function openEdit() {
    if (!event) return
    setEditForm({
      name: event.name, type: event.type, date: toDatetimeLocal(event.date),
      venue: event.venue, guestCount: String(event.guestCount), status: event.status,
      clientName: event.clientName, clientPhone: event.clientPhone, clientEmail: event.clientEmail,
      quotedPrice: event.quotedPrice != null ? String(event.quotedPrice) : '',
      depositPaid: event.depositPaid != null ? String(event.depositPaid) : '',
      notes: event.notes,
    })
    setShowEdit(true)
  }

  async function saveEdit() {
    if (!editForm.name.trim() || !editForm.date) return
    setSavingEdit(true)
    const r = await fetch(`/api/traiteur/events/${id}`, {
      method: 'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        editForm.name.trim(),
        type:        editForm.type,
        date:        new Date(editForm.date).toISOString(),
        venue:       editForm.venue.trim(),
        guestCount:  editForm.guestCount ? Number(editForm.guestCount) : 0,
        status:      editForm.status,
        clientName:  editForm.clientName.trim(),
        clientPhone: editForm.clientPhone.trim(),
        clientEmail: editForm.clientEmail.trim(),
        quotedPrice: editForm.quotedPrice.trim() ? Number(editForm.quotedPrice) : null,
        depositPaid: editForm.depositPaid.trim() ? Number(editForm.depositPaid) : null,
        notes:       editForm.notes,
      })
    })
    if (r.ok) { await load(); setShowEdit(false) }
    setSavingEdit(false)
  }

  async function closeEvent() {
    if (!confirm('إغلاق الحفلة وحساب العمولة؟')) return
    setClosing(true)
    const r = await fetch(`/api/traiteur/events/${id}/close`, {
      method: 'POST', headers: auth()
    })
    if (r.ok) await load()
    setClosing(false)
  }

  function printCards() {
    if (cards.length === 0) { alert('حمّل البطاقات أولاً'); return }
    const w = window.open('', '_blank')!
    w.document.write(`
      <html><head><title>بطاقات الضيوف — ${event?.name}</title>
      <style>
        body { margin:0; font-family: 'Cairo', sans-serif; background:#fff; direction:rtl; }
        .grid { display:flex; flex-wrap:wrap; gap:12px; padding:16px; }
        .card {
          border: 1px solid #7c3aed; border-radius:16px; padding:16px;
          width:180px; text-align:center; break-inside:avoid;
          background: linear-gradient(135deg,#f5f3ff,#fff);
        }
        .card img { width:140px; height:140px; border-radius:8px; }
        .name { font-weight:900; font-size:15px; color:#4c1d95; margin-top:8px; }
        .event { font-size:11px; color:#7c3aed; margin-top:2px; }
        .seat { font-size:11px; color:#6b7280; margin-top:4px; }
        .diet { font-size:10px; color:#d97706; margin-top:3px; background:#fef3c7; padding:2px 6px; border-radius:20px; display:inline-block; }
        @media print { @page { margin:6mm; } }
      </style></head><body>
      <div class="grid">
    `)
    cards.forEach(card => {
      const img = qrImages[card.qrToken] || ''
      w.document.write(`
        <div class="card">
          <img src="${img}" alt="${card.guestName}" />
          <div class="name">${card.guestName}</div>
          <div class="event">${event?.name}</div>
          <div class="seat">
            ${card.tableNumber ? `طاولة ${card.tableNumber}` : ''}
            ${card.seatNumber ? ` · مقعد ${card.seatNumber}` : ''}
          </div>
          ${card.dietaryReq ? `<div class="diet">${card.dietaryReq}</div>` : ''}
        </div>
      `)
    })
    w.document.write('</div></body></html>')
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 500)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  )

  if (!event) return (
    <div className="p-6 text-center text-gray-400">الحفلة غير موجودة</div>
  )

  const checkedIn = event.guests.filter(g => g.checkedIn).length

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/admin/traiteur" className="text-gray-400 hover:text-violet-600 mt-1 transition-colors">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[event.status] ?? ''}`}>
                {STATUS_LABELS[event.status]}
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-gray-900">{event.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {fmtDate(event.date)}</span>
              {event.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.venue}</span>}
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {event.guests.length} ضيف</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {checkedIn} حضر</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-violet-300 text-gray-600 hover:text-violet-700 px-3 py-2 rounded-xl font-semibold transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> تعديل
          </button>
          {event.status !== 'COMPLETED' && event.status !== 'CANCELLED' && (
            <button
              onClick={closeEvent}
              disabled={closing}
              className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-xl font-semibold disabled:opacity-60 transition-colors"
            >
              {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              إغلاق الحفلة
            </button>
          )}
        </div>
      </div>

      {/* ── Edit Event Modal ── */}
      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-3xl p-5 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900 text-lg">تعديل معلومات الحفلة</h3>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="اسم الحفلة" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <div className="grid grid-cols-2 gap-3">
                <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                  {EVENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="datetime-local" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                <input type="number" value={editForm.guestCount} onChange={e => setEditForm(f => ({ ...f, guestCount: e.target.value }))}
                  placeholder="عدد الضيوف" min="0" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <input type="text" value={editForm.venue} onChange={e => setEditForm(f => ({ ...f, venue: e.target.value }))}
                placeholder="المكان" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <div className="border-t border-gray-100 pt-3 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">معلومات الزبون</p>
                <input type="text" value={editForm.clientName} onChange={e => setEditForm(f => ({ ...f, clientName: e.target.value }))}
                  placeholder="اسم الزبون" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={editForm.clientPhone} onChange={e => setEditForm(f => ({ ...f, clientPhone: e.target.value }))}
                    placeholder="الهاتف" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  <input type="email" value={editForm.clientEmail} onChange={e => setEditForm(f => ({ ...f, clientEmail: e.target.value }))}
                    placeholder="الإيميل" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-3">
                <input type="number" value={editForm.quotedPrice} onChange={e => setEditForm(f => ({ ...f, quotedPrice: e.target.value }))}
                  placeholder={`السومة (${currency})`} min="0" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                <input type="number" value={editForm.depositPaid} onChange={e => setEditForm(f => ({ ...f, depositPaid: e.target.value }))}
                  placeholder={`العربون (${currency})`} min="0" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="ملاحظات" rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <button onClick={saveEdit} disabled={savingEdit || !editForm.name.trim() || !editForm.date}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          ['guests',   `الضيوف (${event.guests.length})`],
          ['menu',     'قائمة الحفلة'],
          ['services', 'خدمات إضافية'],
          ['payments', 'الدفعات'],
          ['tasks',    'المهام'],
          ['staff',    'الطاقم'],
          ['invitations', 'الدعوات'],
          ['cards',    'بطاقات QR'],
          ['finance',  'المالية'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tab === key ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: GUESTS */}
      {/* ══════════════════════════════════════════════ */}
      {tab === 'guests' && (
        <div className="space-y-4">

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAddGuest(!showAddGuest)}
              className="flex items-center gap-1.5 text-sm bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-xl font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> إضافة ضيف
            </button>
            <button
              onClick={() => setShowBulk(!showBulk)}
              className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-700 hover:border-violet-400 px-3 py-2 rounded-xl font-semibold transition-colors"
            >
              <Upload className="w-4 h-4" /> استيراد جماعي
            </button>
          </div>

          {/* Add guest form */}
          {showAddGuest && (
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-violet-800 text-sm">ضيف جديد</h3>
                <button onClick={() => setShowAddGuest(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={guestName}  onChange={e => setGuestName(e.target.value)}  placeholder="الاسم *" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="الهاتف"  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <input type="number" value={guestTable} onChange={e => setGuestTable(e.target.value)} placeholder="رقم الطاولة" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <input type="number" value={guestSeat}  onChange={e => setGuestSeat(e.target.value)}  placeholder="رقم المقعد"  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <input value={guestDietary} onChange={e => setGuestDietary(e.target.value)} placeholder="حمية خاصة (نباتي...)" className="col-span-2 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
              </div>
              <button
                onClick={addGuest}
                disabled={addingGuest || !guestName.trim()}
                className="flex items-center gap-1.5 text-sm bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-60 transition-colors"
              >
                {addingGuest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                إضافة
              </button>
            </div>
          )}

          {/* Bulk import */}
          {showBulk && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-amber-800 text-sm">استيراد جماعي</h3>
                <button onClick={() => setShowBulk(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <p className="text-xs text-amber-700">سطر لكل ضيف: <code className="bg-amber-100 px-1 rounded">الاسم, رقم الطاولة, رقم المقعد, حمية</code></p>
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                rows={6}
                placeholder={`يوسف إدريسي, 1, 1\nفاطمة بوزيدي, 1, 2, نباتي\nخالد العمري, 2, 1`}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-400 resize-none"
              />
              <button
                onClick={bulkImport}
                disabled={importing || !bulkText.trim()}
                className="flex items-center gap-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-60 transition-colors"
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                استيراد
              </button>
            </div>
          )}

          {/* Guest list */}
          {event.guests.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>لا يوجد ضيوف بعد</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500">الاسم</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500">الطاولة</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500">المقعد</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500">الحضور</th>
                    <th className="px-3 py-2.5 text-xs font-bold text-gray-500">الحمية</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {event.guests.map(g => (
                    <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{g.name}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{g.tableNumber ?? '—'}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{g.seatNumber ?? '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        {g.checkedIn
                          ? <CheckCheck className="w-4 h-4 text-emerald-500 mx-auto" />
                          : <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />
                        }
                      </td>
                      <td className="px-3 py-2.5 text-xs text-amber-700">
                        {g.dietaryReq || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => deleteGuest(g.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: MENU PACKAGE */}
      {/* ══════════════════════════════════════════════ */}
      {tab === 'menu' && (
        <div className="space-y-4">
          {/* Package name + price per guest */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">اسم الباقة وسعرها</p>
            <div className="flex flex-wrap gap-3">
              <input
                type="text" value={packageName} onChange={e => setPackageName(e.target.value)}
                placeholder="مثال: منيو ذهبي"
                className="flex-1 min-w-[180px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number" value={packagePrice} onChange={e => setPackagePrice(e.target.value)}
                  placeholder="السعر للفرد" min="0"
                  className="w-32 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <span className="text-xs text-gray-400">{currency} / فرد</span>
              </div>
              <button onClick={savePackage} disabled={savingPackage}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
                {savingPackage ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ'}
              </button>
            </div>
            {menu?.pricePerGuest != null && (
              <p className="text-xs text-emerald-600 font-semibold">
                التقدير الإجمالي: {(menu.pricePerGuest * menu.guestCount).toLocaleString()} {currency} ({menu.guestCount} ضيف)
              </p>
            )}
          </div>

          {/* Add course */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">إضافة طبق للباقة</p>
            <div className="flex flex-wrap gap-2">
              <select value={newItemCat} onChange={e => setNewItemCat(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                {MENU_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)}
                placeholder="اسم الطبق"
                className="flex-1 min-w-[150px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <input type="text" value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)}
                placeholder="وصف (اختياري)"
                className="flex-1 min-w-[150px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <button onClick={addMenuItem} disabled={addingItem || !newItemName.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
                {addingItem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إضافة
              </button>
            </div>
          </div>

          {/* Items grouped by category */}
          {MENU_CATEGORIES.map(cat => {
            const items = (menu?.items ?? []).filter(i => i.category === cat.value)
            if (items.length === 0) return null
            return (
              <div key={cat.value} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700">{cat.label}</div>
                <div className="divide-y divide-gray-100">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                      </div>
                      <button onClick={() => deleteMenuItem(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {menu && menu.items.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">لا توجد أطباق فهاد الباقة بعد — زيد أول طبق فوق</div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: EXTRA SERVICES (décor, sound, DJ...) */}
      {/* ══════════════════════════════════════════════ */}
      {tab === 'services' && (
        <div className="space-y-4">
          {/* Add service */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">إضافة خدمة إضافية</p>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {SERVICE_SUGGESTIONS.map(s => (
                <button key={s} type="button" onClick={() => setNewSvcName(s)}
                  className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-violet-100 hover:text-violet-700 text-gray-600 text-xs font-semibold transition-colors">
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <input type="text" value={newSvcName} onChange={e => setNewSvcName(e.target.value)}
                placeholder="نوع الخدمة (ديكور، صوت، DJ...)"
                className="flex-1 min-w-[140px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <input type="text" value={newSvcDetails} onChange={e => setNewSvcDetails(e.target.value)}
                placeholder="التفاصيل (العدد والنوع)"
                className="flex-1 min-w-[160px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <input type="text" value={newSvcVendor} onChange={e => setNewSvcVendor(e.target.value)}
                placeholder="المورد (اختياري)"
                className="w-40 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <input type="number" value={newSvcCost} onChange={e => setNewSvcCost(e.target.value)}
                placeholder={`السعر (${currency})`} min="0"
                className="w-32 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <button onClick={addService} disabled={addingSvc || !newSvcName.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
                {addingSvc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إضافة
              </button>
            </div>
          </div>

          {/* Services list */}
          {services && services.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
              {services.map(svc => {
                const st = SERVICE_STATUS.find(s => s.value === svc.status) ?? SERVICE_STATUS[0]
                return (
                  <div key={svc.id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{svc.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[svc.details, svc.vendor, svc.cost != null ? `${svc.cost.toLocaleString()} ${currency}` : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={svc.status}
                        onChange={e => updateServiceStatus(svc.id, e.target.value)}
                        className={`text-xs font-bold rounded-full border px-2.5 py-1 focus:outline-none ${st.color}`}
                      >
                        {SERVICE_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      <button onClick={() => deleteService(svc.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {services && services.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">لا توجد خدمات إضافية بعد — زيد أول خدمة فوق</div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: PAYMENTS (installment schedule) */}
      {/* ══════════════════════════════════════════════ */}
      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">إضافة دفعة</p>
            <div className="flex flex-wrap gap-2">
              <input type="text" value={newPayLabel} onChange={e => setNewPayLabel(e.target.value)}
                placeholder="عربون / دفعة وسطى / الباقي..."
                className="flex-1 min-w-[160px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <input type="number" value={newPayAmount} onChange={e => setNewPayAmount(e.target.value)}
                placeholder={`المبلغ (${currency})`} min="0"
                className="w-36 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <input type="date" value={newPayDue} onChange={e => setNewPayDue(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <button onClick={addPayment} disabled={addingPay || !newPayLabel.trim() || !newPayAmount.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
                {addingPay ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إضافة
              </button>
            </div>
          </div>

          {payments && payments.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{p.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {p.amount.toLocaleString()} {currency}
                      {p.dueDate && ` · موعدها ${new Date(p.dueDate).toLocaleDateString('ar-MA')}`}
                      {p.paidDate && ` · تأدت ${new Date(p.paidDate).toLocaleDateString('ar-MA')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.status === 'PAID' ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">تأدت</span>
                    ) : (
                      <button onClick={() => markPaymentPaid(p.id)}
                        className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                        علّمها تأدت
                      </button>
                    )}
                    <button onClick={() => deletePayment(p.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
                <span className="text-xs font-bold text-gray-500">المجموع</span>
                <div className="text-xs font-bold text-gray-700 flex gap-3">
                  <span>تأدى: {payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0).toLocaleString()} {currency}</span>
                  <span>الباقي: {payments.filter(p => p.status !== 'PAID').reduce((s, p) => s + p.amount, 0).toLocaleString()} {currency}</span>
                </div>
              </div>
            </div>
          )}
          {payments && payments.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">لا توجد دفعات مسجلة بعد — زيد أول دفعة فوق</div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: TASKS (checklist) */}
      {/* ══════════════════════════════════════════════ */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">إضافة مهمة</p>
            <div className="flex flex-wrap gap-2">
              <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="مثال: موعد التذوق، آخر أجل لتأكيد العدد..."
                className="flex-1 min-w-[180px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <button onClick={addTask} disabled={addingTask || !newTaskTitle.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
                {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إضافة
              </button>
            </div>
          </div>

          {tasks && tasks.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleTask(t.id, !t.done)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      t.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-violet-400'
                    }`}>
                    {t.done && <CheckCheck className="w-3.5 h-3.5 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${t.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{t.title}</p>
                    {t.dueDate && <p className="text-xs text-gray-400 mt-0.5">موعدها {new Date(t.dueDate).toLocaleDateString('ar-MA')}</p>}
                  </div>
                  <button onClick={() => deleteTask(t.id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {tasks && tasks.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">لا توجد مهام بعد — زيد أول مهمة فوق</div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: STAFF ASSIGNMENT */}
      {/* ══════════════════════════════════════════════ */}
      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">تعيين موظف للحفلة</p>
            <div className="flex flex-wrap gap-2">
              <select value={pickStaffId} onChange={e => setPickStaffId(e.target.value)}
                className="flex-1 min-w-[160px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                <option value="">اختر موظف...</option>
                {availableStaff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
              </select>
              <input type="text" value={pickStaffRole} onChange={e => setPickStaffRole(e.target.value)}
                placeholder="دوره فهاد الحفلة (اختياري)"
                className="flex-1 min-w-[160px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <button onClick={assignStaff} disabled={assigningStaff || !pickStaffId}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
                {assigningStaff ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} تعيين
              </button>
            </div>
            {availableStaff.length === 0 && (
              <p className="text-xs text-gray-400">كل الموظفين معينين ديجا، أو ماكاينش موظفين نشيطين.</p>
            )}
          </div>

          {staffList && staffList.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
              {staffList.map(a => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{a.staff.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.role || a.staff.role}</p>
                  </div>
                  <button onClick={() => unassignStaff(a.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {staffList && staffList.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">ماكاين حتى موظف معين لهاد الحفلة بعد</div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: INVITATIONS */}
      {/* ══════════════════════════════════════════════ */}
      {tab === 'invitations' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">نص الدعوة</p>
            <textarea value={invMessage} onChange={e => setInvMessage(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            <p className="text-[10px] text-gray-400">متاح: {'{{name}} {{event}} {{date}} {{venue}}'}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={saveInvitationTemplate} disabled={savingInv}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
                {savingInv ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ النص'}
              </button>
              <button onClick={sendBulkInvitations} disabled={sendingBulkInv || !invMessage.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
                {sendingBulkInv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                إرسال أوتوماتيكي للكل
              </button>
            </div>
            {bulkInvResult && (
              <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                من مجموع {bulkInvResult.total}: تصيفطات {bulkInvResult.sent} · ما تصيفطاتش {bulkInvResult.skipped}
                {bulkInvResult.skipped > 0 && ' (تأكد بلي WhatsApp متصل، أو صيفط يدوياً بالأزرار تحت)'}
              </p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {event.guests.filter(g => g.phone).map(g => (
              <div key={g.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{g.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{g.phone}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {g.invitationSentAt ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">تصيفطات</span>
                  ) : (
                    <a href={waLink(g)} target="_blank" rel="noopener noreferrer"
                      onClick={() => markInvitationSent(g.id)}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                      <MessageCircle className="w-3.5 h-3.5" /> فتح واتساب
                    </a>
                  )}
                </div>
              </div>
            ))}
            {event.guests.filter(g => g.phone).length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">ماكاين حتى ضيف عندو رقم هاتف بعد</div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: QR CARDS */}
      {/* ══════════════════════════════════════════════ */}
      {tab === 'cards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {cards.length} بطاقة · اطبعها وضعها على كل مقعد
            </p>
            <div className="flex gap-2">
              <button
                onClick={loadCards}
                className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 hover:border-violet-400 px-3 py-1.5 rounded-xl font-semibold transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" /> تحديث
              </button>
              <button
                onClick={printCards}
                className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-xl font-semibold transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> طباعة الكل
              </button>
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <QrCode className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>أضف ضيوفاً أولاً ثم حمّل البطاقات</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {cards.map(card => (
                <div key={card.guestId} className={`rounded-2xl border p-4 text-center transition-all ${
                  card.checkedIn ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100 hover:border-violet-200'
                }`}>
                  {qrImages[card.qrToken] ? (
                    <img src={qrImages[card.qrToken]} alt={card.guestName} className="w-full rounded-xl mb-3" />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 rounded-xl mb-3 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  )}
                  <p className="font-bold text-gray-900 text-xs leading-tight truncate">{card.guestName}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {card.tableNumber ? `ط${card.tableNumber}` : ''}
                    {card.seatNumber  ? ` · م${card.seatNumber}` : ''}
                  </p>
                  {card.dietaryReq && (
                    <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                      {card.dietaryReq}
                    </span>
                  )}
                  {card.checkedIn && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full mt-1 inline-flex items-center gap-0.5 mx-auto">
                      <CheckCheck className="w-2.5 h-2.5" /> حضر
                    </span>
                  )}
                  {qrImages[card.qrToken] && (
                    <a
                      href={qrImages[card.qrToken]}
                      download={`${card.guestName}.png`}
                      className="mt-2 text-[10px] text-violet-600 hover:text-violet-800 flex items-center gap-0.5 justify-center"
                    >
                      <Download className="w-2.5 h-2.5" /> تحميل
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: FINANCE */}
      {/* ══════════════════════════════════════════════ */}
      {tab === 'finance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-500" /> المبالغ
              </h3>
              {[
                ['سعر العرض الإجمالي', event.quotedPrice],
                ['العربون المستلم',    event.depositPaid],
                ['الرصيد المتبقي',
                  event.quotedPrice && event.depositPaid
                    ? event.quotedPrice - event.depositPaid
                    : null
                ],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-bold text-gray-800">
                    {val !== null ? `${Number(val).toLocaleString()} ${currency}` : '—'}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-violet-50 rounded-2xl border border-violet-200 p-5 space-y-3">
              <h3 className="font-bold text-violet-800 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-600" /> عمولة SmartTraiteur
              </h3>
              {event.status === 'COMPLETED' ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-violet-600">الحضور الفعلي</span>
                    <span className="font-bold text-violet-800">{event.actualAttendees ?? 0} ضيف</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-violet-600">العمولة المحسوبة</span>
                    <span className="font-bold text-violet-800 text-base">
                      {event.commissionAmount?.toLocaleString() ?? 0} {currency}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-violet-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span>تُحسب العمولة عند إغلاق الحفلة</span>
                </div>
              )}
            </div>

          </div>

          {event.clientName && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
              <h3 className="font-bold text-gray-800 text-sm">العميل</h3>
              <p className="text-sm text-gray-700 font-semibold">{event.clientName}</p>
              {event.clientPhone && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {event.clientPhone}
                </p>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
