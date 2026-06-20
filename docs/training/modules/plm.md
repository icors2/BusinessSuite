# PLM — Document Control

## Purpose

Product-linked document revisions with immutable history and status workflow: Draft → In Review → Released → Obsolete.

## Who uses it

| Role | Access |
|------|--------|
| Admin, Manager | Create documents, upload revisions, transition status |
| All authenticated | View and download |

## UI routes

| Route | Description |
|-------|-------------|
| `/plm/documents` | Document list by product, revision history, status transitions |

## Key tasks

1. Open **Documents** and filter by product (e.g. `SKU-001`).
2. Create a document linked to a product.
3. Upload a new revision via the REST endpoint or UI upload flow.
4. Transition revision status (Draft → In Review → Released).
5. Download a released revision.

## Permissions

- Writes require **Admin** or **Manager**.
- File storage uses MinIO (`/api/documents/...`).

## tRPC procedures

- `document`: create, get, listByProduct, revisions, transition

## Related events

`plm.document.uploaded`, `plm.document.revised`, `plm.document.released`

## Demo login

`manager@arcncode.local` / `Manager123!`
