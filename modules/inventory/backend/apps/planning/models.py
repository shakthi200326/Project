import random
import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.categories.models import InventoryCategory
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
        GENERATED = "Generated", "Generated"
        PENDING = "Pending", "Pending"
        UNDER_REVIEW = "Under Review", "Under Review"
        APPROVED = "Approved", "Approved"
        READY_FOR_ONBOARDING = "Ready for Onboarding", "Ready for Onboarding"
        READY_FOR_PURCHASE = "Ready for Purchase", "Ready for Purchase"
        SENT_TO_PURCHASE = "Sent to Purchase", "Sent to Purchase"
        CONVERTED = "Converted", "Converted"
        REJECTED = "Rejected", "Rejected"
        CANCELLED = "Cancelled", "Cancelled"
        EXPIRED = "Expired", "Expired"
        # Backward compatibility
        PENDING_CAPS = "PENDING", "Pending"
        APPROVED_CAPS = "APPROVED", "Approved"
        CONVERTED_CAPS = "CONVERTED", "Converted"
        REJECTED_CAPS = "REJECTED", "Rejected"

    class Priority(models.TextChoices):
        LOW = "Low", "Low"
        MEDIUM = "Medium", "Medium"
        HIGH = "High", "High"
        CRITICAL = "Critical", "Critical"

    class ActionType(models.TextChoices):
        PURCHASE = "PURCHASE", "Purchase Stock"
        TRANSFER = "TRANSFER", "Warehouse Transfer"
        REVIEW = "REVIEW", "Manual Review"
        ONBOARD = "ONBOARD", "Onboard Product"

    class OpportunityType(models.TextChoices):
        REPLENISHMENT = "REPLENISHMENT", "Stock Replenishment"
        EXISTING_PRODUCT_OPPORTUNITY = "EXISTING_PRODUCT_OPPORTUNITY", "Existing Product Market Opportunity"
        NEW_PRODUCT_OPPORTUNITY = "NEW_PRODUCT_OPPORTUNITY", "New Discovered Product Opportunity"
        CROSS_INDUSTRY_OPPORTUNITY = "CROSS_INDUSTRY_OPPORTUNITY", "Cross-Industry Opportunity"
        PROCUREMENT_OPPORTUNITY = "PROCUREMENT_OPPORTUNITY", "Special Procurement Deal"

    suggestion_number = models.CharField(max_length=80, unique=True, blank=True, db_index=True)
    suggestion_date = models.DateField(default=timezone.localdate)
    product = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        related_name="purchase_suggestions",
        blank=True,
        null=True,
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="purchase_suggestions",
        blank=True,
        null=True,
    )
    available_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    reorder_point = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    suggested_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    supplier = models.CharField(max_length=150, blank=True, default="")
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING, db_index=True)
    business_suitability = models.CharField(max_length=50, default="VERIFIED_INTERNAL")
    data_source_name = models.CharField(max_length=120, blank=True, default="")
    external_product_name = models.CharField(max_length=255, blank=True, default="")
    industry_code = models.CharField(max_length=60, default="retail_supermarket", db_index=True)
    opportunity_type = models.CharField(
        max_length=40,
        choices=OpportunityType.choices,
        default=OpportunityType.REPLENISHMENT,
        db_index=True,
    )

    # Intelligence & AI Purchase Advisor fields
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM, db_index=True)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.85"))
    recommended_action = models.CharField(max_length=20, choices=ActionType.choices, default=ActionType.PURCHASE)
    recommended_purchase_date = models.DateField(null=True, blank=True)
    required_delivery_date = models.DateField(null=True, blank=True)

    # Multi-warehouse optimization
    suggested_transfer_warehouse = models.ForeignKey(
        Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name="outgoing_transfer_suggestions"
    )
    transferable_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))

    # Pricing & Opportunity details
    estimated_unit_price = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    estimated_total_cost = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    currency = models.CharField(max_length=10, default="INR", blank=True)

    # Structured Intelligence & Calculation traceability
    explanation = models.TextField(blank=True, default="")
    reasons = models.JSONField(default=list, blank=True)
    calculation_breakdown = models.JSONField(default=dict, blank=True)
    demand_intelligence = models.JSONField(default=dict, blank=True)
    supplier_intelligence = models.JSONField(default=dict, blank=True)
    market_intelligence = models.JSONField(default=dict, blank=True)
    risk_analysis = models.JSONField(default=dict, blank=True)
    overstock_assessment = models.JSONField(default=dict, blank=True)
    seasonal_assessment = models.JSONField(default=dict, blank=True)

    # 4-Layer Scoring Engine Specific Fields
    internal_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    market_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    event_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    supply_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    final_demand_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"), db_index=True)
    buy_timing_signal = models.CharField(max_length=20, default="Normal") # Buy now, Wait, Normal
    is_dead_stock = models.BooleanField(default=False)
    order_by_date = models.DateField(null=True, blank=True)
    budget_allocated_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    is_budget_throttled = models.BooleanField(default=False)
    suitability_breakdown = models.JSONField(default=dict, blank=True)
    suitability_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("75.00"), db_index=True)
    suitability_status = models.CharField(max_length=60, default="SUITABLE_FOR_PURCHASE")
    market_observation = models.ForeignKey(
        "MarketProductObservation",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="purchase_suggestions",
    )
    business_profile = models.ForeignKey(
        "BusinessProfile",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="purchase_suggestions",
    )

    # Lifecycle & Audit
    purchase_request_id = models.CharField(max_length=100, blank=True, default="", db_index=True)
    lifecycle_history = models.JSONField(default=list, blank=True)
    rejection_reason = models.TextField(blank=True, default="")

    created_by = models.CharField(max_length=120, default="system", blank=True)
    reviewed_by = models.CharField(max_length=120, blank=True, default="")
    approved_by = models.CharField(max_length=120, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_purchase_suggestions"
        ordering = ("-final_demand_score", "-created_at")

    def __str__(self):
        return f"{self.suggestion_number} - {self.product.code} (Score: {self.final_demand_score})"

    def save(self, *args, **kwargs):
        if not self.suggestion_number:
            yr = timezone.now().year
            import uuid
            uid = uuid.uuid4().hex[:6].upper()
            self.suggestion_number = f"SUG-{yr}-{uid}"
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


class SupplierProductProfile(models.Model):
    """Configurable supplier-product matrix with historical performance parameters."""
    supplier_name = models.CharField(max_length=180, db_index=True)
    product = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="supplier_profiles")
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    currency = models.CharField(max_length=10, default="INR")
    lead_time_days = models.IntegerField(default=7)
    minimum_order_qty = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("1.0000"))
    pack_size = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("1.0000"))
    shipping_cost = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    tax_rate_percent = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("18.00"))
    on_time_delivery_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("95.00")) # %
    quality_acceptance_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("99.00")) # %
    payment_terms = models.CharField(max_length=100, default="Net 30", blank=True)
    is_preferred = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_supplier_profiles"
        ordering = ("supplier_name", "product")
        unique_together = ("supplier_name", "product")

    def __str__(self):
        return f"{self.supplier_name} - {self.product.code} @ {self.unit_price} {self.currency}"


