# SellSync — Hub Multichannel
> **Também chamado de**: "projeto Upseller", "auto-pecas-rj" (nome do repo), "SellSync"
> **Branch de trabalho**: `claude/upseller-platform-analysis-n10NA`
> **Governança de código**: Ver `CONTRIBUTING.md` na raiz do repo. Toda contribuição (humana ou IA) deve seguir esse documento.

## O que é este projeto

Plataforma SaaS multi-tenant para gestão de vendas em marketplaces brasileiros (Mercado Livre, Shopee, Amazon, Magalu, Americanas, Shein, TikTok Shop). Produto equivalente ao Upseller/Bling/Tiny, construído do zero.

Monorepo Turborepo com:
- `apps/web` — Next.js 15 (frontend)
- `apps/api` — Fastify 5 (backend REST)
- `apps/mobile` — Expo (React Native)
- `packages/database` — Prisma + PostgreSQL
- `packages/integrations` — clients dos marketplaces
- `packages/nfe` — integração NFe.io

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15, React 19, TailwindCSS 4, Zustand, React Query, Recharts |
| Backend | Fastify 5, Node.js 22, TypeScript |
| Banco | PostgreSQL via Prisma ORM |
| Cache/Filas | Redis + BullMQ |
| Auth | JWT (7 dias), TOTP 2FA opcional |
| Billing | Asaas (FREE / STARTER / GROWTH / PRO) |
| NF-e | NFe.io API |
| Deploy web | Vercel |
| Deploy api | Railway (Docker) |
| Mobile | Expo (React Native) |

---

## Multi-tenancy

Cada empresa é um `Tenant`. Cada `User` pertence a um `Tenant`. Toda query no banco filtra por `tenantId` via `req.user.tenantId` (injetado pelo JWT após autenticação).

Roles: `OWNER > ADMIN > MANAGER > OPERATOR` — verificados via `apps/api/src/lib/rbac.ts`.

---

## Autenticação (fluxo completo)

### Onde vive o token

O JWT fica em **dois lugares simultaneamente**:
1. `localStorage['sellsync:token']` — usado pelo axios interceptor (`api.ts`)
2. Cookie `sellsync:token` — usado pelo Next.js middleware (`middleware.ts`) para proteger rotas SSR

### Por que dois lugares

O `middleware.ts` executa no edge (sem acesso ao `localStorage`), então lê o cookie. O axios lê o `localStorage`. Ambos precisam estar sincronizados.

### Arquivos-chave

**`apps/web/src/lib/auth.ts`** — Zustand store com persist:
- `login()` → chama `POST /auth/login`, grava `localStorage['sellsync:token']` + cookie
- `register()` → chama `POST /auth/register`, mesma gravação
- `logout()` → limpa localStorage + cookie
- `onRehydrateStorage` → ao recarregar a página, re-seta o cookie a partir do Zustand persisted state
- Persist key: `sellsync:auth` (não `sellsync:token`)

**`apps/web/src/lib/api.ts`** — Axios instance:
- `baseURL`: `NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`
- Request interceptor: injeta `Authorization: Bearer <token>` do localStorage
- Response interceptor 401: limpa `localStorage['sellsync:token']`, `localStorage['sellsync:auth']`, cookie, e redireciona para `/login`

**`apps/web/src/middleware.ts`** — Proteção de rotas:
- Rotas públicas: `/login`, `/register`
- Sem cookie → redireciona para `/login`
- Com cookie em rota pública → redireciona para `/dashboard`

### Bug crítico resolvido

O interceptor 401 original só removia `localStorage['sellsync:token']`, mas o Zustand persist guarda em `localStorage['sellsync:auth']`. No próximo `onRehydrateStorage`, o token voltava e o cookie era re-setado → loop infinito de redirect. **Correção**: interceptor remove ambas as chaves + limpa cookie.

---

## Design system (dark premium)

Inspirado em Linear.app. Paleta fixa em `apps/web/src/app/globals.css`.

### Cores base (hex explícito — não usar CSS vars em `style={}`)

