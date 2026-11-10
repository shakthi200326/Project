import pytest
from decimal import Decimal
from apps.products.models import InventoryItem
from apps.categories.models import InventoryCategory
from apps.warehouses.models import Warehouse
from apps.stock.models import StockBalance
from apps.planning.models import (
    SupplierProductProfile,
    RecommendationConfiguration,
    PurchaseRecommendation,
    PurchaseRecommendationItem,
)
from apps.planning.services.supplier_intelligence import SupplierIntelligenceService
from apps.planning.services.core_recommendation_engine import CoreRecommendationEngine


@pytest.fixture
def test_category():
    cat, _ = InventoryCategory.objects.get_or_create(
        code="CAT-SUPP-TEST", defaults={"name": "Supplier Intelligence Test Category"}
    )
    return cat


@pytest.mark.django_db
def test_multi_criteria_supplier_selection(test_category):
    """
    Verifies that the MCDM engine evaluates Price, Quality, Delivery, and Lead Time,
    and correctly ranks the optimal primary supplier while identifying backups.
    """
    wh = Warehouse.objects.create(name="Central Depot", code="WH-SUPP-01")
    item = InventoryItem.objects.create(
        code="SKU-SUPP-001",
        name="Precision Industrial Ball Bearing",
        category=test_category,
        lead_time_days=7,
        standard_cost=Decimal("120.0000"),
        is_active=True,
        is_purchasable=True,
    )

    # Supplier A: Balanced, high reliability, moderate price
    SupplierProductProfile.objects.create(
        supplier_name="Apex Precision Bearings Ltd",
        product=item,
        unit_price=Decimal("100.0000"),
        lead_time_days=5,
        minimum_order_qty=Decimal("10.0000"),
        pack_size=Decimal("5.0000"),
        shipping_cost=Decimal("50.0000"),
        tax_rate_percent=Decimal("18.00"),
        on_time_delivery_rate=Decimal("96.00"),
        quality_acceptance_rate=Decimal("98.50"),
    )

    # Supplier B: Lowest unit price, but very unreliable delivery and slow lead time
    SupplierProductProfile.objects.create(
        supplier_name="Budget Import Cargo Supplies",
        product=item,
        unit_price=Decimal("80.0000"),
        lead_time_days=20,
        minimum_order_qty=Decimal("50.0000"),
        pack_size=Decimal("10.0000"),
        shipping_cost=Decimal("100.0000"),
        tax_rate_percent=Decimal("18.00"),
        on_time_delivery_rate=Decimal("65.00"), # Delinquent delivery
        quality_acceptance_rate=Decimal("82.00"),
    )

    # Supplier C: Premium expedited supplier (fast lead time, very high price)
    SupplierProductProfile.objects.create(
        supplier_name="Express Dynamic Components",
        product=item,
        unit_price=Decimal("160.0000"),
        lead_time_days=2,
        minimum_order_qty=Decimal("1.0000"),
        pack_size=Decimal("1.0000"),
        shipping_cost=Decimal("30.0000"),
        tax_rate_percent=Decimal("18.00"),
        on_time_delivery_rate=Decimal("99.00"),
        quality_acceptance_rate=Decimal("99.50"),
    )

    config = RecommendationConfiguration.objects.create(
        tenant_id="test_tenant_mcdm",
        supplier_weight_price=Decimal("0.35"),
        supplier_weight_quality=Decimal("0.25"),
        supplier_weight_delivery=Decimal("0.25"),
        supplier_weight_lead_time=Decimal("0.15"),
    )

    res = SupplierIntelligenceService.evaluate_suppliers(
        product=item, required_qty=50.0, warehouse=wh, config=config
    )

    assert res["has_profiles"] is True
    # Apex Precision should win on balanced composite score
    assert res["preferred_supplier"] == "Apex Precision Bearings Ltd"
    assert res["price_opportunity_detected"] is True
    assert res["cost_saving_opportunity"] > 0.0

    primary = res["primary_option"]
    assert primary["composite_score"] > 80.0
    assert primary["score_breakdown"]["price_score"] > 0
    assert primary["score_breakdown"]["quality_score"] == 98.5
    assert primary["score_breakdown"]["delivery_score"] == 96.0

    # Alternates should include Budget and Express
    alternates = res["alternate_options"]
    assert len(alternates) == 2
    alt_names = [a["supplier_name"] for a in alternates]
    assert "Budget Import Cargo Supplies" in alt_names
    assert "Express Dynamic Components" in alt_names


