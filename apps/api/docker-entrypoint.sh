#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/packages/database
npx prisma migrate deploy

echo "Starting API server..."
cd /app
node apps/api/dist/index.js