```
Background:     #080810
Sidebar:        #0b0b14
Header:         #0f0f1a
Card:           rgba(15,15,25,0.9)
Border:         rgba(255,255,255,0.06)

Primary:        #6366f1 → #8b5cf6 (gradient 135deg)
Primary dim:    rgba(99,102,241,0.15)
Primary border: rgba(99,102,241,0.25)
Primary glow:   rgba(99,102,241,0.3)

Text primary:   #f1f5f9
Text secondary: #94a3b8
Text muted:     #64748b
Text dim:       #475569
Text ghost:     #334155
Text invisible: #1e293b
```

### Regra importante

**Nunca usar `hsl(var(--border))` em atributos `style={}`** em componentes React. CSS variables só funcionam em `className` (Tailwind) ou em CSS puro. Em `style={}` inline, usar sempre hex explícito.

### CSS variables (para uso em `className` / Tailwind)

Definidas em `globals.css`:
- `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--border`, `--ring`

### Animações disponíveis

```css
.animate-fade-in           /* opacity + translateY(8px) */
.animate-fade-in-scale     /* opacity + scale(0.97) */
.animate-slide-in-left     /* opacity + translateX(-8px) */
.animate-glow-pulse        /* box-shadow pulsante */
.animate-shimmer           /* skeleton loader */
```

### Utilitários

```css
.gradient-primary   /* background: linear-gradient(135deg, #6366f1, #8b5cf6) */
.glow-primary       /* box-shadow com brilho roxo */
.glass              /* backdrop-filter: blur(12px) */
```

---

## Sidebar

`apps/web/src/components/ui/sidebar.tsx`

Seções: Operações / Comercial / Análise / Sistema

Rotas disponíveis:
- `/dashboard` — Dashboard
- `/dashboard/orders` — Pedidos
- `/dashboard/inventory` — Estoque
- `/dashboard/products` — Produtos
- `/dashboard/catalog` — Catálogo
- `/dashboard/listings` — Anúncios
- `/dashboard/integrations` — Integrações
- `/dashboard/pricing` — Precificação
- `/dashboard/repricing` — Reprecificação
- `/dashboard/suppliers` — Fornecedores
- `/dashboard/customers` — Clientes
- `/dashboard/financial` — Financeiro
- `/dashboard/returns` — Devoluções
- `/dashboard/performance` — Performance
- `/dashboard/reports` — Relatórios
- `/dashboard/audit` — Auditoria
- `/dashboard/settings` — Configurações

Item ativo: fundo `rgba(99,102,241,0.15)`, borda `rgba(99,102,241,0.25)`, indicador esquerdo `#818cf8`.

---

## API — Rotas implementadas

Todos os prefixos abaixo têm autenticação JWT obrigatória (exceto `/auth`).

| Prefixo | Arquivo |
|---|---|
| `/auth` | routes/auth.ts |
| `/orders` | routes/orders.ts |
| `/inventory` | routes/inventory.ts |
| `/products` | routes/products.ts |
| `/integrations` | routes/integrations.ts |
| `/webhooks` | routes/webhooks.ts |
| `/nfe` | routes/nfe.ts |
| `/pricing` | routes/pricing.ts |
| `/reports` | routes/reports.ts |
| `/billing` | routes/billing.ts |
| `/import` | routes/import.ts |
| `/notifications` | routes/notifications.ts |
| `/team` | routes/team.ts |
| `/financial` | routes/financial.ts |
| `/returns` | routes/returns.ts |
| `/performance` | routes/performance.ts |
| `/repricing` | routes/repricing.ts |
| `/inbox` | routes/notifications.inapp.ts |
| `/catalog` | routes/catalog.ts |
| `/suppliers` | routes/suppliers.ts |
| `/listings` | routes/listings.ts |
| `/audit` | routes/audit.ts |
| `/export` | routes/export.ts |
| `/email-settings` | routes/email-settings.ts |
| `/customers` | routes/customers.ts |
| `/2fa` | routes/two-factor.ts |
| `/healthz` | index.ts (GET) |

---

