from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.categories.models import InventoryCategory
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance
from apps.movements.models import StockTransaction
from apps.reconciliation.models import StockCount, CycleCount, FullStockCount, AuditHistory


class PhysicalAuditPhase7Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = InventoryCategory.objects.create(name="Mechanical Components", code="MECH-COMP")
        self.warehouse = Warehouse.objects.create(
            name="Main Logistics Center",
            code="WH-MAIN",
            address="100 Logistics Way",
            city="Atlanta",
            country="United States",
            is_active=True,
        )
        self.location = StorageLocation.objects.create(
            warehouse=self.warehouse,
            name="Aisle 1 Storage",
            code="LOC-A1",
            location_type="Storage",
            is_active=True,
        )
        self.item = InventoryItem.objects.create(
            category=self.category,
            name="Flange Bearing 30mm",
            code="BRG-FL-30",
            is_active=True,
        )
        self.balance = StockBalance.objects.create(
            warehouse=self.warehouse,
            location=self.location,
            item=self.item,
            on_hand_qty=Decimal("100.0000"),
            reserved_qty=Decimal("0.0000"),
        )

    def test_physical_stock_count_snapshot_and_difference(self):
        """Rule 1 & 3: Snapshot system quantity captured and Difference = Physical - System."""
        payload = {
            "warehouse": self.warehouse.id,
            "product": self.item.id,
            "storage_location": self.location.id,
            "physical_quantity": "108.0000",
            "remarks": "Annual inventory audit count",
        }
        res = self.client.post("/api/v1/inventory/audit/stock-counts/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data
        self.assertTrue(data["count_number"].startswith("CNT-"))
        self.assertEqual(Decimal(str(data["system_quantity"])), Decimal("100.0000"))
        self.assertEqual(Decimal(str(data["physical_quantity"])), Decimal("108.0000"))
        # Difference = Physical - System: 108 - 100 = +8.0000
        self.assertEqual(Decimal(str(data["difference_quantity"])), Decimal("8.0000"))
        self.assertEqual(data["status"], "DRAFT")

        # Submit count
        count_id = data["id"]
        sub_res = self.client.post(f"/api/v1/inventory/audit/stock-counts/{count_id}/submit/")
        self.assertEqual(sub_res.status_code, status.HTTP_200_OK)
        self.assertEqual(sub_res.data["status"], "SUBMITTED")

    def test_stock_variance_approval_and_adjustment_generation(self):
        """Rule 4, 5, 6 & 7: Review, approve, generate adjustment through StockTransaction, never direct balance write."""
        count = StockCount.objects.create(
            count_number="CNT-2026-9001",
            warehouse=self.warehouse,
            location=self.location,
            item=self.item,
            system_quantity=Decimal("100.0000"),
            physical_quantity=Decimal("92.0000"),  # Shortage of 8 units
            difference_quantity=Decimal("-8.0000"),
            variance_reason="Missing Stock",
            status=StockCount.Status.SUBMITTED,
            counted_by="John Counter",
            verified_by="Jane Auditor",
        )

        # 1. Review
        rev_res = self.client.post(f"/api/v1/inventory/audit/stock-counts/{count.id}/review/")
        self.assertEqual(rev_res.status_code, status.HTTP_200_OK)
        self.assertEqual(rev_res.data["status"], "PENDING")

        # 2. Approve
        app_res = self.client.post(f"/api/v1/inventory/audit/stock-counts/{count.id}/approve/")
        self.assertEqual(app_res.status_code, status.HTTP_200_OK)
        self.assertEqual(app_res.data["status"], "APPROVED")

        # 3. Generate Stock Adjustment
        adj_res = self.client.post(f"/api/v1/inventory/audit/stock-counts/{count.id}/generate_adjustment/")
        self.assertEqual(adj_res.status_code, status.HTTP_200_OK)
        self.assertEqual(adj_res.data["status"], "ADJUSTED")

        # Verify transaction generated and balance adjusted through audited transaction
        count.refresh_from_db()
        self.assertIsNotNone(count.adjustment_transaction)
        self.assertEqual(count.adjustment_transaction.adjustment_type, "Decrease")
        self.balance.refresh_from_db()
        self.assertEqual(self.balance.on_hand_qty, Decimal("92.0000"))

        # Verify AuditHistory recorded
        audit = AuditHistory.objects.filter(count_number=count.count_number).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.status, "Completed")
        self.assertEqual(audit.variance_count, 1)

    def test_cycle_count_scheduling_and_entry_generation(self):
        """Cycle count creation with frequency and automated count entries generation."""
        cycle = CycleCount.objects.create(
            count_number="CYC-2026-0010",
            warehouse=self.warehouse,
            storage_location=self.location,
            product=self.item,
            count_frequency=CycleCount.Frequency.WEEKLY,
            assigned_to="Dave Specialist",
            status=CycleCount.Status.SCHEDULED,
        )
        self.assertEqual(cycle.warehouse_name, "Main Logistics Center")

        # Generate count entries action
        res = self.client.post(f"/api/v1/inventory/audit/cycle-counts/{cycle.id}/generate_count_entries/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["entries_generated"], 1)

        cycle.refresh_from_db()
        self.assertEqual(cycle.status, "In Progress")

        # Check the generated StockCount
        entry = StockCount.objects.filter(cycle_count=cycle).first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.count_type, StockCount.CountType.CYCLE)
        self.assertEqual(entry.system_quantity, Decimal("100.0000"))

    def test_full_stock_count_and_warehouse_scope(self):
        """Full count creation with include_all_locations and batch entries generation."""
        # Create second item in same warehouse
        item2 = InventoryItem.objects.create(
            category=self.category,
            name="V-Belt B52",
            code="BELT-B52",
            is_active=True,
        )
        StockBalance.objects.create(
            warehouse=self.warehouse,
            location=self.location,
            item=item2,
            on_hand_qty=Decimal("50.0000"),
            reserved_qty=Decimal("0.0000"),
        )

        full = FullStockCount.objects.create(
            count_number="FSC-2026-0005",
            warehouse=self.warehouse,
            include_all_locations=True,
            assigned_to="Sarah Chief Auditor",
            status=FullStockCount.Status.INITIATED,
        )

        res = self.client.post(f"/api/v1/inventory/audit/full-counts/{full.id}/generate_count_entries/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["entries_generated"], 2)

        full.refresh_from_db()
        self.assertEqual(full.status, "Counting")

        count_entries = StockCount.objects.filter(full_count=full)
        self.assertEqual(count_entries.count(), 2)

    def test_audit_history_records_and_api(self):
        """Audit history maintains permanent record of completed physical counts."""
        audit = AuditHistory.objects.create(
            count_number="CNT-2026-7788",
            warehouse=self.warehouse,
            counted_by="Alex Counter",
            verified_by="Maria Lead Auditor",
            total_products_counted=25,
            variance_count=2,
            status=AuditHistory.Status.COMPLETED,
            notes="End of month comprehensive audit",
        )
        self.assertTrue(audit.audit_number.startswith("AUD-"))

        res = self.client.get("/api/v1/inventory/audit/history/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", res.data)
        self.assertTrue(any(a["count_number"] == "CNT-2026-7788" for a in results))
