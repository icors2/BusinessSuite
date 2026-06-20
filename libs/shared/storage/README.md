# storage

Shared MinIO/S3 object storage wrapper for binary file persistence (PLM documents, future WMS/QMS attachments).

## Usage

```typescript
StorageModule.forRoot(appConfig);
```

Inject `StorageService` for `putObject`, `getObject`, and `objectKeyFor`.
