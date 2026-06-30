---
name: frontend-design
description: >
  Create distinctive, production-grade frontend interfaces for SellSync — a dark premium
  Brazilian SaaS. Use when asked to build components, pages, modals, charts, tables,
  forms, or any UI. Generates visually refined, accessible, performant code that
  follows the SellSync dark design system (Linear-inspired, indigo/violet palette).
  Avoids generic AI aesthetics. Source: Anthropic official + UI/UX Pro Max (88k⭐).
metadata:
  author: sellsync-project (based on anthropics/claude-code + nextlevelbuilder/ui-ux-pro-max-skill)
  version: "1.0"
  stars: 88700+
  stack: nextjs15, react19, tailwindcss4, recharts, zustand
---

# SellSync Frontend Design

## SellSync Design System (follow strictly)

This project uses a fixed dark premium design system inspired by Linear.app.
**Never deviate from these values** — consistency across 20+ pages is critical.

### Color Palette (hex only in `style={}` — never CSS vars inline)

```
Background:      #080810
Sidebar:         #0b0b14
Header/Card bg:  #0f0f1a
Card fill:       rgba(15,15,25,0.9)
Border default:  rgba(255,255,255,0.06)
Border strong:   rgba(255,255,255,0.08)

Primary:         #6366f1 → #8b5cf6  (gradient 135deg)
Primary dim:     rgba(99,102,241,0.15)
Primary border:  rgba(99,102,241,0.25)
Primary glow:    rgba(99,102,241,0.3)
Primary glow 2:  0 0 16px rgba(99,102,241,0.25)

Text primary:    #f1f5f9
Text secondary:  #94a3b8
Text muted:      #64748b
Text dim:        #475569

Success:         #10b981 / #34d399
Warning:         #f59e0b / #fbbf24
Danger:          #ef4444 / #f87171
Info:            #3b82f6 / #60a5fa
```

### CSS Variables (for Tailwind className only)
`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--border`, `--ring`

### Typography
- Body: system font stack (already set in globals.css)
- Numbers/stats: `font-variant-numeric: tabular-nums`
- Headers: font-semibold or font-bold, text-sm to text-xl range

### Available Animations (use className, not inline style)
```
.animate-fade-in          opacity 0→1 + translateY(8px→0)
.animate-fade-in-scale    opacity + scale(0.97→1)
.animate-slide-in-left    opacity + translateX(-8px→0)
.animate-glow-pulse       box-shadow pulsante
.animate-shimmer          skeleton loader
```

### Utility Classes
```
.gradient-primary    background: linear-gradient(135deg, #6366f1, #8b5cf6)
.glow-primary        box-shadow com brilho roxo
.glass               backdrop-filter: blur(12px)
```

### Card Pattern
```tsx
<div
  className="rounded-xl p-5 animate-fade-in"
  style={{
    background: 'rgba(15,15,25,0.9)',
    border: '1px solid rgba(255,255,255,0.06)',
  }}
>
```

### Button Patterns
```tsx
// Primary
<button
  className="h-10 px-4 rounded-xl text-sm font-semibold text-white gradient-primary"
  style={{ boxShadow: '0 0 16px rgba(99,102,241,0.25)' }}
>

// Ghost/outline
<button
  className="h-9 px-3 rounded-lg text-sm transition-colors"
  style={{
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#94a3b8',
    background: 'transparent',
  }}
>

// Danger
<button style={{ color: '#f87171' }}>
```

### Active Nav Item
```tsx
style={{
  background: 'rgba(99,102,241,0.15)',
  border: '1px solid rgba(99,102,241,0.25)',
  borderLeft: '2px solid #818cf8',
  color: '#818cf8',
}}
```

---

## Design Thinking (before coding)

1. **Purpose**: What data/action does this component expose? Who uses it (OWNER, OPERATOR)?
2. **Context**: Is it a full page, a modal, a table row, a stat card, a form?
3. **Differentiation**: What makes it clear and delightful within the dark premium aesthetic?
4. **Constraints**: Must match the existing SellSync palette — no light themes, no white backgrounds.

**CRITICAL RULE**: Choose intentionality over decoration. This is a B2B tool — precision,
density, and clarity beat visual noise. Every pixel serves data or action.

---

## Implementation Standards

