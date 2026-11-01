#!/bin/bash
# ============================================================================
# POSTGRESQL 16 AUTOMATED MULTI-SCHEMA INITIALIZATION SCRIPT
# Runs on container initialization in /docker-entrypoint-initdb.d
# ============================================================================
set -e

echo "[Postgres Init] Provisioning multi-schema structure for ecosystem_db..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE SCHEMA IF NOT EXISTS platform;
    CREATE SCHEMA IF NOT EXISTS shared;
    CREATE SCHEMA IF NOT EXISTS inventory;

    GRANT ALL ON SCHEMA platform TO $POSTGRES_USER;
    GRANT ALL ON SCHEMA shared TO $POSTGRES_USER;
    GRANT ALL ON SCHEMA inventory TO $POSTGRES_USER;
EOSQL

echo "[Postgres Init] Schemas platform, shared, and inventory provisioned successfully."
