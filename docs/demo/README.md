# Demo Environment — Phase 18

One-command evaluation stack with comprehensive demo seed data and in-app interactive tutorials.

## Quick start (local Docker)

```bash
docker compose -f docker-compose.demo.yml up --build -d
```

| Service | URL |
|---------|-----|
| **Web UI** | http://localhost:8080 |
| **API health** | http://localhost:3000/api/health |

Sign in with demo users (`<Role>123!`):

| Email | Role |
|-------|------|
| admin@arcncode.local | Admin |
| manager@arcncode.local | Manager |
| operator@arcncode.local | Operator |
| supervisor@arcncode.local | Supervisor |
| inspector@arcncode.local | Inspector |
| technician@arcncode.local | Technician |
| support@arcncode.local | Support |

Open **Tutorials** in the header or visit `/tutorials` for guided tours of all 14 modules.

## GHCR images

Published from the `demo` branch via GitHub Actions (`.github/workflows/demo-publish.yml`):

```bash
docker compose -f docker-compose.demo.yml pull
docker compose -f docker-compose.demo.yml up -d
```

| Image | Tag |
|-------|-----|
| `ghcr.io/icors2/businesssuite-api` | `demo` |
| `ghcr.io/icors2/businesssuite-web` | `demo` |

Make packages public in GitHub Packages settings for anonymous pulls, or `docker login ghcr.io` first.

## Demo seed (development)

After Postgres is running locally:

```bash
npm run prisma:migrate:deploy
npm run prisma:seed:demo
```

See [demo-data-catalog.md](./demo-data-catalog.md) for all entity numbers (`SO-DEMO-001`, `Q-DEMO-003`, etc.).

## Environment variables

Copy [`.env.demo.example`](../../.env.demo.example). Key flags:

| Variable | Default | Purpose |
|----------|---------|---------|
| `SKIP_DEMO_SEED` | `false` | Skip seed on API container start if data exists |
| `SEED_PROFILE` | `demo` | Documentation marker |

## Branch strategy

Phase 18 lives on the long-lived **`demo`** branch. Production `main` is unchanged. Tag `demo-v*` on `demo` to trigger GHCR builds.

## Related docs

- [Training guides](../training/README.md)
- [UAT scripts](../uat/uat-master-tracker.md)
