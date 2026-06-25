# Landing Page 3-Theme Switcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-theme color switcher (🌿 Dark Green · 🌊 Dark Navy+Gold · ☀️ Light Blue) to the landing page with localStorage persistence.

**Architecture:** CSS custom properties (`--cp`, `--ca`, `--cg`, `--cb`, `--cs`, `--cn`, `--cbr`, `--ct`, `--ctm`) scoped to `main[data-theme="..."]`. A `theme` state drives both the `data-theme` attribute and inline `style` props for gradients. All brand-color Tailwind classes replaced with `bg-[var(--cp)]`, `text-[var(--ca)]` etc.  The switcher is a 3-icon pill added to the navbar (desktop + mobile).

**Tech Stack:** React state, CSS custom properties, Tailwind arbitrary-value syntax, localStorage

---

## File Map

| File | Action |
|------|--------|
| `app/landing/page.tsx` | All changes — theme type, state, CSS block, constants, switcher, ~80 class replacements |

---

## Task 1 — Theme infrastructure: type, state, CSS vars block, gradient constants

**Files:**
- Modify: `app/landing/page.tsx`

- [ ] **Step 1: Add `LandingTheme` type and `HERO_GRADIENT` / `H1_GRADIENT` / `HERO_GLOW` constants**

In `app/landing/page.tsx`, find the line:

```typescript
function getEmbedUrl(url: string): string {
```

Add the following BEFORE it:

```typescript
// ─── Theme system ──────────────────────────────────────────────────────────────

type LandingTheme = 'dark-green' | 'dark-navy' | 'light-blue'

const HERO_GRADIENT: Record<LandingTheme, string> = {
  'dark-green': 'linear-gradient(135deg, #030712 0%, #111827 60%, #052e16 100%)',
  'dark-navy':  'linear-gradient(135deg, #070d1a 0%, #0d1a3a 60%, #070d1a 100%)',
  'light-blue': 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
}

const H1_GRADIENT: Record<LandingTheme, string> = {
  'dark-green': 'linear-gradient(90deg, #34d399, #6ee7b7)',
  'dark-navy':  'linear-gradient(90deg, #60a5fa, #93c5fd)',
  'light-blue': 'linear-gradient(90deg, #fbbf24, #f59e0b)',
}

const HERO_GLOW: Record<LandingTheme, string> = {
  'dark-green': 'rgba(16,185,129,0.15)',
  'dark-navy':  'rgba(37,99,235,0.18)',
  'light-blue': 'transparent',
}

const THEME_ICONS: Record<LandingTheme, string> = {
  'dark-green': '🌿',
  'dark-navy':  '🌊',
  'light-blue': '☀️',
}

```

- [ ] **Step 2: Add `theme` state and `setThemeAndSave` helper to the component**

Find this block inside the `LandingPage` component:

```typescript
  const [ctaLoading, setCtaLoading] = useState(false)
  const [ctaError, setCtaError] = useState('')
  const [demoLoading, setDemoLoading] = useState(false)
```

Replace with:

```typescript
  const [ctaLoading, setCtaLoading] = useState(false)
  const [ctaError, setCtaError] = useState('')
  const [demoLoading, setDemoLoading] = useState(false)
  const [theme, setTheme] = useState<LandingTheme>('dark-green')

  useEffect(() => {
    const saved = localStorage.getItem('landing-theme') as LandingTheme | null
    if (saved && ['dark-green', 'dark-navy', 'light-blue'].includes(saved)) setTheme(saved)
  }, [])

  function switchTheme(t: LandingTheme) {
    setTheme(t)
    localStorage.setItem('landing-theme', t)
  }
```

- [ ] **Step 3: Add CSS variables `<style>` block inside the JSX return**

Find this line in the JSX return (the opening `<main>` tag):

```tsx
    <main dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden">
```

Replace with:

