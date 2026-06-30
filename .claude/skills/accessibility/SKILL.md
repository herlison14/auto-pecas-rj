---
name: accessibility
description: >
  Use when asked to "check accessibility", "audit a11y", "WCAG compliance",
  "make accessible", "fix accessibility issues", or "screen reader support".
  Performs a deep WCAG 2.2 AA accessibility audit of SellSync frontend components.
  Checks contrast ratios, keyboard navigation, ARIA labels, focus management,
  semantic HTML, form accessibility, and motion sensitivity.
  Fixes issues directly in code when asked.
metadata:
  author: sellsync-project
  version: "1.0"
  standard: WCAG 2.2 AA
  based-on: UI/UX Pro Max (88k⭐) + Vercel Web Design Guidelines
---

# Accessibility Audit (WCAG 2.2 AA)

## Purpose

Ensure SellSync meets WCAG 2.2 AA standards — the legal minimum in Brazil
(LBI — Lei Brasileira de Inclusão, Lei nº 13.146/2015) and required for enterprise customers.

This skill audits code and applies fixes directly. It is not a theoretical guide —
it reads real files and makes real changes.

## WCAG 2.2 AA Criteria Checklist

### 1. Perceivable

#### 1.1 — Text Alternatives
- [ ] All `<img>` and `<Image>` have meaningful `alt` text (or `alt=""` for decorative)
- [ ] Icon-only buttons have `aria-label` describing the action
- [ ] Charts have a text description or data table alternative

#### 1.2 — Color Contrast Ratios
Minimum ratios:
- Normal text (< 18px): **4.5:1**
- Large text (≥ 18px bold or ≥ 24px): **3:1**
- UI components / icons: **3:1**

SellSync palette risk matrix:
| Text color | Background | Estimated ratio | Status |
|---|---|---|---|
| `#f1f5f9` | `rgba(15,15,25,0.9)` | ~15:1 | ✅ Pass |
| `#94a3b8` | `rgba(15,15,25,0.9)` | ~7:1 | ✅ Pass |
| `#64748b` | `rgba(15,15,25,0.9)` | ~4.6:1 | ⚠️ Borderline |
| `#475569` | `rgba(15,15,25,0.9)` | ~3.2:1 | ❌ Fail for body |
| `#334155` | `rgba(15,15,25,0.9)` | ~2.1:1 | ❌ Fail |
| `#818cf8` | `rgba(15,15,25,0.9)` | ~5.8:1 | ✅ Pass |

Flag any use of `#475569` or darker on dark backgrounds for normal text.

#### 1.3 — Adaptable
- [ ] Semantic HTML: headings (`h1`-`h6`) in logical order, no skipped levels
- [ ] Lists use `<ul>/<ol>/<li>`, not `<div>` with manual bullets
- [ ] Tables use `<table><thead><th scope="col">` (not CSS grids faking a table)
- [ ] Page regions have landmark roles: `<main>`, `<nav>`, `<header>`, `<footer>`, `<aside>`

#### 1.4 — Distinguishable
- [ ] Color is NOT the only way to convey status (add icon or text too)
  - Bad: ● green dot for "active", ● gray dot for "inactive" — no text
  - Good: ● green dot + "Ativo" text
- [ ] Text can be resized to 200% without horizontal scroll on 1280px viewport
- [ ] No text inside images

### 2. Operable

#### 2.1 — Keyboard Accessible
- [ ] ALL interactive elements reachable by Tab in logical order
- [ ] No keyboard traps (except modals — which should trap focus intentionally)
- [ ] No functionality requires mouse hover exclusively
- [ ] `div`/`span` with `onClick` should be `button` or have `role="button"` + `tabIndex={0}` + `onKeyDown`

Fix pattern for non-semantic clickable divs:
```tsx
// Before:
<div onClick={handleClick} className="cursor-pointer">...</div>

// After:
<button
  onClick={handleClick}
  type="button"
  className="cursor-pointer bg-transparent border-0 p-0"
>...</button>
```

#### 2.2 — Focus Visible
- [ ] All focused elements have a **visible focus ring**
- [ ] SellSync theme: use `outline: 2px solid #6366f1; outline-offset: 2px` for focus
- [ ] `outline: none` or `outline: 0` only acceptable when a custom `:focus-visible` style is provided
- [ ] Check `globals.css` for focus ring definitions

Check for this anti-pattern:
```css
* { outline: none; }  /* NEVER do this */
```

