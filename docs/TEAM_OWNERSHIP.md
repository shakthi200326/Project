# Team Ownership & Architectural Boundaries

## 1. Ownership Matrix

| Domain / Folder | Owning Team | Responsibilities |
| :--- | :--- | :--- |
| `platform/` | Platform Engineering | Central identity, SSO, API gateway, context resolver, module registry, platform admin console |
| `shared/backend/` | Core Shared Services | Universal file storage, audit trail, notification dispatcher, event bus, logging, background jobs |
| `shared/frontend/` | UI/UX & Design Systems | Enterprise shell application, design tokens, UI-Kit component library, SDK clients |
| `shared/contracts/` | Enterprise Architecture | OpenAPI schemas, event payload definitions, permission registers, file contracts |
| `modules/inventory/` | Inventory Module Team | Product catalog, warehouses, stock operations, ledger, batch/serial tracking, valuation, reports |
| `database/` | Database Administration | PostgreSQL 16 schemas, cross-cutting views, indexing policies, backup/restore scripts |
| `infrastructure/` | DevOps & Cloud Platform | Docker orchestration, Nginx configs, PostgreSQL/Redis/MinIO provisioning, CI/CD pipelines |

## 2. Cross-Team Integration Rules

1. **No Direct Model Imports**: Teams must never import Django models across module boundaries. Communication is strictly via REST APIs, SDK clients, or Event Bus topics.
2. **Contract-First Development**: Any change to shared interfaces or integration hooks must be committed to `shared/contracts/` before backend or frontend changes.
3. **Migration Isolation**: Each module owns its migrations in its own `apps/.../migrations` directory.