```tsx
    <main dir={isRtl ? 'rtl' : 'ltr'} data-theme={theme} className="min-h-screen font-sans overflow-x-hidden" style={{ background: 'var(--cb)', color: 'var(--ct)' }}>
      <style>{`
        main[data-theme="dark-green"] {
          --cp: #10b981; --cp-h: #34d399;
          --ca: #34d399; --cg: #34d399;
          --cb: #030712; --cs: #111827;
          --cn: rgba(255,255,255,0.05);
          --cbr: rgba(52,211,153,0.2);
          --ct: #f9fafb; --ctm: #9ca3af;
        }
        main[data-theme="dark-navy"] {
          --cp: #2563eb; --cp-h: #3b82f6;
          --ca: #60a5fa; --cg: #f59e0b;
          --cb: #070d1a; --cs: #0d1526;
          --cn: rgba(7,13,26,0.96);
          --cbr: rgba(37,99,235,0.25);
          --ct: #f8fafc; --ctm: #94a3b8;
        }
        main[data-theme="light-blue"] {
          --cp: #1d4ed8; --cp-h: #2563eb;
          --ca: #1d4ed8; --cg: #d97706;
          --cb: #f8fafc; --cs: #ffffff;
          --cn: rgba(255,255,255,0.98);
          --cbr: #bfdbfe;
          --ct: #0f172a; --ctm: #475569;
        }
      `}</style>
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau"
git add app/landing/page.tsx
git commit -m "feat(landing): add theme type, state, CSS vars block and gradient constants"
```

---

## Task 2 — Theme Switcher in navbar (desktop + mobile)

**Files:**
- Modify: `app/landing/page.tsx`

- [ ] **Step 1: Add switcher to desktop navbar**

Find this exact block:

```tsx
            <div className="hidden lg:flex items-center gap-2">
              <Link href="/login" className="text-sm text-gray-600 hover:text-emerald-700 font-medium px-3 py-2 transition-colors">{t('navLogin')}</Link>
              <Link href="/signup" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm">{t('navSignup')}</Link>
            </div>
```

Replace with:

```tsx
            <div className="hidden lg:flex items-center gap-2">
              {/* Theme switcher */}
              <div className="flex items-center bg-black/10 rounded-lg p-0.5">
                {(['dark-green', 'dark-navy', 'light-blue'] as LandingTheme[]).map(th => (
                  <button
                    key={th}
                    onClick={() => switchTheme(th)}
                    title={th}
                    className={`px-2 py-1.5 rounded-md text-sm transition-all ${theme === th ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-80'}`}
                  >
                    {THEME_ICONS[th]}
                  </button>
                ))}
              </div>
              <Link href="/login" className="text-sm text-[var(--ctm)] hover:text-[var(--ca)] font-medium px-3 py-2 transition-colors">{t('navLogin')}</Link>
              <Link href="/signup" className="bg-[var(--cp)] hover:bg-[var(--cp-h)] text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm">{t('navSignup')}</Link>
            </div>
```

- [ ] **Step 2: Add switcher to mobile menu**

Find this block (mobile menu drawer):

```tsx
          <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
```

Replace with:

```tsx
          <div className="lg:hidden border-t border-[var(--cbr)] bg-[var(--cs)] px-4 py-4 space-y-3">
```

Then find the mobile signup link inside that drawer:

```tsx
            <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="block bg-emerald-600 text-white text-center py-3 rounded-xl font-bold mt-2">{t('navSignup')}</Link>
```

Replace with:

```tsx
            {/* Theme switcher mobile */}
            <div className="flex items-center justify-center gap-2 py-2">
              {(['dark-green', 'dark-navy', 'light-blue'] as LandingTheme[]).map(th => (
                <button
                  key={th}
                  onClick={() => { switchTheme(th); setMobileMenuOpen(false) }}
                  className={`flex-1 py-2 rounded-lg text-center text-base transition-all ${theme === th ? 'bg-[var(--cp)] text-white' : 'bg-[var(--cs)] text-[var(--ctm)] border border-[var(--cbr)]'}`}
                >
                  {THEME_ICONS[th]}
                </button>
              ))}
            </div>
            <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="block bg-[var(--cp)] hover:bg-[var(--cp-h)] text-white text-center py-3 rounded-xl font-bold mt-2">{t('navSignup')}</Link>
```

- [ ] **Step 3: Fix navbar background and border**

Find:

```tsx
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur shadow-sm border-b border-gray-100">
```

Replace with:

```tsx
      <nav className="sticky top-0 z-40 backdrop-blur shadow-sm border-b" style={{ background: 'var(--cn)', borderColor: 'var(--cbr)' }}>
