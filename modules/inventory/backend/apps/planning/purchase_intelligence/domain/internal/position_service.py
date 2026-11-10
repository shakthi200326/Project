import logging
from decimal import Decimal
from typing import Dict, Any, Optional
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Q

from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse
from apps.stock.models import StockBalance, StockInTransit, StockLedgerEntry
from apps.movements.models import StockTransaction, StockTransactionLine

logger = logging.getLogger(__name__)


class PositionAnalysisService:
    """
    Evaluates physical balances, pipeline stock, and net inventory positions
    strictly from the immutable stock ledger and balance buckets.
    """

    @classmethod
    def get_stock_position(
        cls,
        product: InventoryItem,
        warehouse: Warehouse,
        variant: Optional[InventoryItemVariant] = None,
    ) -> Dict[str, Any]:
        """
        Calculates exact stock metrics without database mutations:
        - on_hand: physical inventory on floor
        - reserved: active customer/production reservations
        - blocked: administrative holds
        - damaged: inspection-rejected or broken stock
        - quarantined: quality review holds
        - available_stock: usable floor inventory
        - incoming_stock: confirmed inbound transfers + open purchase orders
        - net_inventory_position: usable stock + pipeline
        """
        balances = StockBalance.objects.filter(item=product, warehouse=warehouse)
        if variant:
            balances = balances.filter(variant=variant)

        on_hand = Decimal("0.0000")
        reserved = Decimal("0.0000")
        blocked = Decimal("0.0000")
        damaged = Decimal("0.0000")
        quarantined = Decimal("0.0000")

        for b in balances:
            on_hand += b.on_hand_qty
            reserved += b.reserved_qty
            blocked += b.blocked_qty
            damaged += getattr(b, "damaged_qty", Decimal("0.0000"))
            quarantined += getattr(b, "quarantined_qty", Decimal("0.0000"))

        # Available usable stock
        available_stock = max(
            Decimal("0.0000"), on_hand - reserved - blocked - damaged - quarantined
        )

        # In-transit warehouse transfers
        in_transit_qs = StockInTransit.objects.filter(
            item=product,
            destination_warehouse=warehouse,
            status__in=["IN_TRANSIT", "SHIPPED", "In Transit", "Shipped"],
        )
        if variant:
            in_transit_qs = in_transit_qs.filter(variant=variant)
        tot_incoming_xfer = in_transit_qs.aggregate(tot=Sum("quantity"))["tot"] or Decimal("0.0000")

        # Open/confirmed inbound purchase orders
        po_lines = StockTransactionLine.objects.filter(
            item=product,
            transaction__transaction_type=StockTransaction.TransactionType.RECEIPT,
            transaction__status__in=[
                StockTransaction.Status.SUBMITTED,
                StockTransaction.Status.UNDER_INSPECTION,
                StockTransaction.Status.PUTAWAY_PENDING,
            ],
            transaction__receiving_location__warehouse=warehouse,
        )
        if variant:
            po_lines = po_lines.filter(variant=variant)
        tot_open_po = po_lines.aggregate(tot=Sum("quantity"))["tot"] or Decimal("0.0000")

        total_incoming = Decimal(str(tot_incoming_xfer)) + Decimal(str(tot_open_po))
        net_position = available_stock + total_incoming

        return {
            "on_hand": on_hand,
            "reserved": reserved,
            "reserved_stock": reserved,
            "blocked": blocked,
            "blocked_stock": blocked,
            "damaged": damaged,
            "quarantined": quarantined,
            "available_stock": available_stock,
            "incoming_stock": total_incoming,
            "incoming_transfers": Decimal(str(tot_incoming_xfer)),
            "incoming_po": Decimal(str(tot_open_po)),
            "net_inventory_position": net_position,
        }

    @classmethod
    def calculate_days_of_supply(
        cls, available_stock: Decimal, average_daily_demand: Decimal
    ) -> float:
        """Computes remaining days of supply before stockout."""
        if available_stock <= Decimal("0.0000"):
            return 0.0
        if average_daily_demand <= Decimal("0.0000"):
            return 999.0  # Infinite cover / non-moving SKU with stock
        days = float(available_stock / average_daily_demand)
        return round(max(0.0, days), 1)

    @classmethod
    def is_dead_stock(
        cls, product: InventoryItem, warehouse: Warehouse, threshold_days: int = 90
    ) -> bool:
        """Returns True if no outbound consumption has occurred in the threshold horizon."""
        start_date = timezone.now() - timedelta(days=threshold_days)
        outbound = StockLedgerEntry.objects.filter(
            item=product,
            warehouse=warehouse,
            movement_type__in=["ISSUE", "OUT", "TRANSFER_OUT"],
            created_at__gte=start_date,
        ).exists()
        return not outbound
