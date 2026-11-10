import pytest
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone

from apps.products.models import InventoryItem
from apps.categories.models import InventoryCategory
from apps.warehouses.models import Warehouse
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.planning.models import ReplenishmentPolicy
from apps.planning.services.demand_forecasting_engine import (
    DemandForecastingEngine,
    ReplenishmentIntelligenceService,
)
from apps.planning.services.core_recommendation_engine import CoreRecommendationEngine


@pytest.fixture
def test_category():
    cat, _ = InventoryCategory.objects.get_or_create(code="CAT-FORECAST", defaults={"name": "Forecasting Test Category"})
    return cat


@pytest.mark.django_db
def test_demand_forecasting_calculations(test_category):
    wh = Warehouse.objects.create(name="Regional Depot", code="WH-FCST-01")
    item = InventoryItem.objects.create(
        code="SKU-FCST-001",
        name="Castor Oil Grade A",
        category=test_category,
        reorder_point=Decimal("20.0000"),
        is_active=True,
        is_purchasable=True,
    )

    # Seed 30 days of distinct outbound movements in ledger
    today = timezone.localdate()
    for day_offset in range(1, 31):
        dt = timezone.now() - timedelta(days=day_offset)
        # Steady consumption of 10 units per day
        entry = StockLedgerEntry.objects.create(
            item=item,
            warehouse=wh,
            movement_type="ISSUE",
            quantity_delta=Decimal("-10.0000"),
            balance_after=Decimal("100.0000"),
            unit_cost=Decimal("50.0000"),
            transaction_ref=f"SO-TEST-{day_offset}",
        )
        # Update created_at directly
        StockLedgerEntry.objects.filter(id=entry.id).update(created_at=dt)

    res = DemandForecastingEngine.calculate_forecast(item, wh, lookback_days=90)
    assert res["has_sufficient_data"] is True
    assert res["non_zero_sales_days"] >= 29
    # Daily consumption should be very close to 10.0
    assert abs(res["average_daily_demand_30d"] - 10.0) < 0.5
    assert abs(res["recommended_daily_demand"] - 10.0) < 0.5
    assert res["confidence_level"] >= 0.80
    assert res["mape"] >= 0.0


@pytest.mark.django_db
def test_replenishment_safety_stock_and_dynamic_rop(test_category):
    wh = Warehouse.objects.create(name="Distribution Hub", code="WH-FCST-02")
    item = InventoryItem.objects.create(
        code="SKU-FCST-002",
        name="Organic Turmeric Powder",
        category=test_category,
        lead_time_days=4,
        reorder_point=Decimal("0.0000"),
        is_active=True,
        is_purchasable=True,
    )

    # Synthetic forecast result: ADD = 20 units/day, std_dev = 5.0 units
    forecast_data = {
        "recommended_daily_demand": 20.0,
        "std_dev_daily_demand": 5.0,
        "growth_trend_pct": 12.5,
    }

    # Policy with 95% service level (Z = 1.645), lead time = 4 days
    policy = ReplenishmentPolicy.objects.create(
        name="Turmeric Replenishment Policy",
        product=item,
        warehouse=wh,
        lead_time_days=4,
        service_level_target_pct=Decimal("95.00"),
        safety_stock_days=7,
        target_cover_days=30,
    )

    targets = ReplenishmentIntelligenceService.calculate_replenishment_targets(
        item, wh, forecast_result=forecast_data, policy=policy
    )

    # Lead time = 4 days -> sqrt(4) = 2
    # Statistical Safety stock = 1.645 * 5.0 * 2 = 16.45
    # Min safety floor = 7 days * 20 = 140
    # Final safety stock should be max(16.45, 140) = 140
    assert targets["lead_time_days"] == 4
    assert targets["safety_stock"] >= 140.0
    # Demand during lead time = 20 * 4 = 80
    # ROP = 80 + 140 = 220
    assert targets["reorder_point"] >= 220.0
    # Target stock = ROP + (30 * 20) = 220 + 600 = 820
    assert targets["target_stock_level"] >= 820.0


@pytest.mark.django_db
def test_insufficient_historical_data_handling(test_category):
    wh = Warehouse.objects.create(name="New Branch", code="WH-NEW-01")
    item = InventoryItem.objects.create(
        code="SKU-NEW-001",
        name="Brand New Untracked Product",
        category=test_category,
        reorder_point=Decimal("15.0000"),
        is_active=True,
        is_purchasable=True,
    )

    # No ledger history seeded
    res = DemandForecastingEngine.calculate_forecast(item, wh, lookback_days=90)
    assert res["has_sufficient_data"] is False
    assert res["forecast_method"] == "ZERO_DEMAND_FALLBACK"
    assert res["confidence_level"] <= 0.40

    # Replenishment fallback cleanly defaults to item master ROP
    targets = ReplenishmentIntelligenceService.calculate_replenishment_targets(item, wh, forecast_result=res)
    assert targets["reorder_point"] >= 15.0

