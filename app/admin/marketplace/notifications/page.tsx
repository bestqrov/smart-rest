'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Bell, CheckCircle, AlertCircle, Info, RefreshCw, Package,
  ShoppingCart, CheckCheck,
} from 'lucide-react'
import { useLang } from '../../lang-context'

interface Notification {
  id: string; level: string; title: string; message: string
  module: string; entityId?: string; read: boolean
  createdAt: string; metadata?: string
}

const T = {
  ar: {
    title: 'إشعارات المتجر', subtitle: 'تحديثات طلباتك ومشترياتك',
    noData: 'لا توجد إشعارات', loading: 'جاري التحميل...', refresh: 'تحديث',
    markRead: 'تحديد كمقروء', viewOrder: 'عرض الطلب',
    justNow: 'الآن', ago: 'منذ', minutes: 'دقيقة', hours: 'ساعة', days: 'يوم',
    unread: 'غير مقروء', all: 'الكل', read: 'المقروءة',
    LEVEL: { SUCCESS:'ناجح', INFO:'معلومات', WARNING:'تحذير', ERROR:'خطأ' } as Record<string,string>,
  },
  en: {
    title: 'Marketplace Alerts', subtitle: 'Updates on your orders and purchases',
    noData: 'No notifications yet', loading: 'Loading...', refresh: 'Refresh',
    markRead: 'Mark as read', viewOrder: 'View Order',
    justNow: 'Just now', ago: 'ago', minutes: 'min', hours: 'h', days: 'd',
    unread: 'Unread', all: 'All', read: 'Read',
    LEVEL: { SUCCESS:'Success', INFO:'Info', WARNING:'Warning', ERROR:'Error' } as Record<string,string>,
  },
}

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } }

const LEVEL_STYLE: Record<string, string> = {
  SUCCESS: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-400',
  INFO:    'bg-blue-900/30 border-blue-700/40 text-blue-400',
  WARNING: 'bg-amber-900/30 border-amber-700/40 text-amber-400',
  ERROR:   'bg-red-900/30 border-red-700/40 text-red-400',
}
const LEVEL_ICON: Record<string, any> = {
  SUCCESS: CheckCircle, INFO: Info, WARNING: AlertCircle, ERROR: AlertCircle,
}

function timeAgo(dateStr: string, t: typeof T.ar): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m    = Math.floor(diff / 60000)
  if (m < 2) return t.justNow
  if (m < 60) return `${m} ${t.minutes} ${t.ago}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ${t.hours} ${t.ago}`
  return `${Math.floor(h / 24)} ${t.days} ${t.ago}`
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-xl ${className}`} />
}

export default function NotificationsPage() {
  const { lang } = useLang()
  const t = T[lang as 'ar' | 'en'] ?? T.ar

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState<'all' | 'unread' | 'read'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/restaurant/marketplace/notifications', { headers: authHeader() })
      const data = await res.json()
      setNotifications(data.notifications ?? [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/restaurant/marketplace/notifications/${id}/read`, { method: 'PATCH', headers: authHeader() })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch {}
  }

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read)
    await Promise.all(unread.map(n => markRead(n.id)))
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read
    if (filter === 'read')   return  n.read
    return true
  })

  const unreadCount = notifications.filter(n => !n.read).length

  // Parse entityId from notification to build order link
  const orderLink = (n: Notification): string | null => {
    try {
      const meta = JSON.parse(n.metadata ?? '{}')
      if (meta.orderId) return `/admin/marketplace/orders/${meta.orderId}`
    } catch {}
    if (n.entityId) return `/admin/marketplace/orders/${n.entityId}`
    return null
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-5 h-5 text-emerald-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -end-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t.title}</h1>
            <p className="text-sm text-gray-400">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-2 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-2 rounded-xl transition-colors">
              <CheckCheck className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Filter Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-5">
        {(['all','unread','read'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f ? 'bg-emerald-700 text-white' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'}`}>
            {t[f as keyof typeof t] as string}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ms-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Notifications List ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">{[0,1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">{t.noData}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const LevelIcon = LEVEL_ICON[n.level] ?? Info
            const style     = LEVEL_STYLE[n.level] ?? LEVEL_STYLE.INFO
            const link      = orderLink(n)
            return (
              <div key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className={`border rounded-2xl p-4 transition-all ${style} ${!n.read ? 'ring-1 ring-inset ring-current/20' : 'opacity-70'} cursor-default`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-current/10 flex items-center justify-center shrink-0 mt-0.5">
                    <LevelIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {!n.read && <span className="w-2 h-2 bg-current rounded-full" />}
                        <span className="text-xs opacity-60 whitespace-nowrap">{timeAgo(n.createdAt, t)}</span>
                      </div>
                    </div>
                    <p className="text-xs opacity-80 mt-0.5">{n.message}</p>
                    {link && (
                      <Link href={link}
                        className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium hover:opacity-80 transition-opacity">
                        <ShoppingCart className="w-3 h-3" />
                        {t.viewOrder}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
