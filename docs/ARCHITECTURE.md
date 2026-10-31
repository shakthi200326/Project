# System Architecture Specification

## 1. Vision & Core Philosophy

The Universal Reusable Business Modules Ecosystem provides independent, composable enterprise business engines.
The core tenet is **complete decoupling from any single ERP or hosting monolith**:
- Each module provides its own domain models, business logic, state machines, and operational UI.
- No direct foreign-key imports across module boundaries or platform boundaries.
- Contextual information (Tenant, Organization, Company, Facility, User) is resolved via an **Adapter Pattern** (`ContextResolver`).
- In standalone mode, a module runs with local SQLite or dedicated PostgreSQL.
- In enterprise SaaS mode, the module receives context headers or JWT claims and scopes operations accordingly.

## 2. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                 Client Applications (Browsers, API)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Platform API Gateway / Reverse Proxy           │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐┌──────────────────────────────┐
│       Platform Services      ││        Shared Services       │
│ • Identity & SSO             ││ • Universal File Storage     │
│ • Context & Scoping Service  ││ • Transactional Event Bus    │
│ • Access Control (RBAC/ABAC) ││ • Immutable Audit Trail      │
│ • Module Registry            ││ • Notification Dispatcher    │
└──────────────┬───────────────┘└──────────────┬───────────────┘
               │                               │
               └───────────────┬───────────────┘
                               │ (Dependency Inversion / APIs)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Inventory Business Module                   │
│ ┌──────────────────────────┐  ┌───────────────────────────┐ │
│ │     Inventory Backend    │  │    Inventory Frontend     │ │
│ │ • Catalog & Variants     │  │ • Reusable UI Shell       │ │
│ │ • Real-Time Stock Engine │  │ • High-Density Tables     │ │
│ │ • Immutable Ledger       │  │ • Transaction Wizards     │ │
│ │ • Valuation & Aging      │  │ • Real-Time KPIs & Charts │ │
│ └──────────────────────────┘  └───────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌──────────────────────────────┐┌──────────────────────────────┐
│  Future: Purchase Module     ││    Future: Sales Module      │
│ (Goods Receipt Integration)  ││ (Reservation & Dispatch Int.)│
└──────────────────────────────┘└──────────────────────────────┘
```

## 3. Communication Patterns

1. **Synchronous REST APIs**: All module boundaries provide OpenAPI 3.0-compliant endpoints with versioned prefixes (`/api/v1/inventory/...`).
2. **Idempotency Keys**: All non-query mutations (Stock In, Issue, Transfer, Reservation) require an `Idempotency-Key` header to prevent duplicate execution across retries.
3. **Transactional Outbox / Event Bus**: When stock movements are committed, events (e.g. `inventory.stock_updated`, `inventory.low_stock_triggered`) are written to an atomic outbox table before asynchronous broadcast over Redis/Celery.

