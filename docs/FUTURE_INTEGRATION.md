# Future Purchase and Sales Integration Contracts

*Strict Compliance Notice: Purchase and Sales modules are future developments and are NOT implemented in this phase. This document defines the exact architectural contracts they will implement.*

## 1. Purchase Module Inbound Contract

When the future Purchase module receives goods:
- **Operation**: Purchase Goods Receipt $\rightarrow$ Inventory Stock-In
- **Endpoint**: `POST /api/v1/inventory/integrations/purchase/receipt/`
- **Request Payload**:
  ```json
  {
    "purchase_order_ref": "PO-2026-0891",
    "supplier_id": "sup_alpha_101",
    "warehouse_id": "wh_main_01",
    "received_date": "2026-10-31T09:00:00Z",
    "lines": [
      {
        "item_id": "item_sku_1001",
        "quantity": 100.0,
        "unit_cost": 24.50,
        "currency": "USD",
        "batch_number": "BATCH-2026-A1",
        "expiry_date": "2027-10-31"
      }
    ]
  }
  ```
- **Inventory Action**:
  1. Validates `Idempotency-Key`.
  2. Updates `StockBalance.on_hand_qty` ($+100$).
  3. Recalculates Moving Weighted Average ($WAV$).
  4. Records `StockLedgerEntry` with `reference_type="PURCHASE_RECEIPT"`.
  5. Emits `inventory.receipt_posted` event.

## 2. Sales Module Outbound Contracts

### 2.1 Sales Order Confirmation (Reservation)
- **Operation**: Order confirmed $\rightarrow$ Inventory Reservation
- **Endpoint**: `POST /api/v1/inventory/integrations/sales/reservations/`
- **Payload**: `{ "sales_order_ref": "SO-4011", "items": [{ "item_id": "...", "quantity": 10 }] }`
- **Inventory Action**: Deducts from `available_qty`, increments `reserved_qty`.

### 2.2 Sales Dispatch (Issue)
- **Operation**: Goods dispatched $\rightarrow$ Stock Issue
- **Endpoint**: `POST /api/v1/inventory/integrations/sales/dispatch/`
- **Inventory Action**: Decrements `on_hand_qty` and `reserved_qty`, writes immutable ledger entry.

### 2.3 Order Cancellation (Release)
- **Operation**: Order cancelled $\rightarrow$ Release Reservation
- **Endpoint**: `POST /api/v1/inventory/integrations/sales/reservations/{id}/release/`
- **Inventory Action**: Decrements `reserved_qty`, restores `available_qty`.
