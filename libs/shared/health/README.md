# Shared Health Library

System health watchdog exposing `/api/health`.

## Checks

- PostgreSQL connectivity
- Redis connectivity
- MinIO (S3) connectivity

## Alerting

Failed checks trigger log-based alerts via `HealthAlertService`. Replace with PagerDuty/Opsgenie in production.
