"""
Goods Receipt & Inspection supporting records.

The receipt itself is a StockTransaction (transaction_type=RECEIPT) and its
lines are StockTransactionLine rows; the tables here only hold what those
tables cannot: per-line inspection events, putaway placements, discrepancy
cases and versioned submodule settings. Accepted / rejected / partial views
are derived from line totals and are not stored separately.
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.warehouses.models import Warehouse, StorageLocation


class ReceiptInspection(models.Model):
    class InspectionKind(models.TextChoices):
        RECEIPT = "RECEIPT", "Receipt Inspection"
        QUALITY = "QUALITY", "Quality Inspection"

    class QualityResult(models.TextChoices):
        NONE = "", "Not Applicable"
        PASS = "PASS", "Pass"
        CONDITIONAL = "CONDITIONAL", "Conditional Pass"
        FAIL = "FAIL", "Fail"

    inspection_number = models.CharField(max_length=60, unique=True, db_index=True)
    kind = models.CharField(max_length=10, choices=InspectionKind.choices, db_index=True)
    receipt = models.ForeignKey(StockTransaction, on_delete=models.PROTECT, related_name="receipt_inspections")
    line = models.ForeignKey(StockTransactionLine, on_delete=models.PROTECT, related_name="inspections")

    # Receipt inspection: inspection_quantity = accepted_quantity + rejected_quantity
    inspection_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    accepted_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    rejected_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    hold_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    pending_quantity_after = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    rejection_reason = models.CharField(max_length=255, blank=True, default="")
    rejected_serial_numbers = models.JSONField(default=list, blank=True)
    held_serial_numbers = models.JSONField(default=list, blank=True)
    rejection_disposition = models.CharField(max_length=60, blank=True, default="")
    delivery_challan_reference = models.CharField(max_length=100, blank=True, default="")
    packaging_condition = models.CharField(max_length=60, blank=True, default="")

    # Quality inspection: passed_quantity + failed_quantity = sample_quantity
    inspection_type = models.CharField(max_length=60, blank=True, default="")
    sample_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    passed_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    failed_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    criteria_results = models.JSONField(default=list, blank=True)
    quality_result = models.CharField(max_length=12, choices=QualityResult.choices, blank=True, default="")

    inspector = models.CharField(max_length=120)
    inspection_date = models.DateField(default=timezone.localdate)
    remarks = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_receipt_inspections"
        ordering = ("-created_at", "-id")
        indexes = [models.Index(fields=["receipt", "kind"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(inspection_quantity__gte=0)
                & models.Q(accepted_quantity__gte=0)
                & models.Q(rejected_quantity__gte=0)
                & models.Q(hold_quantity__gte=0)
                & models.Q(pending_quantity_after__gte=0)
                & models.Q(sample_quantity__gte=0)
                & models.Q(passed_quantity__gte=0)
                & models.Q(failed_quantity__gte=0),
                name="inv_rcpt_insp_qty_nonneg",
            ),
            models.CheckConstraint(
                condition=models.Q(inspection_quantity=models.F("accepted_quantity") + models.F("rejected_quantity") + models.F("hold_quantity")),
                name="inv_rcpt_insp_qty_reconciles",
            ),
            models.CheckConstraint(
                condition=models.Q(sample_quantity=models.F("passed_quantity") + models.F("failed_quantity")),
                name="inv_rcpt_insp_sample_reconciles",
            ),
        ]

    def __str__(self):
        return f"{self.inspection_number} ({self.kind}) for {self.receipt.document_number}"


class ReceiptPutaway(models.Model):
    class Status(models.TextChoices):
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    putaway_number = models.CharField(max_length=60, unique=True, db_index=True)
    receipt = models.ForeignKey(StockTransaction, on_delete=models.PROTECT, related_name="receipt_putaways")
    line = models.ForeignKey(StockTransactionLine, on_delete=models.PROTECT, related_name="putaways")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="receipt_putaways")
    location = models.ForeignKey(StorageLocation, on_delete=models.PROTECT, related_name="receipt_putaways")
    quantity = models.DecimalField(max_digits=20, decimal_places=4)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.COMPLETED, db_index=True)
    putaway_by = models.CharField(max_length=120)
    putaway_date = models.DateField(default=timezone.localdate)
    remarks = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_receipt_putaways"
        ordering = ("-created_at", "-id")
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="inv_rcpt_putaway_qty_pos"),
        ]

    def __str__(self):
        return f"{self.putaway_number}: {self.quantity} -> {self.location.code}"


class ReceiptDiscrepancy(models.Model):
    class ResolutionStatus(models.TextChoices):
        OPEN = "OPEN", "Open"
        UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
        RESOLVED = "RESOLVED", "Resolved"
        CLOSED = "CLOSED", "Closed"

    discrepancy_number = models.CharField(max_length=60, unique=True, db_index=True)
    receipt = models.ForeignKey(StockTransaction, on_delete=models.PROTECT, related_name="receipt_discrepancies")
    line = models.ForeignKey(
        StockTransactionLine, on_delete=models.PROTECT, null=True, blank=True, related_name="discrepancies"
    )
    discrepancy_type = models.CharField(max_length=40)
    expected_quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    received_quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    difference_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    reason = models.TextField(blank=True, default="")
    resolution_status = models.CharField(
        max_length=20, choices=ResolutionStatus.choices, default=ResolutionStatus.OPEN, db_index=True
    )
    resolution_notes = models.TextField(blank=True, default="")
    resolved_by = models.CharField(max_length=120, blank=True, default="")
    resolved_at = models.DateTimeField(null=True, blank=True)
    remarks = models.TextField(blank=True, default="")
    is_system_generated = models.BooleanField(default=False)
    created_by = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_receipt_discrepancies"
        ordering = ("-created_at", "-id")

    def __str__(self):
        return f"{self.discrepancy_number} ({self.discrepancy_type}) – {self.resolution_status}"


class GoodsReceiptSettingVersion(models.Model):
    """
    One row per saved version of a submodule's settings. The active version is
    the latest one whose effective_from is on or before today, so the table is
    also the configuration history.
    """

    class Submodule(models.TextChoices):
        REGISTER = "register", "Receipt Register"
        CREATE = "create", "Create Goods Receipt"
        INSPECTION = "inspection", "Receipt Inspection"
        QUALITY = "quality", "Quality Inspection"
        ACCEPTED = "accepted", "Accepted Goods"
        REJECTED = "rejected", "Rejected Goods"
        PARTIAL = "partial", "Partial Acceptance"
        PUTAWAY = "putaway", "Putaway Management"
        DISCREPANCY = "discrepancy", "Receipt Discrepancy"
        HISTORY = "history", "Receipt History"

    submodule = models.CharField(max_length=20, choices=Submodule.choices, db_index=True)
    settings = models.JSONField(default=dict)
    effective_from = models.DateField(default=timezone.localdate)
    change_reason = models.CharField(max_length=255, blank=True, default="")
    is_reset = models.BooleanField(default=False)
    created_by = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_grn_setting_versions"
        ordering = ("-effective_from", "-id")
        indexes = [models.Index(fields=["submodule", "effective_from"])]

    def __str__(self):
        return f"{self.submodule} settings effective {self.effective_from}"
