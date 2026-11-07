import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from apps.categories.models import InventoryCategory


class ProductAttribute(models.Model):
    class DataType(models.TextChoices):
        TEXT = "TEXT", "Text"
        NUMBER = "NUMBER", "Integer Number"
        DECIMAL = "DECIMAL", "Decimal Number"
        BOOLEAN = "BOOLEAN", "Boolean (Yes/No)"
        DATE = "DATE", "Date"
        SELECT = "SELECT", "Predefined Options / Dropdown"

    code = models.CharField(max_length=40, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    data_type = models.CharField(
        max_length=20, choices=DataType.choices, default=DataType.TEXT
    )
    is_variant_generator = models.BooleanField(default=False)
    is_searchable = models.BooleanField(default=True)
    is_filterable = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "inv_attributes"
        ordering = ("sort_order", "name")

    def __str__(self):
        return f"{self.name} ({self.code})"


class ProductAttributeValue(models.Model):
    attribute = models.ForeignKey(
        ProductAttribute, on_delete=models.CASCADE, related_name="values"
    )
    value = models.CharField(max_length=100)
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "inv_attribute_values"
        ordering = ("display_order", "value")
        unique_together = (("attribute", "value"),)

    def __str__(self):
        return f"{self.attribute.code}: {self.value}"


class InventoryItem(models.Model):
    class ItemType(models.TextChoices):
        STOCK = "STOCK", "Stockable"
        RAW_MATERIAL = "RAW_MATERIAL", "Raw Material"
        WIP = "WIP", "Work In Progress"
        FINISHED_GOOD = "FINISHED_GOOD", "Finished Good"
        CONSUMABLE = "CONSUMABLE", "Consumable"
        NON_STOCK = "NON_STOCK", "Non-Stock"
        SERVICE = "SERVICE", "Service / Labor"
        ASSET = "ASSET", "Capital Asset"
        MERCHANDISE = "MERCHANDISE", "Retail Merchandise"

    class Tracking(models.TextChoices):
        NONE = "NONE", "None"
        BATCH = "BATCH", "Batch / Lot"
        LOT = "LOT", "Lot / Lot Number"
        SERIAL = "SERIAL", "Serial"
        BATCH_SERIAL = "BATCH_SERIAL", "Batch + Serial"

    class ItemStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACTIVE = "ACTIVE", "Active"
        DISCONTINUED = "DISCONTINUED", "Discontinued"
        ARCHIVED = "ARCHIVED", "Archived"

    class ValuationMethod(models.TextChoices):
        MOVING_AVERAGE = "MOVING_AVERAGE", "Moving Weighted Average"
        FIFO = "FIFO", "First In First Out (FIFO)"
        STANDARD_COST = "STANDARD_COST", "Standard Costing"

    # Basic identity
    code = models.CharField(max_length=60, db_index=True)
    name = models.CharField(max_length=200)
    display_name = models.CharField(max_length=255, blank=True, default="")
    short_description = models.CharField(max_length=500, blank=True, default="")
    description = models.TextField(blank=True)
    long_description = models.TextField(blank=True, default="")
    item_type = models.CharField(
        max_length=20, choices=ItemType.choices, default=ItemType.STOCK
    )
    classification = models.CharField(max_length=40, blank=True, default="")
    category = models.ForeignKey(
        InventoryCategory, on_delete=models.PROTECT, related_name="items"
    )
    subcategory = models.ForeignKey(
        InventoryCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subcategory_items",
    )
    brand = models.CharField(max_length=100, blank=True)
    brand_ref = models.ForeignKey(
        "brands.Brand",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="items",
    )
    manufacturer = models.CharField(max_length=150, blank=True, default="")
    model_number = models.CharField(max_length=100, blank=True, default="")
    country_of_origin = models.CharField(max_length=10, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=ItemStatus.choices,
        default=ItemStatus.ACTIVE,
        db_index=True,
    )
    is_active = models.BooleanField(default=True)

    # Inventory policies
    track_inventory = models.BooleanField(default=True)
    is_stockable = models.BooleanField(default=True)
    is_purchasable = models.BooleanField(default=True)
    is_salable = models.BooleanField(default=True)
    allow_negative_stock = models.BooleanField(default=False)
    tracking = models.CharField(
        max_length=15, choices=Tracking.choices, default=Tracking.NONE
    )
    batch_tracking_required = models.BooleanField(default=False)
    serial_tracking_required = models.BooleanField(default=False)
    expiry_tracking_required = models.BooleanField(default=False)
    has_variants = models.BooleanField(default=False)

    # Units of Measure
    base_unit = models.CharField(max_length=20, default="EA")  # Backward compatibility string
    base_uom = models.ForeignKey(
        "units.UnitOfMeasure",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="base_items",
    )
    purchase_uom = models.ForeignKey(
        "units.UnitOfMeasure",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_items",
    )
    sales_uom = models.ForeignKey(
        "units.UnitOfMeasure",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales_items",
    )

    # Reorder parameters & Costing
    reorder_point = models.DecimalField(
        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]
    )
    reorder_quantity = models.DecimalField(
        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]
    )
    valuation_method = models.CharField(
        max_length=20,
        choices=ValuationMethod.choices,
        default=ValuationMethod.MOVING_AVERAGE,
    )
    standard_cost = models.DecimalField(
        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]
    )
    list_price = models.DecimalField(
        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]
    )

    # Physical dimensions
    net_weight = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    gross_weight = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    weight_uom = models.ForeignKey(
        "units.UnitOfMeasure",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    length = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    width = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    height = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    dimension_uom = models.ForeignKey(
        "units.UnitOfMeasure",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    volume = models.DecimalField(
        max_digits=16, decimal_places=6, null=True, blank=True, validators=[MinValueValidator(0)]
    )

    # Commercial & Tax
    min_order_qty = models.DecimalField(
        max_digits=18, decimal_places=4, default=Decimal("1.0000"), validators=[MinValueValidator(Decimal("0.0001"))]
    )
    lead_time_days = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    purchase_tax_code = models.CharField(max_length=40, blank=True, default="")
    sales_tax_code = models.CharField(max_length=40, blank=True, default="")
    barcode = models.CharField(max_length=100, blank=True, db_index=True)
    primary_image_id = models.CharField(max_length=120, blank=True, default="")

    # Audit & Context
    context_id = models.CharField(max_length=80, default="default", db_index=True)
    created_by = models.CharField(max_length=120, default="system")
    updated_by = models.CharField(max_length=120, default="system")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_items"
        ordering = ("code", "id")
        unique_together = (("context_id", "code"),)

    def __init__(self, *args, **kwargs):
        sku_val = kwargs.pop("sku", None)
        if sku_val is not None and "code" not in kwargs:
            kwargs["code"] = sku_val
        weight_val = kwargs.pop("weight", None)
        if weight_val is not None:
            if "gross_weight" not in kwargs:
                kwargs["gross_weight"] = weight_val
            if "net_weight" not in kwargs:
                kwargs["net_weight"] = weight_val
        super().__init__(*args, **kwargs)

    @property
    def weight(self):
        return self.gross_weight or self.net_weight or Decimal("0.0000")

    @weight.setter
    def weight(self, value):
        self.gross_weight = value
        self.net_weight = value

    @property
    def sku(self):
        return self.code

    @sku.setter
    def sku(self, value):
        self.code = value

    @property
    def barcodes(self):
        return self.multi_barcodes

    @property
    def tracks_batches(self):
        return self.batch_tracking_required or self.tracking in (
            self.Tracking.BATCH,
            self.Tracking.LOT,
            self.Tracking.BATCH_SERIAL,
        )

    @property
    def tracks_serials(self):
        return self.serial_tracking_required or self.tracking in (
            self.Tracking.SERIAL,
            self.Tracking.BATCH_SERIAL,
        )

    def clean(self):
        super().clean()
        if not self.is_stockable:
            self.track_inventory = False
        if self.item_type == self.ItemType.SERVICE:
            self.is_stockable = False
            self.track_inventory = False
            self.batch_tracking_required = False
            self.serial_tracking_required = False
            self.expiry_tracking_required = False
        if self.gross_weight and self.net_weight and self.gross_weight < self.net_weight:
            raise ValidationError({"gross_weight": "Gross weight cannot be less than net weight."})

    def save(self, *args, **kwargs):
        # Auto-sync code and sku
        if not self.code and self.sku:
            self.code = self.sku[:50]
        elif not self.sku and self.code:
            self.sku = self.code

        # Auto-sync display name
        if not self.display_name:
            self.display_name = self.name

        # Auto-sync status and is_active
        if not self.is_active and self.status == self.ItemStatus.ACTIVE:
            self.status = self.ItemStatus.DISCONTINUED
        elif self.status == self.ItemStatus.ACTIVE:
            self.is_active = True
        elif self.status in [self.ItemStatus.DISCONTINUED, self.ItemStatus.ARCHIVED]:
            self.is_active = False

        # Keep the legacy flags and tracking choice aligned for downstream flows.
        if self.tracking == self.Tracking.BATCH_SERIAL:
            self.batch_tracking_required = True
            self.serial_tracking_required = True
        elif self.tracking in (self.Tracking.BATCH, self.Tracking.LOT):
            self.batch_tracking_required = True
        elif self.tracking == self.Tracking.SERIAL:
            self.serial_tracking_required = True

        if self.batch_tracking_required and self.serial_tracking_required:
            self.tracking = self.Tracking.BATCH_SERIAL
        elif self.batch_tracking_required and self.tracking != self.Tracking.LOT:
            self.tracking = self.Tracking.BATCH
        elif self.serial_tracking_required:
            self.tracking = self.Tracking.SERIAL

        # Auto-sync UOMs
        if self.base_uom and not self.base_unit:
            self.base_unit = self.base_uom.code
        elif self.base_unit and not self.base_uom:
            from apps.units.models import UnitOfMeasure
            uom = UnitOfMeasure.objects.filter(code=self.base_unit).first()
            if uom:
                self.base_uom = uom

        # Auto-sync Brands
        if self.brand_ref and not self.brand:
            self.brand = self.brand_ref.name
        elif self.brand and not self.brand_ref:
            from apps.brands.models import Brand
            b = Brand.objects.filter(name=self.brand).first() or Brand.objects.filter(code=self.brand).first()
            if b:
                self.brand_ref = b

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} – {self.name}"


class InventoryItemVariant(models.Model):
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField(max_length=80, unique=True)
    variant_code = models.CharField(max_length=60, blank=True, default="")
    variant_name = models.CharField(max_length=150)
    barcode = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True, default="")
    attributes = models.JSONField(default=dict, blank=True)  # e.g. {"Color": "Blue", "Size": "XL"}
    status = models.CharField(max_length=20, default="ACTIVE", db_index=True)
    additional_cost = models.DecimalField(
        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]
    )
    additional_price = models.DecimalField(
        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]
    )
    weight = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    image_id = models.CharField(max_length=120, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "inv_variants"
        ordering = ("sku", "id")

    @property
    def barcodes(self):
        return self.multi_barcodes

    def __str__(self):
        return f"{self.sku} ({self.variant_name})"


class ProductBarcode(models.Model):
    class BarcodeType(models.TextChoices):
        PRIMARY = "PRIMARY", "Primary Barcode"
        PACKAGING = "PACKAGING", "Packaging / Case Barcode"
        PACKAGING_INNER = "PACKAGING_INNER", "Inner Packaging"
        PACKAGING_CASE = "PACKAGING_CASE", "Case / Carton (ITF-14)"
        SUPPLIER = "SUPPLIER", "Supplier / Vendor Barcode"
        CUSTOMER = "CUSTOMER", "Customer Specific SKU/Barcode"

    class Symbology(models.TextChoices):
        CODE128 = "CODE128", "Code 128"
        EAN13 = "EAN13", "EAN-13"
        UPC_A = "UPC_A", "UPC-A"
        QR_CODE = "QR_CODE", "QR Code"
        DATA_MATRIX = "DATA_MATRIX", "Data Matrix"
        ITF14 = "ITF14", "ITF-14"

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="multi_barcodes")
    variant = models.ForeignKey(
        InventoryItemVariant, on_delete=models.CASCADE, null=True, blank=True, related_name="multi_barcodes"
    )
    barcode_value = models.CharField(max_length=100, unique=True, db_index=True)
    barcode_type = models.CharField(
        max_length=30, choices=BarcodeType.choices, default=BarcodeType.PRIMARY
    )
    symbology = models.CharField(
        max_length=30, choices=Symbology.choices, default=Symbology.CODE128
    )
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "inv_product_barcodes"
        ordering = ("-is_primary", "id")

    def __str__(self):
        return f"{self.barcode_value} [{self.symbology}] ({self.barcode_type})"


