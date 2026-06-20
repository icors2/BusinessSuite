# Master Data Library

Domain services and tRPC routers for ERP master data entities: **Product**, **Customer**, and **Vendor**.

## Features

- CRUD operations with soft-delete (`deactivate`)
- Validation: SKU uniqueness, duplicate customer detection (name + billing address)
- Audit logging via `AuditService`
- Event emission via Redis Streams event bus
- tRPC routers with role-gated writes (Admin/Manager only)

## Usage

Import `MasterdataModule` in the API app module. Mount tRPC routers via `libs/trpc`.
