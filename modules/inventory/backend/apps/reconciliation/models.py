from decimal import Decimal
from django.db import models
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation

class StockCount(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        COUNTING = "COUNTING", "Counting in Progress"
        COMPLETED = "COMPLETED", "Count Completed"
        RECONCILED = "RECONCILED", "Reconciled & Adjusted"

    count_number = models.CharField(max_length=60, unique=True, db_index=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="stock_counts")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    snapshot_taken_at = models.DateTimeField(null=True, blank=True)
    reconciled_at = models.DateTimeField(null=True, blank=True)
    reconciled_by = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_counts"
        ordering = ("-created_at",)

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
