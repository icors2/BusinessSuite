# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-21

---

## Current Focus

Committing Docker/deps/GHCR fixes to `demo`; cherry-picking production fixes to `main`.

---

## Active Task

- Commit + push `demo`
- Cherry-pick shared files (`Dockerfile`, `.dockerignore`, `package*.json`, `ci.yml`) to `main` + push

---

## Recent Progress

- Fixed Docker builds: copy `eslint.config.mjs` in all Dockerfiles + `.dockerignore`
- Added npm overrides; Prisma 6.19.3; **0 vulnerabilities** on `npm audit`
- CI audit gate: `npm audit --omit=dev --audit-level=high`
- GHCR deploy guide, `docker-compose.ghcr.yml`, run scripts (demo-only)
- Docker demo build smoke test passed (api + web)

---

## Session Notes

- `event-bus:test` requires local Redis — fails without docker compose infra running
- Demo data volumes preserved from prior session
- Phase 18 + GHCR docs stay on `demo`; `main` gets prod Docker + deps only
