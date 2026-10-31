# Inventory Management Module (v3.1)

## 1. Overview

The Inventory Management module is an independent, reusable business engine designed to deliver high-performance inventory tracking, real-time availability calculations, valuation, and immutable stock auditing.

## 2. Capabilities

- **Catalog & Variations**: Products, hierarchical categories, brands, units of measure, and SKU variant matrices.
- **Facilities & Locations**: Multi-warehouse management with hierarchical storage (Zones, Aisles, Racks, Bins).
- **Real-Time Stock Engine**:
  $$\text{Available Stock} = \text{On-Hand Stock} - \text{Reserved Stock} - \text{Blocked Stock}$$
- **Atomic Operations**: Inbound receipts, outbound issues, warehouse transfers, and cycle adjustments with concurrency-safe locking (`select_for_update`).
- **Immutable Ledger**: Append-only transaction audit trail with reversible movements.
- **Tracking**: Unit-level serial numbers and batch/lot expiry tracking.
- **Valuation**: Real-time Moving Weighted Average (WAV).
- **Physical Reconciliation**: Blind count snapshots and variance adjustments.

## 3. Running Standalone

```bash
# Navigate to backend harness
cd modules/inventory/backend

# Migrate database
python manage.py migrate

# Seed realistic demo catalog and movements
python manage.py seed_inventory_demo

# Run development server
python manage.py runserver 8000
```

