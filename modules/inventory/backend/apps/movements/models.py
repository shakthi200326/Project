from decimal import Decimal
from django.db import models
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation

class StockTransaction(models.Model):
    class TransactionType(models.TextChoices):
        RECEIPT = "RECEIPT", "Goods Receipt"
        ISSUE = "ISSUE", "Stock Issue"
        TRANSFER = "TRANSFER", "Warehouse Transfer"
        ADJUSTMENT = "ADJUSTMENT", "Inventory Adjustment"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        POSTED = "POSTED", "Posted"
        REVERSED = "REVERSED", "Reversed"

    document_number = models.CharField(max_length=60, unique=True, db_index=True)
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="transactions")
    destination_warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, null=True, blank=True, related_name="inbound_transfers"
    )
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

class StockTransactionLine(models.Model):
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
    serial_numbers = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "inv_transaction_lines"

    def __str__(self):
        return f"{self.transaction.document_number}: {self.item.code} x {self.quantity}"

