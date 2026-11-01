-- ============================================================================
-- INVENTORY MODULE VIEWS - POSTGRESQL 16
-- Real-time Analytics, Valuation Aggregates, and Automated Reorder Alerts
-- ============================================================================

-- 1. Real-Time Consolidated Item Stock Position View
CREATE OR REPLACE VIEW inventory.v_stock_summary AS
SELECT 
    i.id AS item_id,
    i.tenant_id,
    i.code AS item_code,
    i.name AS item_name,
    c.name AS category_name,
    b.name AS brand_name,
    u.symbol AS uom_symbol,
    COALESCE(SUM(bal.on_hand_qty), 0) AS total_on_hand,
    COALESCE(SUM(bal.reserved_qty), 0) AS total_reserved,
    COALESCE(SUM(bal.blocked_qty), 0) AS total_blocked,
    COALESCE(SUM(bal.on_hand_qty - bal.reserved_qty - bal.blocked_qty), 0) AS total_available,
    i.reorder_point,
    i.reorder_quantity,
    COALESCE(v.weighted_average_cost, 0) AS unit_wav_cost,
    COALESCE(SUM(bal.on_hand_qty) * v.weighted_average_cost, 0) AS total_valuation,
    CASE 
        WHEN COALESCE(SUM(bal.on_hand_qty), 0) <= 0 THEN 'OUT_OF_STOCK'
        WHEN COALESCE(SUM(bal.on_hand_qty), 0) <= i.reorder_point THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END AS inventory_status
FROM inventory.inv_items i
LEFT JOIN inventory.inv_categories c ON i.category_id = c.id
LEFT JOIN inventory.inv_brands b ON i.brand_id = b.id
LEFT JOIN inventory.inv_units u ON i.base_uom_id = u.id
LEFT JOIN inventory.inv_balances bal ON bal.item_id = i.id
LEFT JOIN inventory.inv_valuations v ON v.item_id = i.id
GROUP BY i.id, i.tenant_id, i.code, i.name, c.name, b.name, u.symbol, i.reorder_point, i.reorder_quantity, v.weighted_average_cost;

-- 2. Automated Reorder Alerts View
CREATE OR REPLACE VIEW inventory.v_reorder_alerts AS
SELECT 
    s.item_id,
    s.tenant_id,
    s.item_code,
    s.item_name,
    s.category_name,
    s.total_on_hand,
    s.total_available,
    s.reorder_point,
    s.reorder_quantity,
    (s.reorder_point - s.total_available + s.reorder_quantity) AS suggested_procurement_qty,
    s.unit_wav_cost,
    ((s.reorder_point - s.total_available + s.reorder_quantity) * s.unit_wav_cost) AS estimated_procurement_cost
FROM inventory.v_stock_summary s
WHERE s.total_available <= s.reorder_point;

-- 3. Warehouse Capacity & SKU Velocity View
CREATE OR REPLACE VIEW inventory.v_warehouse_capacity AS
SELECT 
    w.id AS warehouse_id,
    w.tenant_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    COUNT(DISTINCT l.id) AS total_locations_count,
    COUNT(DISTINCT bal.item_id) AS distinct_skus_stored,
    COALESCE(SUM(bal.on_hand_qty), 0) AS total_units_in_facility,
    COALESCE(SUM(bal.on_hand_qty * v.weighted_average_cost), 0) AS total_facility_valuation
FROM inventory.inv_warehouses w
LEFT JOIN inventory.inv_locations l ON l.warehouse_id = w.id
LEFT JOIN inventory.inv_balances bal ON bal.warehouse_id = w.id
LEFT JOIN inventory.inv_valuations v ON v.warehouse_id = w.id AND v.item_id = bal.item_id
GROUP BY w.id, w.tenant_id, w.code, w.name;
