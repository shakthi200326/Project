import pytest
from decimal import Decimal
from django.utils import timezone
from apps.products.models import InventoryItem
from apps.categories.models import InventoryCategory
from apps.warehouses.models import Warehouse
from apps.stock.models import StockBalance, StockInTransit
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.planning.models import (
    ReplenishmentPolicy,
    RecommendationConfiguration,
    PurchaseRecommendation,
    PurchaseRecommendationItem,
    RecommendationHistory,
    RecommendationFeedback,
)
from apps.planning.services.core_recommendation_engine import (
    InventoryAnalyzerService,
    CoreRecommendationEngine,
)


@pytest.fixture
def test_category():
    cat, _ = InventoryCategory.objects.get_or_create(code="CAT-TEST", defaults={"name": "Test Category"})
    return cat


@pytest.mark.django_db
def test_inventory_position_calculation(test_category):
    wh = Warehouse.objects.create(name="Central Test Hub", code="WH-TEST-01")
    item = InventoryItem.objects.create(
        code="SKU-TEST-001",
        name="Test Component A",
        category=test_category,
        reorder_point=Decimal("20.0000"),
        standard_cost=Decimal("150.0000"),
        is_active=True,
        is_purchasable=True,
    )

    # 1. Physical stock: 15 on hand, 3 reserved, 2 blocked
    StockBalance.objects.create(
        item=item,
        warehouse=wh,
        on_hand_qty=Decimal("15.0000"),
        reserved_qty=Decimal("3.0000"),
        blocked_qty=Decimal("2.0000"),
        damaged_qty=Decimal("0.0000"),
    )

    # 2. In-transit transfer: 5 units confirmed
    wh_source = Warehouse.objects.create(name="Secondary Hub", code="WH-TEST-02")
    StockInTransit.objects.create(
        item=item,
        source_warehouse=wh_source,
        destination_warehouse=wh,
        quantity=Decimal("5.0000"),
        status="IN_TRANSIT",
    )

    # Calculate position
    pos = InventoryAnalyzerService.get_stock_position(item, wh)
    assert pos["on_hand"] == Decimal("15.0000")
    assert pos["available_stock"] == Decimal("10.0000")  # 15 - 3 - 2
    assert pos["incoming_stock"] == Decimal("5.0000")
    assert pos["net_inventory_position"] == Decimal("15.0000")  # (15 - 3 - 2) + 5


@pytest.mark.django_db
def test_replenishment_trigger_and_moq_rounding(test_category):
    wh = Warehouse.objects.create(name="Retail Depot", code="WH-DEPOT-01")
    item = InventoryItem.objects.create(
        code="SKU-TEST-002",
        name="Packaged Organic Flour",
        category=test_category,
        reorder_point=Decimal("30.0000"),
        min_order_qty=Decimal("50.0000"),
        standard_cost=Decimal("45.0000"),
        is_active=True,
        is_purchasable=True,
    )

    # Stock is below ROP: On-hand 10, no incoming -> position 10 <= 30
    StockBalance.objects.create(
        item=item,
        warehouse=wh,
        on_hand_qty=Decimal("10.0000"),
        reserved_qty=Decimal("0.0000"),
    )

    # Configure policy: Target cover 100, pack size 12
    ReplenishmentPolicy.objects.create(
        name="Flour Policy",
        product=item,
        warehouse=wh,
        min_stock_level=Decimal("30.0000"),
        max_stock_level=Decimal("70.0000"),
        min_order_quantity=Decimal("50.0000"),
        order_multiple_pack_size=Decimal("12.0000"),
    )

    rec_data = CoreRecommendationEngine.evaluate_item_recommendation(item, wh)
    assert rec_data is not None
    # Deficit is 70 - 10 = 60. Min order is 50. 60 is divisible by 12 (12 * 5 = 60)
    assert rec_data["suggested_quantity"] == Decimal("60.0000")
    assert rec_data["priority"] in [PurchaseRecommendation.Priority.HIGH, PurchaseRecommendation.Priority.MEDIUM]
    assert rec_data["recommended_action"] == PurchaseRecommendationItem.Action.PURCHASE


@pytest.mark.django_db
def test_inter_warehouse_transfer_preference(test_category):
    wh_dest = Warehouse.objects.create(name="Branch A Store", code="WH-BR-01")
    wh_surplus = Warehouse.objects.create(name="Regional Master Hub", code="WH-HUB-01")
    
    item = InventoryItem.objects.create(
        code="SKU-TEST-003",
        name="Hydraulic Valve",
        category=test_category,
        reorder_point=Decimal("15.0000"),
        is_active=True,
        is_purchasable=True,
    )

    # Destination is low (position = 5 <= 15)
    StockBalance.objects.create(item=item, warehouse=wh_dest, on_hand_qty=Decimal("5.0000"))

    # Source has surplus (on hand 120, reorder point 20 -> surplus = 100)
    StockBalance.objects.create(item=item, warehouse=wh_surplus, on_hand_qty=Decimal("120.0000"))
    ReplenishmentPolicy.objects.create(
        name="Surplus Policy",
        product=item,
        warehouse=wh_surplus,
        min_stock_level=Decimal("20.0000"),
    )

    rec_data = CoreRecommendationEngine.evaluate_item_recommendation(item, wh_dest)
    assert rec_data is not None
    assert rec_data["recommended_action"] == PurchaseRecommendationItem.Action.TRANSFER
    assert rec_data["suggested_transfer_warehouse"] == wh_surplus


@pytest.mark.django_db
def test_purchase_recommendation_header_and_audit_history(test_category):
    wh = Warehouse.objects.create(name="Main Production Warehouse", code="WH-MAIN-01")
    item = InventoryItem.objects.create(
        code="SKU-TEST-004",
        name="Raw Cotton Yarn",
        category=test_category,
        reorder_point=Decimal("50.0000"),
        standard_cost=Decimal("250.0000"),
        is_active=True,
        is_purchasable=True,
    )
    StockBalance.objects.create(item=item, warehouse=wh, on_hand_qty=Decimal("10.0000"))

    rec = CoreRecommendationEngine.generate_recommendations_for_warehouse(wh, user_actor="planner_user")
    assert rec is not None
    assert rec.total_items_count >= 1
    assert rec.status == PurchaseRecommendation.Status.DRAFT
    assert rec.total_estimated_outlay > Decimal("0.0000")

    # Verify history log created
    history = rec.history_logs.first()
    assert history is not None
    assert history.action_type == "GENERATED_OR_REFRESHED"
    assert history.actor == "planner_user"
