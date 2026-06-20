# Arc N Code Business Suite — AI Build Prompts (v6.0)
### Sequential, copy-paste prompts for Phases 0 through 17

## How to use this document

Build one phase at a time, in order. Don't skip ahead — every phase after Phase 1 assumes the schema, services, and Event Bus topics from earlier phases already exist and are working.

For each phase below:
1. Paste the **Project-Wide Conventions** block once at the start of your session (or save it as a persistent file like `CLAUDE.md` in your repo root so your AI coding tool re-reads it automatically).
2. Paste that phase's prompt.
3. Once the AI reports the phase complete, run the tests, review the diff, and confirm against the **Definition of Done** checklist before moving to the next phase.
4. Start a fresh session for the next phase so the AI re-grounds itself in "what already exists" rather than relying on a long, drifting conversation history.

Phases 0.5 and 17 are documentation/process deliverables rather than codebases — their prompts are written for that.

---

## Project-Wide Conventions
*(Paste this once per session, or keep it as persistent repo context)*

```
You are building the Arc N Code Business Suite, a manufacturing operations
platform, as a sequence of phases inside a single Nx Monorepo. Follow these
conventions on every phase unless a specific phase prompt overrides them:

TECH STACK
- Backend: Node.js with NestJS, structured as a Modular Monolith (one Nx app,
  separate Nx libraries per domain module).
- Database: PostgreSQL is the system of record, accessed via Prisma.
- Cache/real-time: Redis, used for both caching and the Event Bus (pub/sub or
  streams — pick one approach in Phase 0 and stay consistent for all later
  phases).
- Object storage: MinIO, S3-compatible, for files/documents/photos.
- API layer: tRPC, fully typed end-to-end between backend and frontend.
- Frontend: React, using Shadcn UI components and Tailwind.
- Monorepo tooling: Nx, TypeScript strict mode throughout.

BUILD SEQUENCE (per phase)
Schema -> Service -> API -> Tests -> UI -> Integration.
Do not start UI work until the service layer has passing tests.

EVENT BUS CONVENTIONS
- Topic/channel naming: `domain.entity.action`, all lowercase, e.g.
  `wms.inventory.moved`, `sales.quote.accepted`, `mes.workorder.completed`.
- Every event payload includes: entityId, tenantId/orgId (if multi-tenant),
  actorId (user who triggered it), timestamp, and a versioned payload schema.
- New phases should document every event topic they emit in a
  `EVENTS.md` file inside that module's Nx library.

RBAC BASELINE
- Roles established in Phase 0: Admin, Manager. Each phase that introduces a
  new persona (Supervisor, Operator, Inspector, Sales Rep, Finance, Buyer,
  Planner, etc.) should extend the role table rather than create a parallel
  permissions system.

TESTING
- Every service needs unit tests for business logic and integration tests for
  tRPC endpoints against a test database.
- Do not mark a phase complete until tests pass in CI, not just locally.

DOCUMENTATION
- Every Nx library gets a short README describing its purpose, its Prisma
  models, its tRPC routes, and the events it emits/consumes.

SCOPE DISCIPLINE
- Build only what the current phase's prompt specifies. If you identify
  something that depends on a future phase, stub it clearly (e.g. a TODO with
  the phase number) rather than building ahead of schedule.
- If a business rule isn't specified (e.g. exact pricing logic, exact
  approval thresholds), implement a reasonable default, flag it clearly in
  the README as a placeholder, and ask before treating it as final.
```

---

## Phase 0 — Infrastructure Foundation ✅ COMPLETE

**Prompt:**
```
Set up the foundation for the Arc N Code Business Suite.

1. Initialize an Nx Monorepo with TypeScript strict mode, ESLint, and
   Prettier configured.
2. Stand up Docker Compose for local development with services for
   PostgreSQL, Redis, and MinIO, plus a NestJS API container.
3. Build a `shared` Nx library containing:
   - An Event Bus abstraction over Redis (pub/sub or streams — choose one
     and document the choice) with a typed `publish(topic, payload)` and
     `subscribe(topic, handler)` API that all future modules will use.
   - An Audit Logging library that any service can call to record
     who-did-what-when, persisted to Postgres.
   - A System Health Watchdog: a NestJS module exposing a `/health`
     endpoint checking DB, Redis, and MinIO connectivity, plus a basic
     uptime/alerting hook (log-based alert is fine for now; note where a
     real alerting integration would plug in later).
4. Implement Authentication and baseline RBAC: user accounts, password
   hashing, JWT or session-based auth, and a roles table seeded with Admin
   and Manager. Build the NestJS guards/decorators that later phases will
   reuse to gate endpoints by role.
5. Configure environment separation: distinct .env handling for
   development, staging, and production, with a documented promotion path.
6. Add secrets management: do not commit secrets; document how local dev,
   CI, and production each source secrets (e.g. .env for local, a vault or
   platform secret store for production — implement what's feasible now and
   document the rest as a setup step).
7. Set up automated encrypted backups for PostgreSQL with a defined
   retention policy, and write a backup/restore runbook including target
   RTO/RPO.
8. Set up CI/CD: a pipeline that lints, type-checks, runs tests, and builds
   on every push, with a manual or tagged-release deploy step.

Deliverables: working monorepo, docker-compose up brings up a usable local
stack, /health returns green, a test user can register/log in and receive a
role-gated JWT, backup script runs successfully against the local DB, and a
README documents how to run everything locally.
```

