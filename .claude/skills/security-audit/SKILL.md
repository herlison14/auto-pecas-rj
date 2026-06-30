---
name: security-audit
description: >
  Use this skill when the user asks to "audit security", "check for vulnerabilities",
  "security review", "scan for bugs", "OWASP check", or "find security issues".
  Performs a comprehensive application-level security audit tailored to this project:
  Fastify 5 API + Next.js 15 frontend + Prisma/PostgreSQL + JWT auth + multi-tenant SaaS.
  Covers OWASP Top 10 (2025), CWE Top 25, JWT attacks, multi-tenancy leaks, injection,
  broken auth, IDOR, and SaaS-specific attack vectors.
metadata:
  author: sellsync-project
  version: "1.0"
  stack: fastify5, nextjs15, prisma, postgresql, jwt, bullmq, redis
---

# SellSync Security Audit

## Purpose

Perform a full application-level security audit of the SellSync codebase — a Brazilian
multi-tenant SaaS for marketplace sales management. The audit must cover every attack
surface relevant to this specific stack.

## Scope

- `apps/api/src/` — Fastify 5 REST API (routes, middleware, workers)
- `apps/web/src/` — Next.js 15 frontend (auth, middleware, client code)
- `packages/database/` — Prisma schema + client extensions
- `packages/integrations/` — Marketplace API clients
- Configuration files, environment variable handling, CI/CD workflows

## Audit Phases

### Phase 1 — Authentication & Session Management

Check `apps/api/src/routes/auth.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/middleware.ts`:

1. **JWT configuration**: Is `JWT_SECRET` enforced to be ≥ 64 bytes? Is `alg: none` rejected?
   Look for: `fastify-jwt` config, `app.jwt.sign()` calls, algorithm hardcoded to `HS256`/`RS256`.

2. **Token storage**: Is the token in `sessionStorage` (not `localStorage`)? Is the cookie `HttpOnly`?
   Warn if token is stored in `localStorage` permanently (survives browser restart).

3. **Cookie flags**: Does `setAuthCookie()` set `HttpOnly`, `Secure` (in prod), `SameSite=Strict`?

4. **Token revocation**: Are JWTs stateless with no revocation list? Log finding — acceptable for MVP
   but document the risk for password reset tokens (one-time use not enforced).

5. **2FA bypass**: Can the `/auth/login` flow be completed without the TOTP step if `requires2fa=true`?
   Check that the `tempToken` is not a full JWT (cannot access protected routes).

6. **Password reset tokens**: Is `purpose: 'pwreset'` enforced server-side before resetting?
   Can a normal JWT be used to reset passwords?

7. **Rate limiting**: Are `/auth/login`, `/auth/register`, `/forgot-password` rate-limited?

### Phase 2 — Multi-Tenancy Isolation (CRITICAL for SaaS)

This is the most dangerous class of bug. Check every route in `apps/api/src/routes/`:

1. **tenantId injection**: Does every data-accessing route use `req.user.tenantId` (from JWT)?
   Flag any route that accepts `tenantId` from request body/params instead of JWT.

2. **Cross-tenant IDOR**: For every `findUnique`/`findFirst` by ID (order, product, store, etc.),
   is `tenantId` included in the where clause?
   Example of vulnerability: `prisma.order.findUnique({ where: { id } })` — no tenant check.
   Example of safe code: `prisma.order.findUnique({ where: { id, tenantId } })`.

3. **Bulk operations**: Does every `findMany`, `updateMany`, `deleteMany` include `tenantId`?
   The Prisma guard in `packages/database/src/index.ts` warns but doesn't block — still need code-level checks.

4. **File uploads / imports**: Does the import route (`/import`) scope uploaded data to the tenant?

5. **Webhooks**: Does the webhook handler verify the tenant before processing?

### Phase 3 — Authorization (RBAC)

Check `apps/api/src/lib/rbac.ts` and how routes use `checkRole()`:

1. Are all admin-only routes protected with appropriate role checks?
2. Can an `OPERATOR` role reach `OWNER`-only endpoints?
3. Are team management routes (`/team`) restricted to OWNER/ADMIN?
4. Are billing/plan routes protected from non-owners?

### Phase 4 — Input Validation & Injection

1. **Zod schemas**: Does every route parse the body with a strict Zod schema?
   Flag routes that use `req.body` without `.parse()`.

2. **SQL injection**: Prisma ORM prevents raw SQL injection, but check for `prisma.$queryRaw`
   or `prisma.$executeRaw` with interpolated user input.

