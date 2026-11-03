from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.categories.models import InventoryCategory
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation, WarehouseConfiguration
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.batches.models import Batch
from apps.planning.models import ReorderRule


class ReportsPhase8Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = InventoryCategory.objects.create(name="Mechanical Drives", code="DRIVES")
        self.warehouse = Warehouse.objects.create(
            name="Central Alpha Hub",
            code="WH-ALPHA",
            address="500 Industrial Pkwy",
            city="Chicago",
            country="United States",
            is_active=True,
        )
        self.location = StorageLocation.objects.create(
            warehouse=self.warehouse,
            name="Zone 1 Picking",
            code="LOC-Z1",
            location_type="Storage",
            is_active=True,
        )
        self.item = InventoryItem.objects.create(
            category=self.category,
            name="Heavy Duty Spur Gear 40T",
            code="GEAR-SP-40",
            is_active=True,
        )
        self.balance = StockBalance.objects.create(
            warehouse=self.warehouse,
            location=self.location,
            item=self.item,
            on_hand_qty=Decimal("120.0000"),
            reserved_qty=Decimal("20.0000"),
            blocked_qty=Decimal("5.0000"),
        )
        # Configure valuation method
        WarehouseConfiguration.objects.create(
            default_warehouse=self.warehouse,
            valuation_method="WAV",
        )

    def test_stock_summary_report(self):
        """1. Stock Summary Report returns product, SKU, warehouse, physical, reserved, available, damaged stock, and status."""
        res = self.client.get("/api/v1/inventory/reports/stock-summary/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", [])
        self.assertTrue(len(results) >= 1)
        rec = next(r for r in results if r["sku"] == "GEAR-SP-40")
        self.assertEqual(rec["product_name"], "Heavy Duty Spur Gear 40T")
        self.assertEqual(rec["total_stock"], 120.0)
        self.assertEqual(rec["reserved_stock"], 20.0)
        self.assertEqual(rec["damaged_stock"], 5.0)
        # Available = 120 - 20 - 5 = 95
        self.assertEqual(rec["available_stock"], 95.0)
        self.assertEqual(rec["stock_status"], "In Stock")

    def test_stock_movement_and_ledger_reports(self):
        """2 & 3. Stock Movement & Ledger reports read append-only movements and running balances."""
        StockLedgerEntry.objects.create(
            item=self.item,
            warehouse=self.warehouse,
            location=self.location,
            movement_type=StockLedgerEntry.MovementType.RECEIPT,
            quantity_delta=Decimal("50.0000"),
            balance_after=Decimal("120.0000"),
            unit_cost=Decimal("22.50"),
            transaction_ref="REC-2026-8801",
        )

        # Stock Movement Report
        mov_res = self.client.get("/api/v1/inventory/reports/stock-movement/")
        self.assertEqual(mov_res.status_code, status.HTTP_200_OK)
        mov_results = mov_res.data.get("results", [])
        self.assertTrue(any(r["transaction_number"] == "REC-2026-8801" for r in mov_results))

        # Stock Ledger Report
        led_res = self.client.get("/api/v1/inventory/reports/stock-ledger/")
        self.assertEqual(led_res.status_code, status.HTTP_200_OK)
        led_results = led_res.data.get("results", [])
        self.assertTrue(any(r["running_balance"] == 120.0 for r in led_results))

    def test_stock_valuation_report(self):
        """4. Stock Valuation Report calculates Total Stock Value using configured valuation method."""
        res = self.client.get("/api/v1/inventory/reports/valuation/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", [])
        rec = next(r for r in results if r["sku"] == "GEAR-SP-40")
        self.assertEqual(rec["stock_quantity"], 120.0)
        self.assertTrue(rec["total_stock_value"] > 0)
        self.assertEqual(rec["valuation_method"], "Weighted Average Cost")

    def test_low_stock_report(self):
        """5. Low Stock Report identifies products reaching reorder levels."""
        ReorderRule.objects.create(
            product=self.item,
            warehouse=self.warehouse,
            reorder_point=Decimal("100.0000"),  # Avail is 95, so 95 <= 100 triggers Low Stock
            reorder_quantity=Decimal("60.0000"),
            status="Active",
        )
        res = self.client.get("/api/v1/inventory/reports/low-stock/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", [])
        self.assertTrue(any(r["sku"] == "GEAR-SP-40" for r in results))

    def test_stock_ageing_report(self):
        """6. Stock Ageing Report calculates age in days and buckets based on receipt/batch date."""
        today = timezone.localdate()
        Batch.objects.create(
            batch_number="BAT-GEAR-01",
            item=self.item,
            warehouse=self.warehouse,
            initial_quantity=Decimal("30.0000"),
            remaining_quantity=Decimal("30.0000"),
            received_date=today - timedelta(days=45),
            batch_status="Released",
        )
        res = self.client.get("/api/v1/inventory/reports/ageing/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", [])
        rec = next(r for r in results if r["batch_number"] == "BAT-GEAR-01")
        self.assertEqual(rec["ageing_bucket"], "31–60 days")
        self.assertEqual(rec["age_in_days"], 45)

    def test_expiry_report(self):
        """7. Expiry Report filters batches approaching or past expiry date."""
        today = timezone.localdate()
        Batch.objects.create(
            batch_number="BAT-EXP-NEAR",
            item=self.item,
            warehouse=self.warehouse,
            initial_quantity=Decimal("10.0000"),
            remaining_quantity=Decimal("10.0000"),
            expiry_date=today + timedelta(days=12),
            batch_status="Released",
        )
        res = self.client.get("/api/v1/inventory/reports/expiry/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", [])
        rec = next(r for r in results if r["batch_number"] == "BAT-EXP-NEAR")
        self.assertEqual(rec["expiry_status"], "Expiring Soon")
        self.assertEqual(rec["days_to_expiry"], 12)

    def test_warehouse_report(self):
        """8. Warehouse Report compares total stock, products, and value across warehouses."""
        res = self.client.get("/api/v1/inventory/reports/warehouse/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", [])
        rec = next(r for r in results if r["warehouse"] == "Central Alpha Hub")
        self.assertEqual(rec["total_stock"], 120.0)
        self.assertEqual(rec["available_stock"], 95.0)
        self.assertEqual(rec["reserved_stock"], 20.0)
        self.assertEqual(rec["damaged_stock"], 5.0)
