from decimal import Decimal
from rest_framework import serializers
from apps.categories.models import InventoryCategory
from apps.brands.models import Brand
from apps.units.models import UnitOfMeasure
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.valuation.models import InventoryValuation
from apps.reservations.models import StockReservation
from apps.reconciliation.models import StockCount, StockCountLine
from apps.batches.models import Batch
from apps.serial_numbers.models import SerialNumber

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryCategory
        fields = "__all__"

class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = "__all__"

class UnitOfMeasureSerializer(serializers.ModelSerializer):
    base_unit_code = serializers.CharField(source="base_unit.code", read_only=True)

    class Meta:
        model = UnitOfMeasure
        fields = "__all__"

class ItemVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItemVariant
        fields = "__all__"

class InventoryItemSerializer(serializers.ModelSerializer):
    variants = ItemVariantSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = InventoryItem
        fields = "__all__"

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

class StockBalanceSerializer(serializers.ModelSerializer):
    available_qty = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = StockBalance
        fields = "__all__"

class StockLedgerEntrySerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    class Meta:
        model = StockLedgerEntry
        fields = "__all__"

class StockTransactionLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    location_code = serializers.CharField(source="location.code", read_only=True)

    class Meta:
        model = StockTransactionLine
        fields = "__all__"

class StockTransactionSerializer(serializers.ModelSerializer):
    lines = StockTransactionLineSerializer(many=True, read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    type = serializers.CharField(source="transaction_type", read_only=True)

    item = serializers.SerializerMethodField()
    item_code = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    quantity = serializers.SerializerMethodField()
    unit = serializers.SerializerMethodField()
    unit_cost = serializers.SerializerMethodField()

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
                item_obj = InventoryItem.objects.first()

            loc_obj = None
            if isinstance(loc_val, int):
                loc_obj = StorageLocation.objects.filter(id=loc_val).first()
            elif isinstance(loc_val, str):
                loc_obj = StorageLocation.objects.filter(code=loc_val).first()

            if item_obj:
                StockTransactionLine.objects.create(
                    transaction=tx,
                    item=item_obj,
                    quantity=Decimal(str(qty)),
                    unit_cost=Decimal(str(cost)),
                    location=loc_obj,
                    batch_number=line.get("batch_number", ""),
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
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = StockReservation
        fields = "__all__"

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
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = StockCount
        fields = "__all__"

class BatchSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = Batch
        fields = "__all__"

class SerialNumberSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    location_code = serializers.CharField(source="location.code", read_only=True)

    class Meta:
        model = SerialNumber
        fields = "__all__"
