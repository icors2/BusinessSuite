# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-21

---

## Current Focus

Branch workflow realigned: **`main`** for development, **`demo`** for evaluation deploy.

---

## Active Task

_None._

---

## Recent Progress

- Committed + pushed `demo` (`065c84e`): sidebar-07 layout, shadcn UI, docker shutdown docs
- Synced to `main`: sidebar layout (no tutorials), MES fix, scan-input fix, Radix deps
- Removed `prisma:seed:demo` script from `main` (no seed-demo.ts on main)
- Updated `.brain/MEMORY.md` with main → demo merge workflow

---

## Branch Workflow

1. Develop on **`main`**
2. Merge **`main`** → **`demo`**
3. Push **`demo`** to trigger GHCR publish

Demo-only on `demo`: seed-demo, tutorials, docker-compose.demo.yml, docs/demo/, GHCR workflow

---