**Definition of Done:**
- `docker-compose up` brings up Postgres, Redis, MinIO, and the API cleanly.
- `/health` reports all three dependencies as connected.
- Login issues a token that a role-gated test endpoint correctly accepts/rejects.
- Event Bus has a working publish/subscribe round-trip test.
- Backup/restore runbook exists and has been tested at least once.
- CI pipeline is green on a clean clone.

---

## Phase 0.5 — White-Glove Physical SOP ✅ COMPLETE

**Prompt:**
```
You are documenting (not coding) the physical deployment process for Arc N
Code on-site installs.

Draft a Standard Operating Procedure for field technicians covering:
1. Network hardware setup using Ubiquiti or Omada equipment: router/switch
   configuration, VLAN/SSID isolation between office, shop-floor IoT, and
   guest networks.
2. Server hardwiring standards: physical placement, cable labeling,
   redundant power where applicable.
3. Registry token embedding: how each site's hardware is registered against
   the central system created in Phase 0 (e.g. a provisioning token baked
   into device config so the server can self-identify on first boot).
4. A pre-flight checklist a technician runs through before leaving site.
5. A server readiness verification checklist confirming the local stack
   from Phase 0 boots correctly on the physical hardware and can reach the
   provisioning/auth services.

Output as a structured SOP document (numbered steps, checklists technicians
can physically check off), written for someone with general IT competency
but not necessarily deep networking expertise.
```

**Definition of Done:**
- SOP document exists and is reviewable by a non-engineer technician.
- Includes a printable/checkable onsite checklist.
- Includes the server readiness verification steps tied to Phase 0's `/health` endpoint.

---

## Phase 1 — ERP Core (Master Data) ✅ COMPLETE

**Prompt:**
```
Building on the Phase 0 foundation (auth, RBAC, Event Bus, audit logging),
build the Master Data core.

1. Prisma schema for: Product (SKU, description, unit of measure, category,
   active flag), Customer (name, contact info, billing/shipping addresses,
   credit terms placeholder), Vendor (name, contact info, address, payment
   terms placeholder). Include soft-delete/active flags rather than hard
   deletes, since later phases will reference these records.
2. NestJS services with CRUD + validation business logic for each entity
   (e.g. SKU uniqueness, required fields, basic duplicate-customer
   detection by name+address).
3. tRPC endpoints for create/read/update/list/deactivate on each entity,
   gated by role (Admin/Manager can edit, all authenticated roles can read).
4. A basic ERP Administration UI (Shadcn-based) with list/search/create/edit
   views for Products, Customers, and Vendors.
5. Emit events on create/update/deactivate for each entity, e.g.
   `masterdata.product.created`, `masterdata.customer.updated`.
6. Integration tests covering the CRUD flows and the uniqueness/validation
   rules.

This phase is the foundation every later module reads from — prioritize
getting the schema right over UI polish.
```

**Definition of Done:**
- Products, Customers, and Vendors can be created, edited, listed, and deactivated through the UI.
- Uniqueness/validation rules are enforced and tested.
- Events fire correctly and are visible via a simple subscriber/log for verification.
- Role gating confirmed: a non-Admin/Manager role cannot write, but can read.

---

## Phase 2 — Data Migration & Legacy Cutover ✅ COMPLETE

**Prompt:**
```
Build the migration path from the legacy system into the new Master Data
schema from Phase 1.

1. Build ETL scripts that extract Customers, Vendors, Product/inventory
   balances, and open Quotes from the legacy system. (If the legacy export
   format isn't specified, build the transform layer to accept CSV/JSON
   input matching a documented expected schema, so it can be pointed at
   whatever export the legacy system produces.)
2. Transform legacy records into the Phase 1 Prisma models, including
   conflict handling (e.g. duplicate customer names, missing required
   fields) — log these to a review file rather than silently dropping or
   guessing.
3. Load into a staging area first, not directly into production tables, so
   records can be reviewed before commit.
4. Build a validation/reconciliation report: record counts in vs. out,
   flagged conflicts, and a diff-style summary an operations person can
   review before go-live.
5. Write a cutover runbook: parallel-run period expectations, go-live
   sequencing, and exactly what gets re-pointed from legacy to new system
   at cutover.
6. Write a rollback procedure: how to revert to the legacy system if
   cutover fails validation, including how far back data changes can be
   safely undone.

This is infrastructure tooling, not end-user UI — a CLI or admin script is
sufficient as long as it's safe to re-run (idempotent) and produces a clear
audit trail of what was migrated.
```

