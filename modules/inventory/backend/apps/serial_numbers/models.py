from datetime import date
from django.db import models
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation
from apps.batches.models import Batch

class SerialNumber(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "Available", "Available"
        RESERVED = "Reserved", "Reserved"
        ISSUED = "Issued", "Issued"
        IN_TRANSIT = "In Transit", "In Transit"
        RETURNED = "Returned", "Returned"
        QUARANTINED = "Quarantined", "Quarantined"
        BLOCKED = "Blocked", "Blocked"
        DAMAGED = "Damaged", "Damaged"
        SCRAPPED = "Scrapped", "Scrapped"
        # Backward compatibility choices
        IN_STOCK = "IN_STOCK", "In Stock"
        DISPATCHED = "DISPATCHED", "Dispatched"
        DEFECTIVE = "DEFECTIVE", "Defective"

    serial_number = models.CharField(max_length=100, unique=True, db_index=True)
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="serials")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.CASCADE, null=True, blank=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name="serials")
    location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="serials")
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True, related_name="serials")
    received_date = models.DateField(default=date.today)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.AVAILABLE)
    received_at = models.DateTimeField(null=True, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    warranty_until = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    # Phase-7 extensions
    supplier_serial_reference = models.CharField(max_length=150, blank=True, default="")
    goods_receipt_ref = models.CharField(max_length=120, blank=True, default="")
    warranty_start_date = models.DateField(null=True, blank=True)
    manufacturing_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_serials"
        ordering = ("-created_at",)

    @property
    def sku(self):
        return self.item.code if self.item else ""

    @property
    def product_name(self):
        return self.item.name if self.item else ""

    def __str__(self):
        return f"{self.serial_number} ({self.sku}) – {self.status}"
