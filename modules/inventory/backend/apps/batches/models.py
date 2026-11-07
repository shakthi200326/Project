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
    tracking_type = models.CharField(
        max_length=10,
        choices=[("BATCH", "Batch"), ("LOT", "Lot")],
        default="BATCH",
        db_index=True,
    )
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="batches")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.CASCADE, null=True, blank=True)
    supplier = models.CharField(max_length=150, blank=True, default="")
    goods_receipt_ref = models.CharField(max_length=120, blank=True, default="")
    manufacturer = models.CharField(max_length=200, blank=True, default="")
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


class AllocationRecord(models.Model):
    class Strategy(models.TextChoices):
        FIFO = "FIFO", "First In First Out"
        FEFO = "FEFO", "First Expired First Out"
        MANUAL = "MANUAL", "Manual"

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="allocation_records")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="allocation_records")
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True, related_name="allocation_records")
    transaction_ref = models.CharField(max_length=120, blank=True, default="")
    strategy = models.CharField(max_length=10, choices=Strategy.choices, default=Strategy.FIFO)
    serial_number_ref = models.CharField(max_length=100, blank=True, default="")
    allocated_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_allocation_records"
        ordering = ("-created_at",)

    def __str__(self):
        return f"Allocation {self.id}: {self.item.code} qty={self.allocated_quantity} ({self.strategy})"


class ProductRecall(models.Model):
    class RecallType(models.TextChoices):
        MANDATORY = "MANDATORY", "Mandatory"
        VOLUNTARY = "VOLUNTARY", "Voluntary"
        PRECAUTIONARY = "PRECAUTIONARY", "Precautionary"

    class Priority(models.TextChoices):
        CRITICAL = "CRITICAL", "Critical"
        HIGH = "HIGH", "High"
        MEDIUM = "MEDIUM", "Medium"
        LOW = "LOW", "Low"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        INITIATED = "INITIATED", "Initiated"
        INVESTIGATION = "INVESTIGATION", "Under Investigation"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        RESOLVED = "RESOLVED", "Resolved"
        CLOSED = "CLOSED", "Closed"

    recall_number = models.CharField(max_length=80, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    reason = models.TextField()
    recall_type = models.CharField(max_length=20, choices=RecallType.choices, default=RecallType.VOLUNTARY)
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="recalls")
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True, related_name="recalls")
    serial_number_ref = models.CharField(max_length=100, blank=True, default="")
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.HIGH)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    affected_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    description = models.TextField(blank=True, default="")
    corrective_action = models.TextField(blank=True, default="")
    initiated_by = models.CharField(max_length=150, blank=True, default="")
    initiated_date = models.DateField(null=True, blank=True)
    closure_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_product_recalls"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.recall_number} - {self.title} ({self.status})"


class RecallAction(models.Model):
    class ActionType(models.TextChoices):
        QUARANTINE_APPLIED = "QUARANTINE_APPLIED", "Quarantine Applied"
        RETURN_RECEIVED = "RETURN_RECEIVED", "Return Received"
        REPLACEMENT_ISSUED = "REPLACEMENT_ISSUED", "Replacement Issued"
        DISPOSAL_POSTED = "DISPOSAL_POSTED", "Disposal Posted"
        STATUS_CHANGE = "STATUS_CHANGE", "Status Changed"

    recall = models.ForeignKey(ProductRecall, on_delete=models.CASCADE, related_name="actions")
    action_type = models.CharField(max_length=30, choices=ActionType.choices)
    action_date = models.DateTimeField(auto_now_add=True)
    actor = models.CharField(max_length=150, blank=True, default="")
    quantity_affected = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "inv_recall_actions"
        ordering = ("-action_date",)

    def __str__(self):
        return f"{self.recall.recall_number}: {self.action_type} ({self.quantity_affected})"


class ShelfLifePolicy(models.Model):
    class ShelfLifeUnit(models.TextChoices):
        DAYS = "DAYS", "Days"
        MONTHS = "MONTHS", "Months"
        YEARS = "YEARS", "Years"

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="shelf_life_policies")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.CASCADE, null=True, blank=True, related_name="shelf_life_policies")
    shelf_life_duration = models.PositiveIntegerField(default=12)
    shelf_life_unit = models.CharField(max_length=10, choices=ShelfLifeUnit.choices, default=ShelfLifeUnit.MONTHS)
    expiry_warning_days = models.PositiveIntegerField(default=30, help_text="Days before expiry to trigger near-expiry alert")
    min_remaining_shelf_life_days = models.PositiveIntegerField(default=0, help_text="Minimum remaining shelf life days at time of receipt")
    auto_calculate_expiry = models.BooleanField(default=True, help_text="Auto-compute expiry = manufacturing_date + duration")
    allow_manual_override = models.BooleanField(default=True, help_text="Allow manual expiry date to override auto-calculation")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_shelf_life_policies"
        ordering = ("item__name",)
        unique_together = (("item", "variant"),)

    def __str__(self):
        return f"Shelf Life Policy: {self.item.code} ({self.shelf_life_duration} {self.shelf_life_unit})"
