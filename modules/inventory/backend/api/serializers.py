from django.db import transaction

from decimal import Decimal
import re

from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import serializers

from apps.categories.models import InventoryCategory

from apps.brands.models import Brand

from apps.units.models import UnitOfMeasure

from apps.products.models import (

    ProductImportHistory,

    InventoryItem,

    InventoryItemVariant,

    ProductAttribute,

    ProductAttributeValue,

    ProductBarcode,

    ProductUnitConversion,

    ItemAttributeValue,

)

from apps.warehouses.models import Warehouse, StorageLocation, Rack, Bin, WarehouseZone, WarehouseMapping, WarehouseConfiguration, WarehouseOperationalConfiguration

from apps.stock.models import StockBalance, StockLedgerEntry, DamagedStock

from apps.movements.models import StockTransaction, StockTransactionLine

from apps.valuation.models import InventoryValuation

from apps.reservations.models import StockReservation

from apps.reconciliation.models import StockCount, StockCountLine, CycleCount, FullStockCount, AuditHistory

from apps.batches.models import (
    Batch,
    BatchQuarantineRecord,
    ShelfLifePolicy,
    ProductRecall,
    RecallAction,
    AllocationRecord,
)

from apps.serial_numbers.models import SerialNumber

from apps.planning.models import ReorderRule, StockLevel, ReplenishmentPlan, PurchaseSuggestion

class CategorySerializer(serializers.ModelSerializer):

    class Meta:

        model = InventoryCategory

        fields = "__all__"

    def validate_parent(self, parent):

        ancestor = parent

        while ancestor is not None:

            if self.instance and ancestor.pk == self.instance.pk:

                raise serializers.ValidationError("A category cannot be its own descendant.")

            ancestor = ancestor.parent

        return parent

class BrandSerializer(serializers.ModelSerializer):

    class Meta:

        model = Brand

        fields = "__all__"

class UnitOfMeasureSerializer(serializers.ModelSerializer):

    base_unit_code = serializers.CharField(source="base_unit.code", read_only=True)

    class Meta:

        model = UnitOfMeasure

        fields = "__all__"

    def validate(self, attrs):

        base_unit = attrs.get("base_unit", getattr(self.instance, "base_unit", None))

        dimension = attrs.get("dimension", getattr(self.instance, "dimension", None))

        is_base = attrs.get("is_base", getattr(self.instance, "is_base", True))

        conversion_factor = attrs.get(

            "conversion_factor", getattr(self.instance, "conversion_factor", Decimal("1"))

        )

        errors = {}

        if conversion_factor <= 0:

            errors["conversion_factor"] = "Conversion factor must be greater than zero."

        if is_base and base_unit:

            errors["base_unit"] = "A base unit cannot reference another base unit."

        if is_base and conversion_factor != Decimal("1"):

            errors["conversion_factor"] = "A base unit must have a conversion factor of 1."

        if not is_base and not base_unit:

            errors["base_unit"] = "A derived unit must reference a registered base unit."

        if base_unit and not base_unit.is_base:

            errors["base_unit"] = "Select a base unit, not another derived unit."

        if base_unit and dimension != base_unit.dimension:

            errors["base_unit"] = "Base unit must have the same dimension."

        if errors:

            raise serializers.ValidationError(errors)

        return attrs

class ProductAttributeValueSerializer(serializers.ModelSerializer):

    class Meta:

        model = ProductAttributeValue

        fields = "__all__"

class ProductAttributeSerializer(serializers.ModelSerializer):

    values = ProductAttributeValueSerializer(many=True, read_only=True)

    class Meta:

        model = ProductAttribute

        fields = (
            "id",
            "code",
            "name",
            "data_type",
            "is_variant_generator",
            "is_searchable",
            "is_filterable",
            "sort_order",
            "is_active",
            "values",
            "created_at",
            "updated_at",
        )

        read_only_fields = ("id", "values", "created_at", "updated_at")

    def validate_code(self, value):
        code = value.strip().upper()
        if not code or not re.fullmatch(r"[A-Z0-9_-]+", code):
            raise serializers.ValidationError(
                "Use only letters, numbers, underscores, and hyphens."
            )
        duplicate = ProductAttribute.objects.filter(code__iexact=code)
        if self.instance:
            duplicate = duplicate.exclude(pk=self.instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError("An attribute with this code already exists.")
        return code

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Attribute name cannot be empty.")
        return name

class ProductBarcodeSerializer(serializers.ModelSerializer):

    variant_sku = serializers.CharField(source="variant.sku", read_only=True, default="")

    def validate(self, attrs):
        item = attrs.get("item", getattr(self.instance, "item", None))
        variant = attrs.get("variant", getattr(self.instance, "variant", None))
        if variant and item and variant.item_id != item.pk:
            raise serializers.ValidationError(
                {"variant": "The selected variant must belong to the selected item."}
            )
        return attrs

    class Meta:

        model = ProductBarcode

        fields = "__all__"

class ProductUnitConversionSerializer(serializers.ModelSerializer):

    from_uom_code = serializers.CharField(source="from_uom.code", read_only=True)

    to_uom_code = serializers.CharField(source="to_uom.code", read_only=True)

    from_uom_name = serializers.CharField(source="from_uom.name", read_only=True)

    to_uom_name = serializers.CharField(source="to_uom.name", read_only=True)

    class Meta:

        model = ProductUnitConversion

        fields = "__all__"

    def to_internal_value(self, data):

        data = data.copy() if hasattr(data, "copy") else dict(data)

        for field in ("from_uom", "to_uom"):

            code = data.get(field)

            if isinstance(code, str) and not code.isdigit():

                unit = UnitOfMeasure.objects.filter(code=code).first()

                if unit is None:

                    raise serializers.ValidationError(

                        {field: "Select a registered unit of measure."}

                    )

                data[field] = unit.pk

        return super().to_internal_value(data)

    def validate(self, attrs):

        from_uom = attrs.get("from_uom", getattr(self.instance, "from_uom", None))

        to_uom = attrs.get("to_uom", getattr(self.instance, "to_uom", None))

        if from_uom and to_uom and from_uom.dimension != to_uom.dimension:

            raise serializers.ValidationError(

                {"to_uom": "Unit conversions must use units with the same dimension."}

            )

        return attrs

class ItemAttributeValueSerializer(serializers.ModelSerializer):

    attribute_code = serializers.CharField(source="attribute.code", read_only=True)

    attribute_name = serializers.CharField(source="attribute.name", read_only=True)

    attribute_data_type = serializers.CharField(source="attribute.data_type", read_only=True)

    value_display = serializers.SerializerMethodField()

    class Meta:

        model = ItemAttributeValue

        fields = "__all__"

    def get_value_display(self, obj):

        return obj.attribute_value.value if obj.attribute_value else obj.custom_value

class ItemVariantSerializer(serializers.ModelSerializer):

    item_code = serializers.CharField(source="item.code", read_only=True)

    item_name = serializers.CharField(source="item.name", read_only=True)

    variant_name = serializers.CharField(
        required=False, allow_blank=True, max_length=150
    )

    selected_attributes = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )

    multi_barcodes = ProductBarcodeSerializer(many=True, read_only=True)

    attribute_assignments = ItemAttributeValueSerializer(many=True, read_only=True)

    class Meta:

        model = InventoryItemVariant

        fields = (
            "id", "item", "item_code", "item_name", "sku", "variant_code",
            "variant_name", "barcode", "description", "attributes",
            "selected_attributes", "attribute_assignments", "multi_barcodes",
            "status", "additional_cost", "additional_price", "weight", "image_id",
            "is_active", "created_at", "updated_at",
        )

        read_only_fields = (
            "id", "sku", "variant_code", "attributes", "attribute_assignments",
            "multi_barcodes", "is_active", "created_at", "updated_at",
        )

    def get_fields(self):
        fields = super().get_fields()
        if self.instance is not None:
            fields["item"].read_only = True
            fields["selected_attributes"].read_only = True
        return fields

    def validate(self, attrs):
        status_value = attrs.get("status", "ACTIVE")
        if status_value not in ("ACTIVE", "INACTIVE", "DISCONTINUED"):
            raise serializers.ValidationError(
                {"status": "Status must be Active or Inactive."}
            )
        if not self.instance and not attrs.get("selected_attributes"):
            raise serializers.ValidationError(
                {"selected_attributes": "Select at least one attribute and value."}
            )
        return attrs

    def create(self, validated_data):
        from services.variant_catalog_service import VariantCatalogService
        from django.core.exceptions import ValidationError as DjangoValidationError

        selected_attributes = validated_data.pop("selected_attributes")
        item = validated_data.pop("item")
        variant_name = validated_data.pop("variant_name", "")
        status_value = validated_data.pop("status", "ACTIVE")
        try:
            return VariantCatalogService.create_variant(
                item_id=item.pk,
                selections=selected_attributes,
                variant_name=variant_name,
                status=status_value,
                **validated_data,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                getattr(exc, "message_dict", {"selected_attributes": exc.messages})
            ) from exc

    def update(self, instance, validated_data):
        status_value = validated_data.pop("status", None)
        if status_value:
            instance.is_active = status_value == "ACTIVE"
            instance.status = "ACTIVE" if instance.is_active else "DISCONTINUED"
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["status"] = "ACTIVE" if instance.is_active else "INACTIVE"
        return data