**Definition of Done:**
- ETL scripts run end-to-end against sample/legacy-shaped data without manual intervention.
- Reconciliation report accurately reflects record counts and flags conflicts.
- Cutover runbook and rollback procedure are written and have been dry-run at least once against a staging copy.

---

## Phase 3 — Finance & Accounting Core ✅ COMPLETE

**Prompt:**
```
Building on Phase 1's Master Data (Customers, Vendors), build the core
financial ledger.

1. Prisma schema for: Chart of Accounts (account code, name, type:
   asset/liability/equity/revenue/expense), Journal Entries (header + line
   items, debit/credit, must balance), Accounts Payable (vendor bills, due
   dates, payment status), Accounts Receivable (customer invoices, due
   dates, payment status), and Invoices (linked to Customer from Phase 1).
2. NestJS services enforcing core accounting integrity: journal entries
   must balance (debits = credits) before posting, posted entries are
   immutable (corrections happen via reversing entries, not edits).
3. tRPC endpoints for creating/posting journal entries, generating customer
   invoices, recording vendor bills, and recording payments against either.
4. Basic financial reporting: Profit & Loss and Balance Sheet views,
   computed from posted journal entries for a given date range.
5. A Finance admin UI: chart of accounts management, invoice list/detail,
   AP bill entry, and the two core reports.
6. Emit events such as `finance.invoice.created`, `finance.invoice.paid`,
   `finance.bill.created` — later phases (Sales Orders, Procurement) will
   trigger these rather than writing directly to Finance tables.
7. Integration tests covering balanced-entry enforcement, invoice
   generation, and report accuracy against known seed data.

Treat this as the financial source of truth other modules push events into
— don't let other modules write directly to ledger tables.
```

**Definition of Done:**
- Unbalanced journal entries are rejected.
- An invoice can be created, posted, and shown as outstanding/paid correctly.
- P&L and Balance Sheet reports match hand-calculated totals against seed data.
- Events are documented and emitted on every state change other modules will need to react to.

---

## Phase 4 — PLM & Documents ✅ COMPLETE

**Prompt:**
```
Building on Phase 1 (Products), build Product Lifecycle Management and
document control.

1. Prisma schema for Engineering Documents: linked to a Product, file
   metadata (name, type, size, MinIO object key), revision number, revision
   notes, status (Draft/In Review/Released/Obsolete), and a revision history
   table that never deletes prior revisions.
2. A file upload/download service using MinIO: upload creates a new
   revision rather than overwriting; download always serves the requested
   revision (default to latest released).
3. tRPC endpoints for document upload, revision creation, status
   transitions, and document listing/search by Product.
4. A UI for blueprint/document viewing: list documents per product, view
   revision history, preview common file types (image/PDF) inline where
   feasible, and download any revision.
5. Enforce revision control rules: only one "Released" revision active at a
   time per document; status transitions follow Draft -> In Review ->
   Released -> Obsolete (no skipping review for Released documents).
6. Emit events: `plm.document.uploaded`, `plm.document.revised`,
   `plm.document.released`.
7. Integration tests for the revision lifecycle and for MinIO upload/
   download round-trips.
```

**Definition of Done:**
- A document can be uploaded against a Product, revised, and moved through Draft → In Review → Released without losing prior revisions.
- Only one Released revision is active at a time per document.
- Files round-trip correctly through MinIO (upload then download matches byte-for-byte).
- Events fire on each status transition.

---

## Phase 5 — WMS (Inventory) ✅ COMPLETE

**Prompt:**
```
Building on Phase 1 (Products) and Phase 4 (Documents, for any item
spec/photo references), build the Warehouse Management System.

1. Prisma schema for: Locations (warehouse/site), Bins (location-scoped,
   with a bin code/barcode), and Inventory Quantities (Product x Bin,
   on-hand qty, allocated qty, available = on-hand minus allocated).
2. NestJS services for inventory movement: receiving (increases on-hand at
   a bin), put-away (moves between bins), picking/shipping (decreases
   on-hand, respects allocation), and cycle-count adjustments (with a
   reason code, since unexplained inventory adjustments need an audit
   trail).
3. tRPC endpoints for all movement types plus inventory lookup by Product,
   by Bin, and by Location.
4. A tablet-optimized React PWA UI for warehouse staff: scan-to-receive,
   scan-to-move, scan-to-pick flows, designed for barcode scanner input
   (treat scanner input as fast keyboard entry into a focused field).
5. Barcode scanning logic: support standard barcode formats for both bin
   labels and product/SKU labels; the UI should auto-advance focus after a
   successful scan to support rapid scanning without touching the screen
   between items.
6. Emit events: `wms.inventory.received`, `wms.inventory.moved`,
   `wms.inventory.shipped`, `wms.inventory.adjusted`.
7. Integration tests covering the movement logic, especially that
   on-hand/allocated/available math never goes negative without an explicit
   override.
```

