from decimal import Decimal
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone


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
    contact_person = models.CharField(max_length=120, blank=True, default="")
    contact_number = models.CharField(max_length=40, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    manager = models.CharField(max_length=120, blank=True, default="")
    timezone = models.CharField(max_length=50, default="UTC", blank=True)
    operating_hours = models.CharField(max_length=100, default="08:00 - 17:00", blank=True)

    # Capability flags
    receiving_enabled = models.BooleanField(default=True)
    dispatch_enabled = models.BooleanField(default=True)
    storage_enabled = models.BooleanField(default=True)
    returns_enabled = models.BooleanField(default=True)

    # Capacity ratings
    max_weight_capacity = models.DecimalField(max_digits=16, decimal_places=4, null=True, blank=True)
    max_volume_capacity = models.DecimalField(max_digits=16, decimal_places=4, null=True, blank=True)
    max_pallet_positions = models.IntegerField(null=True, blank=True)

    status = models.CharField(max_length=20, default="Active")
    is_active = models.BooleanField(default=True)
    context_id = models.CharField(max_length=80, default="default", db_index=True)
    created_by = models.CharField(max_length=120, default="system", blank=True)
    updated_by = models.CharField(max_length=120, default="system", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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


class WarehouseZone(models.Model):
    class ZoneType(models.TextChoices):
        STANDARD = "STANDARD", "Standard Ambient"
        REFRIGERATED = "REFRIGERATED", "Cold / Refrigerated"
        FROZEN = "FROZEN", "Deep Freeze"
        HAZMAT = "HAZMAT", "Hazardous Materials"
        HIGH_SECURITY = "HIGH_SECURITY", "High Value / Secure Cage"

    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="zones")
    code = models.CharField(max_length=40, db_index=True)
    name = models.CharField(max_length=100)
    zone_type = models.CharField(max_length=40, choices=ZoneType.choices, default=ZoneType.STANDARD, blank=True)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_zones"
        ordering = ("warehouse", "code")
        unique_together = (("warehouse", "code"),)

    def __str__(self):
        return f"{self.warehouse.code} / {self.code} ({self.name})"


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
        DAMAGED = "Damaged", "Damaged"
        TRANSIT = "Transit", "Transit"

    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="locations")
    parent_location = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="sub_locations")
    zone_ref = models.ForeignKey(WarehouseZone, on_delete=models.SET_NULL, null=True, blank=True, related_name="locations")
    code = models.CharField(max_length=40, db_index=True)
    name = models.CharField(max_length=100)
    location_type = models.CharField(
        max_length=40,
        choices=LocationType.choices,
        default=LocationType.STORAGE,
        blank=True
    )
    storage_purpose = models.CharField(max_length=60, blank=True, default="")
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, default="Active")  # Active, Inactive, Blocked

    # Operational permission gates
    allow_receiving = models.BooleanField(default=False)
    allow_putaway = models.BooleanField(default=True)
    allow_picking = models.BooleanField(default=True)
    allow_dispatch = models.BooleanField(default=False)
    allow_product_mixing = models.BooleanField(default=True)
    allow_batch_mixing = models.BooleanField(default=True)
    allow_serial_mixing = models.BooleanField(default=True)

    # Scannable barcode
    barcode = models.CharField(max_length=80, blank=True, default="")

    # Physical limits
    max_weight = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    max_volume = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    picking_priority = models.IntegerField(default=100)
    putaway_priority = models.IntegerField(default=100)

    # Backward compatibility strings
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

    def clean(self):
        if self.parent_location:
            if self.parent_location_id == self.id:
                raise ValidationError("A storage location cannot be its own parent.")
            current = self.parent_location
            while current:
                if current.id == self.id:
                    raise ValidationError("Circular reference detected in location hierarchy.")
                current = current.parent_location

    def save(self, *args, **kwargs):
        self.clean()
        if self.status:
            self.is_active = (self.status.lower() == "active")
        # Auto-configure flags based on location type if default
        if self.location_type == self.LocationType.RECEIVING:
            self.allow_receiving = True
        elif self.location_type in [self.LocationType.DISPATCH, self.LocationType.PACKING]:
            self.allow_dispatch = True
        elif self.location_type in [self.LocationType.QUARANTINE, self.LocationType.INSPECTION]:
            self.allow_picking = False
            self.allow_dispatch = False
        super().save(*args, **kwargs)


