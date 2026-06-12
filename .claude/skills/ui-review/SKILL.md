---
name: ui-review
description: >
  Use when asked to "review the UI", "audit components", "check design consistency",
  "review the frontend", "check accessibility", "design QA", or "UI audit".
  Audits existing SellSync React/Next.js components against: design system consistency,
  WCAG 2.2 AA accessibility, performance, responsive behavior, and code quality.
  Produces a prioritized list of findings with exact file:line references and fixes.
metadata:
  author: sellsync-project
  version: "1.0"
  based-on: UI/UX Pro Max (88k⭐) + Vercel Web Design Guidelines
---

# SellSync UI Review

## Purpose

Audit existing frontend components and pages for design consistency, accessibility,
performance, and code quality. This is a code review skill — it reads real files
and reports real findings, not hypothetical issues.

## Scope

When the user says "review [page]" or "audit [component]", scan:
1. The specific file(s) mentioned
2. Any child components imported by them
3. Shared components they use from `apps/web/src/components/`

If no specific scope given, audit the highest-traffic pages in this order:
1. `apps/web/src/app/dashboard/page.tsx` — dashboard home
2. `apps/web/src/app/dashboard/orders/page.tsx` — orders
3. `apps/web/src/app/dashboard/products/page.tsx` — products
4. `apps/web/src/app/dashboard/integrations/page.tsx` — integrations
5. `apps/web/src/components/ui/` — shared component library

## Audit Categories

### Category A — Design System Consistency (HIGH)

Check every component for deviations from the SellSync palette:

1. **CSS vars in inline styles**: Flag any `style={{ color: 'hsl(var(--...))' }}` or
   `style={{ border: '1px solid var(--border)' }}` — these silently fail in React.
   Fix: replace with explicit hex values from the design system.

2. **Wrong background colors**: Any white, light gray, or off-white backgrounds
   (`#fff`, `#f9f9f9`, `bg-white`, `bg-gray-50`, etc.) in dashboard pages.

3. **Color inconsistencies**: Colors used that don't match the palette
   (e.g., `#6c63ff` instead of `#6366f1`).

4. **Border radius inconsistency**: Mix of `rounded-md` / `rounded-lg` / `rounded-xl`
   without a clear pattern. SellSync uses `rounded-lg` for inputs/buttons,
   `rounded-xl` for cards/modals.

5. **Icon library mixing**: Any use of `react-icons`, `heroicons`, or emoji as icons
   alongside `lucide-react` — should be lucide-only.

### Category B — Accessibility (CRITICAL — WCAG 2.2 AA)

Run these checks on every component:

1. **Color contrast**: For each text color/background pair, estimate contrast ratio.
   Flag any combination likely below 4.5:1 (normal text) or 3:1 (large text/icons).
   Common risk: `#64748b` text on `rgba(15,15,25,0.9)` background → check ratio.

2. **Missing aria-label**: Interactive elements (`<button>`, `<a>`) with no text content
   and no `aria-label`. Example: icon-only buttons.
   ```tsx
   // Bad:
   <button onClick={...}><Trash className="h-4 w-4" /></button>
   // Good:
   <button aria-label="Excluir item" onClick={...}><Trash className="h-4 w-4" /></button>
   ```

3. **Form labels**: Every `<input>`, `<select>`, `<textarea>` must have either:
   - A `<label htmlFor="id">` wrapping or referencing it
   - An `aria-label` attribute
   - An `aria-labelledby` pointing to a visible label

4. **Focus management in modals**: When a modal opens, does focus move inside it?
   Does pressing Escape close it? Is there a visible focus ring?

5. **Table headers**: `<th>` elements should have `scope="col"` or `scope="row"`.
   Data tables without headers at all.

6. **Keyboard navigation**: Can the user Tab through all interactive elements?
   Are there any `div onClick` that should be `button`?
   ```tsx
   // Bad:
   <div onClick={handleClick} className="cursor-pointer">Click me</div>
   // Good:
   <button onClick={handleClick}>Click me</button>
   ```