class MarketIntelligenceRecord(models.Model):
    """External/Industry intelligence indicators (commodity prices, supply index, material trends)."""
    provider = models.CharField(max_length=120, default="Internal & Market Indices")
    category = models.CharField(max_length=100, db_index=True)
    commodity_or_sku = models.CharField(max_length=100, db_index=True)
    market_region = models.CharField(max_length=100, default="Domestic", blank=True)
    current_index_value = models.DecimalField(max_digits=20, decimal_places=4)
    price_change_pct_30d = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    trend_direction = models.CharField(max_length=20, default="STABLE") # INCREASING, DECREASING, STABLE, VOLATILE
    source_reference = models.CharField(max_length=255, blank=True, default="")
    reliability_score = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.90"))
    data_freshness_date = models.DateField(default=timezone.localdate)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_market_intelligence"
        ordering = ("-data_freshness_date", "-id")

    def __str__(self):
        return f"[{self.category}] {self.commodity_or_sku}: {self.current_index_value} ({self.trend_direction})"


class IndustrySeasonalRule(models.Model):
    """Configurable seasonal cycles to plan ahead for festivals, weather, or cyclical surges."""
    season_name = models.CharField(max_length=100)
    industry_category = models.CharField(max_length=100, blank=True, default="General")
    start_month = models.IntegerField(default=1) # 1-12
    end_month = models.IntegerField(default=12) # 1-12
    lead_time_buffer_days = models.IntegerField(default=14)
    demand_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.25"))
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_seasonal_rules"
        ordering = ("start_month", "season_name")

    def __str__(self):
        return f"{self.season_name} ({self.industry_category}): Multiplier {self.demand_multiplier}x"


class RegionalFestivalEvent(models.Model):
    """Tamil Nadu and Erode specific festive, wedding, and harvest calendar events."""
    event_name = models.CharField(max_length=120, db_index=True)
    region = models.CharField(max_length=60, default="Tamil Nadu")
    location = models.CharField(max_length=60, default="Erode")
    category = models.CharField(max_length=60, db_index=True) # FMCG, Groceries, Sweets, Personal Care, Edible Oils
    start_date = models.DateField()
    end_date = models.DateField()
    demand_rampup_days = models.IntegerField(default=14)
    historical_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("1.50"))
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_regional_events"
        ordering = ("start_date", "event_name")

    def __str__(self):
        return f"{self.event_name} ({self.location}) [{self.start_date}]"


class MonthlyBudgetAllocation(models.Model):
    """Strict capital budget allocation record (e.g. Rs. 5 Lakhs monthly cap)."""
    month_year = models.CharField(max_length=7, unique=True) # YYYY-MM
    total_budget = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("500000.00"))
    allocated_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    remaining_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("500000.00"))
    items_funded = models.IntegerField(default=0)
    items_throttled = models.IntegerField(default=0)
    allocation_strategy = models.CharField(max_length=40, default="ROI_RANKED_GREEDY")
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_budget_allocations"
        ordering = ("-month_year",)

    def __str__(self):
        return f"Budget {self.month_year}: Rs {self.allocated_amount}/{self.total_budget}"


class IndustryProfile(models.Model):
    code = models.CharField(max_length=50, primary_key=True, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    categories = models.JSONField(blank=True, default=list)
    market_signals = models.JSONField(blank=True, default=dict)
    regulatory_rules = models.JSONField(blank=True, default=dict)
    seasonal_calendar_summary = models.JSONField(blank=True, default=dict)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_industry_profiles"
        ordering = ("name",)

    def __str__(self):
        return self.name


class MarketDataProvider(models.Model):
    class Category(models.TextChoices):
        SEARCH = "SEARCH", "Search Trends & Interest"
        MARKETPLACE = "MARKETPLACE", "E-Commerce & Marketplace"
        COMMODITY = "COMMODITY", "Commodity & Raw Materials"
        SUPPLIER = "SUPPLIER", "Authorized Supplier Direct"
        GOVERNMENT_OPEN = "GOVERNMENT_OPEN", "Government Open Data"

    class HealthStatus(models.TextChoices):
        HEALTHY = "HEALTHY", "Healthy / Operational"
        DEGRADED = "DEGRADED", "Degraded / High Latency"
        RATE_LIMITED = "RATE_LIMITED", "Rate Limited"
        ERROR = "ERROR", "Authentication / Connection Error"
        INACTIVE = "INACTIVE", "Inactive / Disabled"

    id = models.CharField(max_length=60, primary_key=True)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=40, choices=Category.choices, default=Category.SEARCH)
    base_url = models.CharField(max_length=255, blank=True, default="")
    auth_type = models.CharField(max_length=40, default="API_KEY")
    rate_limit_per_minute = models.IntegerField(default=60)
    config_schema = models.JSONField(blank=True, default=dict)
    is_active = models.BooleanField(default=True)
    health_status = models.CharField(max_length=30, choices=HealthStatus.choices, default=HealthStatus.HEALTHY)
    last_health_check_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_market_data_providers"
        ordering = ("category", "name")

    def __str__(self):
        return f"{self.name} ({self.category})"


