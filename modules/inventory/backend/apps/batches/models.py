from decimal import Decimal
from datetime import date
from django.db import models
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation

class Batch(models.Model):
    class Status(models.TextChoices):
        PENDING_INSPECTION = "Pending Inspection", "Pending Inspection"
        RELEASED = "Released", "Released"
        QUARANTINED = "Quarantined", "Quarantined"
        REJECTED = "Rejected", "Rejected"
        CLOSED = "Closed", "Closed"
        # Backward compatibility aliases
        UP_PENDING = "PENDING_INSPECTION", "Pending Inspection (UP)"
        UP_RELEASED = "RELEASED", "Released (UP)"
        UP_QUARANTINED = "QUARANTINED", "Quarantined (UP)"
        UP_REJECTED = "REJECTED", "Rejected (UP)"
        UP_CLOSED = "CLOSED", "Closed (UP)"
        HEALTHY = "HEALTHY", "Healthy / Active"
        EXPIRING_SOON = "EXPIRING_SOON", "Expiring Soon"
        EXPIRED = "EXPIRED", "Expired"

    batch_number = models.CharField(max_length=80, unique=True, db_index=True)
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="batches")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.CASCADE, null=True, blank=True)
    supplier = models.CharField(max_length=150, blank=True, default="")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name="batches")
    location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="batches")
    manufacturing_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True, db_index=True)
    received_date = models.DateField(default=date.today)
    initial_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    remaining_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    quarantined_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    batch_status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING_INSPECTION)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.HEALTHY)
    supplier_lot = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_batches"
        ordering = ("expiry_date", "-created_at")

    @property
    def sku(self):
        return self.item.code if self.item else ""

    @property
    def product_name(self):
        return self.item.name if self.item else ""

    @property
    def days_remaining(self):
        if not self.expiry_date:
            return 999
        delta = self.expiry_date - date.today()
        return delta.days

    @property
    def days_to_expiry(self):
        return self.days_remaining

    @property
    def expiry_status(self):
        if not self.expiry_date:
            return "N/A"
        days = self.days_remaining
        if days <= 0:
            return "Expired"
        elif days <= 30:
            return "Expiring Soon"
        return "Healthy"

    def __str__(self):
        return f"{self.batch_number} – {self.sku} (Status: {self.batch_status})"

class BatchQuarantineRecord(models.Model):
    class Reason(models.TextChoices):
        QUALITY_ISSUE = "Quality Issue", "Quality Issue"
        DAMAGE = "Damage", "Damage"
        EXPIRY_CONCERN = "Expiry Concern", "Expiry Concern"
        INSPECTION_FAILURE = "Inspection Failure", "Inspection Failure"
        RECALL = "Recall", "Recall"
        OTHER = "Other", "Other"

    class InspectionResult(models.TextChoices):
        PASSED = "Passed", "Passed"
        FAILED = "Failed", "Failed"
        PARTIALLY_PASSED = "Partially Passed", "Partially Passed"

    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="quarantine_records")
    quarantine_number = models.CharField(max_length=80, unique=True, db_index=True)
    product = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="+")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    quarantine_quantity = models.DecimalField(max_digits=20, decimal_places=4)
    quarantine_reason = models.CharField(max_length=50, choices=Reason.choices, default=Reason.QUALITY_ISSUE)
    remarks = models.TextField(blank=True, default="")
    quarantine_date = models.DateField(default=date.today)

    is_released = models.BooleanField(default=False)
    released_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    inspection_result = models.CharField(max_length=30, choices=InspectionResult.choices, blank=True, default="")
    release_reason = models.TextField(blank=True, default="")
    released_by = models.CharField(max_length=120, blank=True, default="")
    release_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_batch_quarantines"
        ordering = ("-quarantine_date", "-created_at")

    def __str__(self):
        return f"{self.quarantine_number}: {self.batch.batch_number} ({self.quarantine_quantity} units)"
