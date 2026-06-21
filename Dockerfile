# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY nx.json tsconfig.base.json jest.preset.js jest.config.ts eslint.config.mjs ./
COPY apps ./apps
COPY libs ./libs

RUN npm ci
RUN npx prisma generate --schema=libs/shared/database/prisma/schema.prisma
RUN npx nx build api
RUN npx tsc -p libs/shared/database/prisma/tsconfig.seed.build.json

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /app/dist/apps/api ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/libs/shared/database/prisma ./prisma
COPY scripts/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=10 --start-period=30s \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
