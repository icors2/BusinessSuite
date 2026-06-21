# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-21

---

## Current Focus

Docker/deps/GHCR work shipped on `demo` (cae6e11); production fixes on `main` (3f5b8fa).

---

## Active Task

_None._

---

## Recent Progress

- Pushed `demo` cae6e11: Docker eslint fix, deps, GHCR guide + compose/scripts
- Cherry-picked to `main` 3f5b8fa: `Dockerfile`, `.dockerignore`, `package*.json`, `ci.yml`
- Evaluator one-liner can now fetch `docker-compose.ghcr.yml` from `origin/demo`

---

## Session Notes

- `event-bus:test` requires local Redis — fails without docker compose infra running
- Demo data volumes preserved from prior session
- Phase 18 + GHCR docs stay on `demo`; `main` gets prod Docker + deps only
