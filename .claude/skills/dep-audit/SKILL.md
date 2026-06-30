---
name: dep-audit
description: >
  Use this skill when the user asks to "audit dependencies", "check npm vulnerabilities",
  "check outdated packages", "supply chain audit", or "check CVEs in packages".
  Runs npm audit across all workspaces, identifies vulnerable packages, checks for
  outdated versions with security patches, and flags suspicious packages.
metadata:
  author: sellsync-project
  version: "1.0"
---

# Dependency Security Audit

## Purpose

Audit all npm dependencies in this Turborepo monorepo for known CVEs, outdated packages
with security patches available, and supply-chain risks.

## Workspaces to Audit

- Root `package.json`
- `apps/web/package.json`
- `apps/api/package.json`
- `apps/mobile/package.json` (if exists)
- `packages/database/package.json`
- `packages/integrations/package.json`
- `packages/nfe/package.json`

## Audit Steps

### Step 1 — npm audit

```bash
cd /home/user/auto-pecas-rj
npm audit --audit-level=moderate 2>&1
```

Parse the output and report:
- All CRITICAL vulnerabilities (must fix immediately)
- All HIGH vulnerabilities (fix before next release)
- MODERATE vulnerabilities (fix when convenient)
- Number of LOW/INFO (mention count only)

### Step 2 — Check key package versions

For each workspace, read the package.json and flag packages that are known to have
had critical CVEs in older versions:

| Package | Safe version floor | Risk if older |
|---|---|---|
| `jsonwebtoken` | ≥ 9.0.0 | CVE-2022-23529 (algorithm confusion) |
| `next` | ≥ 14.2.0 | CVE-2024-34351, CVE-2024-46982 |
| `fastify` | ≥ 4.28.0 | various |
| `axios` | ≥ 1.6.0 | CVE-2023-45857 (CSRF via header injection) |
| `prisma` | ≥ 5.0.0 | prototype pollution in older versions |
| `sharp` | ≥ 0.33.0 | libvips CVEs |
| `undici` | ≥ 5.28.4 | CVE-2024-30260, CVE-2024-30261 |
| `ws` | ≥ 8.17.1 | CVE-2024-37890 (DoS) |
| `braces` | ≥ 3.0.3 | CVE-2024-4068 (ReDoS) |
| `tar` | ≥ 6.2.1 | CVE-2024-28863 |

### Step 3 — Outdated packages with patches

```bash
cd /home/user/auto-pecas-rj
npm outdated --workspaces 2>&1 | head -60
```

Flag only packages where a PATCH version is available (x.y.Z → x.y.Z+1) —
these are likely security fixes. Major version bumps are optional to report.

### Step 4 — Suspicious packages check

Read each package.json and check for:
1. Packages with very few downloads or obscure authors
2. Typosquatting: packages with names similar to popular ones (e.g., `fastfiy` vs `fastify`)
3. Packages that should never be in production dependencies (e.g., test tools in `dependencies` not `devDependencies`)
4. Packages with overly broad permissions in `.npmrc` (e.g., `unsafe-perm=true`)

### Step 5 — Lock file consistency

Check if `package-lock.json` exists at root and is committed (not in .gitignore).
Missing lock file = reproducibility risk = supply chain risk.

## Output Format

```
=== DEPENDENCY SECURITY AUDIT ===

CRITICAL VULNERABILITIES (fix immediately):
  [package@version] CVE-XXXX-XXXXX — description
  Fix: npm install package@safe-version

HIGH VULNERABILITIES:
  ...

KEY PACKAGES STATUS:
  ✓ next@15.x.x — OK
  ✗ axios@0.27.x — outdated, CVE-2023-45857 fixed in 1.6.0

OUTDATED WITH PATCHES:
  package: 1.2.3 → 1.2.5 (patch available)

RECOMMENDATIONS:
  1. ...
  2. ...

SUMMARY: X critical, Y high, Z moderate issues found.
```
