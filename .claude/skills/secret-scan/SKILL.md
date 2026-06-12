---
name: secret-scan
description: >
  Use this skill when the user asks to "scan for secrets", "find hardcoded credentials",
  "check for exposed tokens", "find API keys in code", or "secret detection".
  Scans the entire codebase for hardcoded secrets, credentials, API keys, tokens,
  and passwords that should be stored in environment variables instead.
  Also checks git history for accidentally committed .env files.
metadata:
  author: sellsync-project
  version: "1.0"
---

# Secret Scanner

## Purpose

Find hardcoded secrets, credentials, and sensitive values in the SellSync codebase
before they end up in production or get committed to the public repository.

## Scan Targets

All files in:
- `apps/api/src/`
- `apps/web/src/`
- `packages/`
- Config files: `*.config.*`, `*.toml`, `*.yaml`, `*.yml`, `*.json` (except package-lock)
- CI/CD: `.github/workflows/`
- Docker: `Dockerfile`, `docker-compose*.yml`

Exclude: `node_modules/`, `dist/`, `build/`, `.next/`, `*.test.*`, `*.spec.*`

## Detection Patterns

### Pattern 1 — Explicit secret variables
Search for assignments that look like they contain real values (not placeholders):

```bash
grep -rn --include="*.ts" --include="*.js" --include="*.env*" \
  -E "(password|secret|token|key|api_key|apikey|passwd|credentials|auth)\s*[:=]\s*['\"][^'\"]{8,}['\"]" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
  /home/user/auto-pecas-rj/
```

### Pattern 2 — Known secret formats (regex)
Look for values matching known secret formats:

| Type | Pattern |
|---|---|
| JWT token | `eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}` |
| Vercel token | `vcp_[A-Za-z0-9]{40,}` |
| Stripe key | `sk_(live\|test)_[A-Za-z0-9]{24,}` |
| Stripe publishable | `pk_(live\|test)_[A-Za-z0-9]{24,}` |
| AWS key | `AKIA[A-Z0-9]{16}` |
| AWS secret | `[A-Za-z0-9/+=]{40}` (near "aws_secret") |
| Sentry DSN | `https://[a-f0-9]+@[a-z0-9.]+\.ingest\.sentry\.io` |
| Resend API key | `re_[A-Za-z0-9]{32,}` |
| GitHub token | `gh[ps]_[A-Za-z0-9]{36,}` |
| Mercado Livre | `APP-[0-9]{15,}` |
| Generic base64 secret | long base64 strings (≥ 40 chars) near "secret" or "key" |

### Pattern 3 — Environment variable leakage in frontend
Check `apps/web/src/` for:
- Any `process.env.ANYTHING` that doesn't start with `NEXT_PUBLIC_`
  (server env vars exposed to client bundle)
- Hardcoded URLs containing credentials: `postgres://user:pass@host`

### Pattern 4 — Weak defaults
Check `apps/api/src/index.ts` and config files for:
- `JWT_SECRET` fallback values like `'secret'`, `'changeme'`, `'your-secret-here'`
- Database URLs with default/empty passwords
- Redis URLs without passwords

### Pattern 5 — Git history check
```bash
# Check if any .env file was ever committed
git -C /home/user/auto-pecas-rj log --all --full-history -- "*.env" "**/.env"

# Check for the known exposed Vercel token in git history
# Search for any vcp_ token in git history
git -C /home/user/auto-pecas-rj log --all -p -G "vcp_[A-Za-z0-9]{40,}" 2>/dev/null | head -5

# Check .gitignore to ensure .env files are excluded
cat /home/user/auto-pecas-rj/.gitignore | grep -i env
```

### Pattern 6 — CI/CD secrets exposure
Check `.github/workflows/*.yml` for:
- Secrets printed with `echo` or `run: echo $SECRET`
- Secrets passed as build args in Docker (visible in image layers)
- Unmasked secrets in log output

## Severity Classification

| Finding | Severity |
|---|---|
| Real credential/token with valid format in source code | CRITICAL |
| JWT secret with weak value (< 32 chars or default) | CRITICAL |
| Plaintext marketplace accessToken in DB (code confirms) | HIGH |
| Server-side env var exposed to client bundle | HIGH |
| .env file in git history | HIGH |
| Weak default that only applies in development | MEDIUM |
| TODO comment with placeholder credential | LOW |
| Test credential in test file | INFO |

## Known Issues (Pre-confirmed)

These are already known from the project context — verify if still present:

1. **Vercel token** (value stored in project secrets, starts with `vcp_`)
   exposed in chat history → must be revoked at vercel.com/account/tokens

2. **Marketplace accessToken** stored plaintext in `Store.accessToken` DB column
   → needs AES-256 encryption at application layer

## Output Format

```
=== SECRET SCAN RESULTS ===

CRITICAL:
  [TYPE] File: path/to/file.ts:42
  Value (masked): vcp_****...****
  Risk: This Vercel token allows full deployment access.
  Action: Revoke immediately at vercel.com/account/tokens, then rotate.

HIGH:
  ...

CLEAN (no issues found in):
  - JWT secret handling ✓
  - Database URL handling ✓
  - ...

TOTAL: X secrets found requiring action.
```

## Instructions

1. Run each grep pattern using the Bash tool.
2. For each match, read the surrounding context (±5 lines) to confirm it's a real secret vs a placeholder.
3. Mask the middle of any real secret value found (show first 4 + last 4 chars only).
4. Never output a full real secret — always mask it.
5. For each finding, provide the exact remediation step (which file to change, what to use instead).
6. Check the known issues list and confirm their current status.
