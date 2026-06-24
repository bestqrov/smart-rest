# SuperAdmin — Plan 2: Management Features

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-tenant notes (stored in DB), send-message (email via Resend + in-app), impersonation UI (backend already exists), and export CSV functionality to the superadmin dashboard.

**Architecture:** New Prisma models (`SuperAdminNote`) + new Express routes in `src/routes/superadmin.ts` + new React components passed as props through the existing theme system from Plan 1. All management features are accessible from the tenant row action buttons and from the `TenantModal`.

**Tech Stack:** Next.js 14, Express.js (`src/routes/superadmin.ts`), Prisma (MongoDB), Resend email API, JWT (for impersonation), Tailwind CSS

**Pre-requisite:** Plan 1 must be complete (types.ts, ThemeProps, page.tsx refactored).

---

## File Map

**Create:**
- `app/superadmin/components/shared/TenantNotes.tsx` — notes panel (list + add + delete)
- `app/superadmin/components/shared/SendMessage.tsx` — send email or in-app message modal
- `app/superadmin/components/shared/ImpersonateButton.tsx` — "login as tenant" button + logic
- `app/superadmin/components/shared/ExportCSV.tsx` — export filtered tenants to CSV file

**Modify:**
- `prisma/schema.prisma` — add `SuperAdminNote` model + `Notification` model (if not present)
- `src/routes/superadmin.ts` — add notes CRUD, send-message, export routes
- `app/superadmin/components/types.ts` — extend `ThemeProps` with management callbacks
- `app/superadmin/components/themes/ThemeA.tsx` — wire new action buttons into tenant rows

---

## Task 1 — Prisma: SuperAdminNote Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] Open `prisma/schema.prisma` and add the following model after the `Cafe` model block (or at the end of the file, before closing):

```prisma
model SuperAdminNote {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  cafeId    String   @db.ObjectId
  cafe      Cafe     @relation(fields: [cafeId], references: [id], onDelete: Cascade)
  body      String
  createdAt DateTime @default(now())
}
```

- [ ] Add the reverse relation to the `Cafe` model (find `model Cafe {` and add the line):

```prisma
  superAdminNotes SuperAdminNote[]
```

- [ ] Check if a `Notification` model already exists:

```bash
grep -n "model Notification" prisma/schema.prisma
```

If it does NOT exist, add it:

```prisma
model Notification {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  cafeId    String   @db.ObjectId
  cafe      Cafe     @relation(fields: [cafeId], references: [id], onDelete: Cascade)
  type      String   @default("MESSAGE")
  title     String
  body      String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

And add to `Cafe` model:

```prisma
  notifications Notification[]
