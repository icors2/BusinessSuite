# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-20

---

## Current Focus

Phase 4 — PLM & Documents **complete**.

---

## Active Task

_None — ready for Phase 5 (WMS / Inventory)._

---

## Recent Progress

- Prisma PLM schema: Document, DocumentRevision, DocumentStatus; migration `20260620045930_add_plm_documents`
- Created `libs/shared/storage` — StorageService (MinIO/S3 wrapper, ensureBucket/putObject/getObject/objectKeyFor)
- Created `libs/plm` — DocumentService, revision state machine, single-Released rule, EVENTS.md
- tRPC `document` router; REST DocumentsController (multipart upload + streamed download)
- PLM UI at `/plm/documents` — product picker, revision history, preview, editor-gated upload/transitions
- Seed: sample Document + DRAFT revision on SKU-001 (metadata only)
- 4 plm unit tests + 4 plm integration tests (MinIO byte-for-byte, lifecycle, Viewer block); full suite green (11 projects)
- Updated MEMORY.md, README.md, build prompts doc (Phase 4 ✅ COMPLETE)

---

## Next Steps

1. Start **Phase 5 — WMS (Inventory)** using [Arc_N_Code_AI_Build_Prompts_v6.md](../Arc_N_Code_AI_Build_Prompts_v6.md)

---

## Session Notes

- StorageModule APP_CONFIG token moved to `storage.constants.ts` to avoid circular import with StorageService
- REST for binary, tRPC for metadata matches Phase 1+ API split
- Integration tests require Postgres + MinIO (docker compose up)
