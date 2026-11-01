# Universal Reusable Business Modules Ecosystem

**Version:** 3.1  
**Architecture:** Independent, Reusable, Modular & Pluggable  
**Current Production Module:** Inventory Management  
**Future Modules (Prepared Contracts):** Purchase Management, Sales Management  
**Frontend:** React (JavaScript only) + Vite + Tailwind CSS  
**Backend:** Python 3.14 + Django 6.1 + Django REST Framework  
**Database:** PostgreSQL 16 (Multi-Schema Isolation)  
**Infrastructure:** Docker, Redis, Celery, MinIO / S3  

---

## 1. Architectural Philosophy

This repository implements the **Universal Reusable Business Modules Ecosystem**. The core philosophy is strict modularity and zero hard coupling to any single ERP or host application.

Each business module is capable of:
1. **Running 100% Standalone** with its own harness, self-contained UOM, local authentication, and operational UI.
2. **Integrating into Multi-Tenant Cloud SaaS** via context adapters (`TenantOwnedModel` abstraction, identity tokens).
3. **Plugging into Existing Enterprise ERPs** (e.g. ONE ERP / Azcentrix-ERP) via adapter injection without altering internal business logic.
4. **Composing with Future Modules**: Inbound Goods Receipts from future Purchase, Outbound Reservations and Issues for future Sales.

---

## 2. Directory Structure

```text
projects/
├── platform/               # Central identity, context, access control & module registry
├── shared/                 # Universal file storage, audit, event bus, ui-kit & contracts
├── modules/
│   └── inventory/          # Core pluggable Inventory Management module (Backend + Frontend)
├── database/               # PostgreSQL 16 DDL, schemas, views, seeds, and diagrams
├── infrastructure/         # Docker, Nginx, Redis, MinIO, and setup scripts
├── docs/                   # Full enterprise documentation & specifications
├── tests/                  # Root integration and cross-module test suites
└── uploads/                # Local file storage target
```

---

## 3. Quick Start (Development)

### Backend (Inventory Standalone)
```bash
# Setup virtual environment & dependencies
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run migrations and start server
python modules/inventory/backend/manage.py migrate
python modules/inventory/backend/manage.py runserver 8000
```

### Frontend (Enterprise UI Shell & Inventory)
```bash
cd modules/inventory/frontend
npm install
npm run dev
```

### Docker Compose (Full Stack)
```bash
docker compose up -d
```
Docker Compose exposes the frontend at `http://localhost:5174` and the gateway at `http://localhost:8088`. Running `npm run dev` directly serves the frontend at `http://localhost:5173`.
