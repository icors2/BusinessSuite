#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until pg_isready -h "${POSTGRES_HOST:-postgres}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-anc}" >/dev/null 2>&1; do
  sleep 2
done

echo "Running migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

if [ "${SKIP_DEMO_SEED:-false}" != "true" ]; then
  echo "Seeding demo data..."
  npx ts-node --compiler-options '{"module":"CommonJS"}' ./prisma/seed-demo.ts || {
    echo "Demo seed failed — continuing if database already populated"
  }
fi

echo "Starting API..."
exec node main.js
