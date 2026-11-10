from decimal import Decimal
from rest_framework import serializers

from apps.planning.models import (
    PurchaseRecommendation,
    PurchaseRecommendationItem,
    ReplenishmentPolicy,
    RecommendationConfiguration,
    RecommendationHistory,
    RecommendationFeedback,
    SupplierProductProfile,
    IndustryProfile,
    MarketDataProvider,
    MarketDataSource,
    MarketTrend,
    ExternalMarketProduct,
    MarketOpportunity,
    AnalysisExecutionHistory,
    RecommendationApproval,
    RecommendationEvidence,
    InternalAnalysisResult,
)
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse


class InventoryItemSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = ["id", "code", "name", "category", "standard_cost", "min_order_qty", "lead_time_days"]


class WarehouseSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ["id", "code", "name"]


class RecommendationHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RecommendationHistory
        fields = ["id", "action_type", "from_status", "to_status", "actor", "details", "metadata", "timestamp"]


class RecommendationFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecommendationFeedback
        fields = [
            "id",
            "feedback_type",
            "original_quantity",
            "modified_quantity",
            "manager_notes",
            "user_actor",
            "applied_to_tuning",
            "created_at",
        ]


class PurchaseRecommendationItemSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source="product.code", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    transfer_warehouse_name = serializers.CharField(source="suggested_transfer_warehouse.name", read_only=True, allow_null=True)

    class Meta:
        model = PurchaseRecommendationItem
        fields = [
            "id",
            "product",
            "product_code",
            "product_name",
            "product_name_display",
            "variant",
            "warehouse",
            "warehouse_name",
            "current_stock",
            "available_stock",
            "reserved_stock",
            "incoming_stock",
            "blocked_stock",
            "inventory_position",
            "reorder_point",
            "safety_stock",
            "target_stock_level",
            "average_daily_demand",
            "lead_time_days",
            "days_of_supply_remaining",
            "suggested_quantity",
            "user_modified_quantity",
            "unit_of_measure",
            "recommended_action",
            "suggested_transfer_warehouse",
            "transfer_warehouse_name",
            "preferred_supplier",
            "estimated_unit_price",
            "estimated_total_cost",
            "priority",
            "recommendation_category",
            "business_fit_score",
            "market_opportunity_score",
            "stockout_risk_score",
            "movement_classification",
            "external_market_product",
            "confidence_score",
            "recommendation_reasons",
            "calculation_breakdown",
            "created_at",
            "updated_at",
        ]


class PurchaseRecommendationSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    items = PurchaseRecommendationItemSerializer(many=True, read_only=True)
    history_logs = RecommendationHistorySerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseRecommendation
        fields = [
            "id",
            "recommendation_number",
            "title",
            "warehouse",
            "warehouse_code",
            "warehouse_name",
            "status",
            "priority",
            "total_estimated_outlay",
            "total_items_count",
            "currency",
            "recommended_order_date",
            "required_by_date",
            "overall_confidence_score",
            "ai_executive_summary",
            "created_by",
            "reviewed_by",
            "approved_by",
            "rejected_by",
            "rejection_reason",
            "purchase_request_reference",
            "tenant_id",
            "created_at",
            "updated_at",
            "items",
            "history_logs",
        ]


class ReplenishmentPolicySerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source="product.code", read_only=True, allow_null=True)
    product_name = serializers.CharField(source="product.name", read_only=True, allow_null=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True, allow_null=True)

    class Meta:
        model = ReplenishmentPolicy
        fields = [
            "id",
            "name",
            "strategy",
            "product",
            "product_code",
            "product_name",
            "variant",
            "warehouse",
            "warehouse_name",
            "category_code",
            "min_stock_level",
            "max_stock_level",
            "safety_stock_days",
            "target_cover_days",
            "lead_time_days",
            "review_period_days",
            "service_level_target_pct",
            "min_order_quantity",
            "order_multiple_pack_size",
            "max_order_quantity",
            "is_active",
            "created_at",
            "updated_at",
        ]


class RecommendationConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecommendationConfiguration
        fields = [
            "id",
            "tenant_id",
            "company_id",
            "auto_generate_daily",
            "default_lead_time_buffer_days",
            "default_review_horizon_days",
            "inter_warehouse_transfer_preferred",
            "transfer_cost_threshold_ratio",
            "high_priority_stockout_days",
            "medium_priority_stockout_days",
            "dead_stock_threshold_days",
            "overstock_cover_threshold_days",
            "weight_internal_demand",
            "weight_market_trends",
            "weight_seasonal_events",
            "weight_supply_cost",
            "supplier_weight_price",
            "supplier_weight_quality",
            "supplier_weight_delivery",
            "supplier_weight_lead_time",
            "supplier_min_quality_score",
            "supplier_min_delivery_rate",
            "is_active",
            "updated_at",
        ]


class SupplierProductProfileSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source="product.code", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = SupplierProductProfile
        fields = [
            "id",
            "supplier_name",
            "product",
            "product_code",
            "product_name",
            "unit_price",
            "currency",
            "lead_time_days",
            "minimum_order_qty",
            "pack_size",
            "shipping_cost",
            "tax_rate_percent",
            "on_time_delivery_rate",
            "quality_acceptance_rate",
            "payment_terms",
            "is_preferred",
            "is_active",
            "created_at",
            "updated_at",
        ]


class IndustryProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = IndustryProfile
        fields = [
            "code",
            "name",
            "description",
            "categories",
            "market_signals",
            "regulatory_rules",
            "seasonal_calendar_summary",
            "is_active",
            "created_at",
            "updated_at",
        ]


class MarketDataProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketDataProvider
        fields = [
            "id",
            "name",
            "category",
            "base_url",
            "auth_type",
            "rate_limit_per_minute",
            "config_schema",
            "is_active",
            "health_status",
            "last_health_check_at",
            "created_at",
            "updated_at",
        ]


class MarketDataSourceSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source="provider.name", read_only=True, allow_null=True)

    class Meta:
        model = MarketDataSource
        fields = [
            "source_id",
            "provider",
            "provider_name",
            "name",
            "provider_type",
            "base_url",
            "is_enabled",
            "auth_configured",
            "credentials_env_var",
            "last_sync_time",
            "last_sync_status",
            "sync_interval_hours",
            "error_message",
            "created_at",
            "updated_at",
        ]


class MarketTrendSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketTrend
        fields = [
            "id",
            "keyword_or_category",
            "industry_segment",
            "region_code",
            "period_start",
            "period_end",
            "search_volume_index",
            "velocity_pct_change",
            "trend_direction",
            "is_seasonal_spike",
            "source_attribution",
            "recorded_at",
        ]


class ExternalMarketProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalMarketProduct
        fields = [
            "id",
            "global_sku",
            "title",
            "brand",
            "industry_segment",
            "primary_category",
            "description",
            "image_url",
            "source_url",
            "currency",
            "min_market_price",
            "max_market_price",
            "avg_market_price",
            "search_interest_index",
            "market_velocity_score",
            "market_opportunity_score",
            "first_seen_at",
            "last_observed_at",
            "raw_data",
        ]


class MarketOpportunitySerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source="external_product.title", read_only=True)
    product_sku = serializers.CharField(source="external_product.global_sku", read_only=True)

    class Meta:
        model = MarketOpportunity
        fields = [
            "id",
            "tenant_id",
            "external_product",
            "product_title",
            "product_sku",
            "opportunity_type",
            "opportunity_score",
            "business_fit_score",
            "status",
            "reasoning",
            "created_at",
            "updated_at",
        ]


class AnalysisExecutionHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisExecutionHistory
        fields = [
            "id",
            "tenant_id",
            "execution_type",
            "started_at",
            "completed_at",
            "triggered_by",
            "status",
            "summary_metrics",
            "error_log",
        ]


class RecommendationApprovalSerializer(serializers.ModelSerializer):
    recommendation_number = serializers.CharField(source="recommendation.recommendation_number", read_only=True)

    class Meta:
        model = RecommendationApproval
        fields = [
            "id",
            "recommendation",
            "recommendation_number",
            "action",
            "approver_user_id",
            "approver_name",
            "decision_notes",
            "purchase_request_id",
            "timestamp",
        ]


class RecommendationEvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecommendationEvidence
        fields = [
            "id",
            "recommendation_item",
            "evidence_type",
            "metric_name",
            "measured_value",
            "source_attribution",
            "is_measured_fact",
            "notes",
            "created_at",
        ]


class InternalAnalysisResultSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source="product.code", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = InternalAnalysisResult
        fields = [
            "id",
            "tenant_id",
            "product",
            "product_code",
            "product_name",
            "variant",
            "warehouse",
            "warehouse_name",
            "current_on_hand",
            "current_reserved",
            "current_available",
            "current_blocked",
            "incoming_stock",
            "outgoing_stock",
            "net_position",
            "daily_run_rate",
            "forecast_30d_demand",
            "forecast_90d_demand",
            "days_of_supply",
            "reorder_point",
            "safety_stock",
            "target_stock",
            "stockout_risk_score",
            "days_to_stockout",
            "movement_classification",
            "is_replenishment_needed",
            "suggested_replenishment_qty",
            "estimated_purchase_cost",
            "preferred_supplier",
            "supplier_lead_time_days",
            "explanation",
            "calculation_details",
            "calculated_at",
        ]
