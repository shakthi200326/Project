"""
Market Intelligence & Seasonal Purchase Planning Services.
Integrates external commodity data, material trends, industry calendars, and seasonal multipliers.
Never fabricates data: clearly reports when external feeds are unavailable or fresh.
"""
from decimal import Decimal
from typing import Dict, Any, List, Optional
from django.db.models import Q
from django.utils import timezone
from apps.products.models import InventoryItem
from apps.planning.models import MarketIntelligenceRecord, IndustrySeasonalRule


class MarketIntelligenceService:

    @classmethod
    def get_market_intelligence(cls, product: InventoryItem) -> Dict[str, Any]:
        """
        Retrieves real MarketIntelligenceRecord entries matching the product category or SKU.
        If none are configured, transparently returns is_available=False without fabricating facts.
        """
        cat_name = product.category.name if product.category else ""
        code = product.code

        records = MarketIntelligenceRecord.objects.filter(
            category__icontains=cat_name
        ) | MarketIntelligenceRecord.objects.filter(
            commodity_or_sku__in=[code, cat_name]
        )

        records = list(records.order_by("-data_freshness_date")[:5])

        if not records:
            return {
                "is_available": False,
                "provider": "N/A",
                "summary": "External market feed not connected for this product category. Operating on internal ledger demand.",
                "trend_direction": "NEUTRAL",
                "price_change_pct_30d": 0.0,
                "reliability_score": 0.0,
                "records": [],
            }

        latest = records[0]
        today = timezone.localdate()
        is_fresh = (today - latest.data_freshness_date).days <= 30

        return {
            "is_available": True,
            "provider": latest.provider,
            "category": latest.category,
            "commodity_or_sku": latest.commodity_or_sku,
            "market_region": latest.market_region,
            "current_index_value": float(latest.current_index_value),
            "price_change_pct_30d": float(latest.price_change_pct_30d),
            "trend_direction": latest.trend_direction,
            "reliability_score": float(latest.reliability_score),
            "data_freshness_date": str(latest.data_freshness_date),
            "is_fresh": is_fresh,
            "summary": (
                f"{latest.category} index is {latest.trend_direction.lower()} ({latest.price_change_pct_30d:+.1f}% 30-day shift). "
                f"Source: {latest.source_reference or latest.provider}."
            ),
            "records": [
                {
                    "commodity": r.commodity_or_sku,
                    "index_value": float(r.current_index_value),
                    "change_pct": float(r.price_change_pct_30d),
                    "trend": r.trend_direction,
                    "date": str(r.data_freshness_date),
                }
                for r in records
            ]
        }


class SeasonalPlannerService:

    @classmethod
    def evaluate_seasonality(cls, product: InventoryItem) -> Dict[str, Any]:
        """
        Checks active IndustrySeasonalRule matching the current month and product category.
        Provides early advance purchasing timing and demand surge multipliers.
        """
        now = timezone.localdate()
        curr_month = now.month
        cat_name = product.category.name if product.category else "General"

        rules = IndustrySeasonalRule.objects.filter(
            is_active=True,
            start_month__lte=curr_month,
            end_month__gte=curr_month
        ).filter(
            Q(industry_category__iexact="General")
            | Q(industry_category__iexact=cat_name)
            | Q(industry_category__icontains=cat_name)
            | Q(industry_category="")
            | (Q(industry_category__isnull=False) & Q(industry_category__in=cat_name.split()))
        )

        rule = rules.first()

        # Also check upcoming season (within 30-60 days) to recommend advance purchase
        upcoming_month = (curr_month % 12) + 1
        upcoming_rule = IndustrySeasonalRule.objects.filter(
            is_active=True,
            start_month=upcoming_month,
        ).filter(
            Q(industry_category__iexact="General")
            | Q(industry_category__iexact=cat_name)
            | Q(industry_category__icontains=cat_name)
            | Q(industry_category="")
            | (Q(industry_category__isnull=False) & Q(industry_category__in=cat_name.split()))
        ).first()

        if rule:
            return {
                "has_active_season": True,
                "season_name": rule.season_name,
                "demand_multiplier": float(rule.demand_multiplier),
                "advance_buffer_days": rule.lead_time_buffer_days,
                "description": rule.description or f"Active seasonal cycle: {rule.season_name}.",
                "recommendation_timing": "IMMEDIATE_SEASON_COVERAGE",
            }

        if upcoming_rule:
            return {
                "has_active_season": False,
                "upcoming_season_detected": True,
                "upcoming_season_name": upcoming_rule.season_name,
                "demand_multiplier": float(upcoming_rule.demand_multiplier),
                "advance_buffer_days": upcoming_rule.lead_time_buffer_days,
                "description": f"Upcoming seasonal surge: {upcoming_rule.season_name} starts next month. Early advance purchasing recommended.",
                "recommendation_timing": "ADVANCE_PURCHASE_RECOMMENDED",
            }

        return {
            "has_active_season": False,
            "upcoming_season_detected": False,
            "demand_multiplier": 1.0,
            "advance_buffer_days": 0,
            "description": "Standard business cycle; no active or upcoming seasonal rule triggered.",
            "recommendation_timing": "NORMAL",
        }
