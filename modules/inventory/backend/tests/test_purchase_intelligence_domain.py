import pytest
from decimal import Decimal
from django.utils import timezone

from apps.products.models import InventoryItem
from apps.categories.models import InventoryCategory
from apps.warehouses.models import Warehouse
from apps.stock.models import StockBalance
from apps.planning.models import (
    ReplenishmentPolicy,
    RecommendationConfiguration,
    PurchaseRecommendation,
    PurchaseRecommendationItem,
    BusinessProfile,
)
from apps.planning.purchase_intelligence.domain.internal.position_service import PositionAnalysisService
from apps.planning.purchase_intelligence.domain.forecasting.forecasting_engine import DemandForecastingEngine
from apps.planning.purchase_intelligence.domain.forecasting.replenishment_targets import ReplenishmentIntelligenceService
from apps.planning.purchase_intelligence.domain.suppliers.mcdm_evaluator import SupplierMCDMEvaluator
from apps.planning.purchase_intelligence.domain.multi_warehouse.transfer_optimizer import TransferOptimizationService
from apps.planning.purchase_intelligence.domain.suitability.business_fit import BusinessSuitabilityEngine
from apps.planning.purchase_intelligence.domain.engine.eight_category_classifier import (
    EightCategoryClassifier,
    RecommendationCategory,
)
from apps.planning.purchase_intelligence.domain.engine.recommendation_generator import (
    PurchaseIntelligenceOrchestrator,
)
from apps.planning.purchase_intelligence.domain.engine.simulator import ScenarioSimulatorService
from apps.planning.purchase_intelligence.providers.google_trends_adapter import GoogleTrendsAdapter
from apps.planning.purchase_intelligence.providers.amazon_adapter import AmazonMarketplaceAdapter
from apps.planning.purchase_intelligence.providers.mandi_adapter import MandiMarketAdapter
from apps.planning.purchase_intelligence.tasks.batch_evaluation_tasks import (
    evaluate_warehouse_recommendations_task,
    nightly_batch_evaluation_job,
)


@pytest.fixture
def domain_fixtures():
    cat, _ = InventoryCategory.objects.get_or_create(code="CAT-DOMAIN", defaults={"name": "Domain Test Category"})
    wh1 = Warehouse.objects.create(name="Primary Depot", code="WH-DOM-01", city="Chennai")
    wh2 = Warehouse.objects.create(name="Secondary Depot", code="WH-DOM-02", city="Coimbatore")
    return {"cat": cat, "wh1": wh1, "wh2": wh2}


