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

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /app/dist/apps/api ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/libs/shared/database/prisma ./prisma

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node main.js"]
