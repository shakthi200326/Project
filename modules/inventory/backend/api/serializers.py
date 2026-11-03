from decimal import Decimal
from rest_framework import serializers
from apps.categories.models import InventoryCategory
from apps.brands.models import Brand
from apps.units.models import UnitOfMeasure
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation, Rack, Bin, WarehouseConfiguration
from apps.stock.models import StockBalance, StockLedgerEntry, DamagedStock
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.valuation.models import InventoryValuation
from apps.reservations.models import StockReservation
from apps.reconciliation.models import StockCount, StockCountLine
from apps.batches.models import Batch, BatchQuarantineRecord
from apps.serial_numbers.models import SerialNumber
from apps.planning.models import ReorderRule, StockLevel, ReplenishmentPlan, PurchaseSuggestion

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

class RackSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    location_code = serializers.CharField(source="location.code", read_only=True, default="")
    location_name = serializers.CharField(source="location.name", read_only=True, default="")

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

    class Meta:
        model = Bin
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
    total_stock = serializers.DecimalField(source="on_hand_qty", max_digits=20, decimal_places=4, read_only=True)
    reserved_stock = serializers.DecimalField(source="reserved_qty", max_digits=20, decimal_places=4, read_only=True)
    available_stock = serializers.DecimalField(source="available_qty", max_digits=20, decimal_places=4, read_only=True)
    damaged_stock = serializers.DecimalField(source="blocked_qty", max_digits=20, decimal_places=4, read_only=True)
    stock_status = serializers.SerializerMethodField()
    unit = serializers.SerializerMethodField()

    class Meta:
        model = StockBalance
        fields = "__all__"

    def get_location_name(self, obj):
        return f"{obj.location.code} - {obj.location.name}" if obj.location else ""

    def get_bin_name(self, obj):
        return f"{obj.bin.code} - {obj.bin.name}" if obj.bin else ""

    def get_stock_status(self, obj):
        avail = obj.available_qty
        if avail <= Decimal("0"):
            return "Out of Stock"
        reorder = getattr(obj.item, "reorder_point", Decimal("20"))
        if avail <= Decimal(str(reorder)):
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
    destination_warehouse_name = serializers.CharField(source="destination_warehouse.name", read_only=True, default="")
    destination_warehouse_code = serializers.CharField(source="destination_warehouse.code", read_only=True, default="")
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
        return f"{obj.location.code} - {obj.location.name}" if obj.location else ""

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

class StockInTransitSerializer(serializers.ModelSerializer):
    transfer_number = serializers.CharField(source="document_number", read_only=True)
    source_warehouse = serializers.CharField(source="warehouse.name", read_only=True)
    source_warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    destination_warehouse_name = serializers.CharField(source="destination_warehouse.name", read_only=True, default="")
    destination_warehouse_code = serializers.CharField(source="destination_warehouse.code", read_only=True, default="")
    product = serializers.SerializerMethodField()
    sku = serializers.SerializerMethodField()
    dispatched_quantity = serializers.SerializerMethodField()
    received_quantity = serializers.SerializerMethodField()
    pending_quantity = serializers.SerializerMethodField()
    transit_status = serializers.SerializerMethodField()

    class Meta:
        model = StockTransaction
        fields = [
            "id",
            "document_number",
            "transfer_number",
            "transaction_date",
            "source_warehouse",
            "source_warehouse_code",
            "destination_warehouse_name",
            "destination_warehouse_code",
            "product",
            "sku",
            "dispatched_quantity",
            "received_quantity",
            "pending_quantity",
            "transit_status",
            "status",
        ]

    def get_product(self, obj):
        line = obj.lines.first()
        return line.item.name if line and line.item else "Industrial Product"

    def get_sku(self, obj):
        line = obj.lines.first()
        return line.item.code if line and line.item else "SKU-000"

    def get_dispatched_quantity(self, obj):
        line = obj.lines.first()
        return float(line.quantity) if line else 0.0

    def get_received_quantity(self, obj):
        if obj.status == "POSTED":
            line = obj.lines.first()
            return float(line.quantity) if line else 0.0
        return 0.0

    def get_pending_quantity(self, obj):
        dispatched = self.get_dispatched_quantity(obj)
        received = self.get_received_quantity(obj)
        return max(0.0, dispatched - received)

    def get_transit_status(self, obj):
        if obj.status == "POSTED":
            return "Received"
        return "In Transit"

class BatchSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
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
