import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class ScenarioSimulatorService:
    """
    In-Memory Non-Destructive What-If Scenario Simulator.
    Simulates hypothetical procurement quantities, supplier price variations,
    lead time changes, and demand shocks without writing to database or mutating balances.
    """

    @classmethod
    def simulate(
        cls,
        base_stock_profile: Dict[str, Any],
        base_demand_intel: Dict[str, Any],
        base_reorder_params: Dict[str, Any],
        simulated_quantity: float,
        simulated_unit_price: Optional[float] = None,
        simulated_lead_time_days: Optional[int] = None,
        simulated_daily_demand: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Calculates projected inventory trajectory, stockout risks, capital outlay,
        and post-replenishment coverage horizon.
        """
        avail = float(base_stock_profile.get("available_stock", 0.0))
        pipeline = float(
            base_stock_profile.get("incoming_purchase_qty", 0.0) +
            base_stock_profile.get("in_transit_transfer_qty", 0.0) +
            base_stock_profile.get("incoming_stock", 0.0)
        )
        daily = simulated_daily_demand if simulated_daily_demand is not None else float(
            base_demand_intel.get("average_daily_demand", 1.0)
        )
        daily = max(0.01, daily)
        lead_time = simulated_lead_time_days if simulated_lead_time_days is not None else int(
            base_reorder_params.get("lead_time_days", 5)
        )
        unit_price = simulated_unit_price if simulated_unit_price is not None else float(
            base_reorder_params.get("unit_cost", 100.0)
        )

        # 1. Stock level on delivery arrival date
        stock_at_arrival = max(0.0, avail - (daily * lead_time))
        is_stockout_before_arrival = (avail - (daily * lead_time)) <= 0.0
        days_to_stockout = round(avail / daily, 1)

        # 2. Stock level immediately upon replenishment receipt
        stock_after_replenishment = stock_at_arrival + pipeline + simulated_quantity

        # 3. Post-replenishment days of supply
        post_replenishment_coverage_days = round(stock_after_replenishment / daily, 1)

        # 4. Total Financial Investment
        total_investment = round(simulated_quantity * unit_price, 2)

        # 5. Overstock evaluation
        max_stock = float(base_reorder_params.get("max_stock", 0.0) or base_reorder_params.get("max_stock_level", 0.0))
        exceeds_max_stock = max_stock > 0 and stock_after_replenishment > max_stock
        excess_units = max(0.0, stock_after_replenishment - max_stock) if exceeds_max_stock else 0.0

        # 6. Projected Timeline trajectory (Day 0, Day = Lead Time, Day = +15, +30, +60)
        timeline = [
            {"day": 0, "label": "Today", "projected_stock": round(avail, 1)},
            {
                "day": lead_time,
                "label": f"Delivery Day (Day {lead_time})",
                "projected_stock": round(stock_after_replenishment, 1),
            },
            {
                "day": lead_time + 15,
                "label": f"Day {lead_time + 15}",
                "projected_stock": max(0.0, round(stock_after_replenishment - (daily * 15), 1)),
            },
            {
                "day": lead_time + 30,
                "label": f"Day {lead_time + 30}",
                "projected_stock": max(0.0, round(stock_after_replenishment - (daily * 30), 1)),
            },
            {
                "day": lead_time + 60,
                "label": f"Day {lead_time + 60}",
                "projected_stock": max(0.0, round(stock_after_replenishment - (daily * 60), 1)),
            },
        ]

        if is_stockout_before_arrival:
            health = "DEFICIT_RISK"
        elif exceeds_max_stock or post_replenishment_coverage_days > 120.0:
            health = "OVERSTOCK_RISK"
        else:
            health = "BALANCED"

        return {
            "is_simulation": True,
            "simulated_quantity": simulated_quantity,
            "simulated_unit_price": unit_price,
            "simulated_lead_time_days": lead_time,
            "simulated_daily_demand": daily,
            "total_investment": total_investment,
            "days_to_stockout": days_to_stockout,
            "is_stockout_before_arrival": is_stockout_before_arrival,
            "stock_at_arrival": round(stock_at_arrival, 1),
            "stock_after_replenishment": round(stock_after_replenishment, 1),
            "post_replenishment_coverage_days": post_replenishment_coverage_days,
            "exceeds_max_stock": exceeds_max_stock,
            "excess_units": round(excess_units, 1),
            "stock_health": health,
            "timeline": timeline,
        }

