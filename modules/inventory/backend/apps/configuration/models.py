from decimal import Decimal
from datetime import date
from django.db import models, transaction
from django.utils import timezone
from apps.warehouses.models import Warehouse


class InventoryConfiguration(models.Model):
    # 1. General Settings
    inventory_module_name = models.CharField(max_length=150, default="Enterprise Inventory Management")
    base_currency = models.CharField(max_length=10, default="USD")
    default_warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name="default_for_configs")
    default_uom = models.CharField(max_length=30, default="EA")
    enable_multiple_warehouses = models.BooleanField(default=True)

    # 2. Stock Settings
    allow_negative_stock = models.BooleanField(default=False)
    enable_stock_reservation = models.BooleanField(default=True)
    enable_stock_transfer = models.BooleanField(default=True)
    require_warehouse_selection = models.BooleanField(default=True)
    require_storage_location = models.BooleanField(default=True)
    require_bin_selection = models.BooleanField(default=False)
    default_low_stock_threshold = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("20.00"))

    # 3. Product Tracking Settings
    enable_batch_tracking = models.BooleanField(default=True)
    enable_serial_tracking = models.BooleanField(default=True)
    enable_expiry_tracking = models.BooleanField(default=True)
    enable_barcode_tracking = models.BooleanField(default=True)

    # 4. Valuation Settings
    VALUATION_CHOICES = (
        ("FIFO", "FIFO"),
        ("Weighted Average", "Weighted Average"),
        ("Standard Cost", "Standard Cost"),
    )
    valuation_method = models.CharField(max_length=40, choices=VALUATION_CHOICES, default="Weighted Average")
    cost_precision = models.IntegerField(default=2)
    include_additional_costs = models.BooleanField(default=False)

    # 6. Approval Settings
    goods_receipt_approval = models.BooleanField(default=False)
    stock_issue_approval = models.BooleanField(default=True)
    stock_transfer_approval = models.BooleanField(default=True)
    stock_adjustment_approval = models.BooleanField(default=True)
    stock_return_approval = models.BooleanField(default=True)
    stock_reconciliation_approval = models.BooleanField(default=True)
    batch_release_approval = models.BooleanField(default=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_global_configuration"

    def __str__(self):
        return f"{self.inventory_module_name} Configuration (Base: {self.base_currency})"

    @classmethod
    def get_solo(cls):
        """Singleton accessor for inventory module configuration."""
        obj, _ = cls.objects.get_or_create(id=1)
        return obj


class DocumentNumberingRule(models.Model):
    DOCUMENT_TYPES = (
        ("Warehouse", "Warehouse"),
        ("Storage Location", "Storage Location"),
        ("Rack", "Rack"),
        ("Bin", "Bin"),
        ("Goods Receipt", "Goods Receipt"),
        ("Receipt Inspection", "Receipt Inspection"),
        ("Quality Inspection", "Quality Inspection"),
        ("Putaway", "Putaway"),
        ("Receipt Discrepancy", "Receipt Discrepancy"),
        ("Stock Issue", "Stock Issue"),
        ("Stock Transfer", "Stock Transfer"),
        ("Inter-Warehouse Transfer", "Inter-Warehouse Transfer"),
        ("Stock Adjustment", "Stock Adjustment"),
        ("Stock Return", "Stock Return"),
        ("Opening Stock", "Opening Stock"),
        ("Stock Reservation", "Stock Reservation"),
        ("Stock Release", "Stock Release"),
        ("Stock Reclassification", "Stock Reclassification"),
        ("Stock Reconciliation", "Stock Reconciliation"),
    )

    RESET_CHOICES = (
        ("Never", "Never"),
        ("Yearly", "Yearly"),
    )

    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES, unique=True)
    prefix = models.CharField(max_length=20)
    starting_number = models.PositiveIntegerField(default=1)
    current_number = models.PositiveIntegerField(default=1)
    number_length = models.PositiveIntegerField(default=5)
    reset_frequency = models.CharField(max_length=20, choices=RESET_CHOICES, default="Never")
    last_reset_year = models.IntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_document_numbering"
        ordering = ("document_type",)

    def __str__(self):
        return f"{self.document_type}: {self.prefix}-{'0'*self.number_length} ({self.reset_frequency})"

    @classmethod
    def generate_next_number(cls, doc_type):
        """Thread-safe generation of unique, consecutive sequence numbers."""
        current_year = date.today().year
        with transaction.atomic():
            rule, created = cls.objects.select_for_update().get_or_create(
                document_type=doc_type,
                defaults={
                    "prefix": cls.get_default_prefix(doc_type),
                    "starting_number": 1,
                    "current_number": 1,
                    "number_length": 5,
                    "reset_frequency": "Never",
                    "last_reset_year": current_year,
                }
            )

            # Check yearly reset
            if rule.reset_frequency == "Yearly" and rule.last_reset_year and rule.last_reset_year < current_year:
                rule.current_number = rule.starting_number
                rule.last_reset_year = current_year

            num_val = rule.current_number
            rule.current_number += 1
            rule.save()

            formatted_seq = str(num_val).zfill(rule.number_length)
            return f"{rule.prefix}-{formatted_seq}"

    @classmethod
    def get_default_prefix(cls, doc_type):
        mapping = {
            "Warehouse": "WH",
            "Storage Location": "LOC",
            "Rack": "RACK",
            "Bin": "BIN",
            "Goods Receipt": "GRN",
            "Receipt Inspection": "RIN",
            "Quality Inspection": "QIN",
            "Putaway": "PUT",
            "Receipt Discrepancy": "RDN",
            "Stock Issue": "ISS",
            "Stock Transfer": "TRF",
            "Inter-Warehouse Transfer": "IWT",
            "Stock Adjustment": "ADJ",
            "Stock Return": "RET",
            "Opening Stock": "OPN",
            "Stock Reservation": "RES",
            "Stock Release": "REL",
            "Stock Reclassification": "RCL",
            "Stock Reconciliation": "REC",
        }
        return mapping.get(doc_type, "DOC")