## Workers (BullMQ)

`apps/api/src/workers/`

- `order.worker.ts` — processamento de pedidos
- `inventory.worker.ts` — sync de estoque
- `nfe.worker.ts` — emissão de NF-e
- `webhook.worker.ts` — reenvio de webhooks
- `listing.worker.ts` — sincronização de anúncios

Inicializados em `startWorkers()` chamado no bootstrap da API.

---

## Variáveis de ambiente

### API (`apps/api`)

| Variável | Obrigatório | Descrição |
|---|---|---|
| `DATABASE_URL` | **Sim** | PostgreSQL connection string |
| `JWT_SECRET` | **Sim** | Mínimo 64 bytes, não pode ser o valor padrão |
| `REDIS_URL` | Sim | Redis connection string |
| `PORT` | Não (default 3001) | Porta do servidor |
| `WEB_URL` | Recomendado | CORS origin (URL do Vercel) |
| `ML_APP_ID` / `ML_CLIENT_SECRET` | Não | Mercado Livre OAuth |
| `SHOPEE_PARTNER_ID` / `SHOPEE_PARTNER_KEY` | Não | Shopee |
| `AMAZON_CLIENT_ID` / `AMAZON_CLIENT_SECRET` | Não | Amazon SP-API |
| `ASAAS_API_KEY` | **Sim** (billing) | Chave da API Asaas (`$aact_...`) |
| `ASAAS_SANDBOX` | Não (default `false`) | `true` para sandbox/testes |
| `ENCRYPTION_KEY` | Recomendado | 64 hex chars (32 bytes) para criptografar tokens de marketplace. Gerar: `openssl rand -hex 32` |
| `NFEIO_API_KEY` / `NFEIO_COMPANY_ID` | Não | NF-e |

### Frontend (`apps/web`)

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL da API deployada (Railway). Sem isso, usa `http://localhost:3001` |

---

## Deploy

### Frontend — Vercel

Deploy automático via `.github/workflows/deploy-vercel.yml`.

Configurar em Vercel → Settings → Environment Variables:
```
NEXT_PUBLIC_API_URL=https://<seu-railway-url>
```

### API — Railway

Arquivos criados:
- `apps/api/Dockerfile` — multi-stage build (base: instala deps + gera Prisma + compila TS; runner: produção)
- `apps/api/docker-entrypoint.sh` — roda `prisma migrate deploy` e depois `node apps/api/dist/index.js`
- `railway.toml` — aponta para o Dockerfile, healthcheck em `/healthz`

**Passos para deploy no Railway:**

1. New Project → Deploy from GitHub → `herlison14/auto-pecas-rj`
2. Branch: `claude/upseller-platform-analysis-n10NA`
3. Adicionar serviços: **PostgreSQL** e **Redis** (Railway seta `DATABASE_URL` e `REDIS_URL` automaticamente)
4. Variables do serviço API:
   ```
   JWT_SECRET=<openssl rand -hex 64>
   WEB_URL=https://<seu-vercel-url>
   PORT=3001
   NODE_ENV=production
   ```
5. Após o deploy, pegar a URL pública do Railway e configurar em Vercel como `NEXT_PUBLIC_API_URL`

---

## Desenvolvimento local

```bash
# Na raiz do monorepo
npm install

# Subir banco e redis
docker compose up -d   # se houver docker-compose.yml
# ou usar instâncias locais

# Copiar e preencher .env
cp .env.example apps/api/.env

# Rodar migrations
cd packages/database && npx prisma migrate dev

# Dev (raiz — roda web + api em paralelo via turbo)
npm run dev

# Ou individualmente:
cd apps/web && npm run dev     # porta 3000
cd apps/api && npm run dev     # porta 3001
```

---

## Branch de trabalho

`claude/upseller-platform-analysis-n10NA`

Todo desenvolvimento desta sessão foi feito nesta branch. Fazer merge para `main` quando o deploy estiver validado.

---

## URLs de produção