class MarketDataSource(models.Model):
    class ProviderType(models.TextChoices):
        ECOMMERCE = "ECOMMERCE", "E-Commerce Marketplace"
        SEARCH_TRENDS = "SEARCH_TRENDS", "Search Trends & Consumer Interest"
        WHOLESALE_FEED = "WHOLESALE_FEED", "Wholesale & Mandi Price Feed"
        COMMODITY_EXCHANGE = "COMMODITY_EXCHANGE", "Commodity & Raw Material Exchange"
        MACRO_INDEX = "MACRO_INDEX", "Macroeconomic & Industry Index"

    source_id = models.CharField(max_length=60, primary_key=True, unique=True)
    provider = models.ForeignKey(MarketDataProvider, on_delete=models.SET_NULL, null=True, blank=True, related_name="data_sources")
    name = models.CharField(max_length=120)
    provider_type = models.CharField(max_length=40, choices=ProviderType.choices, default=ProviderType.ECOMMERCE)
    base_url = models.CharField(max_length=255, blank=True, default="")
    is_enabled = models.BooleanField(default=True)
    auth_configured = models.BooleanField(default=False)
    credentials_env_var = models.CharField(max_length=100, blank=True, default="")
    last_sync_time = models.DateTimeField(blank=True, null=True)
    last_sync_status = models.CharField(max_length=30, default="IDLE")
    sync_interval_hours = models.IntegerField(default=24)
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_market_data_sources"
        ordering = ("provider_type", "name")

    def __str__(self):
        return self.name


class MarketProductObservation(models.Model):
    class OpportunityClassification(models.TextChoices):
        HIGH_POTENTIAL = "HIGH_POTENTIAL", "High Potential"
        MODERATE_POTENTIAL = "MODERATE_POTENTIAL", "Moderate Potential"
        LOW_POTENTIAL = "LOW_POTENTIAL", "Low Potential"
        INSUFFICIENT_DATA = "INSUFFICIENT_DATA", "Insufficient Data"
        HIGH_RISK = "HIGH_RISK", "High Risk"
        REQUIRES_REVIEW = "REQUIRES_REVIEW", "Requires Review"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    external_id = models.CharField(max_length=120, db_index=True)
    product_name = models.CharField(max_length=255, db_index=True)
    brand = models.CharField(max_length=120, blank=True, default="", db_index=True)
    category = models.CharField(max_length=120, db_index=True)
    product_description = models.TextField(blank=True, default="")
    product_url = models.URLField(max_length=500, blank=True, default="")
    image_url = models.URLField(max_length=500, blank=True, default="")
    listed_retail_price = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    currency = models.CharField(max_length=10, blank=True, default="INR")
    discount_percent = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    marketplace_availability = models.CharField(max_length=40, default="IN_STOCK")
    popularity_indicator = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    search_trend_growth_pct = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    trend_direction = models.CharField(max_length=20, default="STABLE")
    opportunity_classification = models.CharField(
        max_length=30,
        choices=OpportunityClassification.choices,
        default=OpportunityClassification.MODERATE_POTENTIAL,
        db_index=True,
    )
    market_opportunity_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"), db_index=True)
    traceable_evidence = models.JSONField(blank=True, default=dict)
    ai_advisor_summary = models.TextField(blank=True, default="")
    ai_risk_signals = models.JSONField(blank=True, default=list)
    raw_attributes = models.JSONField(blank=True, default=dict)
    observed_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    industry = models.ForeignKey(IndustryProfile, on_delete=models.CASCADE, related_name="observations")
    source = models.ForeignKey(MarketDataSource, on_delete=models.CASCADE, related_name="observations")

    class Meta:
        db_table = "inv_market_product_observations"
        ordering = ("-market_opportunity_score", "-observed_at")
        unique_together = (("source", "external_id"),)

    def __str__(self):
        return f"{self.product_name} ({self.external_id})"


class MarketPriceObservation(models.Model):
    observed_price = models.DecimalField(max_digits=20, decimal_places=4)
    currency = models.CharField(max_length=10, default="INR")
    observed_at = models.DateTimeField(default=timezone.now)
    product_observation = models.ForeignKey(
        MarketProductObservation,
        on_delete=models.CASCADE,
        related_name="price_history",
    )

    class Meta:
        db_table = "inv_market_price_observations"
        ordering = ("-observed_at",)


class ProductMarketMatch(models.Model):
    class MatchType(models.TextChoices):
        EXACT = "EXACT", "Exact Match (SKU / Barcode)"
        PROBABLE = "PROBABLE", "Probable Match (Name & Attributes)"
        UNMATCHED = "UNMATCHED", "Unmatched (New Opportunity)"
        MANUAL_REVIEW = "MANUAL_REVIEW", "Requires Manual Review"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    match_type = models.CharField(max_length=30, choices=MatchType.choices, default=MatchType.UNMATCHED)
    match_confidence = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    matching_criteria = models.JSONField(blank=True, default=dict)
    is_verified = models.BooleanField(default=False)
    verified_by = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="market_matches",
    )
    product_observation = models.ForeignKey(
        MarketProductObservation,
        on_delete=models.CASCADE,
        related_name="item_matches",
    )

    class Meta:
        db_table = "inv_product_market_matches"
        ordering = ("-match_confidence",)


