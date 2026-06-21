# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-21

---

## Current Focus

Committing API startup fix + Jest/glob upgrades to `demo`; cherry-picking shared fixes to `main`.

---

## Active Task

_None — pushing commits._

---

## Recent Progress

- Event-bus: dual Redis connection, handler error ack, stale quote skip; demo entrypoint CRLF strip
- Jest 29 → 30; `glob@13`, `test-exclude@7`, `@rollup/plugin-commonjs@28` overrides — no glob deprecation on `npm ci`
- Removed duplicate `jest.config.cts` (Jest 30 requirement)
- Demo stack healthy after fixes

---

## Session Notes

- `event-bus:test` requires local Redis
- `whatwg-encoding` deprecation remains (dev-only via `@nx/web` → `http-server`)
