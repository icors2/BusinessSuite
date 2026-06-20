# QMS — Quality Management

## Purpose

Inspection templates, inspector checklists with photo evidence, non-conformance records, scrap reporting, and supervisor disposition. HOLD severity blocks MES/WMS until cleared.

## Who uses it

| Role | Access |
|------|--------|
| Inspector | Complete inspections, raise NC, report scrap |
| Supervisor | Disposition NC (release, rework, scrap) |
| Admin, Manager | Template builder |

## UI routes

| Route | Description |
|-------|-------------|
| `/qms/inspection` | Tablet inspector UI |
| `/qms/checklist-builder` | Template and criteria |
| `/qms/non-conformance` | NC list and disposition |

## Key tasks

1. **Checklist builder** — create template with pass/fail and measurement criteria.
2. **Inspection** — complete checklist against a work order; attach photos per criterion.
3. **Raise NC** — create non-conformance with severity (HOLD blocks production/shipping).
4. **Disposition** — supervisor resolves NC (clears holds when all open NCs closed).

## Permissions

- Complete inspection / raise NC / scrap: **Inspector**+ (`canInspect`).
- Disposition: **Supervisor**+ (`canDisposition`).

## tRPC procedures

- `qms`: upsertTemplate, addCriterion, completeInspection, raiseNonConformance, reportScrap, disposition, listTemplates, getTemplate, listInspections, getInspection, listNonConformances, getNonConformance

## Related events

`qms.inspection.completed`, `qms.nc.raised`, `qms.nc.dispositioned`, `qms.scrap.reported`

## Demo login

- Inspector: `inspector@arcncode.local` / `Inspector123!`
- Supervisor: `supervisor@arcncode.local` / `Supervisor123!`