```

- [ ] **Step 4: Fix navbar logo tagline and nav links**

Find:

```tsx
              <span className="hidden sm:block text-[10px] text-emerald-600 font-semibold leading-none">AI OS · OPERATE · GROW</span>
```

Replace with:

```tsx
              <span className="hidden sm:block text-[10px] text-[var(--ca)] font-semibold leading-none">AI OS · OPERATE · GROW</span>
```

Find:

```tsx
          <div className="hidden lg:flex items-center gap-6 text-sm text-gray-600 font-medium">
            <a href="#who"      className="hover:text-emerald-700 transition-colors">{t('whoLabel')}</a>
            <a href="#platform" className="hover:text-emerald-700 transition-colors">{t('architectureLabel')}</a>
            <a href="#features" className="hover:text-emerald-700 transition-colors">{t('featLabel')}</a>
            <a href="#how"      className="hover:text-emerald-700 transition-colors">{t('howLabel')}</a>
            <a href="#pricing"  className="hover:text-emerald-700 transition-colors">{t('pricingLabel')}</a>
            <a href="#contact"  className="hover:text-emerald-700 transition-colors">{t('contactLabel')}</a>
          </div>
```

Replace with:

```tsx
          <div className="hidden lg:flex items-center gap-6 text-sm font-medium" style={{ color: 'var(--ctm)' }}>
            <a href="#who"      className="hover:text-[var(--ca)] transition-colors">{t('whoLabel')}</a>
            <a href="#platform" className="hover:text-[var(--ca)] transition-colors">{t('architectureLabel')}</a>
            <a href="#features" className="hover:text-[var(--ca)] transition-colors">{t('featLabel')}</a>
            <a href="#how"      className="hover:text-[var(--ca)] transition-colors">{t('howLabel')}</a>
            <a href="#pricing"  className="hover:text-[var(--ca)] transition-colors">{t('pricingLabel')}</a>
            <a href="#contact"  className="hover:text-[var(--ca)] transition-colors">{t('contactLabel')}</a>
          </div>
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau"
git add app/landing/page.tsx
git commit -m "feat(landing): add theme switcher to navbar (desktop + mobile)"
```

---

## Task 3 — Hero section

**Files:**
- Modify: `app/landing/page.tsx`

- [ ] **Step 1: Replace hero section background and glow**

Find:

```tsx
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-emerald-600/15 rounded-full blur-[120px]" />
```

Replace with:

```tsx
      <section className="relative overflow-hidden" style={{ background: HERO_GRADIENT[theme] }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[120px]" style={{ background: HERO_GLOW[theme] }} />
```

- [ ] **Step 2: Replace hero tagline badge (desktop)**

Find:

```tsx
            <div className="inline-flex items-center gap-2 bg-emerald-900/50 border border-emerald-700/40 text-emerald-300 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
```

Replace with:

```tsx
            <div className="inline-flex items-center gap-2 border px-4 py-1.5 rounded-full text-sm font-medium mb-4" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--ca)' }} />
```

- [ ] **Step 3: Replace H1 gradient span (desktop)**

Find:

```tsx
              <span className="block bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">{t('h1b')}</span>
            </h1>
          </div>
          <div className="lg:hidden w-full text-center hero-title-mobile">
            <div className="inline-flex items-center gap-2 bg-emerald-900/50 border border-emerald-700/40 text-emerald-300 px-4 py-1.5 rounded-full text-sm font-medium mb-7">
```

Replace with:

```tsx
              <span className="block bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>{t('h1b')}</span>
            </h1>
          </div>
          <div className="lg:hidden w-full text-center hero-title-mobile">
            <div className="inline-flex items-center gap-2 border px-4 py-1.5 rounded-full text-sm font-medium mb-7" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>
```

- [ ] **Step 4: Replace second H1 gradient span (mobile)**

Find:

```tsx
                <span className="block bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">{t('h1b')}</span>
```

(This is the SECOND occurrence — inside the mobile hero div. Replace only that one.)

Replace with:

```tsx
                <span className="block bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>{t('h1b')}</span>
```

- [ ] **Step 5: Replace hero CTA buttons**

Find:

```tsx
            <div className={`mt-7 flex flex-col sm:flex-row gap-3 justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'}`}>
              <Link href="/signup" className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-7 py-3.5 rounded-xl shadow-xl shadow-emerald-900/40 transition-all text-base">
