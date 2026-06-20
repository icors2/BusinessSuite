# PostgreSQL Backup & Restore Runbook

## Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **RPO** (Recovery Point Objective) | ≤ 24 hours | Nightly encrypted backups |
| **RTO** (Recovery Time Objective) | ≤ 4 hours | Restore + verification on on-prem hardware |

> **Placeholder:** Confirm RPO/RTO with operations before production go-live.

## Prerequisites

- `pg_dump` and `psql` client tools installed
- `DATABASE_URL` environment variable set
- Optional: GPG configured with `BACKUP_GPG_RECIPIENT` for encryption at rest

## Backup procedure

```bash
export DATABASE_URL="postgresql://anc:anc@localhost:5432/anc_suite?schema=public"
export BACKUP_DIR="./backups"
export BACKUP_RETENTION_DAYS=14
# Optional encryption:
# export BACKUP_GPG_RECIPIENT="ops@arcncode.local"

npm run backup
# or: bash scripts/backup.sh
```

Backups are written to `./backups/` with timestamped filenames. Files older than the retention period are automatically deleted.

## Restore procedure

1. Stop the API to prevent writes during restore:
   ```bash
   docker compose stop api
   ```
2. Restore from the latest backup:
   ```bash
   export DATABASE_URL="postgresql://anc:anc@localhost:5432/anc_suite?schema=public"
   npm run restore -- ./backups/anc_suite_YYYYMMDD_HHMMSS.sql
   ```
3. Restart services and verify:
   ```bash
   docker compose up -d
   curl http://localhost:3000/api/health
   ```
4. Confirm auth works with a seeded user login.

## Scheduled backups (production)

On self-hosted Docker deployments, schedule nightly backups via cron on the host:

```cron
0 2 * * * cd /opt/anc-business-suite && DATABASE_URL=... BACKUP_GPG_RECIPIENT=... bash scripts/backup.sh >> /var/log/anc-backup.log 2>&1
```

## Verification checklist

- [ ] Backup script completes without error
- [ ] Backup file exists in `backups/` directory
- [ ] Restore to a staging database succeeds
- [ ] `/api/health` returns green after restore
- [ ] Seeded admin user can log in after restore

## Dry-run note

Run `bash scripts/backup.sh` against a local Postgres instance after `docker compose up`. Restore to a separate test database before production use.
