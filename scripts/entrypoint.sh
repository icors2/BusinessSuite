#!/bin/sh
set -e

npx prisma migrate deploy --schema=./prisma/schema.prisma

if [ "${SKIP_AUTH_SEED}" != "true" ]; then
  node ./prisma/dist/seed-auth.js
fi

exec node main.js
