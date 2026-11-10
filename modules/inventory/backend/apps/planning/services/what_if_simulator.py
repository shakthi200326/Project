"""
What-If Simulator Service.
Provides pure in-memory, non-destructive scenario simulations.
NEVER modifies database records, balances, ledger, or reservations.
"""
from decimal import Decimal
from typing import Dict, Any, Optional
from datetime import timedelta
from django.utils import timezone


class WhatIfSimulatorService:

    @classmethod
    def simulate_scenario(
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
        Calculates projected outcomes for hypothetical purchasing parameters.
        Returns expected inventory curve, stockout date, capital investment, and safety margins.
        """
        avail = base_stock_profile["available_stock"]
        pipeline = base_stock_profile["incoming_purchase_qty"] + base_stock_profile["in_transit_transfer_qty"]
        daily = simulated_daily_demand if simulated_daily_demand is not None else base_demand_intel["average_daily_demand"]
        daily = max(0.01, daily)
        lead_time = simulated_lead_time_days if simulated_lead_time_days is not None else base_reorder_params["lead_time_days"]
        unit_price = simulated_unit_price if simulated_unit_price is not None else 100.0

        # Projected arrivals & consumption timeline
        # 1. Stock at arrival date (Lead time days from now)
        stock_at_arrival = max(0.0, avail - (daily * lead_time))
        is_stockout_before_arrival = (avail - (daily * lead_time)) <= 0
        days_to_stockout = round(avail / daily, 1)

        # 2. Stock immediately after replenishment
        stock_after_replenishment = stock_at_arrival + pipeline + simulated_quantity

        # 3. Days of supply post-replenishment
        post_replenishment_coverage_days = round(stock_after_replenishment / daily, 1)

        # 4. Total Financial Investment
        total_investment = round(simulated_quantity * unit_price, 2)

        # 5. Overstock evaluation under simulated parameters
        max_stock = base_reorder_params.get("max_stock", 0.0)
        exceeds_max_stock = max_stock > 0 and stock_after_replenishment > max_stock
        excess_units = max(0.0, stock_after_replenishment - max_stock) if exceeds_max_stock else 0.0

        # Timeline projection points (Day 0, Day = Lead Time, Day = +30d, Day = +60d)
        timeline = [
            {"day": 0, "label": "Today", "projected_stock": avail},
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
            "stock_health": (
                "DEFICIT_RISK" if is_stockout_before_arrival
                else ("OVERSTOCK_RISK" if exceeds_max_stock or post_replenishment_coverage_days > 120 else "BALANCED")
            ),
            "timeline": timeline,
        }

