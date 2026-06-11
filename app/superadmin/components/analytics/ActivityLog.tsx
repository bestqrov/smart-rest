'use client'
import { useEffect, useState } from 'react'

const KEY     = 'superadmin-activity-log'
const MAX_LOG = 100

export interface ActivityEntry {
  action:     string
  tenantName: string
  timestamp:  string
}

export function logActivity(action: string, tenantName: string) {
  try {
    const existing: ActivityEntry[] = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    const entry: ActivityEntry = {
      action,
      tenantName,
      timestamp: new Date().toISOString(),
    }
    const updated = [entry, ...existing].slice(0, MAX_LOG)
    localStorage.setItem(KEY, JSON.stringify(updated))
  } catch {}
}

export default function ActivityLog() {
  const [entries,  setEntries]  = useState<ActivityEntry[]>([])
  const [open,     setOpen]     = useState(false)

  useEffect(() => {
    try {
      setEntries(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
    } catch {}
  }, [open])

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-800/40 transition-colors text-sm"
      >
        <div className="flex items-center gap-2">
          <span>🗂</span>
          <span className="text-gray-400 font-bold">سجل النشاط</span>
          {entries.length > 0 && (
            <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full font-bold">
              {entries.length}
            </span>
          )}
        </div>
        <span className="text-gray-600">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800 max-h-56 overflow-y-auto divide-y divide-gray-800/50">
          {entries.length === 0 ? (
            <p className="text-center py-6 text-gray-600 text-sm">لا يوجد نشاط بعد</p>
          ) : (
            entries.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <span className="text-white text-xs font-medium">{e.action}</span>
                  <span className="text-gray-500 text-xs mr-1.5">· {e.tenantName}</span>
                </div>
                <span className="text-gray-700 text-[10px]">
                  {new Date(e.timestamp).toLocaleString('ar-MA', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
