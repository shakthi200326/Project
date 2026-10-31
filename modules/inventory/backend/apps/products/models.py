from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from apps.categories.models import InventoryCategory

class InventoryItem(models.Model):
    class ItemType(models.TextChoices):
        STOCK = "STOCK", "Stockable"
        RAW_MATERIAL = "RAW_MATERIAL", "Raw Material"
        FINISHED_GOOD = "FINISHED_GOOD", "Finished Good"
        CONSUMABLE = "CONSUMABLE", "Consumable"
        NON_STOCK = "NON_STOCK", "Non-Stock"

    class Tracking(models.TextChoices):
        NONE = "NONE", "None"
        BATCH = "BATCH", "Batch / Lot"
        SERIAL = "SERIAL", "Serial"

    code = models.CharField(max_length=60, db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        InventoryCategory, on_delete=models.PROTECT, related_name="items"
    )
    base_unit = models.CharField(max_length=20, default="EA")  # Decoupled UOM string or code
    item_type = models.CharField(
        max_length=20, choices=ItemType.choices, default=ItemType.STOCK
    )
    barcode = models.CharField(max_length=100, blank=True, db_index=True)
    brand = models.CharField(max_length=100, blank=True)
    tracking = models.CharField(
        max_length=10, choices=Tracking.choices, default=Tracking.NONE
    )
    reorder_point = models.DecimalField(
        max_digits=20, decimal_places=4, default=0, validators=[MinValueValidator(0)]
    )
    reorder_quantity = models.DecimalField(
        max_digits=20, decimal_places=4, default=0, validators=[MinValueValidator(0)]
    )
    is_active = models.BooleanField(default=True)
    context_id = models.CharField(max_length=80, default="default", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_items"
        ordering = ("code", "id")
        unique_together = (("context_id", "code"),)

    def __str__(self):
        return f"{self.code} – {self.name}"

class InventoryItemVariant(models.Model):
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField(max_length=80, unique=True)
    variant_name = models.CharField(max_length=150)
    barcode = models.CharField(max_length=100, blank=True)
    attributes = models.JSONField(default=dict, blank=True)  # e.g. {"size": "XL", "color": "Blue"}
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "inv_variants"
        ordering = ("sku",)

    def __str__(self):
        return f"{self.sku} ({self.variant_name})"