#### 2.3 — Seizures
- [ ] No content flashes more than 3 times per second
- [ ] `animate-glow-pulse` — verify pulse duration is > 333ms

#### 2.4 — Navigable
- [ ] Page has a `<title>` tag (Next.js: via `metadata` export)
- [ ] Links have descriptive text (not "clique aqui" or "saiba mais")
- [ ] Skip navigation link at top of page: `<a href="#main" className="sr-only focus:not-sr-only">Ir ao conteúdo</a>`

#### 2.5 — Input Modalities (WCAG 2.2 new)
- [ ] Touch targets ≥ 24×24 CSS pixels (WCAG 2.5.8 AA)
- [ ] Preferred: 44×44px for primary actions
- [ ] Drag-and-drop actions have an alternative keyboard method

### 3. Understandable

#### 3.1 — Language
- [ ] `<html lang="pt-BR">` set in root layout
- [ ] Check `apps/web/src/app/layout.tsx` for `lang` attribute

#### 3.2 — Predictable
- [ ] No unexpected context change on focus
- [ ] Consistent navigation across all pages (same sidebar, same header)
- [ ] Consistent naming (same action called the same thing everywhere)

#### 3.3 — Input Assistance
- [ ] Form validation errors are:
  - Identified in text (not just red color)
  - Associated with the field via `aria-describedby`
  - Announced via `role="alert"` or `aria-live="polite"`
- [ ] Required fields marked with `aria-required="true"` or `required`
- [ ] Input types are semantic: `type="email"`, `type="tel"`, `type="password"` etc.

```tsx
// Good form field with accessibility:
<div>
  <label htmlFor="email" className="text-xs font-medium" style={{ color: '#94a3b8' }}>
    E-mail <span aria-hidden="true" style={{ color: '#f87171' }}>*</span>
  </label>
  <input
    id="email"
    type="email"
    required
    aria-required="true"
    aria-describedby={error ? 'email-error' : undefined}
    aria-invalid={!!error}
    ...
  />
  {error && (
    <p id="email-error" role="alert" style={{ color: '#f87171' }}>
      {error}
    </p>
  )}
</div>
```

### 4. Robust

#### 4.1 — Compatible
- [ ] Valid HTML (no duplicate IDs, proper nesting)
- [ ] ARIA roles used correctly (don't use `role="button"` on `<button>`)
- [ ] Live regions for dynamic content: `aria-live="polite"` for notifications,
  `aria-live="assertive"` for critical errors

### 5. Motion & Animation (WCAG 2.3.3 — AAA, but best practice)

Check `globals.css` for reduced-motion support:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in,
  .animate-fade-in-scale,
  .animate-slide-in-left,
  .animate-glow-pulse,
  .animate-shimmer {
    animation: none;
    transition: none;
  }
}
```

If this rule is missing — add it (it's a one-liner fix with high impact).

## Modal Accessibility Pattern

```tsx
// Accessible modal with focus trap:
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  // focus trap: first focusable element gets focus on mount
>
  <h2 id="modal-title">Título do modal</h2>
  <button onClick={onClose} aria-label="Fechar">
    <X className="h-4 w-4" />
  </button>
  {/* content */}
</div>
```

Also ensure:
- `useEffect` moves focus to modal on open: `modalRef.current?.focus()`
- Pressing Escape closes the modal
- Focus returns to the trigger button on close

## Screen Reader Test Commands

```bash
# Install screen reader simulator (for testing without real screen reader)
npx axe-core-cli http://localhost:3000/dashboard --exit

# Or use browser DevTools > Accessibility tree
# Chrome: F12 → Elements → Accessibility tab
```

## Output Format

For each finding:
```
[WCAG X.X.X] Criterion name — Severity
File: apps/web/src/.../component.tsx:LINE
Issue: What is wrong and why it fails WCAG.
Current code: <button><X /></button>
Fixed code:   <button aria-label="Fechar"><X /></button>
Impact: Screen reader users won't know what this button does.
```

At the end:
```
WCAG 2.2 AA COMPLIANCE SUMMARY
  Failing criteria: N
  Passing criteria: N
  Estimated compliance: X%
  
Priority fixes (ordered by user impact):
  1. ...
  2. ...
```

## Instructions

1. Read the files in scope.
2. Check every criterion in the checklist above against actual code.
3. Only report real findings (include file + line number).
4. Estimate contrast ratios for color pairs you encounter.
5. After reporting, ask if the user wants the fixes applied automatically.
6. Apply fixes with the Edit tool, one file at a time, verifying each.
