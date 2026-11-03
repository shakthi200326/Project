from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation

class CycleCount(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "Scheduled", "Scheduled"
        IN_PROGRESS = "In Progress", "In Progress"
        COMPLETED = "Completed", "Completed"
        CANCELLED = "Cancelled", "Cancelled"

    class Frequency(models.TextChoices):
        DAILY = "Daily", "Daily"
        WEEKLY = "Weekly", "Weekly"
        MONTHLY = "Monthly", "Monthly"
        QUARTERLY = "Quarterly", "Quarterly"

    count_number = models.CharField(max_length=60, unique=True, db_index=True)
    count_date = models.DateField(default=timezone.localdate)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="cycle_counts")
    storage_location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="cycle_counts")
    product = models.ForeignKey(InventoryItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="cycle_counts")
    count_frequency = models.CharField(max_length=30, choices=Frequency.choices, default=Frequency.MONTHLY)
    assigned_to = models.CharField(max_length=120, default="Warehouse Auditor")
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.SCHEDULED)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_cycle_counts"
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        if not self.count_number:
            import random
            self.count_number = f"CYC-{timezone.now().year}-{random.randint(1000, 9999)}"
        super().save(*args, **kwargs)

    @property
    def warehouse_name(self):
        return self.warehouse.name if self.warehouse else ""

    @property
    def location_name(self):
        return self.storage_location.name if self.storage_location else "All Locations"

    @property
    def product_name(self):
        return self.product.name if self.product else "All Products"

    @property
    def sku(self):
        return self.product.code if self.product else ""


class FullStockCount(models.Model):
    class Status(models.TextChoices):
        INITIATED = "Initiated", "Initiated"
        COUNTING = "Counting", "Counting"
        COMPLETED = "Completed", "Completed"
        CANCELLED = "Cancelled", "Cancelled"

    count_number = models.CharField(max_length=60, unique=True, db_index=True)
    count_date = models.DateField(default=timezone.localdate)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="full_stock_counts")
    include_all_locations = models.BooleanField(default=True)
    storage_locations = models.ManyToManyField(StorageLocation, blank=True, related_name="full_stock_counts")
    assigned_to = models.CharField(max_length=120, default="Lead Auditor")
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.INITIATED)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_full_counts"
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        if not self.count_number:
            import random
            self.count_number = f"FSC-{timezone.now().year}-{random.randint(1000, 9999)}"
        super().save(*args, **kwargs)

    @property
    def warehouse_name(self):
        return self.warehouse.name if self.warehouse else ""


class StockCount(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        ADJUSTED = "ADJUSTED", "Adjusted"
        # Legacy values for test compatibility
        COUNTING = "COUNTING", "Counting in Progress"
        COMPLETED = "COMPLETED", "Count Completed"
        RECONCILED = "RECONCILED", "Reconciled & Adjusted"

    class VarianceReason(models.TextChoices):
        MISSING = "Missing Stock", "Missing Stock"
        EXCESS = "Excess Stock", "Excess Stock"
        DAMAGE = "Damage", "Damage"
        COUNTING_ERROR = "Counting Error", "Counting Error"
        OTHER = "Other", "Other"

    class CountType(models.TextChoices):
        PHYSICAL = "PHYSICAL", "Physical Stock Count"
        CYCLE = "CYCLE", "Cycle Count"
        FULL = "FULL", "Full Stock Count"

    count_number = models.CharField(max_length=60, unique=True, db_index=True)
    reconciliation_number = models.CharField(max_length=60, blank=True, db_index=True)
    count_date = models.DateField(default=timezone.localdate)
    reconciliation_date = models.DateField(default=timezone.localdate)
    count_type = models.CharField(max_length=20, choices=CountType.choices, default=CountType.PHYSICAL)

    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="stock_counts")
    location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_counts")
    item = models.ForeignKey(InventoryItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_counts")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.SET_NULL, null=True, blank=True)

    system_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    physical_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    difference_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))

    variance_reason = models.CharField(max_length=60, blank=True, default="", choices=VarianceReason.choices)
    reason = models.CharField(max_length=255, blank=True, default="")
    remarks = models.TextField(blank=True, default="")

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    assigned_to = models.CharField(max_length=120, blank=True, default="Staff Counter")
    counted_by = models.CharField(max_length=120, blank=True, default="")
    verified_by = models.CharField(max_length=120, blank=True, default="")

    cycle_count = models.ForeignKey(CycleCount, on_delete=models.SET_NULL, null=True, blank=True, related_name="count_entries")
    full_count = models.ForeignKey(FullStockCount, on_delete=models.SET_NULL, null=True, blank=True, related_name="count_entries")

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
                self.count_number = f"CNT-{timezone.now().year}-{random.randint(1000, 9999)}"
        if not self.reconciliation_number:
            self.reconciliation_number = self.count_number
        if self.count_date:
            self.reconciliation_date = self.count_date
        elif self.reconciliation_date:
            self.count_date = self.reconciliation_date

        if self.physical_quantity is not None and self.system_quantity is not None:
            self.difference_quantity = self.physical_quantity - self.system_quantity

        if self.variance_reason and not self.reason:
            self.reason = self.variance_reason
        elif self.reason and not self.variance_reason:
            self.variance_reason = self.reason

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.count_number} – {self.warehouse.code} ({self.status})"

    @property
    def product(self):
        return self.item

    @property
    def product_name(self):
        return self.item.name if self.item else ""

    @property
    def sku(self):
        return self.item.code if self.item else ""

    @property
    def warehouse_name(self):
        return self.warehouse.name if self.warehouse else ""

    @property
    def storage_location(self):
        return self.location

    @property
    def location_name(self):
        return self.location.name if self.location else "Main Area"


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


class AuditHistory(models.Model):
    class Status(models.TextChoices):
        COMPLETED = "Completed", "Completed"
        APPROVED = "Approved", "Approved"
        CLOSED = "Closed", "Closed"

    audit_number = models.CharField(max_length=60, unique=True, db_index=True)
    count_number = models.CharField(max_length=60, db_index=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="audit_histories")
    count_date = models.DateField(default=timezone.localdate)
    counted_by = models.CharField(max_length=120, default="Staff Counter")
    verified_by = models.CharField(max_length=120, default="Inventory Lead")
    total_products_counted = models.PositiveIntegerField(default=1)
    variance_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.COMPLETED)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_audit_history"
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        if not self.audit_number:
            import random
            self.audit_number = f"AUD-{timezone.now().year}-{random.randint(1000, 9999)}"
        super().save(*args, **kwargs)

    @property
    def warehouse_name(self):
        return self.warehouse.name if self.warehouse else ""