```

Replace with:

```tsx
            <div className={`mt-7 flex flex-col sm:flex-row gap-3 justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'}`}>
              <Link href="/signup" className="flex items-center justify-center gap-2 bg-[var(--cp)] hover:bg-[var(--cp-h)] text-white font-bold px-7 py-3.5 rounded-xl shadow-xl transition-all text-base">
```

- [ ] **Step 6: Replace hero trust badges (CheckCircle icon color)**

Find:

```tsx
                  <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" /> {b}
```

Replace with:

```tsx
                  <CheckCircle className="w-3 h-3 shrink-0" style={{ color: 'var(--ca)' }} /> {b}
```

- [ ] **Step 7: Replace hero card mock glow and green dot**

Find:

```tsx
              <div className="absolute -inset-8 rounded-3xl bg-emerald-500/15 blur-3xl" />
```

Replace with:

```tsx
              <div className="absolute -inset-8 rounded-3xl blur-3xl" style={{ background: HERO_GLOW[theme] }} />
```

Find:

```tsx
                    <span className="w-3 h-3 rounded-full bg-green-500/70" />
```

(First occurrence — in the hero mock card)

Replace with:

```tsx
                    <span className="w-3 h-3 rounded-full" style={{ background: 'var(--ca)', opacity: 0.7 }} />
```

- [ ] **Step 8: Replace second CTA block (below video)**

Find:

```tsx
              <Link href="/signup" className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-3.5 rounded-xl shadow-xl shadow-emerald-900/40 transition-all text-base">
```

Replace with:

```tsx
              <Link href="/signup" className="flex items-center gap-2 bg-[var(--cp)] hover:bg-[var(--cp-h)] text-white font-bold px-8 py-3.5 rounded-xl shadow-xl transition-all text-base">
```

- [ ] **Step 9: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau"
git add app/landing/page.tsx
git commit -m "feat(landing): apply theme to hero section"
```

---

## Task 4 — Stats bar + section backgrounds

**Files:**
- Modify: `app/landing/page.tsx`

- [ ] **Step 1: Replace stats bar section (emerald-700 → CSS var)**

Find:

```tsx
      <section className="bg-emerald-700 py-10">
        <div className="max-w-5xl mx-auto px-4">
          <p className={`text-emerald-200 text-xs font-semibold uppercase tracking-widest text-center mb-6`}>{t('statsLabel')}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map(s => (
              <div key={s.value}>
                <div className="text-4xl font-extrabold text-white">{s.value}</div>
                <div className="text-emerald-200 text-sm mt-1 font-medium">{tl(s, lang)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
```

Replace with:

```tsx
      <section className="py-10" style={{ background: 'var(--cp)' }}>
        <div className="max-w-5xl mx-auto px-4">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest text-center mb-6">{t('statsLabel')}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map(s => (
              <div key={s.value}>
                <div className="text-4xl font-extrabold text-white">{s.value}</div>
                <div className="text-white/70 text-sm mt-1 font-medium">{tl(s, lang)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Replace dark section backgrounds (`bg-gray-950`)**

Find (ECOSYSTEM section):

```tsx
      <section className="bg-gray-950 py-24 relative overflow-hidden">
        {/* dot grid */}
```

Replace with:

```tsx
      <section className="py-24 relative overflow-hidden" style={{ background: 'var(--cb)' }}>
        {/* dot grid */}
```

Find (PLATFORM/ARCHITECTURE section at line ~1271):

```tsx
      <section id="platform" className="py-24 bg-gray-950 relative overflow-hidden">
```

Replace with:

```tsx
      <section id="platform" className="py-24 relative overflow-hidden" style={{ background: 'var(--cb)' }}>
```

Find (MARKETING ENGINE section at line ~1432):

```tsx
      <section id="marketing-engine" className="py-24 bg-gray-950 relative overflow-hidden">
```

Replace with:

```tsx
      <section id="marketing-engine" className="py-24 relative overflow-hidden" style={{ background: 'var(--cb)' }}>
```

Find (FINAL dark CTA section before footer at line ~1687):

```tsx
      <section className="py-24 bg-gradient-to-br from-gray-950 via-emerald-950 to-gray-950 relative overflow-hidden">
