# API Contracts & REST Specification (v3.1)

## 1. Global REST Architecture Standards

- **Base URL Prefix**: `/api/v1/`
- **Authentication**: `Bearer <jwt_token>` header or authenticated session
- **Context Injection**:
  - `X-Tenant-Id`: Multi-tenant organization scope (e.g. `enterprise-default`)
  - `X-Facility-Id`: Active warehouse scope (e.g. `WH-MAIN`)
- **Idempotency Guarantee**: All mutating transactions (Receipt, Issue, Transfer, Adjustment, Reconcile) accept an `Idempotency-Key` (UUIDv4) header to eliminate duplicate execution risks.
- **Envelope Standard**:
  ```json
  {
    "status": "success",
    "message": "Operation succeeded",
    "data": { ... },
    "meta": { "page": 1, "count": 48 }
  }
  ```

---

## 2. Inventory Endpoint Reference

### Master Data & Catalog
- `GET /api/v1/inventory/items/` - List products (filters: `search`, `category`, `brand`, `status`)
- `POST /api/v1/inventory/items/` - Register new stockable product
- `GET /api/v1/inventory/items/{id}/` - Detailed product view with variant matrix & facility balances
- `GET /api/v1/inventory/categories/` - Hierarchical category tree
- `POST /api/v1/inventory/categories/` - Create catalog category
- `GET /api/v1/inventory/brands/` - OEM manufacturer brand register
- `POST /api/v1/inventory/brands/` - Register OEM brand
- `GET /api/v1/inventory/units/` - Units of measure catalogue with conversion formulas
- `POST /api/v1/inventory/units/` - Create base or derived UOM

### Facilities & Topologies
- `GET /api/v1/inventory/warehouses/` - Fulfillment hubs and logistics terminals
- `POST /api/v1/inventory/warehouses/` - Register facility
- `GET /api/v1/inventory/locations/` - Storage locations (zone, aisle, rack, bin addresses)
- `POST /api/v1/inventory/locations/` - Register bin/rack location

### Stock Balances & Movements
- `GET /api/v1/inventory/balances/` - Real-time stock matrix (`on_hand_qty`, `reserved_qty`, `blocked_qty`, `available_qty`)
- `GET /api/v1/inventory/movements/` - Stock transaction documents list
- `POST /api/v1/inventory/movements/` - Create draft stock movement
- `POST /api/v1/inventory/movements/{id}/post/` - Atomically commit movement to ledger and balances
- `GET /api/v1/inventory/ledger/` - Filterable immutable audit ledger

### Operations, Traceability & Quality Control
- `GET /api/v1/inventory/reservations/` - Allocated stock holds (SO/WO commitments)
- `POST /api/v1/inventory/reservations/` - Create stock reservation
- `POST /api/v1/inventory/reservations/{id}/release/` - Release stock hold
- `GET /api/v1/inventory/reconciliation/` - Cycle counts & physical audits
- `POST /api/v1/inventory/reconciliation/` - Initiate new count cycle
- `POST /api/v1/inventory/reconciliation/{id}/reconcile/` - Submit physical counts and post variance adjustments
- `GET /api/v1/inventory/batches/` - Batch/lot register with manufacturing & expiry dates
- `POST /api/v1/inventory/batches/` - Register new manufacturing lot
- `GET /api/v1/inventory/serials/` - Piece-level serial registry with warranty horizon
- `POST /api/v1/inventory/serials/` - Register unit serial numbers
- `PATCH /api/v1/inventory/serials/{id}/` - Update serial custody state (`IN_STOCK`, `IN_MAINTENANCE`, `DISPATCHED`)

### Valuation & Analytics
- `GET /api/v1/inventory/valuation/` - Moving Weighted Average valuation aggregates
- `GET /api/v1/inventory/dashboard/kpis/` - Real-time operational summary metrics

---

## 3. Universal File Storage Endpoints
- `GET /api/v1/storage/files/?owner_type={type}&owner_id={id}` - List documents attached to an entity
- `POST /api/v1/storage/files/` - Multipart file upload (validated for size, extension, and magic bytes)
- `GET /api/v1/storage/download/{id}/` - Generate authenticated download token or binary stream
- `DELETE /api/v1/storage/files/{id}/` - Remove document attachment
