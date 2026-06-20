# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-20

---

## Current Focus

Phase 18 — Demo & Tutorial **shipped** on `demo` branch (`9cfd5eb` + mes build fix).

---

## Active Task

_None._

---

## Recent Progress

- Pushed `demo` branch; tagged `demo-v0.1.0`
- Fixed `mes.gateway.ts` TS4111 blocking Docker API image build
- GHCR Demo Publish workflow re-triggered on push

---

## Next Steps

_Verify GHCR images publish; optional local `docker compose -f docker-compose.demo.yml up --build` smoke._

---

## Session Notes

- Demo seed idempotent; guard on SO-DEMO-001 SHIPPED
- Web on :8080, API on :3000 in demo compose
- CI seed unchanged — demo seed is separate script
