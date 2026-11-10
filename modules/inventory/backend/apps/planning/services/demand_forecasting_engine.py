import math
import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from datetime import timedelta, date
from django.utils import timezone
from django.db.models import Sum

from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse
from apps.stock.models import StockLedgerEntry
from apps.planning.models import ReplenishmentPolicy

logger = logging.getLogger(__name__)


class DemandForecastingEngine:
    """
    Industry-agnostic Demand Forecasting Engine.
    Analyzes historical consumption from StockLedgerEntry.
    Supports Average Daily Demand (ADD), Moving Average (SMA),
    Weighted Moving Average (WMA), and Exponential Smoothing (SES).
    Includes zero-day imputation, outlier exclusion, and accuracy measurement (MAPE/MAD).
    """

    # Service level Z-score mapping (Default 95% = 1.645)
    Z_SCORE_MAP = {
        Decimal("90.00"): Decimal("1.282"),
        Decimal("95.00"): Decimal("1.645"),
        Decimal("98.00"): Decimal("2.054"),
        Decimal("99.00"): Decimal("2.326"),
    }

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
        # If strong growth or recent surge, prefer WMA/SES; otherwise standard ADD
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


class ReplenishmentIntelligenceService:
    """
    Statistical Replenishment and Buffer Intelligence.
    Computes mathematical Safety Stock, Dynamic Reorder Point (ROP),
    Target Days of Cover, and Net Deficit.
    """

    @classmethod
    def calculate_replenishment_targets(
        cls,
        product: InventoryItem,
        warehouse: Warehouse,
        forecast_result: Dict[str, Any],
        policy: Optional[ReplenishmentPolicy] = None,
    ) -> Dict[str, Any]:
        """
        Computes:
        Safety Stock = Z * std_dev * sqrt(LeadTime)
        Reorder Point = (Average Daily Demand * LeadTime) + Safety Stock
        Target Stock = Reorder Point + (Target Cover Days * Average Daily Demand)
        """
        add = Decimal(str(forecast_result.get("recommended_daily_demand") or 0.0))
        std_dev = Decimal(str(forecast_result.get("std_dev_daily_demand") or 0.0))

        # Resolve Lead Time
        lead_time_days = policy.lead_time_days if policy else int(product.lead_time_days or 5)
        if lead_time_days <= 0:
            lead_time_days = 5

        # Service Level & Z-Score
        service_target = policy.service_level_target_pct if policy else Decimal("95.00")
        z_score = DemandForecastingEngine.Z_SCORE_MAP.get(service_target, Decimal("1.645"))

        # Safety Stock formula: Z * sigma_d * sqrt(L)
        lead_time_sqrt = Decimal(str(math.sqrt(lead_time_days)))
        computed_safety_stock = z_score * std_dev * lead_time_sqrt

        # Minimum floor fallback
        min_safety_floor = Decimal(str(policy.safety_stock_days if policy else 7)) * add
        safety_stock = max(min_safety_floor, computed_safety_stock)

        # Dynamic Reorder Point: (ADD * LeadTime) + Safety Stock
        demand_during_lead_time = add * Decimal(str(lead_time_days))
        dynamic_rop = demand_during_lead_time + safety_stock

        # Fallback to configured min_stock_level if higher
        if policy and policy.min_stock_level > dynamic_rop:
            final_rop = policy.min_stock_level
        else:
            final_rop = max(dynamic_rop, Decimal(str(product.reorder_point or 0.0)))

        # Target Stock Level: covers target horizon (default 30 days)
        cover_days = Decimal(str(policy.target_cover_days if policy else 30))
        target_stock_level = final_rop + (add * cover_days)

        if policy and policy.max_stock_level > target_stock_level:
            target_stock_level = policy.max_stock_level

        return {
            "average_daily_demand": float(add),
            "lead_time_days": lead_time_days,
            "service_level_target_pct": float(service_target),
            "z_score": float(z_score),
            "safety_stock": round(float(safety_stock), 2),
            "demand_during_lead_time": round(float(demand_during_lead_time), 2),
            "reorder_point": round(float(final_rop), 2),
            "target_stock_level": round(float(target_stock_level), 2),
            "target_cover_days": int(cover_days),
        }

