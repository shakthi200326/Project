import pytest
import math
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient

from apps.products.models import InventoryItem
from apps.categories.models import InventoryCategory
from apps.warehouses.models import Warehouse
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.planning.models import (
    PurchaseRecommendation,
    PurchaseRecommendationItem,
    ReplenishmentPolicy,
    RecommendationConfiguration,
    RecommendationHistory,
    RecommendationFeedback,
    SupplierProductProfile,
)
from apps.planning.services.core_recommendation_engine import (
    CoreRecommendationEngine,
    InventoryAnalyzerService,
)
from apps.planning.services.demand_forecasting_engine import (
    DemandForecastingEngine,
    ReplenishmentIntelligenceService,
)
from apps.planning.services.supplier_intelligence import SupplierIntelligenceService


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def scenario_fixtures():
    cat, _ = InventoryCategory.objects.get_or_create(code="CAT-P6-VAL", defaults={"name": "Phase 6 Validation Category"})
    wh1 = Warehouse.objects.create(name="Primary Fulfillment Center", code="WH-P6-01", status="ACTIVE")
    wh2 = Warehouse.objects.create(name="Regional Overflow Depot", code="WH-P6-02", status="ACTIVE")
    return {"cat": cat, "wh1": wh1, "wh2": wh2}


# ============================================================================
# SCENARIO 1: Standard Continuous Review (ROP) Replenishment Trigger
# ============================================================================
@pytest.mark.django_db
def test_scenario_1_standard_rop_replenishment(scenario_fixtures):
    wh = scenario_fixtures["wh1"]
    item = InventoryItem.objects.create(
        code="SKU-SCENARIO-01",
        name="Precision Ball Valve 2-inch",
        category=scenario_fixtures["cat"],
        reorder_point=Decimal("30.0000"),
        standard_cost=Decimal("150.0000"),
        is_active=True,
        is_purchasable=True,
    )
    # Available stock = 10 (well below ROP of 30)
    StockBalance.objects.create(item=item, warehouse=wh, on_hand_qty=Decimal("10.0000"))

    rec = CoreRecommendationEngine.generate_recommendations_for_warehouse(wh, tenant_id="t_scen1")
    assert rec.total_items_count == 1
    line = rec.items.first()
    assert line.product == item
    assert line.recommended_action == PurchaseRecommendationItem.Action.PURCHASE
    assert line.suggested_quantity > Decimal("0.0000")
    assert line.inventory_position == Decimal("10.0000")


# ============================================================================
# SCENARIO 2: Statistical Safety Stock Calculation Under Demand Volatility
# ============================================================================
@pytest.mark.django_db
def test_scenario_2_statistical_safety_stock_under_volatility(scenario_fixtures):
    wh = scenario_fixtures["wh1"]
    item = InventoryItem.objects.create(
        code="SKU-SCENARIO-02",
        name="High-Voltage Transformer Oil",
        category=scenario_fixtures["cat"],
        lead_time_days=9, # sqrt(9) = 3
        is_active=True,
        is_purchasable=True,
    )
    # Forecast with standard deviation of daily demand = 10.0
    forecast_data = {
        "recommended_daily_demand": 25.0,
        "std_dev_daily_demand": 10.0,
        "growth_trend_pct": 5.0,
    }
    # 95% service level -> Z = 1.645
    policy = ReplenishmentPolicy.objects.create(
        name="Transformer Oil Policy",
        product=item,
        warehouse=wh,
        lead_time_days=9,
        service_level_target_pct=Decimal("95.00"),
        safety_stock_days=2, # Floor = 2 * 25 = 50
    )

    targets = ReplenishmentIntelligenceService.calculate_replenishment_targets(
        product=item, warehouse=wh, forecast_result=forecast_data, policy=policy
    )
    # Statistical SS = 1.645 * 10.0 * 3 = 49.35
    # Floor = 50.0 -> max(49.35, 50.0) = 50.0
    assert targets["lead_time_days"] == 9
    assert targets["z_score"] == 1.645
    assert targets["safety_stock"] >= 49.35
    # Dynamic ROP = (25 * 9) + SS = 225 + 50 = 275.0
    assert targets["reorder_point"] >= 274.0


