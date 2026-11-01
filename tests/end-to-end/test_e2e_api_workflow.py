import io
from decimal import Decimal
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from apps.categories.models import InventoryCategory
from apps.brands.models import Brand
from apps.units.models import UnitOfMeasure
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.batches.models import Batch
from apps.serial_numbers.models import SerialNumber
from apps.reconciliation.models import StockCount, StockCountLine
from shared_file_storage.models.file_record import StoredFile
from datetime import date, timedelta

class EndToEndRestApiWorkflowTests(TestCase):
    """
    End-to-End verification of the Universal Inventory REST APIs:
    CRUD, Stock Movements, Ledger Audit Trail, Polymorphic File Attachments, and Dashboard KPIs.
    """

    def setUp(self):
        self.client = APIClient()

    def test_complete_rest_api_lifecycle(self):
        # 1. Create Category via API
        cat_resp = self.client.post("/api/v1/inventory/categories/", {
            "name": "Robotics & Micro-Actuators",
            "code": "CAT-ROBOT-01",
            "description": "High-precision servo actuators"
        }, format="json")
        self.assertEqual(cat_resp.status_code, status.HTTP_201_CREATED)
        category_id = cat_resp.data["id"]

        # 1b. Create Brand via API
        brand_resp = self.client.post("/api/v1/inventory/brands/", {
            "name": "HarmonicDrive SE",
            "code": "HDSE",
            "country": "Germany",
        }, format="json")
        self.assertEqual(brand_resp.status_code, status.HTTP_201_CREATED)
        brand_id = brand_resp.data["id"]

        # 1c. Create UOM via API
        uom_resp = self.client.post("/api/v1/inventory/units/", {
            "name": "Each / Unit",
            "code": "EA",
            "symbol": "ea",
            "is_base": True,
            "decimal_places": 0,
        }, format="json")
        self.assertEqual(uom_resp.status_code, status.HTTP_201_CREATED)

        # 2. Create Warehouse via API
        wh_resp = self.client.post("/api/v1/inventory/warehouses/", {
            "name": "Nevada Advanced Robotics Vault",
            "code": "WH-NV-ROBOT",
            "address": "Reno, NV",
            "is_active": True
        }, format="json")
        self.assertEqual(wh_resp.status_code, status.HTTP_201_CREATED)
        warehouse_id = wh_resp.data["id"]

        # 3. Create Storage Location via API
        loc_resp = self.client.post("/api/v1/inventory/locations/", {
            "warehouse": warehouse_id,
            "name": "Bin R1-4B Secure Cold Rack",
            "code": "LOC-R1-4B",
            "zone": "Zone Cold"
        }, format="json")
        self.assertEqual(loc_resp.status_code, status.HTTP_201_CREATED)
        location_id = loc_resp.data["id"]

        # 4. Create Master Inventory Item via API
        item_resp = self.client.post("/api/v1/inventory/items/", {
            "name": "Harmonic Drive Strain Wave Reducer",
            "code": "ACT-HD-50",
            "category": category_id,
            "brand": "HarmonicDrive SE",
            "base_unit": "EA",
            "reorder_point": "10.0000",
            "reorder_quantity": "25.0000",
            "tracking": "BATCH",
            "is_active": True
        }, format="json")
        self.assertEqual(item_resp.status_code, status.HTTP_201_CREATED)
        item_id = item_resp.data["id"]

        # 5. Polymorphic File Upload via File Storage API
        pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Title (Harmonic Reducer Spec) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
        pdf_file = SimpleUploadedFile("harmonic_spec.pdf", pdf_bytes, content_type="application/pdf")

        upload_resp = self.client.post("/api/v1/storage/files/", {
            "file": pdf_file,
            "owner_type": "apps.products.models.InventoryItem",
            "owner_id": str(item_id),
            "display_name": "Harmonic Drive Official Spec Sheet",
            "is_public": False
        }, format="multipart")
        self.assertEqual(upload_resp.status_code, status.HTTP_201_CREATED)
        file_id = upload_resp.data["id"]
        self.assertEqual(upload_resp.data["mime_type"], "application/pdf")
        self.assertTrue(upload_resp.data["file_name"].endswith(".pdf"))

        # 6. List Attached Files for the Item
        files_resp = self.client.get(f"/api/v1/storage/files/?owner_type=apps.products.models.InventoryItem&owner_id={item_id}")
        self.assertEqual(files_resp.status_code, status.HTTP_200_OK)
        results = files_resp.data.get("results", files_resp.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], file_id)

        # 7. Create Inbound Stock Transaction
        tx = StockTransaction.objects.create(
            document_number="TX-INB-TEST-001",
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            status=StockTransaction.Status.DRAFT,
            warehouse=Warehouse.objects.get(id=warehouse_id),
            notes="Initial receipt of harmonic drive reducers",
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=InventoryItem.objects.get(id=item_id),
            quantity=Decimal("50.0000"),
            unit_cost=Decimal("450.0000"),
            location=StorageLocation.objects.get(id=location_id),
            batch_number="BATCH-HD-2026-A1",
        )

        # 8. Post Transaction via REST API endpoint /api/v1/inventory/movements/{id}/post/
        post_resp = self.client.post(f"/api/v1/inventory/movements/{tx.id}/post/")
        self.assertEqual(post_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(post_resp.data["status"], "POSTED")

        # 9. Verify Stock Balance via REST API
        bal_resp = self.client.get(f"/api/v1/inventory/balances/?item={item_id}")
        self.assertEqual(bal_resp.status_code, status.HTTP_200_OK)
        bal_results = bal_resp.data.get("results", bal_resp.data)
        self.assertTrue(len(bal_results) >= 1)
        self.assertEqual(Decimal(str(bal_results[0]["on_hand_qty"])), Decimal("50.0000"))

        # 10. Verify Stock Ledger Entry via REST API
        ledger_resp = self.client.get(f"/api/v1/inventory/ledger/?item={item_id}")
        self.assertEqual(ledger_resp.status_code, status.HTTP_200_OK)
        ledger_results = ledger_resp.data.get("results", ledger_resp.data)
        self.assertTrue(len(ledger_results) >= 1)
        self.assertEqual(Decimal(str(ledger_results[0]["quantity_delta"])), Decimal("50.0000"))
        self.assertEqual(Decimal(str(ledger_results[0]["balance_after"])), Decimal("50.0000"))

        # 11. Verify Dashboard KPIs API
        kpi_resp = self.client.get("/api/v1/inventory/dashboard/kpis/")
        self.assertEqual(kpi_resp.status_code, status.HTTP_200_OK)
        self.assertIn("total_products", kpi_resp.data)
        self.assertIn("total_warehouses", kpi_resp.data)
        self.assertIn("total_stock_value", kpi_resp.data)
        self.assertIn("total_on_hand", kpi_resp.data)

    def test_batch_and_serial_tracking_api_workflow(self):
        cat = InventoryCategory.objects.create(name="Mechanical Components", code="CAT-MECH-QA")
        wh = Warehouse.objects.create(name="Central QA Depot", code="WH-QA-01", is_active=True)
        loc = StorageLocation.objects.create(warehouse=wh, name="Inspection Bin", code="BIN-QA-1")
        item = InventoryItem.objects.create(category=cat, name="Precision Servo Valve", code="VALVE-PS-100", tracking="BATCH")

        # 1. Create Batch via API
        expiry = date.today() + timedelta(days=365)
        batch_resp = self.client.post("/api/v1/inventory/batches/", {
            "batch_number": "LOT-2026-VALVE-01",
            "item": str(item.id),
            "warehouse": str(wh.id),
            "expiry_date": expiry.isoformat(),
            "initial_quantity": "100.0000",
            "remaining_quantity": "100.0000",
            "status": "HEALTHY",
        }, format="json")
        self.assertEqual(batch_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(batch_resp.data["batch_number"], "LOT-2026-VALVE-01")
        self.assertTrue(batch_resp.data["days_remaining"] >= 364)

        # 2. Create Serial via API
        serial_resp = self.client.post("/api/v1/inventory/serials/", {
            "serial_number": "SN-VALVE-100-001",
            "item": str(item.id),
            "warehouse": str(wh.id),
            "location": str(loc.id),
            "status": "IN_STOCK",
        }, format="json")
        self.assertEqual(serial_resp.status_code, status.HTTP_201_CREATED)
        serial_id = serial_resp.data["id"]

        # 3. Transition Serial status via PATCH
        patch_resp = self.client.patch(f"/api/v1/inventory/serials/{serial_id}/", {
            "status": "DISPATCHED"
        }, format="json")
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data["status"], "DISPATCHED")

    def test_reconciliation_variance_adjustment_workflow(self):
        cat = InventoryCategory.objects.create(name="Bearings", code="CAT-BRG-QA")
        wh = Warehouse.objects.create(name="Audit Test Hub", code="WH-AUDIT-01", is_active=True)
        loc = StorageLocation.objects.create(warehouse=wh, name="Audit Bin A", code="BIN-AUD-A")
        item = InventoryItem.objects.create(category=cat, name="Sealed Roller Bearing", code="BRG-SR-99")

        # Initial baseline stock balance
        StockBalance.objects.create(
            item=item,
            warehouse=wh,
            location=loc,
            on_hand_qty=Decimal("100.0000"),
            reserved_qty=Decimal("0.0000"),
            blocked_qty=Decimal("0.0000"),
        )

        # Create cycle count
        count = StockCount.objects.create(
            count_number="CC-AUDIT-2026-001",
            warehouse=wh,
            status=StockCount.Status.COUNTING,
        )
        StockCountLine.objects.create(
            stock_count=count,
            item=item,
            location=loc,
            snapshot_qty=Decimal("100.0000"),
            counted_qty=Decimal("98.0000"), # -2 variance
        )

        # Reconcile via API endpoint
        rec_resp = self.client.post(f"/api/v1/inventory/reconciliation/{count.id}/reconcile/")
        self.assertEqual(rec_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(rec_resp.data["status"], "RECONCILED")

        # Verify balance updated by -2
        updated_bal = StockBalance.objects.get(item=item, warehouse=wh, location=loc)
        self.assertEqual(updated_bal.on_hand_qty, Decimal("98.0000"))
