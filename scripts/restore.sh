#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-file.sql|backup-file.sql.gpg>"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

RESTORE_SQL="${BACKUP_FILE}"

if [[ "${BACKUP_FILE}" == *.gpg ]]; then
  if ! command -v gpg >/dev/null 2>&1; then
    echo "GPG is required to decrypt ${BACKUP_FILE}"
    exit 1
  fi
  RESTORE_SQL="/tmp/anc_restore_$(date +%s).sql"
  gpg --decrypt --output "${RESTORE_SQL}" "${BACKUP_FILE}"
fi

echo "Restoring database from ${RESTORE_SQL}"
psql "${DATABASE_URL}" < "${RESTORE_SQL}"
echo "Restore complete."
