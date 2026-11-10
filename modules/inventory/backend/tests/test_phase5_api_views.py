import pytest
from decimal import Decimal
from rest_framework.test import APIClient

from apps.products.models import InventoryItem
from apps.categories.models import InventoryCategory
from apps.warehouses.models import Warehouse
from apps.stock.models import StockBalance
from apps.planning.models import (
    PurchaseRecommendation,
    PurchaseRecommendationItem,
    ReplenishmentPolicy,
    RecommendationConfiguration,
    SupplierProductProfile,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def test_setup():
    cat, _ = InventoryCategory.objects.get_or_create(code="CAT-API-TEST", defaults={"name": "API Test Category"})
    wh = Warehouse.objects.create(name="Primary Distribution Center", code="WH-API-01", status="ACTIVE")
    item = InventoryItem.objects.create(
        code="SKU-API-001",
        name="Industrial Motor Bearing",
        category=cat,
        reorder_point=Decimal("25.0000"),
        standard_cost=Decimal("150.0000"),
        is_active=True,
        is_purchasable=True,
    )
    # Zero stock to trigger recommendation
    StockBalance.objects.create(item=item, warehouse=wh, on_hand_qty=Decimal("0.0000"))

    SupplierProductProfile.objects.create(
        supplier_name="Premier Engineering Supplies",
        product=item,
        unit_price=Decimal("140.0000"),
        lead_time_days=4,
        on_time_delivery_rate=Decimal("98.00"),
        quality_acceptance_rate=Decimal("99.00"),
    )
    return {"wh": wh, "item": item, "cat": cat}


@pytest.mark.django_db
def test_generate_and_list_purchase_recommendations(api_client, test_setup):
    wh = test_setup["wh"]

    # 1. Trigger generate endpoint
    res = api_client.post("/api/v1/inventory/planning/purchase-recommendations/generate/", {"warehouse_id": wh.id}, format="json")
    assert res.status_code == 200
    assert res.data["warehouses_processed"] == 1
    assert res.data["total_items_recommended"] >= 1

    # 2. List recommendations
    list_res = api_client.get("/api/v1/inventory/planning/purchase-recommendations/")
    assert list_res.status_code == 200
    results = list_res.data.get("results", list_res.data)
    assert len(results) >= 1
    rec_data = results[0]
    assert rec_data["warehouse_name"] == wh.name
    assert float(rec_data["total_estimated_outlay"]) > 0
    assert len(rec_data["items"]) >= 1


@pytest.mark.django_db
def test_dashboard_metrics_endpoint(api_client, test_setup):
    wh = test_setup["wh"]
    api_client.post("/api/v1/inventory/planning/purchase-recommendations/generate/", {"warehouse_id": wh.id}, format="json")

    res = api_client.get("/api/v1/inventory/planning/purchase-recommendations/dashboard-metrics/")
    assert res.status_code == 200
    assert "total_recommendations" in res.data
    assert "total_estimated_outlay" in res.data
    assert "critical_stockouts_count" in res.data
    assert res.data["total_recommendations"] >= 1
    assert res.data["total_estimated_outlay"] > 0.0


@pytest.mark.django_db
def test_recommendation_workflow_approve_and_convert(api_client, test_setup):
    wh = test_setup["wh"]
    gen_res = api_client.post("/api/v1/inventory/planning/purchase-recommendations/generate/", {"warehouse_id": wh.id}, format="json")
    rec_id = gen_res.data["recommendation_ids"][0]

    # Approve
    app_res = api_client.post(f"/api/v1/inventory/planning/purchase-recommendations/{rec_id}/approve/")
    assert app_res.status_code == 200
    assert app_res.data["status"] == "APPROVED"

    # Convert to PR
    conv_res = api_client.post(f"/api/v1/inventory/planning/purchase-recommendations/{rec_id}/convert-to-pr/")
    assert conv_res.status_code == 200
    assert conv_res.data["status"] == "CONVERTED"
    assert "PR-" in conv_res.data["purchase_request_reference"]


@pytest.mark.django_db
def test_modify_item_quantity_and_simulate(api_client, test_setup):
    wh = test_setup["wh"]
    gen_res = api_client.post("/api/v1/inventory/planning/purchase-recommendations/generate/", {"warehouse_id": wh.id}, format="json")
    rec = PurchaseRecommendation.objects.get(id=gen_res.data["recommendation_ids"][0])
    item = rec.items.first()

    # Modify Quantity
    mod_res = api_client.post(
        "/api/v1/inventory/planning/purchase-recommendations/modify-item-quantity/",
        {"item_id": str(item.id), "quantity": 120.0, "notes": "Manager boosted quantity for bulk discount"},
        format="json",
    )
    assert mod_res.status_code == 200
    assert mod_res.data["suggested_quantity"] == 120.0

    # Verify parent total outlay was updated
    rec.refresh_from_db()
    assert rec.total_estimated_outlay == Decimal("120.0") * item.estimated_unit_price

    # Simulate
    sim_res = api_client.post(
        "/api/v1/inventory/planning/purchase-recommendations/simulate-item/",
        {"item_id": str(item.id), "simulated_quantity": 200, "simulated_unit_price": 135.0},
        format="json",
    )
    assert sim_res.status_code == 200
    assert sim_res.data["simulated_quantity"] == 200.0
    assert sim_res.data["projected_procurement_outlay"] == 27000.0