class ProductUnitConversion(models.Model):
    item = models.ForeignKey(
        InventoryItem, on_delete=models.CASCADE, related_name="uom_conversions"
    )
    from_uom = models.ForeignKey(
        "units.UnitOfMeasure", on_delete=models.PROTECT, related_name="conversions_from"
    )
    to_uom = models.ForeignKey(
        "units.UnitOfMeasure", on_delete=models.PROTECT, related_name="conversions_to"
    )
    conversion_factor = models.DecimalField(
        max_digits=14,
        decimal_places=6,
        validators=[MinValueValidator(Decimal("0.000001"))],
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "inv_product_uom_conversions"
        unique_together = (("item", "from_uom", "to_uom"),)

    def __str__(self):
        return f"1 {self.from_uom.code} = {self.conversion_factor} {self.to_uom.code} for {self.item.code}"


class ItemAttributeValue(models.Model):
    item = models.ForeignKey(
        InventoryItem, on_delete=models.CASCADE, related_name="attribute_assignments"
    )
    variant = models.ForeignKey(
        InventoryItemVariant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="attribute_assignments",
    )
    attribute = models.ForeignKey(ProductAttribute, on_delete=models.PROTECT, related_name="+")
    attribute_value = models.ForeignKey(
        ProductAttributeValue, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    custom_value = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        db_table = "inv_item_attribute_values"
        unique_together = (("item", "variant", "attribute"),)

    def __str__(self):
        val = self.attribute_value.value if self.attribute_value else self.custom_value
        return f"{self.item.code}: {self.attribute.name} = {val}"


class ProductImportHistory(models.Model):
    class ImportStatus(models.TextChoices):
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"
        PARTIAL = "PARTIAL", "Partial Success"

    batch_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    file_name = models.CharField(max_length=255)
    total_rows = models.IntegerField(default=0)
    created_count = models.IntegerField(default=0)
    updated_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=ImportStatus.choices, default=ImportStatus.COMPLETED)
    error_log = models.JSONField(default=list, blank=True)
    imported_by = models.CharField(max_length=120, default="system")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "inv_product_import_history"
        ordering = ("-created_at",)

    def __str__(self):
        return f"Import {self.batch_id} - {self.file_name} ({self.status})"
