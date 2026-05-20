'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UtensilsCrossed } from 'lucide-react'

const DEMO_ACCOUNTS = [
  { label: 'Café de la Plage 🇲🇦', email: 'plage@demo.com',  password: 'demo1234' },
  { label: 'مطعم نجد الأصيل 🇸🇦',  email: 'najd@demo.com',   password: 'demo1234' },
  { label: 'مطعم الخليج 🇦🇪',        email: 'khalij@demo.com', password: 'demo1234' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); return }
      localStorage.setItem('token',  data.token)
      localStorage.setItem('cafeId', data.cafeId)
      router.push('/admin/dashboard')
    } catch {
      setError('Network error — is the server running?')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(acc: typeof DEMO_ACCOUNTS[0]) {
    setEmail(acc.email)
    setPassword(acc.password)
    setError('')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-600 rounded-2xl mb-4">
            <UtensilsCrossed className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">SmartMenu</h1>
          <p className="text-gray-400 text-sm mt-1">لوحة تحكم المطعم</p>
        </div>

        {/* Demo accounts */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">حسابات تجريبية</p>
          {DEMO_ACCOUNTS.map(acc => (
            <button
              key={acc.email}
              onClick={() => fillDemo(acc)}
              className="w-full text-right px-3 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm transition-colors flex items-center justify-between group"
            >
              <span>{acc.label}</span>
              <span className="text-xs text-gray-500 group-hover:text-emerald-400 transition-colors">{acc.email}</span>
            </button>
          ))}
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">البريد الإلكتروني</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">كلمة المرور</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

      </div>
    </div>
  )
}
