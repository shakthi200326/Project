import random
from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse

class ReorderRule(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "Active", "Active"
        INACTIVE = "Inactive", "Inactive"
        # Backward compatibility
        ACTIVE_CAPS = "ACTIVE", "Active"
        INACTIVE_CAPS = "INACTIVE", "Inactive"

    product = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="reorder_rules")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="reorder_rules")
    reorder_point = models.DecimalField(max_digits=20, decimal_places=4)
    reorder_quantity = models.DecimalField(max_digits=20, decimal_places=4)
    lead_time_days = models.IntegerField(default=0, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_reorder_rules"
        ordering = ("-created_at",)
        unique_together = ("product", "warehouse")

    def __str__(self):
        return f"Rule {self.product.code} @ {self.warehouse.code} (Point: {self.reorder_point})"

    @property
    def sku(self):
        return self.product.code

    @property
    def product_name(self):
        return self.product.name

    @property
    def warehouse_name(self):
        return self.warehouse.name


class StockLevel(models.Model):
    product = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="stock_levels")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="stock_levels")
    min_stock = models.DecimalField(max_digits=20, decimal_places=4)
    max_stock = models.DecimalField(max_digits=20, decimal_places=4)
    safety_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"), blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_stock_levels"
        ordering = ("-created_at",)
        unique_together = ("product", "warehouse")

    def __str__(self):
        return f"Min/Max {self.product.code} @ {self.warehouse.code} ({self.min_stock} - {self.max_stock})"

    @property
    def sku(self):
        return self.product.code

    @property
    def product_name(self):
        return self.product.name

    @property
    def warehouse_name(self):
        return self.warehouse.name


class ReplenishmentPlan(models.Model):
    class Status(models.TextChoices):
        PENDING = "Pending", "Pending"
        PLANNED = "Planned", "Planned"
        COMPLETED = "Completed", "Completed"
        # Backward compatibility
        PENDING_CAPS = "PENDING", "Pending"
        PLANNED_CAPS = "PLANNED", "Planned"
        COMPLETED_CAPS = "COMPLETED", "Completed"

    plan_number = models.CharField(max_length=80, unique=True, blank=True, db_index=True)
    product = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="replenishment_plans")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="replenishment_plans")
    current_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    reserved_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    available_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    minimum_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    required_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_replenishment_plans"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.plan_number} - {self.product.code} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.plan_number:
            yr = timezone.now().year
            rand = random.randint(1000, 9999)
            self.plan_number = f"PLN-{yr}-{rand}"
        super().save(*args, **kwargs)

    @property
    def sku(self):
        return self.product.code

    @property
    def product_name(self):
        return self.product.name

    @property
    def warehouse_name(self):
        return self.warehouse.name


class PurchaseSuggestion(models.Model):
    class Status(models.TextChoices):
        PENDING = "Pending", "Pending"
        APPROVED = "Approved", "Approved"
        CONVERTED = "Converted", "Converted"
        REJECTED = "Rejected", "Rejected"
        # Backward compatibility
        PENDING_CAPS = "PENDING", "Pending"
        APPROVED_CAPS = "APPROVED", "Approved"
        CONVERTED_CAPS = "CONVERTED", "Converted"
        REJECTED_CAPS = "REJECTED", "Rejected"

    suggestion_number = models.CharField(max_length=80, unique=True, blank=True, db_index=True)
    suggestion_date = models.DateField(default=timezone.localdate)
    product = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="purchase_suggestions")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="purchase_suggestions")
    available_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    reorder_point = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    suggested_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    supplier = models.CharField(max_length=150, blank=True, default="")
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_purchase_suggestions"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.suggestion_number} - {self.product.code} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.suggestion_number:
            yr = timezone.now().year
            rand = random.randint(1000, 9999)
            self.suggestion_number = f"SUG-{yr}-{rand}"
        super().save(*args, **kwargs)

    @property
    def sku(self):
        return self.product.code

    @property
    def product_name(self):
        return self.product.name

    @property
    def warehouse_name(self):
        return self.warehouse.name

