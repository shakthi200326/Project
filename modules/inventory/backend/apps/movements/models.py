from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation

class StockTransaction(models.Model):
    class TransactionType(models.TextChoices):
        RECEIPT = "RECEIPT", "Goods Receipt"
        ISSUE = "ISSUE", "Stock Issue"
        TRANSFER = "TRANSFER", "Warehouse Transfer"
        ADJUSTMENT = "ADJUSTMENT", "Inventory Adjustment"
        RETURN = "RETURN", "Stock Return"
        OPENING = "OPENING", "Opening Stock"
        RECLASSIFICATION = "RECLASSIFICATION", "Stock Reclassification"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        DISPATCHED = "DISPATCHED", "Dispatched (In-Transit)"
        IN_TRANSIT = "IN_TRANSIT", "In Transit"
        RECEIVED = "RECEIVED", "Received"
        COMPLETED = "COMPLETED", "Completed"
        PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED", "Partially Received"
        APPROVED = "APPROVED", "Approved"
        INSPECTED = "INSPECTED", "Inspected"
        # Goods receipt workflow stages
        UNDER_INSPECTION = "UNDER_INSPECTION", "Under Inspection"
        ACCEPTED = "ACCEPTED", "Accepted"
        PARTIALLY_ACCEPTED = "PARTIALLY_ACCEPTED", "Partially Accepted"
        PUTAWAY_PENDING = "PUTAWAY_PENDING", "Putaway Pending"
        READY_TO_POST = "READY_TO_POST", "Ready to Post"
        POSTED = "POSTED", "Posted"
        REVERSED = "REVERSED", "Reversed"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    class TransferType(models.TextChoices):
        INTER_WAREHOUSE = "INTER_WAREHOUSE", "Inter-Warehouse"

    class TransferScope(models.TextChoices):
        SAME_CITY = "SAME_CITY", "Same-City"
        INTER_CITY = "INTER_CITY", "Inter-City"

    document_number = models.CharField(max_length=60, unique=True, db_index=True)
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    transaction_date = models.DateField(default=timezone.localdate, blank=True)

    # Source document (integration-driven, optional) and idempotency
    source_document_type = models.CharField(max_length=60, blank=True, default="")
    source_document_id = models.CharField(max_length=100, blank=True, default="")
    idempotency_key = models.CharField(max_length=150, null=True, blank=True, unique=True)

    # Goods Receipt header
    receipt_type = models.CharField(max_length=40, blank=True, default="")
    purchase_order_reference = models.CharField(max_length=100, blank=True, default="")
    supplier_reference = models.CharField(max_length=100, blank=True, default="")
    expected_date = models.DateField(null=True, blank=True)
    inspection_required = models.BooleanField(default=False)
    received_by = models.CharField(max_length=120, blank=True, default="")
    receiving_location = models.ForeignKey(
        StorageLocation, on_delete=models.PROTECT, null=True, blank=True, related_name="receipts"
    )

    # Transfer header
    transfer_type = models.CharField(max_length=20, choices=TransferType.choices, blank=True, default="")
    transfer_scope = models.CharField(max_length=20, choices=TransferScope.choices, blank=True, default="")
    expected_arrival_date = models.DateField(null=True, blank=True)
    dispatched_by = models.CharField(max_length=120, blank=True, default="")
    dispatched_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)

    # Returns: original document being returned against
    original_transaction = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="returns"
    )
    original_reference_type = models.CharField(max_length=60, blank=True, default="")

    # Workflow audit
    requested_by = models.CharField(max_length=120, blank=True, default="")
    created_by = models.CharField(max_length=120, blank=True, default="")
    submitted_by = models.CharField(max_length=120, blank=True, default="")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.CharField(max_length=120, blank=True, default="")
    approved_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    # Facilities
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="transactions")
    destination_warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, null=True, blank=True, related_name="inbound_transfers"
    )

    # Phase 3 Specific Necessary Fields
    reference_number = models.CharField(max_length=100, blank=True, default="")
    supplier = models.CharField(max_length=150, blank=True, default="")
    issue_type = models.CharField(max_length=50, blank=True, default="")
    issued_to = models.CharField(max_length=150, blank=True, default="")
    party_name = models.CharField(max_length=150, blank=True, default="")
    return_type = models.CharField(max_length=50, blank=True, default="")
    product_condition = models.CharField(max_length=50, blank=True, default="")
    return_disposition = models.CharField(max_length=50, blank=True, default="")
    adjustment_type = models.CharField(max_length=20, blank=True, default="")
    reason = models.TextField(blank=True, default="")

    reversal_of = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="reversals"
    )
    notes = models.TextField(blank=True)
    posted_by = models.CharField(max_length=120, blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_transactions"
        ordering = ("-created_at", "-id")

    def __str__(self):
        return f"{self.document_number} ({self.transaction_type} – {self.status})"

class InspectionStatus(models.TextChoices):
    NOT_REQUIRED = "NOT_REQUIRED", "Not Required"
    PENDING = "PENDING", "Pending Inspection"
    PASSED = "PASSED", "Accepted"
    PARTIAL = "PARTIAL", "Partially Accepted"
    FAILED = "FAILED", "Rejected"


class PutawayStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PARTIAL = "PARTIAL", "Partial"
    COMPLETED = "COMPLETED", "Completed"


class StockTransactionLine(models.Model):
    InspectionStatus = InspectionStatus
    PutawayStatus = PutawayStatus

    transaction = models.ForeignKey(StockTransaction, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="movement_lines")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.PROTECT, null=True, blank=True)
    location = models.ForeignKey(StorageLocation, on_delete=models.PROTECT, null=True, blank=True)
    destination_location = models.ForeignKey(
        StorageLocation, on_delete=models.PROTECT, null=True, blank=True, related_name="transfer_dest_lines"
    )
    quantity = models.DecimalField(max_digits=20, decimal_places=4)
    unit_cost = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    batch_number = models.CharField(max_length=80, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    serial_numbers = models.JSONField(default=list, blank=True)
    transaction_uom = models.CharField(max_length=20, blank=True, default="")
    conversion_factor_at_txn = models.DecimalField(max_digits=14, decimal_places=6, default=Decimal("1.000000"))
    quantity_base_uom = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    system_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    actual_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    difference_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    manufacturing_date = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=255, blank=True, default="")

    # Goods receipt / return inspection.
    # Invariant once inspected: received = accepted + rejected + hold + pending_inspection.
    expected_quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    accepted_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    rejected_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    hold_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    pending_inspection_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    inspection_status = models.CharField(max_length=20, choices=InspectionStatus.choices, default=InspectionStatus.NOT_REQUIRED)
    rejection_reason = models.CharField(max_length=255, blank=True, default="")
    inspection_remarks = models.TextField(blank=True, default="")
    inspected_by = models.CharField(max_length=120, blank=True, default="")
    inspected_at = models.DateTimeField(null=True, blank=True)

    # Putaway: where accepted stock is stored (defaults to `location` when not set)
    putaway_location = models.ForeignKey(
        StorageLocation, on_delete=models.PROTECT, null=True, blank=True, related_name="putaway_lines"
    )
    putaway_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    putaway_status = models.CharField(max_length=20, choices=PutawayStatus.choices, default=PutawayStatus.PENDING)

    # Transfer dispatch / receipt with discrepancy capture
    dispatched_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    received_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    shortage_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    damaged_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))

    # Reclassification between stock statuses
    from_status = models.CharField(max_length=20, blank=True, default="")
    to_status = models.CharField(max_length=20, blank=True, default="")

    # Issue against an existing reservation (consumes reserved quantity)
    reservation = models.ForeignKey(
        "reservations.StockReservation", on_delete=models.PROTECT, null=True, blank=True, related_name="issue_lines"
    )

    class Meta:
        db_table = "inv_transaction_lines"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(accepted_quantity__gte=0)
                & models.Q(rejected_quantity__gte=0)
                & models.Q(hold_quantity__gte=0)
                & models.Q(pending_inspection_quantity__gte=0)
                & models.Q(putaway_quantity__gte=0),
                name="inv_txline_inspection_qty_nonneg",
            ),
            # Uninspected lines carry zeros; once quantities are split they must reconcile.
            models.CheckConstraint(
                condition=(
                    models.Q(accepted_quantity=0, rejected_quantity=0, hold_quantity=0, pending_inspection_quantity=0)
                    | models.Q(
                        quantity=models.F("accepted_quantity")
                        + models.F("rejected_quantity")
                        + models.F("hold_quantity")
                        + models.F("pending_inspection_quantity")
                    )
                ),
                name="inv_txline_inspection_qty_reconciles",
            ),
            models.CheckConstraint(
                condition=models.Q(putaway_quantity__lte=models.F("accepted_quantity")),
                name="inv_txline_putaway_lte_accepted",
            ),
        ]

    def __str__(self):
        return f"{self.transaction.document_number}: {self.item.code} x {self.quantity}"
