from django.db import models
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation
from apps.batches.models import Batch

class SerialNumber(models.Model):
    class Status(models.TextChoices):
        IN_STOCK = "IN_STOCK", "In Stock"
        RESERVED = "RESERVED", "Reserved"
        DISPATCHED = "DISPATCHED", "Dispatched"
        DEFECTIVE = "DEFECTIVE", "Defective"
        RETURNED = "RETURNED", "Returned"

    serial_number = models.CharField(max_length=100, unique=True, db_index=True)
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="serials")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.CASCADE, null=True, blank=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name="serials")
    location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True)
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True, related_name="serials")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_STOCK)
    received_at = models.DateTimeField(null=True, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    warranty_until = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_serials"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.serial_number} ({self.item.code}) – {self.status}"
