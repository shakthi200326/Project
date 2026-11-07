"""
Comprehensive Stock Control Workflow Tests (Scenarios A through I).
Covers end-to-end database-backed logic for:
- Scenario A: Goods Receipt Inward Stock Movement
- Scenario B: Stock Reservation
- Scenario C: Stock Reservation Release
- Scenario D: Stock Issue Outward Movement
- Scenario E: Stock Reclassification (Damaged Stock)
- Scenario F: Stock Transfer in Transit (Multi-facility Pipeline)
- Scenario G: Physical Stock Reconciliation (4-stage workflow)
- Scenario H: Reorder Level Monitoring (Replenishment thresholds)
- Scenario I: Stock Aging (Authoritative FIFO tracing)
"""
from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.categories.models import InventoryCategory
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.planning.models import StockLevel
from apps.products.models import InventoryItem
from apps.reconciliation.models import StockCount
from apps.stock.models import DamagedStock, StockBalance, StockLedgerEntry
from apps.units.models import UnitOfMeasure
from apps.warehouses.models import StorageLocation, Warehouse
from services.posting_service import InventoryPostingService


class StockControlComprehensiveWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = InventoryCategory.objects.create(name="Automotive Components", code="AUTO")
        self.uom = UnitOfMeasure.objects.create(name="Piece", code="EA", symbol="ea")

        self.item = InventoryItem.objects.create(
            name="Deep Groove Bearing 6205",
            code="BRG-6205",
            category=self.category,
            base_unit="EA",
            base_uom=self.uom,
            reorder_point=Decimal("40.0000"),
            standard_cost=Decimal("15.50"),
        )

        self.warehouse_origin = Warehouse.objects.create(
            name="Central Hub",
            code="WH-CENTRAL",
            warehouse_type=Warehouse.WarehouseType.MAIN,
            address="100 Main Logistics Way",
            city="Dallas",
            country="United States",
        )
        self.location_origin = StorageLocation.objects.create(
            name="Zone A - Bulk Storage",
            code="LOC-ZONE-A",
            warehouse=self.warehouse_origin,
        )

        self.warehouse_dest = Warehouse.objects.create(
            name="East Coast Terminal",
            code="WH-EAST",
            warehouse_type=Warehouse.WarehouseType.DISTRIBUTION,
            address="500 Port Blvd",
            city="Newark",
            country="United States",
        )
        self.location_dest = StorageLocation.objects.create(
            name="Inbound Receiving Dock",
            code="LOC-DOCK",
            warehouse=self.warehouse_dest,
        )

    # -------------------------------------------------------------------------
    # Scenario A: Goods Receipt & Inward Stock Movement
    # -------------------------------------------------------------------------
    def test_scenario_a_goods_receipt_inward_movement(self):
        """100 pcs inward: verifies balance on hand, available stock, and immutable ledger."""
        tx = StockTransaction.objects.create(
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            document_number="GRN-2026-001",
            warehouse=self.warehouse_origin,
            status=StockTransaction.Status.DRAFT,
            created_by="Warehouse Receiver",
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item,
            location=self.location_origin,
            quantity=Decimal("100.0000"),
            unit_cost=Decimal("15.50"),
        )
        InventoryPostingService.post_transaction(tx)

        # 1. Verify StockBalance
        balance = StockBalance.objects.get(
            warehouse=self.warehouse_origin,
            location=self.location_origin,
            item=self.item,
        )
        self.assertEqual(balance.on_hand_qty, Decimal("100.0000"))
        self.assertEqual(balance.available_qty, Decimal("100.0000"))

        # 2. Verify API Stock Balances
        res = self.client.get(f"/api/v1/inventory/stock-balances/?item={self.item.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()["results"][0]
        self.assertEqual(float(data["current_stock"]), 100.0)
        self.assertEqual(float(data["available_stock"]), 100.0)
        self.assertEqual(float(data["reserved_stock"]), 0.0)
        self.assertEqual(float(data["damaged_stock"]), 0.0)

        # 3. Verify Stock Ledger Entry
        ledger = StockLedgerEntry.objects.filter(
            warehouse=self.warehouse_origin,
            item=self.item,
        ).latest("created_at")
        self.assertEqual(ledger.movement_type, StockLedgerEntry.MovementType.RECEIPT)
        self.assertEqual(ledger.quantity_delta, Decimal("100.0000"))
        self.assertEqual(ledger.balance_after, Decimal("100.0000"))

    # -------------------------------------------------------------------------
    # Scenario B & C: Stock Reservation and Reservation Release
    # -------------------------------------------------------------------------
    def test_scenario_b_and_c_stock_reservation_and_release(self):
        """30 pcs reserved -> available drops to 70. 10 pcs released -> available rises to 80."""
        # Setup initial 100 pcs
        tx = StockTransaction.objects.create(
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            document_number="GRN-2026-002",
            warehouse=self.warehouse_origin,
            status=StockTransaction.Status.DRAFT,
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item,
            location=self.location_origin,
            quantity=Decimal("100.0000"),
            unit_cost=Decimal("15.50"),
        )
        InventoryPostingService.post_transaction(tx)

        balance = StockBalance.objects.get(
            warehouse=self.warehouse_origin,
            location=self.location_origin,
            item=self.item,
        )

        # Scenario B: Reserve 30 pcs
        balance.reserved_qty = Decimal("30.0000")
        balance.save(update_fields=["reserved_qty", "updated_at"])

        res = self.client.get(f"/api/v1/inventory/stock-balances/?item={self.item.id}")
        data = res.json()["results"][0]
        self.assertEqual(float(data["current_stock"]), 100.0)
        self.assertEqual(float(data["reserved_stock"]), 30.0)
        self.assertEqual(float(data["available_stock"]), 70.0)

        # Scenario C: Release 10 pcs (reserved becomes 20)
        balance.reserved_qty = Decimal("20.0000")
        balance.save(update_fields=["reserved_qty", "updated_at"])

        res = self.client.get(f"/api/v1/inventory/stock-balances/?item={self.item.id}")
        data = res.json()["results"][0]
        self.assertEqual(float(data["current_stock"]), 100.0)
        self.assertEqual(float(data["reserved_stock"]), 20.0)
        self.assertEqual(float(data["available_stock"]), 80.0)

    # -------------------------------------------------------------------------
    # Scenario D: Stock Issue Outward Movement
    # -------------------------------------------------------------------------
    def test_scenario_d_stock_issue_outward_movement(self):
        """20 pcs issued: on-hand drops to 80, ledger logs negative delta."""
        # 100 pcs initial
        tx_in = StockTransaction.objects.create(
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            document_number="GRN-2026-003",
            warehouse=self.warehouse_origin,
            status=StockTransaction.Status.DRAFT,
        )
        StockTransactionLine.objects.create(
            transaction=tx_in,
            item=self.item,
            location=self.location_origin,
            quantity=Decimal("100.0000"),
            unit_cost=Decimal("15.50"),
        )
        InventoryPostingService.post_transaction(tx_in)

        # Issue 20 pcs
        tx_out = StockTransaction.objects.create(
            transaction_type=StockTransaction.TransactionType.ISSUE,
            document_number="ISS-2026-001",
            warehouse=self.warehouse_origin,
            status=StockTransaction.Status.DRAFT,
            created_by="Production Line A",
        )
        StockTransactionLine.objects.create(
            transaction=tx_out,
            item=self.item,
            location=self.location_origin,
            quantity=Decimal("20.0000"),
            unit_cost=Decimal("15.50"),
        )
        InventoryPostingService.post_transaction(tx_out)

        balance = StockBalance.objects.get(
            warehouse=self.warehouse_origin,
            location=self.location_origin,
            item=self.item,
        )
        self.assertEqual(balance.on_hand_qty, Decimal("80.0000"))
        self.assertEqual(balance.available_qty, Decimal("80.0000"))

        res = self.client.get(f"/api/v1/inventory/stock-balances/?item={self.item.id}")
        data = res.json()["results"][0]
        self.assertEqual(float(data["current_stock"]), 80.0)
        self.assertEqual(float(data["available_stock"]), 80.0)

        # Verify ledger issue
        latest_ledger = StockLedgerEntry.objects.filter(
            warehouse=self.warehouse_origin,
            item=self.item,
        ).latest("created_at")
        self.assertEqual(latest_ledger.movement_type, StockLedgerEntry.MovementType.ISSUE)
        self.assertEqual(latest_ledger.quantity_delta, Decimal("-20.0000"))
        self.assertEqual(latest_ledger.balance_after, Decimal("80.0000"))

    # -------------------------------------------------------------------------
    # Scenario E: Stock Reclassification (Damaged Stock)
    # -------------------------------------------------------------------------
    def test_scenario_e_stock_reclassification_damaged(self):
        """10 pcs marked damaged: damaged_stock increases to 10, available drops to 70."""
        # Initial 80 pcs
        tx = StockTransaction.objects.create(
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            document_number="GRN-2026-004",
            warehouse=self.warehouse_origin,
            status=StockTransaction.Status.DRAFT,
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item,
            location=self.location_origin,
            quantity=Decimal("80.0000"),
            unit_cost=Decimal("15.50"),
        )
        InventoryPostingService.post_transaction(tx)

        balance = StockBalance.objects.get(
            warehouse=self.warehouse_origin,
            location=self.location_origin,
            item=self.item,
        )
        balance.damaged_qty = Decimal("10.0000")
        balance.save(update_fields=["damaged_qty", "updated_at"])

        res = self.client.get(f"/api/v1/inventory/stock-balances/?item={self.item.id}")
        data = res.json()["results"][0]
        self.assertEqual(float(data["current_stock"]), 80.0)
        self.assertEqual(float(data["damaged_stock"]), 10.0)
        self.assertEqual(float(data["available_stock"]), 70.0)

    # -------------------------------------------------------------------------
    # Scenario F: Stock Transfer in Transit
    # -------------------------------------------------------------------------
    def test_scenario_f_stock_transfer_in_transit(self):
        """20 pcs dispatched, 15 received -> 5 pending in transit with Partially Received status."""
        transfer_tx = StockTransaction.objects.create(
            transaction_type=StockTransaction.TransactionType.TRANSFER,
            document_number="TRF-2026-001",
            warehouse=self.warehouse_origin,
            destination_warehouse=self.warehouse_dest,
            status="DISPATCHED",
            notes="Expedited freight transit",
        )
        StockTransactionLine.objects.create(
            transaction=transfer_tx,
            item=self.item,
            location=self.location_origin,
            destination_location=self.location_dest,
            quantity=Decimal("20.0000"),
            received_quantity=Decimal("15.0000"),
        )

        res = self.client.get("/api/v1/inventory/transit/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.json()["results"]
        match = next((t for t in results if t.get("transfer_number") == "TRF-2026-001" or t.get("document_number") == "TRF-2026-001"), None)
        self.assertIsNotNone(match)
        self.assertEqual(float(match["dispatched_quantity"]), 20.0)
        self.assertEqual(float(match["received_quantity"]), 15.0)
        self.assertEqual(float(match["pending_quantity"]), 5.0)
        self.assertEqual(match["transit_status"], "Partially Received")

    # -------------------------------------------------------------------------
    # Scenario G: Physical Stock Reconciliation
    # -------------------------------------------------------------------------
    def test_scenario_g_stock_reconciliation_workflow(self):
        """Reconciliation: 80 system, 77 physical -> -3 variance. Approval generates adjustment and updates balance."""
        # 1. Establish 80 pcs on-hand
        tx = StockTransaction.objects.create(
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            document_number="GRN-2026-005",
            warehouse=self.warehouse_origin,
            status=StockTransaction.Status.DRAFT,
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item,
            location=self.location_origin,
            quantity=Decimal("80.0000"),
            unit_cost=Decimal("15.50"),
        )
        InventoryPostingService.post_transaction(tx)

        # 2. Create StockCount
        count = StockCount.objects.create(
            count_number="REC-2026-TEST",
            reconciliation_number="REC-2026-TEST",
            warehouse=self.warehouse_origin,
            location=self.location_origin,
            item=self.item,
            system_quantity=Decimal("80.0000"),
            physical_quantity=Decimal("77.0000"),
            difference_quantity=Decimal("-3.0000"),
            status=StockCount.Status.DRAFT,
            reason="Physical Count Difference",
        )

        # 3. Submit
        res = self.client.post(f"/api/v1/inventory/reconciliation/{count.id}/submit/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        count.refresh_from_db()
        self.assertEqual(count.status, StockCount.Status.SUBMITTED)

        # 4. Approve
        res = self.client.post(f"/api/v1/inventory/reconciliation/{count.id}/approve/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        count.refresh_from_db()
        self.assertEqual(count.status, StockCount.Status.APPROVED)

        # 5. Generate Adjustment
        res = self.client.post(f"/api/v1/inventory/reconciliation/{count.id}/generate_adjustment/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data["status"], "ADJUSTED")
        self.assertTrue(data["adjustment_document_number"].startswith("ADJ-REC-"))

        # 6. Verify StockBalance updated to 77
        balance = StockBalance.objects.get(
            warehouse=self.warehouse_origin,
            location=self.location_origin,
            item=self.item,
        )
        self.assertEqual(balance.on_hand_qty, Decimal("77.0000"))

    # -------------------------------------------------------------------------
    # Scenario H: Reorder Level Monitoring
    # -------------------------------------------------------------------------
    def test_scenario_h_reorder_level_monitoring(self):
        """Verifies HEALTHY, REORDER_NEEDED, and CRITICAL thresholds with suggested order calculations."""
        # Configure min/max stock levels
        StockLevel.objects.create(
            product=self.item,
            warehouse=self.warehouse_origin,
            min_stock=Decimal("20.0000"),
            max_stock=Decimal("100.0000"),
            safety_stock=Decimal("10.0000"),
        )

        # 1. Healthy state (80 pcs on-hand > reorder_point 40)
        tx = StockTransaction.objects.create(
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            document_number="GRN-2026-006",
            warehouse=self.warehouse_origin,
            status=StockTransaction.Status.DRAFT,
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item,
            location=self.location_origin,
            quantity=Decimal("80.0000"),
            unit_cost=Decimal("15.50"),
        )
        InventoryPostingService.post_transaction(tx)

        res = self.client.get("/api/v1/inventory/stock-levels/monitoring/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        records = res.json()["results"]
        rec = next((r for r in records if r.get("product_id") == self.item.id and r["warehouse_id"] == self.warehouse_origin.id), None)
        self.assertIsNotNone(rec)
        self.assertEqual(rec["replenishment_status"], "HEALTHY")
        self.assertEqual(float(rec["suggested_order_qty"]), 0.0)

        # 2. Reorder Needed state (reduce to 35 pcs <= reorder_point 40)
        balance = StockBalance.objects.get(warehouse=self.warehouse_origin, location=self.location_origin, item=self.item)
        balance.on_hand_qty = Decimal("35.0000")
        balance.save(update_fields=["on_hand_qty"])

        res = self.client.get("/api/v1/inventory/stock-levels/monitoring/")
        rec = next((r for r in res.json()["results"] if r.get("product_id") == self.item.id and r["warehouse_id"] == self.warehouse_origin.id), None)
        self.assertEqual(rec["replenishment_status"], "REORDER_NEEDED")
        self.assertEqual(float(rec["suggested_order_qty"]), 65.0)  # max_stock 100 - on_hand 35

        # 3. Critical state (reduce to 15 pcs <= min_stock 20)
        balance.on_hand_qty = Decimal("15.0000")
        balance.save(update_fields=["on_hand_qty"])

        res = self.client.get("/api/v1/inventory/stock-levels/monitoring/")
        rec = next((r for r in res.json()["results"] if r.get("product_id") == self.item.id and r["warehouse_id"] == self.warehouse_origin.id), None)
        self.assertEqual(rec["replenishment_status"], "CRITICAL")
        self.assertEqual(float(rec["suggested_order_qty"]), 85.0)  # max_stock 100 - on_hand 15

    # -------------------------------------------------------------------------
    # Scenario I: Stock Aging Authoritative FIFO Calculation
    # -------------------------------------------------------------------------
    def test_scenario_i_stock_aging_fifo_calculation(self):
        """Authoritative FIFO tracing: distinct historical receipts bucketed accurately into 0-30 and 61-90 days."""
        from apps.batches.models import Batch

        today = timezone.localdate()

        # Batch 1: 40 pcs received 75 days ago (bucket 61-90 days)
        Batch.objects.create(
            item=self.item,
            warehouse=self.warehouse_origin,
            batch_number="BATCH-AGED-75D",
            received_date=today - timedelta(days=75),
            initial_quantity=Decimal("40.0000"),
            remaining_quantity=Decimal("40.0000"),
        )

        # Batch 2: 60 pcs received 10 days ago (bucket 0-30 days)
        Batch.objects.create(
            item=self.item,
            warehouse=self.warehouse_origin,
            batch_number="BATCH-FRESH-10D",
            received_date=today - timedelta(days=10),
            initial_quantity=Decimal("60.0000"),
            remaining_quantity=Decimal("60.0000"),
        )

        res = self.client.get(f"/api/v1/inventory/reports/ageing/?product={self.item.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertIn("summary", data)
        self.assertIn("results", data)

        summary = data["summary"]
        self.assertEqual(float(summary.get("bucket_0_30", 0)), 60.0)
        self.assertEqual(float(summary.get("bucket_61_90", 0)), 40.0)
        self.assertEqual(float(summary.get("total_quantity", 0)), 100.0)

        # Verify items in results
        batch_75 = next((r for r in data["results"] if r.get("batch_number") == "BATCH-AGED-75D"), None)
        self.assertIsNotNone(batch_75)
        self.assertIn("61", batch_75["ageing_bucket"])
        self.assertEqual(float(batch_75["current_quantity"]), 40.0)

        batch_10 = next((r for r in data["results"] if r.get("batch_number") == "BATCH-FRESH-10D"), None)
        self.assertIsNotNone(batch_10)
        self.assertIn("0", batch_10["ageing_bucket"])
        self.assertEqual(float(batch_10["current_quantity"]), 60.0)