class InventoryItemSerializer(serializers.ModelSerializer):

    variants = ItemVariantSerializer(many=True, read_only=True)

    multi_barcodes = ProductBarcodeSerializer(many=True, read_only=True)

    uom_conversions = ProductUnitConversionSerializer(many=True, read_only=True)

    attribute_assignments = ItemAttributeValueSerializer(many=True, read_only=True)

    variant_attribute_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=ProductAttribute.objects.filter(
            is_active=True, is_variant_generator=True
        ),
        write_only=True,
        required=False,
    )

    category_name = serializers.CharField(source="category.name", read_only=True)

    brand_name = serializers.SerializerMethodField()

    base_uom_code = serializers.SerializerMethodField()

    base_uom_name = serializers.CharField(source="base_uom.name", read_only=True, default="")

    base_uom_symbol = serializers.CharField(source="base_uom.symbol", read_only=True, default="")

    purchase_uom_code = serializers.CharField(source="purchase_uom.code", read_only=True, default="")

    sales_uom_code = serializers.CharField(source="sales_uom.code", read_only=True, default="")

    weight_uom_code = serializers.CharField(source="weight_uom.code", read_only=True, default="")

    dimension_uom_code = serializers.CharField(source="dimension_uom.code", read_only=True, default="")

    total_on_hand = serializers.SerializerMethodField()

    total_reserved = serializers.SerializerMethodField()

    total_available = serializers.SerializerMethodField()

    variants_count = serializers.SerializerMethodField()

    class Meta:

        model = InventoryItem

        fields = "__all__"

        extra_kwargs = {

            "code": {"required": False},

        }

    def to_internal_value(self, data):

        data = data.copy() if hasattr(data, "copy") else dict(data)

        if not data.get("code") and data.get("sku"):

            data["code"] = str(data["sku"])[:50]

        elif not data.get("sku") and data.get("code"):

            data["sku"] = str(data["code"])

        # Resolve category if string

        if isinstance(data.get("category"), str):

            c = InventoryCategory.objects.filter(name=data["category"]).first() or InventoryCategory.objects.filter(code=data["category"]).first()

            if c:

                data["category"] = c.id

        # Resolve brand / brand_ref if string

        if isinstance(data.get("brand"), str) and not data.get("brand_ref"):

            b = Brand.objects.filter(name=data["brand"]).first() or Brand.objects.filter(code=data["brand"]).first()

            if b:

                data["brand_ref"] = b.id

        # Resolve base_uom if string

        if isinstance(data.get("base_uom"), str):

            u = UnitOfMeasure.objects.filter(code=data["base_uom"]).first()

            if u:

                data["base_uom"] = u.id

        elif not data.get("base_uom") and data.get("base_unit"):

            u = UnitOfMeasure.objects.filter(code=data["base_unit"]).first()

            if u:

                data["base_uom"] = u.id

        # Resolve purchase_uom if string

        if isinstance(data.get("purchase_uom"), str):

            u = UnitOfMeasure.objects.filter(code=data["purchase_uom"]).first()

            if u:

                data["purchase_uom"] = u.id

        # Resolve sales_uom if string

        if isinstance(data.get("sales_uom"), str):

            u = UnitOfMeasure.objects.filter(code=data["sales_uom"]).first()

            if u:

                data["sales_uom"] = u.id

        # Resolve weight_uom if string

        if isinstance(data.get("weight_uom"), str):

            u = UnitOfMeasure.objects.filter(code=data["weight_uom"]).first()

            if u:

                data["weight_uom"] = u.id

        # Resolve dimension_uom if string

        if isinstance(data.get("dimension_uom"), str):

            u = UnitOfMeasure.objects.filter(code=data["dimension_uom"]).first()

            if u:

                data["dimension_uom"] = u.id

        return super().to_internal_value(data)

    def validate(self, attrs):

        candidate = self.instance or InventoryItem()

        for field, value in attrs.items():
            if field == "variant_attribute_ids":
                continue
            setattr(candidate, field, value)

        if attrs.get("variant_attribute_ids") and not candidate.has_variants:
            raise serializers.ValidationError(
                {"variant_attribute_ids": "Enable variants before assigning variant attributes."}
            )

        if self.instance and attrs.get("has_variants") is False and self.instance.variants.exists():
            raise serializers.ValidationError(
                {"has_variants": "Cannot disable variants for an item that has existing variants."}
            )

        if candidate.subcategory_id and candidate.category_id:
            if candidate.subcategory_id == candidate.category_id:
                raise serializers.ValidationError(
                    {"subcategory": "Subcategory must be a child of the selected category."}
                )
            if candidate.subcategory.parent_id != candidate.category_id:
                raise serializers.ValidationError(
                    {"subcategory": "Subcategory must be a child of the selected category."}
                )
        if candidate.track_inventory and candidate.is_stockable and not candidate.base_uom:

            raise serializers.ValidationError(

                {"base_uom": "A registered base unit is required for stock-tracked products."}

            )

        try:

            candidate.clean()

        except DjangoValidationError as exc:

            raise serializers.ValidationError(

                getattr(exc, "message_dict", {"non_field_errors": exc.messages})

            ) from exc

        for field in (

            "is_stockable",

            "track_inventory",

            "batch_tracking_required",

            "serial_tracking_required",

            "expiry_tracking_required",

        ):

            if field in attrs or getattr(candidate, field) != getattr(self.instance, field, None):

                attrs[field] = getattr(candidate, field)

        return attrs

    @staticmethod
    def _save_variant_attribute_assignments(item, attributes):
        attribute_ids = {attribute.pk for attribute in attributes}
        assignments = ItemAttributeValue.objects.filter(
            item=item,
            variant__isnull=True,
            attribute__is_variant_generator=True,
        )
        assignments.exclude(attribute_id__in=attribute_ids).delete()
        existing_ids = set(assignments.values_list("attribute_id", flat=True))
        ItemAttributeValue.objects.bulk_create(
            [
                ItemAttributeValue(item=item, attribute=attribute)
                for attribute in attributes
                if attribute.pk not in existing_ids
            ]
        )

    @transaction.atomic
    def create(self, validated_data):
        variant_attributes = validated_data.pop("variant_attribute_ids", None)
        item = super().create(validated_data)
        if variant_attributes is not None:
            self._save_variant_attribute_assignments(item, variant_attributes)
        return item

    @transaction.atomic
    def update(self, instance, validated_data):
        variant_attributes = validated_data.pop("variant_attribute_ids", None)
        item = super().update(instance, validated_data)
        if variant_attributes is not None:
            if variant_attributes and not item.has_variants:
                raise serializers.ValidationError(
                    {"variant_attribute_ids": "Enable variants before assigning variant attributes."}
                )
            self._save_variant_attribute_assignments(item, variant_attributes)
        return item

    def get_brand_name(self, obj):

        return obj.brand or (obj.brand_ref.name if obj.brand_ref else "")

    def get_base_uom_code(self, obj):

        return obj.base_uom.code if obj.base_uom else obj.base_unit

    def get_total_on_hand(self, obj):

        if hasattr(obj, "balances"):

            return sum((b.on_hand_qty for b in obj.balances.all()), Decimal("0.0000"))

        return Decimal("0.0000")

    def get_total_reserved(self, obj):

        if hasattr(obj, "balances"):

            return sum((b.reserved_qty for b in obj.balances.all()), Decimal("0.0000"))

        return Decimal("0.0000")

    def get_total_available(self, obj):

        if hasattr(obj, "balances"):

            return sum((b.available_qty for b in obj.balances.all()), Decimal("0.0000"))

        return Decimal("0.0000")

    def get_variants_count(self, obj):

        if hasattr(obj, "variants"):

            return obj.variants.count()

        return 0

