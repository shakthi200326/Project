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

    class Meta:
        model = StockTransactionLine
        fields = "__all__"

class StockTransactionSerializer(serializers.ModelSerializer):
    lines = StockTransactionLineSerializer(many=True, read_only=True)

    class Meta:
        model = StockTransaction
        fields = "__all__"

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