**Definition of Done:**
- Receiving, put-away, picking, and adjustment flows all correctly update on-hand/allocated/available quantities.
- The PWA UI is usable end-to-end with a barcode scanner on a tablet form factor.
- Negative-inventory edge cases are handled deliberately, not silently.
- Events fire on every inventory-changing action.

---

## Phase 6 — CRM & CPQ (Sales) ✅ COMPLETE

**Prompt:**
```
Building on Phase 1 (Customers, Products) and Phase 5 (Inventory
availability), build Quoting and CPQ.

1. Translate the legacy Python quoting logic into a TypeScript NestJS
   service. (If the legacy logic itself isn't available to inspect, build a
   configurable pricing rules engine — base price, customer-tier discounts,
   volume breaks, and manual override with required reason — and document
   it clearly as the assumed ruleset pending validation against the legacy
   behavior.)
2. Prisma schema for Quotes (header: customer, status, valid-until date,
   created-by) and LineItems (product, qty, unit price, discount, computed
   line total), with a historical snapshot mechanism — once a quote is
   sent, its pricing is frozen even if catalog prices change later.
3. tRPC endpoints for quote creation, line item management, pricing
   recalculation, quote status transitions (Draft/Sent/Accepted/Rejected/
   Expired), and quote-to-PDF or printable view generation.
4. A dynamic digital catalog UI: browse/search Products with live pricing
   applied per the rules engine, add to an in-progress quote, see running
   totals.
5. Emit events: `sales.quote.created`, `sales.quote.sent`,
   `sales.quote.accepted`, `sales.quote.rejected` — `accepted` is the event
   Phase 7 (Sales Orders) will listen for.
6. Integration tests covering pricing rule application, snapshot freezing,
   and status transition rules (e.g. can't accept an expired quote).
```

**Definition of Done:**
- A quote can be built from the catalog with correct pricing applied automatically.
- Once sent, a quote's pricing is immutable even if catalog prices later change.
- Status transitions are enforced (no invalid jumps, e.g. Draft straight to Accepted).
- `sales.quote.accepted` fires with enough payload detail for Phase 7 to convert it into an order.

---

## Phase 7 — Sales Order Management & Fulfillment ✅ COMPLETE

**Prompt:**
```
Building on Phase 6 (Quotes) and Phase 3 (Finance/Invoicing), and reading
availability from Phase 5 (WMS), build Sales Order conversion and
fulfillment.

1. Prisma schema for Sales Orders (header linked to the originating Quote,
   status, requested ship date) and Order Lines (product, qty ordered, qty
   allocated, qty shipped, qty backordered).
2. A conversion service: listens for `sales.quote.accepted` and creates a
   Sales Order from it, or exposes a manual "convert quote to order"
   action. Quote line items map 1:1 to order lines at the frozen quoted
   price.
3. Allocation logic: on order creation, attempt to allocate available
   inventory from Phase 5; if insufficient, mark the shortfall quantity as
   backordered and flag the order for partial fulfillment.
4. tRPC endpoints for order creation/conversion, allocation, ship
   confirmation (which should call into WMS picking/shipping from Phase 5),
   and order status/backorder visibility.
5. Wire fulfillment to Finance: when an order ships (fully or partially),
   trigger invoice generation against Phase 3's invoicing service for the
   shipped quantity.
6. An order management UI: order list with status/backorder indicators,
   order detail showing allocation and shipment progress.
7. Emit events: `sales.order.created`, `sales.order.allocated`,
   `sales.order.shipped`, `sales.order.backordered`.
8. Integration tests covering full allocation, partial allocation/
   backorder, and the invoice-trigger-on-ship flow.
```

**Definition of Done:**
- An accepted quote correctly becomes a Sales Order with matching frozen pricing.
- Allocation correctly draws from available WMS inventory and flags shortfalls as backorders.
- Shipping a (partial or full) order correctly triggers Finance invoicing for the shipped quantity only.
- Backorder status is visible and resolves correctly once inventory becomes available.

---

## Phase 8 — MPS (Production Scheduling) ✅ COMPLETE