```

Replace with:

```tsx
      <section className="py-24 relative overflow-hidden" style={{ background: HERO_GRADIENT[theme] }}>
```

- [ ] **Step 3: Replace `bg-gray-900` surface sections**

Find (video/HOW section at line ~1149):

```tsx
        <section className="bg-gray-900 py-24 relative overflow-hidden">
```

Replace with:

```tsx
        <section className="py-24 relative overflow-hidden" style={{ background: 'var(--cs)' }}>
```

- [ ] **Step 4: Replace white sections (`bg-white`)**

Find (WHO section):

```tsx
      <section id="who" className="py-24 bg-white">
```

Replace with:

```tsx
      <section id="who" className="py-24" style={{ background: 'var(--cs)' }}>
```

Find (FEATURES/HOW section):

```tsx
      <section id="features" className="py-24 bg-white">
```

Replace with:

```tsx
      <section id="features" className="py-24" style={{ background: 'var(--cs)' }}>
```

Find (TESTIMONIALS section at line ~1653):

```tsx
      <section className="py-24 bg-white">
```

(First occurrence after line 1650)

Replace with:

```tsx
      <section className="py-24" style={{ background: 'var(--cs)' }}>
```

Find (FAQ section at ~1743):

```tsx
      <section className="py-24 bg-white">
```

(Second occurrence after line 1740)

Replace with:

```tsx
      <section className="py-24" style={{ background: 'var(--cs)' }}>
```

Find (CONTACT section at ~1757):

```tsx
      <section id="contact" className="py-24 bg-white">
```

Replace with:

```tsx
      <section id="contact" className="py-24" style={{ background: 'var(--cs)' }}>
```

- [ ] **Step 5: Replace glow blobs using emerald**

Find (ECOSYSTEM glow blob):

```tsx
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />
```

Replace with:

```tsx
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] rounded-full blur-[140px] pointer-events-none" style={{ background: HERO_GLOW[theme] }} />
```

Find (video section glow blob):

```tsx
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-emerald-600/10 rounded-full blur-[130px] pointer-events-none" />
```

Replace with:

```tsx
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full blur-[130px] pointer-events-none" style={{ background: HERO_GLOW[theme] }} />
```

Find (ARCHITECTURE section glow):

```tsx
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px]" />
```

Replace with:

```tsx
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px]" style={{ background: HERO_GLOW[theme] }} />
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau"
git add app/landing/page.tsx
git commit -m "feat(landing): apply theme to section backgrounds and stats bar"
```

---

## Task 5 — Section labels, h2 gradients, and accent text

**Files:**
- Modify: `app/landing/page.tsx`

- [ ] **Step 1: Replace ECOSYSTEM section label and h2 gradient**

Find:

```tsx
            <span className="inline-block bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
```

(First occurrence — ECOSYSTEM section label)

Replace with:

```tsx
            <span className="inline-block border px-4 py-1.5 rounded-full text-sm font-semibold mb-5" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>
```

Find the three h2 gradient spans in ECOSYSTEM:

```tsx
                <>كل ما يحتاجه مطعمك.<br /><span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">في نظام واحد.</span></>
```

Replace with:

```tsx
                <>كل ما يحتاجه مطعمك.<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>في نظام واحد.</span></>
```

Find:

```tsx
                <>Tout ce dont votre restaurant a besoin.<br /><span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Dans un seul OS.</span></>
```

Replace with:

```tsx
                <>Tout ce dont votre restaurant a besoin.<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>Dans un seul OS.</span></>
```

Find:

```tsx
                <>Everything Your Restaurant Needs.<br /><span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">One Unified OS.</span></>
```

Replace with:

```tsx
                <>Everything Your Restaurant Needs.<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>One Unified OS.</span></>
```

- [ ] **Step 2: Replace ECOSYSTEM card glow spans**

Find:

```tsx
            <div className="absolute -inset-6 bg-gradient-to-r from-emerald-500/20 via-teal-400/10 to-emerald-500/20 rounded-3xl blur-2xl" />
            <div className="absolute -inset-2 bg-gradient-to-br from-emerald-900/30 to-transparent rounded-2xl" />
