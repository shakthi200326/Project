from decimal import Decimal
from django.db import models

class UnitOfMeasure(models.Model):
    code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=10, blank=True)
    is_base = models.BooleanField(default=True)
    base_unit = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="derived_units"
    )
    conversion_factor = models.DecimalField(
        max_digits=12, decimal_places=4, default=Decimal("1.0000")
    )
    decimal_places = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "inv_units"
        ordering = ("code",)

    def __str__(self):
        return f"{self.name} ({self.code})"

