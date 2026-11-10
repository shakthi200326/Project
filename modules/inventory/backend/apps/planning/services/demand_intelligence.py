"""
Demand Intelligence Service.
Analyzes historical outbound movements from StockLedgerEntry, calculates moving averages,
evaluates demand trends (increasing, decreasing, stable, uncertain), and generates forecasts.
"""
from decimal import Decimal
from typing import Dict, Any, List
from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta

from apps.stock.models import StockLedgerEntry
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse


class DemandIntelligenceService:

    @classmethod
    def analyze_demand(
        cls, product: InventoryItem, warehouse: Warehouse, days_lookback: int = 90
    ) -> Dict[str, Any]:
        """
        Extracts real historical consumption from StockLedgerEntry where quantity_delta < 0 (ISSUE, TRANSFER_OUT).
        Splits into 3 periods (recent 30d, prior 30d, older 30d) to detect trend direction and volatility.
        """
        now = timezone.now()
        p1_start = now - timedelta(days=30)
        p2_start = now - timedelta(days=60)
        p3_start = now - timedelta(days=90)

        # Period 1 (last 30 days)
        p1_out = StockLedgerEntry.objects.filter(
            item=product,
            warehouse=warehouse,
            quantity_delta__lt=0,
            created_at__gte=p1_start
        ).aggregate(total=Sum("quantity_delta"))["total"]

        # Period 2 (31 - 60 days ago)
        p2_out = StockLedgerEntry.objects.filter(
            item=product,
            warehouse=warehouse,
            quantity_delta__lt=0,
            created_at__gte=p2_start,
            created_at__lt=p1_start
        ).aggregate(total=Sum("quantity_delta"))["total"]

        # Period 3 (61 - 90 days ago)
        p3_out = StockLedgerEntry.objects.filter(
            item=product,
            warehouse=warehouse,
            quantity_delta__lt=0,
            created_at__gte=p3_start,
            created_at__lt=p2_start
        ).aggregate(total=Sum("quantity_delta"))["total"]

        d1 = abs(float(p1_out)) if p1_out else 0.0
        d2 = abs(float(p2_out)) if p2_out else 0.0
        d3 = abs(float(p3_out)) if p3_out else 0.0

        total_demand_90d = d1 + d2 + d3
        data_points_available = (1 if d1 > 0 else 0) + (1 if d2 > 0 else 0) + (1 if d3 > 0 else 0)

        # Baseline fallback if zero historical transactions yet
        is_sufficient_data = total_demand_90d > 0

        if not is_sufficient_data:
            # Baseline proxy from product reorder point
            avg_daily_demand = round(float(product.reorder_point or 20) / 15.0, 2)
            trend = "UNCERTAIN"
            confidence = 0.50
            demand_pattern = "Insufficient historical transaction ledger entries"
            daily_series = [round(avg_daily_demand, 2)] * 7
        else:
            # Weighted Moving Average: 50% recent 30d, 30% mid 30d, 20% older 30d
            weighted_30d = (d1 * 0.5) + (d2 * 0.3) + (d3 * 0.2)
            if data_points_available == 1:
                weighted_30d = d1
            avg_daily_demand = round(weighted_30d / 30.0, 2)

            # Trend detection
            if d1 > d2 * 1.15:
                trend = "INCREASING"
            elif d1 < d2 * 0.85:
                trend = "DECREASING"
            else:
                trend = "STABLE"

            confidence = 0.85 if data_points_available >= 2 else 0.65
            demand_pattern = f"Ledger-derived: {trend.title()} demand across {data_points_available} observation cycles"
            daily_series = [
                round(avg_daily_demand * (0.9 + 0.03 * i), 2) for i in range(7)
            ]

        forecast_30d = round(avg_daily_demand * 30.0, 2)
        forecast_60d = round(avg_daily_demand * 60.0, 2)

        return {
            "is_sufficient_data": is_sufficient_data,
            "period_1_demand_30d": d1,
            "period_2_demand_60d": d2,
            "period_3_demand_90d": d3,
            "total_historical_demand_90d": total_demand_90d,
            "average_daily_demand": avg_daily_demand,
            "forecast_30d": forecast_30d,
            "forecast_60d": forecast_60d,
            "trend": trend,
            "confidence": confidence,
            "demand_pattern": demand_pattern,
            "daily_trend_preview": daily_series,
        }

