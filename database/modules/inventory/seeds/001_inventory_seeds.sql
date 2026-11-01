-- ============================================================================
-- INVENTORY MODULE SEEDS - POSTGRESQL 16
-- Standard Enterprise OEM Brands, Metric UOMs, Facilities, and Stock Catalog
-- ============================================================================

-- 1. Base Units of Measure
INSERT INTO inventory.inv_units (id, code, name, symbol, decimal_places, is_base_unit, conversion_factor)
VALUES 
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'EA', 'Piece / Unit', 'ea', 0, TRUE, 1.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d02', 'KG', 'Kilogram', 'kg', 3, TRUE, 1.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d03', 'LTR', 'Liter', 'L', 2, TRUE, 1.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d04', 'MTR', 'Meter', 'm', 2, TRUE, 1.0)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 2. Derived Units of Measure
INSERT INTO inventory.inv_units (id, code, name, symbol, decimal_places, is_base_unit, conversion_factor, base_unit_id)
VALUES 
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d05', 'BOX', 'Box (10 units)', 'bx', 0, FALSE, 10.0, 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d06', 'PAL', 'Pallet (100 units)', 'pal', 0, FALSE, 100.0, 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01')
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 3. OEM Brands
INSERT INTO inventory.inv_brands (id, code, name, country_of_origin, website)
VALUES 
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', 'SKF', 'SKF Precision Components', 'Sweden', 'https://www.skf.com'),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e02', 'REX', 'Bosch Rexroth Industrial', 'Germany', 'https://www.boschrexroth.com'),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e03', 'GAT', 'Gates Power Transmission', 'USA', 'https://www.gates.com'),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e04', 'OMR', 'Omron Industrial Automation', 'Japan', 'https://www.omron.com'),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e05', 'MOB', 'Mobil Industrial Lubricants', 'USA', 'https://www.mobil.com')
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 4. Categories
INSERT INTO inventory.inv_categories (id, code, name)
VALUES 
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f01', 'CAT-MECH', 'Mechanical Components'),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f02', 'CAT-HYD', 'Hydraulics & Pneumatics'),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f03', 'CAT-TRANS', 'Power Transmission'),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f04', 'CAT-SENS', 'Sensors & Automation'),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f05', 'CAT-CHEM', 'Chemicals & Fluids')
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 5. Warehouses
INSERT INTO inventory.inv_warehouses (id, code, name, address)
VALUES 
('10eebc99-9c0b-4ef8-bb6d-6bb9bd380001', 'WH-MAIN', 'Main Central Fulfillment Hub', '742 Logistics Corridor, Chicago, IL'),
('10eebc99-9c0b-4ef8-bb6d-6bb9bd380002', 'WH-EAST', 'East Coast Logistics Terminal', 'Pier 12 Harbor Boulevard, Newark, NJ'),
('10eebc99-9c0b-4ef8-bb6d-6bb9bd380003', 'WH-COLD', 'Cold Storage & Perishables Facility', 'Sector B Coldway, Dallas, TX')
ON CONFLICT (tenant_id, code) DO NOTHING;

