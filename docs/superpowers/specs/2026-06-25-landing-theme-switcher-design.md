# Landing Page — 3-Theme Switcher Design

**Goal:** Add a 3-theme color switcher to the landing page. The visitor picks between Dark Green (current), Dark Navy+Blue+Gold, or Light Blue — choice persists in `localStorage`.

**Scope:** `app/landing/page.tsx` only. No other pages affected.

---

## 1. Theme System Architecture

### Approach: CSS Custom Properties via `data-theme`

Add a `<style>` block inside `<main>` that maps a `data-theme` attribute to CSS variable values. Replace all brand-color Tailwind classes in JSX with arbitrary-value classes referencing those variables (`bg-[var(--cp)]`, `text-[var(--ca)]`, etc.).

**Why this approach:**
- Single source of truth (CSS vars block) — no duplicating JSX per theme
- Tailwind arbitrary value syntax works at build time (classes are static strings in source)
- `data-theme` on `<main>` scopes changes cleanly

### CSS Variable Tokens

| Token | Purpose |
|-------|---------|
| `--cp` | Primary CTA background (button fill) |
| `--cp-h` | Primary hover state |
| `--ca` | Accent color (labels, icons, stats numbers, borders glow) |
| `--cg` | Secondary/gold accent (badges, pricing numbers) |
| `--cb` | Page base background |
| `--cs` | Surface background (sections, cards) |
| `--cn` | Navbar background (with alpha) |
| `--cbr` | Border color (card borders, section dividers) |
| `--ct` | Primary text |
| `--ctm` | Muted/secondary text |

### Three Themes

#### `dark-green` (current, default)
```
--cp:  #10b981   --cp-h: #34d399
--ca:  #34d399   --cg:   #34d399
--cb:  #030712   --cs:   #111827
--cn:  rgba(255,255,255,0.95)
--cbr: rgba(52,211,153,0.2)
--ct:  #f9fafb   --ctm:  #9ca3af
Hero gradient:  from-gray-950 via-gray-900 to-emerald-950
H1 gradient:    from-emerald-400 to-teal-300
Glow:           rgba(16,185,129,0.15)
```

#### `dark-navy` (new)
```
--cp:  #2563eb   --cp-h: #3b82f6
--ca:  #60a5fa   --cg:   #f59e0b
--cb:  #070d1a   --cs:   #0d1526
--cn:  rgba(7,13,26,0.96)
--cbr: rgba(37,99,235,0.25)
--ct:  #f8fafc   --ctm:  #94a3b8
Hero gradient:  from-[#070d1a] via-[#0d1a3a] to-[#070d1a]
H1 gradient:    from-blue-400 to-blue-200
Glow:           rgba(37,99,235,0.18)  (blue) + rgba(245,158,11,0.08) (gold)
```

#### `light-blue` (new)
```
--cp:  #1d4ed8   --cp-h: #2563eb
--ca:  #1d4ed8   --cg:   #d97706
--cb:  #f8fafc   --cs:   #ffffff
--cn:  rgba(255,255,255,0.98)
--cbr: #bfdbfe
--ct:  #0f172a   --ctm:  #475569
Hero:           solid bg-[#1e3a8a] to bg-[#1d4ed8] gradient (not dark)
H1 gradient:    from-amber-400 to-amber-300 (gold, on blue bg)
Glow:           none
```

---

## 2. JSX Replacements

All replacements are **find-and-replace** of specific Tailwind class strings. No restructuring of JSX.

### CTAs (primary buttons)
```
bg-emerald-600  →  bg-[var(--cp)]
bg-emerald-500  →  bg-[var(--cp)]
hover:bg-emerald-700 / hover:bg-emerald-400  →  hover:bg-[var(--cp-h)]
shadow-emerald-900/40  →  remove (or keep neutral shadow)
```

