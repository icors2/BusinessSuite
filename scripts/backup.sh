#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/anc_suite_${TIMESTAMP}.sql"
ENCRYPTED_FILE="${BACKUP_FILE}.gpg"

mkdir -p "${BACKUP_DIR}"

echo "Creating backup: ${BACKUP_FILE}"
pg_dump "${DATABASE_URL}" > "${BACKUP_FILE}"

if command -v gpg >/dev/null 2>&1 && [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
  echo "Encrypting backup for recipient: ${BACKUP_GPG_RECIPIENT}"
  gpg --encrypt --recipient "${BACKUP_GPG_RECIPIENT}" --output "${ENCRYPTED_FILE}" "${BACKUP_FILE}"
  rm -f "${BACKUP_FILE}"
  echo "Encrypted backup written to ${ENCRYPTED_FILE}"
else
  echo "GPG not configured; plain SQL backup written to ${BACKUP_FILE}"
fi

echo "Applying retention policy: ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -type f \( -name '*.sql' -o -name '*.sql.gpg' \) -mtime +"${RETENTION_DAYS}" -delete

echo "Backup complete."