class WarehouseSerializer(serializers.ModelSerializer):

    class Meta:

        model = Warehouse

        fields = "__all__"

class StorageLocationSerializer(serializers.ModelSerializer):

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:

        model = StorageLocation

        fields = "__all__"

class RackSerializer(serializers.ModelSerializer):

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    location_code = serializers.CharField(source="location.code", read_only=True, default="")

    location_name = serializers.CharField(source="location.name", read_only=True, default="")

    zone_code = serializers.CharField(source="zone.code", read_only=True, default="")

    zone_name = serializers.CharField(source="zone.name", read_only=True, default="")

    class Meta:

        model = Rack

        fields = "__all__"

class BinSerializer(serializers.ModelSerializer):

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    location_code = serializers.CharField(source="location.code", read_only=True, default="")

    location_name = serializers.CharField(source="location.name", read_only=True, default="")

    rack_code = serializers.CharField(source="rack.code", read_only=True, default="")

    rack_name = serializers.CharField(source="rack.name", read_only=True, default="")

    rack_zone_code = serializers.CharField(source="rack.zone.code", read_only=True, default="")

    rack_zone_name = serializers.CharField(source="rack.zone.name", read_only=True, default="")

    class Meta:

        model = Bin

        fields = "__all__"

    def validate(self, attrs):
        rack = attrs.get("rack")
        warehouse = attrs.get("warehouse")

        if rack is not None:
            if warehouse is not None and rack.warehouse_id != warehouse.id:
                raise serializers.ValidationError({
                    "rack": "The selected rack must belong to the selected warehouse."
                })

        rack_level = attrs.get("rack_level")
        if rack_level is not None and rack_level < 1:
            raise serializers.ValidationError({
                "rack_level": "Shelf must be at least level 1."
            })

        max_quantity = attrs.get("max_quantity")
        if max_quantity is not None and max_quantity < 0:
            raise serializers.ValidationError({
                "max_quantity": "Capacity cannot be negative."
            })

        return attrs

class WarehouseZoneSerializer(serializers.ModelSerializer):

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:

        model = WarehouseZone

        fields = "__all__"

class WarehouseMappingSerializer(serializers.ModelSerializer):

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:

        model = WarehouseMapping

        fields = "__all__"

class WarehouseOperationalConfigurationSerializer(serializers.ModelSerializer):

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    default_receiving_location_code = serializers.CharField(source="default_receiving_location.code", read_only=True, default="")

    default_inspection_location_code = serializers.CharField(source="default_inspection_location.code", read_only=True, default="")

    default_quarantine_location_code = serializers.CharField(source="default_quarantine_location.code", read_only=True, default="")

    default_storage_location_code = serializers.CharField(source="default_storage_location.code", read_only=True, default="")

    default_picking_location_code = serializers.CharField(source="default_picking_location.code", read_only=True, default="")

    default_dispatch_location_code = serializers.CharField(source="default_dispatch_location.code", read_only=True, default="")

    class Meta:

        model = WarehouseOperationalConfiguration

        fields = "__all__"

