# Lead Radar

Prospecção B2B multi-setor: encontre, qualifique e contate empresas por setor e bairro. Análise de atividade com IA, envio de email em massa, exportação CSV.

**Sucessor do `auto-pecas-rj`** — agora multi-setor, com backend, autenticação e CRM lite.

## Stack

- **Next.js 16** (App Router · React 19 · Turbopack)
- **TypeScript 5.7** strict
- **Tailwind CSS 4** (CSS-first config)
- **Neon Postgres** — serverless Postgres (free tier permanente)
- **Drizzle ORM** — type-safe SQL
- **Auth.js v5 (NextAuth)** — Credentials provider + bcryptjs
- **OpenStreetMap (Nominatim + Overpass)** — busca de empresas (100% grátis, sem cartão)
- **Anthropic Claude (Haiku)** — extração de emails de sites
- **Resend** — email em massa (Fase 2)
- **Vercel** — hospedagem (Fluid Compute)

## Setup local

### 1. Clonar e instalar

```bash
git clone https://github.com/herlison14/auto-pecas-rj.git lead-radar
cd lead-radar
npm install
```

### 2. Criar projeto Neon

1. Acessa https://console.neon.tech/app/projects
2. Cria projeto `lead-radar` na região **aws-sa-east-1 (São Paulo)**
3. Copia a **connection string pooled** em `Dashboard → Connection Details`
   (formato: `postgresql://USER:PWD@ep-xxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require`)

### 3. Configurar `.env.local`

```bash
cp .env.local.example .env.local
```

Preenche:
- `DATABASE_URL` — connection string do Neon
- `AUTH_SECRET` — `openssl rand -base64 32` (ou `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
- `ANTHROPIC_API_KEY` — https://console.anthropic.com/settings/keys

> A busca usa OpenStreetMap (Overpass API + Nominatim) — **sem chave, sem billing, sem cartão**. Rate limits respeitados automaticamente (1 req/seg no Nominatim).

### 4. Aplicar schema e seed

```bash
npm run db:push       # cria tabelas no Neon via Drizzle Kit
npm run db:seed       # popula cidade RJ + 47 bairros + 47 setores
```

### 5. Rodar dev server

```bash
npm run dev
```

Acessa http://localhost:3000

## Fluxo

1. `/registro` → cria conta (NextAuth Credentials + bcrypt)
2. `/dashboard` → KPIs gerais
3. `/busca` → seleciona setor + bairros → busca via OpenStreetMap (Overpass API, server-side)
4. Para cada empresa com site, "Buscar email" → Claude analisa HTML e extrai contatos
5. Empresas salvas em `empresas` ligadas ao seu `owner_id` (isolamento manual nas Server Actions)
6. Exporta CSV ou move pra `/prospects`

## Roadmap

- [x] **Fase 1** — Arquitetura base, multi-setor, auth, busca, persistência
- [ ] **Fase 2** — Email massivo via Resend (templates, warm-up, tracking, unsubscribe LGPD)
- [ ] **Fase 3** — Agente de score de atividade (Vercel Cron + Claude)
- [ ] **Fase 4** — Portfolio mode público (`/portfolio/[slug]`)

## Scripts

```bash
npm run dev          # localhost:3000
npm run build        # build produção
npm run start        # serve build
npm run lint
npm run typecheck    # tsc --noEmit
npm run db:generate  # cria SQL migration a partir do schema TS
npm run db:push      # aplica schema direto no banco (dev)
npm run db:studio    # GUI do Drizzle pra inspecionar dados
npm run db:seed      # popula cidades, bairros e setores
```

## Estrutura

```
app/
├── (auth)/                    # rotas públicas
│   ├── login/{page,login-form,actions}.tsx
│   └── registro/{page,registro-form,actions}.tsx
├── (app)/                     # rotas protegidas (sidebar)
│   ├── dashboard/
│   ├── busca/                 # Server Actions executarBusca + buscarEmailsEmpresa
│   ├── prospects/
│   ├── campanhas/             # Fase 2
│   └── settings/
├── api/auth/[...nextauth]/    # NextAuth handlers
├── layout.tsx                 # root
├── page.tsx                   # landing pública
└── globals.css                # Tailwind 4 + tokens
lib/
├── auth.ts                    # NextAuth full (adapter Drizzle + Credentials)
├── auth.config.ts             # config edge-safe (proxy.ts usa esse)
├── auth-handlers.ts           # re-export GET/POST p/ route handler
├── db/{index,schema}.ts       # Drizzle + Neon
├── openstreetmap.ts           # server-only · Nominatim + Overpass
└── claude.ts                  # server-only · Haiku extractor
scripts/
└── seed.ts                    # cidades + bairros + setores
types/
└── next-auth.d.ts             # extende Session.user.id
proxy.ts                       # Next 16 — auth check edge-safe
drizzle.config.ts              # Drizzle Kit config
legacy/                        # index.html original arquivado
```

## Notas técnicas

- **Sem chaves no browser**: tudo via Server Actions (`'use server'`).
- **Sem RLS** (Neon não tem RLS visual): owner_id checado manualmente em cada Server Action.
- **Auth split**: `auth.config.ts` (edge-safe, usado no `proxy.ts`) + `auth.ts` (full, com adapter Drizzle). Isso evita puxar `@neondatabase/serverless` na boundary do middleware.
- **JWT sessions**: NextAuth com strategy JWT — sem tabela `sessions` ativa (existe mas não é usada).
- **Drizzle lazy init**: `getDb()` é lazy pra não falhar no build se `DATABASE_URL` ausente.
- **CORS-free scraping**: fetch server-side, sem proxy público.
- **`proxy.ts`** (Next 16) substitui `middleware.ts` e roda só com authConfig edge-safe.

## Segurança

- Senhas: bcryptjs fator 10
- JWT NextAuth com AUTH_SECRET (rotacionar a cada 6 meses)
- Chaves Google/Anthropic/Resend só em env server-side
- Webhook Resend (Fase 2) validado por assinatura
- LGPD: unsubscribe automático, suppression list, base legal de legítimo interesse B2B

## Origem

Reescrita completa do projeto [`auto-pecas-rj`](./legacy/index.html), que era um SPA estático com chaves API no browser. O arquivo original está preservado em `legacy/`.
