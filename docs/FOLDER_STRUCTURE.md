# Enterprise Folder Structure & Module Isolation

This document defines the strict directory layout for the Universal Reusable Business Modules Ecosystem.

## Directory Layout & Ownership

```text
projects/
│
├── platform/                      # Platform Control Plane
│   ├── identity-sso/              # Authentication & Token Management
│   ├── api-gateway/               # Reverse proxy & route mapping
│   ├── context-service/           # Multi-tenant & organization context resolver
│   ├── access-control/            # Central RBAC & permissions engine
│   ├── organisation-service/      # Enterprise structure service
│   ├── tenant-service/            # SaaS tenant lifecycle
│   ├── project-service/           # Project/Workspace isolation
│   ├── module-registry/           # Module discovery & feature flags
│   └── platform-admin/            # Platform administration console
│
├── shared/                        # Shared Enterprise Foundation
│   ├── backend/
│   │   ├── file-storage/          # Universal File Storage (Local, MinIO, S3)
│   │   ├── audit/                 # Audit logging engine
│   │   ├── notifications/         # Notification bus (Email, Push, In-app)
│   │   ├── event-bus/             # Event publisher & subscriber
│   │   ├── logging/               # Structured logging
│   │   ├── import-export/         # Async bulk data processing
│   │   ├── background-jobs/       # Celery task definitions
│   │   ├── api-utilities/         # Standard response handlers & pagination
│   │   └── security/              # Common sanitization & token verification
│   ├── frontend/
│   │   ├── shell-app/             # Application shell & top/side navigation
│   │   ├── ui-kit/                # Shared enterprise UI design system
│   │   └── sdk/                   # Frontend API client & context hooks
│   └── contracts/                 # Inter-module contracts & schemas
│       ├── api/
│       ├── events/
│       ├── permissions/
│       ├── contexts/
│       └── files/
│
├── modules/
│   └── inventory/                 # Current Implemented Business Module
│       ├── module.json            # Module manifest & capability declarations
│       ├── README.md              # Inventory documentation
│       ├── backend/               # Django REST Framework backend
│       │   ├── config/            # Standalone Django project harness
│       │   ├── apps/              # Focused sub-applications
│       │   ├── integrations/      # Inbound/Outbound integration hooks
│       │   ├── api/               # Unified API router
│       │   ├── services/          # Core inventory engine & posting coordinator
│       │   ├── permissions/       # Module permissions
│       │   ├── tasks/             # Scheduled Celery jobs
│       │   └── tests/             # Pytest & Django test suite
│       ├── frontend/              # React + Vite frontend
│       │   └── src/               # Application code
│       ├── contracts/             # Inventory concrete contracts
│       ├── docs/                  # Inventory technical guides
│       └── deployment/            # Module Dockerfile & Helm charts
│
├── database/                      # Central Database Architecture
│   ├── platform/                  # Platform DDL & seeds
│   ├── shared/                    # Shared services DDL & seeds
│   ├── modules/inventory/         # Inventory DDL, views, and functions
│   ├── diagrams/                  # Mermaid & visual ERDs
│   ├── scripts/                   # DB migration & maintenance utilities
│   ├── backups/                   # Backup scripts
│   └── DATABASE_ARCHITECTURE.md   # DB design specifications
│
├── infrastructure/                # Container & Server Orchestration
│   ├── docker/
│   ├── nginx/
│   ├── postgres/
│   ├── redis/
│   ├── minio/
│   ├── monitoring/
│   └── scripts/
│
└── docs/                          # Ecosystem-wide architectural documentation
```

## Isolation Rules
1. **Never create Purchase and Sales implementation folders during this phase.**
2. **Database migrations for Inventory must remain within `modules/inventory/backend/apps/.../migrations`.**
3. **The `database/` directory coordinates cross-cutting views, schemas, and architecture documentation.**

