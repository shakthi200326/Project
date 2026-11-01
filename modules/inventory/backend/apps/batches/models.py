from decimal import Decimal
from datetime import date
from django.db import models
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse

class Batch(models.Model):
    class Status(models.TextChoices):
        HEALTHY = "HEALTHY", "Healthy / Active"
        EXPIRING_SOON = "EXPIRING_SOON", "Expiring Soon"
        EXPIRED = "EXPIRED", "Expired"
        QUARANTINED = "QUARANTINED", "Quarantined"

    batch_number = models.CharField(max_length=80, unique=True, db_index=True)
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="batches")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.CASCADE, null=True, blank=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name="batches")
    manufacturing_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True, db_index=True)
    initial_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    remaining_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.HEALTHY)
    supplier_lot = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_batches"
        ordering = ("expiry_date", "-created_at")

    @property
    def days_remaining(self):
        if not self.expiry_date:
            return 999
        delta = self.expiry_date - date.today()
        return delta.days

    def __str__(self):
        return f"{self.batch_number} – {self.item.code} (Expires: {self.expiry_date})"
