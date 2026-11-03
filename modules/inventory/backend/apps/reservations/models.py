from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation

class StockReservation(models.Model):
    class Status(models.TextChoices):
        RESERVED = "RESERVED", "Reserved"
        PARTIALLY_FULFILLED = "PARTIALLY_FULFILLED", "Partially Fulfilled"
        FULFILLED = "FULFILLED", "Fulfilled"
        RELEASED = "RELEASED", "Released"
        EXPIRED = "EXPIRED", "Expired"
        # Legacy compatibility
        PENDING = "PENDING", "Pending"

    class ReservationType(models.TextChoices):
        SALES = "Sales", "Sales"
        PRODUCTION = "Production", "Production"
        INTERNAL_USE = "Internal Use", "Internal Use"
        OTHER = "Other", "Other"

    reservation_number = models.CharField(max_length=80, blank=True, db_index=True)
    reservation_date = models.DateField(default=timezone.localdate)
    reservation_type = models.CharField(max_length=40, choices=ReservationType.choices, default=ReservationType.SALES)
    reference_number = models.CharField(max_length=80, blank=True, default="")
    # Preserved for existing test compatibility
    reference_doc = models.CharField(max_length=80, blank=True, default="", db_index=True)

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="reservations")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.CASCADE, null=True, blank=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="reservations")
    location = models.ForeignKey(StorageLocation, on_delete=models.CASCADE, null=True, blank=True)
    quantity = models.DecimalField(max_digits=20, decimal_places=4)
    required_date = models.DateField(null=True, blank=True)
    batch_number = models.CharField(max_length=80, blank=True, default="")
    remarks = models.TextField(blank=True, default="")

    status = models.CharField(max_length=30, choices=Status.choices, default=Status.RESERVED)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_reservations"
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        if not self.reservation_number:
            if self.reference_doc:
                self.reservation_number = self.reference_doc
            else:
                import random
                self.reservation_number = f"RES-{timezone.now().year}-{random.randint(1000, 9999)}"
        if not self.reference_doc:
            self.reference_doc = self.reservation_number
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Reservation {self.reservation_number or self.reference_doc}: {self.item.code} x {self.quantity} ({self.status})"