class SupplierMarketOffer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier_name = models.CharField(max_length=180, db_index=True)
    procurement_unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    currency = models.CharField(max_length=10, default="INR")
    shipping_cost = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    applicable_taxes_pct = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("18.00"))
    additional_charges = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    landed_cost_unit = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    minimum_order_qty = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("1.0000"))
    pack_size = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("1.0000"))
    lead_time_days = models.IntegerField(default=7)
    supplier_location = models.CharField(max_length=120, blank=True, default="")
    on_time_reliability_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("90.00"))
    verified_offer = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    product_observation = models.ForeignKey(
        MarketProductObservation,
        on_delete=models.CASCADE,
        related_name="supplier_offers",
    )

    class Meta:
        db_table = "inv_supplier_market_offers"
        ordering = ("landed_cost_unit", "-on_time_reliability_pct")


class BusinessProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business_name = models.CharField(max_length=150, default="Erode Retail & FMCG Mart")
    business_type = models.CharField(max_length=60, default="Retailer & Wholesaler")
    primary_industry_code = models.CharField(max_length=60, default="retail_supermarket")
    business_location = models.CharField(max_length=120, default="Erode, Tamil Nadu, India")
    target_customer_segment = models.CharField(max_length=120, default="B2C Households & Local Kirana Stores")
    target_market_region = models.CharField(max_length=120, default="Tamil Nadu & South India")
    preferred_categories = models.JSONField(blank=True, default=list)
    procurement_budget = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("500000.00"))
    min_expected_gross_margin_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("20.00"))
    preferred_supplier_locations = models.JSONField(blank=True, default=list)
    sourcing_preference = models.CharField(max_length=40, default="DOMESTIC_ONLY")
    min_supplier_quality_rating = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("85.00"))
    min_procurement_qty = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("10.00"))
    max_procurement_qty = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("5000.00"))
    restricted_categories = models.JSONField(blank=True, default=list)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    primary_industry = models.ForeignKey(
        IndustryProfile,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="business_profiles",
    )

    class Meta:
        db_table = "inv_business_profiles"
        ordering = ("-is_active", "business_name")

    def __str__(self):
        return self.business_name



# ============================================================================
# PHASE 2 MODELS: UNIVERSAL INTELLIGENT PURCHASE RECOMMENDATION SYSTEM
# ============================================================================

from apps.products.models import InventoryItemVariant


