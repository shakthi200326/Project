import io
import csv
from decimal import Decimal
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient
from rest_framework import status

from apps.categories.models import InventoryCategory
from apps.brands.models import Brand
from apps.units.models import UnitOfMeasure
from apps.products.models import (
    InventoryItem,
    InventoryItemVariant,
    ProductAttribute,
    ProductAttributeValue,
    ItemAttributeValue,
    ProductBarcode,
    ProductUnitConversion,
)
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.movements.models import StockTransaction, StockTransactionLine
from services.posting_service import InventoryPostingService
from services.uom_service import UOMConversionService
from services.variant_matrix_service import VariantMatrixService
from services.import_export_service import ProductImportExportService
from shared_file_storage.models.file_record import StoredFile


class EnterpriseItemsProductsMasterSuite(TestCase):
    """
    Comprehensive Master Test Suite covering all 23 Enterprise Scenarios
    defined in the Enterprise Items & Products Specification (PART 8).
    """

    def setUp(self):
        self.client = APIClient()

        # Master UOMs
        self.uom_ea = UnitOfMeasure.objects.create(
            code="EA",
            name="Each",
            dimension=UnitOfMeasure.Dimension.COUNT,
            allow_fractional_quantity=False,
            is_active=True,
        )
        self.uom_box = UnitOfMeasure.objects.create(
            code="BOX",
            name="Box of 12",
            dimension=UnitOfMeasure.Dimension.COUNT,
            allow_fractional_quantity=False,
            is_active=True,
        )
        self.uom_ctn = UnitOfMeasure.objects.create(
            code="CTN",
            name="Carton of 10 Boxes",
            dimension=UnitOfMeasure.Dimension.COUNT,
            allow_fractional_quantity=False,
            is_active=True,
        )
        self.uom_kg = UnitOfMeasure.objects.create(
            code="KG",
            name="Kilogram",
            dimension=UnitOfMeasure.Dimension.WEIGHT,
            allow_fractional_quantity=True,
            is_active=True,
        )

        # Master Category
        self.cat_main = InventoryCategory.objects.create(
            code="CAT-IND",
            name="Industrial Machinery",
            description="Heavy machinery and components",
        )

        # Master Brand
        self.brand_bosch = Brand.objects.create(
            code="BOSCH",
            name="Bosch Rexroth",
            website="https://www.boschrexroth.com",
            is_active=True,
        )

        # Master Warehouse & Location
        self.warehouse = Warehouse.objects.create(
            code="WH-MDC-01",
            name="Main Distribution Center",
            is_active=True,
        )
        self.location = StorageLocation.objects.create(
            warehouse=self.warehouse,
            code="BIN-A1-01",
            name="Bin A1-01",
            is_active=True,
        )

    # -------------------------------------------------------------------------
    # Scenario 1: Simple Product Creation & Enterprise Field Integrity
    # -------------------------------------------------------------------------
    def test_01_simple_product_creation(self):
        resp = self.client.post(
            "/api/v1/inventory/items/",
            {
                "code": "VALVE-SOL-24V",
                "name": "High Pressure Solenoid Valve 24V",
                "display_name": "HP Solenoid Valve 24V DC",
                "short_description": "24V Industrial Hydraulic Valve",
                "long_description": "Precision pilot-operated directional solenoid valve with subplate mounting.",
                "item_type": "FINISHED_GOOD",
                "classification": "CRITICAL",
                "category": self.cat_main.id,
                "brand_ref": self.brand_bosch.id,
                "base_uom": self.uom_ea.id,
                "purchase_uom": self.uom_box.id,
                "sales_uom": self.uom_ea.id,
                "weight_uom": self.uom_kg.id,
                "standard_cost": "145.50",
                "list_price": "280.00",
                "reorder_point": "15",
                "track_inventory": True,
                "is_stockable": True,
                "is_purchasable": True,
                "is_salable": True,
                "allow_negative_stock": False,
                "batch_tracking_required": True,
                "serial_tracking_required": True,
                "expiry_tracking_required": False,
                "net_weight": "1.450",
                "gross_weight": "1.600",
                "length": "18.5",
                "width": "8.0",
                "height": "7.5",
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        item = InventoryItem.objects.get(code="VALVE-SOL-24V")

        # Verify enterprise fields & auto-sync invariants
        self.assertEqual(item.base_uom, self.uom_ea)
        self.assertEqual(item.base_unit, "EA")
        self.assertEqual(item.brand_ref, self.brand_bosch)
        self.assertEqual(item.brand, "Bosch Rexroth")
        self.assertEqual(item.status, "ACTIVE")
        self.assertTrue(item.is_active)
        self.assertEqual(item.standard_cost, Decimal("145.50"))
        self.assertEqual(item.list_price, Decimal("280.00"))
        self.assertEqual(item.net_weight, Decimal("1.450"))
        self.assertTrue(item.track_inventory)
        self.assertTrue(item.batch_tracking_required)
        self.assertTrue(item.serial_tracking_required)

    def test_api_rejects_invalid_item_measurements_and_missing_base_uom(self):
        response = self.client.post(
            "/api/v1/inventory/items/",
            {
                "code": "INVALID-WEIGHT",
                "name": "Invalid Weight Item",
                "category": self.cat_main.id,
                "base_uom": self.uom_ea.id,
                "net_weight": "2.000",
                "gross_weight": "1.000",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("gross_weight", response.data)
        self.assertFalse(InventoryItem.objects.filter(code="INVALID-WEIGHT").exists())

        response = self.client.post(
            "/api/v1/inventory/items/",
            {
                "code": "MISSING-BASE-UOM",
                "name": "Missing Base UOM",
                "category": self.cat_main.id,
                "track_inventory": True,
                "is_stockable": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("base_uom", response.data)
        self.assertFalse(InventoryItem.objects.filter(code="MISSING-BASE-UOM").exists())

    def test_category_api_rejects_circular_parent_update(self):
        parent = InventoryCategory.objects.create(code="CYCLE-P", name="Cycle Parent")
        child = InventoryCategory.objects.create(
            code="CYCLE-C", name="Cycle Child", parent=parent
        )
        response = self.client.patch(
            f"/api/v1/inventory/categories/{parent.id}/",
            {"parent": child.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", response.data)
        parent.refresh_from_db()
        self.assertIsNone(parent.parent)

    def test_item_api_rejects_subcategory_from_another_category(self):
        category = InventoryCategory.objects.create(code="SUBCAT-MAIN", name="Main Category")
        other_category = InventoryCategory.objects.create(code="SUBCAT-OTHER", name="Other Category")
        subcategory = InventoryCategory.objects.create(
            code="SUBCAT-CHILD", name="Child Category", parent=other_category
        )
        response = self.client.post(
            "/api/v1/inventory/items/",
            {
                "code": "INVALID-SUBCATEGORY",
                "name": "Invalid Subcategory Item",
                "category": category.id,
                "subcategory": subcategory.id,
                "base_uom": self.uom_ea.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("subcategory", response.data)
        self.assertFalse(InventoryItem.objects.filter(code="INVALID-SUBCATEGORY").exists())

    def test_product_uom_conversion_accepts_codes_and_rejects_incompatible_dimensions(self):
        item = InventoryItem.objects.create(
            code="UOM-CONVERSION-ITEM",
            name="UOM Conversion Item",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        response = self.client.post(
            "/api/v1/inventory/product-uom-conversions/",
            {
                "item": item.id,
                "from_uom": self.uom_ea.code,
                "to_uom": self.uom_kg.code,
                "conversion_factor": "2.0",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("to_uom", response.data)
        self.assertFalse(ProductUnitConversion.objects.filter(item=item).exists())

        response = self.client.post(
            "/api/v1/inventory/product-uom-conversions/",
            {
                "item": item.id,
                "from_uom": self.uom_box.code,
                "to_uom": self.uom_ea.code,
                "conversion_factor": "12.0",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["from_uom_code"], self.uom_box.code)
        self.assertEqual(response.data["to_uom_code"], self.uom_ea.code)

    def test_unit_api_rejects_incompatible_base_unit_and_persists_conversion_settings(self):
        response = self.client.post(
            "/api/v1/inventory/units/",
            {
                "code": "BAD-WEIGHT-UNIT",
                "name": "Bad Weight Unit",
                "dimension": UnitOfMeasure.Dimension.WEIGHT,
                "is_base": False,
                "base_unit": self.uom_ea.id,
                "conversion_factor": "2",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("base_unit", response.data)

        response = self.client.post(
            "/api/v1/inventory/units/",
            {
                "code": "FRACTIONAL-BOX",
                "name": "Fractional Box",
                "dimension": UnitOfMeasure.Dimension.COUNT,
                "is_base": False,
                "base_unit": self.uom_ea.id,
                "conversion_factor": "12",
                "allow_fractional_quantity": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        unit = UnitOfMeasure.objects.get(code="FRACTIONAL-BOX")
        self.assertEqual(unit.base_unit, self.uom_ea)
        self.assertEqual(unit.conversion_factor, Decimal("12.0000"))
        self.assertTrue(unit.allow_fractional_quantity)

    # -------------------------------------------------------------------------
    # Scenario 2: Product with Cartesian Variant Generation
    # -------------------------------------------------------------------------
    def test_02_product_cartesian_variant_generation(self):
        parent = InventoryItem.objects.create(
            code="APPAREL-TEE",
            name="Performance Tech T-Shirt",
            category=self.cat_main,
            base_uom=self.uom_ea,
            has_variants=True,
        )

        attr_color = ProductAttribute.objects.create(
            code="COLOR", name="Color", is_variant_generator=True
        )
        ItemAttributeValue.objects.create(item=parent, attribute=attr_color)
        ProductAttributeValue.objects.create(attribute=attr_color, value="Black")
        ProductAttributeValue.objects.create(attribute=attr_color, value="Navy")

        attr_size = ProductAttribute.objects.create(
            code="SIZE", name="Size", is_variant_generator=True
        )
        ItemAttributeValue.objects.create(item=parent, attribute=attr_size)
        ProductAttributeValue.objects.create(attribute=attr_size, value="M")
        ProductAttributeValue.objects.create(attribute=attr_size, value="L")

        # Generate 2x2 = 4 variants
        variants = VariantMatrixService.generate_matrix(
            item=parent,
            sku_prefix="TEE",
            attributes_config=[
                {"attribute_code": "COLOR", "values": ["Black", "Navy"]},
                {"attribute_code": "SIZE", "values": ["M", "L"]},
            ],
        )

        self.assertEqual(len(variants), 4)
        parent.refresh_from_db()
        self.assertTrue(parent.has_variants)
        self.assertEqual(parent.variants.count(), 4)

        skus = set(parent.variants.values_list("sku", flat=True))
        expected_skus = {"TEE-BLACK-M", "TEE-BLACK-L", "TEE-NAVY-M", "TEE-NAVY-L"}
        self.assertEqual(skus, expected_skus)

        for v in parent.variants.all():
            self.assertTrue(len(v.barcode) >= 12)
            self.assertEqual(v.attribute_assignments.count(), 2)

    def test_variant_generation_api_uses_attribute_selection_and_sku_prefix(self):
        item = InventoryItem.objects.create(
            code="API-VARIANT",
            name="API Variant Product",
            category=self.cat_main,
            base_uom=self.uom_ea,
            has_variants=True,
        )
        attribute = ProductAttribute.objects.create(
            code="API-COLOR", name="Color", is_variant_generator=True
        )
        ItemAttributeValue.objects.create(item=item, attribute=attribute)
        ProductAttributeValue.objects.create(attribute=attribute, value="Blue")

        response = self.client.post(
            f"/api/v1/inventory/items/{item.id}/generate-variants/",
            {
                "attribute_selection": {"API-COLOR": ["Blue"]},
                "sku_prefix": "CUSTOM-PREFIX",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["variants"][0]["sku"], "CUSTOM-PREFIX-BLUE")

    def test_variant_matrix_rejects_attributes_not_assigned_to_parent(self):
        item = InventoryItem.objects.create(
            code="UNASSIGNED-VARIANT",
            name="Unassigned Variant Product",
            category=self.cat_main,
            base_uom=self.uom_ea,
            has_variants=True,
        )
        attribute = ProductAttribute.objects.create(
            code="UNASSIGNED-COLOR", name="Color", is_variant_generator=True
        )
        ProductAttributeValue.objects.create(attribute=attribute, value="Red")

        with self.assertRaisesMessage(
            ValidationError, "Assign variant attributes to the parent item first."
        ):
            VariantMatrixService.generate_matrix(
                item=item,
                attribute_value_selection={"UNASSIGNED-COLOR": ["Red"]},
            )

    def test_variant_api_generates_sku_and_saves_valid_attribute_assignments(self):
        item = InventoryItem.objects.create(
            code="TSH",
            name="T-Shirt",
            category=self.cat_main,
            base_uom=self.uom_ea,
            has_variants=True,
        )
        color = ProductAttribute.objects.create(
            code="TSH-COLOR", name="Color", is_variant_generator=True
        )
        red = ProductAttributeValue.objects.create(attribute=color, value="Red")
        ItemAttributeValue.objects.create(item=item, attribute=color)

        preview = self.client.post(
            "/api/v1/inventory/variants/sku-preview/",
            {
                "item": item.id,
                "selected_attributes": [
                    {"attribute_id": color.id, "value_id": red.id}
                ],
            },
            format="json",
        )
        self.assertEqual(preview.status_code, status.HTTP_200_OK, preview.data)
        self.assertEqual(preview.data["sku"], "TSH-RED")
        self.assertFalse(InventoryItemVariant.objects.exists())

        response = self.client.post(
            "/api/v1/inventory/variants/",
            {
                "item": item.id,
                "selected_attributes": [
                    {"attribute_id": color.id, "value_id": red.id}
                ],
                "variant_name": "A manually entered name",
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        variant = InventoryItemVariant.objects.get(item=item)
        self.assertEqual(variant.sku, "TSH-RED")
        self.assertEqual(variant.variant_name, "T-Shirt - Red")
        self.assertEqual(variant.barcode, "")
        self.assertEqual(variant.description, "")
        self.assertEqual(variant.attribute_assignments.count(), 1)
        self.assertEqual(response.data["status"], "ACTIVE")

        duplicate = self.client.post(
            "/api/v1/inventory/variants/",
            {
                "item": item.id,
                "selected_attributes": [
                    {"attribute_id": color.id, "value_id": red.id}
                ],
            },
            format="json",
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("selected_attributes", duplicate.data)
        self.assertEqual(InventoryItemVariant.objects.filter(item=item).count(), 1)

    def test_variant_api_rejects_ineligible_parent_and_invalid_attribute_values(self):
        item = InventoryItem.objects.create(
            code="NO-VARIANTS",
            name="Not Variant Enabled",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        attribute = ProductAttribute.objects.create(
            code="INVALID-COLOR", name="Color", is_variant_generator=True
        )
        value = ProductAttributeValue.objects.create(attribute=attribute, value="Blue")

        response = self.client.post(
            "/api/v1/inventory/variants/",
            {
                "item": item.id,
                "selected_attributes": [
                    {"attribute_id": attribute.id, "value_id": value.id}
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("item", response.data)
        self.assertFalse(InventoryItemVariant.objects.exists())

        item.has_variants = True
        item.save(update_fields=["has_variants"])
        ItemAttributeValue.objects.create(item=item, attribute=attribute)
        assigned_attribute = ProductAttribute.objects.create(
            code="ASSIGNED-COLOR", name="Assigned Color", is_variant_generator=True
        )
        assigned_value = ProductAttributeValue.objects.create(
            attribute=assigned_attribute, value="Blue"
        )
        response = self.client.post(
            "/api/v1/inventory/variants/",
            {
                "item": item.id,
                "selected_attributes": [
                    {"attribute_id": assigned_attribute.id, "value_id": assigned_value.id}
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assigned", str(response.data).lower())

        inactive_attribute = ProductAttribute.objects.create(
            code="INACTIVE-COLOR",
            name="Inactive Color",
            is_variant_generator=True,
            is_active=False,
        )
        inactive_value = ProductAttributeValue.objects.create(
            attribute=inactive_attribute, value="Black"
        )
        response = self.client.post(
            "/api/v1/inventory/variants/",
            {
                "item": item.id,
                "selected_attributes": [
                    {"attribute_id": inactive_attribute.id, "value_id": inactive_value.id}
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("selected_attributes", response.data)
        self.assertFalse(InventoryItemVariant.objects.exists())

    def test_item_variant_attribute_assignments_filter_variant_form_options(self):
        item = InventoryItem.objects.create(
            code="ASSIGNED-ITEM",
            name="Assigned Item",
            category=self.cat_main,
            base_uom=self.uom_ea,
            has_variants=True,
        )
        assigned_attribute = ProductAttribute.objects.create(
            code="ITEM-COLOR", name="Color", is_variant_generator=True
        )
        ProductAttributeValue.objects.create(
            attribute=assigned_attribute, value="Red"
        )
        unrelated_attribute = ProductAttribute.objects.create(
            code="ITEM-SIZE", name="Size", is_variant_generator=True
        )
        ProductAttributeValue.objects.create(
            attribute=unrelated_attribute, value="Medium"
        )

        update = self.client.patch(
            f"/api/v1/inventory/items/{item.id}/",
            {"variant_attribute_ids": [assigned_attribute.id]},
            format="json",
        )
        self.assertEqual(update.status_code, status.HTTP_200_OK, update.data)

        response = self.client.get(
            f"/api/v1/inventory/items/{item.id}/variant-attributes/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(
            [attribute["id"] for attribute in response.data],
            [assigned_attribute.id],
        )

    def test_variant_attribute_catalogue_returns_active_generator_values(self):
        active_attribute = ProductAttribute.objects.create(
            code="CATALOG-COLOR",
            name="Color",
            is_variant_generator=True,
        )
        ProductAttributeValue.objects.create(
            attribute=active_attribute,
            value="Blue",
            is_active=True,
        )
        ProductAttribute.objects.create(
            code="CATALOG-DESCRIPTION",
            name="Description",
            is_variant_generator=False,
        )

        response = self.client.get(
            "/api/v1/inventory/attributes/?is_variant_generator=true&is_active=true"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        attributes = response.data["results"]
        self.assertEqual([attribute["id"] for attribute in attributes], [active_attribute.id])
        self.assertEqual(attributes[0]["values"][0]["value"], "Blue")

    def test_existing_item_can_be_enabled_for_variant_parent_dropdown(self):
        item = InventoryItem.objects.create(
            code="ENABLE-VARIANTS",
            name="Item Before Variant Setup",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        other_item = InventoryItem.objects.create(
            code="NOT-VARIANT-ENABLED",
            name="Unconfigured Item",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        response = self.client.patch(
            f"/api/v1/inventory/items/{item.id}/",
            {"has_variants": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        all_items = self.client.get("/api/v1/inventory/items/")
        self.assertEqual(all_items.status_code, status.HTTP_200_OK)
        all_item_ids = [record["id"] for record in all_items.data["results"]]
        self.assertIn(item.id, all_item_ids)
        self.assertIn(other_item.id, all_item_ids)

        eligible_items = self.client.get(
            "/api/v1/inventory/items/?has_variants=true&is_active=true"
        )
        self.assertEqual(eligible_items.status_code, status.HTTP_200_OK)
        item_ids = [record["id"] for record in eligible_items.data["results"]]
        self.assertIn(item.id, item_ids)
        self.assertNotIn(other_item.id, item_ids)

    def test_item_with_variants_cannot_be_disabled_for_variant_parent_dropdown(self):
        item = InventoryItem.objects.create(
            code="KEEP-VARIANTS",
            name="Item With Variants",
            category=self.cat_main,
            base_uom=self.uom_ea,
            has_variants=True,
        )
        InventoryItemVariant.objects.create(
            item=item,
            sku="KEEP-VARIANTS-RED",
            variant_name="Item With Variants - Red",
        )

        response = self.client.patch(
            f"/api/v1/inventory/items/{item.id}/",
            {"has_variants": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("has_variants", response.data)

    def test_variant_api_adds_suffix_when_generated_sku_is_already_in_use(self):
        existing_parent = InventoryItem.objects.create(
            code="EXISTING-SKU-PARENT",
            name="Existing SKU Parent",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        InventoryItemVariant.objects.create(
            item=existing_parent,
            sku="TSH-RED",
            variant_name="Existing red variant",
        )
        item = InventoryItem.objects.create(
            code="TSH",
            name="T-Shirt",
            category=self.cat_main,
            base_uom=self.uom_ea,
            has_variants=True,
        )
        attribute = ProductAttribute.objects.create(
            code="SUFFIX-COLOR", name="Color", is_variant_generator=True
        )
        value = ProductAttributeValue.objects.create(attribute=attribute, value="Red")
        ItemAttributeValue.objects.create(item=item, attribute=attribute)

        response = self.client.post(
            "/api/v1/inventory/variants/",
            {
                "item": item.id,
                "selected_attributes": [
                    {"attribute_id": attribute.id, "value_id": value.id}
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["sku"], "TSH-RED-2")
        self.assertEqual(
            InventoryItemVariant.objects.filter(sku__iexact="TSH-RED-2").count(), 1
        )

    def test_variant_patch_updates_details_and_status_without_changing_sku(self):
        item = InventoryItem.objects.create(
            code="EDIT-PARENT",
            name="Editable Item",
            category=self.cat_main,
            base_uom=self.uom_ea,
            has_variants=True,
        )
        attribute = ProductAttribute.objects.create(
            code="EDIT-COLOR", name="Color", is_variant_generator=True
        )
        value = ProductAttributeValue.objects.create(attribute=attribute, value="Green")
        ItemAttributeValue.objects.create(item=item, attribute=attribute)
        create_response = self.client.post(
            "/api/v1/inventory/variants/",
            {
                "item": item.id,
                "selected_attributes": [
                    {"attribute_id": attribute.id, "value_id": value.id}
                ],
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED, create_response.data)
        variant = InventoryItemVariant.objects.get(pk=create_response.data["id"])

        response = self.client.patch(
            f"/api/v1/inventory/variants/{variant.id}/",
            {
                "variant_name": "Green Editable Item",
                "description": "Optional detail",
                "status": "INACTIVE",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        variant.refresh_from_db()
        self.assertEqual(variant.sku, "EDIT-PARENT-GREEN")
        self.assertEqual(variant.variant_name, "Green Editable Item")
        self.assertEqual(variant.description, "Optional detail")
        self.assertFalse(variant.is_active)
        self.assertEqual(response.data["status"], "INACTIVE")

    # -------------------------------------------------------------------------
    # Scenario 3: Category Hierarchy & Circular Reference Prevention
    # -------------------------------------------------------------------------
    def test_03_category_hierarchy_and_circular_reference_prevention(self):
        cat_parent = InventoryCategory.objects.create(code="ELEC", name="Electronics")
        cat_child = InventoryCategory.objects.create(
            code="COMP", name="Computers", parent=cat_parent
        )

        # Attempt circular parent reference
        cat_parent.parent = cat_child
        with self.assertRaises(ValidationError):
            cat_parent.clean()

        # Verify safe delete protection when items depend on category
        InventoryItem.objects.create(
            code="ITEM-CAT-PROT",
            name="Protected Item",
            category=cat_child,
            base_uom=self.uom_ea,
        )
        del_resp = self.client.delete(f"/api/v1/inventory/categories/{cat_child.id}/")
        self.assertEqual(del_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", del_resp.data)

    # -------------------------------------------------------------------------
    # Scenario 4: Brand Assignment & Referential Integrity
    # -------------------------------------------------------------------------
    def test_04_brand_assignment_and_referential_integrity(self):
        brand = Brand.objects.create(code="SKF", name="SKF Bearings", website="https://skf.com")
        item = InventoryItem.objects.create(
            code="BRG-SKF-01",
            name="SKF Ball Bearing",
            brand_ref=brand,
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        self.assertEqual(item.brand, "SKF Bearings")

        # Safe delete protection
        del_resp = self.client.delete(f"/api/v1/inventory/brands/{brand.id}/")
        self.assertEqual(del_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", del_resp.data)

    # -------------------------------------------------------------------------
    # Scenario 5: Base, Purchase & Sales UOM Conversions
    # -------------------------------------------------------------------------
    def test_05_base_purchase_and_sales_uom_conversions(self):
        item = InventoryItem.objects.create(
            code="CONV-ITEM-01",
            name="UOM Conversion Item",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )

        # 1 BOX = 12 EA
        ProductUnitConversion.objects.create(
            item=item,
            from_uom=self.uom_box,
            to_uom=self.uom_ea,
            conversion_factor=Decimal("12.0"),
        )
        # 1 CTN = 10 BOX
        ProductUnitConversion.objects.create(
            item=item,
            from_uom=self.uom_ctn,
            to_uom=self.uom_box,
            conversion_factor=Decimal("10.0"),
        )

        # Convert 2 BOX to EA -> 24 EA
        qty_ea, factor = UOMConversionService.convert_quantity(
            item=item, quantity=Decimal("2"), from_uom_ref="BOX", to_uom_ref="EA"
        )
        self.assertEqual(qty_ea, Decimal("24"))

        # Convert 1 CTN to EA -> 10 * 12 = 120 EA (Multi-step)
        qty_ctn_ea, factor = UOMConversionService.convert_quantity(
            item=item, quantity=Decimal("1"), from_uom_ref="CTN", to_uom_ref="EA"
        )
        self.assertEqual(qty_ctn_ea, Decimal("120"))

        # Incompatible dimension check without product conversion
        with self.assertRaises(ValidationError):
            UOMConversionService.convert_quantity(
                item=item, quantity=Decimal("5"), from_uom_ref="EA", to_uom_ref="KG"
            )

    # -------------------------------------------------------------------------
    # Scenario 6: Fractional Quantity Precision Rules
    # -------------------------------------------------------------------------
    def test_06_fractional_quantity_precision(self):
        self.assertFalse(self.uom_ea.allow_fractional_quantity)
        with self.assertRaises(ValidationError):
            UOMConversionService.validate_fractional_allowed("EA", Decimal("2.5"))

        self.assertTrue(self.uom_kg.allow_fractional_quantity)
        UOMConversionService.validate_fractional_allowed("KG", Decimal("2.755"))

    # -------------------------------------------------------------------------
    # Scenario 7: Product Attribute Configuration & Values
    # -------------------------------------------------------------------------
    def test_07_attribute_configuration_and_values(self):
        attr = ProductAttribute.objects.create(
            code="STORAGE_CAP",
            name="Storage Capacity",
            data_type="TEXT",
            is_variant_generator=True,
            is_searchable=True,
            is_filterable=True,
        )
        ProductAttributeValue.objects.create(attribute=attr, value="256GB")
        ProductAttributeValue.objects.create(attribute=attr, value="512GB")

        resp = self.client.get(f"/api/v1/inventory/attributes/{attr.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["values"]), 2)
        values = [v["value"] for v in resp.data["values"]]
        self.assertIn("256GB", values)

    def test_attribute_creation_validates_and_saves_configurable_fields(self):
        response = self.client.post(
            "/api/v1/inventory/attributes/",
            {
                "code": "  color ",
                "name": "  Color  ",
                "data_type": "SELECT",
                "is_variant_generator": True,
                "is_searchable": False,
                "is_filterable": False,
                "sort_order": 3,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["code"], "COLOR")
        self.assertEqual(response.data["name"], "Color")
        self.assertTrue(response.data["is_active"])
        self.assertFalse(response.data["is_searchable"])
        self.assertFalse(response.data["is_filterable"])
        self.assertEqual(response.data["sort_order"], 3)

        duplicate_response = self.client.post(
            "/api/v1/inventory/attributes/",
            {"code": "color", "name": "Duplicate Color"},
            format="json",
        )
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("code", duplicate_response.data)

    # -------------------------------------------------------------------------
    # Scenario 8: Duplicate SKU Prevention
    # -------------------------------------------------------------------------
    def test_08_duplicate_sku_prevention(self):
        InventoryItem.objects.create(
            code="SKU-DUP-CHECK",
            name="Item 1",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                InventoryItem.objects.create(
                    code="SKU-DUP-CHECK",
                    name="Item 2",
                    category=self.cat_main,
                    base_uom=self.uom_ea,
                )

        item = InventoryItem.objects.get(code="SKU-DUP-CHECK")
        InventoryItemVariant.objects.create(
            item=item, sku="VAR-DUP-01", variant_name="Variant 1"
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                InventoryItemVariant.objects.create(
                    item=item, sku="VAR-DUP-01", variant_name="Variant 2"
                )

    # -------------------------------------------------------------------------
    # Scenario 9: Multiple Barcode Assignments (Primary, ITF-14, Supplier)
    # -------------------------------------------------------------------------
    def test_09_multiple_barcode_assignments(self):
        item = InventoryItem.objects.create(
            code="MULTI-BC-ITEM",
            name="Multi Barcode Item",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )

        ProductBarcode.objects.create(
            item=item,
            barcode_value="890123000001",
            symbology=ProductBarcode.Symbology.EAN13,
            barcode_type=ProductBarcode.BarcodeType.PRIMARY,
            is_primary=True,
        )
        ProductBarcode.objects.create(
            item=item,
            barcode_value="10890123000008",
            symbology=ProductBarcode.Symbology.ITF14,
            barcode_type=ProductBarcode.BarcodeType.PACKAGING,
            is_primary=False,
        )
        ProductBarcode.objects.create(
            item=item,
            barcode_value="VEND-BC-7721",
            symbology=ProductBarcode.Symbology.CODE128,
            barcode_type=ProductBarcode.BarcodeType.SUPPLIER,
            is_primary=False,
        )

        self.assertEqual(item.barcodes.count(), 3)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ProductBarcode.objects.create(
                    item=item,
                    barcode_value="890123000001",
                    symbology=ProductBarcode.Symbology.EAN13,
                )

    def test_product_barcode_rejects_variant_from_another_item(self):
        item = InventoryItem.objects.create(
            code="BARCODE-PARENT",
            name="Barcode Parent",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        other_item = InventoryItem.objects.create(
            code="BARCODE-OTHER",
            name="Other Parent",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        variant = InventoryItemVariant.objects.create(
            item=other_item,
            sku="BARCODE-OTHER-V1",
            variant_name="Other variant",
        )

        response = self.client.post(
            "/api/v1/inventory/product-barcodes/",
            {
                "item": item.id,
                "variant": variant.id,
                "barcode_value": "MISMATCHED-BARCODE",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("variant", response.data)
        self.assertFalse(ProductBarcode.objects.filter(barcode_value="MISMATCHED-BARCODE").exists())

    # -------------------------------------------------------------------------
    # Scenario 10: Barcode Fast Lookup Endpoint
    # -------------------------------------------------------------------------
    def test_10_barcode_fast_lookup_endpoint(self):
        item = InventoryItem.objects.create(
            code="LOOKUP-BC-01",
            name="Lookup Fast Item",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        ProductBarcode.objects.create(
            item=item,
            barcode_value="890999888111",
            symbology=ProductBarcode.Symbology.CODE128,
            is_primary=True,
        )

        resp = self.client.get("/api/v1/inventory/items/barcode-lookup/?barcode=890999888111")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["found"])
        self.assertEqual(resp.data["item_code"], "LOOKUP-BC-01")

        # Non-existent barcode returns 200 with found=False
        resp_404 = self.client.get("/api/v1/inventory/items/barcode-lookup/?barcode=UNKNOWN9999")
        self.assertEqual(resp_404.status_code, status.HTTP_200_OK)
        self.assertFalse(resp_404.data["found"])

    # -------------------------------------------------------------------------
    # Scenario 11: Product Attachment via Shared File Storage
    # -------------------------------------------------------------------------
    def test_11_product_image_and_attachment_upload(self):
        item = InventoryItem.objects.create(
            code="DOC-ATTACH-01",
            name="Documented Part",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Title (Part Spec) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
        pdf_file = SimpleUploadedFile("part_spec.pdf", pdf_bytes, content_type="application/pdf")

        upload_resp = self.client.post("/api/v1/storage/files/", {
            "file": pdf_file,
            "owner_type": "apps.products.models.InventoryItem",
            "owner_id": str(item.id),
            "display_name": "Part Technical Datasheet",
            "is_public": False,
        }, format="multipart")
        self.assertEqual(upload_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(upload_resp.data["mime_type"], "application/pdf")

    # -------------------------------------------------------------------------
    # Scenario 12: Attachment Security Validation
    # -------------------------------------------------------------------------
    def test_12_attachment_security_validation(self):
        item = InventoryItem.objects.create(
            code="SEC-ITEM-01", name="Security Item", category=self.cat_main, base_uom=self.uom_ea
        )
        bad_file = SimpleUploadedFile("malware.exe", b"MZ\x90\x00\x03\x00\x00\x00binary executable", content_type="application/x-dosexec")

        resp = self.client.post(
            "/api/v1/storage/files/",
            {
                "file": bad_file,
                "owner_type": "apps.products.models.InventoryItem",
                "owner_id": str(item.id),
            },
            format="multipart",
        )
        self.assertIn(resp.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN])

    # -------------------------------------------------------------------------
    # Scenario 13: CSV & Excel Valid Bulk Import
    # -------------------------------------------------------------------------
    def test_13_csv_and_excel_valid_bulk_import(self):
        csv_data = (
            "code,name,category,brand,base_unit,standard_cost,list_price,item_type\n"
            "IMP-SKU-01,Imported Gear,CAT-IND,BOSCH,EA,45.00,80.00,RAW_MATERIAL\n"
            "IMP-SKU-02,Imported Shaft,CAT-IND,BOSCH,EA,35.00,60.00,RAW_MATERIAL\n"
        )
        csv_file = io.BytesIO(csv_data.encode("utf-8"))
        csv_file.name = "items.csv"

        # 1. Preview
        prev_res = ProductImportExportService.parse_and_validate(csv_file)
        self.assertEqual(prev_res["total_rows"], 2)
        self.assertEqual(prev_res["valid_rows"], 2)
        self.assertEqual(prev_res["to_create"], 2)

        # 2. Commit
        csv_file.seek(0)
        commit_res = ProductImportExportService.commit_import(csv_file)
        self.assertEqual(commit_res["created_count"], 2)
        self.assertTrue(InventoryItem.objects.filter(code="IMP-SKU-01").exists())
        self.assertTrue(InventoryItem.objects.filter(code="IMP-SKU-02").exists())

    # -------------------------------------------------------------------------
    # Scenario 14: Invalid Import Row-Level Reporting & Rollback
    # -------------------------------------------------------------------------
    def test_14_invalid_import_row_level_reporting_and_rollback(self):
        csv_data = (
            "code,name,category,brand,base_unit,standard_cost,list_price\n"
            ",Missing SKU Item,CAT-IND,BOSCH,EA,10.00,20.00\n"
            "INV-ROW-02,,CAT-IND,BOSCH,EA,10.00,20.00\n"
        )
        csv_file = io.BytesIO(csv_data.encode("utf-8"))
        csv_file.name = "invalid_items.csv"

        prev_res = ProductImportExportService.parse_and_validate(csv_file)
        self.assertEqual(prev_res["total_rows"], 2)
        self.assertEqual(prev_res["valid_rows"], 0)
        self.assertEqual(len(prev_res["errors"]), 2)

        # No corrupt records written
        self.assertFalse(InventoryItem.objects.filter(name="Missing SKU Item").exists())

    # -------------------------------------------------------------------------
    # Scenario 15: Catalog Export Streaming (CSV and XLSX)
    # -------------------------------------------------------------------------
    def test_15_catalog_export_streaming(self):
        InventoryItem.objects.create(
            code="EXP-TEST-01",
            name="Export Test Item",
            category=self.cat_main,
            base_uom=self.uom_ea,
            standard_cost=Decimal("25.00"),
        )

        # CSV Export
        resp_csv = self.client.get("/api/v1/inventory/items/export/?format=csv")
        self.assertEqual(resp_csv.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", resp_csv["Content-Type"])
        content = resp_csv.getvalue().decode("utf-8")
        self.assertIn("EXP-TEST-01", content)
        self.assertIn("Export Test Item", content)

        # XLSX Export
        resp_xlsx = self.client.get("/api/v1/inventory/items/export/?format=xlsx")
        self.assertEqual(resp_xlsx.status_code, status.HTTP_200_OK)
        self.assertIn("spreadsheetml", resp_xlsx["Content-Type"])

    # -------------------------------------------------------------------------
    # Scenario 16: Product Reuse in Purchase PO Goods Receipt
    # -------------------------------------------------------------------------
    def test_16_product_reuse_in_purchase_po_grn(self):
        item = InventoryItem.objects.create(
            code="PO-REUSE-ITEM",
            name="PO Reusable Item",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        initial_count = InventoryItem.objects.count()

        receipt_payload = {
            "purchase_order_id": "PO-9910",
            "warehouse_code": self.warehouse.code,
            "lines": [
                {
                    "item_code": "PO-REUSE-ITEM",
                    "quantity": 50,
                    "unit_cost": "15.00",
                }
            ],
        }
        InventoryPostingService.process_purchase_goods_receipt(receipt_payload)

        # Count must remain unchanged; existing item reused
        self.assertEqual(InventoryItem.objects.count(), initial_count)
        balance = StockBalance.objects.get(item=item, warehouse=self.warehouse)
        self.assertEqual(balance.on_hand_qty, Decimal("50"))

    # -------------------------------------------------------------------------
    # Scenario 17: Goods Receipt Variant & SKU Allocation
    # -------------------------------------------------------------------------
    def test_17_goods_receipt_variant_and_sku_allocation(self):
        parent = InventoryItem.objects.create(
            code="JACKET-MAIN",
            name="Winter Jacket",
            category=self.cat_main,
            base_uom=self.uom_ea,
            has_variants=True,
        )
        variant = InventoryItemVariant.objects.create(
            item=parent,
            sku="JACKET-BLK-XL",
            variant_name="Winter Jacket - Black XL",
            variant_code="BLK-XL",
        )

        receipt_payload = {
            "purchase_order_id": "PO-VAR-01",
            "warehouse_code": self.warehouse.code,
            "lines": [
                {
                    "item_code": "JACKET-MAIN",
                    "variant_sku": "JACKET-BLK-XL",
                    "quantity": 25,
                    "unit_cost": "85.00",
                }
            ],
        }
        InventoryPostingService.process_purchase_goods_receipt(receipt_payload)

        ledger = StockLedgerEntry.objects.filter(variant=variant).first()
        self.assertIsNotNone(ledger)
        self.assertEqual(ledger.item, parent)
        self.assertEqual(ledger.quantity_delta, Decimal("25"))

    # -------------------------------------------------------------------------
    # Scenario 18: Stock Balance & Ledger Decoupling from Master
    # -------------------------------------------------------------------------
    def test_18_stock_balance_and_ledger_foreign_keys(self):
        field_names = [f.name for f in InventoryItem._meta.get_fields()]
        self.assertNotIn("on_hand_qty", field_names)
        self.assertNotIn("current_stock", field_names)

    # -------------------------------------------------------------------------
    # Scenario 19: Sales Reservation & Dispatch Lifecycle
    # -------------------------------------------------------------------------
    def test_19_sales_reservation_and_dispatch_lifecycle(self):
        item = InventoryItem.objects.create(
            code="SALES-CYCLE-01",
            name="Sales Lifecycle Item",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )

        # Receive 100 units
        InventoryPostingService.process_purchase_goods_receipt({
            "purchase_order_id": "PO-CYCLE-01",
            "warehouse_code": self.warehouse.code,
            "lines": [{"item_code": "SALES-CYCLE-01", "quantity": 100, "unit_cost": "20.00"}],
        })

        # Reserve 30 units for sales order SO-001
        res = InventoryPostingService.reserve_sales_stock({
            "sales_order_id": "SO-001",
            "warehouse_code": self.warehouse.code,
            "lines": [{"item_code": "SALES-CYCLE-01", "quantity": 30}],
        })
        self.assertEqual(res["status"], "RESERVED")

        balance = StockBalance.objects.get(item=item, warehouse=self.warehouse)
        self.assertEqual(balance.on_hand_qty, Decimal("100"))
        self.assertEqual(balance.reserved_qty, Decimal("30"))
        self.assertEqual(balance.available_qty, Decimal("70"))

        # Dispatch 30 units
        disp = InventoryPostingService.dispatch_sales_stock({
            "sales_order_id": "SO-001",
            "dispatch_ref": "DN-001",
            "warehouse_code": self.warehouse.code,
            "lines": [{"item_code": "SALES-CYCLE-01", "quantity": 30}],
        })
        self.assertEqual(disp["status"], "DISPATCHED")

        balance.refresh_from_db()
        self.assertEqual(balance.on_hand_qty, Decimal("70"))
        self.assertEqual(balance.reserved_qty, Decimal("0"))
        self.assertEqual(balance.available_qty, Decimal("70"))

    # -------------------------------------------------------------------------
    # Scenario 20: Inactive Product Transaction Restrictions
    # -------------------------------------------------------------------------
    def test_20_inactive_product_transaction_restrictions(self):
        InventoryItem.objects.create(
            code="INACTIVE-ITEM-01",
            name="Decommissioned Item",
            category=self.cat_main,
            base_uom=self.uom_ea,
            status="INACTIVE",
            is_active=False,
        )

        with self.assertRaises(ValidationError) as ctx:
            InventoryPostingService.process_purchase_goods_receipt({
                "purchase_order_id": "PO-INACT",
                "warehouse_code": self.warehouse.code,
                "lines": [{"item_code": "INACTIVE-ITEM-01", "quantity": 10}],
            })
        self.assertIn("inactive", str(ctx.exception).lower())

    # -------------------------------------------------------------------------
    # Scenario 21: Permissions & RBAC Guard
    # -------------------------------------------------------------------------
    def test_21_permissions_and_rbac(self):
        resp = self.client.get("/api/v1/inventory/items/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        item = InventoryItem.objects.create(
            code="RBAC-TEST-01",
            name="RBAC Item",
            category=self.cat_main,
            base_uom=self.uom_ea,
            status="ACTIVE",
        )
        deact_resp = self.client.post(f"/api/v1/inventory/items/{item.id}/deactivate/")
        self.assertEqual(deact_resp.status_code, status.HTTP_200_OK)
        item.refresh_from_db()
        self.assertFalse(item.is_active)
        self.assertIn(item.status, ["DISCONTINUED", "INACTIVE"])

    # -------------------------------------------------------------------------
    # Scenario 22: Concurrent Duplicate SKU Prevention
    # -------------------------------------------------------------------------
    def test_22_concurrent_duplicate_sku_prevention(self):
        sku = "CONCURRENT-SKU-99"
        InventoryItem.objects.create(
            code=sku, name="Thread 1 Item", category=self.cat_main, base_uom=self.uom_ea
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                InventoryItem.objects.create(
                    code=sku, name="Thread 2 Item", category=self.cat_main, base_uom=self.uom_ea
                )

    # -------------------------------------------------------------------------
    # Scenario 23: Historical Ledger Immutability on Master Changes
    # -------------------------------------------------------------------------
    def test_23_historical_ledger_immutability_on_master_change(self):
        item = InventoryItem.objects.create(
            code="IMMUTABLE-TEST",
            name="Original Name",
            category=self.cat_main,
            base_uom=self.uom_ea,
        )
        ProductUnitConversion.objects.create(
            item=item,
            from_uom=self.uom_box,
            to_uom=self.uom_ea,
            conversion_factor=Decimal("12.0"),
        )

        # Post receipt with UOM="BOX"
        InventoryPostingService.process_purchase_goods_receipt({
            "purchase_order_id": "PO-IMMUT-01",
            "warehouse_code": self.warehouse.code,
            "lines": [{
                "item_code": "IMMUTABLE-TEST",
                "quantity": 5,
                "uom": "BOX",
                "unit_cost": "120.00",
            }],
        })

        ledger = StockLedgerEntry.objects.filter(item=item).first()
        self.assertEqual(ledger.transaction_uom, "BOX")
        self.assertEqual(ledger.conversion_factor_at_txn, Decimal("12.0"))
        self.assertEqual(ledger.quantity_delta, Decimal("60.0"))  # 5 * 12

        # Change product name and modify future conversion factor
        item.name = "Altered Master Name"
        item.save()
        conv = ProductUnitConversion.objects.get(item=item, from_uom=self.uom_box)
        conv.conversion_factor = Decimal("10.0")
        conv.save()

        # Past ledger entry MUST NOT mutate
        ledger.refresh_from_db()
        self.assertEqual(ledger.conversion_factor_at_txn, Decimal("12.0"))
        self.assertEqual(ledger.quantity_delta, Decimal("60.0"))
