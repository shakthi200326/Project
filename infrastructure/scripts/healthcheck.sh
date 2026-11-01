#!/usr/bin/env bash
# ============================================================================
# ECOSYSTEM ENDPOINT & CONTAINER HEALTHCHECK
# ============================================================================
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8008/api/v1/inventory/dashboard/kpis/}"
STORAGE_URL="${STORAGE_URL:-http://localhost:8008/api/v1/storage/files/}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5174/}"

echo "Checking Ecosystem Health..."

echo -n "1. Inventory Backend KPI API: "
curl -s -f -o /dev/null -w "%{http_code}\n" "${BACKEND_URL}" || echo "OFFLINE"

echo -n "2. Universal File Storage API: "
curl -s -f -o /dev/null -w "%{http_code}\n" "${STORAGE_URL}" || echo "OFFLINE"

echo -n "3. Enterprise Frontend UI Shell: "
curl -s -f -o /dev/null -w "%{http_code}\n" "${FRONTEND_URL}" || echo "OFFLINE"

echo "Healthcheck complete."

