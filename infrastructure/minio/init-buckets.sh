#!/bin/sh
# ============================================================================
# MINIO S3-COMPATIBLE BUCKET INITIALIZATION SCRIPT
# ============================================================================
set -e

echo "[MinIO Init] Configuring MinIO Client (mc)..."
/usr/bin/mc alias set local http://minio:9000 minioadmin minioadmin

echo "[MinIO Init] Creating enterprise storage buckets..."
/usr/bin/mc mb --ignore-existing local/inventory-attachments
/usr/bin/mc mb --ignore-existing local/inventory-receipts
/usr/bin/mc mb --ignore-existing local/system-backups

echo "[MinIO Init] Setting access policies..."
/usr/bin/mc anonymous set download local/inventory-attachments

echo "[MinIO Init] Storage buckets initialized."

