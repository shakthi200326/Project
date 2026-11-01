#!/usr/bin/env bash
# ============================================================================
# PRODUCTION DEPLOYMENT AUTOMATION SCRIPT
# ============================================================================
set -euo pipefail

echo "===================================================================="
echo " Starting Universal Business Modules Ecosystem Deployment"
echo "===================================================================="

# 1. Environment validation
if [ ! -f .env ]; then
    echo "[Notice] .env file not found. Bootstrapping from .env.example..."
    cp .env.example .env
fi

# 2. Database & Infrastructure Provisioning
echo "[Step 1/4] Starting core container infrastructure..."
docker compose up -d postgres redis minio

echo "[Step 2/4] Waiting for PostgreSQL readiness..."
docker compose exec postgres pg_isready -U postgres -t 30

echo "[Step 3/4] Running Django migrations and seeding baseline data..."
docker compose run --rm inventory_backend python modules/inventory/backend/manage.py migrate
docker compose run --rm inventory_backend python modules/inventory/backend/manage.py seed_inventory_demo

echo "[Step 4/4] Starting API gateway, Celery worker, and UI shell..."
docker compose up -d

echo "===================================================================="
echo " Ecosystem Successfully Deployed!"
echo " Frontend UI    : http://localhost:5174"
echo " API Gateway    : http://localhost:8088/api/v1/inventory/"
echo " MinIO Console  : http://localhost:9003"
echo "===================================================================="