@pytest.mark.django_db
def test_supplier_risk_detection(test_category):
    """
    Verifies automatic detection and tagging of supplier risk factors:
    single-source, sub-threshold quality, sub-threshold delivery, extended lead time.
    """
    wh = Warehouse.objects.create(name="Remote Hub", code="WH-SUPP-02")
    item = InventoryItem.objects.create(
        code="SKU-SUPP-002",
        name="High-Voltage Relay Switch",
        category=test_category,
        standard_cost=Decimal("250.0000"),
        is_active=True,
        is_purchasable=True,
    )

    # Only single supplier with multiple risk flags: slow lead time (18d), poor delivery (72%), poor quality (75%)
    SupplierProductProfile.objects.create(
        supplier_name="Sole Source Risky Vendor",
        product=item,
        unit_price=Decimal("250.0000"),
        lead_time_days=18,
        minimum_order_qty=Decimal("100.0000"),
        pack_size=Decimal("10.0000"),
        on_time_delivery_rate=Decimal("72.00"),
        quality_acceptance_rate=Decimal("75.00"),
    )

    res = SupplierIntelligenceService.evaluate_suppliers(
        product=item, required_qty=20.0, warehouse=wh
    )

    assert res["has_profiles"] is True
    risks = res["primary_option"]["risk_flags"]
    assert "SINGLE_SOURCE_RISK" in risks
    assert "DELIVERY_DELAY_RISK" in risks
    assert "QUALITY_RISK_BELOW_THRESHOLD" in risks
    assert "EXTENDED_LEAD_TIME_RISK" in risks
    assert "ORDER_QTY_BELOW_MOQ" in risks


@pytest.mark.django_db
def test_core_recommendation_supplier_integration(test_category):
    """
    Verifies that the Core Recommendation Engine automatically feeds supplier intelligence
    into generated PurchaseRecommendation items with complete transparent metrics.
    """
    wh = Warehouse.objects.create(name="Main Production Warehouse", code="WH-SUPP-03")
    item = InventoryItem.objects.create(
        code="SKU-SUPP-003",
        name="Hydraulic Seal Ring",
        category=test_category,
        reorder_point=Decimal("50.0000"),
        lead_time_days=6,
        is_active=True,
        is_purchasable=True,
    )

    # Zero stock on hand -> Triggers reorder
    StockBalance.objects.create(
        item=item,
        warehouse=wh,
        on_hand_qty=Decimal("0.0000"),
    )

    # Register two suppliers
    SupplierProductProfile.objects.create(
        supplier_name="Premier Polymers & Seals",
        product=item,
        unit_price=Decimal("45.0000"),
        lead_time_days=4,
        minimum_order_qty=Decimal("20.0000"),
        on_time_delivery_rate=Decimal("97.00"),
        quality_acceptance_rate=Decimal("99.00"),
    )
    SupplierProductProfile.objects.create(
        supplier_name="Alternative Fastener Supply",
        product=item,
        unit_price=Decimal("60.0000"),
        lead_time_days=10,
        minimum_order_qty=Decimal("50.0000"),
        on_time_delivery_rate=Decimal("88.00"),
        quality_acceptance_rate=Decimal("92.00"),
    )

    rec = CoreRecommendationEngine.generate_recommendations_for_warehouse(
        warehouse=wh, tenant_id="tenant_supp_integ"
    )

    assert rec.total_items_count == 1
    item_rec = rec.items.first()
    assert item_rec.product == item
    # Top-ranked supplier should be selected
    assert item_rec.preferred_supplier == "Premier Polymers & Seals"
    assert item_rec.estimated_unit_price == Decimal("45.0000")
    assert item_rec.suggested_quantity >= Decimal("20.0000")

    # Supplier intelligence breakdown should be stored in JSON
    supp_intel = item_rec.calculation_breakdown.get("supplier_intelligence", {})
    assert supp_intel.get("preferred_supplier") == "Premier Polymers & Seals"
    assert supp_intel.get("composite_score") is not None
    assert len(supp_intel.get("alternate_options", [])) == 1
    assert supp_intel["alternate_options"][0]["supplier_name"] == "Alternative Fastener Supply"

    # Human-readable justification should be included in reasons
    reasons_str = " ".join(item_rec.recommendation_reasons)
    assert "Premier Polymers & Seals" in reasons_str


@pytest.mark.django_db
def test_fallback_when_no_supplier_profiles_exist(test_category):
    """
    Verifies graceful fallback to product master defaults when no supplier profile
    has been configured yet, without throwing runtime exceptions.
    """
    wh = Warehouse.objects.create(name="Remote Hub 2", code="WH-SUPP-04")
    item = InventoryItem.objects.create(
        code="SKU-SUPP-004",
        name="Standard Copper Fitting",
        category=test_category,
        standard_cost=Decimal("75.0000"),
        lead_time_days=8,
        is_active=True,
        is_purchasable=True,
    )

    res = SupplierIntelligenceService.evaluate_suppliers(
        product=item, required_qty=100.0, warehouse=wh
    )

    assert res["has_profiles"] is False
    assert res["preferred_supplier"] == "Standard Certified Vendor"
    assert res["preferred_unit_price"] == 75.0
    assert res["preferred_lead_time"] == 8
    assert "SINGLE_SOURCE_RISK" in res["risk_flags"]
    assert "UNMAPPED_SUPPLIER_PROFILE" in res["risk_flags"]
