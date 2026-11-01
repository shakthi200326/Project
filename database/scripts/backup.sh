#!/usr/bin/env bash
# ============================================================================
# ENTERPRISE POSTGRESQL 16 MULTI-SCHEMA BACKUP SCRIPT
# ============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./database/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5434}"
DB_NAME="${DB_NAME:-ecosystem_db}"
DB_USER="${DB_USER:-postgres}"

mkdir -p "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"

echo "[$(date -u)] Initiating multi-schema backup for ${DB_NAME} on ${DB_HOST}:${DB_PORT}..."

PGPASSWORD="${DB_PASSWORD:-postgres}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -F c \
    -b \
    -v \
    -f "${BACKUP_FILE}" \
    "${DB_NAME}"

echo "[$(date -u)] Backup created successfully: ${BACKUP_FILE}"
ls -lh "${BACKUP_FILE}"
