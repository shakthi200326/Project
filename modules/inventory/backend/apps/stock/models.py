from decimal import Decimal

from django.db import models

from django.utils import timezone

from django.core.validators import MinValueValidator

from apps.products.models import InventoryItem, InventoryItemVariant

from apps.warehouses.models import Warehouse, StorageLocation, Bin



class StockBalance(models.Model):

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="balances")

    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.CASCADE, null=True, blank=True, related_name="balances")

    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="balances")

    location = models.ForeignKey(StorageLocation, on_delete=models.CASCADE, null=True, blank=True, related_name="balances")

    bin = models.ForeignKey(Bin, on_delete=models.SET_NULL, null=True, blank=True, related_name="balances")



    on_hand_qty = models.DecimalField(

        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]

    )

    reserved_qty = models.DecimalField(

        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]

    )

    blocked_qty = models.DecimalField(

        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]

    )

    # Status buckets set by stock reclassification; part of on-hand but never available.
    quarantined_qty = models.DecimalField(
        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]
    )
    damaged_qty = models.DecimalField(
        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]
    )

    updated_at = models.DateTimeField(auto_now=True)



    class Meta:

        db_table = "inv_balances"

        ordering = ("-updated_at", "-id")

        unique_together = (("item", "variant", "warehouse", "location"),)



    def __init__(self, *args, **kwargs):

        qty = kwargs.pop("quantity_on_hand", None)

        if qty is not None and "on_hand_qty" not in kwargs:

            kwargs["on_hand_qty"] = qty

        batch_num = kwargs.pop("batch_number", None)

        super().__init__(*args, **kwargs)

        if batch_num:

            self._batch_number = batch_num



    @property

    def quantity_on_hand(self):

        return self.on_hand_qty



    @quantity_on_hand.setter

    def quantity_on_hand(self, value):

        self.on_hand_qty = value



    def save(self, *args, **kwargs):

        super().save(*args, **kwargs)

        if getattr(self, "_batch_number", None):

            try:

                from apps.batches.models import Batch

                Batch.objects.get_or_create(

                    batch_number=self._batch_number,

                    item=self.item,

                    defaults={

                        "warehouse": self.warehouse,

                        "location": self.location,

                        "remaining_quantity": self.on_hand_qty,

                        "initial_quantity": self.on_hand_qty,

                    }

                )

            except Exception:

                pass



    @property

    def available_qty(self) -> Decimal:

        """Available = On-hand - Reserved - Blocked - Quarantined - Damaged."""

        return max(
            Decimal("0.0000"),
            self.on_hand_qty - self.reserved_qty - self.blocked_qty - self.quarantined_qty - self.damaged_qty,
        )



    def __str__(self):

        return f"{self.item.code} @ {self.warehouse.code}: On-hand={self.on_hand_qty}, Avail={self.available_qty}"



class StockLedgerEntry(models.Model):

    """Immutable, write-once transaction ledger entry."""

    class MovementType(models.TextChoices):

        RECEIPT = "RECEIPT", "Goods Receipt"

        ISSUE = "ISSUE", "Stock Issue"

        TRANSFER_IN = "TRANSFER_IN", "Transfer In"

        TRANSFER_OUT = "TRANSFER_OUT", "Transfer Out"

        ADJUSTMENT = "ADJUSTMENT", "Inventory Adjustment"

        RETURN = "RETURN", "Stock Return"

        REVERSAL = "REVERSAL", "Transaction Reversal"
        RECLASSIFICATION = "RECLASSIFICATION", "Stock Status Reclassification"



    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="ledger_entries")

    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.PROTECT, null=True, blank=True)

    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="ledger_entries")

    location = models.ForeignKey(StorageLocation, on_delete=models.PROTECT, null=True, blank=True)



    movement_type = models.CharField(max_length=20, choices=MovementType.choices)

    quantity_delta = models.DecimalField(max_digits=20, decimal_places=4)

    balance_after = models.DecimalField(max_digits=20, decimal_places=4)

    unit_cost = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))

    total_value_delta = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))



    transaction_ref = models.CharField(max_length=80, db_index=True)

    reason = models.CharField(max_length=255, blank=True)

    batch_number = models.CharField(max_length=80, blank=True, default="")

    serial_number = models.CharField(max_length=100, blank=True, default="")

    transaction_uom = models.CharField(max_length=20, blank=True, default="")

    conversion_factor_at_txn = models.DecimalField(max_digits=14, decimal_places=6, default=Decimal("1.000000"))

    destination_warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    actor = models.CharField(max_length=120, default="system")
    # Stock-status movement carried by this entry (reclassification); quantity_delta stays the on-hand change.
    from_status = models.CharField(max_length=20, blank=True, default="")
    to_status = models.CharField(max_length=20, blank=True, default="")
    status_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)



    class Meta:

        db_table = "inv_ledger"

        ordering = ("-created_at", "-id")



    def __str__(self):

        return f"[{self.created_at}] {self.transaction_ref}: {self.item.code} {self.quantity_delta:+f}"



class DamagedStock(models.Model):

    class Status(models.TextChoices):

        PENDING = "PENDING", "Pending"

        QUARANTINED = "QUARANTINED", "Quarantined"

        WRITTEN_OFF = "WRITTEN_OFF", "Written Off"

        DISPOSED = "DISPOSED", "Disposed"



    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="damaged_records")

    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.PROTECT, null=True, blank=True)

    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="damaged_records")

    location = models.ForeignKey(StorageLocation, on_delete=models.PROTECT, null=True, blank=True)

    batch_number = models.CharField(max_length=80, blank=True, default="")

    damaged_qty = models.DecimalField(

        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]

    )

    damage_reason = models.CharField(max_length=255, blank=True, default="")

    damage_date = models.DateField(default=timezone.localdate)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    remarks = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)



    class Meta:

        db_table = "inv_damaged_stock"

        ordering = ("-damage_date", "-id")



    def __str__(self):

        return f"{self.item.code} damaged x {self.damaged_qty} ({self.status})"



class StockInTransit(models.Model):

    class Status(models.TextChoices):

        IN_TRANSIT = "IN_TRANSIT", "In Transit"

        RECEIVED = "RECEIVED", "Received"

        PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED", "Partially Received"

        LOST = "LOST", "Lost / Discrepant"

        CANCELLED = "CANCELLED", "Cancelled"



    transfer_number = models.CharField(max_length=100, db_index=True)

    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="transit_records")

    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.PROTECT, null=True, blank=True)

    source_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="outbound_transits")

    destination_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="inbound_transits")

    quantity = models.DecimalField(

        max_digits=20, decimal_places=4, validators=[MinValueValidator(Decimal("0.0001"))]

    )

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_TRANSIT, db_index=True)

    batch_number = models.CharField(max_length=80, blank=True, default="")

    serial_numbers = models.JSONField(default=list, blank=True)

    carrier = models.CharField(max_length=120, blank=True, default="")

    tracking_number = models.CharField(max_length=120, blank=True, default="")

    dispatched_at = models.DateTimeField(default=timezone.now)

    expected_delivery = models.DateTimeField(null=True, blank=True)

    received_at = models.DateTimeField(null=True, blank=True)

    tenant_id = models.CharField(max_length=100, default="default-tenant", db_index=True)

    project_id = models.CharField(max_length=100, default="prj-default", db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)



    class Meta:

        db_table = "stock_in_transit"

        ordering = ("-dispatched_at", "-id")



    def __str__(self):

        return f"Transit {self.transfer_number}: {self.item.code} ({self.quantity}) {self.source_warehouse.code} -> {self.destination_warehouse.code} [{self.status}]"

