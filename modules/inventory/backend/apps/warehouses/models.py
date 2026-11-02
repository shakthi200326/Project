from django.db import models

class Warehouse(models.Model):
    class WarehouseType(models.TextChoices):
        MAIN = "Main Warehouse", "Main Warehouse"
        DISTRIBUTION = "Distribution Warehouse", "Distribution Warehouse"
        PRODUCTION = "Production Warehouse", "Production Warehouse"
        RETAIL = "Retail Warehouse", "Retail Warehouse"
        TRANSIT = "Transit Warehouse", "Transit Warehouse"

    code = models.CharField(max_length=40, db_index=True)
    name = models.CharField(max_length=120)
    warehouse_type = models.CharField(
        max_length=50,
        choices=WarehouseType.choices,
        default=WarehouseType.MAIN,
        blank=True
    )
    description = models.TextField(blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="United States")
    postal_code = models.CharField(max_length=30, blank=True, default="")
    manager = models.CharField(max_length=120, blank=True, default="")
    contact_number = models.CharField(max_length=40, blank=True, default="")
    status = models.CharField(max_length=20, default="Active")
    is_active = models.BooleanField(default=True)
    context_id = models.CharField(max_length=80, default="default", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_warehouses"
        ordering = ("code",)
        unique_together = (("context_id", "code"),)

    def __str__(self):
        return f"{self.code} – {self.name}"

    def save(self, *args, **kwargs):
        if self.status:
            self.is_active = (self.status.lower() == "active")
        super().save(*args, **kwargs)


class StorageLocation(models.Model):
    class LocationType(models.TextChoices):
        RECEIVING = "Receiving", "Receiving"
        STORAGE = "Storage", "Storage"
        PICKING = "Picking", "Picking"
        PACKING = "Packing", "Packing"
        DISPATCH = "Dispatch", "Dispatch"
        INSPECTION = "Inspection", "Inspection"
        QUARANTINE = "Quarantine", "Quarantine"
        RETURNS = "Returns", "Returns"

    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="locations")
    code = models.CharField(max_length=40, db_index=True)
    name = models.CharField(max_length=100)
    location_type = models.CharField(
        max_length=40,
        choices=LocationType.choices,
        default=LocationType.STORAGE,
        blank=True
    )
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, default="Active")  # Active, Inactive, Blocked
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

    def save(self, *args, **kwargs):
        if self.status:
            self.is_active = (self.status.lower() == "active")
        super().save(*args, **kwargs)


class Rack(models.Model):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="racks")
    location = models.ForeignKey(StorageLocation, on_delete=models.CASCADE, related_name="racks", null=True, blank=True)
    code = models.CharField(max_length=40, db_index=True)
    name = models.CharField(max_length=100)
    number_of_levels = models.PositiveIntegerField(default=4)
    status = models.CharField(max_length=20, default="Active")  # Active, Inactive, Blocked
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_racks"
        ordering = ("code",)

    def __str__(self):
        return f"{self.code} – {self.name}"


class Bin(models.Model):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="bins")
    location = models.ForeignKey(StorageLocation, on_delete=models.CASCADE, related_name="bins", null=True, blank=True)
    rack = models.ForeignKey(Rack, on_delete=models.CASCADE, related_name="bins", null=True, blank=True)
    code = models.CharField(max_length=40, db_index=True)
    name = models.CharField(max_length=100)
    rack_level = models.PositiveIntegerField(default=1)
    barcode = models.CharField(max_length=80, blank=True, default="")
    status = models.CharField(max_length=20, default="Active")  # Active, Inactive, Blocked
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_bins"
        ordering = ("code",)

    def __str__(self):
        return f"{self.code} – {self.name}"


class WarehouseConfiguration(models.Model):
    default_warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True)
    allow_negative_stock = models.BooleanField(default=False)
    require_storage_location = models.BooleanField(default=True)
    require_bin_selection = models.BooleanField(default=True)
    enable_multiple_warehouses = models.BooleanField(default=True)
    allow_inter_warehouse_transfer = models.BooleanField(default=True)
    warehouse_code_prefix = models.CharField(max_length=20, default="WH")
    location_code_prefix = models.CharField(max_length=20, default="LOC")
    rack_code_prefix = models.CharField(max_length=20, default="RACK")
    bin_code_prefix = models.CharField(max_length=20, default="BIN")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_warehouse_config"

    def __str__(self):
        return "Warehouse Configuration"