class ReplenishmentPolicy(models.Model):
    """
    Configurable replenishment strategy policy for items, variants, or categories.
    Supports Min-Max, Continuous Review (ROP), Periodic Review, and Just-In-Time.
    """
    class Strategy(models.TextChoices):
        MIN_MAX = "MIN_MAX", "Min-Max Level Policy"
        REORDER_POINT = "REORDER_POINT", "Continuous Review (ROP + Safety Stock)"
        PERIODIC_REVIEW = "PERIODIC_REVIEW", "Periodic Order Up-To Level"
        DEMAND_DRIVEN = "DEMAND_DRIVEN", "Demand-Driven MRP / Forecast Cover"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    strategy = models.CharField(max_length=40, choices=Strategy.choices, default=Strategy.REORDER_POINT)
    
    # Scope
    product = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, null=True, blank=True, related_name="replenishment_policies")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.CASCADE, null=True, blank=True, related_name="replenishment_policies")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, null=True, blank=True, related_name="replenishment_policies")
    category_code = models.CharField(max_length=100, blank=True, default="")
    
    # Parameters
    min_stock_level = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("10.0000"))
    max_stock_level = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("100.0000"))
    safety_stock_days = models.IntegerField(default=7)
    target_cover_days = models.IntegerField(default=30)
    lead_time_days = models.IntegerField(default=5)
    review_period_days = models.IntegerField(default=7)
    service_level_target_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("95.00"))
    
    # Constraints
    min_order_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("1.0000"))
    order_multiple_pack_size = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("1.0000"))
    max_order_quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    
    # Tenant / Context Isolation
    tenant_id = models.CharField(max_length=100, blank=True, default="default", db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_replenishment_policies"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.name} ({self.strategy})"


class RecommendationConfiguration(models.Model):
    """
    Global and tenant-level configurations for the recommendation engine.
    Controls evaluation frequencies, automated triggers, default lead times, and thresholds.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.CharField(max_length=100, default="default", unique=True, db_index=True)
    company_id = models.CharField(max_length=100, blank=True, default="")
    
    # Engine Settings
    auto_generate_daily = models.BooleanField(default=True)
    default_lead_time_buffer_days = models.IntegerField(default=2)
    default_review_horizon_days = models.IntegerField(default=30)
    inter_warehouse_transfer_preferred = models.BooleanField(default=True)
    transfer_cost_threshold_ratio = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.80"))
    
    # Thresholds
    high_priority_stockout_days = models.IntegerField(default=5)
    medium_priority_stockout_days = models.IntegerField(default=12)
    dead_stock_threshold_days = models.IntegerField(default=90)
    overstock_cover_threshold_days = models.IntegerField(default=120)
    
    # Weights for unified scoring
    weight_internal_demand = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.40"))
    weight_market_trends = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.20"))
    weight_seasonal_events = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.25"))
    weight_supply_cost = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.15"))
    
    # Phase 4: Supplier Multi-Criteria Scoring Weights & Thresholds
    supplier_weight_price = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.35"))
    supplier_weight_quality = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.25"))
    supplier_weight_delivery = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.25"))
    supplier_weight_lead_time = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.15"))
    supplier_min_quality_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("80.00"))
    supplier_min_delivery_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("80.00"))
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_recommendation_configurations"

    def __str__(self):
        return f"RecommendationConfig ({self.tenant_id})"


class PurchaseRecommendation(models.Model):
    """
    Header entity for purchase recommendations generated by the intelligence engine.
    Supports single or multi-line grouping, audit workflow, and procurement integration.
    """
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft / Generated"
        UNDER_REVIEW = "UNDER_REVIEW", "Under Human Review"
        APPROVED = "APPROVED", "Approved for Purchasing"
        REJECTED = "REJECTED", "Rejected by Reviewer"
        DEFERRED = "DEFERRED", "Deferred for Later Evaluation"
        CONVERTED = "CONVERTED", "Converted to Purchase Requisition"
        EXPIRED = "EXPIRED", "Expired / Superseded"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low (Routine Stock Maintenance)"
        MEDIUM = "MEDIUM", "Medium (Normal Reorder Trigger)"
        HIGH = "HIGH", "High (Imminent Stockout Risk)"
        CRITICAL = "CRITICAL", "Critical (Stockout / Emergency)"

    recommendation_number = models.CharField(max_length=80, unique=True, db_index=True)
    title = models.CharField(max_length=255, blank=True, default="Automated Purchase Replenishment Recommendation")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="recommendation_headers")
    
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT, db_index=True)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM, db_index=True)
    
    total_estimated_outlay = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    total_items_count = models.IntegerField(default=1)
    currency = models.CharField(max_length=10, default="INR")
    
    recommended_order_date = models.DateField(default=timezone.localdate)
    required_by_date = models.DateField(null=True, blank=True)
    
    overall_confidence_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.85"))
    ai_executive_summary = models.TextField(blank=True, default="")
    
    # Audit & Workflow
    created_by = models.CharField(max_length=100, default="system")
    reviewed_by = models.CharField(max_length=100, blank=True, default="")
    approved_by = models.CharField(max_length=100, blank=True, default="")
    rejected_by = models.CharField(max_length=100, blank=True, default="")
    rejection_reason = models.TextField(blank=True, default="")
    purchase_request_reference = models.CharField(max_length=100, blank=True, default="", db_index=True)
    
    tenant_id = models.CharField(max_length=100, default="default", db_index=True)
    company_id = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_purchase_recommendations"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.recommendation_number} - {self.warehouse.name} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.recommendation_number:
            yr = timezone.now().year
            rand = uuid.uuid4().hex[:6].upper()
            self.recommendation_number = f"REC-{yr}-{rand}"
        super().save(*args, **kwargs)


class PurchaseRecommendationItem(models.Model):
    """
    Detailed line item recommendation with full transparent mathematical breakdown.
    Includes on-hand stock, reserved stock, incoming stock, net inventory position,
    suggested quantities, supplier evaluation, and explanations.
    """
    class Action(models.TextChoices):
        PURCHASE = "PURCHASE", "External Purchase Order"
        TRANSFER = "TRANSFER", "Inter-Warehouse Transfer"
        REVIEW = "REVIEW", "Manual Inventory Review"
        HOLD = "HOLD", "Hold Purchasing / Overstock Risk"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recommendation = models.ForeignKey(PurchaseRecommendation, on_delete=models.CASCADE, related_name="items")
    
    product = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="recommendation_items", null=True, blank=True)
    external_market_product = models.ForeignKey("ExternalMarketProduct", on_delete=models.SET_NULL, null=True, blank=True, related_name="recommendation_items")
    product_name_display = models.CharField(max_length=255, blank=True, default="")
    recommendation_category = models.CharField(
        max_length=50,
        choices=[
            ("REPLENISH_EXISTING", "1. Replenish Existing Products"),
            ("INCREASE_PURCHASE_QTY", "2. Increase Purchase Quantity"),
            ("INTRODUCE_NEW_PRODUCT", "3. Introduce New Products"),
            ("EXPLORE_TRENDING_PRODUCT", "4. Explore Trending Products"),
            ("SEASONAL_PURCHASE_OPPORTUNITY", "5. Seasonal Purchase Opportunities"),
            ("MARKET_PRICE_OPPORTUNITY", "6. Market Price Opportunities"),
            ("SUPPLIER_ALTERNATIVE", "7. Supplier Alternatives"),
            ("AVOID_OR_DELAY_PURCHASE", "8. Avoid or Delay Purchasing"),
            ("EXCESS_STOCK_REDUCTION", "9. Excess Stock Reduction Opportunities"),
            ("INSUFFICIENT_DATA", "10. Insufficient Data / Needs Review"),
        ],
        default="REPLENISH_EXISTING",
        db_index=True,
    )
    business_fit_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    market_opportunity_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    stockout_risk_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    movement_classification = models.CharField(max_length=40, default="REGULAR")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.SET_NULL, null=True, blank=True, related_name="recommendation_items")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="recommendation_items")
    
    # Inventory Snapshot (Never fabricated; real mathematical metrics)
    current_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    available_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    reserved_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    incoming_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    blocked_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    inventory_position = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    
    # Replenishment Targets
    reorder_point = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    safety_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    target_stock_level = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    average_daily_demand = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    lead_time_days = models.IntegerField(default=5)
    days_of_supply_remaining = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    
    # Recommendations
    suggested_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    user_modified_quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    unit_of_measure = models.CharField(max_length=50, blank=True, default="Units")
    
    recommended_action = models.CharField(max_length=20, choices=Action.choices, default=Action.PURCHASE)
    suggested_transfer_warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name="outbound_recommendation_transfers")
    
    # Financials & Supplier
    preferred_supplier = models.CharField(max_length=180, blank=True, default="")
    estimated_unit_price = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    estimated_total_cost = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    
    # Decision Transparency & Reasoning
    priority = models.CharField(max_length=20, choices=PurchaseRecommendation.Priority.choices, default=PurchaseRecommendation.Priority.MEDIUM)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.85"))
    recommendation_reasons = models.JSONField(blank=True, default=list)
    calculation_breakdown = models.JSONField(blank=True, default=dict)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_purchase_recommendation_items"
        ordering = ("-priority", "product__name")

    def __str__(self):
        return f"{self.product.code} - Suggested: {self.suggested_quantity}"


class RecommendationHistory(models.Model):
    """
    Immutable audit trail tracking all lifecycle transitions, status changes,
    quantity adjustments, and purchase document dispatch events.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recommendation = models.ForeignKey(PurchaseRecommendation, on_delete=models.CASCADE, related_name="history_logs")
    recommendation_item = models.ForeignKey(PurchaseRecommendationItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="history_logs")
    
    action_type = models.CharField(max_length=60, db_index=True)
    from_status = models.CharField(max_length=40, blank=True, default="")
    to_status = models.CharField(max_length=40, blank=True, default="")
    
    actor = models.CharField(max_length=120, default="system")
    details = models.TextField(blank=True, default="")
    metadata = models.JSONField(blank=True, default=dict)
    
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "inv_recommendation_history"
        ordering = ("-timestamp",)

    def __str__(self):
        return f"[{self.timestamp}] {self.recommendation.recommendation_number} - {self.action_type} by {self.actor}"


class RecommendationFeedback(models.Model):
    """
    Feedback loop capturing manager overrides, quantity modifications, rejections,
    and post-procurement accuracy to auto-tune forecasting and replenishment policies.
    """
    class FeedbackType(models.TextChoices):
        QUANTITY_INCREASED = "QUANTITY_INCREASED", "Quantity Increased by Manager"
        QUANTITY_DECREASED = "QUANTITY_DECREASED", "Quantity Decreased by Manager"
        REJECTED_OVERSTOCK = "REJECTED_OVERSTOCK", "Rejected: Overstock / Too Much Stock"
        REJECTED_SUPPLIER = "REJECTED_SUPPLIER", "Rejected: Unreliable Supplier"
        REJECTED_BUDGET = "REJECTED_BUDGET", "Rejected: Budgetary Constraints"
        REJECTED_OBSOLETE = "REJECTED_OBSOLETE", "Rejected: Obsolete / Phase-Out SKU"
        DEFERRED_EVALUATION = "DEFERRED_EVALUATION", "Deferred for Review Next Cycle"
        APPROVED_AS_IS = "APPROVED_AS_IS", "Approved Exactly as Recommended"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recommendation = models.ForeignKey(PurchaseRecommendation, on_delete=models.CASCADE, related_name="feedbacks")
    recommendation_item = models.ForeignKey(PurchaseRecommendationItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="feedbacks")
    
    feedback_type = models.CharField(max_length=60, choices=FeedbackType.choices, db_index=True)
    original_quantity = models.DecimalField(max_digits=20, decimal_places=4)
    modified_quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    
    manager_notes = models.TextField(blank=True, default="")
    user_actor = models.CharField(max_length=120, default="procurement_officer")
    
    # Model self-learning flags
    applied_to_tuning = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_recommendation_feedbacks"
        ordering = ("-created_at",)

    def __str__(self):
        return f"Feedback: {self.feedback_type} by {self.user_actor}"


class ExternalMarketProduct(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    global_sku = models.CharField(max_length=120, unique=True, db_index=True)
    title = models.CharField(max_length=255, db_index=True)
    brand = models.CharField(max_length=120, blank=True, default="", db_index=True)
    industry_segment = models.CharField(max_length=60, db_index=True)
    primary_category = models.CharField(max_length=120, db_index=True)
    description = models.TextField(blank=True, default="")
    image_url = models.URLField(max_length=500, blank=True, default="")
    source_url = models.URLField(max_length=500, blank=True, default="")
    currency = models.CharField(max_length=10, default="INR")
    min_market_price = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    max_market_price = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    avg_market_price = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    search_interest_index = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    market_velocity_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    market_opportunity_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"), db_index=True)
    first_seen_at = models.DateTimeField(default=timezone.now)
    last_observed_at = models.DateTimeField(default=timezone.now, db_index=True)
    raw_data = models.JSONField(blank=True, default=dict)

    class Meta:
        db_table = "inv_external_market_products"
        ordering = ("-market_opportunity_score", "-last_observed_at")

    def __str__(self):
        return f"{self.title} ({self.global_sku})"


class MarketTrend(models.Model):
    class TrendDirection(models.TextChoices):
        RISING = "RISING", "Rising / Surging Demand"
        STABLE = "STABLE", "Stable / Flat"
        DECLINING = "DECLINING", "Declining Demand"
        VOLATILE = "VOLATILE", "High Volatility"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    keyword_or_category = models.CharField(max_length=150, db_index=True)
    industry_segment = models.CharField(max_length=60, db_index=True)
    region_code = models.CharField(max_length=20, default="IN")
    period_start = models.DateField()
    period_end = models.DateField()
    search_volume_index = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("50.00"))
    velocity_pct_change = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    trend_direction = models.CharField(max_length=20, choices=TrendDirection.choices, default=TrendDirection.STABLE)
    is_seasonal_spike = models.BooleanField(default=False)
    source_attribution = models.CharField(max_length=100, default="Google Trends")
    recorded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "inv_market_trends"
        ordering = ("-recorded_at", "-search_volume_index")

    def __str__(self):
        return f"{self.keyword_or_category} ({self.trend_direction})"


class BusinessFitAnalysis(models.Model):
    class Verdict(models.TextChoices):
        EXCELLENT_FIT = "EXCELLENT_FIT", "Excellent Fit (>80)"
        GOOD_FIT = "GOOD_FIT", "Good Fit (65-80)"
        MODERATE_FIT = "MODERATE_FIT", "Moderate Fit (50-65)"
        POOR_FIT = "POOR_FIT", "Poor Fit (<50)"
        UNKNOWN = "UNKNOWN", "Insufficient Information"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.CharField(max_length=100, default="default", db_index=True)
    external_product = models.ForeignKey(ExternalMarketProduct, on_delete=models.CASCADE, related_name="fit_analyses")
    industry_fit_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    category_fit_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    margin_potential_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    supplier_feasibility_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    overall_fit_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"), db_index=True)
    verdict = models.CharField(max_length=20, choices=Verdict.choices, default=Verdict.MODERATE_FIT)
    risk_factors = models.JSONField(blank=True, default=list)
    explanation = models.TextField(blank=True, default="")
    evaluated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "inv_business_fit_analyses"
        ordering = ("-overall_fit_score",)

    def __str__(self):
        return f"{self.external_product.title} - {self.verdict} ({self.overall_fit_score})"


class InternalAnalysisResult(models.Model):
    class MovementClassification(models.TextChoices):
        FAST_MOVING = "FAST_MOVING", "Fast Moving"
        REGULAR = "REGULAR", "Regular Movement"
        SLOW_MOVING = "SLOW_MOVING", "Slow Moving (<3 turns/yr)"
        DEAD_STOCK = "DEAD_STOCK", "Dead Stock (>90 days zero issue)"
        EXCESS_STOCK = "EXCESS_STOCK", "Excess Stock (>120 days cover)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.CharField(max_length=100, default="default", db_index=True)
    product = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="internal_analyses")
    variant = models.ForeignKey(InventoryItemVariant, on_delete=models.SET_NULL, null=True, blank=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="internal_analyses")

    current_on_hand = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    current_reserved = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    current_available = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    current_blocked = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    incoming_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    outgoing_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    net_position = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    daily_run_rate = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    forecast_30d_demand = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    forecast_90d_demand = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    days_of_supply = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    reorder_point = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    safety_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    target_stock = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    stockout_risk_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    days_to_stockout = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    movement_classification = models.CharField(
        max_length=30, choices=MovementClassification.choices, default=MovementClassification.REGULAR, db_index=True
    )
    is_replenishment_needed = models.BooleanField(default=False, db_index=True)
    suggested_replenishment_qty = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    estimated_purchase_cost = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    preferred_supplier = models.CharField(max_length=180, blank=True, default="")
    supplier_lead_time_days = models.IntegerField(default=7)
    explanation = models.TextField(blank=True, default="")
    calculation_details = models.JSONField(blank=True, default=dict)
    calculated_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "inv_internal_analysis_results"
        ordering = ("-stockout_risk_score", "-is_replenishment_needed")

    def __str__(self):
        return f"{self.product.code} @ {self.warehouse.code} - Replenish: {self.is_replenishment_needed}"


