# Demo Environment — Phase 18

One-command evaluation stack with comprehensive demo seed data and in-app interactive tutorials.

## Quick start (local Docker)

```bash
docker compose -f docker-compose.demo.yml up --build -d
```

**Stop (keep demo data):**

```bash
docker compose -f docker-compose.demo.yml down
```

**Stop and wipe volumes (fresh seed on next start):**

```bash
docker compose -f docker-compose.demo.yml down -v
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

## Run from GHCR (any PC — no build)

Full setup guide: **[ghcr-deploy-guide.md](./ghcr-deploy-guide.md)** (maintainer setup, evaluator one-liner, remote VM).

**One command** (Linux/macOS/Git Bash):

```bash
curl -fsSL -o docker-compose.ghcr.yml \
  https://raw.githubusercontent.com/icors2/BusinessSuite/demo/docker-compose.ghcr.yml \
  && docker compose -f docker-compose.ghcr.yml up -d --pull always
```

**Stop (keep demo data):**

```bash
docker compose -f docker-compose.ghcr.yml down
```

**Stop and wipe volumes (fresh seed on next start):**

```bash
docker compose -f docker-compose.ghcr.yml down -v
```

| Image | Tag |
|-------|-----|
| `ghcr.io/icors2/businesssuite-api` | `demo` |
| `ghcr.io/icors2/businesssuite-web` | `demo` |

Helper scripts: [`scripts/run-demo-ghcr.sh`](../../scripts/run-demo-ghcr.sh) · [`scripts/run-demo-ghcr.ps1`](../../scripts/run-demo-ghcr.ps1)

From a repo clone you can also use npm scripts: `npm run docker:down:ghcr` (stop) · `npm run docker:down:ghcr:reset` (wipe volumes) · `npm run docker:down:demo` · `npm run docker:down:demo:reset`

Compose file (pull-only): [`docker-compose.ghcr.yml`](../../docker-compose.ghcr.yml)

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

- [GHCR deploy guide](./ghcr-deploy-guide.md)
- [Training guides](../training/README.md)
- [UAT scripts](../uat/uat-master-tracker.md)
