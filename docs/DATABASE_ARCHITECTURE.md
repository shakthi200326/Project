# Database Architecture Specification

## 1. Engine & Isolation

- **Database Engine**: PostgreSQL 16.
- **Multi-Schema Strategy**:
  - `platform`: Cross-cutting identity, tenancy, and module registration.
  - `shared`: Universal file metadata, audit logs, event outbox, and notifications.
  - `inventory`: Business tables, balances, movements, ledger entries, and valuation models.

## 2. Inventory Schema Tables

| Table Name | Description | Key Constraints & Indexes |
| :--- | :--- | :--- |
| `inv_categories` | Hierarchical catalog categories | Parent FK, Code unique per context |
| `inv_items` | Stock items & products | Code unique, Barcode index, Category FK |
| `inv_units` | Unit of measure catalogue | Code unique (e.g. EA, KG, LTR, MTR) |
| `inv_variants` | Product SKU variations | Parent item FK, SKU unique |
| `inv_warehouses` | Storage facilities | Code unique per organization |
| `inv_locations` | Zones, aisles, racks & bins | Warehouse FK, Code unique per warehouse |
| `inv_balances` | Real-time stock counts | Unique on `(item, variant, warehouse, location)` |
| `inv_movements` | Stock transaction headers | Transaction number unique, Type, Status |
| `inv_movement_lines` | Transaction line items | Transaction FK, Item FK, Qty, Cost |
| `inv_ledger` | Immutable audit ledger | Append-only, indexed on `(item, warehouse, created_at)` |
| `inv_batches` | Batch & lot records | Batch number, Expiry date index |
| `inv_serials` | Individual unit serials | Serial number unique per item |
| `inv_reorder_rules` | Replenishment thresholds | Min, Max, Reorder Point & Quantity |
| `inv_valuation` | Moving weighted average | Item FK, Warehouse FK, Unit Cost, Total Value |
| `inv_reservations` | Allocated stock locks | Status (PENDING, FULFILLED, CANCELLED) |
| `inv_counts` | Physical stock reconciliations | Snapshot balance, variance, status |
