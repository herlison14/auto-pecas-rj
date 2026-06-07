FROM node:22-alpine AS base

WORKDIR /app

# Install dependencies at root (workspace)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/integrations/package.json ./packages/integrations/
COPY packages/nfe/package.json ./packages/nfe/

RUN npm install --workspaces --include-workspace-root

# Copy source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Build TypeScript
RUN cd apps/api && npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/integrations/package.json ./packages/integrations/
COPY packages/nfe/package.json ./packages/nfe/

RUN npm install --workspaces --include-workspace-root --omit=dev

COPY packages/ ./packages/
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma

# Run migrations then start server
COPY apps/api/docker-entrypoint.sh ./apps/api/
RUN chmod +x ./apps/api/docker-entrypoint.sh

EXPOSE 3001

CMD ["./apps/api/docker-entrypoint.sh"]