```

Replace with:

```tsx
            <div className="absolute -inset-6 rounded-3xl blur-2xl" style={{ background: HERO_GLOW[theme] }} />
            <div className="absolute -inset-2 rounded-2xl" style={{ background: 'var(--cbr)', opacity: 0.15 }} />
```

- [ ] **Step 3: Replace VIDEO section label and h2 gradients**

Find:

```tsx
              <span className="inline-block bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
```

(Second occurrence — VIDEO section)

Replace with:

```tsx
              <span className="inline-block border px-4 py-1.5 rounded-full text-sm font-semibold mb-5" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>
```

Find the three video section h2 gradient spans:

```tsx
                  <>شاهد كيف يحوّل SmartRestau<br /><span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">مطعمك في أقل من 30 دقيقة</span></>
```

Replace with:

```tsx
                  <>شاهد كيف يحوّل SmartRestau<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>مطعمك في أقل من 30 دقيقة</span></>
```

Find:

```tsx
                  <>Regardez comment SmartRestau<br /><span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">transforme un restaurant en 30 min</span></>
```

Replace with:

```tsx
                  <>Regardez comment SmartRestau<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>transforme un restaurant en 30 min</span></>
```

Find:

```tsx
                  <>Watch How SmartRestau<br /><span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Transforms a Restaurant in 30 Min</span></>
```

Replace with:

```tsx
                  <>Watch How SmartRestau<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>Transforms a Restaurant in 30 Min</span></>
```

- [ ] **Step 4: Replace video card LIVE dot and glow**

Find:

```tsx
                  <span className="text-[10px] text-emerald-400 font-bold shrink-0">● LIVE</span>
```

Replace with:

```tsx
                  <span className="text-[10px] font-bold shrink-0" style={{ color: 'var(--ca)' }}>● LIVE</span>
```

Find:

```tsx
              <div className="absolute -inset-6 bg-gradient-to-r from-emerald-500/20 via-teal-400/8 to-emerald-500/20 rounded-3xl blur-2xl" />
```

Replace with:

```tsx
              <div className="absolute -inset-6 rounded-3xl blur-2xl" style={{ background: HERO_GLOW[theme] }} />
```

- [ ] **Step 5: Replace WHO section label (light bg pill)**

Find:

```tsx
            <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">{t('whoLabel')}</span>
```

Replace with:

```tsx
            <span className="inline-block border px-4 py-1 rounded-full text-sm font-semibold mb-4" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>{t('whoLabel')}</span>
```

- [ ] **Step 6: Replace ARCHITECTURE section label and h2 gradient spans**

Find:

```tsx
            <span className="inline-block bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 px-4 py-1 rounded-full text-sm font-semibold mb-5">
```

(Third occurrence — ARCHITECTURE section)

Replace with:

```tsx
            <span className="inline-block border px-4 py-1 rounded-full text-sm font-semibold mb-5" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>
```

Find:

```tsx
                ? <>منصة واحدة. <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">كل عمليات مطعمك.</span></>
```

Replace with:

```tsx
                ? <>منصة واحدة. <span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>كل عمليات مطعمك.</span></>
```

Find:

```tsx
                ? <>Une Plateforme. <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Toutes les Opérations.</span></>
                : <>One Platform. <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Every Restaurant Operation.</span></>
```

Replace with:

```tsx
                ? <>Une Plateforme. <span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>Toutes les Opérations.</span></>
                : <>One Platform. <span className="bg-clip-text text-transparent" style={{ backgroundImage: H1_GRADIENT[theme] }}>Every Restaurant Operation.</span></>
```

- [ ] **Step 7: Replace ARCHITECTURE module "LIVE" badge**

Find:

```tsx
                      <span className="inline-flex items-center text-[9px] font-extrabold bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 px-1.5 py-0.5 rounded-full leading-none">
```

Replace with:

```tsx
                      <span className="inline-flex items-center text-[9px] font-extrabold border px-1.5 py-0.5 rounded-full leading-none" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>
```

- [ ] **Step 8: Replace HOW section step connector line**

Find:

```tsx
            <div className="hidden lg:block absolute top-11 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-emerald-100 via-emerald-400 to-emerald-100" />
```

Replace with:

```tsx
            <div className="hidden lg:block absolute top-11 left-[12.5%] right-[12.5%] h-0.5" style={{ background: `linear-gradient(90deg, transparent, var(--ca), transparent)` }} />