### Component Structure
- Use `'use client'` only when state/effects/browser APIs are needed
- Prefer server components for data-display pages
- Keep components under 200 lines — extract sub-components
- Use React Query (`useQuery`, `useMutation`) for all API calls
- Error and loading states are mandatory for every data-fetching component

### Spacing & Layout
```
Gap between sections:  gap-6 (24px)
Card padding:          p-5 (20px) or p-6 (24px) for larger
Form field gap:        space-y-3
Table cell padding:    px-4 py-3
Sidebar item:          px-3 py-2
```

### Icons
- Use `lucide-react` exclusively — already installed
- Size: `h-4 w-4` for inline, `h-5 w-5` for buttons, `h-6 w-6` for nav
- Never use emoji as icons in production components

### Tables
```tsx
<div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.75rem', overflow: 'hidden' }}>
  <table className="w-full text-sm">
    <thead>
      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <th className="px-4 py-3 text-left font-medium" style={{ color: '#64748b' }}>Column</th>
      </tr>
    </thead>
    <tbody>
      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <td className="px-4 py-3" style={{ color: '#e2e8f0' }}>Value</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Status Badges
```tsx
// Success
<span className="px-2 py-0.5 rounded-full text-xs font-medium"
  style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
  Ativo
</span>

// Warning
<span style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
```

### Charts (Recharts)
- Background: transparent, grid: `rgba(255,255,255,0.04)`
- Primary line/bar color: `#6366f1`
- Secondary: `#8b5cf6`, tertiary: `#06b6d4`
- Tooltip: dark background `rgba(15,15,25,0.95)` + border `rgba(255,255,255,0.1)`
- Always include `ResponsiveContainer width="100%" height={300}`
- Never use bare `<Area yAxisId>` without a matching `<YAxis yAxisId>`

### Forms
- Input pattern:
```tsx
<input
  className="w-full h-10 rounded-lg px-3 text-sm outline-none transition-all"
  style={{
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#f1f5f9',
  }}
/>
```
- Focus: `onFocus` → border `rgba(99,102,241,0.5)`
- Error: border `rgba(239,68,68,0.5)`, message in `#f87171`

---

## Quality Checklist (verify before finishing)

### Visual
- [ ] All colors match SellSync palette (no white/gray backgrounds)
- [ ] Text contrast ≥ 4.5:1 against card background
- [ ] Consistent border radius (rounded-lg / rounded-xl)
- [ ] Loading state defined (skeleton or spinner)
- [ ] Empty state defined (icon + message)
- [ ] Error state defined

### Accessibility (WCAG AA)
- [ ] Buttons have `aria-label` or visible text
- [ ] Form inputs have `<label>` or `aria-label`
- [ ] Tables have `<th scope="col">` headers
- [ ] Modals trap focus and close on Escape
- [ ] Color is not the only indicator of meaning
- [ ] All interactive elements reachable by keyboard (Tab)
- [ ] `role="alert"` for error messages

### Responsive
- [ ] Works at 1280px (standard desktop)
- [ ] Works at 1024px (laptop)
- [ ] Table scrolls horizontally on small screens (`overflow-x-auto`)

### Performance
- [ ] No images without `width`/`height` (prevents layout shift)
- [ ] Heavy components lazy-loaded with `dynamic(() => import(...))`
- [ ] Recharts wrapped in `<Suspense>`
- [ ] No `useEffect` polling — use React Query `refetchInterval`

### Code Quality
- [ ] TypeScript — no `any` unless unavoidable
- [ ] No hardcoded API URLs — use `api` from `@/lib/api`
- [ ] Error boundary or error handling in mutations
- [ ] Consistent naming (camelCase functions, PascalCase components)

---

## Anti-patterns (never do these in SellSync)

- `style={{ border: '1px solid hsl(var(--border))' }}` — CSS vars don't work in inline styles
- White or light gray page backgrounds
- Inter, Roboto, or Arial as the primary font (system stack is already set)
- `console.log` left in production components
- `<img>` without `alt` attribute
- Bare `fetch()` calls — always use the `api` axios instance
- `localStorage` for auth tokens (use `sessionStorage`)
- Recharts `<Area yAxisId={n}>` without matching `<YAxis yAxisId={n}>`
