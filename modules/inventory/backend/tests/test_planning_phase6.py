from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from apps.categories.models import InventoryCategory
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.planning.models import ReorderRule, StockLevel, ReplenishmentPlan, PurchaseSuggestion

class PlanningPhase6Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = InventoryCategory.objects.create(name="Mechanical Bearings", code="CAT-BRG")
        self.warehouse = Warehouse.objects.create(
            name="Main Planning Warehouse",
            code="WH-PLAN-01",
            warehouse_type="Main Warehouse",
            address="100 Logistics Park",
            city="Metropolis",
            country="US",
            status="ACTIVE",
        )
        self.location = StorageLocation.objects.create(
            warehouse=self.warehouse,
            name="Primary Racks A",
            code="LOC-PA1",
            location_type="Storage",
            status="Active",
        )
        self.item = InventoryItem.objects.create(
            category=self.category,
            code="BRG-6205",
            name="Deep Groove Ball Bearing 6205",
            reorder_point=Decimal("15.0000"),
            reorder_quantity=Decimal("50.0000"),
            is_active=True,
        )
        self.balance = StockBalance.objects.create(
            item=self.item,
            warehouse=self.warehouse,
            location=self.location,
            on_hand_qty=Decimal("10.0000"),
            reserved_qty=Decimal("2.0000"),  # Available = 10 - 2 = 8
        )

    def test_reorder_rule_creation_and_fields(self):
        rule = ReorderRule.objects.create(
            product=self.item,
            warehouse=self.warehouse,
            reorder_point=Decimal("12.0000"),
            reorder_quantity=Decimal("60.0000"),
            lead_time_days=5,
            status="Active",
        )
        self.assertEqual(rule.sku, "BRG-6205")
        self.assertEqual(rule.product_name, "Deep Groove Ball Bearing 6205")
        self.assertEqual(rule.warehouse_name, "Main Planning Warehouse")

        # API check
        res = self.client.get("/api/v1/inventory/planning/reorder-rules/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data.get("results", res.data)), 1)

    def test_min_max_stock_level_creation(self):
        level = StockLevel.objects.create(
            product=self.item,
            warehouse=self.warehouse,
            min_stock=Decimal("10.0000"),
            max_stock=Decimal("100.0000"),
            safety_stock=Decimal("5.0000"),
        )
        self.assertEqual(level.min_stock, Decimal("10.0000"))
        self.assertEqual(level.max_stock, Decimal("100.0000"))
        self.assertEqual(level.safety_stock, Decimal("5.0000"))

        res = self.client.get("/api/v1/inventory/planning/stock-levels/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data.get("results", res.data)), 1)

    def test_replenishment_plan_and_required_quantity(self):
        # Target stock = 100, Available = 8 => Required = 92
        plan = ReplenishmentPlan.objects.create(
            product=self.item,
            warehouse=self.warehouse,
            current_stock=Decimal("10.0000"),
            reserved_stock=Decimal("2.0000"),
            available_stock=Decimal("8.0000"),
            minimum_stock=Decimal("10.0000"),
            required_quantity=Decimal("92.0000"),
            status="Pending",
        )
        self.assertTrue(plan.plan_number.startswith("PLN-"))

        # Approve action
        res = self.client.post(f"/api/v1/inventory/planning/replenishment-plans/{plan.id}/approve/")
        self.assertEqual(res.status_code, 200)
        plan.refresh_from_db()
        self.assertEqual(plan.status, "Planned")
        # Should also generate a purchase suggestion
        self.assertTrue(PurchaseSuggestion.objects.filter(product=self.item).exists())

    def test_purchase_suggestion_lifecycle_and_conversion(self):
        sug = PurchaseSuggestion.objects.create(
            product=self.item,
            warehouse=self.warehouse,
            available_stock=Decimal("8.0000"),
            reorder_point=Decimal("12.0000"),
            suggested_quantity=Decimal("60.0000"),
            supplier="Apex Industrial Supplies",
            status="Pending",
        )
        self.assertTrue(sug.suggestion_number.startswith("SUG-"))

        # Approve
        res = self.client.post(f"/api/v1/inventory/planning/purchase-suggestions/{sug.id}/approve/")
        self.assertEqual(res.status_code, 200)
        sug.refresh_from_db()
        self.assertEqual(sug.status, "Approved")

        # Convert to Purchase Request
        res_conv = self.client.post(f"/api/v1/inventory/planning/purchase-suggestions/{sug.id}/convert/")
        self.assertEqual(res_conv.status_code, 200)
        sug.refresh_from_db()
        self.assertEqual(sug.status, "Converted")
        self.assertIn("purchase_request_id", res_conv.data)

    def test_stock_forecast_calculation(self):
        # Create a ledger outbound entry
        StockLedgerEntry.objects.create(
            transaction_ref="DOC-TEST-001",
            movement_type=StockLedgerEntry.MovementType.ISSUE,
            item=self.item,
            warehouse=self.warehouse,
            quantity_delta=Decimal("-60.0000"),
            balance_after=Decimal("8.0000"),
        )
        res = self.client.get(
            f"/api/v1/inventory/planning/stock-forecast/?product={self.item.id}&warehouse={self.warehouse.id}&forecast_period=30 Days"
        )
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results", [])
        self.assertTrue(len(results) >= 1)
        fc = results[0]
        self.assertEqual(fc["sku"], "BRG-6205")
        self.assertEqual(fc["current_available_stock"], 8.0)
        self.assertGreater(fc["historical_demand"], 0)
        self.assertIn("expected_demand", fc)
        self.assertIn("projected_stock", fc)