```

- [ ] **Step 9: Replace FEATURES section label and icon bg**

Find:

```tsx
            <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">{t('featLabel')}</span>
```

Replace with:

```tsx
            <span className="inline-block border px-4 py-1 rounded-full text-sm font-semibold mb-4" style={{ background: 'var(--cbr)', borderColor: 'var(--cbr)', color: 'var(--ca)' }}>{t('featLabel')}</span>
```

Find:

```tsx
                  <div className="w-10 h-10 bg-emerald-50 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center mb-4 transition-colors">
                    <Icon className="w-5 h-5 text-emerald-600" />
```

Replace with:

```tsx
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors" style={{ background: 'var(--cbr)' }}>
                    <Icon className="w-5 h-5" style={{ color: 'var(--ca)' }} />
```

- [ ] **Step 10: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau"
git add app/landing/page.tsx
git commit -m "feat(landing): apply theme to section labels, gradients, accent text"
```

---

## Task 6 — Trial banner, pricing, testimonials, final CTA

**Files:**
- Modify: `app/landing/page.tsx`

- [ ] **Step 1: Replace trial banner (pricing section)**

Find:

```tsx
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-8 mb-10 text-center text-white">
            <div className="text-5xl font-extrabold mb-2">{t('trialBig')}</div>
            <div className="text-emerald-100 text-lg mb-5">{t('trialSub')}</div>
```

Replace with:

```tsx
          <div className="rounded-3xl p-8 mb-10 text-center text-white" style={{ background: `linear-gradient(135deg, var(--cp), var(--cp-h))` }}>
            <div className="text-5xl font-extrabold mb-2">{t('trialBig')}</div>
            <div className="text-white/80 text-lg mb-5">{t('trialSub')}</div>
```

- [ ] **Step 2: Replace pricing fee color**

Find:

```tsx
                          <span className="font-bold text-emerald-600 text-xs">{p.fee}</span>
```

Replace with:

```tsx
                          <span className="font-bold text-xs" style={{ color: 'var(--cp)' }}>{p.fee}</span>
```

- [ ] **Step 3: Replace testimonial avatar fallback bg**

Find:

```tsx
                    : <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">{tm.name[0]}</div>
```

Replace with:

```tsx
                    : <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white" style={{ background: 'var(--cp)' }}>{tm.name[0]}</div>
```

- [ ] **Step 4: Replace final CTA section**

Find:

```tsx
      <section className="py-20 bg-emerald-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">{t('finalTitle')}</h2>
          <p className="text-emerald-200 text-xl mb-10">{t('finalSub')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="bg-white hover:bg-gray-50 text-emerald-800 font-extrabold px-10 py-4 rounded-2xl text-base transition-all shadow-xl">{t('finalCta1')}</Link>
            <a href="#contact" className="border-2 border-white/50 hover:border-white text-white font-bold px-10 py-4 rounded-2xl text-base transition-all">{t('finalCta2')}</a>
          </div>
          <p className="mt-6 text-emerald-300 text-sm">{t('finalNote')}</p>
        </div>
      </section>
```

Replace with:

```tsx
      <section className="py-20 relative overflow-hidden" style={{ background: `linear-gradient(135deg, var(--cp), var(--cp-h))` }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">{t('finalTitle')}</h2>
          <p className="text-white/80 text-xl mb-10">{t('finalSub')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="bg-white hover:bg-gray-50 font-extrabold px-10 py-4 rounded-2xl text-base transition-all shadow-xl" style={{ color: 'var(--cp)' }}>{t('finalCta1')}</Link>
            <a href="#contact" className="border-2 border-white/50 hover:border-white text-white font-bold px-10 py-4 rounded-2xl text-base transition-all">{t('finalCta2')}</a>
          </div>
          <p className="mt-6 text-white/60 text-sm">{t('finalNote')}</p>
        </div>
      </section>
```

- [ ] **Step 5: Fix dark CTA section (before footer) h2 gradient span**

Find (in the section just before footer that now uses `HERO_GRADIENT[theme]`):

Look for any remaining `from-emerald-` or `to-teal-` in the section around line 1687–1705. If found, apply the same `style={{ backgroundImage: H1_GRADIENT[theme] }}` treatment.