class ConfigurationAuditLog(models.Model):
    section = models.CharField(max_length=80)
    action = models.CharField(max_length=50, default="UPDATE")
    changed_by = models.CharField(max_length=120, default="Operations Admin")
    previous_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_config_audit_log"
        ordering = ("-timestamp",)

    def __str__(self):
        return f"{self.section} {self.action} by {self.changed_by} at {self.timestamp.strftime('%Y-%m-%d %H:%M')}"



class StockOperationsSettingVersion(models.Model):
    class Submodule(models.TextChoices):
        STOCK_IN = "stock_in", "Stock In"
        STOCK_ISSUE = "stock_issue", "Stock Issue"
        STOCK_TRANSFER = "stock_transfer", "Stock Transfer"
        INTER_WAREHOUSE = "inter_warehouse", "Inter-Warehouse Transfer"
        STOCK_ADJUSTMENT = "stock_adjustment", "Stock Adjustment"
        STOCK_RETURN = "stock_return", "Stock Return"
        OPENING_STOCK = "opening_stock", "Opening Stock"
        STOCK_RESERVATION = "stock_reservation", "Stock Reservation"
        STOCK_RELEASE = "stock_release", "Stock Release"
        STOCK_RECLASSIFICATION = "stock_reclassification", "Stock Reclassification"
        STOCK_OUT = "stock_out", "Stock Out"

    submodule = models.CharField(max_length=40, choices=Submodule.choices, db_index=True)
    settings = models.JSONField(default=dict)
    effective_from = models.DateField(default=timezone.localdate)
    change_reason = models.CharField(max_length=255, blank=True, default="")
    is_reset = models.BooleanField(default=False)
    created_by = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_stock_ops_setting_versions"
        ordering = ("-effective_from", "-id")
        indexes = [models.Index(fields=["submodule", "effective_from"])]

    def __str__(self):
        return f"{self.submodule} settings effective {self.effective_from}"
