import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.products.models import (
    InventoryItem,
    InventoryItemVariant,
    ProductAttribute,
    ProductAttributeValue,
    ItemAttributeValue,
)
from apps.categories.models import InventoryCategory
from apps.units.models import UnitOfMeasure


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def setup_variant_data(db):
    cat, _ = InventoryCategory.objects.get_or_create(code="CAT-APPAREL", defaults={"name": "Apparel & Gear"})
    uom, _ = UnitOfMeasure.objects.get_or_create(code="EA", defaults={"name": "Each", "dimension": "COUNT"})

    # Parent Item
    item = InventoryItem.objects.create(
        code="TSHIRT-001",
        name="Enterprise Industrial Crew T-Shirt",
        category=cat,
        base_uom=uom,
        has_variants=True,
        is_active=True,
    )

    # Attribute 1: Color
    attr_color, _ = ProductAttribute.objects.get_or_create(
        code="COLOR",
        defaults={"name": "Color", "is_variant_generator": True, "is_active": True},
    )
    val_red, _ = ProductAttributeValue.objects.get_or_create(
        attribute=attr_color,
        value="Red",
        defaults={"is_active": True},
    )
    val_blue, _ = ProductAttributeValue.objects.get_or_create(
        attribute=attr_color,
        value="Blue",
        defaults={"is_active": True},
    )

    # Attribute 2: Size
    attr_size, _ = ProductAttribute.objects.get_or_create(
        code="SIZE",
        defaults={"name": "Size", "is_variant_generator": True, "is_active": True},
    )
    val_med, _ = ProductAttributeValue.objects.get_or_create(
        attribute=attr_size,
        value="Medium",
        defaults={"is_active": True},
    )
    val_lrg, _ = ProductAttributeValue.objects.get_or_create(
        attribute=attr_size,
        value="Large",
        defaults={"is_active": True},
    )

    # Assign attributes to parent item
    ItemAttributeValue.objects.get_or_create(item=item, attribute=attr_color, variant=None)
    ItemAttributeValue.objects.get_or_create(item=item, attribute=attr_size, variant=None)

    return {
        "item": item,
        "attr_color": attr_color,
        "val_red": val_red,
        "val_blue": val_blue,
        "attr_size": attr_size,
        "val_med": val_med,
        "val_lrg": val_lrg,
    }


@pytest.mark.django_db
class TestCreateProductVariantFormWorkflow:

    def test_01_sku_preview_auto_generation(self, api_client, setup_variant_data):
        item = setup_variant_data["item"]
        attr_color = setup_variant_data["attr_color"]
        val_red = setup_variant_data["val_red"]
        attr_size = setup_variant_data["attr_size"]
        val_med = setup_variant_data["val_med"]

        # Step 2 & 3: Live preview of auto-generated SKU & Variant Name
        preview_url = "/api/v1/inventory/variants/sku-preview/"
        preview_payload = {
            "item": item.id,
            "selected_attributes": [
                {"attribute_id": attr_color.id, "value_id": val_red.id},
                {"attribute_id": attr_size.id, "value_id": val_med.id},
            ],
        }
        res = api_client.post(preview_url, preview_payload, format="json")
        assert res.status_code == status.HTTP_200_OK
        assert "sku" in res.data
        assert "TSHIRT-001" in res.data["sku"]
        assert "RED" in res.data["sku"]
        assert "MEDIUM" in res.data["sku"]
        assert "Enterprise Industrial Crew T-Shirt - Red - Medium" in res.data["variant_name"]

    def test_02_create_variant_with_all_sections(self, api_client, setup_variant_data):
        item = setup_variant_data["item"]
        attr_color = setup_variant_data["attr_color"]
        val_red = setup_variant_data["val_red"]
        attr_size = setup_variant_data["attr_size"]
        val_med = setup_variant_data["val_med"]

        # Complete submission matching 4 sections:
        # 1. Parent Product: item.id
        # 2. Variant Attributes: Color -> Red, Size -> Medium
        # 3. Variant Information: status = "ACTIVE"
        # 4. Additional Information: barcode, description
        create_url = "/api/v1/inventory/variants/"
        payload = {
            "item": item.id,
            "selected_attributes": [
                {"attribute_id": attr_color.id, "value_id": val_red.id},
                {"attribute_id": attr_size.id, "value_id": val_med.id},
            ],
            "status": "ACTIVE",
            "barcode": "8901234567890",
            "description": "Standard breathable industrial work crew t-shirt in medium red.",
        }
        res = api_client.post(create_url, payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        data = res.data
        assert data["item"] == item.id
        assert data["status"] == "ACTIVE"
        assert data["barcode"] == "8901234567890"
        assert data["description"] == "Standard breathable industrial work crew t-shirt in medium red."
        assert "TSHIRT-001" in data["sku"]

        # Check DB persistence
        variant = InventoryItemVariant.objects.get(pk=data["id"])
        assert variant.is_active is True
        assert variant.attribute_assignments.count() == 2

    def test_03_create_inactive_variant(self, api_client, setup_variant_data):
        item = setup_variant_data["item"]
        attr_color = setup_variant_data["attr_color"]
        val_blue = setup_variant_data["val_blue"]
        attr_size = setup_variant_data["attr_size"]
        val_lrg = setup_variant_data["val_lrg"]

        create_url = "/api/v1/inventory/variants/"
        payload = {
            "item": item.id,
            "selected_attributes": [
                {"attribute_id": attr_color.id, "value_id": val_blue.id},
                {"attribute_id": attr_size.id, "value_id": val_lrg.id},
            ],
            "status": "INACTIVE",
        }
        res = api_client.post(create_url, payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["status"] == "INACTIVE"
        variant = InventoryItemVariant.objects.get(pk=res.data["id"])
        assert variant.is_active is False

    def test_04_list_variants_returns_data_for_product_management(self, api_client, setup_variant_data):
        item = setup_variant_data["item"]
        attribute = setup_variant_data["attr_color"]
        value = setup_variant_data["val_red"]
        variant = InventoryItemVariant.objects.create(
            item=item,
            sku="TSHIRT-001-RED",
            variant_name="Enterprise Industrial Crew T-Shirt - Red",
            attributes={"Color": "Red"},
        )
        ItemAttributeValue.objects.create(
            item=item,
            variant=variant,
            attribute=attribute,
            attribute_value=value,
        )

        response = api_client.get("/api/v1/inventory/variants/?ordering=-created_at")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        listed_variant = response.data["results"][0]
        assert listed_variant["id"] == variant.id
        assert listed_variant["item_code"] == item.code
        assert listed_variant["attributes"] == {"Color": "Red"}