| Serviço | URL |
|---|---|
| Frontend (Vercel) | https://herlison14-sellsync.vercel.app |
| API (Render) | https://auto-pecas-rj.onrender.com |
| Healthcheck | https://auto-pecas-rj.onrender.com/healthz |

---

## Infraestrutura gratuita

| Serviço | Provedor | Observação |
|---|---|---|
| PostgreSQL | Neon | Serverless, região sa-east-1 |
| Redis | Upstash | Serverless, TLS obrigatório (rediss://) |
| API (Docker) | Render | Free tier — spin down após 15min inativo |
| Frontend | Vercel | Deploy automático via GitHub |

---

## Estado atual (junho 2026)

### Concluído
- [x] Monorepo completo com todos os módulos
- [x] Auth JWT com cookie + localStorage sincronizados
- [x] Proteção de rotas via middleware SSR
- [x] 2FA TOTP opcional
- [x] Design dark premium (Linear-style) em todo o frontend
- [x] Dashboard com KPIs, gráficos Recharts, top produtos
- [x] Todas as 20+ páginas do dashboard implementadas
- [x] Dockerfile multi-stage (Render/Railway)
- [x] Entrypoint com migrations automáticas
- [x] API deployada no Render — `/healthz` respondendo
- [x] Redis TLS (Upstash rediss://) configurado
- [x] Prisma OpenSSL Alpine resolvido
- [x] Workspace packages compilando para produção (exports field)
- [x] Asaas billing integrado (substituiu Stripe)
- [x] Frontend → API via proxy same-origin `/backend/*` (rewrites no next.config.ts) — sem CORS, sem env var no bundle
- [x] Schema do banco criado via `prisma db push` no entrypoint (projeto não tem migrations)
- [x] Deploy automático Vercel via GitHub Actions (secret `VERCEL_TOKEN` + **build no CI + deploy prebuilt**)
- [x] Registro testado end-to-end em produção (HTTP 201, contas de teste criadas)
- [x] CSS Tailwind compilado em produção (37,9KB) — verificado por gates no CI
- [x] Página raiz `/` redireciona para `/login` ou `/dashboard` (sem 404)

### Arquitetura de rede (importante)
O frontend NUNCA chama a API diretamente. Toda chamada vai para `/backend/*` no
próprio domínio e o Next.js faz proxy para o Render (rewrites). Em dev, o proxy
aponta para `http://localhost:3001`. Isso elimina CORS e qualquer dependência de
`NEXT_PUBLIC_API_URL` embutida no bundle.

### Arquitetura de deploy do frontend (importante)
**NUNCA usar build remoto do Vercel** — ele ignorava o `postcss.config.mjs` e
publicava CSS cru com `@tailwind` (site inteiro sem estilo). O workflow
`deploy-vercel.yml` compila no CI (`npm install` + `vercel build` dentro de
`apps/web`, que é standalone com lockfile próprio) e sobe o resultado pronto
com `vercel deploy --prebuilt --prod`. Dois gates protegem o pipeline:
1. **Pré-deploy**: falha se o CSS do build tiver `@tailwind` cru ou não tiver
   `.flex{display:flex}`
2. **Pós-deploy**: baixa o CSS servido em produção e repete a verificação

### Concluído (sessão de melhorias — jun/2026)
- [x] NF-e automática ao confirmar pedido + impressão automática da DANFE (AutoPrintAgent)
- [x] Etiqueta de envio do Mercado Livre (individual + lote) com impressão
- [x] Recuperação de senha (token JWT 30min, e-mail via Resend global `RESEND_API_KEY` ou do tenant; sem provedor, URL vai pro log)
- [x] Limites de plano aplicados (lojas em integrações, usuários em convites → HTTP 402)
- [x] Sentry opcional na API (ativa com `SENTRY_DSN`)
- [x] Guarda de multi-tenancy no Prisma (warn em operações bulk sem tenantId)
- [x] Testes vitest (15) + workflow CI `test.yml` (typecheck + testes a cada push)
- [x] Planilha modelo em PT (XLSX + CSV `;`/BOM) e parser tolerante (acentos, caixa, decimal vírgula)
- [x] Ajuda contextual "?" em todas as abas; conexão manual de marketplace; TikTok Shop

### Concluído (sessão de billing + observabilidade — jun/2026)
- [x] Sentry integrado no frontend (Next.js 15): `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `global-error.tsx`
- [x] Sentry integrado na API (Fastify): `instrument.ts` ESM-first, `setupFastifyErrorHandler`, workers BullMQ reportam falhas, graceful shutdown com `Sentry.flush()`
- [x] User context no Sentry: `setUser` após `/auth/me`, `setUser(null)` no logout, tags `tenant_id` e `plan`
- [x] Sistema de pagamento Asaas implementado (substituiu Stripe): cliente tipado `lib/asaas.ts`, `billing.service.ts` reescrito, `GET /billing/plan`, `POST /billing/checkout`, `POST /billing/cancel`, `POST /billing/webhook`
- [x] Schema Prisma: `asaasCustomerId` e `asaasSubscriptionId` adicionados ao Tenant
- [x] PlanTab redesenhado: status badge (ACTIVE/OVERDUE/INACTIVE), alerta de pagamento em atraso, botão cancelar, chips PIX/Boleto/Cartão, cards dark premium
- [x] Acessibilidade WCAG 2.2 AA: skip nav, aria-labels, roles, contraste sidebar/login
- [x] UserMenu no header: avatar com iniciais, badge de plano, dropdown com logout
- [x] ErrorBoundary reporta para Sentry via `componentDidCatch`

### Concluído (sessão de segurança + infra — jun/2026)
- [x] `lib/crypto.ts`: AES-256-GCM encrypt/decrypt — backward-compatible (plaintext passthrough sem `ENCRYPTION_KEY`)
- [x] `accessToken` e `refreshToken` de lojas criptografados no banco ao salvar (manual + OAuth ML + OAuth Shopee)
- [x] `token-refresher.ts`: decrypt transparente + encrypt ao renovar — workers sempre recebem token plaintext
- [x] Workers (`order`, `inventory`, `listing`) usam `getValidToken()` em vez de `store.accessToken` diretamente
- [x] `token-refresh.worker.ts`: refresh proativo de todos os tokens ML/Shopee que expiram em <6h
- [x] BullMQ job recorrente a cada 5h agenda o refresh proativo automaticamente

### Concluído (sessão de auditoria técnica — jun/2026)
- [x] **CONTRIBUTING.md** criado na raiz — governança de código obrigatória para todos os colaboradores
- [x] RBAC completo: products, pricing, listings, nfe, email-settings, inventory, suppliers protegidos com `requireRole('OWNER','ADMIN')`
- [x] N+1 eliminados: financial (batch findMany+IN), repricing ($transaction por regra), order worker (batch SKU lookup)
- [x] Docker: usuário não-root `nodejs` (uid 1001) + HEALTHCHECK via /healthz
- [x] CSP: removido `unsafe-inline`; adicionado HSTS (1 ano) + Referrer-Policy
- [x] Schema: índices em Store, Warehouse, Listing(storeId,productId), FinancialTransaction(externalId)
- [x] Pino logger: `redact` para senha/token/CVV + enriquecimento automático de logs com `userId`/`tenantId`
- [x] `/healthz` agora valida conectividade real com o banco (SELECT 1) — retorna 503 se DB offline
- [x] JWT payload inclui `name` do usuário; tipo em `types/fastify.d.ts` atualizado
- [x] Eliminados `any` em listings.ts e suppliers.ts — tipagem estrita via `@fastify/jwt` augmentation
- [x] Stripe removido do package.json (substituído por Asaas)
- [x] CI test.yml: JWT_SECRET movido para `${{ secrets.TEST_JWT_SECRET }}`
- [x] Warning de startup quando `ENCRYPTION_KEY` não está definida

### Concluído (sessão de navegação mobile — jun/2026)
- [x] Sidebar (`apps/web/src/components/ui/sidebar.tsx`) some abaixo de `lg` (1024px) — `hidden lg:flex`
- [x] Dados de navegação extraídos para `apps/web/src/lib/nav-sections.ts` (compartilhado entre sidebar desktop e menu mobile)
- [x] Padrão "drill-down" para mobile: header ganha botão hambúrguer (`mobile-nav-header.tsx`) que abre `/dashboard/menu` — tela cheia com todas as seções, mesmo padrão de Notion/Stripe mobile. Tocar numa seção navega normalmente; o hambúrguer fica acessível em qualquer página para voltar ao menu completo
- [x] 17 tabelas que vazavam horizontalmente em mobile (orders, catalog, financial, suppliers, settings/team, performance, repricing, returns, customers, listings, integrations/health, stock-table) agora envolvidas em `overflow-x-auto`
- [x] `viewport` meta tag adicionada em `apps/web/src/app/layout.tsx` (estava ausente)
- [x] Catálogo: stats em coluna única no mobile (`grid-cols-1 sm:grid-cols-3`) e busca full-width
- [x] Verificado visualmente com Playwright (390×844 mobile / 1440×900 desktop) — sidebar/hambúrguer alternam corretamente, navegação menu↔seção funciona, sem overflow de página

### Pendente — configurações manuais (sem código necessário)

#### Urgente (segurança)
- [ ] **Revogar token Vercel exposto** — vercel.com/account/tokens → revogar → criar novo → GitHub Settings → Secrets → atualizar `VERCEL_TOKEN`
- [ ] **Remover contas probe-*** — Neon SQL Editor: `DELETE FROM "User" WHERE email LIKE 'probe-%';`

#### Crítico (funcionalidades não funcionam sem isso)
- [ ] **`ENCRYPTION_KEY` no Render** — `openssl rand -hex 32` → dashboard.render.com → auto-pecas-rj → Environment
- [ ] **`ASAAS_API_KEY` no Render** — sandbox.asaas.com → Configurações → Integrações → API → copiar chave `$aact_...` → Render → Environment
- [ ] **`ASAAS_SANDBOX` no Render** — `true` para testes, `false` para produção real
- [ ] **Webhook Asaas** — sandbox.asaas.com → Configurações → Webhooks → URL: `https://auto-pecas-rj.onrender.com/billing/webhook` → Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `SUBSCRIPTION_DELETED` → Access Token = valor do `ASAAS_API_KEY`

#### CI (já tem fallback, mas ideal configurar)
- [~] **`TEST_JWT_SECRET` no GitHub** — Settings → Secrets → Actions → New → `TEST_JWT_SECRET` = string 64+ chars. *(CI funciona mesmo sem isso via fallback, mas recomendado para produção)*

#### Negócio (para começar a vender)
- [ ] **Mercado Livre OAuth** — developers.mercadolivre.com.br → criar app → obter `ML_APP_ID` + `ML_CLIENT_SECRET` → adicionar no Render
- [ ] **NFe.io** — nfe.io → cadastrar empresa (CNPJ + certificado A1) → obter `NFEIO_API_KEY` + `NFEIO_COMPANY_ID` → adicionar no Render

#### Infraestrutura (quando tiver usuários reais)
- [ ] **Upgrade Render Free → Starter ($7/mês)** — Free tier hiberna após 15 min de inatividade, o que mata os workers BullMQ (sync de pedidos/estoque/anúncios para de funcionar)
- [ ] **Migrations versionadas** — migrar de `prisma db push` para `prisma migrate` quando houver dados reais em produção

### Asaas — configuração necessária
```
Render (dashboard.render.com → auto-pecas-rj → Environment):
  ASAAS_API_KEY = $aact_...       ← sua chave do painel Asaas (sandbox.asaas.com → Configurações → Integrações → API)
  ASAAS_SANDBOX = true            ← true para testes, false para produção
  ENCRYPTION_KEY = <openssl rand -hex 32>

Asaas (sandbox.asaas.com → Configurações → Webhooks):
  URL: https://auto-pecas-rj.onrender.com/billing/webhook
  Access Token: mesmo valor do ASAAS_API_KEY
  Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, SUBSCRIPTION_DELETED
```
