from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.valuation.models import InventoryValuation

class InventoryPostingService:
    """
    Core concurrency-safe inventory posting engine.
    Guarantees atomic balance mutations, immutable ledger recording,
    and moving weighted-average valuation.
    """

    @classmethod
    @transaction.atomic
    def post_transaction(cls, transaction_obj: StockTransaction, actor: str = "system") -> StockTransaction:
        if transaction_obj.status == StockTransaction.Status.POSTED:
            raise ValidationError("Transaction has already been posted.")

        lines = list(transaction_obj.lines.select_related("item", "variant", "location").all())
        if not lines:
            raise ValidationError("Transaction must have at least one line.")

        # Sort items to lock in consistent primary key order (eliminating deadlocks)
        lines.sort(key=lambda l: (l.item_id, l.location_id or 0))

        for line in lines:
            if transaction_obj.transaction_type == StockTransaction.TransactionType.RECEIPT:
                cls._process_receipt(transaction_obj, line, actor)
            elif transaction_obj.transaction_type == StockTransaction.TransactionType.ISSUE:
                cls._process_issue(transaction_obj, line, actor)
            elif transaction_obj.transaction_type == StockTransaction.TransactionType.TRANSFER:
                cls._process_transfer(transaction_obj, line, actor)
            elif transaction_obj.transaction_type == StockTransaction.TransactionType.ADJUSTMENT:
                cls._process_adjustment(transaction_obj, line, actor)
            elif transaction_obj.transaction_type == StockTransaction.TransactionType.RETURN:
                cls._process_return(transaction_obj, line, actor)

        transaction_obj.status = StockTransaction.Status.POSTED
        transaction_obj.posted_by = actor
        transaction_obj.posted_at = timezone.now()
        transaction_obj.save(update_fields=["status", "posted_by", "posted_at"])

        # Broadcast decoupled event and audit trail
        cls._emit_transaction_events(transaction_obj, actor)

        return transaction_obj

    @classmethod
    @transaction.atomic
    def dispatch_transfer(cls, tx: StockTransaction, actor: str = "system") -> StockTransaction:
        """
        Dispatch transfer: reduces source warehouse stock and moves quantity into in-transit status.
        """
        if tx.transaction_type != StockTransaction.TransactionType.TRANSFER:
            raise ValidationError("Only TRANSFER transactions can be dispatched.")
        if tx.status not in (StockTransaction.Status.DRAFT, StockTransaction.Status.SUBMITTED):
            raise ValidationError("Transaction must be DRAFT or SUBMITTED to dispatch.")

        lines = list(tx.lines.select_related("item", "variant", "location").all())
        for line in lines:
            qty = abs(line.quantity)
            source_bal = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, line.location)
            if source_bal.available_qty < qty:
                raise ValidationError(f"Insufficient stock at source warehouse {tx.warehouse.code} for dispatch.")
            source_bal.on_hand_qty -= qty
            source_bal.save(update_fields=["on_hand_qty", "updated_at"])

            StockLedgerEntry.objects.create(
                item=line.item,
                variant=line.variant,
                warehouse=tx.warehouse,
                location=line.location,
                movement_type=StockLedgerEntry.MovementType.TRANSFER_OUT,
                quantity_delta=-qty,
                balance_after=source_bal.on_hand_qty,
                unit_cost=line.unit_cost,
                total_value_delta=-(qty * line.unit_cost),
                transaction_ref=tx.document_number,
                reason="Dispatch: In-Transit Stock Movement",
                actor=actor,
            )

        tx.status = StockTransaction.Status.DISPATCHED
        tx.save(update_fields=["status"])
        return tx

    @classmethod
    @transaction.atomic
    def receive_transfer(cls, tx: StockTransaction, actor: str = "system") -> StockTransaction:
        """
        Receive dispatched transfer into destination warehouse.
        """
        if tx.transaction_type != StockTransaction.TransactionType.TRANSFER:
            raise ValidationError("Only TRANSFER transactions can be received.")
        if tx.status != StockTransaction.Status.DISPATCHED:
            raise ValidationError("Transaction must be DISPATCHED before receipt at destination.")
        if not tx.destination_warehouse:
            raise ValidationError("Transfer requires a destination warehouse.")

        lines = list(tx.lines.select_related("item", "variant", "destination_location").all())
        for line in lines:
            qty = abs(line.quantity)
            dest_bal = cls._get_or_create_locked_balance(
                line.item, line.variant, tx.destination_warehouse, line.destination_location
            )
            dest_bal.on_hand_qty += qty
            dest_bal.save(update_fields=["on_hand_qty", "updated_at"])

            StockLedgerEntry.objects.create(
                item=line.item,
                variant=line.variant,
                warehouse=tx.destination_warehouse,
                location=line.destination_location,
                movement_type=StockLedgerEntry.MovementType.TRANSFER_IN,
                quantity_delta=qty,
                balance_after=dest_bal.on_hand_qty,
                unit_cost=line.unit_cost,
                total_value_delta=qty * line.unit_cost,
                transaction_ref=tx.document_number,
                reason="Receipt: Transferred Stock Received",
                actor=actor,
            )

        tx.status = StockTransaction.Status.POSTED
        tx.posted_by = actor
        tx.posted_at = timezone.now()
        tx.save(update_fields=["status", "posted_by", "posted_at"])
        return tx

    @classmethod
    def _emit_transaction_events(cls, tx: StockTransaction, actor: str):
        try:
            from shared_event_bus import publish_event
            publish_event(
                event_name=f"inventory.stock.{tx.transaction_type.lower()}",
                payload={
                    "transaction_id": tx.id,
                    "document_number": tx.document_number,
                    "transaction_type": tx.transaction_type,
                    "warehouse_id": tx.warehouse_id,
                    "line_count": tx.lines.count(),
                    "posted_by": actor,
                    "posted_at": tx.posted_at.isoformat() if tx.posted_at else None,
                },
                context={"warehouse": tx.warehouse.code if tx.warehouse else ""},
            )
        except Exception:
            pass

        try:
            from shared_audit import audit_log
            audit_log(
                action=f"STOCK_POST_{tx.transaction_type}",
                actor=actor,
                entity_type="inventory.StockTransaction",
                entity_id=str(tx.id),
                changes={"status": "POSTED", "document_number": tx.document_number},
            )
        except Exception:
            pass

    @classmethod
    def _get_or_create_locked_balance(cls, item, variant, warehouse, location) -> StockBalance:
        balance, _ = StockBalance.objects.get_or_create(
            item=item,
            variant=variant,
            warehouse=warehouse,
            location=location,
            defaults={
                "on_hand_qty": Decimal("0.0000"),
                "reserved_qty": Decimal("0.0000"),
                "blocked_qty": Decimal("0.0000"),
            },
        )
        return StockBalance.objects.select_for_update().get(pk=balance.pk)

    @classmethod
    def _process_receipt(cls, tx: StockTransaction, line: StockTransactionLine, actor: str):
        if line.quantity <= 0:
            raise ValidationError(f"Receipt quantity for {line.item.code} must be strictly positive.")

        balance = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, line.location)
        balance.on_hand_qty += line.quantity
        balance.save(update_fields=["on_hand_qty", "updated_at"])

        # Recalculate Moving Weighted Average (WAV)
        cls._update_valuation_on_receipt(line.item, tx.warehouse, line.quantity, line.unit_cost)

        # Append immutable ledger record
        StockLedgerEntry.objects.create(
            item=line.item,
            variant=line.variant,
            warehouse=tx.warehouse,
            location=line.location,
            movement_type=StockLedgerEntry.MovementType.RECEIPT,
            quantity_delta=line.quantity,
            balance_after=balance.on_hand_qty,
            unit_cost=line.unit_cost,
            total_value_delta=line.quantity * line.unit_cost,
            transaction_ref=tx.document_number,
            reason=tx.reason or (f"Supplier: {tx.supplier}" if tx.supplier else "Goods Receipt"),
            actor=actor,
        )

    @classmethod
    def _process_issue(cls, tx: StockTransaction, line: StockTransactionLine, actor: str):
        qty_to_issue = abs(line.quantity)
        if qty_to_issue <= 0:
            raise ValidationError(f"Issue quantity for {line.item.code} must be strictly positive.")

        balance = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, line.location)
        if balance.available_qty < qty_to_issue:
            raise ValidationError(
                f"Insufficient available stock for {line.item.code} in {tx.warehouse.code}. "
                f"Requested: {qty_to_issue}, Available: {balance.available_qty} (On-hand: {balance.on_hand_qty}, Reserved: {balance.reserved_qty})"
            )

        balance.on_hand_qty -= qty_to_issue
        balance.save(update_fields=["on_hand_qty", "updated_at"])

        # Lookup valuation cost
        val, _ = InventoryValuation.objects.get_or_create(item=line.item, warehouse=tx.warehouse)
        cost = val.weighted_average_cost if val.weighted_average_cost > 0 else line.unit_cost

        val.total_on_hand = max(Decimal("0.0000"), val.total_on_hand - qty_to_issue)
        val.total_value = val.total_on_hand * val.weighted_average_cost
        val.save(update_fields=["total_on_hand", "total_value"])

        StockLedgerEntry.objects.create(
            item=line.item,
            variant=line.variant,
            warehouse=tx.warehouse,
            location=line.location,
            movement_type=StockLedgerEntry.MovementType.ISSUE,
            quantity_delta=-qty_to_issue,
            balance_after=balance.on_hand_qty,
            unit_cost=cost,
            total_value_delta=-(qty_to_issue * cost),
            transaction_ref=tx.document_number,
            reason=tx.reason or f"Stock Issue: {tx.issue_type}",
            actor=actor,
        )

    @classmethod
    def _process_transfer(cls, tx: StockTransaction, line: StockTransactionLine, actor: str):
        if not tx.destination_warehouse:
            raise ValidationError("Transfers require a destination warehouse.")
        qty = abs(line.quantity)

        # 1. Source Deduction
        source_bal = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, line.location)
        if source_bal.available_qty < qty:
            raise ValidationError(f"Insufficient available stock at source warehouse {tx.warehouse.code}.")
        source_bal.on_hand_qty -= qty
        source_bal.save(update_fields=["on_hand_qty", "updated_at"])

        # 2. Destination Addition
        dest_bal = cls._get_or_create_locked_balance(
            line.item, line.variant, tx.destination_warehouse, line.destination_location
        )
        dest_bal.on_hand_qty += qty
        dest_bal.save(update_fields=["on_hand_qty", "updated_at"])

        # Ledger entries
        StockLedgerEntry.objects.create(
            item=line.item,
            variant=line.variant,
            warehouse=tx.warehouse,
            location=line.location,
            movement_type=StockLedgerEntry.MovementType.TRANSFER_OUT,
            quantity_delta=-qty,
            balance_after=source_bal.on_hand_qty,
            unit_cost=line.unit_cost,
            total_value_delta=-(qty * line.unit_cost),
            transaction_ref=tx.document_number,
            reason=tx.reason or "Inter-Warehouse Transfer Out",
            actor=actor,
        )

        StockLedgerEntry.objects.create(
            item=line.item,
            variant=line.variant,
            warehouse=tx.destination_warehouse,
            location=line.destination_location,
            movement_type=StockLedgerEntry.MovementType.TRANSFER_IN,
            quantity_delta=qty,
            balance_after=dest_bal.on_hand_qty,
            unit_cost=line.unit_cost,
            total_value_delta=qty * line.unit_cost,
            transaction_ref=tx.document_number,
            reason=tx.reason or "Inter-Warehouse Transfer In",
            actor=actor,
        )

    @classmethod
    def _process_adjustment(cls, tx: StockTransaction, line: StockTransactionLine, actor: str):
        delta = line.quantity
        balance = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, line.location)
        if delta < 0 and balance.available_qty < abs(delta):
            raise ValidationError(f"Adjustment cannot reduce stock below zero for {line.item.code}.")

        balance.on_hand_qty += delta
        balance.save(update_fields=["on_hand_qty", "updated_at"])

        StockLedgerEntry.objects.create(
            item=line.item,
            variant=line.variant,
            warehouse=tx.warehouse,
            location=line.location,
            movement_type=StockLedgerEntry.MovementType.ADJUSTMENT,
            quantity_delta=delta,
            balance_after=balance.on_hand_qty,
            unit_cost=line.unit_cost,
            total_value_delta=delta * line.unit_cost,
            transaction_ref=tx.document_number,
            reason=tx.reason or f"Stock Adjustment: {tx.adjustment_type}",
            actor=actor,
        )

    @classmethod
    def _process_return(cls, tx: StockTransaction, line: StockTransactionLine, actor: str):
        qty = abs(line.quantity)
        is_supplier_return = (tx.return_type == "Supplier Return")

        balance = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, line.location)

        if is_supplier_return:
            if balance.available_qty < qty:
                raise ValidationError(f"Insufficient stock for supplier return of {line.item.code}.")
            balance.on_hand_qty -= qty
            balance.save(update_fields=["on_hand_qty", "updated_at"])
            delta = -qty
        else:
            # Customer Return
            if tx.return_disposition == "Quarantine":
                balance.on_hand_qty += qty
                balance.blocked_qty += qty
                balance.save(update_fields=["on_hand_qty", "blocked_qty", "updated_at"])
            else:
                balance.on_hand_qty += qty
                balance.save(update_fields=["on_hand_qty", "updated_at"])
            delta = qty

        StockLedgerEntry.objects.create(
            item=line.item,
            variant=line.variant,
            warehouse=tx.warehouse,
            location=line.location,
            movement_type=StockLedgerEntry.MovementType.RETURN,
            quantity_delta=delta,
            balance_after=balance.on_hand_qty,
            unit_cost=line.unit_cost,
            total_value_delta=delta * line.unit_cost,
            transaction_ref=tx.document_number,
            reason=tx.reason or f"Return: {tx.return_type} ({tx.product_condition})",
            actor=actor,
        )

    @classmethod
    def _update_valuation_on_receipt(cls, item, warehouse, qty: Decimal, unit_cost: Decimal):
        val, _ = InventoryValuation.objects.get_or_create(item=item, warehouse=warehouse)
        q_current = val.total_on_hand
        wav_current = val.weighted_average_cost

        if q_current <= Decimal("0.0000"):
            new_wav = unit_cost
        else:
            new_wav = ((q_current * wav_current) + (qty * unit_cost)) / (q_current + qty)

        val.total_on_hand = q_current + qty
        val.weighted_average_cost = new_wav
        val.total_value = val.total_on_hand * val.weighted_average_cost
        val.save()
