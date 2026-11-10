"""
Overstock Prevention & Stock Coverage Service.
Identifies overstock, dead stock, and unnecessary procurement.
Computes days of supply and flags over-purchasing risks.
"""
from decimal import Decimal
from typing import Dict, Any
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse


class OverstockPreventionService:

    @classmethod
    def evaluate_overstock_risk(
        cls,
        stock_profile: Dict[str, Any],
        reorder_params: Dict[str, Any],
        daily_demand: float,
        proposed_quantity: float,
    ) -> Dict[str, Any]:
        """
        Assesses whether ordering the proposed quantity creates excess inventory.
        Calculates:
        - Current Days of Supply = Available Stock / Daily Demand
        - Post-Order Days of Supply = (Available Stock + Proposed Qty + Pipeline) / Daily Demand
        - Max Permissible Horizon (default 90 - 180 days based on max_stock or shelf-life)
        """
        avail = float(stock_profile["available_stock"])
        pipeline = float(stock_profile.get("incoming_purchase_qty", 0.0) + stock_profile.get("in_transit_transfer_qty", 0.0))
        daily = max(0.01, float(daily_demand))
        max_stock = float(reorder_params.get("max_stock", 0.0) or 0.0)

        current_days_supply = round(avail / daily, 1)
        projected_after_order = avail + pipeline + proposed_quantity
        post_order_days_supply = round(projected_after_order / daily, 1)

        is_overstock_risk = False
        warnings = []
        recommended_max_qty = proposed_quantity

        # Check against Max Stock if configured
        if max_stock > 0 and projected_after_order > max_stock:
            is_overstock_risk = True
            excess = round(projected_after_order - max_stock, 1)
            warnings.append(
                f"Proposed order would exceed maximum warehouse capacity of {max_stock} units by {excess} units."
            )
            recommended_max_qty = max(0.0, max_stock - (avail + pipeline))

        # Check against Days of Supply threshold (> 180 days considered excessive capital tie-up)
        elif post_order_days_supply > 180.0 and daily_demand > 0:
            is_overstock_risk = True
            warnings.append(
                f"Post-order coverage will reach {post_order_days_supply} days of supply (> 180 days threshold)."
            )
            # Recommend trimming to 90 days
            recommended_max_qty = max(0.0, round((daily * 90.0) - (avail + pipeline), 0))

        # Check for near-zero consumption (slow moving / dead stock risk)
        is_slow_moving = daily_demand < 0.1 and avail > 0
        if is_slow_moving:
            warnings.append(
                "Near-zero recent consumption detected in ledger. Ordering new stock carries dead inventory risk."
            )

        return {
            "is_overstock_risk": is_overstock_risk,
            "is_slow_moving": is_slow_moving,
            "current_days_supply": current_days_supply,
            "post_order_days_supply": post_order_days_supply,
            "recommended_capped_quantity": recommended_max_qty,
            "warnings": warnings,
            "stock_health": "OPTIMAL" if not is_overstock_risk and not is_slow_moving else (
                "SLOW_MOVING" if is_slow_moving else "EXCESS_RISK"
            ),
        }
