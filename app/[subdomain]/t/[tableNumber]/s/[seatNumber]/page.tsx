'use client'
/**
 * Legacy per-seat QR (/<sub>/t/<n>/s/<seat>?token=<seatToken>).
 * Tables now use ONE QR each and seats are assigned at scan time. Old printed
 * seat stickers still work: we look up the seat's table and forward the guest
 * to the table page, so they get seat assignment, seat release at checkout,
 * waiter calls and the current menu UI. (The old 1.4k-line seat page lives in
 * git history.)
 */

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function Redirector() {
  const params = useSearchParams()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const token = params.get('token') ?? ''
    if (!token) { setFailed(true); return }
    fetch(`/api/public/seat-redirect?token=${encodeURIComponent(token)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.tableToken) { setFailed(true); return }
        window.location.replace(`/${d.subdomain}/t/${d.tableNumber}?token=${encodeURIComponent(d.tableToken)}`)
      })
      .catch(() => setFailed(true))
  }, [params])

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 text-center">
      {failed ? (
        <div className="space-y-2 max-w-xs">
          <p className="text-lg font-bold">رمز QR غير صالح</p>
          <p className="text-sm text-zinc-400">امسح رمز QR الموجود على طاولتك، أو اطلب المساعدة من أحد الموظفين.</p>
          <p className="text-xs text-zinc-500" dir="ltr">Invalid QR — please scan the QR on your table or ask a staff member.</p>
        </div>
      ) : (
        <div className="w-10 h-10 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" aria-label="Loading" />
      )}
    </main>
  )
}

export default function LegacySeatQrPage() {
  return <Suspense fallback={null}><Redirector /></Suspense>
}
