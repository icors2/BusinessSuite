# Shared Auth Library

JWT authentication with refresh tokens and RBAC.

## Roles (Phase 0)

- `Admin`
- `Manager`

## Exports

- `AuthModule`, `AuthService`
- `@Roles()`, `@Public()` decorators
- `JwtAuthGuard`, `RolesGuard`

## tRPC routes

_Phase 1+ will expose via tRPC. Phase 0 uses REST under `/api/auth`._
