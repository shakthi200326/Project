-- ==============================================================================
-- UNIVERSAL REUSABLE BUSINESS MODULES ECOSYSTEM - DATABASE INITIALIZATION
-- Target Database: PostgreSQL 16
-- Multi-Schema Architecture: platform, shared, inventory
-- ==============================================================================

-- Create Schemas
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS shared;
CREATE SCHEMA IF NOT EXISTS inventory;

-- Set search path
SET search_path TO inventory, shared, platform, public;

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant Permissions
GRANT ALL ON SCHEMA platform TO postgres;
GRANT ALL ON SCHEMA shared TO postgres;
GRANT ALL ON SCHEMA inventory TO postgres;