3. **NoSQL injection**: Check Redis key construction — are user inputs sanitized before
   being used as BullMQ job names or Redis keys?

4. **Path traversal**: Any file read/write operations using user-supplied paths?

5. **SSRF**: Does any route fetch a URL provided by the user (e.g., webhook URLs)?
   Should validate against an allowlist of safe hosts.

6. **XSS (frontend)**: Check React components for `dangerouslySetInnerHTML`.
   Check if user-generated content (product names, store names) is rendered unsanitized.

### Phase 5 — API Security

1. **CORS**: What origins are allowed? Is `WEB_URL` env var enforced in production?
   Is `credentials: true` combined with wildcard origin `*`?

2. **HTTP methods**: Are routes restricted to only the methods they need (no accidental GET for mutations)?

3. **Response data leakage**: Do API responses expose internal IDs, password hashes, tokens,
   or other sensitive fields that shouldn't be returned?
   Check: does `/auth/me` return `passwordHash`? Does `/team` return tokens?

4. **Mass assignment**: Can a user update fields they shouldn't (e.g., `role`, `tenantId`, `plan`)?
   Check Zod schemas for update routes — are they `strict()` or do they allow extra fields?

5. **Error messages**: Do error responses leak stack traces, SQL errors, or internal paths in production?

### Phase 6 — Secrets & Configuration

1. **Hardcoded secrets**: Any JWT secrets, API keys, or passwords in source code?
2. **Environment variable defaults**: Does the app start with weak defaults (e.g., `JWT_SECRET=secret`)?
   Check `apps/api/src/index.ts` for startup validation.
3. **Exposed tokens in git history**: Check `.env` files for accidental commits.
4. **Vercel token**: Was the Vercel personal access token (starts with `vcp_`) rotated?
   (Known exposed token from chat history — must be revoked in Vercel dashboard.)

### Phase 7 — Cryptography & Data Protection

1. **Password hashing**: Is bcrypt/argon2 used with adequate cost factor (≥ 12 for bcrypt)?
2. **Marketplace tokens**: Are `accessToken` / `refreshToken` in the `Store` model encrypted at rest?
   Currently stored plaintext — HIGH severity finding.
3. **Sensitive data in logs**: Does the Prisma query log or Fastify access log output sensitive values?
4. **TLS**: Is the Redis connection using `rediss://` (TLS) in production?

### Phase 8 — Dependency Security

Run `npm audit --workspaces` and check for:
1. Critical/high severity CVEs in direct dependencies
2. Known vulnerable versions of: express, fastify, jsonwebtoken, prisma, next, axios
3. Packages with suspicious maintainer changes (supply chain)

### Phase 9 — Frontend Security

1. **Content Security Policy**: Is CSP set in `next.config.ts`?
2. **next.config.ts security headers**: Are `X-Frame-Options`, `X-Content-Type-Options`,
   `Referrer-Policy`, `Permissions-Policy` set?
3. **Client-side token exposure**: Is the token accessible from `window` or DevTools console?
4. **API proxy**: The `/backend/*` rewrite — does it blindly proxy all headers including internal ones?

### Phase 10 — Infrastructure & CI/CD

1. **GitHub Actions secrets**: Are secrets scoped to environments (not accessible to PRs from forks)?
2. **Docker image**: Does the Dockerfile run as root? Should use non-root user.
3. **Healthcheck endpoint**: Does `/healthz` expose sensitive info (DB connection string, versions)?
4. **Render free tier**: Are environment variables visible in logs?

## Output Format

For each finding, report:

```
[SEVERITY] Category — Finding title
File: apps/api/src/routes/example.ts:42
Description: What the issue is and why it's dangerous.
PoC: Minimal example of how it could be exploited.
Fix: Specific code change to remediate.
```

Severity levels: CRITICAL / HIGH / MEDIUM / LOW / INFO

At the end, produce a summary table:
| Severity | Count |
|----------|-------|
| CRITICAL | N |
| HIGH | N |
| MEDIUM | N |
| LOW | N |
| INFO | N |

## Instructions

1. Read all files listed in the Scope section using the Read tool.
2. Work through each Phase systematically using Grep and Read tools.
3. For each finding, read the actual code to confirm it's a real issue (not a false positive).
4. Prioritize findings by severity — report CRITICAL and HIGH first.
5. Be specific: include file paths and line numbers.
6. For the multi-tenancy phase (Phase 2), check EVERY route file — this is the highest-risk area.
7. Do not suggest fixes for hypothetical issues — only confirmed findings in the actual code.
