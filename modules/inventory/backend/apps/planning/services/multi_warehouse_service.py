"""
Multi-Warehouse Optimization & Inter-Warehouse Transfer Service.
Checks if stock can be fulfilled by transferring surplus from another warehouse
before recommending purchasing new inventory.
"""
from decimal import Decimal
from typing import Dict, Any, List, Optional
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse
from apps.planning.models import ReorderRule, StockLevel
from apps.planning.services.calculation_engine import CalculationEngineService


class MultiWarehouseService:

    @classmethod
    def evaluate_inter_warehouse_transfers(
        cls, product: InventoryItem, destination_warehouse: Warehouse, required_quantity: float
    ) -> Dict[str, Any]:
        """
        Examines all other active warehouses. If any other warehouse has available stock
        greater than its own reorder point + safety buffer (surplus), recommends a transfer.
        Never counts the same stock twice.
        """
        other_warehouses = Warehouse.objects.exclude(id=destination_warehouse.id).filter(
            status__in=["ACTIVE", "Active"]
        )

        candidates = []
        needed_qty = Decimal(str(max(0.0, required_quantity)))

        for wh in other_warehouses:
            profile = CalculationEngineService.get_stock_profile(product, wh)
            reorder_params = CalculationEngineService.get_reorder_parameters(product, wh)

            avail = Decimal(str(profile["available_stock"]))
            min_reserve = Decimal(str(max(reorder_params["reorder_point"], reorder_params["safety_stock"])))

            # Surplus stock safely available to lend
            surplus = max(Decimal("0.0000"), avail - min_reserve)

            if surplus > Decimal("0.0000"):
                transferable = min(needed_qty, surplus)
                transfer_lead_days = 2 if wh.city == destination_warehouse.city else 4
                candidates.append({
                    "warehouse_id": wh.id,
                    "warehouse_code": wh.code,
                    "warehouse_name": wh.name,
                    "city": wh.city or "Unknown",
                    "available_stock": float(avail),
                    "safe_reserve_retained": float(min_reserve),
                    "surplus_available": float(surplus),
                    "transferable_quantity": float(transferable),
                    "transfer_lead_days": transfer_lead_days,
                    "remaining_source_stock": float(avail - transferable),
                    "is_full_coverage": transferable >= needed_qty,
                })

        if not candidates:
            return {
                "transfer_feasible": False,
                "best_source_warehouse": None,
                "transferable_quantity": 0.0,
                "candidates": [],
                "reason": "No surrounding warehouse has surplus stock above safety thresholds.",
            }

        # Prefer full coverage first, then highest surplus, then lowest lead time
        best = sorted(
            candidates,
            key=lambda x: (not x["is_full_coverage"], -x["transferable_quantity"], x["transfer_lead_days"])
        )[0]

        return {
            "transfer_feasible": True,
            "best_source_warehouse_id": best["warehouse_id"],
            "best_source_warehouse_code": best["warehouse_code"],
            "best_source_warehouse_name": best["warehouse_name"],
            "transferable_quantity": best["transferable_quantity"],
            "transfer_lead_days": best["transfer_lead_days"],
            "is_full_coverage": best["is_full_coverage"],
            "candidates": candidates,
            "reason": (
                f"Surplus of {best['surplus_available']} units detected at {best['warehouse_name']}. "
                f"Can transfer {best['transferable_quantity']} units in ~{best['transfer_lead_days']} days, "
                f"retaining {best['remaining_source_stock']} units safe stock at source."
            ),
        }

