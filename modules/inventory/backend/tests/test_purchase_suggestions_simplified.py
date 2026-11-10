"""
Unit and Integration Tests for Simplified Purchase Suggestions System.
Tests:
1. Internal-only demand analysis & recommendation generation.
2. External provider adapter & graceful NOT_CONNECTED handling.
3. Product discovery of market opportunities not in Item Master.
4. Combined internal + external recommendation calculations.
5. Recommendation Approval, Rejection, and PR conversion workflows.
"""

from decimal import Decimal
from django.test import TestCase
from django.utils import timezone

from apps.products.models import InventoryItem
from apps.categories.models import InventoryCategory
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.planning.models import (
    ReorderRule,
    PurchaseRecommendation,
    PurchaseRecommendationItem,
    RecommendationApproval,
    ExternalMarketProduct,
    MarketTrend,
)
from apps.planning.services.market_providers.adapter import (
    ExternalProviderRegistry,
    SearchTrendsProvider,
    WholesaleMarketProvider,
)
from apps.planning.services.demand_analysis_service import DemandAnalysisService
from apps.planning.services.purchase_recommendation_service import PurchaseRecommendationService


class SimplifiedPurchaseSuggestionsTests(TestCase):
    def setUp(self):
        self.warehouse = Warehouse.objects.create(
            name="Main Test Hub",
            code="WH-TEST-01",
            is_active=True,
        )
        self.location = StorageLocation.objects.create(
            warehouse=self.warehouse,
            name="General Aisle A",
            code="LOC-A-01",
        )

        self.category = InventoryCategory.objects.create(
            name="Mechanical Components",
            code="CAT-MECH-01",
        )

        # Create sample internal products
        self.item_bearing = InventoryItem.objects.create(
            category=self.category,
            code="BRG-TEST-001",
            name="Precision Ball Bearing 6205",
            base_unit="EA",
            standard_cost=Decimal("280.0000"),
            list_price=Decimal("450.0000"),
            lead_time_days=4,
            is_active=True,
            is_purchasable=True,
        )
        self.item_valve = InventoryItem.objects.create(
            category=self.category,
            code="VLV-TEST-002",
            name="Directional Hydraulic Valve 24V",
            base_unit="EA",
            standard_cost=Decimal("1400.0000"),
            list_price=Decimal("2200.0000"),
            lead_time_days=7,
            is_active=True,
            is_purchasable=True,
        )

        # Set up stock balance
        StockBalance.objects.create(
            item=self.item_bearing,
            warehouse=self.warehouse,
            location=self.location,
            on_hand_qty=Decimal("10.0000"),
            reserved_qty=Decimal("2.0000"),
            blocked_qty=Decimal("0.0000"),
        )

        # Set up ReorderRule for bearing
        ReorderRule.objects.create(
            product=self.item_bearing,
            warehouse=self.warehouse,
            reorder_point=Decimal("30.0000"),
            reorder_quantity=Decimal("50.0000"),
            lead_time_days=4,
            status="Active",
        )

        # Create historical ledger consumption (15 EA consumed in past 30 days)
        StockLedgerEntry.objects.create(
            item=self.item_bearing,
            warehouse=self.warehouse,
            location=self.location,
            movement_type=StockLedgerEntry.MovementType.ISSUE,
            quantity_delta=Decimal("-15.0000"),
            balance_after=Decimal("10.0000"),
            unit_cost=Decimal("280.0000"),
            transaction_ref="TXN-TEST-001",
        )

    def test_provider_adapter_health(self):
        """Verifies external provider adapters report connection health cleanly."""
        health = ExternalProviderRegistry.get_providers_health()
        self.assertEqual(len(health), 2)
        codes = [h["code"] for h in health]
        self.assertIn("search_trends_in", codes)
        self.assertIn("wholesale_mandi_b2b", codes)

    def test_internal_demand_analysis(self):
        """Verifies internal business metrics computation from StockBalance and Ledger."""
        internal = DemandAnalysisService.collect_internal_data(
            product=self.item_bearing, warehouse=self.warehouse
        )
        self.assertEqual(internal["on_hand"], Decimal("10.0000"))
        self.assertEqual(internal["reserved"], Decimal("2.0000"))
        self.assertEqual(internal["available"], Decimal("8.0000"))
        self.assertEqual(internal["reorder_point"], Decimal("30.0000"))
        self.assertTrue(internal["has_reorder_trigger"])
        self.assertGreater(internal["avg_daily_demand"], Decimal("0.0000"))

    def test_external_product_discovery_without_item_master(self):
        """Verifies discovery of new products that do not exist in internal Item Master."""
        ExternalMarketProduct.objects.create(
            global_sku="EXT-DISCOVERED-999",
            title="Non-Existent Brand New Market Product",
            industry_segment="tools",
            primary_category="Hardware",
            min_market_price=Decimal("750.00"),
            search_interest_index=Decimal("89.00"),
            market_opportunity_score=Decimal("92.00"),
            raw_data={
                "supplier_name": "Discovery Wholesale Ltd",
                "availability_status": "IN_STOCK",
                "data_source": "Market Discovery Feed",
            },
        )
        opportunities = DemandAnalysisService.get_market_opportunities(limit=10)
        titles = [o["title"] for o in opportunities]
        self.assertIn("Non-Existent Brand New Market Product", titles)

    def test_recommendation_generation_combined(self):
        """Verifies complete recommendation batch generation with internal items and external discovery."""
        rec = PurchaseRecommendationService.generate_recommendations(
            warehouse_id=self.warehouse.id, user_actor="test_officer"
        )
        self.assertIsNotNone(rec)
        self.assertGreater(rec.total_items_count, 0)
        self.assertGreater(rec.total_estimated_outlay, Decimal("0.0000"))

        # Verify items contain explainable reasons
        bearing_line = rec.items.filter(product=self.item_bearing).first()
        self.assertIsNotNone(bearing_line)
        self.assertGreaterEqual(bearing_line.suggested_quantity, Decimal("50.0000"))
        self.assertIn("below reorder point", " ".join(bearing_line.recommendation_reasons))

    def test_approval_and_rejection_workflow(self):
        """Verifies auditable approval and rejection state transitions."""
        rec = PurchaseRecommendationService.generate_recommendations(
            warehouse_id=self.warehouse.id, user_actor="test_officer"
        )
        # Approve
        res_app = PurchaseRecommendationService.approve_recommendation(
            rec.id, user_actor="approver_jane", notes="Approved for immediate ordering"
        )
        self.assertTrue(res_app["success"])
        rec.refresh_from_db()
        self.assertEqual(rec.status, PurchaseRecommendation.Status.APPROVED)

        # Audit log verification
        audit = RecommendationApproval.objects.filter(recommendation=rec).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.action, RecommendationApproval.Action.APPROVED)
        self.assertEqual(audit.approver_user_id, "approver_jane")

        # Reject
        res_rej = PurchaseRecommendationService.reject_recommendation(
            rec.id, reason="Price quote too high", user_actor="manager_bob"
        )
        self.assertTrue(res_rej["success"])
        rec.refresh_from_db()
        self.assertEqual(rec.status, PurchaseRecommendation.Status.REJECTED)

    def test_convert_to_purchase_request(self):
        """Verifies converting approved recommendation to a Purchase Requisition."""
        rec = PurchaseRecommendationService.generate_recommendations(
            warehouse_id=self.warehouse.id, user_actor="test_officer"
        )
        PurchaseRecommendationService.approve_recommendation(rec.id)
        conv = PurchaseRecommendationService.convert_to_purchase_request(rec.id, user_actor="buyer_sam")
        self.assertTrue(conv["success"])
        self.assertTrue(conv["purchase_request_reference"].startswith("PR-"))
        rec.refresh_from_db()
        self.assertEqual(rec.status, PurchaseRecommendation.Status.CONVERTED)
