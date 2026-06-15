# Padrões de Desenvolvimento e Governança

Este documento define as regras de ouro para todos os projetos sob a responsabilidade de Herlison Fabio Jesus Dos Santos. A aderência a estes padrões é obrigatória para garantir a integridade, segurança e manutenibilidade dos sistemas.

---

## 1. Princípios de Entrega (O "Regra Zero")

**Código Unificado:** Nunca envie fragmentos de código. Toda solicitação deve conter o bloco completo, corrigido e funcional, pronto para deploy.

**Terminologia de Negócio:** Variáveis, funções e chaves de banco de dados devem usar terminologia de "Banking Daily Life" em Português.

**Princípio DRY (Don't Repeat Yourself):** Elimine duplicações. Se um padrão aparece em dois lugares, extraia para uma função utilitária ou hook personalizado.

---

## 2. Observabilidade e Logs (SRE)

**Log Estruturado:** Uso obrigatório de Pino (API) ou Winston com formato JSON.

**Contexto:** Todo log deve conter `requestId`, `userId` e `action`.

**Sanitização (Data Masking):** É proibido registrar senhas, tokens, CVVs ou dados pessoais. Use `redact` no logger para mascarar campos sensíveis. Campos proibidos: `senha`, `password`, `token`, `accessToken`, `refreshToken`, `smtpPass`, `resendApiKey`, `cvv`, `Authorization`.

**Níveis:** Seguir rigorosamente: `info`, `warn`, `error`, `fatal`.

---

## 3. Segurança (DevSecOps)

**Hardening de Entrada:** Validação obrigatória de schema (Zod). Todo input de usuário deve ser validado antes de tocar o banco de dados.

**RBAC:** Rotas destrutivas (PUT, DELETE, POST fiscal) requerem `requireRole('OWNER', 'ADMIN')`.

**Arquitetura de Uploads:**
- Validação de `mimetype` e `magic numbers` (conteúdo real).
- Sanitização rigorosa de nomes de arquivos para prevenir Path Traversal.
- Armazenamento obrigatório fora de diretórios públicos.

**Proteção:**
- Headers de segurança via `@fastify/helmet` (CSP sem `unsafe-inline`, HSTS, Referrer-Policy).
- Proteção contra SQL Injection via Prisma (queries parametrizadas).
- Rate limiting por endpoint — auth mais restritivo (5–10 req/min).

**Criptografia:** Tokens de marketplace devem ser criptografados com AES-256-GCM (`ENCRYPTION_KEY`). Fallback em plaintext apenas com aviso explícito no log de startup.

---

## 4. Performance e Arquitetura

**Sem Consultas N+1:** Sempre que houver loops de acesso a banco de dados, utilize eager loading (`include`) ou batch queries (`findMany` com `IN`). Atualizações múltiplas dentro de loops devem usar `prisma.$transaction`.

**Gerenciamento de Estado:**
- Evite Prop Drilling — use Context ou Zustand.
- Use `useReducer` para estados complexos.
- `useMemo`/`useCallback` apenas para otimizar cálculos pesados ou evitar re-renders desnecessários.

**TypeScript:** Banir o uso de `any`. Use interfaces estritas. Tipo do JWT declarado em `src/types/fastify.d.ts`.

**Paginação:** Todo endpoint de listagem deve ter `take`/`skip` com limite máximo definido.

---

## 5. Resiliência de Dados

**Health Checks:** Endpoint `/healthz` deve validar conectividade com banco **e** Redis.

**Graceful Shutdown:** A aplicação deve tratar `SIGTERM`/`SIGINT`, finalizando requisições ativas e fazendo `Sentry.flush` antes de encerrar.

**Backup:** Toda infraestrutura deve ter rotinas automáticas de `pg_dump` com envio para S3 (ver `scripts/backup-db.sh`). Cron sugerido: `0 3 * * *`.

---

## 6. Processo de Refatoração (Workflow)

1. **Auditoria:** `npm audit` — identifique vulnerabilidades e *leftovers* (mocks, rotas de teste, deps não usadas).
2. **Observabilidade:** Aplique logs estruturados com redact.
3. **Segurança:** Hardening de entradas (Zod) + RBAC.
4. **Performance:** Elimine N+1, adicione índices de banco.
5. **Entrega:** Código completo, revisado contra este documento.