# ============================================================================
# SCENARIO 3: Inter-Warehouse Transfer Prioritization Over External Purchase
# ============================================================================
@pytest.mark.django_db
def test_scenario_3_inter_warehouse_transfer_prioritization(scenario_fixtures):
    wh_dest = scenario_fixtures["wh1"]
    wh_src = scenario_fixtures["wh2"]

    item = InventoryItem.objects.create(
        code="SKU-SCENARIO-03",
        name="Centrifugal Impeller Shaft",
        category=scenario_fixtures["cat"],
        reorder_point=Decimal("20.0000"),
        is_active=True,
        is_purchasable=True,
    )
    # Destination warehouse has deficit (0 on hand)
    StockBalance.objects.create(item=item, warehouse=wh_dest, on_hand_qty=Decimal("0.0000"))

    # Source warehouse has substantial surplus: 100 on-hand with ROP floor of 20 -> 80 surplus available
    StockBalance.objects.create(item=item, warehouse=wh_src, on_hand_qty=Decimal("100.0000"))
    ReplenishmentPolicy.objects.create(
        name="Source WH Safe Floor Policy",
        product=item,
        warehouse=wh_src,
        min_stock_level=Decimal("20.0000"),
    )

    rec = CoreRecommendationEngine.generate_recommendations_for_warehouse(wh_dest, tenant_id="t_scen3")
    assert rec.total_items_count == 1
    line = rec.items.first()
    assert line.recommended_action == PurchaseRecommendationItem.Action.TRANSFER
    assert line.suggested_transfer_warehouse == wh_src
    assert any("Inter-warehouse transfer recommended" in r for r in line.recommendation_reasons)


# ============================================================================
# SCENARIO 4: Multi-Criteria Decision Matrix (MCDM) Supplier Selection
# ============================================================================
@pytest.mark.django_db
def test_scenario_4_multi_criteria_supplier_selection(scenario_fixtures):
    wh = scenario_fixtures["wh1"]
    item = InventoryItem.objects.create(
        code="SKU-SCENARIO-04",
        name="Stainless Flange Fitting",
        category=scenario_fixtures["cat"],
        standard_cost=Decimal("200.0000"),
        is_active=True,
        is_purchasable=True,
    )

    # Vendor 1: Low price, bad delivery reliability
    SupplierProductProfile.objects.create(
        supplier_name="Bargain Metals Co",
        product=item,
        unit_price=Decimal("150.0000"),
        lead_time_days=15,
        on_time_delivery_rate=Decimal("60.00"),
        quality_acceptance_rate=Decimal("80.00"),
    )
    # Vendor 2: Moderate price, outstanding reliability & quality (Should Win!)
    SupplierProductProfile.objects.create(
        supplier_name="Precision Alloy Works",
        product=item,
        unit_price=Decimal("170.0000"),
        lead_time_days=4,
        on_time_delivery_rate=Decimal("98.00"),
        quality_acceptance_rate=Decimal("99.50"),
    )

    eval_res = SupplierIntelligenceService.evaluate_suppliers(
        product=item, required_qty=100.0, warehouse=wh
    )
    assert eval_res["has_profiles"] is True
    assert eval_res["preferred_supplier"] == "Precision Alloy Works"
    assert eval_res["primary_option"]["score_breakdown"]["quality_score"] == 99.5
    assert len(eval_res["alternate_options"]) == 1
    assert eval_res["alternate_options"][0]["supplier_name"] == "Bargain Metals Co"