```

- [ ] Run Prisma generate (MongoDB does not need migrations):

```bash
npx prisma generate
```

Expected output: `✔ Generated Prisma Client`

- [ ] Commit:

```bash
git add prisma/schema.prisma
git commit -m "feat(superadmin): add SuperAdminNote + Notification models"
```

---

## Task 2 — Backend: Notes CRUD Routes

**Files:**
- Modify: `src/routes/superadmin.ts`

- [ ] Add the following 3 routes to `src/routes/superadmin.ts` **before** the `export default router` line:

```typescript
// ─── GET /api/superadmin/tenants/:id/notes ────────────────────────────────────
router.get('/api/superadmin/tenants/:id/notes', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const notes = await prisma.superAdminNote.findMany({
      where:   { cafeId: req.params.id },
      orderBy: { createdAt: 'desc' },
    })
    return res.json(notes)
  } catch (err) {
    logger.error({ msg: 'GET notes error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── POST /api/superadmin/tenants/:id/notes ───────────────────────────────────
router.post('/api/superadmin/tenants/:id/notes', requireSuperAdmin, async (req: Request, res: Response) => {
  const { body } = req.body
  if (!body?.trim()) return res.status(400).json({ error: 'body required' })
  try {
    const note = await prisma.superAdminNote.create({
      data: { cafeId: req.params.id, body: body.trim() },
    })
    return res.status(201).json(note)
  } catch (err) {
    logger.error({ msg: 'POST notes error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── DELETE /api/superadmin/tenants/:id/notes/:noteId ─────────────────────────
router.delete('/api/superadmin/tenants/:id/notes/:noteId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.superAdminNote.delete({ where: { id: req.params.noteId } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'DELETE note error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})
```

- [ ] Restart the backend:

```bash
# Ctrl+C in the backend terminal, then:
npm run dev
```

- [ ] Verify notes routes work. First get a real `cafeId` from the DB, then:

```bash
CAFE_ID="<paste a cafeId from /api/superadmin/tenants/rich>"
SECRET=$(grep SUPERADMIN_SECRET .env | cut -d= -f2)
EMAIL=$(grep SUPERADMIN_EMAIL .env | cut -d= -f2)

# Create a note
curl -s -X POST "http://localhost:4000/api/superadmin/tenants/$CAFE_ID/notes" \
  -H "x-superadmin-secret: $SECRET" \
  -H "x-superadmin-email: $EMAIL" \
  -H "Content-Type: application/json" \
  -d '{"body":"Test note from plan"}'
# Expected: { "id": "...", "cafeId": "...", "body": "Test note from plan", "createdAt": "..." }

# List notes
curl -s "http://localhost:4000/api/superadmin/tenants/$CAFE_ID/notes" \
  -H "x-superadmin-secret: $SECRET" -H "x-superadmin-email: $EMAIL"
# Expected: array with 1 note
```

- [ ] Commit:

```bash
git add src/routes/superadmin.ts
git commit -m "feat(superadmin): add notes CRUD routes"
```

---

## Task 3 — Backend: Send-Message Route

**Files:**
- Modify: `src/routes/superadmin.ts`

This route sends either an email (via Resend) or an in-app notification (via the `Notification` model).

- [ ] Add the following route to `src/routes/superadmin.ts` **before** `export default router`:

```typescript
// ─── POST /api/superadmin/tenants/:id/message ─────────────────────────────────
router.post('/api/superadmin/tenants/:id/message', requireSuperAdmin, async (req: Request, res: Response) => {
  const { subject, body, channel } = req.body
  // channel: 'email' | 'inapp' | 'both'
  if (!body?.trim() || !channel) return res.status(400).json({ error: 'body + channel required' })

  try {
    const cafe = await prisma.cafe.findUnique({
      where:   { id: req.params.id },
      include: { staff: { where: { role: 'admin' }, take: 1 } },
    })
    if (!cafe) return res.status(404).json({ error: 'Cafe not found' })

    const adminEmail = cafe.staff[0]?.email
    const results: Record<string, any> = {}

    if ((channel === 'email' || channel === 'both') && adminEmail) {
      const resp = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    process.env.RESEND_FROM ?? 'Smart Resto <noreply@smartrestau.com>',
          to:      [adminEmail],
          subject: subject?.trim() || 'رسالة من Smart Resto',
          html:    `<div dir="rtl" style="font-family:sans-serif;padding:20px">${body.replace(/\n/g,'<br>')}</div>`,
        }),
      })
      results.email = resp.ok ? 'sent' : 'failed'
    }

    if (channel === 'inapp' || channel === 'both') {
      await prisma.notification.create({
        data: {
          cafeId: req.params.id,
          type:   'MESSAGE',
          title:  subject?.trim() || 'رسالة جديدة',
          body:   body.trim(),
        },
      })
      results.inapp = 'created'
    }

    return res.json({ ok: true, results })
  } catch (err) {
    logger.error({ msg: 'POST message error', err })
    return res.status(500).json({ error: 'Failed' })
  }
})
```

- [ ] Restart backend and verify:

```bash
SECRET=$(grep SUPERADMIN_SECRET .env | cut -d= -f2)
EMAIL=$(grep SUPERADMIN_EMAIL .env | cut -d= -f2)
CAFE_ID="<paste real cafeId>"

curl -s -X POST "http://localhost:4000/api/superadmin/tenants/$CAFE_ID/message" \
  -H "x-superadmin-secret: $SECRET" \
  -H "x-superadmin-email: $EMAIL" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test","body":"Hello from admin","channel":"inapp"}'
# Expected: { "ok": true, "results": { "inapp": "created" } }
```

- [ ] Commit:

```bash
git add src/routes/superadmin.ts
git commit -m "feat(superadmin): add send-message route (email + in-app)"
```

---

## Task 4 — TenantNotes Component

**Files:**
- Create: `app/superadmin/components/shared/TenantNotes.tsx`

- [ ] Create the component:

```tsx
// app/superadmin/components/shared/TenantNotes.tsx
'use client'
import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'

interface Note {
  id:        string
  body:      string
  createdAt: string
}

interface Props {
  cafeId:      string
  superHeader: () => Record<string, string>
}

export default function TenantNotes({ cafeId, superHeader }: Props) {
  const [notes,   setNotes]   = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [body,    setBody]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch(`/api/superadmin/tenants/${cafeId}/notes`, { headers: superHeader() })
      .then(r => r.json())
      .then(setNotes)
      .catch(() => setError('فشل تحميل الملاحظات'))
      .finally(() => setLoading(false))
  }, [cafeId])

  async function addNote() {
    if (!body.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/superadmin/tenants/${cafeId}/notes`, {
        method:  'POST',
        headers: { ...superHeader(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error('Failed')
      const note = await res.json()
      setNotes(prev => [note, ...prev])
      setBody('')
    } catch {
      setError('فشل إضافة الملاحظة')
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote(id: string) {
    try {
      await fetch(`/api/superadmin/tenants/${cafeId}/notes/${id}`, {
        method:  'DELETE',
        headers: superHeader(),
      })
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch {
      setError('فشل حذف الملاحظة')
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {error && <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl px-3 py-2">{error}</p>}

      {/* Add note */}
      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="ملاحظة جديدة…"
          rows={2}
          className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500 resize-none"
        />
        <button
          onClick={addNote}
          disabled={saving || !body.trim()}
          className="self-end flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          إضافة
        </button>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
      ) : notes.length === 0 ? (
        <p className="text-center text-gray-600 text-sm py-4">لا توجد ملاحظات بعد</p>
      ) : (
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {notes.map(n => (
            <div key={n.id} className="flex items-start gap-2 bg-gray-800/50 rounded-xl px-3 py-3 group">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm whitespace-pre-wrap">{n.body}</p>
                <p className="text-gray-600 text-[10px] mt-1">
                  {new Date(n.createdAt).toLocaleString('ar-MA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={() => deleteNote(n.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] Commit:

```bash
git add app/superadmin/components/shared/TenantNotes.tsx
git commit -m "feat(superadmin): add TenantNotes component"
```

---

## Task 5 — SendMessage Component

**Files:**
- Create: `app/superadmin/components/shared/SendMessage.tsx`

- [ ] Create the component:

```tsx
// app/superadmin/components/shared/SendMessage.tsx
'use client'
import { useState } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import type { Tenant } from '../types'

interface Props {
  tenant:      Tenant
  superHeader: () => Record<string, string>
  onClose:     () => void
}

type Channel = 'email' | 'inapp' | 'both'

export default function SendMessage({ tenant, superHeader, onClose }: Props) {
  const [subject,  setSubject]  = useState('')
  const [body,     setBody]     = useState('')
  const [channel,  setChannel]  = useState<Channel>('inapp')
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState('')

  async function send() {
    if (!body.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}/message`, {
        method:  'POST',
        headers: { ...superHeader(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subject, body, channel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setSuccess(true)
    } catch (e: any) {
      setError(e.message ?? 'فشل الإرسال')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h3 className="text-white font-extrabold text-base">رسالة إلى {tenant.businessName || tenant.name}</h3>
            <p className="text-gray-500 text-xs mt-0.5">{tenant.subdomain}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {success ? (
          <div className="p-6 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <p className="text-emerald-400 font-bold">تم الإرسال بنجاح!</p>
            <button onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-xl text-sm font-bold">إغلاق</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {error && <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl px-3 py-2">{error}</p>}

            {/* Channel */}
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">القناة</p>
              <div className="flex gap-2">
                {([
                  { v: 'inapp', label: '🔔 In-App' },
                  { v: 'email', label: '📧 Email' },
                  { v: 'both',  label: '📡 كلاهما' },
                ] as { v: Channel; label: string }[]).map(c => (
                  <button key={c.v} onClick={() => setChannel(c.v)}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                      channel === c.v ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">الموضوع (اختياري)</p>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="رسالة من Smart Resto"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Body */}
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">الرسالة</p>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="اكتب رسالتك هنا…"
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm font-semibold">
                إلغاء
              </button>
              <button onClick={send} disabled={loading || !body.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                إرسال
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] Commit:

```bash
git add app/superadmin/components/shared/SendMessage.tsx
git commit -m "feat(superadmin): add SendMessage component"
```

---

## Task 6 — ImpersonateButton Component

The backend impersonation route already exists at `POST /api/superadmin/tenants/:id/impersonate`.
It returns a short-lived JWT with `{ token }`.

- [ ] Create `app/superadmin/components/shared/ImpersonateButton.tsx`:

```tsx
// app/superadmin/components/shared/ImpersonateButton.tsx
'use client'
import { useState } from 'react'
import { Loader2, LogIn } from 'lucide-react'
import type { Tenant } from '../types'

interface Props {
  tenant:      Tenant
  superHeader: () => Record<string, string>
}

export default function ImpersonateButton({ tenant, superHeader }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function impersonate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}/impersonate`, {
        method:  'POST',
        headers: superHeader(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')

      // Open a new tab with the impersonation token injected
      const url = new URL('/admin/dashboard', window.location.origin)
      const w = window.open('about:blank', '_blank')
      if (!w) throw new Error('Popup blocked — allow popups for this site')

      w.document.write(`
        <script>
          localStorage.setItem('token', ${JSON.stringify(data.token)});
          localStorage.setItem('cafeId', ${JSON.stringify(tenant.id)});
          localStorage.setItem('subdomain', ${JSON.stringify(tenant.subdomain)});
          localStorage.setItem('impersonated', '1');
          window.location.href = '/admin/dashboard';
        </script>
      `)
      w.document.close()
    } catch (e: any) {
      setError(e.message ?? 'فشل الدخول')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={impersonate}
        disabled={loading}
        title={`الدخول كـ ${tenant.businessName || tenant.name}`}
        className="flex items-center gap-1.5 bg-violet-900/50 hover:bg-violet-800 disabled:opacity-40 text-violet-300 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors border border-violet-700/50"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
        ادخل كـ
      </button>
      {error && <p className="text-red-400 text-[10px]">{error}</p>}
    </div>
  )
}
```

- [ ] Commit:

```bash
git add app/superadmin/components/shared/ImpersonateButton.tsx
git commit -m "feat(superadmin): add ImpersonateButton component"
```

---

## Task 7 — ExportCSV Component

Pure frontend — no backend needed.

- [ ] Create `app/superadmin/components/shared/ExportCSV.tsx`:

```tsx
// app/superadmin/components/shared/ExportCSV.tsx
'use client'
import { Download } from 'lucide-react'
import type { Tenant } from '../types'

interface Props {
  tenants:       Tenant[]
  filterCountry: string
  filterStatus:  string
}

export default function ExportCSV({ tenants, filterCountry, filterStatus }: Props) {
  function downloadCSV() {
    const headers = ['Name', 'Subdomain', 'Country', 'Currency', 'Status', 'Tier', 'Balance', 'Monthly Fee', 'Trial Ends', 'Demo', 'Weekly Orders']

    const rows = tenants.map(t => [
      t.businessName || t.name,
      t.subdomain,
      t.country,
      t.currency,
      t.billingStatus,
      t.subscriptionTier ?? '',
      Number(t.walletBalance).toFixed(2),
      t.monthlyFee?.toString() ?? '',
      t.trialEndsAt ? new Date(t.trialEndsAt).toISOString().split('T')[0] : '',
      t.isDemo ? 'Yes' : 'No',
      (t.weeklyOrderCount ?? t._count.orders).toString(),
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `tenants-${filterCountry || 'all'}-${filterStatus || 'all'}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={downloadCSV}
      title={`تصدير ${tenants.length} مطعم`}
      className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
    >
      <Download className="w-4 h-4" />
      تصدير CSV ({tenants.length})
    </button>
  )
}
```

- [ ] Commit:

```bash
git add app/superadmin/components/shared/ExportCSV.tsx
git commit -m "feat(superadmin): add ExportCSV component"
```

---

## Task 8 — Wire Management Features into Themes

**Files:**
- Modify: `app/superadmin/components/types.ts` — add `superHeader` to ThemeProps
- Modify: `app/superadmin/page.tsx` — pass `superHeader` in themeProps
- Modify: `app/superadmin/components/themes/ThemeA.tsx` — add Impersonate, SendMessage, Notes buttons

### Step 8a — Add superHeader to ThemeProps

- [ ] In `app/superadmin/components/types.ts`, add to the `ThemeProps` interface:

```typescript
  superHeader: () => Record<string, string>
```

### Step 8b — Pass superHeader in page.tsx

- [ ] In `app/superadmin/page.tsx`, inside the `themeProps` object, add:

```typescript
    superHeader,
```

### Step 8c — Add buttons to ThemeA

- [ ] In `app/superadmin/components/themes/ThemeA.tsx`, add these imports:

```typescript
import ImpersonateButton from '../shared/ImpersonateButton'
import SendMessage from '../shared/SendMessage'
import TenantNotes from '../shared/TenantNotes'
import ExportCSV from '../shared/ExportCSV'
```

- [ ] Add state inside ThemeA:

```typescript
const [msgTarget,   setMsgTarget]   = useState<Tenant | null>(null)
const [notesTarget, setNotesTarget] = useState<Tenant | null>(null)
```

- [ ] In the header actions section, add ExportCSV alongside the existing buttons:

```tsx
<ExportCSV tenants={p.tenants} filterCountry={p.filterCountry} filterStatus={p.filterStatus} />
```

- [ ] In the tenant row actions `<div>` (where RowBtn components are), add:

```tsx
<ImpersonateButton tenant={t} superHeader={p.superHeader} />
<button onClick={() => setMsgTarget(t)} className="flex items-center gap-1 bg-sky-900/50 hover:bg-sky-800 text-sky-300 px-2.5 py-1 rounded-lg text-xs font-medium">
  📨 رسالة
</button>
<button onClick={() => setNotesTarget(t)} className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-2.5 py-1 rounded-lg text-xs font-medium">
  📝 ملاحظات
</button>
```

- [ ] At the end of the ThemeA return, before the closing `</>`, add the modals:

```tsx
{msgTarget && (
  <SendMessage tenant={msgTarget} superHeader={p.superHeader} onClose={() => setMsgTarget(null)} />
)}
{notesTarget && (
  <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <h3 className="text-white font-extrabold text-base" dir="rtl">
          ملاحظات — {notesTarget.businessName || notesTarget.name}
        </h3>
        <button onClick={() => setNotesTarget(null)} className="text-gray-500 hover:text-white">✕</button>
      </div>
      <div className="p-5">
        <TenantNotes cafeId={notesTarget.id} superHeader={p.superHeader} />
      </div>
    </div>
  </div>
)}
```

- [ ] Commit:

```bash
git add app/superadmin/components/types.ts app/superadmin/page.tsx app/superadmin/components/themes/ThemeA.tsx
git commit -m "feat(superadmin): wire impersonate, send-message, notes, export-CSV into ThemeA"
```

---

## Task 9 — Wire into ThemeB and ThemeC

- [ ] In `app/superadmin/components/themes/ThemeB.tsx`, add the same imports and state as Task 8c.
  Then add the same 3 action buttons (`ImpersonateButton`, message, notes) into the ThemeB tenant row actions column.
  Add the same modals at the end of the return statement.

- [ ] In `app/superadmin/components/themes/ThemeC.tsx`, do the same.

- [ ] Commit:

```bash
git add app/superadmin/components/themes/ThemeB.tsx app/superadmin/components/themes/ThemeC.tsx
git commit -m "feat(superadmin): wire management features into ThemeB and ThemeC"
```

---

## Task 10 — Manual Verification

- [ ] Start both servers:

```bash
npm run dev       # Express backend
npx next dev      # Next.js frontend
```

- [ ] Open `http://localhost:3000/superadmin` and login.

- [ ] Find a tenant row → click "📝 ملاحظات" → write a note → verify it saves and appears in the list.

- [ ] Click "📨 رسالة" → select "🔔 In-App" → type a message → click إرسال → verify success screen.

- [ ] Click "ادخل كـ" on a tenant → verify a new tab opens and lands on `/admin/dashboard` for that tenant.

- [ ] Click "تصدير CSV" in the header → verify a `.csv` file downloads with correct columns.

- [ ] Final commit:

```bash
git add -A
git commit -m "feat(superadmin): complete Plan 2 management features"
```
