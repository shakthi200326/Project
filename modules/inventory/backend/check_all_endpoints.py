import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import sys
sys.path.insert(0, os.path.abspath("modules/inventory/backend"))
django.setup()

from rest_framework.test import APIClient

client = APIClient()

endpoints = [
    # Phase 1: Catalog
    "/api/v1/inventory/dashboard/kpis/",
    "/api/v1/inventory/items/",
    "/api/v1/inventory/categories/",
    "/api/v1/inventory/brands/",
    "/api/v1/inventory/units/",

    # Phase 2: Warehouse Management
    "/api/v1/inventory/warehouses/",
    "/api/v1/inventory/locations/",
    "/api/v1/inventory/racks/",
    "/api/v1/inventory/bins/",
    "/api/v1/inventory/warehouse-config/",

    # Phase 3 & 4: Operations & Stock Control
    "/api/v1/inventory/balances/",
    "/api/v1/inventory/ledger/",
    "/api/v1/inventory/transactions/",
    "/api/v1/inventory/reservations/",
    "/api/v1/inventory/reconciliation/",
    "/api/v1/inventory/damaged-stock/",
    "/api/v1/inventory/transit/",

    # Phase 5: Batches & Serials
    "/api/v1/inventory/batches/",
    "/api/v1/inventory/batch-movements/",
    "/api/v1/inventory/batch-quarantines/",
    "/api/v1/inventory/serials/",
    "/api/v1/inventory/serial-movements/",

    # Phase 6: Planning
    "/api/v1/inventory/planning/reorder-rules/",
    "/api/v1/inventory/planning/stock-levels/",
    "/api/v1/inventory/planning/replenishment-plans/",
    "/api/v1/inventory/planning/purchase-suggestions/",
    "/api/v1/inventory/planning/stock-forecast/",

    # Phase 7: Audit
    "/api/v1/inventory/audit/stock-counts/",
    "/api/v1/inventory/audit/cycle-counts/",
    "/api/v1/inventory/audit/full-counts/",
    "/api/v1/inventory/audit/variances/",
    "/api/v1/inventory/audit/history/",

    # Phase 8: Reports
    "/api/v1/inventory/reports/stock-summary/",
    "/api/v1/inventory/reports/stock-movement/",
    "/api/v1/inventory/reports/stock-ledger/",
    "/api/v1/inventory/reports/valuation/",
    "/api/v1/inventory/reports/low-stock/",
    "/api/v1/inventory/reports/ageing/",
    "/api/v1/inventory/reports/expiry/",
    "/api/v1/inventory/reports/warehouse/",

    # Phase 9: Configuration
    "/api/v1/inventory/configuration/global/",
    "/api/v1/inventory/configuration/document-numbering/",
    "/api/v1/inventory/configuration/audit-log/",
]

print(f"Testing {len(endpoints)} API endpoints...")
failures = []
for ep in endpoints:
    try:
        res = client.get(ep)
        status_code = res.status_code
        if status_code != 200:
            failures.append((ep, status_code, str(res.data if hasattr(res, "data") else res.content)))
            print(f"  [FAIL {status_code}] {ep}")
        else:
            print(f"  [OK 200] {ep}")
    except Exception as e:
        failures.append((ep, "EXCEPTION", str(e)))
        print(f"  [ERR] {ep}: {e}")

print(f"\nCompleted: {len(endpoints) - len(failures)} OK, {len(failures)} Failed.")
