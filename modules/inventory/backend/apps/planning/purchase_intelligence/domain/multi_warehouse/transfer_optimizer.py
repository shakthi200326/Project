import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional

from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse
from apps.planning.models import ReplenishmentPolicy
from apps.planning.purchase_intelligence.domain.internal.position_service import PositionAnalysisService

logger = logging.getLogger(__name__)


class TransferOptimizationService:
    """
    Multi-Warehouse Inventory Transfer Optimizer.
    Identifies whether deficit in a destination warehouse can be fulfilled
    by surplus stock from adjacent depots before triggering external procurement.
    Guarantees no double-counting and ensures source warehouse retains its safe floor.
    """

    @classmethod
    def evaluate_inter_warehouse_transfers(
        cls,
        product: InventoryItem,
        destination_warehouse: Warehouse,
        required_quantity: Decimal,
        variant: Optional[InventoryItemVariant] = None,
    ) -> Dict[str, Any]:
        """
        Examines all other active warehouses. If any other warehouse has available stock
        greater than its own reorder point or minimum reserve (surplus), recommends a transfer.
        """
        other_warehouses = Warehouse.objects.exclude(id=destination_warehouse.id).filter(
            status__in=["ACTIVE", "Active"]
        )

        candidates: List[Dict[str, Any]] = []
        needed_qty = Decimal(str(max(Decimal("0.0000"), required_quantity)))

        for source_wh in other_warehouses:
            pos = PositionAnalysisService.get_stock_position(product, source_wh, variant=variant)
            available = pos["available_stock"]

            # Determine source warehouse safe reserve floor
            source_policy = ReplenishmentPolicy.objects.filter(
                product=product, warehouse=source_wh, is_active=True
            ).first()

            if source_policy:
                safe_floor = Decimal(str(source_policy.min_stock_level or source_policy.reorder_point or Decimal("0.0000")))
            else:
                safe_floor = Decimal(str(product.reorder_point or Decimal("20.0000")))

            surplus = max(Decimal("0.0000"), available - safe_floor)

            if surplus > Decimal("0.0000"):
                transferable = min(needed_qty, surplus)
                same_city = (
                    source_wh.city and destination_warehouse.city and
                    source_wh.city.strip().lower() == destination_warehouse.city.strip().lower()
                )
                transfer_lead_days = 2 if same_city else 4

                candidates.append({
                    "warehouse_id": source_wh.id,
                    "warehouse_code": source_wh.code,
                    "warehouse_name": source_wh.name,
                    "city": source_wh.city or "Unknown",
                    "available_stock": float(available),
                    "safe_reserve_retained": float(safe_floor),
                    "surplus_available": float(surplus),
                    "transferable_quantity": float(transferable),
                    "transfer_lead_days": transfer_lead_days,
                    "remaining_source_stock": float(available - transferable),
                    "is_full_coverage": transferable >= needed_qty,
                    "source_warehouse_obj": source_wh,
                })

        if not candidates:
            return {
                "transfer_feasible": False,
                "best_source_warehouse": None,
                "best_source_warehouse_id": None,
                "best_source_warehouse_code": None,
                "best_source_warehouse_name": None,
                "transferable_quantity": Decimal("0.0000"),
                "transfer_lead_days": 0,
                "is_full_coverage": False,
                "candidates": [],
                "reason": "No surrounding warehouse has surplus stock above safety thresholds.",
            }

        # Prefer full coverage first, then highest transferable quantity, then lowest lead time
        best = sorted(
            candidates,
            key=lambda x: (not x["is_full_coverage"], -x["transferable_quantity"], x["transfer_lead_days"]),
        )[0]

        return {
            "transfer_feasible": True,
            "best_source_warehouse": best["source_warehouse_obj"],
            "best_source_warehouse_id": best["warehouse_id"],
            "best_source_warehouse_code": best["warehouse_code"],
            "best_source_warehouse_name": best["warehouse_name"],
            "transferable_quantity": Decimal(str(best["transferable_quantity"])),
            "transfer_lead_days": best["transfer_lead_days"],
            "is_full_coverage": best["is_full_coverage"],
            "candidates": candidates,
            "reason": (
                f"Surplus of {best['surplus_available']:.1f} units detected at {best['warehouse_name']}. "
                f"Inter-warehouse transfer recommended before external procurement. "
                f"Can transfer {best['transferable_quantity']:.1f} units in ~{best['transfer_lead_days']} days, "
                f"retaining {best['remaining_source_stock']:.1f} units safe floor at source."
            ),
        }
