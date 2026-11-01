-- ============================================================================
-- PLATFORM SEEDS - POSTGRESQL 16
-- Initial Tenant, Organization, Roles, and Module Registry entries
-- ============================================================================

-- 1. Default Tenant
INSERT INTO platform.tenants (id, code, name, domain, subscription_tier)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'enterprise-default',
    'Apex Industrial Global Holdings',
    'apex-industrial.internal',
    'ENTERPRISE_UNLIMITED'
) ON CONFLICT (code) DO NOTHING;

-- 2. Default Organization
INSERT INTO platform.organisations (id, tenant_id, code, name, currency)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'ORG-NORTH-AMERICA',
    'North America Supply & Distribution Corp',
    'USD'
) ON CONFLICT (tenant_id, code) DO NOTHING;

-- 3. Core Roles
INSERT INTO platform.roles (id, tenant_id, name, description, is_system_role)
VALUES 
(
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'INVENTORY_SUPERVISOR',
    'Full administrative control over warehouse operations, stock transfers, and audits',
    TRUE
),
(
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c34',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'WAREHOUSE_OPERATOR',
    'Operational staff capable of scanning goods, logging put-away, and executing cycle counts',
    TRUE
)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 4. Module Registry: Inventory Module v3.1
INSERT INTO platform.modules (code, name, version, is_enabled, config)
VALUES (
    'inventory',
    'Universal Reusable Inventory Management Engine',
    '3.1.0',
    TRUE,
    '{"storage_backend": "polymorphic", "ledger_immutable": true, "valuation_method": "WAV"}'::jsonb
) ON CONFLICT (code) DO NOTHING;
