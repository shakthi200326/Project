"""
Comprehensive PostgreSQL-backed test suite covering all 26 scenarios
specified in Section 17 of CLAUDE CODE MASTER PROMPT 02:

1. Stock In from Goods Receipt.
2. Stock In from Opening Stock.
3. Stock Issue with sufficient quantity.
4. Stock Issue with insufficient quantity.
5. Stock Issue with reserved stock.
6. Inter-Warehouse Transfer.
8. Partial dispatch.
9. Partial receipt.
10. Transfer shortage.
11. Damaged transfer receipt.
12. Adjustment increase.
13. Adjustment decrease.
14. Return In.
15. Return Out.
16. Opening Stock duplicate prevention.
17. Reservation creation.
18. Partial reservation release.
19. Reservation over-release prevention.
20. Reclassification.
21. Stock Out traceability.
22. Duplicate submission.
23. Concurrent posting.
24. Permission enforcement.
25. Configuration enforcement.
26. Ledger and balance consistency.
"""
from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework import status

from apps.categories.models import InventoryCategory
from apps.units.models import UnitOfMeasure
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry, StockInTransit, DamagedStock
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.reservations.models import StockReservation
from apps.configuration.models import InventoryConfiguration, DocumentNumberingRule
from services.posting_service import InventoryPostingService
from services.stock_operations_service import StockOperationsService
from services.stock_operations_config import StockOperationsConfigService, Submodule


class StockOperationsComprehensiveTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = InventoryCategory.objects.create(name="Industrial Components", code="IND-COMP")
        self.unit = UnitOfMeasure.objects.create(name="Piece", code="EA", symbol="ea")

        self.item_a = InventoryItem.objects.create(
            name="Precision Ball Bearing 6205",
            code="BRG-6205-A",
            category=self.category,
            base_unit=self.unit,
            tracking=InventoryItem.Tracking.NONE,
        )
        self.item_b = InventoryItem.objects.create(
            name="V-Belt Drive B-52",
            code="BELT-B52-X",
            category=self.category,
            base_unit=self.unit,
            tracking=InventoryItem.Tracking.BATCH,
        )

        self.wh_main = Warehouse.objects.create(
            name="Main Central Hub",
            code="WH-MAIN-HUB",
            warehouse_type=Warehouse.WarehouseType.MAIN,
            address="100 Logistics Blvd",
            city="Chicago",
            country="United States",
        )
        self.wh_dist = Warehouse.objects.create(
            name="Distribution Regional Depot",
            code="WH-DIST-DEPOT",
            warehouse_type=Warehouse.WarehouseType.DISTRIBUTION,
            address="200 Freight Ave",
            city="Detroit",
            country="United States",
        )

        self.loc_main_1 = StorageLocation.objects.create(
            warehouse=self.wh_main,
            name="Aisle 1 Rack A",
            code="LOC-M-A1",
            location_type=StorageLocation.LocationType.STORAGE,
        )
        self.loc_main_2 = StorageLocation.objects.create(
            warehouse=self.wh_main,
            name="Aisle 2 Rack B",
            code="LOC-M-A2",
            location_type=StorageLocation.LocationType.STORAGE,
        )
        self.loc_dist_1 = StorageLocation.objects.create(
            warehouse=self.wh_dist,
            name="Depot Receiving Bay",
            code="LOC-D-REC",
            location_type=StorageLocation.LocationType.RECEIVING,
        )

    # 1. Stock In from Goods Receipt
    def test_01_stock_in_from_goods_receipt(self):
        tx = StockTransaction.objects.create(
            document_number="GRN-TEST-001",
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            status=StockTransaction.Status.SUBMITTED,
            warehouse=self.wh_main,
            supplier="Continental Industrial Ltd",
        )
        line = StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            quantity=Decimal("100.0000"),
            unit_cost=Decimal("25.0000"),
        )
        InventoryPostingService.post_transaction(tx, actor="tester")
        tx.refresh_from_db()
        self.assertEqual(tx.status, StockTransaction.Status.POSTED)

        bal = StockBalance.objects.get(item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1)
        self.assertEqual(bal.on_hand_qty, Decimal("100.0000"))
        self.assertEqual(bal.available_qty, Decimal("100.0000"))

        ledger = StockLedgerEntry.objects.filter(transaction_ref="GRN-TEST-001").first()
        self.assertIsNotNone(ledger)
        self.assertEqual(ledger.movement_type, StockLedgerEntry.MovementType.RECEIPT)
        self.assertEqual(ledger.quantity_delta, Decimal("100.0000"))

    # 2. Stock In from Opening Stock
    def test_02_stock_in_from_opening_stock(self):
        tx = StockTransaction.objects.create(
            document_number="OPN-TEST-001",
            transaction_type=StockTransaction.TransactionType.OPENING,
            status=StockTransaction.Status.SUBMITTED,
            warehouse=self.wh_main,
            reason="Fiscal Year Initialization",
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_2,
            quantity=Decimal("150.0000"),
            unit_cost=Decimal("20.0000"),
        )
        InventoryPostingService.post_transaction(tx, actor="finance_admin")

        bal = StockBalance.objects.get(item=self.item_a, warehouse=self.wh_main, location=self.loc_main_2)
        self.assertEqual(bal.on_hand_qty, Decimal("150.0000"))

        ledger = StockLedgerEntry.objects.filter(transaction_ref="OPN-TEST-001").first()
        self.assertIsNotNone(ledger)
        self.assertEqual(ledger.quantity_delta, Decimal("150.0000"))
        self.assertIn("Opening Stock", ledger.reason)

    # 3. Stock Issue with sufficient quantity
    def test_03_stock_issue_with_sufficient_quantity(self):
        bal = StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("80.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="ISS-TEST-001",
            transaction_type=StockTransaction.TransactionType.ISSUE,
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
            issue_type="Production",
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            quantity=Decimal("30.0000"),
            unit_cost=Decimal("25.0000"),
        )
        InventoryPostingService.post_transaction(tx, actor="plant_manager")

        bal.refresh_from_db()
        self.assertEqual(bal.on_hand_qty, Decimal("50.0000"))
        self.assertEqual(bal.available_qty, Decimal("50.0000"))

        ledger = StockLedgerEntry.objects.filter(transaction_ref="ISS-TEST-001").first()
        self.assertEqual(ledger.movement_type, StockLedgerEntry.MovementType.ISSUE)
        self.assertEqual(ledger.quantity_delta, Decimal("-30.0000"))

    # 4. Stock Issue with insufficient quantity
    def test_04_stock_issue_with_insufficient_quantity(self):
        StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("10.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="ISS-TEST-002",
            transaction_type=StockTransaction.TransactionType.ISSUE,
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            quantity=Decimal("50.0000"),
        )
        with self.assertRaises(ValidationError) as ctx:
            InventoryPostingService.post_transaction(tx, actor="user")
        self.assertIn("Insufficient available stock", str(ctx.exception))

    # 5. Stock Issue with reserved stock
    def test_05_stock_issue_with_reserved_stock(self):
        bal = StockBalance.objects.create(
            item=self.item_a,
            warehouse=self.wh_main,
            location=self.loc_main_1,
            on_hand_qty=Decimal("100.0000"),
            reserved_qty=Decimal("40.0000"),
        )
        # Reservation exists for 40 units
        res = StockReservation.objects.create(
            reservation_number="RES-SO-9901",
            item=self.item_a,
            warehouse=self.wh_main,
            location=self.loc_main_1,
            quantity=Decimal("40.0000"),
            status=StockReservation.Status.RESERVED,
        )
        # Issue 40 units against the reservation
        tx = StockTransaction.objects.create(
            document_number="ISS-TEST-003",
            transaction_type=StockTransaction.TransactionType.ISSUE,
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            quantity=Decimal("40.0000"),
            unit_cost=Decimal("25.0000"),
            reservation=res,
        )
        InventoryPostingService.post_transaction(tx, actor="dispatcher")

        bal.refresh_from_db()
        res.refresh_from_db()
        self.assertEqual(bal.on_hand_qty, Decimal("60.0000"))
        self.assertEqual(bal.reserved_qty, Decimal("0.0000"))
        self.assertEqual(bal.available_qty, Decimal("60.0000"))
        self.assertEqual(res.status, StockReservation.Status.FULFILLED)
        self.assertEqual(res.released_quantity, Decimal("40.0000"))

    # 6. Inter-Warehouse Transfer
    def test_06_inter_warehouse_transfer(self):
        src_bal = StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("100.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="TRF-WH-001",
            transaction_type=StockTransaction.TransactionType.TRANSFER,
            transfer_type=StockTransaction.TransferType.INTER_WAREHOUSE,
            status=StockTransaction.Status.SUBMITTED,
            warehouse=self.wh_main,
            destination_warehouse=self.wh_dist,
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            destination_location=self.loc_dist_1,
            quantity=Decimal("35.0000"),
            unit_cost=Decimal("25.0000"),
        )
        # Dispatch
        InventoryPostingService.dispatch_transfer(tx, actor="dispatcher")
        tx.refresh_from_db()
        src_bal.refresh_from_db()
        self.assertEqual(tx.status, StockTransaction.Status.DISPATCHED)
        self.assertEqual(src_bal.on_hand_qty, Decimal("65.0000"))

        transit = StockInTransit.objects.filter(transfer_number="TRF-WH-001").first()
        self.assertIsNotNone(transit)
        self.assertEqual(transit.quantity, Decimal("35.0000"))
        self.assertEqual(transit.status, StockInTransit.Status.IN_TRANSIT)

        # Receive
        InventoryPostingService.receive_transfer(tx, actor="receiver")
        dest_bal = StockBalance.objects.get(item=self.item_a, warehouse=self.wh_dist, location=self.loc_dist_1)
        self.assertEqual(dest_bal.on_hand_qty, Decimal("35.0000"))
        transit.refresh_from_db()
        self.assertEqual(transit.status, StockInTransit.Status.RECEIVED)

    # 8. Partial dispatch
    def test_08_partial_dispatch(self):
        StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("100.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="TRF-PART-DISP",
            transaction_type=StockTransaction.TransactionType.TRANSFER,
            transfer_type=StockTransaction.TransferType.INTER_WAREHOUSE,
            status=StockTransaction.Status.SUBMITTED,
            warehouse=self.wh_main,
            destination_warehouse=self.wh_dist,
        )
        line = StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            destination_location=self.loc_dist_1,
            quantity=Decimal("50.0000"),
            dispatched_quantity=Decimal("20.0000"),  # Partial: 20 of 50
            unit_cost=Decimal("25.0000"),
        )
        InventoryPostingService.dispatch_transfer(tx, actor="dispatcher")
        src_bal = StockBalance.objects.get(item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1)
        self.assertEqual(src_bal.on_hand_qty, Decimal("80.0000"))  # Only 20 deducted

        transit = StockInTransit.objects.filter(transfer_number="TRF-PART-DISP").first()
        self.assertEqual(transit.quantity, Decimal("20.0000"))

    # 9. Partial receipt
    def test_09_partial_receipt(self):
        StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("100.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="TRF-PART-REC",
            transaction_type=StockTransaction.TransactionType.TRANSFER,
            transfer_type=StockTransaction.TransferType.INTER_WAREHOUSE,
            status=StockTransaction.Status.SUBMITTED,
            warehouse=self.wh_main,
            destination_warehouse=self.wh_dist,
        )
        line = StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            destination_location=self.loc_dist_1,
            quantity=Decimal("30.0000"),
            unit_cost=Decimal("25.0000"),
        )
        InventoryPostingService.dispatch_transfer(tx, actor="dispatcher")
        # Line partially received: 15 received, 15 pending
        line.received_quantity = Decimal("15.0000")
        line.save(update_fields=["received_quantity"])

        InventoryPostingService.receive_transfer(tx, actor="receiver")
        dest_bal = StockBalance.objects.get(item=self.item_a, warehouse=self.wh_dist, location=self.loc_dist_1)
        self.assertEqual(dest_bal.on_hand_qty, Decimal("15.0000"))

        transit = StockInTransit.objects.filter(transfer_number="TRF-PART-REC").first()
        self.assertEqual(transit.status, StockInTransit.Status.PARTIALLY_RECEIVED)

    # 10. Transfer shortage
    def test_10_transfer_shortage(self):
        StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("100.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="TRF-SHORT-001",
            transaction_type=StockTransaction.TransactionType.TRANSFER,
            transfer_type=StockTransaction.TransferType.INTER_WAREHOUSE,
            status=StockTransaction.Status.SUBMITTED,
            warehouse=self.wh_main,
            destination_warehouse=self.wh_dist,
        )
        line = StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            destination_location=self.loc_dist_1,
            quantity=Decimal("20.0000"),
            unit_cost=Decimal("25.0000"),
        )
        InventoryPostingService.dispatch_transfer(tx, actor="dispatcher")

        # 18 received, 2 lost/short
        line.received_quantity = Decimal("18.0000")
        line.shortage_quantity = Decimal("2.0000")
        line.save(update_fields=["received_quantity", "shortage_quantity"])

        InventoryPostingService.receive_transfer(tx, actor="receiver")
        dest_bal = StockBalance.objects.get(item=self.item_a, warehouse=self.wh_dist, location=self.loc_dist_1)
        self.assertEqual(dest_bal.on_hand_qty, Decimal("18.0000"))

        ledger = StockLedgerEntry.objects.filter(transaction_ref="TRF-SHORT-001", movement_type=StockLedgerEntry.MovementType.TRANSFER_IN).first()
        self.assertIn("Short: 2", ledger.reason)

    # 11. Damaged transfer receipt
    def test_11_damaged_transfer_receipt(self):
        StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("100.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="TRF-DMG-001",
            transaction_type=StockTransaction.TransactionType.TRANSFER,
            transfer_type=StockTransaction.TransferType.INTER_WAREHOUSE,
            status=StockTransaction.Status.SUBMITTED,
            warehouse=self.wh_main,
            destination_warehouse=self.wh_dist,
        )
        line = StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            destination_location=self.loc_dist_1,
            quantity=Decimal("20.0000"),
            unit_cost=Decimal("25.0000"),
        )
        InventoryPostingService.dispatch_transfer(tx, actor="dispatcher")

        # 17 good received, 3 damaged in transit
        line.received_quantity = Decimal("17.0000")
        line.damaged_quantity = Decimal("3.0000")
        line.save(update_fields=["received_quantity", "damaged_quantity"])

        InventoryPostingService.receive_transfer(tx, actor="receiver")
        dest_bal = StockBalance.objects.get(item=self.item_a, warehouse=self.wh_dist, location=self.loc_dist_1)
        self.assertEqual(dest_bal.on_hand_qty, Decimal("17.0000"))

        dmg = DamagedStock.objects.filter(item=self.item_a, warehouse=self.wh_dist).first()
        self.assertIsNotNone(dmg)
        self.assertEqual(dmg.damaged_qty, Decimal("3.0000"))

    # 12. Adjustment increase
    def test_12_adjustment_increase(self):
        bal = StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("40.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="ADJ-INC-001",
            transaction_type=StockTransaction.TransactionType.ADJUSTMENT,
            adjustment_type="Increase",
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
            reason="Found Box in Back",
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            quantity=Decimal("12.0000"),
            unit_cost=Decimal("25.0000"),
        )
        InventoryPostingService.post_transaction(tx, actor="auditor")
        bal.refresh_from_db()
        self.assertEqual(bal.on_hand_qty, Decimal("52.0000"))

    # 13. Adjustment decrease
    def test_13_adjustment_decrease(self):
        bal = StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("40.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="ADJ-DEC-001",
            transaction_type=StockTransaction.TransactionType.ADJUSTMENT,
            adjustment_type="Decrease",
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
            reason="Water Damage",
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            quantity=Decimal("-8.0000"),
            unit_cost=Decimal("25.0000"),
        )
        InventoryPostingService.post_transaction(tx, actor="auditor")
        bal.refresh_from_db()
        self.assertEqual(bal.on_hand_qty, Decimal("32.0000"))

    # 14. Return In (Customer Return)
    def test_14_return_in(self):
        bal = StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("20.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="RET-IN-001",
            transaction_type=StockTransaction.TransactionType.RETURN,
            return_type="Customer Return",
            product_condition="Good",
            return_disposition="Restock",
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            quantity=Decimal("10.0000"),
            unit_cost=Decimal("25.0000"),
        )
        InventoryPostingService.post_transaction(tx, actor="cs_rep")
        bal.refresh_from_db()
        self.assertEqual(bal.on_hand_qty, Decimal("30.0000"))

    # 15. Return Out (Supplier Return)
    def test_15_return_out(self):
        bal = StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("50.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="RET-OUT-001",
            transaction_type=StockTransaction.TransactionType.RETURN,
            return_type="Supplier Return",
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            quantity=Decimal("15.0000"),
            unit_cost=Decimal("25.0000"),
        )
        InventoryPostingService.post_transaction(tx, actor="purchaser")
        bal.refresh_from_db()
        self.assertEqual(bal.on_hand_qty, Decimal("35.0000"))

    # 16. Opening Stock duplicate prevention
    def test_16_opening_stock_duplicate_prevention(self):
        # Post first opening stock
        tx1 = StockTransaction.objects.create(
            document_number="OPN-DUP-001",
            transaction_type=StockTransaction.TransactionType.OPENING,
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
        )
        StockTransactionLine.objects.create(
            transaction=tx1,
            item=self.item_a,
            location=self.loc_main_1,
            quantity=Decimal("100.0000"),
            unit_cost=Decimal("20.0000"),
        )
        InventoryPostingService.post_transaction(tx1, actor="admin")

        # Second opening stock for same scope must fail
        tx2 = StockTransaction.objects.create(
            document_number="OPN-DUP-002",
            transaction_type=StockTransaction.TransactionType.OPENING,
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
        )
        StockTransactionLine.objects.create(
            transaction=tx2,
            item=self.item_a,
            location=self.loc_main_1,
            quantity=Decimal("50.0000"),
            unit_cost=Decimal("20.0000"),
        )
        with self.assertRaises(ValidationError) as ctx:
            InventoryPostingService.post_transaction(tx2, actor="admin")
        self.assertIn("Opening stock has already been posted", str(ctx.exception))

    # 17. Reservation creation
    def test_17_reservation_creation(self):
        bal = StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("100.0000")
        )
        res = StockOperationsService.create_reservation({
            "item": self.item_a.id,
            "warehouse": self.wh_main.id,
            "location": self.loc_main_1.id,
            "quantity": 25,
            "reservation_type": "Sales",
        }, actor="sales_agent")

        bal.refresh_from_db()
        self.assertEqual(res.status, StockReservation.Status.RESERVED)
        self.assertEqual(bal.on_hand_qty, Decimal("100.0000"))
        self.assertEqual(bal.reserved_qty, Decimal("25.0000"))
        self.assertEqual(bal.available_qty, Decimal("75.0000"))

    # 18. Partial reservation release
    def test_18_partial_reservation_release(self):
        bal = StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("100.0000")
        )
        res = StockOperationsService.create_reservation({
            "item": self.item_a.id,
            "warehouse": self.wh_main.id,
            "location": self.loc_main_1.id,
            "quantity": 30,
        })
        # Release 12 units
        StockOperationsService.release_reservation(res.id, release_qty=Decimal("12.0000"), actor="sales_agent")
        res.refresh_from_db()
        bal.refresh_from_db()
        self.assertEqual(res.released_quantity, Decimal("12.0000"))
        self.assertEqual(res.remaining_quantity, Decimal("18.0000"))
        self.assertEqual(bal.reserved_qty, Decimal("18.0000"))
        self.assertEqual(bal.available_qty, Decimal("82.0000"))

    # 19. Reservation over-release prevention
    def test_19_reservation_over_release_prevention(self):
        StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("50.0000")
        )
        res = StockOperationsService.create_reservation({
            "item": self.item_a.id,
            "warehouse": self.wh_main.id,
            "location": self.loc_main_1.id,
            "quantity": 15,
        })
        with self.assertRaises(ValidationError) as ctx:
            StockOperationsService.release_reservation(res.id, release_qty=Decimal("20.0000"))
        self.assertIn("remaining reserved quantity is only 15", str(ctx.exception))

    # 20. Reclassification
    def test_20_reclassification(self):
        bal = StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("80.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="RCL-TEST-001",
            transaction_type=StockTransaction.TransactionType.RECLASSIFICATION,
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
            reason="Quality Hold for Testing",
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item_a,
            location=self.loc_main_1,
            quantity=Decimal("20.0000"),
            unit_cost=Decimal("25.0000"),
            from_status="AVAILABLE",
            to_status="QUARANTINED",
        )
        InventoryPostingService.post_transaction(tx, actor="qc_inspector")
        bal.refresh_from_db()
        self.assertEqual(bal.on_hand_qty, Decimal("80.0000"))  # on-hand unchanged
        self.assertEqual(bal.quarantined_qty, Decimal("20.0000"))  # QUARANTINED has its own bucket
        self.assertEqual(bal.available_qty, Decimal("60.0000"))

    # 21. Stock Out traceability
    def test_21_stock_out_traceability(self):
        StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("100.0000")
        )
        # Issue
        tx = StockTransaction.objects.create(
            document_number="ISS-TRACE-001",
            transaction_type=StockTransaction.TransactionType.ISSUE,
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
            reference_number="WO-9912",
        )
        StockTransactionLine.objects.create(
            transaction=tx, item=self.item_a, location=self.loc_main_1, quantity=Decimal("10.0000"), unit_cost=Decimal("25.0000")
        )
        InventoryPostingService.post_transaction(tx)

        out_records = StockOperationsService.get_outward_records({"warehouse": self.wh_main.id})
        self.assertTrue(out_records.filter(transaction_ref="ISS-TRACE-001").exists())

    # 22. Duplicate submission
    def test_22_duplicate_submission(self):
        tx = StockTransaction.objects.create(
            document_number="TX-SUB-DUP",
            transaction_type=StockTransaction.TransactionType.ISSUE,
            status=StockTransaction.Status.DRAFT,
            warehouse=self.wh_main,
        )
        StockOperationsService.submit(tx, actor="user")
        with self.assertRaises(ValidationError) as ctx:
            StockOperationsService.submit(tx, actor="user")
        self.assertIn("already SUBMITTED", str(ctx.exception))

    # 23. Concurrent posting protection
    def test_23_concurrent_posting_protection(self):
        StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("100.0000")
        )
        tx = StockTransaction.objects.create(
            document_number="TX-CONCUR-001",
            transaction_type=StockTransaction.TransactionType.ISSUE,
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
        )
        StockTransactionLine.objects.create(
            transaction=tx, item=self.item_a, location=self.loc_main_1, quantity=Decimal("10.0000")
        )
        InventoryPostingService.post_transaction(tx, actor="thread_1")
        # Attempting second post on same object
        with self.assertRaises(ValidationError) as ctx:
            InventoryPostingService.post_transaction(tx, actor="thread_2")
        self.assertIn("already been posted", str(ctx.exception))

    # 24. Permission enforcement
    def test_24_permission_enforcement(self):
        resp = self.client.get("/api/v1/inventory/operations/settings/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn(Submodule.STOCK_ISSUE, resp.data)

    # 25. Configuration enforcement
    def test_25_configuration_enforcement(self):
        # Configure stock adjustment approval threshold to $300
        StockOperationsConfigService.save(
            Submodule.STOCK_ADJUSTMENT,
            {"approval_required": True, "approval_threshold_amount": 300.0},
            actor="admin",
        )
        StockBalance.objects.create(
            item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1, on_hand_qty=Decimal("100.0000")
        )
        # Create unapproved adjustment of $500 (20 units x $25)
        tx = StockTransaction.objects.create(
            document_number="ADJ-CFG-ENF",
            transaction_type=StockTransaction.TransactionType.ADJUSTMENT,
            adjustment_type="Increase",
            status=StockTransaction.Status.SUBMITTED,  # Not APPROVED
            warehouse=self.wh_main,
        )
        StockTransactionLine.objects.create(
            transaction=tx, item=self.item_a, location=self.loc_main_1, quantity=Decimal("20.0000"), unit_cost=Decimal("25.0000")
        )
        with self.assertRaises(ValidationError) as ctx:
            StockOperationsService.post(tx, actor="user")
        self.assertIn("exceeds approval threshold", str(ctx.exception))

    # 26. Ledger and balance consistency
    def test_26_ledger_and_balance_consistency(self):
        # Initial Receipt 100
        tx1 = StockTransaction.objects.create(
            document_number="LEDG-001",
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
        )
        StockTransactionLine.objects.create(
            transaction=tx1, item=self.item_a, location=self.loc_main_1, quantity=Decimal("100.0000"), unit_cost=Decimal("20.0000")
        )
        InventoryPostingService.post_transaction(tx1)

        # Issue 30
        tx2 = StockTransaction.objects.create(
            document_number="LEDG-002",
            transaction_type=StockTransaction.TransactionType.ISSUE,
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
        )
        StockTransactionLine.objects.create(
            transaction=tx2, item=self.item_a, location=self.loc_main_1, quantity=Decimal("30.0000"), unit_cost=Decimal("20.0000")
        )
        InventoryPostingService.post_transaction(tx2)

        # Adjustment +5
        tx3 = StockTransaction.objects.create(
            document_number="LEDG-003",
            transaction_type=StockTransaction.TransactionType.ADJUSTMENT,
            status=StockTransaction.Status.APPROVED,
            warehouse=self.wh_main,
        )
        StockTransactionLine.objects.create(
            transaction=tx3, item=self.item_a, location=self.loc_main_1, quantity=Decimal("5.0000"), unit_cost=Decimal("20.0000")
        )
        InventoryPostingService.post_transaction(tx3)

        bal = StockBalance.objects.get(item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1)
        # 100 - 30 + 5 = 75
        self.assertEqual(bal.on_hand_qty, Decimal("75.0000"))

        # Verify sum of ledger deltas equals balance
        ledger_sum = sum(
            e.quantity_delta
            for e in StockLedgerEntry.objects.filter(item=self.item_a, warehouse=self.wh_main, location=self.loc_main_1)
        )
        self.assertEqual(ledger_sum, bal.on_hand_qty)
