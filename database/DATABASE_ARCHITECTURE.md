# Complete Database Architecture Specification

**Engine:** PostgreSQL 16  
**Architecture:** Multi-Schema Isolation (`platform`, `shared`, `inventory`)  
**Concurrency Invariant:** Row-level locks (`SELECT ... FOR UPDATE` ordered by item & location) with atomic transactions.  

---

## 1. Schema Division & Isolation

```
PostgreSQL Database: ecosystem_db
│
├── schema: platform
│   ├── tenants
│   ├── organisations
│   ├── users
│   ├── roles & role_permissions
│   └── modules
│
├── schema: shared
│   ├── stored_files (Universal polymorphic file catalog)
│   ├── audit_events (Cross-cutting regulatory event stream)
│   ├── event_outbox (Transactional outbox for reliable async messaging)
│   └── notifications (Multi-channel user notifications)
│
└── schema: inventory
    ├── inv_categories (Catalog hierarchy)
    ├── inv_brands (OEM manufacturers)
    ├── inv_units (UOM conversions)
    ├── inv_items & inv_variants (Master catalog)
    ├── inv_warehouses & inv_locations (Physical multi-tier topology)
    ├── inv_batches & inv_serials (Traceability & FEFO)
    ├── inv_balances (Real-time locked position matrix)
    ├── inv_ledger (Append-only immutable audit trail)
    └── inv_valuations (Moving Weighted Average)
```

---

## 2. Invariants & Triggers

1. **Available Stock Invariant**:
   $$\text{Available Stock} = \text{On-Hand Stock} - \text{Reserved Stock} - \text{Blocked Stock} \ge 0$$
   Enforced both at database check level and within Django service layer.

2. **Ledger Immutability Trigger**:
   The stored procedure `inventory.fn_prevent_ledger_modification()` blocks all `UPDATE` and `DELETE` operations on `inventory.inv_ledger`.

3. **Weighted Average Valuation (WAV)**:
   $$WAV_{\text{new}} = \frac{(Q_{\text{curr}} \times WAV_{\text{curr}}) + (q_{\text{in}} \times c_{\text{in}})}{Q_{\text{curr}} + q_{\text{in}}}$$
   Recalculated automatically upon every verified Inbound Receipt.