# ============================================================================
# SCENARIO 5: Single-Source Supplier Risk Alert
# ============================================================================
@pytest.mark.django_db
def test_scenario_5_single_source_supplier_risk(scenario_fixtures):
    wh = scenario_fixtures["wh1"]
    item = InventoryItem.objects.create(
        code="SKU-SCENARIO-05",
        name="Proprietary Micro-Controller Chip",
        category=scenario_fixtures["cat"],
        standard_cost=Decimal("450.0000"),
        is_active=True,
        is_purchasable=True,
    )
    # Exactly one profile registered
    SupplierProductProfile.objects.create(
        supplier_name="Exclusive SemiCon Foundry",
        product=item,
        unit_price=Decimal("450.0000"),
        lead_time_days=8,
        on_time_delivery_rate=Decimal("95.00"),
        quality_acceptance_rate=Decimal("99.00"),
    )

    eval_res = SupplierIntelligenceService.evaluate_suppliers(product=item, required_qty=20.0, warehouse=wh)
    assert "SINGLE_SOURCE_RISK" in eval_res["primary_option"]["risk_flags"]


# ============================================================================
# SCENARIO 6: Quality and Delivery Delinquency Risk Alerts
# ============================================================================
@pytest.mark.django_db
def test_scenario_6_quality_and_delivery_delinquency_risk(scenario_fixtures):
    wh = scenario_fixtures["wh1"]
    item = InventoryItem.objects.create(
        code="SKU-SCENARIO-06",
        name="Cast Iron Brake Drum",
        category=scenario_fixtures["cat"],
        standard_cost=Decimal("300.0000"),
        is_active=True,
        is_purchasable=True,
    )
    # Quality: 70% (< 80%), Delivery: 65% (< 80%)
    SupplierProductProfile.objects.create(
        supplier_name="Unreliable Foundry Ltd",
        product=item,
        unit_price=Decimal("280.0000"),
        lead_time_days=18,
        on_time_delivery_rate=Decimal("65.00"),
        quality_acceptance_rate=Decimal("70.00"),
    )

    eval_res = SupplierIntelligenceService.evaluate_suppliers(product=item, required_qty=50.0, warehouse=wh)
    risks = eval_res["primary_option"]["risk_flags"]
    assert "QUALITY_RISK_BELOW_THRESHOLD" in risks
    assert "DELIVERY_DELAY_RISK" in risks
    assert "EXTENDED_LEAD_TIME_RISK" in risks


# ============================================================================
# SCENARIO 7: Minimum Order Quantity (MOQ) and Case Pack Rounding
# ============================================================================
@pytest.mark.django_db
def test_scenario_7_moq_and_pack_size_rounding(scenario_fixtures):
    wh = scenario_fixtures["wh1"]
    item = InventoryItem.objects.create(
        code="SKU-SCENARIO-07",
        name="Heavy Hex Bolt M16",
        category=scenario_fixtures["cat"],
        reorder_point=Decimal("20.0000"),
        is_active=True,
        is_purchasable=True,
    )
    # Net position = 15 (Deficit = 20 - 15 = 5)
    StockBalance.objects.create(item=item, warehouse=wh, on_hand_qty=Decimal("15.0000"))

    # Policy requires MOQ = 50, Pack size multiple = 25
    ReplenishmentPolicy.objects.create(
        name="Fastener Bulk Pack Policy",
        product=item,
        warehouse=wh,
        min_stock_level=Decimal("20.0000"),
        max_stock_level=Decimal("20.0000"),
        min_order_quantity=Decimal("50.0000"),
        order_multiple_pack_size=Decimal("25.0000"),
    )

    rec = CoreRecommendationEngine.generate_recommendations_for_warehouse(wh, tenant_id="t_scen7")
    line = rec.items.first()
    # Initial deficit was 5. MOQ boosts to 50. Multiple of 25 -> 50 is exact multiple of 25.
    assert line.suggested_quantity >= Decimal("50.0000")
    assert line.suggested_quantity % Decimal("25.0000") == Decimal("0.0000")
    assert any("Adjusted to Supplier Minimum Order Quantity" in r for r in line.recommendation_reasons)


