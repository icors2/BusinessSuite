# Arc N Code Business Suite

Integrated manufacturing operations platform — Phase 0 infrastructure foundation.

## Prerequisites

- Node.js 22+
- npm 11+
- Docker Desktop (for local Postgres, Redis, MinIO, API)
- Optional: GPG (for encrypted backups)

## Quick start (local development)

1. **Clone and install**
   ```bash
   git clone <repo-url> anc-business-suite
   cd anc-business-suite
   npm ci
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit secrets for non-dev environments
   ```

3. **Start infrastructure**
   ```bash
   docker compose up -d postgres redis minio
   ```

4. **Database setup**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate:deploy
   npm run prisma:seed
   ```

5. **Run API**
   ```bash
   npm run serve
   # API: http://localhost:3000/api
   # Health: http://localhost:3000/api/health
   ```

6. **Full stack (including API container)**
   ```bash
   docker compose up -d
   ```

## Seeded users (development)

| Email | Password | Role |
|-------|----------|------|
| admin@arcncode.local | Admin123! | Admin |
| manager@arcncode.local | Manager123! | Manager |

## API endpoints (Phase 0)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api` | Public | Service info |
| GET | `/api/health` | Public | DB/Redis/MinIO health |
| POST | `/api/auth/register` | Public | Register user |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| POST | `/api/auth/refresh` | Public | Refresh tokens |
| GET | `/api/auth/admin-only` | Admin | Role-gated test |
| GET | `/api/auth/manager-or-admin` | Admin, Manager | Role-gated test |

## Environment separation

| Environment | Config source | Notes |
|-------------|---------------|-------|
| **Development** | `.env` (from `.env.example`) | Default dev secrets OK |
| **Staging** | Host env / `.env.staging` | Strong JWT secrets required |
| **Production** | Platform secret store on on-prem host | Never commit secrets |

### Promotion path

1. Develop locally with `.env`
2. CI injects secrets via GitHub Actions secrets (see `.github/workflows/ci.yml`)
3. Staging/production: set env vars on the Docker host or use a vault (HashiCorp Vault documented as future step)

## Secrets management

- **Local:** `.env` file (gitignored), copy from `.env.example`
- **CI:** GitHub repository secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, etc.)
- **Production:** On-prem Docker host environment or vault — document in deployment runbook

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build API |
| `npm run serve` | Run API in dev mode |
| `npm run test` | Run all tests |
| `npm run lint` | ESLint all projects |
| `npm run prisma:migrate` | Create/apply dev migrations |
| `npm run prisma:seed` | Seed Admin/Manager roles and users |
| `npm run docker:up` | Start full Docker stack |
| `npm run backup` | Encrypted Postgres backup |

## Architecture (Phase 0)

```
apps/api          NestJS modular monolith
libs/shared/
  config          Typed environment loader
  database        Prisma + PostgreSQL
  event-bus       Redis Streams pub/sub
  audit           Audit logging to Postgres
  health          /health watchdog
  auth            JWT + RBAC (Admin, Manager)
```

## Backup & restore

See [docs/backup-restore-runbook.md](docs/backup-restore-runbook.md).

## Field deployment (on-site installs)

See [docs/field-deployment-sop.md](docs/field-deployment-sop.md) for field technician SOP covering network setup, server wiring, and site verification.

- **RPO:** ≤ 24 hours (nightly backups)
- **RTO:** ≤ 4 hours

## CI/CD

GitHub Actions runs lint, type-check, test, and build on every push. Tagged releases (`v*`) trigger the manual self-hosted Docker deploy step.

## Phase roadmap

See [Arc_N_Code_AI_Build_Prompts_v6.md](Arc_N_Code_AI_Build_Prompts_v6.md) for the full build sequence (Phases 0–17).

**Phase 0 status:** Complete  
**Next phase:** Phase 0.5 — White-Glove Physical SOP
