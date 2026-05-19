'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function MagicLoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setStatus('error'); setError('رابط غير صالح'); return }

    fetch(`/api/auth/magic?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.token) {
          localStorage.setItem('token', data.token)
          localStorage.setItem('cafeId', String(data.cafeId))
          setStatus('success')
          setTimeout(() => router.push('/admin/dashboard'), 1200)
        } else {
          setStatus('error')
          setError(data.error || 'انتهت صلاحية الرابط')
        }
      })
      .catch(() => { setStatus('error'); setError('خطأ في الاتصال') })
  }, [params, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-950 px-4" dir="rtl">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-emerald-400 animate-spin mx-auto mb-4" />
            <p className="text-emerald-200 text-lg">جاري تسجيل دخولك...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-white text-xl font-bold">تم الدخول بنجاح!</p>
            <p className="text-emerald-300 mt-2">سيتم توجيهك للوحة التحكم...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <p className="text-white text-xl font-bold">رابط غير صالح</p>
            <p className="text-red-300 mt-2">{error}</p>
            <a href="/landing" className="mt-6 inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold">
              العودة للصفحة الرئيسية
            </a>
          </>
        )}
      </div>
    </div>
  )
}
