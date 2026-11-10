import math
import logging
from decimal import Decimal
from typing import Dict, Any, Optional

from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse
from apps.planning.models import ReplenishmentPolicy

logger = logging.getLogger(__name__)


class ReplenishmentIntelligenceService:
    """
    Statistical Replenishment and Buffer Intelligence.
    Computes mathematical Safety Stock, Dynamic Reorder Point (ROP),
    Target Days of Cover, and Net Deficit.
    """

    # Service level Z-score mapping (Default 95% = 1.645)
    Z_SCORE_MAP = {
        Decimal("90.00"): Decimal("1.282"),
        Decimal("95.00"): Decimal("1.645"),
        Decimal("98.00"): Decimal("2.054"),
        Decimal("99.00"): Decimal("2.326"),
    }

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
        Safety Stock = max(min_floor, Z * std_dev * sqrt(LeadTime))
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
        z_score = cls.Z_SCORE_MAP.get(service_target, Decimal("1.645"))

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

