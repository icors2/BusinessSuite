# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-20

---

## Current Focus

Seed split, Docker auth seed, admin module, and Docker seed-auth path fix — complete on `main` and merged to `demo`.

---

## Active Task

_None._

---

## Recent Progress

- **main** `f076aef`: Docker seed-auth emit path fix (`rootDir` in tsconfig.seed.build.json); README seed tiers + scripts docs
- **main** `bd288a6`: seed split, Docker entrypoint auth seed, admin module, prod register guard
- **demo** `316413a`: merged main; kept tutorials + `seed-demo.ts`; updated demo entrypoint ts-node paths

---

## Branch Workflow

1. Develop on **`main`**
2. Merge **`main`** → **`demo`**
3. Push **`demo`** to trigger GHCR publish

Demo-only on `demo`: seed-demo, tutorials, docker-compose.demo.yml, docs/demo/, GHCR workflow

---
