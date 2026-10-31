from decimal import Decimal
from django.db import models
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation

class StockReservation(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        FULFILLED = "FULFILLED", "Fulfilled"
        RELEASED = "RELEASED", "Released"

    reference_doc = models.CharField(max_length=80, db_index=True)
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="reservations")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.CASCADE, null=True, blank=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="reservations")
    location = models.ForeignKey(StorageLocation, on_delete=models.CASCADE, null=True, blank=True)
    quantity = models.DecimalField(max_digits=20, decimal_places=4)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_reservations"
        ordering = ("-created_at",)

    def __str__(self):
        return f"Reservation {self.reference_doc}: {self.item.code} x {self.quantity} ({self.status})"