# ============================================================================
# 1. Verification of the 8 Distinct Recommendation Categories
# ============================================================================
def test_eight_category_classifier_all_eight_branches():
    # 1. Existing Product Replenishment
    res1 = EightCategoryClassifier.classify(
        is_catalog_item=True,
        net_position=Decimal("10.0"),
        reorder_point=Decimal("25.0"),
        target_stock=Decimal("60.0"),
        days_of_supply=3.5,
    )
    assert res1["category"] == RecommendationCategory.REPLENISHMENT
    assert res1["action"] == "PURCHASE"

    # 2. New Product Discovery (External item passing suitability)
    res2 = EightCategoryClassifier.classify(
        is_catalog_item=False,
        net_position=Decimal("0.0"),
        reorder_point=Decimal("0.0"),
        target_stock=Decimal("0.0"),
        days_of_supply=0.0,
        suitability_eval={"suitability_score": Decimal("78.00"), "suitability_status": "EXCELLENT_FIT"},
    )
    assert res2["category"] == RecommendationCategory.NEW_PRODUCT
    assert res2["action"] == "CATALOG_ADD_AND_PURCHASE"

    # 3. Trending Product Opportunity (High search velocity & interest index)
    res3 = EightCategoryClassifier.classify(
        is_catalog_item=False,
        net_position=Decimal("0.0"),
        reorder_point=Decimal("0.0"),
        target_stock=Decimal("0.0"),
        days_of_supply=0.0,
        market_intel={"growth_4w_pct": 34.5, "search_index": 88.0},
        suitability_eval={"suitability_score": Decimal("72.00"), "suitability_status": "GOOD_FIT"},
    )
    assert res3["category"] == RecommendationCategory.TRENDING
    assert res3["action"] == "DISCOVER_AND_TEST"

    # 4. Seasonal & Festival Surge Planning
    res4 = EightCategoryClassifier.classify(
        is_catalog_item=True,
        net_position=Decimal("20.0"),
        reorder_point=Decimal("30.0"),
        target_stock=Decimal("80.0"),
        days_of_supply=10.0,
        seasonal_multiplier=1.35,
    )
    assert res4["category"] == RecommendationCategory.SEASONAL
    assert res4["action"] == "SEASONAL_PRE_ORDER"

    # 5. Supplier and Price Opportunity (Price arbitrage / discount)
    res5 = EightCategoryClassifier.classify(
        is_catalog_item=True,
        net_position=Decimal("15.0"),
        reorder_point=Decimal("20.0"),
        target_stock=Decimal("50.0"),
        days_of_supply=8.0,
        supplier_intel={"cost_saving_opportunity": 14.5},
    )
    assert res5["category"] == RecommendationCategory.PRICE_OPPORTUNITY
    assert res5["action"] == "OPPORTUNISTIC_BUY"

    # 6. Inter-Warehouse Stock Transfer
    res6 = EightCategoryClassifier.classify(
        is_catalog_item=True,
        net_position=Decimal("5.0"),
        reorder_point=Decimal("20.0"),
        target_stock=Decimal("50.0"),
        days_of_supply=2.0,
        transfer_eval={"transfer_feasible": True, "transferable_quantity": Decimal("40.0")},
    )
    assert res6["category"] == RecommendationCategory.TRANSFER
    assert res6["action"] == "INTERNAL_TRANSFER"

    # 7. Excess Stock Avoidance (HOLD)
    res7 = EightCategoryClassifier.classify(
        is_catalog_item=True,
        net_position=Decimal("250.0"),
        reorder_point=Decimal("30.0"),
        target_stock=Decimal("50.0"),
        days_of_supply=140.0,
    )
    assert res7["category"] == RecommendationCategory.HOLD
    assert res7["action"] == "HOLD"

    # 8. Purchase Delay Recommendation (Price falling & adequate coverage)
    res8 = EightCategoryClassifier.classify(
        is_catalog_item=True,
        net_position=Decimal("45.0"),
        reorder_point=Decimal("30.0"),
        target_stock=Decimal("60.0"),
        days_of_supply=28.0,
        price_trend="FALLING",
        market_intel={"price_drop_pct": 12.0},
    )
    assert res8["category"] == RecommendationCategory.DELAY
    assert res8["action"] == "DELAY"


# ============================================================================
# 2. Verification of Business Suitability Engine
# ============================================================================
@pytest.mark.django_db
def test_business_suitability_evaluator():
    profile = BusinessSuitabilityEngine.get_or_create_default_profile()
    profile.min_expected_gross_margin_pct = Decimal("20.00")
    profile.procurement_budget = Decimal("100000.00")
    profile.restricted_categories = ["Hazardous Chemicals", "Explosives"]
    profile.preferred_categories = ["Edible Oils", "Grains & Pulses"]
    profile.save()

    # Case A: Restricted category -> Immediate NOT_SUITABLE
    eval_restr = BusinessSuitabilityEngine.evaluate_suitability(
        category="Hazardous Chemicals and Solvents",
        estimated_retail_price=Decimal("500.0"),
        estimated_landed_cost=Decimal("200.0"),
        profile=profile,
    )
    assert eval_restr["suitability_status"] == "NOT_SUITABLE"
    assert eval_restr["suitability_score"] == Decimal("0.00")

    # Case B: Preferred category with healthy margin -> EXCELLENT_FIT
    eval_good = BusinessSuitabilityEngine.evaluate_suitability(
        category="Edible Oils",
        industry_code="retail_supermarket",
        estimated_retail_price=Decimal("400.0"),
        estimated_landed_cost=Decimal("250.0"),  # 37.5% margin > 20% hurdle
        purchase_quantity=Decimal("50.0"),
        profile=profile,
    )
    assert eval_good["suitability_status"] in ["EXCELLENT_FIT", "GOOD_FIT"]
    assert eval_good["suitability_score"] >= Decimal("70.00")

    # Case C: Exceeding budget -> Budget headroom penalty
    eval_budget = BusinessSuitabilityEngine.evaluate_suitability(
        category="Industrial Hardware",
        estimated_retail_price=Decimal("2000.0"),
        estimated_landed_cost=Decimal("1500.0"),
        purchase_quantity=Decimal("100.0"),  # 150,000 outlay > 100,000 budget
        profile=profile,
    )
    assert eval_budget["breakdown"]["budget_headroom"]["passed"] is False


