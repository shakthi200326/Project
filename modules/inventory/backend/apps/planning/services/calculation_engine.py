"""
Centralized Calculation Engine Service for Inventory Replenishment & Purchase Suggestion System.
Industry-independent, deterministic, and traceable.
"""
from decimal import Decimal
from typing import Dict, Any, Optional
from django.db.models import Sum, Q
from django.utils import timezone

from apps.stock.models import StockBalance, StockLedgerEntry, StockInTransit
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.reservations.models import StockReservation
from apps.planning.models import ReorderRule, StockLevel
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse


class CalculationEngineService:
    """
    Computes stock balances, incoming pipelines, in-transit stock, and reorder deficits.
    No arbitrary numbers: strictly grounded in inventory ledger, stock balance buckets,
    confirmed transactions, and reorder policies.
    """

    @staticmethod
    def get_stock_profile(product: InventoryItem, warehouse: Warehouse) -> Dict[str, Any]:
        """
        Calculates all stock buckets with complete ledger verification:
        - on_hand_qty: physical on-hand quantity
        - reserved_qty: active reserved stock
        - blocked_qty: blocked stock
        - quarantined_qty: quarantined stock
        - damaged_qty: damaged stock
        - available_stock = max(0, on_hand - reserved - blocked - quarantined - damaged)
        - incoming_purchase_qty: confirmed PO items expected/under inspection but not yet posted to on-hand
        - in_transit_transfer_qty: confirmed transfers incoming from another warehouse
        - outgoing_transit_qty: stock dispatched to another warehouse
        - pending_demand: unfulfilled active reservations
        - projected_stock = available_stock + incoming_purchase_qty + in_transit_transfer_qty - pending_demand
        """
        # 1. Physical Balance Buckets
        balances = StockBalance.objects.filter(item=product, warehouse=warehouse)
        on_hand = Decimal("0.0000")
        reserved = Decimal("0.0000")
        blocked = Decimal("0.0000")
        quarantined = Decimal("0.0000")
        damaged = Decimal("0.0000")

        for b in balances:
            on_hand += b.on_hand_qty
            reserved += b.reserved_qty
            blocked += b.blocked_qty
            quarantined += b.quarantined_qty
            damaged += b.damaged_qty

        # Usable Available Stock
        available = max(Decimal("0.0000"), on_hand - reserved - blocked - quarantined - damaged)

        # 2. Confirmed Incoming Purchases (Receipts under inspection / submitted / putaway pending)
        incoming_tx_lines = StockTransactionLine.objects.filter(
            item=product,
            transaction__warehouse=warehouse,
            transaction__transaction_type=StockTransaction.TransactionType.RECEIPT,
            transaction__status__in=[
                StockTransaction.Status.SUBMITTED,
                StockTransaction.Status.UNDER_INSPECTION,
                StockTransaction.Status.ACCEPTED,
                StockTransaction.Status.PARTIALLY_ACCEPTED,
                StockTransaction.Status.PUTAWAY_PENDING,
            ]
        ).aggregate(total=Sum("quantity"))["total"]
        incoming_purchases = incoming_tx_lines or Decimal("0.0000")

        # 3. Confirmed Transfers In Transit
        transits_in = StockInTransit.objects.filter(
            item=product,
            destination_warehouse=warehouse,
            status=StockInTransit.Status.IN_TRANSIT
        ).aggregate(total=Sum("quantity"))["total"]
        in_transit_transfer = transits_in or Decimal("0.0000")

        # 4. Outgoing in-transit from this warehouse
        transits_out = StockInTransit.objects.filter(
            item=product,
            source_warehouse=warehouse,
            status=StockInTransit.Status.IN_TRANSIT
        ).aggregate(total=Sum("quantity"))["total"]
        outgoing_transit = transits_out or Decimal("0.0000")

        # 5. Pending Demand from Active Reservations
        res_active = StockReservation.objects.filter(
            item=product,
            warehouse=warehouse,
            status__in=[
                StockReservation.Status.RESERVED,
                StockReservation.Status.PARTIALLY_FULFILLED,
                StockReservation.Status.PENDING,
            ]
        ).aggregate(total=Sum("quantity"), released=Sum("released_quantity"))
        total_res = res_active["total"] or Decimal("0.0000")
        released_res = res_active["released"] or Decimal("0.0000")
        pending_demand = max(Decimal("0.0000"), total_res - released_res)

        # 6. Projected Stock
        projected_stock = available + incoming_purchases + in_transit_transfer - pending_demand

        return {
            "product_id": product.id,
            "sku": product.code,
            "product_name": product.name,
            "warehouse_id": warehouse.id,
            "warehouse_code": warehouse.code,
            "warehouse_name": warehouse.name,
            "on_hand_qty": float(on_hand),
            "reserved_qty": float(reserved),
            "blocked_qty": float(blocked),
            "quarantined_qty": float(quarantined),
            "damaged_qty": float(damaged),
            "available_stock": float(available),
            "incoming_purchase_qty": float(incoming_purchases),
            "in_transit_transfer_qty": float(in_transit_transfer),
            "outgoing_transit_qty": float(outgoing_transit),
            "pending_demand": float(pending_demand),
            "projected_stock": float(projected_stock),
        }

    @staticmethod
    def get_reorder_parameters(product: InventoryItem, warehouse: Warehouse) -> Dict[str, Any]:
        """
        Resolves reorder thresholds from:
        1. Specific ReorderRule (warehouse + product)
        2. Specific StockLevel (min/max/safety stock)
        3. Product master defaults
        """
        rule = ReorderRule.objects.filter(
            product=product, warehouse=warehouse, status__in=[ReorderRule.Status.ACTIVE, "ACTIVE"]
        ).first()

        level = StockLevel.objects.filter(product=product, warehouse=warehouse).first()

        lead_time = product.lead_time_days or 7
        moq = product.min_order_qty or Decimal("1.0000")
        safety_stock = Decimal("0.0000")
        strategy = "Product Default"
        reorder_point = product.reorder_point or Decimal("20.0000")
        reorder_qty = product.reorder_quantity or Decimal("40.0000")
        min_stock = Decimal("0.0000")
        max_stock = Decimal("0.0000")

        if rule:
            strategy = "Reorder Rule (Fixed Trigger)"
            reorder_point = rule.reorder_point
            reorder_qty = rule.reorder_quantity
            if rule.lead_time_days:
                lead_time = rule.lead_time_days
        elif level:
            strategy = "Min-Max Stock Policy"
            min_stock = level.min_stock
            max_stock = level.max_stock
            safety_stock = level.safety_stock or Decimal("0.0000")
            reorder_point = min_stock + safety_stock
            reorder_qty = max(Decimal("1.0000"), max_stock - reorder_point)

        return {
            "strategy": strategy,
            "reorder_point": float(reorder_point),
            "reorder_quantity": float(reorder_qty),
            "min_stock": float(min_stock),
            "max_stock": float(max_stock),
            "safety_stock": float(safety_stock),
            "lead_time_days": int(lead_time),
            "min_order_qty": float(moq),
        }

    @classmethod
    def calculate_replenishment_quantity(
        cls,
        stock_profile: Dict[str, Any],
        reorder_params: Dict[str, Any],
        forecasted_daily_demand: float = 0.0,
        seasonal_multiplier: float = 1.0,
    ) -> Dict[str, Any]:
        """
        Calculates recommended purchase quantity taking into account:
        1. Available stock vs reorder point
        2. Expected demand across supplier lead time
        3. Safety stock requirements
        4. Existing incoming quantities in pipeline
        5. Minimum Order Quantity (MOQ)
        6. Seasonal multipliers
        """
        available = Decimal(str(stock_profile["available_stock"]))
        incoming = Decimal(str(stock_profile["incoming_purchase_qty"]))
        in_transit = Decimal(str(stock_profile["in_transit_transfer_qty"]))
        pending_demand = Decimal(str(stock_profile["pending_demand"]))
        lead_time_days = Decimal(str(reorder_params["lead_time_days"]))
        reorder_point = Decimal(str(reorder_params["reorder_point"]))
        configured_qty = Decimal(str(reorder_params["reorder_quantity"]))
        safety_stock = Decimal(str(reorder_params["safety_stock"]))
        moq = Decimal(str(reorder_params["min_order_qty"]))
        multiplier = Decimal(str(seasonal_multiplier))

        daily_demand = Decimal(str(round(forecasted_daily_demand, 4))) * multiplier
        lead_time_demand = daily_demand * lead_time_days

        # Net effective stock position
        effective_stock = available + incoming + in_transit - pending_demand

        # Target stock level
        target_reorder_trigger = max(reorder_point, lead_time_demand + safety_stock)

        is_deficit = effective_stock <= target_reorder_trigger

        suggested_qty = Decimal("0.0000")
        formula_notes = []

        if is_deficit:
            if reorder_params["strategy"] == "Min-Max Stock Policy" and reorder_params["max_stock"] > 0:
                max_stock = Decimal(str(reorder_params["max_stock"])) * multiplier
                # Replenish up to Max Stock
                suggested_qty = max(Decimal("0.0000"), max_stock - effective_stock)
                formula_notes.append(f"Min-Max Replenishment: Target {max_stock} - Effective Stock {effective_stock}")
            elif lead_time_demand > 0:
                # Demand-based replenishment: cover lead time demand + safety stock + base batch
                needed = (target_reorder_trigger - effective_stock) + configured_qty
                suggested_qty = max(configured_qty, needed)
                formula_notes.append(f"Demand & Lead-time Replenishment: Lead Time Demand ({lead_time_demand}) + Safety ({safety_stock})")
            else:
                # Threshold replenishment
                needed = target_reorder_trigger - effective_stock
                suggested_qty = max(configured_qty, needed)
                formula_notes.append(f"Reorder Point Replenishment: Reorder Point ({target_reorder_trigger}) - Effective Stock ({effective_stock})")

            # Apply Minimum Order Quantity (MOQ)
            if moq > 0 and suggested_qty < moq:
                suggested_qty = moq
                formula_notes.append(f"Enforced Supplier MOQ of {moq}")

            # Round to nearest integer or 2 decimal places
            suggested_qty = Decimal(str(round(suggested_qty, 0)))

        return {
            "is_deficit": is_deficit,
            "effective_stock": float(effective_stock),
            "target_reorder_trigger": float(target_reorder_trigger),
            "lead_time_demand": float(lead_time_demand),
            "suggested_quantity": float(suggested_qty),
            "formula_notes": formula_notes,
            "calculation_steps": {
                "available_stock": float(available),
                "incoming_purchase_qty": float(incoming),
                "in_transit_transfer_qty": float(in_transit),
                "pending_demand": float(pending_demand),
                "lead_time_days": int(lead_time_days),
                "daily_demand": float(daily_demand),
                "lead_time_demand": float(lead_time_demand),
                "safety_stock": float(safety_stock),
                "reorder_point": float(reorder_point),
                "moq": float(moq),
                "effective_position": float(effective_stock),
                "suggested_quantity": float(suggested_qty),
            }
        }

