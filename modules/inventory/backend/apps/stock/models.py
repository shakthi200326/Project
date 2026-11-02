from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation

class StockBalance(models.Model):
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="balances")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.CASCADE, null=True, blank=True, related_name="balances")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="balances")
    location = models.ForeignKey(StorageLocation, on_delete=models.CASCADE, null=True, blank=True, related_name="balances")

    on_hand_qty = models.DecimalField(
        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]
    )
    reserved_qty = models.DecimalField(
        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]
    )
    blocked_qty = models.DecimalField(
        max_digits=20, decimal_places=4, default=Decimal("0.0000"), validators=[MinValueValidator(0)]
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_balances"
        ordering = ("-updated_at", "-id")
        unique_together = (("item", "variant", "warehouse", "location"),)

    @property
    def available_qty(self) -> Decimal:
        """Available Stock = On-hand Stock - Reserved Stock - Blocked Stock."""
        return max(Decimal("0.0000"), self.on_hand_qty - self.reserved_qty - self.blocked_qty)

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
    actor = models.CharField(max_length=120, default="system")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "inv_ledger"
        ordering = ("-created_at", "-id")

    def __str__(self):
        return f"[{self.created_at}] {self.transaction_ref}: {self.item.code} {self.quantity_delta:+f}"