# ============================================================================
# SCENARIO 8: Overstock Prevention & Purchasing Hold
# ============================================================================
@pytest.mark.django_db
def test_scenario_8_overstock_prevention_hold(scenario_fixtures):
    wh = scenario_fixtures["wh1"]
    item = InventoryItem.objects.create(
        code="SKU-SCENARIO-08",
        name="Industrial Solvent Drum 200L",
        category=scenario_fixtures["cat"],
        reorder_point=Decimal("15.0000"),
        is_active=True,
        is_purchasable=True,
    )
    # Available stock = 50, well above ROP of 15
    StockBalance.objects.create(item=item, warehouse=wh, on_hand_qty=Decimal("50.0000"))

    rec = CoreRecommendationEngine.generate_recommendations_for_warehouse(wh, tenant_id="t_scen8")
    # No recommendations generated because stock is sufficient (overstock prevention returns None or 0 items)
    assert rec is None or rec.total_items_count == 0


# ============================================================================
# SCENARIO 9: Manager Quantity Override with Feedback Audit
# ============================================================================
@pytest.mark.django_db
def test_scenario_9_manager_quantity_override_feedback(api_client, scenario_fixtures):
    wh = scenario_fixtures["wh1"]
    item = InventoryItem.objects.create(
        code="SKU-SCENARIO-09",
        name="Ceramic Insulator Bushing",
        category=scenario_fixtures["cat"],
        reorder_point=Decimal("20.0000"),
        standard_cost=Decimal("100.0000"),
        is_active=True,
        is_purchasable=True,
    )
    StockBalance.objects.create(item=item, warehouse=wh, on_hand_qty=Decimal("0.0000"))

    gen_res = api_client.post("/api/v1/inventory/planning/purchase-recommendations/generate/", {"warehouse_id": wh.id}, format="json")
    rec = PurchaseRecommendation.objects.get(id=gen_res.data["recommendation_ids"][0])
    line = rec.items.first()
    original_qty = line.suggested_quantity

    # Manager increases quantity to 75
    mod_res = api_client.post(
        "/api/v1/inventory/planning/purchase-recommendations/modify-item-quantity/",
        {"item_id": str(line.id), "quantity": 75.0, "notes": "Anticipating surge in seasonal maintenance contracts."},
        format="json",
    )
    assert mod_res.status_code == 200
    assert mod_res.data["suggested_quantity"] == 75.0

    # Verify Feedback and History records were created
    feedback = RecommendationFeedback.objects.filter(recommendation_item=line).first()
    assert feedback is not None
    assert feedback.original_quantity == original_qty
    assert feedback.modified_quantity == Decimal("75.0000")
    assert feedback.feedback_type == RecommendationFeedback.FeedbackType.QUANTITY_INCREASED


# ============================================================================
# SCENARIO 10: Recommendation Approval and PR Conversion Integration
# ============================================================================
@pytest.mark.django_db
def test_scenario_10_recommendation_approval_and_pr_conversion(api_client, scenario_fixtures):
    wh = scenario_fixtures["wh1"]
    item = InventoryItem.objects.create(
        code="SKU-SCENARIO-10",
        name="Heavy Duty Conveyor Belt 50m",
        category=scenario_fixtures["cat"],
        reorder_point=Decimal("10.0000"),
        is_active=True,
        is_purchasable=True,
    )
    StockBalance.objects.create(item=item, warehouse=wh, on_hand_qty=Decimal("0.0000"))

    gen_res = api_client.post("/api/v1/inventory/planning/purchase-recommendations/generate/", {"warehouse_id": wh.id}, format="json")
    rec_id = gen_res.data["recommendation_ids"][0]

    # Transition: DRAFT -> APPROVED
    app_res = api_client.post(f"/api/v1/inventory/planning/purchase-recommendations/{rec_id}/approve/")
    assert app_res.status_code == 200
    assert app_res.data["status"] == "APPROVED"

    # Transition: APPROVED -> CONVERTED
    conv_res = api_client.post(f"/api/v1/inventory/planning/purchase-recommendations/{rec_id}/convert-to-pr/")
    assert conv_res.status_code == 200
    assert conv_res.data["status"] == "CONVERTED"
    pr_ref = conv_res.data["purchase_request_reference"]
    assert pr_ref.startswith("PR-")

    # Audit history tracks both events
    history_logs = RecommendationHistory.objects.filter(recommendation_id=rec_id)
    actions = [h.action_type for h in history_logs]
    assert "APPROVED" in actions
    assert "CONVERTED_TO_PURCHASE_REQUEST" in actions


