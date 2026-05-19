'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    cafeName: '',
    subdomain: '',
    email: '',
    password: '',
  })
  const [subdomainManual, setSubdomainManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!subdomainManual) {
      setForm((f) => ({ ...f, subdomain: toSlug(f.cafeName) }))
    }
  }, [form.cafeName, subdomainManual])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    if (name === 'subdomain') setSubdomainManual(true)
    setForm((f) => ({ ...f, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'حدث خطأ ما')
        return
      }
      localStorage.setItem('token', data.token)
      localStorage.setItem('cafeId', data.cafeId)
      router.push('/admin/dashboard')
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #1a3a2a 100%)',
      }}
      dir="rtl"
    >
      {/* Moroccan pattern overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M30 0l30 30-30 30L0 30z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Logo */}
      <Link href="/landing" className="mb-8 flex flex-col items-center gap-2">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
        >
          ☾
        </div>
        <span className="text-white text-2xl font-bold tracking-tight">Smart Menu</span>
        <span className="text-emerald-300 text-sm">قائمة طعام ذكية لمطعمك</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="px-8 py-6 text-center"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
        >
          <h1 className="text-2xl font-bold text-white">أنشئ حسابك مجاناً</h1>
          <p className="text-amber-100 text-sm mt-1">جاهز خلال دقيقتين</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
          {/* Restaurant Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              اسم المطعم
            </label>
            <input
              type="text"
              name="cafeName"
              value={form.cafeName}
              onChange={handleChange}
              placeholder="مطعم النجمة الذهبية"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 placeholder-gray-400 text-right"
            />
          </div>

          {/* Subdomain */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              رابط المطعم
            </label>
            <div className="flex rounded-xl overflow-hidden border border-gray-200 focus-within:ring-2 focus-within:ring-amber-400">
              <input
                type="text"
                name="subdomain"
                value={form.subdomain}
                onChange={handleChange}
                placeholder="my-restaurant"
                required
                pattern="[a-z0-9-]+"
                title="أحرف صغيرة وأرقام وشرطات فقط"
                className="flex-1 px-4 py-3 focus:outline-none text-gray-800 placeholder-gray-400 text-left min-w-0"
                dir="ltr"
              />
              <span className="flex items-center px-3 bg-gray-50 text-gray-500 text-sm border-r border-gray-200 whitespace-nowrap">
                .smartmenu.ma
              </span>
            </div>
            {form.subdomain && (
              <p className="text-xs text-emerald-600 mt-1">
                سيكون رابطك: <span dir="ltr">{form.subdomain}.smartmenu.ma</span>
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 placeholder-gray-400"
              dir="ltr"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              كلمة المرور
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="8 أحرف على الأقل"
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 placeholder-gray-400"
              dir="ltr"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white text-lg transition-all"
            style={{
              background: loading
                ? '#9ca3af'
                : 'linear-gradient(135deg, #f59e0b, #d97706)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '...' : 'إنشاء الحساب مجاناً'}
          </button>

          {/* Login link */}
          <p className="text-center text-sm text-gray-500">
            لديك حساب بالفعل؟{' '}
            <Link href="/admin/login" className="text-amber-600 font-semibold hover:underline">
              تسجيل الدخول
            </Link>
          </p>
        </form>

        {/* Trust badges */}
        <div className="border-t border-gray-100 px-8 py-4 flex justify-center gap-6 text-xs text-gray-400">
          <span>✓ بدون بطاقة بنكية</span>
          <span>✓ مجاني 30 يوماً</span>
          <span>✓ إلغاء في أي وقت</span>
        </div>
      </div>

      {/* Back link */}
      <Link href="/landing" className="mt-6 text-emerald-300 text-sm hover:text-white transition-colors">
        ← العودة للصفحة الرئيسية
      </Link>
    </div>
  )
}
