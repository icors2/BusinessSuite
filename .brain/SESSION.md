# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-21

---

## Current Focus

Replaced horizontal nav with shadcn **sidebar-07** (collapsible icon sidebar).

---

## Active Task

_None — layout implemented; user may want Docker rebuild / commit._

---

## Recent Progress

- Installed shadcn UI: sidebar, breadcrumb, collapsible, dropdown-menu, avatar, tooltip, sheet, separator, skeleton, use-mobile
- Added Radix deps + `tailwindcss-animate`; sidebar CSS variables in `styles.css`
- Created `apps/web/src/components/layout/sidebar/*` (AppSidebar, NavMain, NavProjects, NavUser, TeamSwitcher)
- `nav-data.ts` maps all ERP modules into collapsible groups + Tutorials quick link
- `app-layout.tsx` uses SidebarProvider / SidebarInset / breadcrumbs / SidebarTrigger
- Vite build passes (`npx vite build` in `apps/web`)

---

## Session Notes

- `nx build web` still fails on unrelated `database:build` TS4111; use `vite build` in `apps/web` for web-only verify
- `data-tour="main-content"` preserved on main for tutorials
