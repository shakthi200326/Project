from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation

class StockCount(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        APPROVED = "APPROVED", "Approved"
        ADJUSTED = "ADJUSTED", "Adjusted"
        # Legacy values for test compatibility
        COUNTING = "COUNTING", "Counting in Progress"
        COMPLETED = "COMPLETED", "Count Completed"
        RECONCILED = "RECONCILED", "Reconciled & Adjusted"

    count_number = models.CharField(max_length=60, unique=True, db_index=True)
    reconciliation_number = models.CharField(max_length=60, blank=True, db_index=True)
    reconciliation_date = models.DateField(default=timezone.localdate)

    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="stock_counts")
    location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_counts")
    item = models.ForeignKey(InventoryItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_counts")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.SET_NULL, null=True, blank=True)

    system_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    physical_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    difference_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))

    reason = models.CharField(max_length=255, blank=True, default="")
    remarks = models.TextField(blank=True, default="")

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    adjustment_transaction = models.ForeignKey(
        "movements.StockTransaction", on_delete=models.SET_NULL, null=True, blank=True, related_name="reconciliation_records"
    )

    snapshot_taken_at = models.DateTimeField(null=True, blank=True)
    reconciled_at = models.DateTimeField(null=True, blank=True)
    reconciled_by = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_counts"
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        if not self.count_number:
            if self.reconciliation_number:
                self.count_number = self.reconciliation_number
            else:
                import random
                self.count_number = f"REC-{timezone.now().year}-{random.randint(1000, 9999)}"
        if not self.reconciliation_number:
            self.reconciliation_number = self.count_number
        if self.physical_quantity is not None and self.system_quantity is not None:
            self.difference_quantity = self.physical_quantity - self.system_quantity
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.count_number} – {self.warehouse.code} ({self.status})"

class StockCountLine(models.Model):
    stock_count = models.ForeignKey(StockCount, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT)
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.PROTECT, null=True, blank=True)
    location = models.ForeignKey(StorageLocation, on_delete=models.PROTECT, null=True, blank=True)
    snapshot_qty = models.DecimalField(max_digits=20, decimal_places=4)
    counted_qty = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)

    @property
    def variance_qty(self):
        if self.counted_qty is None:
            return Decimal("0.0000")
        return self.counted_qty - self.snapshot_qty

    class Meta:
        db_table = "inv_count_lines"
