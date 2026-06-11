# SellSync — Hub Multichannel

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
| Billing | Stripe (FREE / STARTER / GROWTH / PRO) |
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
| `STRIPE_SECRET_KEY` | Não | Billing |
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
- [x] Stripe lazy init (não crasha sem a key)
- [x] Frontend → API via proxy same-origin `/backend/*` (rewrites no next.config.ts) — sem CORS, sem env var no bundle
- [x] Schema do banco criado via `prisma db push` no entrypoint (projeto não tem migrations)
- [x] Deploy automático Vercel via GitHub Actions (secret `VERCEL_TOKEN` + build remoto)
- [x] Registro testado end-to-end em produção (HTTP 201, contas de teste criadas)

### Arquitetura de rede (importante)
O frontend NUNCA chama a API diretamente. Toda chamada vai para `/backend/*` no
próprio domínio e o Next.js faz proxy para o Render (rewrites). Em dev, o proxy
aponta para `http://localhost:3001`. Isso elimina CORS e qualquer dependência de
`NEXT_PUBLIC_API_URL` embutida no bundle.

### Pendente
- [ ] Remover contas de teste da sonda (`probe-ci`, `probe-direct`)
- [ ] Conectar primeiro marketplace (Mercado Livre OAuth)
- [ ] Configurar Stripe para billing
- [ ] Configurar NFe.io para emissão de notas
