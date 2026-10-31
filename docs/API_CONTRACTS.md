# API Contracts Specification

## 1. REST Standards

- Base URL: `/api/v1/`
- Authentication: `Bearer <jwt_token>` or Cookie-based session
- Context Header: `X-Context-ID` (Optional tenant/organization selector)
- Idempotency Header: `Idempotency-Key` (UUIDv4 for mutations)

## 2. Inventory Core Endpoints

### Catalog
- `GET /api/v1/inventory/items/` - List products with filter, search, sort, pagination
- `POST /api/v1/inventory/items/` - Create product
- `GET /api/v1/inventory/items/{id}/` - Retrieve product details with variants & balances
- `PUT/PATCH /api/v1/inventory/items/{id}/` - Update product
- `DELETE /api/v1/inventory/items/{id}/` - Archive product

### Warehouses & Locations
- `GET /api/v1/inventory/warehouses/` - List warehouses
- `POST /api/v1/inventory/warehouses/` - Create warehouse
- `GET /api/v1/inventory/locations/` - List storage locations

### Stock Balances & Movements
- `GET /api/v1/inventory/balances/` - Current stock levels (On-hand, Reserved, Available)
- `POST /api/v1/inventory/movements/receipt/` - Post Goods Receipt (Stock In)
- `POST /api/v1/inventory/movements/issue/` - Post Stock Issue (Stock Out)
- `POST /api/v1/inventory/movements/transfer/` - Post Warehouse/Location Transfer
- `POST /api/v1/inventory/movements/adjustment/` - Post Stock Adjustment
- `POST /api/v1/inventory/movements/{id}/reverse/` - Reverse posted movement

### Reconciliation & Reservations
- `POST /api/v1/inventory/reconciliation/snapshot/` - Create stock count snapshot
- `POST /api/v1/inventory/reconciliation/{id}/reconcile/` - Submit count & post variances
- `POST /api/v1/inventory/reservations/` - Create stock reservation
- `POST /api/v1/inventory/reservations/{id}/release/` - Release reserved stock

### Reports & Analytics
- `GET /api/v1/inventory/reports/ledger/` - Filterable immutable stock ledger
- `GET /api/v1/inventory/reports/valuation/` - Moving weighted average valuation
- `GET /api/v1/inventory/reports/low-stock/` - Replenishment alerts & reorder suggestions
- `GET /api/v1/inventory/dashboard/kpis/` - High-level metrics for dashboard cards
- `GET /api/v1/inventory/dashboard/trends/` - Stock movement trend timeseries

