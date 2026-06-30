#!/bin/sh
set -e

echo "Syncing database schema (prisma db push)..."
cd /app/packages/database
# O projeto não tem arquivos de migration — o schema é a fonte da verdade.
# `db push` cria/atualiza as tabelas direto a partir do schema.prisma.
npx prisma db push --skip-generate

echo "Starting API server..."
cd /app
node apps/api/dist/index.js
