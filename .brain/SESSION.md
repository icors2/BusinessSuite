# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-21

---

## Current Focus

Production Docker build + dependency hardening landed on `main` (cherry-picked from `demo` cae6e11).

---

## Active Task

_None._

---

## Recent Progress

- Pushed `demo` cae6e11: Docker eslint fix, deps, GHCR guide
- Cherry-picked to `main`: `Dockerfile`, `.dockerignore`, `package*.json`, `ci.yml`

---

## Session Notes

- `event-bus:test` requires local Redis — fails without docker compose infra running
- Demo data volumes preserved from prior session
- Phase 18 + GHCR docs stay on `demo`; `main` gets prod Docker + deps only