### Labels & icons (section labels, active dots, nav hover)
```
text-emerald-400 / text-emerald-500 / text-emerald-600  →  text-[var(--ca)]
text-green-400  →  text-[var(--ca)]
hover:text-emerald-700  →  hover:text-[var(--ca)]
```

### Section backgrounds
```
bg-gray-900   →  bg-[var(--cs)]
bg-gray-950   →  bg-[var(--cb)]
bg-white      →  bg-[var(--cn)] (for navbar) or bg-[var(--cs)] (for light sections)
```

### Borders & rings
```
border-emerald-700/40  →  border-[var(--cbr)]
border-emerald-500     →  border-[var(--ca)]
ring-emerald-*         →  ring-[var(--ca)]
```

### Hero section (inline style — gradients can't be CSS-variable-driven via Tailwind)
The hero `<section>` gets an inline `style={{ background: HERO_GRADIENT[theme] }}` instead of the Tailwind gradient classes.

Same for H1 gradient text span — inline `style={{ backgroundImage: H1_GRADIENT[theme] }}`.

### Pricing numbers & gold accents
```
(stats numbers, pricing %)  →  use text-[var(--cg)] for accent stats
```

### Navbar background
```
bg-white/95  →  bg-[var(--cn)] backdrop-blur
border-gray-100  →  border-[var(--cbr)]
text-gray-600 / text-gray-900  →  text-[var(--ct)] / text-[var(--ctm)]
```

### Feature card borders (PERSONAS, FEATURES sections)
These currently hardcode per-card colors (emerald, amber, sky, rose per persona type). Keep those per-card colors — they're intentional category indicators, not brand colors.

---

## 3. Theme Switcher Component

### Location
Navbar, right side — between the lang switcher and the Login/Signup buttons.

### UI
Three icon buttons in a pill container:

```
[ 🌿 | 🌊 | ☀️ ]
```

- `🌿` = dark-green  
- `🌊` = dark-navy  
- `☀️` = light-blue

Active theme gets a white/filled background. Inactive themes are ghost.

**Mobile**: Same 3 buttons appear in the mobile menu drawer, stacked below the lang switcher.

### Persistence
```typescript
localStorage.setItem('landing-theme', theme)
// read on mount, default to 'dark-green'
```

### State
```typescript
type LandingTheme = 'dark-green' | 'dark-navy' | 'light-blue'
const [theme, setTheme] = useState<LandingTheme>('dark-green')
```

Set `data-theme={theme}` on the `<main>` element.

---

## 4. CSS Variables Block

Injected as `<style>` inside the `return` of `LandingPage`:

```css
main[data-theme="dark-green"] {
  --cp: #10b981; --cp-h: #34d399;
  --ca: #34d399; --cg: #34d399;
  --cb: #030712; --cs: #111827;
  --cn: rgba(255,255,255,0.95);
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
```

---

## 5. Hero & H1 Gradient Constants

```typescript
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
```

---

## 6. What Does NOT Change

- Per-category card colors (emerald/amber/sky/rose for PERSONAS, HOW steps) — intentional, keep
- Module feature card icon background colors — intentional per-module color coding
- Cookie banner — stays dark neutral
- Footer — stays dark
- All non-brand neutrals (gray-400, slate-500 for generic text) — keep as-is

---

## 7. File Changes Summary

| File | Change |
|------|--------|
| `app/landing/page.tsx` | Add `theme` state, CSS vars block, `HERO_GRADIENT`/`H1_GRADIENT` constants, ThemeSwitcher inline component, replace ~100 brand color classes |

No new files needed. No backend changes.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Missed color class (still hardcoded) | Do a final `grep emerald` pass after implementation |
| Light mode text contrast | `light-blue` uses dark text (`--ct: #0f172a`) — readable on white surfaces |
| Arbitrary Tailwind classes purged | Classes are static strings in source — Tailwind includes them at build |
| SSR hydration mismatch | Read localStorage only in `useEffect` (client-side) + default to `dark-green` |
