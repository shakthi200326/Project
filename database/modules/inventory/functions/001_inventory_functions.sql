-- ============================================================================
-- INVENTORY MODULE FUNCTIONS & TRIGGERS - POSTGRESQL 16
-- Enforce Invariants, Immutability & Mathematical Accuracy
-- ============================================================================

-- 1. Prevent Any Updates or Deletions to the Stock Audit Ledger
CREATE OR REPLACE FUNCTION inventory.fn_prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: The stock audit ledger (inv_ledger) is strictly append-only. Modification or deletion of transaction records is forbidden by regulatory ISO/IFRS standards.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_inv_ledger ON inventory.inv_ledger;
CREATE TRIGGER trg_protect_inv_ledger
BEFORE UPDATE OR DELETE ON inventory.inv_ledger
FOR EACH ROW
EXECUTE FUNCTION inventory.fn_prevent_ledger_modification();


-- 2. Recalculate Weighted Average Cost on Inbound Receipts
CREATE OR REPLACE FUNCTION inventory.fn_calculate_wav(
    p_item_id UUID,
    p_warehouse_id UUID,
    p_inbound_qty NUMERIC,
    p_inbound_unit_cost NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    v_curr_qty NUMERIC := 0;
    v_curr_wav NUMERIC := 0;
    v_new_qty NUMERIC := 0;
    v_new_wav NUMERIC := 0;
BEGIN
    SELECT total_quantity, weighted_average_cost 
    INTO v_curr_qty, v_curr_wav
    FROM inventory.inv_valuations
    WHERE item_id = p_item_id AND warehouse_id = p_warehouse_id;

    IF NOT FOUND THEN
        v_curr_qty := 0;
        v_curr_wav := 0;
    END IF;

    v_new_qty := v_curr_qty + p_inbound_qty;

    IF v_new_qty <= 0 THEN
        v_new_wav := p_inbound_unit_cost;
    ELSE
        v_new_wav := ((v_curr_qty * v_curr_wav) + (p_inbound_qty * p_inbound_unit_cost)) / v_new_qty;
    END IF;

    INSERT INTO inventory.inv_valuations (item_id, warehouse_id, total_quantity, weighted_average_cost, total_valuation, updated_at)
    VALUES (p_item_id, p_warehouse_id, v_new_qty, v_new_wav, (v_new_qty * v_new_wav), CURRENT_TIMESTAMP)
    ON CONFLICT (item_id, warehouse_id) DO UPDATE SET
        total_quantity = v_new_qty,
        weighted_average_cost = v_new_wav,
        total_valuation = (v_new_qty * v_new_wav),
        updated_at = CURRENT_TIMESTAMP;

    RETURN v_new_wav;
END;
$$ LANGUAGE plpgsql;