7. **Images**: Every `<img>` and `<Image>` needs `alt`. Decorative images: `alt=""`.

8. **Error announcements**: Are error messages wrapped in `role="alert"`?

9. **reduced-motion**: Do animations check `prefers-reduced-motion`?
   ```css
   @media (prefers-reduced-motion: reduce) { .animate-* { animation: none; } }
   ```
   Check `globals.css` for this rule.

### Category C — Performance

1. **Missing Suspense boundaries**: Pages that import heavy components
   (Recharts, complex tables) without `<Suspense fallback={...}>`.

2. **Missing dynamic imports**: Large components loaded eagerly that could be lazy:
   - Chart components: `dynamic(() => import('recharts'), { ssr: false })`
   - Modal content
   - Tab panels not visible on initial render

3. **Layout shift risks**: `<img>` tags without `width`/`height` or without
   `next/image` component.

4. **Unnecessary re-renders**: Components that pass new object/array literals
   as props on every render without `useMemo`/`useCallback`.
   ```tsx
   // Bad — creates new object every render:
   <Chart config={{ color: '#6366f1' }} />
   // Good:
   const chartConfig = useMemo(() => ({ color: '#6366f1' }), [])
   <Chart config={chartConfig} />
   ```

5. **Polling without cleanup**: `setInterval` in `useEffect` without returning a
   cleanup function.

### Category D — Responsive Design

1. **Fixed pixel widths**: Elements with `width: 400px` that should be `w-full` or `max-w-*`.

2. **Horizontal overflow**: Tables, grids, or flex rows that overflow on narrow screens
   without `overflow-x-auto`.

3. **Touch targets**: Interactive elements smaller than 44×44px on mobile.
   Minimum: `min-h-[44px] min-w-[44px]` for buttons that appear on mobile.

4. **Text truncation**: Long strings (product names, store names, emails) that overflow
   their container without `truncate` or `line-clamp-*`.

### Category E — Code Quality

1. **TypeScript `any`**: Flag explicit `any` casts — suggest proper typing.

2. **Direct fetch calls**: Any `fetch('/backend/...')` bypassing the `api` axios instance
   (loses auth headers and error interceptor).

3. **Missing error states**: `useMutation` calls without `onError` handler showing
   user-visible feedback.

4. **Missing loading states**: `useQuery` results rendered without checking `isLoading`.

5. **Hardcoded strings**: Brazilian Portuguese strings that should be in a translation
   file if i18n is planned.

6. **Unused imports**: Import statements for components/hooks not used in the file.

## Output Format

```
=== UI REVIEW: [Component/Page Name] ===
File: apps/web/src/...

CRITICAL (fix before next release):
  [A1] CSS var in inline style — apps/web/src/components/ui/sidebar.tsx:87
  Current: style={{ border: '1px solid hsl(var(--border))' }}
  Fix:     style={{ border: '1px solid rgba(255,255,255,0.06)' }}

  [B2] Button without aria-label — apps/web/src/.../page.tsx:142
  Current: <button onClick={del}><X className="h-4 w-4" /></button>
  Fix:     <button aria-label="Fechar" onClick={del}><X className="h-4 w-4" /></button>

HIGH:
  [C2] Heavy chart imported eagerly — page.tsx:5
  Fix: use dynamic(() => import('recharts'), { ssr: false })

MEDIUM:
  ...

LOW / INFO:
  ...

SUMMARY:
  Critical: N | High: N | Medium: N | Low: N
  Estimated fix time: ~X hours
```

## Instructions

1. Read each file in scope using the Read tool.
2. For each finding: confirm it's in the actual code (not assumed) — include line number.
3. Order findings by severity: CRITICAL > HIGH > MEDIUM > LOW.
4. Provide the exact current code and the exact fixed code for each finding.
5. After listing all findings, offer to fix them if the user wants.
6. If the user asks to fix findings, apply them with the Edit tool and verify.