- [ ] **Step 6: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau"
git add app/landing/page.tsx
git commit -m "feat(landing): apply theme to trial banner, pricing, testimonials, final CTA"
```

---

## Task 7 — Remaining cleanup: green-400 dots, how-step connector, video mock dot

**Files:**
- Modify: `app/landing/page.tsx`

- [ ] **Step 1: Replace remaining `bg-green-*` / `text-green-*` brand references**

Find (second `bg-green-500/70` — inside the video mock):

```tsx
                    <span className="w-3 h-3 rounded-full bg-green-500/70" />
```

(Second occurrence — find it and replace with):

```tsx
                    <span className="w-3 h-3 rounded-full" style={{ background: 'var(--ca)', opacity: 0.7 }} />
```

Find (systemOk status bar):

```tsx
            <span className="text-green-400 font-medium">{t('systemOk')}</span>
```

Replace with:

```tsx
            <span className="font-medium" style={{ color: 'var(--ca)' }}>{t('systemOk')}</span>
```

- [ ] **Step 2: Replace HOW section dark connector line**

Find:

```tsx
            <div className="hidden lg:block absolute top-[52px] left-[10%] right-[10%] h-px bg-gradient-to-r from-emerald-700/30 via-rose-600/40 to-amber-600/30" />
```

Replace with:

```tsx
            <div className="hidden lg:block absolute top-[52px] left-[10%] right-[10%] h-px" style={{ background: `linear-gradient(90deg, var(--cbr), var(--ca), var(--cg))` }} />
```

- [ ] **Step 3: Replace cookie banner emerald link**

Find:

```tsx
          <a href="/privacy" className="text-emerald-400 underline hover:text-emerald-300">{t('cookieLink')}</a>.
```

Replace with:

```tsx
          <a href="/privacy" className="underline" style={{ color: 'var(--ca)' }}>{t('cookieLink')}</a>.
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/mac/Documents/SaaS restau"
git add app/landing/page.tsx
git commit -m "feat(landing): fix remaining green dots, connector lines, cookie banner"
```

---

## Task 8 — Final grep verification + build

**Files:**
- Modify: `app/landing/page.tsx` (any remaining stragglers)

- [ ] **Step 1: Grep for leftover brand colors**

```bash
cd "/Users/mac/Documents/SaaS restau"
grep -n "bg-emerald\|text-emerald\|border-emerald\|from-emerald\|to-emerald\|via-emerald\|to-teal-3\|bg-green-\|text-green-4" app/landing/page.tsx | grep -v "//\|data\|gain\|clr\|iconColor\|labelColor\|dotColor\|border:\|color:\|PERSONA\|HOW_STEPS\|FEATURES\|iconBg\|emerald: {" | head -30
```

Expected output: only intentional per-card data-object colors (inside `PERSONAS`, `HOW_STEPS`, `FEATURES`, `ARCH_MODULES` arrays) — NOT in JSX className strings.

If you see any JSX className hits, apply the same CSS-var replacement pattern used throughout this plan.

- [ ] **Step 2: Run build**

```bash
cd "/Users/mac/Documents/SaaS restau" && npm run build 2>&1 | grep -E "Error|error|✓|Route" | head -20
```

Expected: no TypeScript errors. Warnings about unused vars are acceptable.

- [ ] **Step 3: Commit if any fixes were needed**

```bash
cd "/Users/mac/Documents/SaaS restau"
git add app/landing/page.tsx
git commit -m "fix(landing): clean up remaining hardcoded brand colors after grep audit"
```

---

## Final Manual Verification Checklist

- [ ] Open `/landing` in browser — default theme is 🌿 dark-green, looks identical to before
- [ ] Click 🌊 — page transitions to navy/blue/gold — hero is dark navy, CTAs are blue, stats bar is blue
- [ ] Click ☀️ — page transitions to light — hero is rich blue gradient, body is white, text is dark
- [ ] Refresh page — selected theme is restored from localStorage
- [ ] Mobile: hamburger menu → 3 theme buttons visible and functional
- [ ] All section labels, h2 gradient spans, CTA buttons reflect active theme
- [ ] Per-card colors (PERSONAS borders, module icon colors) unchanged
- [ ] Footer remains dark in all themes