**Prompt:**
```
Building on Phase 7 (Sales Order demand) and Phase 1 (Products), build the
Master Production Schedule engine.

1. Prisma schema for a Factory Calendar (working days, shifts, capacity per
   day/line) and Work Orders (product, quantity, scheduled start/end,
   status, linked demand source).
2. Demand Aggregation logic supporting at least three strategies:
   Weekly aggregation, Monthly aggregation, and Build-To-Order (one Work
   Order per Sales Order line, no aggregation). Make the strategy
   selectable per product or product family.
3. A scheduling engine that takes aggregated demand plus factory calendar
   capacity and proposes a Work Order schedule, flagging any period where
   demand exceeds available capacity (overload) rather than silently
   over-scheduling.
4. tRPC endpoints for calendar management, demand aggregation preview, and
   Work Order schedule generation/adjustment (manual drag-to-reschedule
   should be supported via the API even if the UI version is basic).
5. An MPS dashboard UI: calendar/timeline view of scheduled Work Orders,
   capacity utilization indicators, and overload warnings.
6. Net Demand calculation logic: for each product/period, net demand =
   aggregated sales demand minus available inventory (from Phase 5) minus
   already-scheduled production.
7. Emit events: `mps.workorder.scheduled`, `mps.workorder.rescheduled`,
   `mps.capacity.overloaded`.
8. Integration tests for each aggregation strategy and for overload
   detection.
```

**Definition of Done:**
- Each demand aggregation strategy produces correct, distinct scheduling output against the same input demand.
- Net demand calculation correctly nets out existing inventory and already-scheduled production.
- Overload conditions are flagged, not silently absorbed.
- The dashboard accurately reflects the underlying schedule data.

---

## Phase 9 — MRP (Material Planning) ✅ COMPLETE

**Prompt:**
```
Building on Phase 8 (Work Order schedule) and Phase 1 (Products/Vendors),
build the Material Requirements Planning engine.

1. Prisma schema for Bill of Materials (parent product, component product,
   quantity per, scrap factor) if not already partially modeled in Phase 1,
   plus Purchase Requisitions (suggested item, qty, need-by date, source
   Work Order(s), status).
2. A BOM explosion engine: given a scheduled Work Order from Phase 8,
   recursively explode the BOM to determine gross component requirements,
   including multi-level (sub-assembly) BOMs.
3. Net demand calculation at the component level: gross requirement minus
   on-hand inventory (Phase 5) minus open Purchase Orders (will integrate
   with Phase 10) minus existing requisitions, respecting lead times from
   the Vendor record.
4. Automatic Purchase Requisition generation: when net demand is positive
   for a purchased component, generate a requisition with a need-by date
   back-calculated from the Work Order start date and the component's lead
   time.
5. tRPC endpoints for triggering an MRP run, viewing exploded requirements
   per Work Order, and reviewing/approving generated requisitions.
6. A procurement suggestion UI integrated into the ERP Administration UI
   from Phase 1: list of suggested requisitions with approve/reject/adjust
   actions.
7. Emit events: `mrp.run.completed`, `mrp.requisition.created`.
8. Integration tests covering multi-level BOM explosion accuracy and net
   demand math, including a scrap-factor case.
```

**Definition of Done:**
- Multi-level BOM explosion produces correct gross requirements against a known test BOM.
- Net demand correctly accounts for on-hand inventory and existing requisitions/POs.
- Generated requisitions have correctly back-calculated need-by dates.
- An MRP run is idempotent — re-running without changes doesn't duplicate requisitions.

---

## Phase 10 — Procurement & Vendor Integration ✅ COMPLETE

**Prompt:**
```
Building on Phase 9 (Purchase Requisitions) and Phase 1 (Vendors), build
PO issuance and vendor-facing intake.

1. Prisma schema for Purchase Orders (vendor, line items sourced from
   approved requisitions, status, expected delivery date) and Vendor
   Acknowledgments/ASNs (advance shipping notices: PO reference, items,
   quantities, expected arrival).
2. A PO issuance service: convert one or more approved requisitions
   (optionally consolidating multiple requisitions to the same vendor into
   one PO) into a formal Purchase Order, with a printable/emailable PO
   document.
3. A vendor intake mechanism for acknowledgments and ASNs — at minimum, a
   secured endpoint or simple vendor-facing form where a vendor (or your
   staff on their behalf) can confirm a PO and submit shipment details
   ahead of physical receiving. Note where a true EDI integration would
   plug in later if not building one now.
4. Vendor performance tracking: on-time delivery rate and quantity-accuracy
   rate, computed by comparing PO expected dates/quantities against actual
   WMS receiving events from Phase 5.
5. tRPC endpoints for PO creation/issuance, acknowledgment/ASN intake, and
   vendor scorecard queries.
6. A vendor scorecard UI showing performance metrics per vendor over a
   selectable date range.
7. Emit events: `procurement.po.issued`, `procurement.po.acknowledged`,
   `procurement.asn.received`.
8. Integration tests for PO consolidation logic and for scorecard
   calculation accuracy against seeded receiving data.
```

**Definition of Done:**
- Approved requisitions correctly convert into Purchase Orders, with consolidation working when multiple requisitions share a vendor.
- Vendor acknowledgment/ASN intake correctly links back to the originating PO.
- Vendor scorecards accurately reflect on-time and quantity-accuracy performance against real receiving data.
- WMS receiving (Phase 5) correctly reconciles against open POs.

