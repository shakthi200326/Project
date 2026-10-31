from decimal import Decimal
from django.db import models
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse

class InventoryValuation(models.Model):
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="valuations")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="valuations")
    total_on_hand = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    weighted_average_cost = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    total_value = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_valuation"
        unique_together = (("item", "warehouse"),)

    def __str__(self):
        return f"{self.item.code} @ {self.warehouse.code}: WAV=${self.weighted_average_cost:.2f}, Total=${self.total_value:.2f}"

