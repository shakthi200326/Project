-- ============================================================================
-- INVENTORY MODULE SCHEMA DDL - POSTGRESQL 16
-- Multi-facility, Multi-location, Batch & Serial, Stock Ledger & Invariant Engine
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS inventory;

-- 1. Categories
CREATE TABLE IF NOT EXISTS inventory.inv_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES inventory.inv_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inv_cat_code UNIQUE (tenant_id, code)
);

-- 2. Brands
CREATE TABLE IF NOT EXISTS inventory.inv_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    country_of_origin VARCHAR(100),
    website VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inv_brand_code UNIQUE (tenant_id, code)
);

-- 3. Units of Measure (UOM)
CREATE TABLE IF NOT EXISTS inventory.inv_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    code VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    decimal_places INT DEFAULT 0,
    is_base_unit BOOLEAN DEFAULT TRUE,
    conversion_factor NUMERIC(15, 6) DEFAULT 1.000000,
    base_unit_id UUID REFERENCES inventory.inv_units(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inv_unit_code UNIQUE (tenant_id, code)
);

-- 4. Stock Items / Products
CREATE TABLE IF NOT EXISTS inventory.inv_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES inventory.inv_categories(id) ON DELETE SET NULL,
    brand_id UUID REFERENCES inventory.inv_brands(id) ON DELETE SET NULL,
    base_uom_id UUID REFERENCES inventory.inv_units(id) ON DELETE SET NULL,
    tracking_type VARCHAR(20) DEFAULT 'NONE', -- NONE, BATCH, SERIAL
    reorder_point NUMERIC(15, 4) DEFAULT 0,
    reorder_quantity NUMERIC(15, 4) DEFAULT 0,
    barcode VARCHAR(128),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inv_item_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inv_items_barcode ON inventory.inv_items(barcode);

-- 5. Product Variants
CREATE TABLE IF NOT EXISTS inventory.inv_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    item_id UUID NOT NULL REFERENCES inventory.inv_items(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    variant_name VARCHAR(255) NOT NULL,
    attributes JSONB DEFAULT '{}'::jsonb,
    barcode VARCHAR(128),
    cost_override NUMERIC(15, 4),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inv_variant_sku UNIQUE (tenant_id, sku)
);

-- 6. Warehouses & Facilities
CREATE TABLE IF NOT EXISTS inventory.inv_warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inv_warehouse_code UNIQUE (tenant_id, code)
);

-- 7. Storage Locations (Zones, Aisles, Racks, Bins)
CREATE TABLE IF NOT EXISTS inventory.inv_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    warehouse_id UUID NOT NULL REFERENCES inventory.inv_warehouses(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    zone VARCHAR(64),
    aisle VARCHAR(32),
    rack VARCHAR(32),
    bin VARCHAR(32),
    location_type VARCHAR(32) DEFAULT 'BIN', -- BIN, RACK, BAY, VAULT, STAGE
    capacity_weight_kg NUMERIC(12, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inv_wh_location_code UNIQUE (warehouse_id, code)
);

-- 8. Batches & Lots
CREATE TABLE IF NOT EXISTS inventory.inv_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    item_id UUID NOT NULL REFERENCES inventory.inv_items(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES inventory.inv_warehouses(id) ON DELETE SET NULL,
    batch_number VARCHAR(128) NOT NULL,
    manufacture_date DATE,
    expiry_date DATE NOT NULL,
    initial_quantity NUMERIC(15, 4) NOT NULL,
    current_quantity NUMERIC(15, 4) NOT NULL,
    status VARCHAR(32) DEFAULT 'RELEASED', -- RELEASED, QUARANTINED, EXPIRED
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inv_item_batch UNIQUE (item_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_inv_batches_expiry ON inventory.inv_batches(expiry_date);

-- 9. Serial Numbers
CREATE TABLE IF NOT EXISTS inventory.inv_serials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    item_id UUID NOT NULL REFERENCES inventory.inv_items(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES inventory.inv_warehouses(id) ON DELETE SET NULL,
    location_id UUID REFERENCES inventory.inv_locations(id) ON DELETE SET NULL,
    batch_id UUID REFERENCES inventory.inv_batches(id) ON DELETE SET NULL,
    serial_number VARCHAR(128) NOT NULL,
    status VARCHAR(32) DEFAULT 'IN_STOCK', -- IN_STOCK, DISPATCHED, IN_MAINTENANCE, SCRAPPED
    received_date DATE,
    warranty_until DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inv_item_serial UNIQUE (item_id, serial_number)
);

-- 10. Real-Time Stock Balances Matrix
CREATE TABLE IF NOT EXISTS inventory.inv_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    item_id UUID NOT NULL REFERENCES inventory.inv_items(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES inventory.inv_variants(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES inventory.inv_warehouses(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES inventory.inv_locations(id) ON DELETE CASCADE,
    on_hand_qty NUMERIC(20, 4) DEFAULT 0 CHECK (on_hand_qty >= 0),
    reserved_qty NUMERIC(20, 4) DEFAULT 0 CHECK (reserved_qty >= 0),
    blocked_qty NUMERIC(20, 4) DEFAULT 0 CHECK (blocked_qty >= 0),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inv_balance_position UNIQUE (item_id, variant_id, warehouse_id, location_id)
);

-- 11. Immutable Stock Audit Ledger
CREATE TABLE IF NOT EXISTS inventory.inv_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    transaction_ref VARCHAR(100) NOT NULL,
    movement_type VARCHAR(32) NOT NULL,
    item_id UUID NOT NULL REFERENCES inventory.inv_items(id),
    variant_id UUID REFERENCES inventory.inv_variants(id),
    warehouse_id UUID NOT NULL REFERENCES inventory.inv_warehouses(id),
    location_id UUID REFERENCES inventory.inv_locations(id),
    quantity_delta NUMERIC(20, 4) NOT NULL,
    balance_after NUMERIC(20, 4) NOT NULL,
    unit_cost NUMERIC(15, 4) NOT NULL,
    total_value_delta NUMERIC(20, 4) NOT NULL,
    actor VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inv_ledger_query ON inventory.inv_ledger(item_id, warehouse_id, created_at DESC);

-- 12. Stock Valuations (Moving Weighted Average)
CREATE TABLE IF NOT EXISTS inventory.inv_valuations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    item_id UUID NOT NULL REFERENCES inventory.inv_items(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES inventory.inv_warehouses(id) ON DELETE CASCADE,
    total_quantity NUMERIC(20, 4) DEFAULT 0,
    weighted_average_cost NUMERIC(15, 4) DEFAULT 0,
    total_valuation NUMERIC(20, 4) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inv_item_wh_valuation UNIQUE (item_id, warehouse_id)
);

