# tRPC Library

Shared tRPC infrastructure for the Arc N Code Business Suite API.

## Exports

- `createTrpcContext` / procedure helpers (`publicProcedure`, `protectedProcedure`, `editorProcedure`)
- `createContextFromRequest` — JWT extraction from Express `Authorization` header
- `createAppRouter` — composes masterdata routers
- `AppRouter` type — consumed by the web client for end-to-end type safety

## Mounting

The API mounts tRPC at `/trpc` via Express middleware in `apps/api/src/main.ts`.