---

## Phase 11 — Workforce Management (Time & Scheduling) ✅ COMPLETE

**Prompt:**
```
Building on Phase 1 (user/role base) and Phase 8 (Factory Calendar), build
shop-floor time tracking and shift scheduling. This phase is intentionally
scoped to operational labor tracking only — no hiring, benefits, or
performance review functionality.

1. Prisma schema for: Employees (extends the Phase 0 user model with
   employee-specific fields: department, hourly rate or labor cost rate,
   employment status), Shifts (start/end time, days of week or specific
   dates, linked to the Factory Calendar from Phase 8), Shift Assignments
   (employee x shift x date), and Time Entries (clock-in timestamp,
   clock-out timestamp, linked Work Order/department for cost attribution,
   computed duration).
2. NestJS services for: shift schedule generation/assignment, clock-in/
   clock-out with validation (no double clock-in, no clock-out without a
   matching clock-in, flag entries crossing midnight or exceeding a
   sensible max-shift-length for manager review rather than silently
   accepting them), and labor cost calculation (duration x rate, rolled up
   by Work Order and by department).
3. tRPC endpoints for shift schedule CRUD, shift assignment, clock-in/
   clock-out, and labor cost reporting queries.
4. A shift scheduling admin UI (calendar/grid view, assign employees to
   shifts, see coverage gaps) and a separate tablet-friendly time clock UI
   for the shop floor — large touch targets, employee picks themselves
   from a roster or scans a badge, single tap to clock in/out.
5. Basic PTO/availability tracking: a simple "marked unavailable" record
   per employee per date range, factored into shift scheduling so the
   scheduler doesn't assign someone marked unavailable (a full leave-
   approval workflow is out of scope for now).
6. Emit events: `workforce.shift.assigned`, `workforce.clock.in`,
   `workforce.clock.out`, so Phase 12 (MES) can attribute floor activity to
   the currently clocked-in operator.
7. Integration tests covering clock-in/out edge cases and labor cost
   roll-up accuracy.
```

**Definition of Done:**
- An employee can be scheduled to a shift and clock in/out against it from the tablet UI.
- Invalid clock sequences (double clock-in, orphaned clock-out, excessive duration) are caught and flagged, not silently recorded.
- Labor cost correctly rolls up by Work Order and by department.
- PTO/unavailability correctly prevents conflicting shift assignment.
- `workforce.clock.in`/`out` events carry enough data for Phase 12 to attribute machine activity to the active operator.

---

## Phase 12 — MES (Production Execution) ✅ COMPLETE

**Prompt:**
```
Building on Phase 10 (Procurement-fed materials), Phase 8 (scheduled Work
Orders), and Phase 11 (active operator clock-in data), build the shop floor
execution system.

1. Prisma schema for MES-specific entities: Workstations/Machines, Work
   Order Operations (a Work Order broken into sequential operations/steps
   per workstation), and Cycle Records (start/stop timestamps per operation
   run, operator, quantity completed, quantity scrapped placeholder for
   Phase 13 to extend).
2. Real-time updates via WebSocket backed by Redis: as operators start/
   complete operations, connected dashboards (supervisor view, scheduling
   view) update live without polling.
3. A PWA tablet UI for operators: see assigned/available operations at
   their workstation, start/stop a cycle, log quantity completed. Pull the
   active operator from Phase 11's current clock-in state rather than
   requiring manual re-login per operation.
4. Supervisor Verification Gate: Work Order completions require a
   Supervisor-role sign-off before the order is marked fully complete,
   including photo upload capability (store via Phase 4's MinIO
   integration) as evidence attached to the verification record.
5. RBAC: extend roles with Operator and Supervisor, gating start/stop
   actions to Operator+ and verification sign-off to Supervisor+.
6. Placard generation logic: generate a printable/scannable placard (e.g.
   work order traveler with barcode) for a Work Order or operation,
   suitable for physically tracking a job through the shop.
7. Emit events: `mes.operation.started`, `mes.operation.completed`,
   `mes.workorder.verified`, `mes.cycle.recorded` — cycle efficiency
   metrics and Phase 14's maintenance triggers will consume these.
8. Integration tests for the start/stop/verify flow and for the real-time
   update mechanism.
```

**Definition of Done:**
- Operators can start/stop operations from the tablet UI with the active operator correctly attributed from their clock-in state.
- Supervisor verification gate correctly blocks Work Order completion until signed off, with photo evidence attached.
- Real-time dashboard updates correctly reflect floor activity without manual refresh.
- Placards generate correctly and are scannable/traceable back to the Work Order.

---

## Phase 13 — QMS (Quality Management) ✅ COMPLETE

