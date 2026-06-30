---
name: sentry-node
description: >
  Full Sentry SDK setup for the SellSync Fastify 5 API (Node.js ESM).
  Use when asked to "add Sentry to the API", "configure error monitoring on the backend",
  "setup Sentry on Fastify", "monitor API errors", or "add tracing to the API".
  Source: getsentry/sentry-for-ai (official). Covers: ESM instrument file,
  Fastify error handler, graceful shutdown, multi-tenant user context, BullMQ worker tracing.
license: Apache-2.0
metadata:
  source: getsentry/sentry-for-ai (official)
  stack: fastify5, nodejs22, typescript, esm, bullmq, prisma
  project: apps/api
---

# Sentry Node.js SDK — SellSync API (Fastify 5)

## Project Context

- App: `apps/api` — Fastify 5, Node.js 22, TypeScript, ESM modules
- Entry: `apps/api/src/index.ts`
- Workers: `apps/api/src/workers/` (BullMQ — order, inventory, nfe, webhook, listing)
- ORM: Prisma (queries auto-traced by Sentry OpenTelemetry)
- Cache/Queues: Redis + BullMQ (Upstash)
- Sentry already referenced: `SENTRY_DSN` env var checked in `apps/api/src/index.ts`

---

## Phase 1 — Detect

```bash
cd apps/api

# Check if Sentry is already installed
cat package.json | grep sentry

# Check current entry point and module system
grep '"type"' package.json        # should be "module" for ESM
grep '"main"\|"start"' package.json

# Check current Sentry usage
grep -r "sentry\|SENTRY" src/ --include="*.ts" | head -10
```

---

## Phase 2 — Install

```bash
cd apps/api
npm install @sentry/node --save
```

---

## Phase 3 — Implement (ESM — Fastify 5)

### 3.1 — `apps/api/src/instrument.ts` (MUST load first)

```typescript
// This file MUST be imported before any other import in index.ts
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,

  environment: process.env.NODE_ENV ?? 'development',

  // Tracing — Prisma queries auto-traced via OpenTelemetry
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Include local variables in stack traces (invaluable for debugging)
  includeLocalVariables: true,

  // Structured logs to Sentry
  enableLogs: true,

  integrations: [
    // Auto-instrument Node.js HTTP, fetch, etc.
    Sentry.nodeRuntimeMetricsIntegration(),
  ],

  beforeSend(event) {
    // Don't send 4xx client errors — only real server errors
    const statusCode = (event.extra?.statusCode as number) ?? 500
    if (statusCode >= 400 && statusCode < 500) return null
    return event
  },
})
```

### 3.2 — Update `apps/api/src/index.ts` (import instrument first)

```typescript
// FIRST LINE — before any other import
import './instrument.js'

import Fastify from 'fastify'
import * as Sentry from '@sentry/node'
// ... rest of imports

async function main() {
  const app = Fastify({ logger: true })

  // Register Sentry error handler AFTER all routes
  Sentry.setupFastifyErrorHandler(app)

  // ... register routes, plugins, etc.

  await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
}

main().catch((err) => {
  Sentry.captureException(err)
  process.exit(1)
})
```

### 3.3 — Graceful shutdown (flush Sentry before exit)

Add to `apps/api/src/index.ts`:

```typescript
async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`)
  await Sentry.close(2000)  // flush pending events with 2s timeout
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
```

### 3.4 — Set multi-tenant user context per request

In `apps/api/src/lib/auth-middleware.ts` (or wherever JWT is verified), after decoding the token:

```typescript
import * as Sentry from '@sentry/node'

// After req.user is set:
Sentry.setUser({
  id: req.user.userId,
  // email: req.user.email, // if available in JWT
})
Sentry.setTag('tenant_id', req.user.tenantId)
Sentry.setTag('role', req.user.role)

// Clear on request end:
reply.addHook('onSend', () => {
  Sentry.setUser(null)
})
```

### 3.5 — BullMQ Worker instrumentation

For each worker in `apps/api/src/workers/`:

```typescript
import * as Sentry from '@sentry/node'

// Wrap the worker processor function:
worker.on('failed', (job, error) => {
  Sentry.withScope((scope) => {
    scope.setTag('worker', 'order-worker')
    scope.setExtra('job_id', job?.id)
    scope.setExtra('job_data', job?.data)
    Sentry.captureException(error)
  })
})
```

---

## Phase 4 — Prisma Query Tracing (Auto)

Prisma is automatically traced via Sentry's OpenTelemetry integration when `@sentry/node` is initialized with `tracesSampleRate > 0`. No additional configuration needed.

To verify, check Sentry Performance → Transactions after triggering an API call.

---

## Phase 5 — Structured Logging

Replace `console.log/warn/error` in critical paths with Sentry structured logs:

```typescript
import * as Sentry from '@sentry/node'
const { logger } = Sentry

// Info log — visible in Sentry Logs tab
logger.info('Order processed', { orderId, tenantId, marketplace })

// Error with context
logger.error('NFe emission failed', { orderId, error: err.message })

// Or use captureException for caught errors with context:
Sentry.withScope((scope) => {
  scope.setExtra('order_id', orderId)
  scope.setExtra('tenant_id', tenantId)
  Sentry.captureException(error)
})
```

---

## Environment Variables

Add to `apps/api/.env` and Render environment variables:

```bash
SENTRY_DSN=https://xxxxx@oXXXXXX.ingest.sentry.io/XXXXXXX
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=sellsync-api

# Optional — enable source map upload during build
SENTRY_AUTH_TOKEN=sntrys_eyJ...
```

Add to `.gitignore`:
```
.sentryclirc
.env.sentry-build-plugin
```

---

## Verification

```typescript
// Temporary — add to a test route, trigger it, then delete:
app.get('/sentry-test', async () => {
  throw new Error('Sentry API test error — delete me')
})
```

Hit `GET /sentry-test` and check Sentry Issues within ~30 seconds.

---

## Source Map Upload (Production Builds)

Add to `apps/api/package.json` build script:

```json
{
  "scripts": {
    "build": "tsc && npx @sentry/cli releases files $npm_package_version upload-sourcemaps ./dist --url-prefix '~/dist'"
  }
}
```

Or use the Sentry webpack/esbuild plugin in your bundler config.

---

## Notes for SellSync

- **Existing Sentry init**: `apps/api/src/index.ts` already has a lazy `SENTRY_DSN` check. Replace it with the `instrument.ts` pattern above for proper ESM hoisting.
- **4xx filtering**: The `beforeSend` hook filters out client errors (validation errors, not-found) — only real server errors go to Sentry.
- **Free tier**: Sentry free tier = 5k errors/month + 10k transactions/month. Sufficient for MVP. Set `tracesSampleRate: 0.1` in production to stay within limits.
- **Render hibernation**: If the free tier API sleeps, Sentry events from workers won't flush. Upgrade Render tier or use the graceful shutdown pattern above.
- **Multi-tenant tagging**: Always set `tenant_id` tag — makes it trivial to filter errors by customer in Sentry.