# ============================================================================
# SCENARIO 11: What-If Simulation Sandbox (In-Memory, Zero State Mutation)
# ============================================================================
@pytest.mark.django_db
def test_scenario_11_what_if_simulation_sandbox(api_client, scenario_fixtures):
    wh = scenario_fixtures["wh1"]
    item = InventoryItem.objects.create(
        code="SKU-SCENARIO-11",
        name="Electronic Motor Governor",
        category=scenario_fixtures["cat"],
        reorder_point=Decimal("20.0000"),
        is_active=True,
        is_purchasable=True,
    )
    StockBalance.objects.create(item=item, warehouse=wh, on_hand_qty=Decimal("5.0000"))

    gen_res = api_client.post("/api/v1/inventory/planning/purchase-recommendations/generate/", {"warehouse_id": wh.id}, format="json")
    rec = PurchaseRecommendation.objects.get(id=gen_res.data["recommendation_ids"][0])
    line = rec.items.first()

    # Simulation call testing 350 units at Rs. 85/unit
    sim_res = api_client.post(
        "/api/v1/inventory/planning/purchase-recommendations/simulate-item/",
        {"item_id": str(line.id), "simulated_quantity": 350.0, "simulated_unit_price": 85.0, "simulated_lead_time_days": 5},
        format="json",
    )
    assert sim_res.status_code == 200
    assert sim_res.data["simulated_quantity"] == 350.0
    assert sim_res.data["simulated_unit_price"] == 85.0
    assert sim_res.data["projected_procurement_outlay"] == 350.0 * 85.0

    # Ensure database balance was untouched
    bal = StockBalance.objects.get(item=item, warehouse=wh)
    assert bal.on_hand_qty == Decimal("5.0000")


# ============================================================================
# SCENARIO 12: Zero-Data Cold-Start Fallback Resilience
# ============================================================================
@pytest.mark.django_db
def test_scenario_12_zero_data_cold_start_fallback(scenario_fixtures):
    wh = scenario_fixtures["wh1"]
    # Brand new SKU with zero ledger entries, zero supplier profiles, zero policies
    new_sku = InventoryItem.objects.create(
        code="SKU-SCENARIO-12",
        name="Brand New Untracked Gasket",
        category=scenario_fixtures["cat"],
        reorder_point=Decimal("15.0000"),
        standard_cost=Decimal("65.0000"),
        lead_time_days=6,
        is_active=True,
        is_purchasable=True,
    )
    StockBalance.objects.create(item=new_sku, warehouse=wh, on_hand_qty=Decimal("0.0000"))

    # Engine executes without exception
    res = CoreRecommendationEngine.evaluate_item_recommendation(new_sku, wh, tenant_id="t_scen12")
    assert res is not None
    assert res["product"] == new_sku
    assert res["reorder_point"] >= Decimal("15.0000")
    assert res["estimated_unit_price"] == Decimal("65.0000")
    assert res["preferred_supplier"] == "Standard Certified Vendor"
    assert "SINGLE_SOURCE_RISK" in res["calculation_breakdown"]["supplier_intelligence"]["risk_flags"]
