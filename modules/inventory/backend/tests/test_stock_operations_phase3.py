from decimal import Decimal
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from apps.products.models import InventoryItem, InventoryCategory
from apps.warehouses.models import Warehouse, StorageLocation
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.stock.models import StockBalance, StockLedgerEntry
from services.posting_service import InventoryPostingService


class StockOperationsPhase3Tests(APITestCase):
    def setUp(self):
        self.cat = InventoryCategory.objects.create(name="Components", code="COMP")
        self.wh_main = Warehouse.objects.create(
            code="WH-MAIN",
            name="Main Warehouse",
            warehouse_type=Warehouse.WarehouseType.MAIN,
            address="100 Main St",
            city="Chicago",
            country="United States",
        )
        self.wh_dist = Warehouse.objects.create(
            code="WH-DIST",
            name="Distribution Warehouse",
            warehouse_type=Warehouse.WarehouseType.DISTRIBUTION,
            address="200 Dist St",
            city="Detroit",
            country="United States",
        )
        self.loc_rec = StorageLocation.objects.create(
            code="LOC-REC",
            name="Receiving Bay 1",
            warehouse=self.wh_main,
            location_type=StorageLocation.LocationType.RECEIVING,
        )
        self.loc_store = StorageLocation.objects.create(
            code="LOC-STORE",
            name="Storage Aisle 1",
            warehouse=self.wh_main,
            location_type=StorageLocation.LocationType.STORAGE,
        )
        self.loc_dist = StorageLocation.objects.create(
            code="LOC-DIST-STORE",
            name="Distribution Storage",
            warehouse=self.wh_dist,
            location_type=StorageLocation.LocationType.STORAGE,
        )
        self.product_batch = InventoryItem.objects.create(
            code="PROD-BATCH-001",
            name="Pharma Compound Alpha",
            category=self.cat,
            base_unit="EA",
            tracking=InventoryItem.Tracking.BATCH,
        )
        self.product_serial = InventoryItem.objects.create(
            code="PROD-SER-001",
            name="Precision Sensor X",
            category=self.cat,
            base_unit="EA",
            tracking=InventoryItem.Tracking.SERIAL,
        )
        self.product_standard = InventoryItem.objects.create(
            code="PROD-STD-001",
            name="Standard Hex Bolt",
            category=self.cat,
            base_unit="EA",
            tracking=InventoryItem.Tracking.NONE,
        )

    def test_goods_receipt_workflow_and_posting(self):
        """Phase 3 - Operation 1: Goods Receipt (Draft -> Submit -> Post Receipt)"""
        # 1. Create Receipt Draft
        payload = {
            "document_number": "GRN-2026-0001",
            "transaction_type": "RECEIPT",
            "status": "DRAFT",
            "warehouse": self.wh_main.id,
            "supplier": "Acme Industrial Supplies",
            "reference_number": "PO-998822",
            "notes": "Urgent shipment received at main dock",
            "lines": [
                {
                    "item": self.product_batch.id,
                    "location": self.loc_rec.id,
                    "quantity": 100,
                    "unit_cost": 25.0,
                    "batch_number": "BATCH-2026-X1",
                    "expiry_date": "2027-12-31",
                }
            ],
        }
        res = self.client.post("/api/v1/inventory/movements/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        tx_id = res.data["id"]

        # 2. Submit Receipt
        res_submit = self.client.post(f"/api/v1/inventory/movements/{tx_id}/submit/")
        self.assertEqual(res_submit.status_code, status.HTTP_200_OK)
        self.assertEqual(res_submit.data["status"], "SUBMITTED")

        # 3. Post Receipt
        res_post = self.client.post(f"/api/v1/inventory/movements/{tx_id}/post/")
        self.assertEqual(res_post.status_code, status.HTTP_200_OK)
        self.assertEqual(res_post.data["status"], "POSTED")

        # Verify stock balance
        bal = StockBalance.objects.get(item=self.product_batch, warehouse=self.wh_main, location=self.loc_rec)
        self.assertEqual(bal.on_hand_qty, Decimal("100.0000"))

    def test_stock_issue_workflow_and_posting(self):
        """Phase 3 - Operation 2: Stock Issue (Draft -> Submit -> Post Issue)"""
        # Seed initial stock
        StockBalance.objects.create(
            item=self.product_standard,
            warehouse=self.wh_main,
            location=self.loc_store,
            on_hand_qty=Decimal("50.0000"),
        )

        payload = {
            "document_number": "ISS-2026-0001",
            "transaction_type": "ISSUE",
            "status": "DRAFT",
            "warehouse": self.wh_main.id,
            "issue_type": "Production",
            "reference_number": "WO-4401",
            "issued_to": "Assembly Line Beta",
            "reason": "Assembly for Project Titan",
            "lines": [
                {
                    "item": self.product_standard.id,
                    "location": self.loc_store.id,
                    "quantity": 20,
                    "unit_cost": 2.50,
                }
            ],
        }
        res = self.client.post("/api/v1/inventory/movements/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        tx_id = res.data["id"]

        # Post Issue
        res_post = self.client.post(f"/api/v1/inventory/movements/{tx_id}/post/")
        self.assertEqual(res_post.status_code, status.HTTP_200_OK)
        self.assertEqual(res_post.data["status"], "POSTED")

        bal = StockBalance.objects.get(item=self.product_standard, warehouse=self.wh_main, location=self.loc_store)
        self.assertEqual(bal.on_hand_qty, Decimal("30.0000"))

    def test_stock_transfer_dispatch_and_receive(self):
        """Phase 3 - Operation 3: Stock Transfer (Draft -> Submit -> Dispatch -> Receive)"""
        StockBalance.objects.create(
            item=self.product_standard,
            warehouse=self.wh_main,
            location=self.loc_store,
            on_hand_qty=Decimal("80.0000"),
        )

        payload = {
            "document_number": "TRF-2026-0001",
            "transaction_type": "TRANSFER",
            "status": "DRAFT",
            "warehouse": self.wh_main.id,
            "destination_warehouse": self.wh_dist.id,
            "notes": "Replenishment for Regional Hub",
            "lines": [
                {
                    "item": self.product_standard.id,
                    "location": self.loc_store.id,
                    "destination_location": self.loc_dist.id,
                    "quantity": 30,
                    "unit_cost": 2.50,
                }
            ],
        }
        res = self.client.post("/api/v1/inventory/movements/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        tx_id = res.data["id"]

        # Submit
        self.client.post(f"/api/v1/inventory/movements/{tx_id}/submit/")

        # Dispatch (reduces source warehouse stock, moves to in-transit status)
        res_disp = self.client.post(f"/api/v1/inventory/movements/{tx_id}/dispatch/")
        self.assertEqual(res_disp.status_code, status.HTTP_200_OK)
        self.assertEqual(res_disp.data["status"], "DISPATCHED")

        src_bal = StockBalance.objects.get(item=self.product_standard, warehouse=self.wh_main, location=self.loc_store)
        self.assertEqual(src_bal.on_hand_qty, Decimal("50.0000"))

        # Destination shouldn't have stock yet before receiving
        dest_bal = StockBalance.objects.filter(item=self.product_standard, warehouse=self.wh_dist, location=self.loc_dist).first()
        self.assertTrue(dest_bal is None or dest_bal.on_hand_qty == Decimal("0.0000"))

        # Receive (adds to destination warehouse)
        res_rec = self.client.post(f"/api/v1/inventory/movements/{tx_id}/receive/")
        self.assertEqual(res_rec.status_code, status.HTTP_200_OK)
        self.assertEqual(res_rec.data["status"], "POSTED")

        dest_bal_updated = StockBalance.objects.get(item=self.product_standard, warehouse=self.wh_dist, location=self.loc_dist)
        self.assertEqual(dest_bal_updated.on_hand_qty, Decimal("30.0000"))

    def test_stock_adjustment_approve_and_post(self):
        """Phase 3 - Operation 4: Stock Adjustment (Draft -> Submit -> Approve -> Post Adjustment)"""
        StockBalance.objects.create(
            item=self.product_standard,
            warehouse=self.wh_main,
            location=self.loc_store,
            on_hand_qty=Decimal("45.0000"),
        )

        payload = {
            "document_number": "ADJ-2026-0001",
            "transaction_type": "ADJUSTMENT",
            "status": "DRAFT",
            "warehouse": self.wh_main.id,
            "adjustment_type": "Increase",
            "reason": "Physical Count Difference",
            "notes": "Found extra box in back of shelf",
            "lines": [
                {
                    "item": self.product_standard.id,
                    "location": self.loc_store.id,
                    "system_quantity": 45,
                    "actual_quantity": 50,
                    "difference_quantity": 5,
                    "quantity": 5,
                    "unit_cost": 2.50,
                }
            ],
        }
        res = self.client.post("/api/v1/inventory/movements/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        tx_id = res.data["id"]

        # Approve
        res_appr = self.client.post(f"/api/v1/inventory/movements/{tx_id}/approve/")
        self.assertEqual(res_appr.status_code, status.HTTP_200_OK)
        self.assertEqual(res_appr.data["status"], "APPROVED")

        # Post Adjustment
        res_post = self.client.post(f"/api/v1/inventory/movements/{tx_id}/post/")
        self.assertEqual(res_post.status_code, status.HTTP_200_OK)
        self.assertEqual(res_post.data["status"], "POSTED")

        bal = StockBalance.objects.get(item=self.product_standard, warehouse=self.wh_main, location=self.loc_store)
        self.assertEqual(bal.on_hand_qty, Decimal("50.0000"))

    def test_stock_return_inspect_and_post(self):
        """Phase 3 - Operation 5: Stock Return (Draft -> Submit -> Inspect -> Post Return)"""
        payload = {
            "document_number": "RET-2026-0001",
            "transaction_type": "RETURN",
            "status": "DRAFT",
            "warehouse": self.wh_main.id,
            "return_type": "Customer Return",
            "reference_number": "SO-8812",
            "party_name": "Apex Global Logistics",
            "product_condition": "Good",
            "return_disposition": "Restock",
            "reason": "Customer ordered excess stock",
            "lines": [
                {
                    "item": self.product_standard.id,
                    "location": self.loc_store.id,
                    "quantity": 15,
                    "unit_cost": 2.50,
                }
            ],
        }
        res = self.client.post("/api/v1/inventory/movements/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        tx_id = res.data["id"]

        # Inspect
        res_insp = self.client.post(f"/api/v1/inventory/movements/{tx_id}/inspect/")
        self.assertEqual(res_insp.status_code, status.HTTP_200_OK)
        self.assertEqual(res_insp.data["status"], "INSPECTED")

        # Post Return
        res_post = self.client.post(f"/api/v1/inventory/movements/{tx_id}/post/")
        self.assertEqual(res_post.status_code, status.HTTP_200_OK)
        self.assertEqual(res_post.data["status"], "POSTED")

        bal = StockBalance.objects.get(item=self.product_standard, warehouse=self.wh_main, location=self.loc_store)
        self.assertEqual(bal.on_hand_qty, Decimal("15.0000"))