class MarketDataCollectionLog(models.Model):
    class Status(models.TextChoices):
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"
        PARTIAL = "PARTIAL", "Partial / Some Records Skipped"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.ForeignKey(MarketDataProvider, on_delete=models.CASCADE, null=True, blank=True, related_name="collection_logs")
    source_name = models.CharField(max_length=120)
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUCCESS)
    records_ingested = models.IntegerField(default=0)
    records_updated = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, default="")
    metadata = models.JSONField(blank=True, default=dict)

    class Meta:
        db_table = "inv_market_collection_logs"
        ordering = ("-started_at",)

    def __str__(self):
        return f"{self.source_name} - {self.status} ({self.records_ingested} records)"


class ExternalProductListing(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    external_product = models.ForeignKey(ExternalMarketProduct, on_delete=models.CASCADE, related_name="listings")
    provider = models.ForeignKey(MarketDataProvider, on_delete=models.SET_NULL, null=True, blank=True, related_name="listings")
    seller_name = models.CharField(max_length=180, blank=True, default="")
    listing_url = models.URLField(max_length=500, blank=True, default="")
    external_item_id = models.CharField(max_length=120, blank=True, default="")
    current_price = models.DecimalField(max_digits=20, decimal_places=4, default=Decimal("0.0000"))
    currency = models.CharField(max_length=10, default="INR")
    availability_status = models.CharField(max_length=40, default="IN_STOCK")
    rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    review_count = models.IntegerField(default=0)
    observed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "inv_external_product_listings"
        ordering = ("-observed_at",)

    def __str__(self):
        return f"{self.external_product.title} - {self.seller_name} ({self.current_price})"


class MarketDemandSignal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    external_product = models.ForeignKey(ExternalMarketProduct, on_delete=models.CASCADE, related_name="demand_signals")
    signal_source = models.CharField(max_length=100)
    signal_strength = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    confidence_level = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.85"))
    evidence_notes = models.TextField(blank=True, default="")
    recorded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "inv_market_demand_signals"
        ordering = ("-recorded_at",)

    def __str__(self):
        return f"{self.signal_source} ({self.signal_strength})"


class MarketOpportunity(models.Model):
    class OpportunityType(models.TextChoices):
        TRENDING = "TRENDING", "Trending Product"
        NEW_PRODUCT = "NEW_PRODUCT", "New Product Opportunity"
        PRICE_DIP = "PRICE_DIP", "Market Price Arbitrage"
        SEASONAL = "SEASONAL", "Seasonal Spike Opportunity"
        SUPPLY_SHORTAGE = "SUPPLY_SHORTAGE", "External Supply Shortage"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open / Actionable"
        UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
        CONVERTED = "CONVERTED", "Added to Catalog / Procured"
        DISMISSED = "DISMISSED", "Dismissed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.CharField(max_length=100, default="default", db_index=True)
    external_product = models.ForeignKey(ExternalMarketProduct, on_delete=models.CASCADE, related_name="opportunities")
    opportunity_type = models.CharField(max_length=30, choices=OpportunityType.choices, default=OpportunityType.TRENDING)
    opportunity_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"), db_index=True)
    business_fit_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50.00"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    reasoning = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_market_opportunities"
        ordering = ("-opportunity_score", "-created_at")

    def __str__(self):
        return f"{self.opportunity_type} - {self.external_product.title} ({self.opportunity_score})"


class ProductDiscoveryResult(models.Model):
    class MatchStatus(models.TextChoices):
        NEW_OPPORTUNITY = "NEW_OPPORTUNITY", "New Product Opportunity"
        EXISTING_CATALOG_MATCH = "EXISTING_CATALOG_MATCH", "Matched to Existing Catalog SKU"
        UNSUITABLE = "UNSUITABLE", "Unsuitable for Business Profile"
        REVIEW_REQUIRED = "REVIEW_REQUIRED", "Review Required"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.CharField(max_length=100, default="default", db_index=True)
    external_product = models.ForeignKey(ExternalMarketProduct, on_delete=models.CASCADE, related_name="discovery_results")
    industry_profile = models.ForeignKey(IndustryProfile, on_delete=models.CASCADE, related_name="discovery_results")
    matched_internal_item = models.ForeignKey(InventoryItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="discovered_matches")
    match_status = models.CharField(max_length=30, choices=MatchStatus.choices, default=MatchStatus.NEW_OPPORTUNITY)
    match_confidence = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.00"))
    discovery_reason = models.TextField(blank=True, default="")
    discovered_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "inv_product_discovery_results"
        ordering = ("-discovered_at",)

    def __str__(self):
        return f"{self.match_status} - {self.external_product.title}"


class RecommendationApproval(models.Model):
    class Action(models.TextChoices):
        APPROVED = "APPROVED", "Approved for Purchase"
        REJECTED = "REJECTED", "Rejected by Approver"
        MODIFIED = "MODIFIED", "Approved with Quantity Adjustments"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recommendation = models.ForeignKey(PurchaseRecommendation, on_delete=models.CASCADE, related_name="approvals")
    action = models.CharField(max_length=20, choices=Action.choices)
    approver_user_id = models.CharField(max_length=120, default="manager")
    approver_name = models.CharField(max_length=150, default="Inventory Manager")
    decision_notes = models.TextField(blank=True, default="")
    purchase_request_id = models.CharField(max_length=100, blank=True, default="")
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "inv_recommendation_approvals"
        ordering = ("-timestamp",)

    def __str__(self):
        return f"{self.recommendation.recommendation_number} - {self.action} by {self.approver_name}"


class RecommendationEvidence(models.Model):
    class EvidenceType(models.TextChoices):
        INTERNAL_SALES = "INTERNAL_SALES", "Internal Sales & Movement History"
        INVENTORY_COVER = "INVENTORY_COVER", "Stock Coverage & Run Rate"
        SEARCH_TREND = "SEARCH_TREND", "Consumer Search Trend / Velocity"
        MARKET_PRICE = "MARKET_PRICE", "Marketplace Price Spread"
        SUPPLIER_PERFORMANCE = "SUPPLIER_PERFORMANCE", "Supplier Lead Time & Reliability"
        SEASONAL_CYCLE = "SEASONAL_CYCLE", "Seasonal / Festival Cycle"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recommendation_item = models.ForeignKey(PurchaseRecommendationItem, on_delete=models.CASCADE, related_name="evidences")
    evidence_type = models.CharField(max_length=30, choices=EvidenceType.choices)
    metric_name = models.CharField(max_length=120)
    measured_value = models.CharField(max_length=120)
    source_attribution = models.CharField(max_length=150, default="Internal Stock Ledger")
    is_measured_fact = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_recommendation_evidences"
        ordering = ("-is_measured_fact", "evidence_type")

    def __str__(self):
        return f"[{self.evidence_type}] {self.metric_name}: {self.measured_value}"


class MarketPriceHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    external_product = models.ForeignKey(ExternalMarketProduct, on_delete=models.CASCADE, related_name="price_history_records")
    price_date = models.DateField(default=timezone.localdate, db_index=True)
    low_price = models.DecimalField(max_digits=20, decimal_places=4)
    high_price = models.DecimalField(max_digits=20, decimal_places=4)
    average_price = models.DecimalField(max_digits=20, decimal_places=4)
    sample_size = models.IntegerField(default=1)

    class Meta:
        db_table = "inv_market_price_history"
        ordering = ("-price_date",)
        unique_together = ("external_product", "price_date")

    def __str__(self):
        return f"{self.external_product.title} @ {self.price_date}: Avg {self.average_price}"


class ProductCategoryMapping(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    internal_category = models.ForeignKey(InventoryCategory, on_delete=models.CASCADE, related_name="market_mappings")
    external_category_name = models.CharField(max_length=150, db_index=True)
    industry_code = models.CharField(max_length=60, db_index=True)
    confidence_score = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("1.00"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_category_mappings"
        unique_together = ("internal_category", "external_category_name", "industry_code")

    def __str__(self):
        return f"{self.external_category_name} -> {self.internal_category.name}"


class AnalysisExecutionHistory(models.Model):
    class ExecutionType(models.TextChoices):
        INTERNAL_SCAN = "INTERNAL_SCAN", "Internal Stock & Demand Scan"
        EXTERNAL_SCAN = "EXTERNAL_SCAN", "External Market Discovery Scan"
        UNIFIED_RECOMMENDATION = "UNIFIED_RECOMMENDATION", "Unified Recommendation Engine Run"

    class Status(models.TextChoices):
        RUNNING = "RUNNING", "Running"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.CharField(max_length=100, default="default", db_index=True)
    execution_type = models.CharField(max_length=30, choices=ExecutionType.choices)
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(blank=True, null=True)
    triggered_by = models.CharField(max_length=120, default="system")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RUNNING)
    summary_metrics = models.JSONField(blank=True, default=dict)
    error_log = models.TextField(blank=True, default="")

    class Meta:
        db_table = "inv_analysis_execution_history"
        ordering = ("-started_at",)

    def __str__(self):
        return f"[{self.execution_type}] {self.status} @ {self.started_at}"
