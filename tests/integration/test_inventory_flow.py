import io
from decimal import Decimal
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.categories.models import InventoryCategory
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.reservations.models import StockReservation
from apps.reconciliation.models import StockCount, StockCountLine
from apps.valuation.models import InventoryValuation
from services.posting_service import InventoryPostingService
from shared_file_storage.services.storage_service import FileStorageService
from shared_file_storage.models.file_record import StoredFile
from shared_event_bus.publisher import EventPublisher

class EndToEndInventoryFlowTests(TestCase):
    """
    Complete End-to-End Enterprise Flow Verification:
    Product -> Attachments -> Receipt -> Reservation -> Issue -> Reconciliation -> Events.
    """

    def setUp(self):
        self.client = APIClient()
        self.published_events = []

        # Hook into EventPublisher to collect published events
        EventPublisher.subscribe("inventory.stock.receipt", lambda e: self.published_events.append(e))
        EventPublisher.subscribe("inventory.stock.issue", lambda e: self.published_events.append(e))
        EventPublisher.subscribe("inventory.stock.adjustment", lambda e: self.published_events.append(e))

        # 1. Base Setup: Category
        self.category = InventoryCategory.objects.create(name="Turbines & Rotors", code="CAT-TURB-01")

        # 2. Facility Setup: Warehouse & Bin
        self.warehouse = Warehouse.objects.create(
            name="Apex Aerospace Fulfillment",
            code="WH-APEX",
            is_active=True,
        )
        self.location = StorageLocation.objects.create(
            warehouse=self.warehouse,
            name="Zone A - Secure High-Value Vault",
            code="LOC-VAULT-01",
        )

    def test_complete_enterprise_inventory_lifecycle(self):
        # ----------------------------------------------------------------------
        # STEP 1: Create Master Product and High-Temperature Variant
        # ----------------------------------------------------------------------
        item = InventoryItem.objects.create(
            name="Ceramic Matrix Turbine Blade X-9",
            code="BLADE-X9-CERAMIC",
            category=self.category,
            brand="Pratt & Precision",
            base_unit="EA",
            tracking=InventoryItem.Tracking.BATCH,
            reorder_point=Decimal("25.0000"),
            reorder_quantity=Decimal("50.0000"),
        )
        variant = InventoryItemVariant.objects.create(
            item=item,
            sku="BLADE-X9-CERAMIC-HT",
            variant_name="High-Temperature Nickel Coated",
            attributes={"coating": "Thermal Barrier Coating (TBC)", "tolerance": "±0.002mm"},
        )
        self.assertEqual(item.code, "BLADE-X9-CERAMIC")
        self.assertEqual(variant.item.code, "BLADE-X9-CERAMIC")

        # ----------------------------------------------------------------------
        # STEP 2: Polymorphic File Storage Attachment (Spec Sheet & CAD Drawing)
        # ----------------------------------------------------------------------
        pdf_bytes = b"%PDF-1.4\n% Aerospace Material Certification ISO 9001\ntrailer\n<<>>\n%%EOF"
        uploaded_doc = SimpleUploadedFile("Certification_Blade_X9.pdf", pdf_bytes, content_type="application/pdf")

        stored_file = FileStorageService.upload_file(
            file_obj=uploaded_doc,
            filename="Certification_Blade_X9.pdf",
            owner_type="inventory.product",
            owner_id=item.code,
            uploaded_by="quality_lead",
            custom_metadata={"standard": "AS9100D", "rev": "C"},
        )
        self.assertTrue(StoredFile.objects.filter(id=stored_file.id).exists())
        self.assertEqual(stored_file.owner_id, "BLADE-X9-CERAMIC")
        self.assertEqual(stored_file.metadata.get("standard"), "AS9100D")

        # ----------------------------------------------------------------------
        # STEP 3: Initial Goods Receipt Posting (Receipt of 200 units @ $150.00/unit)
        # ----------------------------------------------------------------------
        rcpt_tx = StockTransaction.objects.create(
            warehouse=self.warehouse,
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            document_number="PO-AIRBUS-2026-0891",
            notes="Initial bulk receipt from forging facility",
        )
        StockTransactionLine.objects.create(
            transaction=rcpt_tx,
            item=item,
            variant=variant,
            location=self.location,
            quantity=Decimal("200.0000"),
            unit_cost=Decimal("150.0000"),
            batch_number="LOT-2026-X9-01",
        )
        posted_rcpt = InventoryPostingService.post_transaction(rcpt_tx, actor="receiving_dock_mgr")
        self.assertEqual(posted_rcpt.status, StockTransaction.Status.POSTED)

        # Invariant Verification 1: Balance & Valuation
        balance = StockBalance.objects.get(item=item, warehouse=self.warehouse, location=self.location)
        self.assertEqual(balance.on_hand_qty, Decimal("200.0000"))
        self.assertEqual(balance.reserved_qty, Decimal("0.0000"))
        self.assertEqual(balance.available_qty, Decimal("200.0000"))

        valuation = InventoryValuation.objects.get(item=item, warehouse=self.warehouse)
        self.assertEqual(valuation.total_on_hand, Decimal("200.0000"))
        self.assertEqual(valuation.weighted_average_cost, Decimal("150.0000"))
        self.assertEqual(valuation.total_value, Decimal("30000.0000"))

        # Verify Immutable Ledger
        ledger_entries = StockLedgerEntry.objects.filter(item=item, warehouse=self.warehouse)
        self.assertEqual(ledger_entries.count(), 1)
        self.assertEqual(ledger_entries.first().quantity_delta, Decimal("200.0000"))
        self.assertEqual(ledger_entries.first().balance_after, Decimal("200.0000"))

        # ----------------------------------------------------------------------
        # STEP 4: Secondary Goods Receipt (Moving Weighted-Average WAV Recalculation)
        # Receipt of 100 units @ $180.00/unit
        # Expected New WAV = (200 * 150 + 100 * 180) / (200 + 100) = (30000 + 18000) / 300 = $160.00/unit
        # ----------------------------------------------------------------------
        rcpt2_tx = StockTransaction.objects.create(
            warehouse=self.warehouse,
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            document_number="PO-AIRBUS-2026-0902",
        )
        StockTransactionLine.objects.create(
            transaction=rcpt2_tx,
            item=item,
            variant=variant,
            location=self.location,
            quantity=Decimal("100.0000"),
            unit_cost=Decimal("180.0000"),
            batch_number="LOT-2026-X9-02",
        )
        InventoryPostingService.post_transaction(rcpt2_tx, actor="receiving_dock_mgr")

        valuation.refresh_from_db()
        self.assertEqual(valuation.total_on_hand, Decimal("300.0000"))
        self.assertEqual(valuation.weighted_average_cost, Decimal("160.0000"))
        self.assertEqual(valuation.total_value, Decimal("48000.0000"))

        # ----------------------------------------------------------------------
        # STEP 5: Stock Reservation Allocation
        # Reserve 80 units for future assembly line consumption
        # Available should drop from 300 to 220, On-hand stays 300
        # ----------------------------------------------------------------------
        balance.refresh_from_db()
        reservation = StockReservation.objects.create(
            item=item,
            variant=variant,
            warehouse=self.warehouse,
            location=self.location,
            quantity=Decimal("80.0000"),
            reference_doc="WO-TURBINE-ASSY-402",
        )
        balance.reserved_qty += Decimal("80.0000")
        balance.save()

        self.assertEqual(balance.on_hand_qty, Decimal("300.0000"))
        self.assertEqual(balance.reserved_qty, Decimal("80.0000"))
        self.assertEqual(balance.available_qty, Decimal("220.0000"))

        # ----------------------------------------------------------------------
        # STEP 6: Stock Issue / Consumption
        # Issue 50 units against the reserved work order
        # On-hand drops 300 -> 250; Release 50 units from reservation (80 -> 30)
        # ----------------------------------------------------------------------
        issue_tx = StockTransaction.objects.create(
            warehouse=self.warehouse,
            transaction_type=StockTransaction.TransactionType.ISSUE,
            document_number="ISSUE-WO-402-PARTIAL",
        )
        StockTransactionLine.objects.create(
            transaction=issue_tx,
            item=item,
            variant=variant,
            location=self.location,
            quantity=Decimal("50.0000"),
            unit_cost=valuation.weighted_average_cost,
        )
        InventoryPostingService.post_transaction(issue_tx, actor="warehouse_picker")

        # Fulfill reservation quantity partially
        reservation.quantity -= Decimal("50.0000")
        reservation.save()
        balance.refresh_from_db()
        balance.reserved_qty -= Decimal("50.0000")
        balance.save()

        self.assertEqual(balance.on_hand_qty, Decimal("250.0000"))
        self.assertEqual(balance.reserved_qty, Decimal("30.0000"))
        self.assertEqual(balance.available_qty, Decimal("220.0000"))

        # ----------------------------------------------------------------------
        # STEP 7: Physical Stock Reconciliation / Count Discrepancy Cycle
        # System Snapshot: 250 units
        # Physical Counted: 248 units (Variance: -2 units)
        # Post adjustment to synchronize physical ledger
        # ----------------------------------------------------------------------
        count_cycle = StockCount.objects.create(
            warehouse=self.warehouse,
            count_number="SC-2026-OCT-001",
            status=StockCount.Status.DRAFT,
        )
        count_line = StockCountLine.objects.create(
            stock_count=count_cycle,
            item=item,
            variant=variant,
            location=self.location,
            snapshot_qty=Decimal("250.0000"),
            counted_qty=Decimal("248.0000"),
        )
        self.assertEqual(count_line.variance_qty, Decimal("-2.0000"))

        # Post adjustment transaction for the discrepancy
        adj_tx = StockTransaction.objects.create(
            warehouse=self.warehouse,
            transaction_type=StockTransaction.TransactionType.ADJUSTMENT,
            document_number=f"ADJ-COUNT-{count_cycle.count_number}",
            notes=f"Physical inventory audit variance adjustment for {count_cycle.count_number}",
        )
        StockTransactionLine.objects.create(
            transaction=adj_tx,
            item=item,
            variant=variant,
            location=self.location,
            quantity=Decimal("-2.0000"),
            unit_cost=valuation.weighted_average_cost,
        )
        InventoryPostingService.post_transaction(adj_tx, actor="inventory_controller")

        count_cycle.status = StockCount.Status.RECONCILED
        count_cycle.reconciled_by = "inventory_controller"
        count_cycle.save()

        # Final Balance Invariant Checks
        balance.refresh_from_db()
        self.assertEqual(balance.on_hand_qty, Decimal("248.0000"))
        self.assertEqual(balance.reserved_qty, Decimal("30.0000"))
        self.assertEqual(balance.available_qty, Decimal("218.0000"))

        # ----------------------------------------------------------------------
        # STEP 8: Event Bus Verification
        # Confirm that all actions emitted asynchronous domain events
        # ----------------------------------------------------------------------
        event_types = [e["type"] for e in self.published_events]
        self.assertIn("inventory.stock.receipt", event_types)
        self.assertIn("inventory.stock.issue", event_types)
        self.assertIn("inventory.stock.adjustment", event_types)
        self.assertTrue(len(self.published_events) >= 3)