class WarehouseConfigurationSerializer(serializers.ModelSerializer):

    default_warehouse_code = serializers.CharField(source="default_warehouse.code", read_only=True, default="")

    default_warehouse_name = serializers.CharField(source="default_warehouse.name", read_only=True, default="")

    class Meta:

        model = WarehouseConfiguration

        fields = "__all__"

class StockBalanceSerializer(serializers.ModelSerializer):

    available_qty = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)

    item_name = serializers.CharField(source="item.name", read_only=True)

    product_name = serializers.CharField(source="item.name", read_only=True)

    sku = serializers.CharField(source="item.code", read_only=True)

    category_name = serializers.CharField(source="item.category.name", read_only=True, default="")

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    location_name = serializers.SerializerMethodField()

    bin_name = serializers.SerializerMethodField()

    # 9 Required Stock Metrics

    current_stock = serializers.DecimalField(source="on_hand_qty", max_digits=20, decimal_places=4, read_only=True)

    total_stock = serializers.DecimalField(source="on_hand_qty", max_digits=20, decimal_places=4, read_only=True)

    available_stock = serializers.DecimalField(source="available_qty", max_digits=20, decimal_places=4, read_only=True)

    reserved_stock = serializers.DecimalField(source="reserved_qty", max_digits=20, decimal_places=4, read_only=True)

    damaged_stock = serializers.SerializerMethodField()

    blocked_stock = serializers.DecimalField(source="blocked_qty", max_digits=20, decimal_places=4, read_only=True)

    quarantined_stock = serializers.DecimalField(source="quarantined_qty", max_digits=20, decimal_places=4, read_only=True)

    safety_stock = serializers.SerializerMethodField()

    min_stock = serializers.SerializerMethodField()

    max_stock = serializers.SerializerMethodField()

    reorder_point = serializers.SerializerMethodField()

    stock_status = serializers.SerializerMethodField()

    unit = serializers.SerializerMethodField()

    class Meta:

        model = StockBalance

        fields = "__all__"

    def get_location_name(self, obj):

        return f"{obj.location.code} - {obj.location.name}" if obj.location else ""

    def get_bin_name(self, obj):
        return f"{obj.bin.code} - {obj.bin.name}" if obj.bin else ""

    def get_damaged_stock(self, obj):
        if getattr(obj, "damaged_qty", None) and obj.damaged_qty > Decimal("0"):
            return float(obj.damaged_qty)
        if getattr(obj, "blocked_qty", None) and obj.blocked_qty > Decimal("0"):
            return float(obj.blocked_qty)
        return float(getattr(obj, "damaged_qty", 0.0) or 0.0)

    def _get_stock_level(self, obj):

        if not hasattr(obj, "_cached_stock_level"):

            from apps.planning.models import StockLevel

            obj._cached_stock_level = StockLevel.objects.filter(product=obj.item, warehouse=obj.warehouse).first()

        return obj._cached_stock_level

    def get_safety_stock(self, obj):

        sl = self._get_stock_level(obj)

        return float(sl.safety_stock) if sl and sl.safety_stock else 0.0

    def get_min_stock(self, obj):

        sl = self._get_stock_level(obj)

        return float(sl.min_stock) if sl and sl.min_stock else 0.0

    def get_max_stock(self, obj):

        sl = self._get_stock_level(obj)

        return float(sl.max_stock) if sl and sl.max_stock else 0.0

    def get_reorder_point(self, obj):

        from apps.planning.models import ReorderRule

        if not hasattr(obj, "_cached_reorder_rule"):

            obj._cached_reorder_rule = ReorderRule.objects.filter(product=obj.item, warehouse=obj.warehouse).first()

        rule = obj._cached_reorder_rule

        if rule and rule.reorder_point:

            return float(rule.reorder_point)

        min_s = self.get_min_stock(obj)

        if min_s > 0:

            return min_s

        return float(getattr(obj.item, "reorder_point", 20))

    def get_stock_status(self, obj):

        avail = obj.available_qty

        safety = Decimal(str(self.get_safety_stock(obj)))

        rpoint = Decimal(str(self.get_reorder_point(obj)))

        if avail <= Decimal("0"):

            return "Out of Stock"

        if safety > 0 and avail <= safety:

            return "Critical"

        if rpoint > 0 and avail <= rpoint:

            return "Low Stock"

        return "In Stock"

    def get_unit(self, obj):

        if obj.item and obj.item.base_unit:

            unit_val = obj.item.base_unit

            return unit_val.code if hasattr(unit_val, "code") else str(unit_val)

        return "EA"

