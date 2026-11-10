from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.categories.models import InventoryCategory
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry, StockInTransit
from apps.planning.models import (
    ReorderRule,
    StockLevel,
    PurchaseSuggestion,
    SupplierProductProfile,
    MarketIntelligenceRecord,
    IndustrySeasonalRule,
)
from apps.planning.services import (
    CalculationEngineService,
    DemandIntelligenceService,
    SupplierIntelligenceService,
    MultiWarehouseService,
    OverstockPreventionService,
    MarketIntelligenceService,
    SeasonalPlannerService,
    RiskAnalysisService,
    WhatIfSimulatorService,
    RecommendationOrchestrator,
)


class IntelligentPurchaseIntelligenceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = InventoryCategory.objects.create(name="Automotive Components", code="CAT-AUTO")
        self.warehouse_primary = Warehouse.objects.create(
            name="Chennai Central Hub",
            code="WH-CHN-01",
            warehouse_type="Central",
            city="Chennai",
            country="IN",
            status="ACTIVE",
        )
        self.warehouse_secondary = Warehouse.objects.create(
            name="Coimbatore Regional Depot",
            code="WH-CBE-01",
            warehouse_type="Depot",
            city="Coimbatore",
            country="IN",
            status="ACTIVE",
        )
        self.loc_primary = StorageLocation.objects.create(
            warehouse=self.warehouse_primary,
            name="Aisle 1",
            code="LOC-CHN-A1",
            location_type="Storage",
            status="Active",
        )
        self.loc_secondary = StorageLocation.objects.create(
            warehouse=self.warehouse_secondary,
            name="Bay 1",
            code="LOC-CBE-B1",
            location_type="Storage",
            status="Active",
        )

        # Product 1: Low stock, triggers replenishment
        self.item_bearing = InventoryItem.objects.create(
            category=self.category,
            code="PART-BRG-200",
            name="Heavy Duty Roller Bearing 200",
            reorder_point=Decimal("25.0000"),
            reorder_quantity=Decimal("60.0000"),
            min_order_qty=Decimal("20.0000"),
            lead_time_days=10,
            standard_cost=Decimal("150.0000"),
            is_active=True,
        )

        # Balances: Available = 10 - 2 = 8
        StockBalance.objects.create(
            item=self.item_bearing,
            warehouse=self.warehouse_primary,
            location=self.loc_primary,
            on_hand_qty=Decimal("10.0000"),
            reserved_qty=Decimal("2.0000"),
            quarantined_qty=Decimal("0.0000"),
            damaged_qty=Decimal("0.0000"),
        )

    # 1. Calculation Engine Tests
    def test_stock_profile_accurate_deductions(self):
        # Add damaged & quarantined stock
        bal = StockBalance.objects.get(item=self.item_bearing, warehouse=self.warehouse_primary)
        bal.quarantined_qty = Decimal("1.0000")
        bal.damaged_qty = Decimal("1.0000")
        bal.save()

        profile = CalculationEngineService.get_stock_profile(self.item_bearing, self.warehouse_primary)
        # On-hand: 10, Reserved: 2, Quarantined: 1, Damaged: 1 => Available = 10 - 2 - 1 - 1 = 6
        self.assertEqual(profile["available_stock"], 6.0)

    # 2. Demand Intelligence Tests
    def test_demand_intelligence_ledger_derivation(self):
        # Create historical outbound ledger entries
        StockLedgerEntry.objects.create(
            transaction_ref="ISSUE-01",
            movement_type=StockLedgerEntry.MovementType.ISSUE,
            item=self.item_bearing,
            warehouse=self.warehouse_primary,
            quantity_delta=Decimal("-90.0000"),
            balance_after=Decimal("10.0000"),
        )
        demand = DemandIntelligenceService.analyze_demand(self.item_bearing, self.warehouse_primary)
        self.assertTrue(demand["is_sufficient_data"])
        self.assertGreater(demand["average_daily_demand"], 0)
        self.assertIn("forecast_30d", demand)

    # 3. Multi-Warehouse Optimization Tests
    def test_multi_warehouse_transfer_opportunity(self):
        # Put surplus at secondary warehouse: 200 on hand, reorder point 20 => surplus = 180
        StockBalance.objects.create(
            item=self.item_bearing,
            warehouse=self.warehouse_secondary,
            location=self.loc_secondary,
            on_hand_qty=Decimal("200.0000"),
            reserved_qty=Decimal("0.0000"),
        )
        transfer_eval = MultiWarehouseService.evaluate_inter_warehouse_transfers(
            product=self.item_bearing,
            destination_warehouse=self.warehouse_primary,
            required_quantity=50.0,
        )
        self.assertTrue(transfer_eval["transfer_feasible"])
        self.assertEqual(transfer_eval["best_source_warehouse_id"], self.warehouse_secondary.id)
        self.assertEqual(transfer_eval["transferable_quantity"], 50.0)

    # 4. Supplier Intelligence Tests
    def test_supplier_intelligence_evaluation(self):
        # Supplier A: Cheaper unit price but slow & lower reliability
        SupplierProductProfile.objects.create(
            supplier_name="Budget Parts Co",
            product=self.item_bearing,
            unit_price=Decimal("120.0000"),
            lead_time_days=25,
            on_time_delivery_rate=Decimal("75.00"),
            quality_acceptance_rate=Decimal("92.00"),
        )
        # Supplier B: Slightly higher price, fast & 99% on-time
        SupplierProductProfile.objects.create(
            supplier_name="Premium Fasteners Ltd",
            product=self.item_bearing,
            unit_price=Decimal("125.0000"),
            lead_time_days=5,
            on_time_delivery_rate=Decimal("99.00"),
            quality_acceptance_rate=Decimal("99.50"),
            is_preferred=True,
        )

        sup_intel = SupplierIntelligenceService.evaluate_suppliers(self.item_bearing, required_qty=60.0)
        self.assertTrue(sup_intel["has_profiles"])
        self.assertEqual(len(sup_intel["options"]), 2)
        # Selected preferred supplier with balanced score
        self.assertIn("Premium Fasteners", sup_intel["preferred_supplier"])

    # 5. Overstock Prevention Tests
    def test_overstock_prevention_capping(self):
        reorder_params = {"max_stock": 100.0, "reorder_point": 25.0}
        stock_profile = {"available_stock": 70.0, "incoming_purchase_qty": 0.0, "in_transit_transfer_qty": 0.0}
        # Proposing to buy 80 units would reach 150 > max_stock 100
        overstock = OverstockPreventionService.evaluate_overstock_risk(
            stock_profile=stock_profile,
            reorder_params=reorder_params,
            daily_demand=1.0,
            proposed_quantity=80.0,
        )
        self.assertTrue(overstock["is_overstock_risk"])
        self.assertEqual(overstock["recommended_capped_quantity"], 30.0)

    # 6. Market & Seasonal Intelligence Tests
    def test_market_and_seasonal_intelligence(self):
        MarketIntelligenceRecord.objects.create(
            category="Automotive",
            commodity_or_sku="PART-BRG-200",
            current_index_value=Decimal("142.5000"),
            price_change_pct_30d=Decimal("4.50"),
            trend_direction="INCREASING",
        )
        mkt = MarketIntelligenceService.get_market_intelligence(self.item_bearing)
        self.assertTrue(mkt["is_available"])
        self.assertEqual(mkt["trend_direction"], "INCREASING")

        # Seasonal
        IndustrySeasonalRule.objects.create(
            season_name="Pre-Monsoon Fleet Overhaul",
            industry_category="Automotive",
            start_month=1,
            end_month=12,
            demand_multiplier=Decimal("1.30"),
        )
        seas = SeasonalPlannerService.evaluate_seasonality(self.item_bearing)
        self.assertTrue(seas["has_active_season"])
        self.assertEqual(seas["demand_multiplier"], 1.3)

    # 7. What-If Simulator Tests (In-Memory, Non-Destructive)
    def test_what_if_simulator_isolation(self):
        base_stock_profile = {"available_stock": 10.0, "incoming_purchase_qty": 0.0, "in_transit_transfer_qty": 0.0}
        base_demand_intel = {"average_daily_demand": 2.0}
        base_reorder_params = {"lead_time_days": 5, "max_stock": 150.0}

        sim_res = WhatIfSimulatorService.simulate_scenario(
            base_stock_profile=base_stock_profile,
            base_demand_intel=base_demand_intel,
            base_reorder_params=base_reorder_params,
            simulated_quantity=100.0,
            simulated_unit_price=50.0,
        )
        self.assertTrue(sim_res["is_simulation"])
        self.assertEqual(sim_res["total_investment"], 5000.0)
        self.assertEqual(sim_res["simulated_quantity"], 100.0)
        # Check actual database unchanged
        bal = StockBalance.objects.get(item=self.item_bearing, warehouse=self.warehouse_primary)
        self.assertEqual(bal.on_hand_qty, Decimal("10.0000"))

    # 8. Full End-to-End Recommendation Engine Generation & API Endpoints
    def test_recommendation_generation_lifecycle_api(self):
        # Call generate endpoint
        res_gen = self.client.post("/api/v1/inventory/planning/purchase-suggestions/generate/")
        self.assertEqual(res_gen.status_code, 200)
        self.assertGreaterEqual(res_gen.data["created_count"] + res_gen.data["updated_count"], 1)

        # Fetch list
        res_list = self.client.get("/api/v1/inventory/planning/purchase-suggestions/")
        self.assertEqual(res_list.status_code, 200)
        suggestions = res_list.data.get("results", res_list.data)
        self.assertTrue(len(suggestions) >= 1)
        sug = suggestions[0]

        # Verify intelligence attributes are present
        self.assertIn("priority", sug)
        self.assertIn("confidence_score", sug)
        self.assertIn("explanation", sug)
        self.assertIn("calculation_breakdown", sug)
        self.assertIn("demand_intelligence", sug)
        self.assertIn("risk_analysis", sug)

        sug_id = sug["id"]

        # Test What-If Simulator API endpoint
        res_sim = self.client.post(
            f"/api/v1/inventory/planning/purchase-suggestions/{sug_id}/simulate/",
            {"simulated_quantity": 120.0, "simulated_unit_price": 95.0},
            format="json"
        )
        self.assertEqual(res_sim.status_code, 200)
        self.assertTrue(res_sim.data["is_simulation"])
        self.assertEqual(res_sim.data["total_investment"], 11400.0)

        # Test Approve
        res_app = self.client.post(f"/api/v1/inventory/planning/purchase-suggestions/{sug_id}/approve/")
        self.assertEqual(res_app.status_code, 200)
        self.assertEqual(res_app.data["status"], "Approved")

        # Test Convert to Purchase Request
        res_conv = self.client.post(f"/api/v1/inventory/planning/purchase-suggestions/{sug_id}/convert/")
        self.assertEqual(res_conv.status_code, 200)
        self.assertEqual(res_conv.data["status"], "Converted")
        self.assertIn("PR-", res_conv.data["purchase_request_id"])

        # Idempotent second convert returns existing PR id without duplicating
        res_conv2 = self.client.post(f"/api/v1/inventory/planning/purchase-suggestions/{sug_id}/convert/")
        self.assertEqual(res_conv2.status_code, 200)
        self.assertEqual(res_conv2.data["purchase_request_id"], res_conv.data["purchase_request_id"])