class Rack(models.Model):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="racks")
    location = models.ForeignKey(StorageLocation, on_delete=models.CASCADE, related_name="racks", null=True, blank=True)
    zone = models.ForeignKey(WarehouseZone, on_delete=models.SET_NULL, null=True, blank=True, related_name="racks")
    code = models.CharField(max_length=40, db_index=True)
    name = models.CharField(max_length=100)
    rack_type = models.CharField(max_length=40, default="Standard Pallet", blank=True)
    number_of_levels = models.PositiveIntegerField(default=4)
    max_weight = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    max_volume = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    status = models.CharField(max_length=20, default="Active")  # Active, Inactive, Blocked
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_racks"
        ordering = ("code",)
        unique_together = (("warehouse", "code"),)

    def __str__(self):
        return f"{self.code} – {self.name}"


class Bin(models.Model):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="bins")
    location = models.ForeignKey(StorageLocation, on_delete=models.CASCADE, related_name="bins", null=True, blank=True)
    rack = models.ForeignKey(Rack, on_delete=models.CASCADE, related_name="bins", null=True, blank=True)
    code = models.CharField(max_length=40, db_index=True)
    name = models.CharField(max_length=100)
    rack_level = models.PositiveIntegerField(default=1)
    bin_type = models.CharField(max_length=30, default="Standard", blank=True)
    barcode = models.CharField(max_length=80, blank=True, default="")
    qr_code = models.CharField(max_length=120, blank=True, default="")
    max_weight = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    max_volume = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    max_quantity = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    picking_priority = models.IntegerField(default=100)
    putaway_priority = models.IntegerField(default=100)
    allow_mixing_products = models.BooleanField(default=True)
    allow_mixing_batches = models.BooleanField(default=True)
    status = models.CharField(max_length=20, default="Active")  # Active, Inactive, Blocked
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_bins"
        ordering = ("code",)
        unique_together = (("warehouse", "code"),)

    def __str__(self):
        return f"{self.code} – {self.name}"


class WarehouseMapping(models.Model):
    class MappingType(models.TextChoices):
        USER = "USER", "User to Warehouse"
        ROLE = "ROLE", "Role to Warehouse"
        PRODUCT = "PRODUCT", "Product Preferred Warehouse"
        BUSINESS_UNIT = "BUSINESS_UNIT", "Business Unit to Warehouse"
        BRANCH = "BRANCH", "Branch to Warehouse"

    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="mappings")
    mapping_type = models.CharField(max_length=30, choices=MappingType.choices, default=MappingType.USER)
    entity_id = models.CharField(max_length=100, db_index=True)
    entity_name = models.CharField(max_length=150, blank=True, default="")
    is_default = models.BooleanField(default=False)
    is_receiving_default = models.BooleanField(default=False)
    is_dispatch_default = models.BooleanField(default=False)
    status = models.CharField(max_length=20, default="Active")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_warehouse_mappings"
        ordering = ("warehouse", "mapping_type", "entity_id")

    def __str__(self):
        return f"{self.mapping_type}: {self.entity_id} -> {self.warehouse.code}"


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
    valuation_method = models.CharField(max_length=50, default="Weighted Average Cost")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_warehouse_config"

    def __str__(self):
        return "Warehouse Configuration"


class WarehouseOperationalConfiguration(models.Model):
    class PutawayStrategy(models.TextChoices):
        MANUAL = "MANUAL", "Manual Operator Selection"
        DEDICATED_BIN = "DEDICATED_BIN", "Dedicated Primary Bin"
        LEAST_OCCUPIED = "LEAST_OCCUPIED", "Least Occupied Space"
        PRIORITY_BASED = "PRIORITY_BASED", "Strict Putaway Priority"

    class PickingStrategy(models.TextChoices):
        FIFO = "FIFO", "First In First Out (FIFO)"
        FEFO = "FEFO", "First Expired First Out (FEFO)"
        LIFO = "LIFO", "Last In First Out (LIFO)"

    class CapacityEnforcement(models.TextChoices):
        NONE = "NONE", "No Limit Enforcement (Reporting Only)"
        WARN = "WARN", "Warning Notification On Exceeding Limit"
        STRICT_BLOCK = "STRICT_BLOCK", "Strict Rejection of Overflow Putaway"

    warehouse = models.OneToOneField(Warehouse, on_delete=models.CASCADE, related_name="operational_config")
    default_receiving_location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    default_inspection_location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    default_quarantine_location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    default_storage_location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    default_picking_location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    default_packing_location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    default_dispatch_location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    default_returns_location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    putaway_strategy = models.CharField(max_length=30, choices=PutawayStrategy.choices, default=PutawayStrategy.MANUAL)
    picking_strategy = models.CharField(max_length=30, choices=PickingStrategy.choices, default=PickingStrategy.FIFO)
    capacity_enforcement = models.CharField(max_length=30, choices=CapacityEnforcement.choices, default=CapacityEnforcement.WARN)
    require_barcode_scan = models.BooleanField(default=True)
    allow_negative_stock = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_warehouse_operational_config"

    def __str__(self):
        return f"Operational Config for {self.warehouse.code}"
