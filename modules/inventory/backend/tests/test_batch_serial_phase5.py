from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from django.core.exceptions import ValidationError

from apps.categories.models import InventoryCategory
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.batches.models import Batch, BatchQuarantineRecord
from apps.serial_numbers.models import SerialNumber
from services.posting_service import InventoryPostingService

class BatchSerialPhase5Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = InventoryCategory.objects.create(name="Automation Valves", code="CAT-AUTO")
        self.warehouse = Warehouse.objects.create(name="Primary Distribution Hub", code="WH-DIST-01", is_active=True)
        self.dest_wh = Warehouse.objects.create(name="Regional Depot", code="WH-REG-02", is_active=True)
        self.location = StorageLocation.objects.create(warehouse=self.warehouse, name="Vault A1", code="LOC-V1")
        self.dest_location = StorageLocation.objects.create(warehouse=self.dest_wh, name="Receiving Bay", code="LOC-REC")
        
        self.batch_item = InventoryItem.objects.create(
            category=self.category,
            name="Industrial Valve Assembly",
            code="VLV-IND-500",
            tracking=InventoryItem.Tracking.BATCH,
            is_active=True,
        )
        self.serial_item = InventoryItem.objects.create(
            category=self.category,
            name="Optical Sensor Module",
            code="OPT-MOD-100",
            tracking=InventoryItem.Tracking.SERIAL,
            is_active=True,
        )

    def test_batch_management_creation_and_fields(self):
        expiry = date.today() + timedelta(days=90)
        resp = self.client.post("/api/v1/inventory/batches/", {
            "batch_number": "LOT-2026-VLV-01",
            "item": str(self.batch_item.id),
            "warehouse": str(self.warehouse.id),
            "location": str(self.location.id),
            "supplier": "Apex Precision Ltd",
            "manufacturing_date": (date.today() - timedelta(days=30)).isoformat(),
            "expiry_date": expiry.isoformat(),
            "received_date": date.today().isoformat(),
            "initial_quantity": "50.0000",
            "remaining_quantity": "50.0000",
            "batch_status": "Released",
            "status": "HEALTHY",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["batch_number"], "LOT-2026-VLV-01")
        self.assertEqual(resp.data["sku"], "VLV-IND-500")
        self.assertEqual(resp.data["product_name"], "Industrial Valve Assembly")
        self.assertEqual(resp.data["expiry_status"], "Healthy")
        self.assertTrue(resp.data["days_remaining"] >= 89)

    def test_batch_quarantine_blocks_stock_and_creates_record(self):
        expiry = date.today() + timedelta(days=120)
        batch = Batch.objects.create(
            batch_number="LOT-QAR-TEST-01",
            item=self.batch_item,
            warehouse=self.warehouse,
            location=self.location,
            expiry_date=expiry,
            initial_quantity=Decimal("40.0000"),
            remaining_quantity=Decimal("40.0000"),
            batch_status=Batch.Status.RELEASED,
        )
        # Baseline balance
        StockBalance.objects.create(
            item=self.batch_item,
            warehouse=self.warehouse,
            location=self.location,
            on_hand_qty=Decimal("40.0000"),
            reserved_qty=Decimal("0.0000"),
            blocked_qty=Decimal("0.0000"),
        )

        resp = self.client.post(f"/api/v1/inventory/batches/{batch.id}/quarantine/", {
            "quarantine_quantity": "15.0000",
            "quarantine_reason": "Quality Issue",
            "remarks": "Observed surface hairline fracture during spot check",
            "quarantine_date": date.today().isoformat(),
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        batch.refresh_from_db()
        self.assertEqual(batch.batch_status, Batch.Status.QUARANTINED)
        self.assertEqual(batch.quarantined_quantity, Decimal("15.0000"))

        bal = StockBalance.objects.get(item=self.batch_item, warehouse=self.warehouse, location=self.location)
        self.assertEqual(bal.blocked_qty, Decimal("15.0000"))
        self.assertEqual(bal.available_qty, Decimal("25.0000"))  # on_hand 40 - blocked 15

        self.assertTrue(BatchQuarantineRecord.objects.filter(batch=batch, is_released=False).exists())

    def test_batch_release_restores_stock_and_blocks_expired_release(self):
        # 1. Expired batch release must be blocked
        past_expiry = date.today() - timedelta(days=5)
        expired_batch = Batch.objects.create(
            batch_number="LOT-EXP-FAIL",
            item=self.batch_item,
            warehouse=self.warehouse,
            location=self.location,
            expiry_date=past_expiry,
            initial_quantity=Decimal("20.0000"),
            remaining_quantity=Decimal("20.0000"),
            quarantined_quantity=Decimal("20.0000"),
            batch_status=Batch.Status.QUARANTINED,
        )
        fail_resp = self.client.post(f"/api/v1/inventory/batches/{expired_batch.id}/release/", {
            "release_quantity": "20.0000",
            "inspection_result": "Passed",
            "release_reason": "Trying to release expired batch",
        }, format="json")
        self.assertEqual(fail_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", fail_resp.data["error"])

        # 2. Valid healthy quarantined batch release
        good_expiry = date.today() + timedelta(days=60)
        good_batch = Batch.objects.create(
            batch_number="LOT-GOOD-REL",
            item=self.batch_item,
            warehouse=self.warehouse,
            location=self.location,
            expiry_date=good_expiry,
            initial_quantity=Decimal("30.0000"),
            remaining_quantity=Decimal("30.0000"),
            quarantined_quantity=Decimal("10.0000"),
            batch_status=Batch.Status.QUARANTINED,
        )
        bal = StockBalance.objects.create(
            item=self.batch_item,
            warehouse=self.warehouse,
            location=self.location,
            on_hand_qty=Decimal("30.0000"),
            reserved_qty=Decimal("0.0000"),
            blocked_qty=Decimal("10.0000"),
        )
        BatchQuarantineRecord.objects.create(
            batch=good_batch,
            quarantine_number="QAR-TEST-001",
            product=self.batch_item,
            warehouse=self.warehouse,
            location=self.location,
            quarantine_quantity=Decimal("10.0000"),
            quarantine_reason="Inspection Failure",
        )

        ok_resp = self.client.post(f"/api/v1/inventory/batches/{good_batch.id}/release/", {
            "release_quantity": "10.0000",
            "inspection_result": "Passed",
            "release_reason": "Re-inspected by QA Lead: dimensional tolerances within spec.",
            "released_by": "QA Lead Sarah",
        }, format="json")
        self.assertEqual(ok_resp.status_code, status.HTTP_200_OK)

        good_batch.refresh_from_db()
        self.assertEqual(good_batch.batch_status, Batch.Status.RELEASED)
        self.assertEqual(good_batch.quarantined_quantity, Decimal("0.0000"))

        bal.refresh_from_db()
        self.assertEqual(bal.blocked_qty, Decimal("0.0000"))
        self.assertEqual(bal.available_qty, Decimal("30.0000"))

    def test_stock_issue_rejects_quarantined_or_expired_batch(self):
        # Rule 5: Quarantined and expired quantities must not be available for normal stock issue
        expiry = date.today() + timedelta(days=45)
        q_batch = Batch.objects.create(
            batch_number="LOT-LOCKED-01",
            item=self.batch_item,
            warehouse=self.warehouse,
            location=self.location,
            expiry_date=expiry,
            initial_quantity=Decimal("10.0000"),
            remaining_quantity=Decimal("10.0000"),
            batch_status=Batch.Status.QUARANTINED,
            status=Batch.Status.QUARANTINED,
        )
        StockBalance.objects.create(
            item=self.batch_item,
            warehouse=self.warehouse,
            location=self.location,
            on_hand_qty=Decimal("10.0000"),
            reserved_qty=Decimal("0.0000"),
            blocked_qty=Decimal("0.0000"),
        )
        issue_tx = StockTransaction.objects.create(
            document_number="ISS-TEST-BLOCK",
            transaction_type=StockTransaction.TransactionType.ISSUE,
            warehouse=self.warehouse,
            status=StockTransaction.Status.DRAFT,
            issue_type="Sales",
        )
        StockTransactionLine.objects.create(
            transaction=issue_tx,
            item=self.batch_item,
            quantity=Decimal("5.0000"),
            unit_cost=Decimal("25.0000"),
            location=self.location,
            batch_number="LOT-LOCKED-01",
        )

        with self.assertRaises(ValidationError) as cm:
            InventoryPostingService.post_transaction(issue_tx, actor="tester")
        self.assertIn("quarantined", str(cm.exception).lower())

    def test_serial_management_lifecycle_and_uniqueness(self):
        resp = self.client.post("/api/v1/inventory/serials/", {
            "serial_number": "SN-OPT-2026-9999",
            "item": str(self.serial_item.id),
            "warehouse": str(self.warehouse.id),
            "location": str(self.location.id),
            "status": "Available",
            "received_date": date.today().isoformat(),
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["serial_number"], "SN-OPT-2026-9999")
        self.assertEqual(resp.data["sku"], "OPT-MOD-100")
        self.assertEqual(resp.data["product_name"], "Optical Sensor Module")

        # Duplicate serial number must fail uniqueness
        dup_resp = self.client.post("/api/v1/inventory/serials/", {
            "serial_number": "SN-OPT-2026-9999",
            "item": str(self.serial_item.id),
            "warehouse": str(self.warehouse.id),
            "location": str(self.location.id),
            "status": "Available",
        }, format="json")
        self.assertEqual(dup_resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_batch_and_serial_movement_history_from_ledger(self):
        # Rule 6: Batch and serial movement histories should come from the Stock Ledger
        # Post receipt with batch and serial
        tx = StockTransaction.objects.create(
            document_number="GRN-BS-001",
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            warehouse=self.warehouse,
            status=StockTransaction.Status.DRAFT,
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.serial_item,
            quantity=Decimal("1.0000"),
            unit_cost=Decimal("120.0000"),
            location=self.location,
            batch_number="LOT-BS-ALPHA",
            serial_numbers=["SN-BS-ALPHA-01"],
        )
        InventoryPostingService.post_transaction(tx, actor="tester")

        # Query batch movements endpoint
        b_resp = self.client.get(f"/api/v1/inventory/batch-movements/?batch=LOT-BS-ALPHA")
        self.assertEqual(b_resp.status_code, status.HTTP_200_OK)
        results = b_resp.data if isinstance(b_resp.data, list) else b_resp.data.get("results", [])
        self.assertTrue(len(results) >= 1)
        self.assertEqual(results[0]["batch_number"], "LOT-BS-ALPHA")
        self.assertEqual(results[0]["transaction_number"], "GRN-BS-001")
        self.assertEqual(results[0]["product_name"], "Optical Sensor Module")

        # Query serial movements endpoint
        s_resp = self.client.get(f"/api/v1/inventory/serial-movements/?serial=SN-BS-ALPHA-01")
        self.assertEqual(s_resp.status_code, status.HTTP_200_OK)
        s_results = s_resp.data if isinstance(s_resp.data, list) else s_resp.data.get("results", [])
        self.assertTrue(len(s_results) >= 1)
        self.assertEqual(s_results[0]["serial_number"], "SN-BS-ALPHA-01")
        self.assertEqual(s_results[0]["transaction_number"], "GRN-BS-001")