class StockLedgerEntrySerializer(serializers.ModelSerializer):

    item_code = serializers.CharField(source="item.code", read_only=True)

    item_name = serializers.CharField(source="item.name", read_only=True)

    sku = serializers.CharField(source="item.code", read_only=True)

    product_name = serializers.CharField(source="item.name", read_only=True)

    product = serializers.CharField(source="item.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    location_name = serializers.SerializerMethodField()

    transaction_date = serializers.SerializerMethodField()

    transaction_number = serializers.CharField(source="transaction_ref", read_only=True)

    transaction_type = serializers.CharField(source="movement_type", read_only=True)

    quantity_in = serializers.SerializerMethodField()

    quantity_out = serializers.SerializerMethodField()

    quantity = serializers.SerializerMethodField()

    from_warehouse = serializers.SerializerMethodField()

    to_warehouse = serializers.SerializerMethodField()

    balance_quantity = serializers.DecimalField(source="balance_after", max_digits=20, decimal_places=4, read_only=True)

    batch_number = serializers.CharField(read_only=True, default="")

    serial_number = serializers.CharField(read_only=True, default="")

    serial_status = serializers.SerializerMethodField()

    reference_number = serializers.CharField(source="reason", read_only=True, default="")

    uom = serializers.SerializerMethodField()

    posted_by = serializers.CharField(source="actor", read_only=True, default="system")

    created_by = serializers.CharField(source="actor", read_only=True, default="system")

    unit_cost_val = serializers.DecimalField(source="unit_cost", max_digits=20, decimal_places=4, read_only=True)

    total_cost_val = serializers.DecimalField(source="total_value_delta", max_digits=20, decimal_places=4, read_only=True)

    class Meta:

        model = StockLedgerEntry

        fields = "__all__"

    def get_location_name(self, obj):

        return f"{obj.location.code} - {obj.location.name}" if obj.location else ""

    def get_transaction_date(self, obj):

        return obj.created_at.date().isoformat() if obj.created_at else ""

    def get_quantity_in(self, obj):

        return float(obj.quantity_delta) if obj.quantity_delta > 0 else 0.0

    def get_quantity_out(self, obj):

        return float(abs(obj.quantity_delta)) if obj.quantity_delta < 0 else 0.0

    def get_quantity(self, obj):

        return float(abs(obj.quantity_delta))

    def get_from_warehouse(self, obj):

        if obj.quantity_delta < 0 or obj.movement_type in ("ISSUE", "TRANSFER_OUT"):

            return obj.warehouse.name if obj.warehouse else ""

        return ""

    def get_to_warehouse(self, obj):

        if getattr(obj, "destination_warehouse", None):

            return obj.destination_warehouse.name

        if obj.quantity_delta > 0 or obj.movement_type in ("RECEIPT", "TRANSFER_IN"):

            return obj.warehouse.name if obj.warehouse else ""

        return ""

    def get_serial_status(self, obj):

        if obj.serial_number:

            from apps.serial_numbers.models import SerialNumber

            sn = SerialNumber.objects.filter(serial_number=obj.serial_number).first()

            if sn:

                return sn.status

        if obj.movement_type == "RECEIPT":

            return "Available"

        elif obj.movement_type == "ISSUE":

            return "Issued"

        elif obj.movement_type in ("TRANSFER_OUT", "TRANSFER_IN"):

            return "In Transit" if obj.movement_type == "TRANSFER_OUT" else "Available"

        elif obj.movement_type == "RETURN":

            return "Returned"

        return "Available"

    def get_uom(self, obj):

        if obj.transaction_uom:

            return obj.transaction_uom

        if obj.item and obj.item.base_unit:

            u = obj.item.base_unit

            return u.code if hasattr(u, "code") else str(u)

        return "EA"

class StockTransactionLineSerializer(serializers.ModelSerializer):

    item_code = serializers.CharField(source="item.code", read_only=True)

    item_name = serializers.CharField(source="item.name", read_only=True)

    location_code = serializers.CharField(source="location.code", read_only=True)

    destination_location_code = serializers.CharField(source="destination_location.code", read_only=True, default="")

    sku = serializers.SerializerMethodField()

    variant_name = serializers.CharField(source="variant.name", read_only=True, default="")

    uom = serializers.SerializerMethodField()

    available_stock = serializers.SerializerMethodField()

    discrepancy_quantity = serializers.SerializerMethodField()

    accepted_quantity_display = serializers.SerializerMethodField()

    class Meta:

        model = StockTransactionLine

        fields = "__all__"

    def get_sku(self, obj):
        if obj.variant and obj.variant.sku:
            return obj.variant.sku
        if obj.item:
            return getattr(obj.item, "sku", "") or obj.item.code
        return ""

    def get_uom(self, obj):
        if obj.transaction_uom:
            return obj.transaction_uom
        if obj.item and obj.item.base_unit:
            u = obj.item.base_unit
            return u.code if hasattr(u, "code") else str(u)
        return "Nos"

    def get_available_stock(self, obj):
        try:
            if not obj.transaction or not obj.transaction.warehouse or not obj.item:
                return 0.0
            from apps.stock.models import StockBalance
            from decimal import Decimal
            balances = StockBalance.objects.filter(
                warehouse=obj.transaction.warehouse,
                item=obj.item,
            )
            if obj.variant:
                balances = balances.filter(variant=obj.variant)
            return float(sum((b.available_qty for b in balances), Decimal("0")))
        except Exception:
            return 0.0

    def get_discrepancy_quantity(self, obj):
        from decimal import Decimal
        shortage = obj.shortage_quantity or Decimal("0")
        damaged = obj.damaged_quantity or Decimal("0")
        return float(shortage + damaged)

    def get_accepted_quantity_display(self, obj):
        from decimal import Decimal
        if obj.accepted_quantity and obj.accepted_quantity > Decimal("0"):
            return float(obj.accepted_quantity)
        recv = obj.received_quantity or Decimal("0")
        dmg = obj.damaged_quantity or Decimal("0")
        return float(max(Decimal("0"), recv - dmg))

class StockTransactionSerializer(serializers.ModelSerializer):

    lines = StockTransactionLineSerializer(many=True, read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    destination_warehouse_name = serializers.CharField(source="destination_warehouse.name", read_only=True, default="")

    destination_warehouse_code = serializers.CharField(source="destination_warehouse.code", read_only=True, default="")

    source_warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    source_warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    source_city = serializers.CharField(source="warehouse.city", read_only=True, default="")

    destination_city = serializers.CharField(source="destination_warehouse.city", read_only=True, default="")

    total_items = serializers.SerializerMethodField()

    total_quantity = serializers.SerializerMethodField()

    type = serializers.CharField(source="transaction_type", read_only=True)

    item = serializers.SerializerMethodField()

    item_code = serializers.SerializerMethodField()

    location = serializers.SerializerMethodField()

    quantity = serializers.SerializerMethodField()

    unit = serializers.SerializerMethodField()

    unit_cost = serializers.SerializerMethodField()

    batch_number = serializers.SerializerMethodField()

    expiry_date = serializers.SerializerMethodField()

    serial_number = serializers.SerializerMethodField()

    system_quantity = serializers.SerializerMethodField()

    actual_quantity = serializers.SerializerMethodField()

    difference_quantity = serializers.SerializerMethodField()

    destination_location_name = serializers.SerializerMethodField()

    class Meta:

        model = StockTransaction

        fields = "__all__"

    def get_item(self, obj):

        first_line = obj.lines.first()

        return first_line.item.name if first_line and first_line.item else "Industrial Ball Bearing 6205-2RS"

    def get_item_code(self, obj):

        first_line = obj.lines.first()

        return first_line.item.code if first_line and first_line.item else "BRG-6205-2RS"

    def get_location(self, obj):

        first_line = obj.lines.first()

        if first_line and first_line.location:

            return f"{first_line.location.code} - {first_line.location.name}"

        return obj.warehouse.name if obj.warehouse else "Main Central Hub"

    def get_destination_location_name(self, obj):

        first_line = obj.lines.first()

        if first_line and first_line.destination_location:

            return f"{first_line.destination_location.code} - {first_line.destination_location.name}"

        return ""

    def get_quantity(self, obj):

        first_line = obj.lines.first()

        if first_line:

            qty = float(first_line.quantity)

            return -qty if obj.transaction_type == "ISSUE" and qty > 0 else qty

        return 10.0

    def get_unit(self, obj):

        first_line = obj.lines.first()

        if first_line and first_line.item and first_line.item.base_unit:

            unit_val = first_line.item.base_unit

            return unit_val.code if hasattr(unit_val, "code") else str(unit_val)

        return "EA"

    def get_unit_cost(self, obj):

        first_line = obj.lines.first()

        if first_line:

            return float(first_line.unit_cost)

        return 14.85

    def get_batch_number(self, obj):

        first_line = obj.lines.first()

        return first_line.batch_number if first_line else ""

    def get_expiry_date(self, obj):

        first_line = obj.lines.first()

        return str(first_line.expiry_date) if first_line and first_line.expiry_date else ""

    def get_serial_number(self, obj):

        first_line = obj.lines.first()

        if first_line and first_line.serial_numbers:

            return ", ".join(first_line.serial_numbers)

        return ""

    def get_system_quantity(self, obj):

        first_line = obj.lines.first()

        return float(first_line.system_quantity) if first_line else 0.0

    def get_actual_quantity(self, obj):

        first_line = obj.lines.first()

        return float(first_line.actual_quantity) if first_line else 0.0

    def get_difference_quantity(self, obj):

        first_line = obj.lines.first()

        return float(first_line.difference_quantity) if first_line else 0.0

    def get_total_items(self, obj):
        return obj.lines.count()

    def get_total_quantity(self, obj):
        from decimal import Decimal
        return float(sum((abs(l.quantity) for l in obj.lines.all()), Decimal("0")))

    @transaction.atomic
    def create(self, validated_data):

        lines_data = self.initial_data.get("lines", [])

        tx = StockTransaction.objects.create(**validated_data)

        for line in lines_data:

            item_val = line.get("item")

            qty = line.get("quantity", 1)

            cost = line.get("unit_cost", 0)

            loc_val = line.get("location")

            item_obj = None

            if isinstance(item_val, int):

                item_obj = InventoryItem.objects.filter(id=item_val).first()

            elif isinstance(item_val, str):

                item_obj = (

                    InventoryItem.objects.filter(code=item_val).first()

                    or InventoryItem.objects.filter(name=item_val).first()

                )

            if not item_obj:

                raise serializers.ValidationError({"lines": f"Item '{item_val}' does not exist."})

            loc_obj = None

            if isinstance(loc_val, int):

                loc_obj = StorageLocation.objects.filter(id=loc_val).first()

            elif isinstance(loc_val, str):

                loc_obj = StorageLocation.objects.filter(code=loc_val).first() or StorageLocation.objects.filter(name=loc_val).first()

            dest_loc_val = line.get("destination_location")

            dest_loc_obj = None

            if isinstance(dest_loc_val, int):

                dest_loc_obj = StorageLocation.objects.filter(id=dest_loc_val).first()

            elif isinstance(dest_loc_val, str):

                dest_loc_obj = StorageLocation.objects.filter(code=dest_loc_val).first() or StorageLocation.objects.filter(name=dest_loc_val).first()

            serials = line.get("serial_numbers") or []

            if not serials and line.get("serial_number"):

                serials = [str(line.get("serial_number"))]

            res_obj = None

            res_val = line.get("reservation") or line.get("reservation_id")

            if res_val:

                from apps.reservations.models import StockReservation

                res_obj = StockReservation.objects.filter(id=res_val).first() if str(res_val).isdigit() else StockReservation.objects.filter(reservation_number=str(res_val)).first()

            if item_obj:

                StockTransactionLine.objects.create(

                    transaction=tx,

                    item=item_obj,

                    quantity=Decimal(str(qty)),

                    unit_cost=Decimal(str(cost)),

                    location=loc_obj,

                    destination_location=dest_loc_obj,

                    batch_number=line.get("batch_number", "") or "",

                    expiry_date=line.get("expiry_date") or None,

                    serial_numbers=serials,

                    system_quantity=Decimal(str(line.get("system_quantity", 0) or 0)),

                    actual_quantity=Decimal(str(line.get("actual_quantity", 0) or 0)),

                    difference_quantity=Decimal(str(line.get("difference_quantity", 0) or 0)),

                    dispatched_quantity=Decimal(str(line.get("dispatched_quantity", 0) or 0)),

                    received_quantity=Decimal(str(line.get("received_quantity", 0) or 0)),

                    shortage_quantity=Decimal(str(line.get("shortage_quantity", 0) or 0)),

                    damaged_quantity=Decimal(str(line.get("damaged_quantity", 0) or 0)),

                    from_status=line.get("from_status", "") or "",

                    to_status=line.get("to_status", "") or "",

                    reservation=res_obj,

                    description=line.get("description", "") or "",

                )

        return tx

class ValuationSerializer(serializers.ModelSerializer):

    item_code = serializers.CharField(source="item.code", read_only=True)

    item_name = serializers.CharField(source="item.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    class Meta:

        model = InventoryValuation

        fields = "__all__"

class StockReservationSerializer(serializers.ModelSerializer):

    item_code = serializers.CharField(source="item.code", read_only=True)

    item_name = serializers.CharField(source="item.name", read_only=True)

    sku = serializers.CharField(source="item.code", read_only=True)

    product_name = serializers.CharField(source="item.name", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    location_name = serializers.SerializerMethodField()

    available_quantity = serializers.SerializerMethodField()

    remaining_quantity = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)

    class Meta:

        model = StockReservation

        fields = "__all__"

    def get_location_name(self, obj):

        return f"{obj.location.code} - {obj.location.name}" if obj.location else ""

    def get_available_quantity(self, obj):

        bal = StockBalance.objects.filter(item=obj.item, warehouse=obj.warehouse).first()

        return float(bal.available_qty) if bal else 0.0

class StockCountLineSerializer(serializers.ModelSerializer):

    item_code = serializers.CharField(source="item.code", read_only=True)

    item_name = serializers.CharField(source="item.name", read_only=True)

    location_code = serializers.CharField(source="location.code", read_only=True)

    variance_qty = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)

    class Meta:

        model = StockCountLine

        fields = "__all__"

class StockCountSerializer(serializers.ModelSerializer):

    lines = StockCountLineSerializer(many=True, read_only=True)

    count_number = serializers.CharField(required=False, allow_blank=True)

    product = serializers.PrimaryKeyRelatedField(queryset=InventoryItem.objects.all(), source="item", required=False, allow_null=True)

    storage_location = serializers.PrimaryKeyRelatedField(queryset=StorageLocation.objects.all(), source="location", required=False, allow_null=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    location_name = serializers.SerializerMethodField()

    item_name = serializers.CharField(source="item.name", read_only=True, default="")

    item_code = serializers.CharField(source="item.code", read_only=True, default="")

    sku = serializers.CharField(source="item.code", read_only=True, default="")

    product_name = serializers.CharField(source="item.name", read_only=True, default="")

    adjustment_document_number = serializers.CharField(source="adjustment_transaction.document_number", read_only=True, default="")

    class Meta:

        model = StockCount

        fields = "__all__"

    def get_location_name(self, obj):

        return f"{obj.location.code} - {obj.location.name}" if obj.location else "All Locations / Main Area"

    def create(self, validated_data):

        import random

        from django.utils import timezone

        if not validated_data.get("count_number"):

            validated_data["count_number"] = f"CNT-{timezone.now().year}-{random.randint(1000, 9999)}"

        wh = validated_data.get("warehouse")

        item = validated_data.get("item")

        sys_qty = validated_data.get("system_quantity")

        if (sys_qty is None or sys_qty == 0) and wh and item:

            sb = StockBalance.objects.filter(warehouse=wh, item=item).first()

            if sb:

                validated_data["system_quantity"] = sb.on_hand_qty

                validated_data["snapshot_taken_at"] = timezone.now()

        phys_qty = validated_data.get("physical_quantity", Decimal("0.0000"))

        final_sys = validated_data.get("system_quantity", Decimal("0.0000"))

        validated_data["difference_quantity"] = phys_qty - final_sys

        return super().create(validated_data)

class CycleCountSerializer(serializers.ModelSerializer):

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    location_name = serializers.CharField(read_only=True)

    product_name = serializers.CharField(read_only=True)

    sku = serializers.CharField(read_only=True)

    count_entries_count = serializers.IntegerField(source="count_entries.count", read_only=True)

    class Meta:

        model = CycleCount

        fields = "__all__"

class FullStockCountSerializer(serializers.ModelSerializer):

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    storage_locations_details = serializers.SerializerMethodField()

    count_entries_count = serializers.IntegerField(source="count_entries.count", read_only=True)

    class Meta:

        model = FullStockCount

        fields = "__all__"

    def get_storage_locations_details(self, obj):

        return [{"id": loc.id, "name": loc.name, "code": loc.code} for loc in obj.storage_locations.all()]

class AuditHistorySerializer(serializers.ModelSerializer):

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    class Meta:

        model = AuditHistory

        fields = "__all__"

class DamagedStockSerializer(serializers.ModelSerializer):

    item_code = serializers.CharField(source="item.code", read_only=True)

    item_name = serializers.CharField(source="item.name", read_only=True)

    sku = serializers.CharField(source="item.code", read_only=True)

    product_name = serializers.CharField(source="item.name", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    location_name = serializers.SerializerMethodField()

    class Meta:

        model = DamagedStock

        fields = "__all__"

    def get_location_name(self, obj):

        return f"{obj.location.code} - {obj.location.name}" if obj.location else ""

class StockInTransitLineSerializer(serializers.ModelSerializer):

    item_code = serializers.CharField(source="item.code", read_only=True)

    item_name = serializers.CharField(source="item.name", read_only=True)

    source_location_code = serializers.CharField(source="location.code", read_only=True, default="")

    source_location_name = serializers.CharField(source="location.name", read_only=True, default="")

    destination_location_code = serializers.CharField(source="destination_location.code", read_only=True, default="")

    destination_location_name = serializers.CharField(source="destination_location.name", read_only=True, default="")

    dispatched_quantity = serializers.SerializerMethodField()

    received_quantity = serializers.SerializerMethodField()

    pending_quantity = serializers.SerializerMethodField()

    class Meta:

        model = StockTransactionLine

        fields = [

            "id",

            "item",

            "item_code",

            "item_name",

            "source_location_code",

            "source_location_name",

            "destination_location_code",

            "destination_location_name",

            "dispatched_quantity",

            "received_quantity",

            "pending_quantity",

            "batch_number",

            "unit_cost",

        ]

    def get_dispatched_quantity(self, obj):

        disp = getattr(obj, "dispatched_quantity", None)

        return float(disp) if (disp is not None and disp > Decimal("0")) else float(abs(obj.quantity))

    def get_received_quantity(self, obj):

        recv = getattr(obj, "received_quantity", None)

        if recv is not None:

            return float(recv)

        if obj.transaction and obj.transaction.status == "POSTED":

            return self.get_dispatched_quantity(obj)

        return 0.0

    def get_pending_quantity(self, obj):

        disp = self.get_dispatched_quantity(obj)

        recv = self.get_received_quantity(obj)

        return max(0.0, disp - recv)

class StockInTransitSerializer(serializers.ModelSerializer):

    transfer_number = serializers.CharField(source="document_number", read_only=True)

    source_warehouse = serializers.CharField(source="warehouse.name", read_only=True)

    source_warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    destination_warehouse_name = serializers.CharField(source="destination_warehouse.name", read_only=True, default="")

    destination_warehouse_code = serializers.CharField(source="destination_warehouse.code", read_only=True, default="")

    source_location = serializers.SerializerMethodField()

    destination_location = serializers.SerializerMethodField()

    dispatch_date = serializers.DateField(source="transaction_date", read_only=True)

    expected_arrival_date = serializers.DateField(source="expected_date", read_only=True)

    actual_arrival_date = serializers.SerializerMethodField()

    carrier = serializers.CharField(source="supplier", read_only=True, default="")

    tracking_reference = serializers.CharField(source="reference_number", read_only=True, default="")

    product = serializers.SerializerMethodField()

    sku = serializers.SerializerMethodField()

    dispatched_quantity = serializers.SerializerMethodField()

    received_quantity = serializers.SerializerMethodField()

    pending_quantity = serializers.SerializerMethodField()

    transit_status = serializers.SerializerMethodField()

    lines = StockInTransitLineSerializer(many=True, read_only=True)

    class Meta:

        model = StockTransaction

        fields = [

            "id",

            "document_number",

            "transfer_number",

            "transaction_date",

            "dispatch_date",

            "expected_arrival_date",

            "actual_arrival_date",

            "source_warehouse",

            "source_warehouse_code",

            "destination_warehouse_name",

            "destination_warehouse_code",

            "source_location",

            "destination_location",

            "carrier",

            "tracking_reference",

            "product",

            "sku",

            "dispatched_quantity",

            "received_quantity",

            "pending_quantity",

            "transit_status",

            "status",

            "lines",

        ]

    def get_source_location(self, obj):

        line = obj.lines.first()

        return line.location.name if line and line.location else ""

    def get_destination_location(self, obj):

        line = obj.lines.first()

        return line.destination_location.name if line and line.destination_location else ""

    def get_actual_arrival_date(self, obj):

        if obj.status == "POSTED" and obj.posted_at:

            return obj.posted_at.date().isoformat()

        return None

    def get_product(self, obj):

        names = [line.item.name for line in obj.lines.all() if line.item]

        if not names:

            return "Industrial Product"

        if len(names) == 1:

            return names[0]

        return f"{names[0]} (+{len(names)-1} more)"

    def get_sku(self, obj):

        skus = [line.item.code for line in obj.lines.all() if line.item]

        if not skus:

            return "SKU-000"

        if len(skus) == 1:

            return skus[0]

        return f"{skus[0]} (+{len(skus)-1})"

    def get_dispatched_quantity(self, obj):

        total = Decimal("0.0000")

        for line in obj.lines.all():

            disp = getattr(line, "dispatched_quantity", None)

            total += disp if (disp is not None and disp > Decimal("0")) else abs(line.quantity)

        return float(total)

    def get_received_quantity(self, obj):

        total = Decimal("0.0000")

        for line in obj.lines.all():

            recv = getattr(line, "received_quantity", None)

            if recv is not None:

                total += recv

            elif obj.status == "POSTED":

                disp = getattr(line, "dispatched_quantity", None)

                total += disp if (disp is not None and disp > Decimal("0")) else abs(line.quantity)

        return float(total)

    def get_pending_quantity(self, obj):

        dispatched = self.get_dispatched_quantity(obj)

        received = self.get_received_quantity(obj)

        return max(0.0, dispatched - received)

    def get_transit_status(self, obj):

        if obj.status == "CANCELLED":

            return "Cancelled"

        if obj.status == "POSTED":

            return "Received"

        disp = self.get_dispatched_quantity(obj)

        recv = self.get_received_quantity(obj)

        if recv > 0 and recv < disp:

            return "Partially Received"

        return "In Transit"

class BatchSerializer(serializers.ModelSerializer):

    item_code = serializers.CharField(source="item.code", read_only=True)

    item_name = serializers.CharField(source="item.name", read_only=True)

    variant_name = serializers.CharField(source="variant.variant_name", read_only=True, default="")

    variant_sku = serializers.CharField(source="variant.sku", read_only=True, default="")

    sku = serializers.CharField(source="item.code", read_only=True)

    product_name = serializers.CharField(source="item.name", read_only=True)

    product = serializers.CharField(source="item.name", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True, default="")

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True, default="")

    location_name = serializers.SerializerMethodField()

    location_code = serializers.CharField(source="location.code", read_only=True, default="")

    days_remaining = serializers.IntegerField(read_only=True)

    days_to_expiry = serializers.IntegerField(read_only=True)

    expiry_status = serializers.CharField(read_only=True)

    class Meta:

        model = Batch

        fields = "__all__"

    def to_internal_value(self, data):

        data = data.copy() if hasattr(data, "copy") else dict(data)

        if "batch_status" in data:

            st = str(data["batch_status"]).strip()

            mapping = {

                "pending inspection": "Pending Inspection",

                "pending_inspection": "Pending Inspection",

                "released": "Released",

                "quarantined": "Quarantined",

                "rejected": "Rejected",

                "closed": "Closed",

                "healthy": "Released",

            }

            norm = mapping.get(st.lower(), st)

            data["batch_status"] = norm

            if "status" not in data or not data["status"]:

                data["status"] = "HEALTHY" if norm == "Released" else norm

        return super().to_internal_value(data)

    def get_location_name(self, obj):

        return f"{obj.location.code} - {obj.location.name}" if obj.location else ""

class BatchQuarantineRecordSerializer(serializers.ModelSerializer):

    batch_number = serializers.CharField(source="batch.batch_number", read_only=True)

    product_name = serializers.CharField(source="product.name", read_only=True)

    sku = serializers.CharField(source="product.code", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True, default="")

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True, default="")

    location_name = serializers.SerializerMethodField()

    location_code = serializers.CharField(source="location.code", read_only=True, default="")

    class Meta:

        model = BatchQuarantineRecord

        fields = "__all__"

    def get_location_name(self, obj):

        return f"{obj.location.code} - {obj.location.name}" if obj.location else ""

class SerialNumberSerializer(serializers.ModelSerializer):

    item_code = serializers.CharField(source="item.code", read_only=True)

    item_name = serializers.CharField(source="item.name", read_only=True)

    sku = serializers.CharField(source="item.code", read_only=True)

    product_name = serializers.CharField(source="item.name", read_only=True)

    product = serializers.CharField(source="item.name", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True, default="")

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True, default="")

    location_code = serializers.CharField(source="location.code", read_only=True, default="")

    location_name = serializers.SerializerMethodField()

    batch_number = serializers.CharField(source="batch.batch_number", read_only=True, default="")

    class Meta:

        model = SerialNumber

        fields = "__all__"

    def get_location_name(self, obj):

        return f"{obj.location.code} - {obj.location.name}" if obj.location else ""

class ReorderRuleSerializer(serializers.ModelSerializer):

    product_name = serializers.CharField(source="product.name", read_only=True)

    sku = serializers.CharField(source="product.code", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    class Meta:

        model = ReorderRule

        fields = "__all__"

class StockLevelSerializer(serializers.ModelSerializer):

    product_name = serializers.CharField(source="product.name", read_only=True)

    sku = serializers.CharField(source="product.code", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    class Meta:

        model = StockLevel

        fields = "__all__"

class ReplenishmentPlanSerializer(serializers.ModelSerializer):

    product_name = serializers.CharField(source="product.name", read_only=True)

    sku = serializers.CharField(source="product.code", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    class Meta:

        model = ReplenishmentPlan

        fields = "__all__"

class PurchaseSuggestionSerializer(serializers.ModelSerializer):

    product_name = serializers.CharField(source="product.name", read_only=True)

    sku = serializers.CharField(source="product.code", read_only=True)

    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    class Meta:

        model = PurchaseSuggestion

        fields = "__all__"

class ProductImportHistorySerializer(serializers.ModelSerializer):

    class Meta:

        model = ProductImportHistory

        fields = "__all__"


class ShelfLifePolicySerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    variant_name = serializers.CharField(source="variant.variant_name", read_only=True, default="")
    variant_sku = serializers.CharField(source="variant.sku", read_only=True, default="")

    class Meta:
        model = ShelfLifePolicy
        fields = "__all__"


class RecallActionSerializer(serializers.ModelSerializer):
    recall_number = serializers.CharField(source="recall.recall_number", read_only=True)

    class Meta:
        model = RecallAction
        fields = "__all__"


class ProductRecallSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    batch_number = serializers.CharField(source="batch.batch_number", read_only=True, default="")
    actions = RecallActionSerializer(many=True, read_only=True)

    class Meta:
        model = ProductRecall
        fields = "__all__"


class AllocationRecordSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True, default="")
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True, default="")
    batch_number = serializers.CharField(source="batch.batch_number", read_only=True, default="")

    class Meta:
        model = AllocationRecord
        fields = "__all__"
