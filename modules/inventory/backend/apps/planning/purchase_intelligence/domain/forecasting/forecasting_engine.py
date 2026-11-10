import math
import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional
from datetime import timedelta, date
from django.utils import timezone

from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse
from apps.stock.models import StockLedgerEntry

logger = logging.getLogger(__name__)


class DemandForecastingEngine:
    """
    Industry-agnostic Demand Forecasting Engine.
    Analyzes historical consumption from immutable StockLedgerEntry logs.
    Supports Average Daily Demand (ADD), Weighted Moving Average (WMA),
    and Single Exponential Smoothing (SES).
    Measures forecast accuracy using MAD, MAPE, and Tracking Signal.
    """

    @classmethod
    def get_historical_daily_consumption(
        cls,
        product: InventoryItem,
        warehouse: Warehouse,
        lookback_days: int = 90,
        variant: Optional[InventoryItemVariant] = None,
    ) -> List[Dict[str, Any]]:
        """
        Extracts chronological daily consumption from immutable StockLedgerEntry logs.
        Aggregates negative deltas (ISSUE, OUT, TRANSFER_OUT) per calendar day.
        Excludes today's incomplete intraday data by default to prevent partial-day morning distortion.
        Aligns active historical window to first recorded consumption if shorter than lookback_days.
        """
        today = timezone.localdate()
        end_date = today - timedelta(days=1)
        start_date = end_date - timedelta(days=lookback_days - 1)

        first_ledger = StockLedgerEntry.objects.filter(
            item=product,
            warehouse=warehouse,
            movement_type__in=["ISSUE", "OUT", "TRANSFER_OUT"],
        ).order_by("created_at").first()

        if first_ledger:
            first_date = timezone.localtime(first_ledger.created_at).date()
            if first_date > end_date:
                end_date = today
                effective_start = first_date
            else:
                effective_start = max(start_date, first_date)
        else:
            effective_start = start_date

        num_days = (end_date - effective_start).days + 1
        if num_days <= 0:
            num_days = 1
            effective_start = end_date

        day_map = {effective_start + timedelta(days=i): Decimal("0.0000") for i in range(num_days)}

        qs = StockLedgerEntry.objects.filter(
            item=product,
            warehouse=warehouse,
            movement_type__in=["ISSUE", "OUT", "TRANSFER_OUT"],
            created_at__date__gte=effective_start,
            created_at__date__lte=end_date,
        )
        if variant:
            qs = qs.filter(variant=variant)

        for entry in qs:
            entry_date = timezone.localtime(entry.created_at).date()
            if entry_date in day_map:
                consumption = abs(entry.quantity_delta or Decimal("0.0000"))
                day_map[entry_date] += consumption

        series = [{"date": d, "consumption": float(day_map[d])} for d in sorted(day_map.keys())]
        return series

    @classmethod
    def calculate_forecast(
        cls,
        product: InventoryItem,
        warehouse: Warehouse,
        lookback_days: int = 90,
        variant: Optional[InventoryItemVariant] = None,
        alpha: float = 0.25,
    ) -> Dict[str, Any]:
        """
        Calculates multi-method demand forecast:
        - Simple Moving Average (SMA 30d, 90d)
        - Weighted Moving Average (WMA with progressive recency weighting)
        - Single Exponential Smoothing (SES)
        - Average Daily, Weekly, and Monthly Demand
        - Standard Deviation of daily demand
        - Historical Forecast Accuracy (MAPE, MAD, Tracking Signal)
        """
        series = cls.get_historical_daily_consumption(
            product, warehouse, lookback_days=lookback_days, variant=variant
        )
        values = [s["consumption"] for s in series]

        total_consumption = sum(values)
        non_zero_days = sum(1 for v in values if v > 0)
        n = len(values)

        # 1. Check for sufficient historical data
        if n == 0 or total_consumption == 0:
            return {
                "has_sufficient_data": False,
                "data_points_count": n,
                "total_consumption": 0.0,
                "average_daily_demand": 0.0,
                "average_weekly_demand": 0.0,
                "average_monthly_demand": 0.0,
                "std_dev_daily_demand": 0.0,
                "forecast_method": "ZERO_DEMAND_FALLBACK",
                "recommended_daily_demand": 0.0,
                "growth_trend_pct": 0.0,
                "seasonal_index": 1.0,
                "mape": 0.0,
                "mad": 0.0,
                "tracking_signal": 0.0,
                "confidence_level": 0.30,
            }

        # 2. Basic Averages
        add_90d = total_consumption / n
        recent_30 = values[-30:] if n >= 30 else values
        add_30d = sum(recent_30) / len(recent_30) if recent_30 else add_90d

        # Growth trend = (30d avg / 90d avg) - 1
        growth_trend_pct = round(((add_30d / add_90d) - 1.0) * 100.0, 2) if add_90d > 0 else 0.0

        # 3. Weighted Moving Average (WMA on last 30 days)
        wma_weights = [i + 1 for i in range(len(recent_30))]
        weight_sum = sum(wma_weights)
        wma_forecast = sum(val * w for val, w in zip(recent_30, wma_weights)) / weight_sum if weight_sum > 0 else add_30d

        # 4. Single Exponential Smoothing (SES)
        ses_val = values[0]
        ses_history = [ses_val]
        for v in values[1:]:
            ses_val = (alpha * v) + ((1.0 - alpha) * ses_val)
            ses_history.append(ses_val)

        # 5. Standard Deviation of Daily Demand (for Safety Stock formula)
        mean_val = add_90d
        variance = sum((v - mean_val) ** 2 for v in values) / (n - 1) if n > 1 else 0.0
        std_dev = math.sqrt(variance)

        # 6. Forecast Accuracy Measurements (Backtested against SES series)
        abs_errors = [abs(actual - pred) for actual, pred in zip(values, ses_history)]
        mad = sum(abs_errors) / n if n > 0 else 0.0

        pct_errors = [
            (abs(actual - pred) / actual) * 100.0
            for actual, pred in zip(values, ses_history)
            if actual > 0
        ]
        mape = sum(pct_errors) / len(pct_errors) if pct_errors else 0.0

        # Tracking signal = Cumulative Error / MAD
        cum_error = sum((actual - pred) for actual, pred in zip(values, ses_history))
        tracking_signal = round(cum_error / mad, 2) if mad > 0 else 0.0

        # 7. Select Primary Recommended Forecast Daily Demand
        primary_daily = round((wma_forecast * 0.5) + (ses_val * 0.5), 4)
        confidence = 0.85 if non_zero_days >= 15 else (0.60 if non_zero_days >= 5 else 0.40)

        return {
            "has_sufficient_data": True,
            "data_points_count": n,
            "non_zero_sales_days": non_zero_days,
            "total_consumption": round(total_consumption, 2),
            "average_daily_demand": round(add_90d, 4),
            "average_daily_demand_30d": round(add_30d, 4),
            "average_weekly_demand": round(primary_daily * 7.0, 2),
            "average_monthly_demand": round(primary_daily * 30.0, 2),
            "std_dev_daily_demand": round(std_dev, 4),
            "wma_daily_forecast": round(wma_forecast, 4),
            "exponential_smoothing_forecast": round(ses_val, 4),
            "recommended_daily_demand": primary_daily,
            "forecast_method": "WEIGHTED_MOVING_AVERAGE_EXPONENTIAL_BLENDED",
            "growth_trend_pct": growth_trend_pct,
            "seasonal_index": 1.0,
            "mad": round(mad, 3),
            "mape": round(mape, 2),
            "tracking_signal": tracking_signal,
            "confidence_level": confidence,
        }