# ============================================================================
# 3. Verification of External Market Data Provider Adapters
# ============================================================================
def test_external_market_adapters():
    # Google Trends Adapter
    gt = GoogleTrendsAdapter()
    h_gt = gt.check_health()
    assert h_gt["status"] == "HEALTHY"
    trend = gt.get_trend_indicator("electronics")
    assert trend["search_index"] > 0
    assert trend["signal_type"] == "CONSUMER_SEARCH_INTEREST"

    # Amazon Marketplace Adapter
    amz = AmazonMarketplaceAdapter()
    h_amz = amz.check_health()
    assert h_amz["status"] == "HEALTHY"
    products = amz.discover_products("retail_supermarket")
    assert len(products) > 0
    offers = amz.get_supplier_offers(products[0]["external_id"])
    assert len(offers) > 0
    assert offers[0]["landed_cost_unit"] > 0

    # Wholesale Mandi Adapter
    mandi = MandiMarketAdapter()
    h_mandi = mandi.check_health()
    assert h_mandi["status"] == "HEALTHY"
    mandi_items = mandi.discover_products("retail_supermarket")
    assert len(mandi_items) > 0
    assert mandi_items[0]["modal_price_per_kg"] > 0


# ============================================================================
# 4. Verification of Multi-Warehouse Transfer Optimization
# ============================================================================
@pytest.mark.django_db
def test_multi_warehouse_transfer_optimizer(domain_fixtures):
    wh_dest = domain_fixtures["wh1"]
    wh_src = domain_fixtures["wh2"]
    item = InventoryItem.objects.create(
        code="SKU-XFER-01",
        name="Precision Bearings",
        category=domain_fixtures["cat"],
        reorder_point=Decimal("20.0000"),
        is_active=True,
        is_purchasable=True,
    )

    # Destination has 0
    StockBalance.objects.create(item=item, warehouse=wh_dest, on_hand_qty=Decimal("0.0000"))

    # Source has 150, safe floor is 30 -> 120 surplus
    StockBalance.objects.create(item=item, warehouse=wh_src, on_hand_qty=Decimal("150.0000"))
    ReplenishmentPolicy.objects.create(
        name="Bearings Source Policy",
        product=item,
        warehouse=wh_src,
        min_stock_level=Decimal("30.0000"),
    )

    result = TransferOptimizationService.evaluate_inter_warehouse_transfers(
        product=item,
        destination_warehouse=wh_dest,
        required_quantity=Decimal("50.0000"),
    )

    assert result["transfer_feasible"] is True
    assert result["best_source_warehouse"] == wh_src
    assert result["transferable_quantity"] == Decimal("50.0000")
    assert "Inter-warehouse transfer recommended" in result["reason"]


# ============================================================================
# 5. Verification of Non-Destructive What-If Simulation Sandbox
# ============================================================================
def test_scenario_simulator_service():
    sim = ScenarioSimulatorService.simulate(
        base_stock_profile={"available_stock": 25.0, "incoming_stock": 10.0},
        base_demand_intel={"average_daily_demand": 5.0},
        base_reorder_params={"lead_time_days": 4, "unit_cost": 120.0, "max_stock": 100.0},
        simulated_quantity=50.0,
    )

    assert sim["is_simulation"] is True
    assert sim["total_investment"] == 6000.0  # 50 * 120
    assert sim["days_to_stockout"] == 5.0     # 25 / 5
    assert sim["is_stockout_before_arrival"] is False
    assert sim["stock_after_replenishment"] == 65.0  # (25 - 20) + 10 + 50
    assert sim["stock_health"] == "BALANCED"
    assert len(sim["timeline"]) == 5


# ============================================================================
# 6. Verification of Background Task Execution
# ============================================================================
@pytest.mark.django_db
def test_background_batch_evaluation_tasks(domain_fixtures):
    wh = domain_fixtures["wh1"]
    item = InventoryItem.objects.create(
        code="SKU-TASK-01",
        name="Copper Wire Spool",
        category=domain_fixtures["cat"],
        reorder_point=Decimal("40.0000"),
        standard_cost=Decimal("200.0000"),
        is_active=True,
        is_purchasable=True,
    )
    StockBalance.objects.create(item=item, warehouse=wh, on_hand_qty=Decimal("10.0000"))

    # Execute task synchronously
    res = evaluate_warehouse_recommendations_task(warehouse_id=wh.id, user_actor="test_runner")
    assert res["success"] is True
    assert res["warehouse_id"] == wh.id
    assert res["items_count"] >= 1
    assert res["total_outlay"] > 0

    # Execute nightly batch job
    batch_res = nightly_batch_evaluation_job()
    assert batch_res["total_warehouses_evaluated"] >= 1