**Prompt:**
```
Building on Phase 12 (MES cycle/operation data) and Phase 4 (MinIO photo
storage), build Quality Management.

1. Prisma schema for: Inspection Checklist Templates (configurable list of
   pass/fail or measured criteria), Inspection Records (linked to a
   Work Order/operation, completed checklist, inspector, result), and
   Non-Conformance Records (linked failed inspection or scrap report,
   severity, disposition status: e.g. Use-As-Is/Rework/Scrap/Return-to-
   Vendor, hold flag).
2. An inspection checklist builder: admin UI to define checklist templates
   per product or operation type, with reusable criteria.
3. tRPC endpoints for: assigning a checklist to an inspection, recording
   inspection results, raising a non-conformance from a failed inspection
   or a standalone scrap report, and managing non-conformance disposition.
4. Non-conformance hold logic: when a non-conformance is raised with a
   "hold" severity, the linked Work Order or inventory lot should be
   flagged as held (visible to WMS/MES) until disposition is resolved.
5. A tablet UI for inspectors: select the relevant checklist, complete it
   with pass/fail or measured values, attach photos for failed criteria.
6. Photo-to-form linking: photos uploaded during inspection link directly
   to the specific checklist criterion they document, stored via MinIO from
   Phase 4.
7. Emit events: `qms.inspection.completed`, `qms.nonconformance.raised`,
   `qms.nonconformance.resolved`, `qms.scrap.reported` — Phase 14 listens
   for scrap-related events to help drive maintenance triggers, and Phase
   15 listens for non-conformance events tied to returns.
8. Integration tests for checklist completion, non-conformance creation
   from a failed inspection, and hold-flag propagation.
```

**Definition of Done:**
- Inspectors can complete a checklist with photo evidence attached to specific failed criteria.
- A failed inspection correctly raises a non-conformance record and applies a hold where appropriate.
- Hold status is visible to WMS/MES, not just buried in QMS.
- Disposition workflow correctly resolves and clears holds.

---

## Phase 14 — CMMS (Maintenance Management) ✅ COMPLETE

**Prompt:**
```
Building on Phase 12 (MES cycle data) and Phase 13 (scrap events), build
maintenance management.

1. Prisma schema for: Assets/Equipment (linked to Phase 12 Workstations/
   Machines), Maintenance Work Orders (asset, type: preventive/corrective,
   status, scheduled vs. actual date), and PM Trigger Rules (asset, trigger
   type: cycle-count threshold or calendar interval, threshold value).
2. Automated maintenance Work Order generation: a service that listens to
   `mes.cycle.recorded` events from Phase 12, tracks cumulative cycle
   counts per asset, and automatically generates a Maintenance Work Order
   when a PM Trigger Rule's threshold is reached. Support calendar-based
   triggers (e.g. every 30 days) in addition to cycle-based ones.
3. tRPC endpoints for asset management, PM rule configuration, maintenance
   Work Order CRUD, and a "due soon / overdue" query for dashboard use.
4. A maintenance management UI: asset list with health/due-status
   indicators, maintenance Work Order queue, and a simple calendar/list
   view of upcoming PM work.
5. Correlate scrap/quality issues from Phase 13 with asset maintenance
   history where relevant (e.g. surfacing recent maintenance on an asset
   when reviewing a non-conformance tied to that asset) — a simple
   cross-reference is enough, not a full root-cause engine.
6. Emit events: `cmms.workorder.created`, `cmms.workorder.completed`,
   `cmms.pm.triggered`.
7. Integration tests for both cycle-based and calendar-based PM triggering,
   including that a triggered PM doesn't re-trigger before being completed.
```

**Definition of Done:**
- Cycle-based PM triggers correctly fire a Maintenance Work Order when threshold is crossed, using real MES cycle data.
- Calendar-based PM triggers correctly fire on schedule.
- A triggered PM doesn't duplicate-trigger while still open.
- The maintenance dashboard accurately reflects due/overdue status.

---

## Phase 15 — Returns & RMA Management ✅ COMPLETE

**Prompt:**
```
Building on Phase 7 (Sales Orders), Phase 13 (QMS non-conformance), and
Phase 5 (WMS receiving), build Return Merchandise Authorization handling.

1. Prisma schema for RMA records: linked Sales Order/line item, customer,
   reason code, status (Requested/Approved/Received/Resolved/Rejected),
   resolution type (Refund/Replace/Repair/Reject), and optional link to a
   QMS Non-Conformance record from Phase 13 when the return is
   quality-related.
2. tRPC endpoints for RMA creation/request, approval/rejection, receiving
   confirmation (hooking into Phase 5's WMS receiving flow so returned
   stock physically lands in a designated returns location/bin), and
   resolution recording.
3. Business rules: an RMA can only be requested against a shipped Sales
   Order line within a configurable return window; receiving a returned
   item that's flagged quality-related should optionally auto-create a
   linked QMS inspection/non-conformance record rather than requiring
   manual duplicate entry.
4. A support/quality staff UI: RMA queue with status filters, RMA detail
   view showing the linked order, customer, and (if applicable) QMS record,
   and actions to move the RMA through its lifecycle.
5. Wire resolution to Finance where relevant: a Refund resolution should
   trigger a credit memo or equivalent against Phase 3's AR.
6. Emit events: `returns.rma.requested`, `returns.rma.received`,
   `returns.rma.resolved`.
7. Integration tests covering the full lifecycle, the return-window rule,
   and the WMS-receiving and Finance-credit integrations.
```

