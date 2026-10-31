from django.db import models

class Warehouse(models.Model):
    code = models.CharField(max_length=40, db_index=True)
    name = models.CharField(max_length=120)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    context_id = models.CharField(max_length=80, default="default", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_warehouses"
        ordering = ("code",)
        unique_together = (("context_id", "code"),)

    def __str__(self):
        return f"{self.code} – {self.name}"

class StorageLocation(models.Model):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="locations")
    code = models.CharField(max_length=40, db_index=True)
    name = models.CharField(max_length=100)
    zone = models.CharField(max_length=40, blank=True)
    aisle = models.CharField(max_length=20, blank=True)
    rack = models.CharField(max_length=20, blank=True)
    bin = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "inv_locations"
        ordering = ("warehouse", "code")
        unique_together = (("warehouse", "code"),)

    def __str__(self):
        return f"{self.warehouse.code} / {self.code}"
