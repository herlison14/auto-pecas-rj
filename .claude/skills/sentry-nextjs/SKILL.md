---
name: sentry-nextjs
description: >
  Full Sentry SDK setup for the SellSync Next.js 15 frontend (App Router).
  Use when asked to "add Sentry to the frontend", "configure error monitoring",
  "setup session replay", "add tracing to Next.js", or "monitor frontend errors".
  Source: getsentry/sentry-for-ai (official) + UltronCore/claude-skill-vault.
  Supports: error monitoring, tracing, session replay, logging, global error boundary.
license: Apache-2.0
metadata:
  source: getsentry/sentry-for-ai (official)
  stack: nextjs15, app-router, react19, typescript
  project: apps/web
---

# Sentry Next.js SDK — SellSync Frontend

## Project Context

- App: `apps/web` — Next.js 15, App Router, React 19, TypeScript
- Existing error boundary: `apps/web/src/components/ui/error-boundary.tsx` (wraps dashboard)
- Root layout: `apps/web/src/app/layout.tsx`
- Environment variable already present in Render: `SENTRY_DSN` (optional — only activates if set)

---

## Phase 1 — Detect

Run these before implementing:

```bash
cd apps/web

# Check current Next.js version
cat package.json | grep '"next"'

# Check if Sentry is already installed
cat package.json | grep sentry

# Check for existing instrumentation.ts
ls instrumentation.ts instrumentation-client.ts 2>/dev/null

# Check next.config.ts for existing Sentry wrapping
grep -i sentry next.config.ts 2>/dev/null || echo "No Sentry in next.config.ts"
```

---

## Phase 2 — Install

```bash
cd apps/web
npm install @sentry/nextjs --save
```

---

## Phase 3 — Implement (Manual Setup — App Router)

### 3.1 — `apps/web/instrumentation-client.ts` (Browser)

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Tracing
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Session Replay — only on error (saves quota)
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  // Structured logs
  enableLogs: true,

  integrations: [Sentry.replayIntegration()],

  // Tag every event with tenant/user context
  beforeSend(event) {
    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
```

### 3.2 — `apps/web/sentry.server.config.ts` (Node.js server runtime)

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  includeLocalVariables: true,
  enableLogs: true,

  beforeSend(event) {
    // Don't send errors in development unless explicitly testing
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV_ENABLED) {
      return null
    }
    return event
  },
})
```

### 3.3 — `apps/web/sentry.edge.config.ts` (Edge runtime)

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  enableLogs: true,
})
```

### 3.4 — `apps/web/instrumentation.ts` (Server-side registration)

```typescript
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
```

### 3.5 — `apps/web/app/global-error.tsx` (Global error boundary)

```tsx
'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({ error, reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body style={{ background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', color: '#f1f5f9', maxWidth: 400, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <AlertTriangle size={40} color="#f87171" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
            Registramos o erro automaticamente. Tente novamente.
          </p>
          <button
            onClick={reset}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
```

### 3.6 — Wrap `apps/web/next.config.ts` with Sentry

```typescript
import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // ... existing config (rewrites, etc.)
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',   // routes Sentry events through the Next.js server (bypass ad blockers)
  silent: !process.env.CI,
  disableLogger: true,
})
```

---

## Phase 4 — Set User Context (Multi-tenant SaaS)

In `apps/web/src/components/ui/auth-guard.tsx`, after validating the token, set Sentry user context:

```typescript
import * as Sentry from '@sentry/nextjs'

// After successful /auth/me call:
Sentry.setUser({
  id: data.id,
  email: data.email,
  // Custom tags for multi-tenant debugging
})
Sentry.setTag('tenant_id', data.tenant?.id)
Sentry.setTag('plan', data.tenant?.plan)
```

And in `apps/web/src/lib/auth.ts` logout():
```typescript
import * as Sentry from '@sentry/nextjs'
// Inside logout():
Sentry.setUser(null)
```

---

## Environment Variables

Add to `.env` (development) and to Vercel environment variables (production):

```bash
# Frontend — public (visible in browser bundle)
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@oXXXXXX.ingest.sentry.io/XXXXXXX

# Server-side only
SENTRY_DSN=https://xxxxx@oXXXXXX.ingest.sentry.io/XXXXXXX
SENTRY_AUTH_TOKEN=sntrys_eyJ...   # for source map upload — add to .gitignore
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=sellsync-web
```

Add to `.gitignore`:
```
.env.sentry-build-plugin
```

---

## Verification

```typescript
// Temporary test — add to any page, confirm in Sentry, then delete:
throw new Error('Sentry test error — delete me')
```

Check Sentry Issues dashboard within ~30 seconds.

---

## Notes for SellSync

- The existing `error-boundary.tsx` in `components/ui/` handles dashboard errors — keep it but add `Sentry.captureException(error)` inside its `componentDidCatch` method
- The `SENTRY_DSN` env var is already referenced in `apps/api/src/index.ts` (Sentry is already optional there) — use same project or create separate `sellsync-web` project in Sentry
- `tunnelRoute: '/monitoring'` routes Sentry events through the Next.js proxy — important since the app uses same-origin rewrites
- Disable in development by default (see `beforeSend`) to avoid noise during local dev