**Definition of Done:**
- An RMA can be requested against a valid shipped order line, respecting the return window.
- Receiving a return correctly lands inventory in WMS and, where flagged, creates a linked QMS record.
- Refund resolutions correctly generate the appropriate Finance credit.
- RMA status and history are fully visible to support/quality staff.

---

## Phase 16 — Analytics & AI ✅ COMPLETE

**Prompt:**
```
Building on the full Event Bus history from Phases 0–15, build the
Analytics Engine.

1. Build an event consumer/ingestion layer that subscribes to all
   documented Event Bus topics from prior phases and persists them into an
   analytics-optimized store (a dedicated Postgres schema/warehouse table
   set is fine if a separate analytics database isn't in scope yet).
2. Implement Natural Language Querying: an interface where a user can ask a
   question in plain English (e.g. "what was our scrap rate by product last
   month") and get back a structured answer/chart, translating the
   question into a query against the ingested event/analytics data.
3. Volumetric Bottleneck tracking: analyze MES operation cycle times
   (Phase 12) and Work Order flow to identify workstations/operations where
   work-in-progress is accumulating disproportionately, surfaced as a
   bottleneck dashboard.
4. Predictive forecasting for inventory: using historical WMS movement and
   Sales Order demand data, forecast expected inventory depletion/reorder
   timing per product, surfaced as a forecast view feeding back into
   Phase 9's MRP suggestions where relevant.
5. Build an Analytics Dashboard UI: configurable widgets/charts pulling
   from the above, with role-based views (e.g. a floor-level bottleneck
   view for supervisors, a forecasting view for planners).
6. Document data freshness/latency expectations (real-time via Event Bus
   subscription vs. batch-computed forecasts) clearly in the dashboard so
   users aren't misled about how current a given number is.
7. Integration tests for event ingestion completeness and for forecast
   accuracy against a known synthetic dataset.
```

**Definition of Done:**
- Events from all prior phases are correctly ingested with no silent drops.
- Natural language queries return correct, verifiable answers against known seed data.
- Bottleneck detection correctly identifies a deliberately-seeded WIP pileup in test data.
- Inventory forecasts are directionally correct against a known synthetic demand pattern.

---

## Phase 17 — Training, UAT & Change Management ✅ COMPLETE

**Prompt:**
```
This phase is documentation and process work, not new application code,
performed once Phases 1–16 are substantially feature-complete.

1. Generate role-based user guides for each module built in Phases 1–16
   (ERP Admin, Finance, PLM, WMS, CRM/CPQ, Sales Order, MPS/MRP,
   Procurement, Workforce, MES, QMS, CMMS, Returns, Analytics), derived
   directly from the actual tRPC endpoints and UI flows implemented —
   don't describe planned features that weren't actually built.
2. Generate UAT test scripts per module: step-by-step scenarios a real
   end-user (not a developer) can follow to validate the module works as
   intended, with expected results and a pass/fail sign-off field per step.
3. Produce role-based onboarding guides: a condensed quick-start per
   persona (Operator, Supervisor, Inspector, Sales Rep, Planner, Buyer,
   Finance, Admin) covering just what that role needs on day one.
4. Stand up an internal support/feedback process: a lightweight ticketing
   or issue-tracking convention for post-launch bugs/requests (this can be
   a defined workflow using existing tools rather than new code — document
   intake, triage, and escalation steps clearly).
5. Compile a master UAT sign-off tracker so each module's testing status is
   visible in one place before declaring a release milestone (MVP, Revenue
   Release, etc.) complete.
```

**Definition of Done:**
- Every module has a user guide and a UAT script that an actual end-user has successfully followed.
- Role-based onboarding guides exist for every persona introduced across the build.
- The support/feedback process is documented and at least one test ticket has been run through it end-to-end.
- The master UAT tracker accurately reflects sign-off status across all modules.

---

## Foundational Tech Strategy (reference, unchanged from the roadmap)
- Backend: Node.js (NestJS) Modular Monolith.
- Database: PostgreSQL (System of Record), Redis (Real-time/Event Bus), MinIO (Object Storage).
- Development Framework: Nx Monorepo, TypeScript, tRPC, Shadcn UI.
- Build Sequence: Schema -> Service -> API -> Tests -> UI -> Integration.
- Release Milestones: MVP, Revenue Release, Planning Release, Execution Release, Enterprise Release.
