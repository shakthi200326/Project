import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.stock.models import StockBalance, StockLedgerEntry, StockInTransit
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.valuation.models import InventoryValuation
from apps.batches.models import Batch
from apps.serial_numbers.models import SerialNumber
from apps.reservations.models import StockReservation
from apps.configuration.models import InventoryConfiguration
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation

logger = logging.getLogger("ecosystem.inventory.posting")


class InventoryPostingService:
    """
    Core Concurrency-Safe Inventory Stock Posting Engine.
    All stock balance mutations, ledger records, valuation adjustments,
    and event outbox recordings MUST pass through this engine.
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

        # Broadcast decoupled event, outbox record, and audit trail
        cls._emit_transaction_events(transaction_obj, actor)

        return transaction_obj

    @classmethod
    @transaction.atomic
    def dispatch_transfer(cls, tx: StockTransaction, actor: str = "system") -> StockTransaction:
        """
        Dispatch transfer: reduces source warehouse stock, creates a StockInTransit record,
        and moves transaction into DISPATCHED status.
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

            sn = getattr(line, "serial_number", "") or (line.serial_numbers[0] if getattr(line, "serial_numbers", None) else "")
            StockLedgerEntry.objects.create(
                item=line.item,
                variant=line.variant,
                warehouse=tx.warehouse,
                destination_warehouse=tx.destination_warehouse,
                location=line.location,
                movement_type=StockLedgerEntry.MovementType.TRANSFER_OUT,
                quantity_delta=-qty,
                balance_after=source_bal.on_hand_qty,
                unit_cost=line.unit_cost,
                total_value_delta=-(qty * line.unit_cost),
                transaction_ref=tx.document_number,
                reason="Dispatch: In-Transit Stock Movement",
                batch_number=line.batch_number or "",
                serial_number=sn,
                actor=actor,
            )

            # Record first-class stock in transit
            StockInTransit.objects.create(
                transfer_number=tx.document_number,
                item=line.item,
                variant=line.variant,
                source_warehouse=tx.warehouse,
                destination_warehouse=tx.destination_warehouse,
                quantity=qty,
                status=StockInTransit.Status.IN_TRANSIT,
                batch_number=line.batch_number or "",
                serial_numbers=line.serial_numbers if getattr(line, "serial_numbers", None) else [],
                dispatched_at=timezone.now(),
            )

            if getattr(line, "serial_numbers", None):
                SerialNumber.objects.filter(serial_number__in=line.serial_numbers, item=line.item).update(
                    status=SerialNumber.Status.IN_TRANSIT
                )

            # Check low stock at source
            cls._check_low_stock(source_bal)

        tx.status = StockTransaction.Status.DISPATCHED
        tx.save(update_fields=["status"])

        # Record outbox event atomically
        cls._record_outbox_safely(
            event_type="inventory.stock.transfer_dispatched",
            aggregate_type="StockTransaction",
            aggregate_id=str(tx.id),
            payload={
                "document_number": tx.document_number,
                "source_warehouse": tx.warehouse.code,
                "destination_warehouse": tx.destination_warehouse.code if tx.destination_warehouse else "",
                "status": "DISPATCHED",
                "dispatched_by": actor,
            },
            correlation_id=tx.document_number,
        )

        return tx

    @classmethod
    @transaction.atomic
    def receive_transfer(cls, tx: StockTransaction, actor: str = "system") -> StockTransaction:
        """
        Receive dispatched transfer into destination warehouse and close in-transit record.
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

            sn = getattr(line, "serial_number", "") or (line.serial_numbers[0] if getattr(line, "serial_numbers", None) else "")
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
                batch_number=line.batch_number or "",
                serial_number=sn,
                actor=actor,
            )

            # Update transit status
            StockInTransit.objects.filter(
                transfer_number=tx.document_number,
                item=line.item,
                status=StockInTransit.Status.IN_TRANSIT,
            ).update(status=StockInTransit.Status.RECEIVED, received_at=timezone.now())

            if getattr(line, "serial_numbers", None):
                SerialNumber.objects.filter(serial_number__in=line.serial_numbers, item=line.item).update(
                    status=SerialNumber.Status.AVAILABLE,
                    warehouse=tx.destination_warehouse,
                    location=line.destination_location,
                )

        tx.status = StockTransaction.Status.POSTED
        tx.posted_by = actor
        tx.posted_at = timezone.now()
        tx.save(update_fields=["status", "posted_by", "posted_at"])

        cls._record_outbox_safely(
            event_type="inventory.stock.transfer_received",
            aggregate_type="StockTransaction",
            aggregate_id=str(tx.id),
            payload={
                "document_number": tx.document_number,
                "source_warehouse": tx.warehouse.code if tx.warehouse else "",
                "destination_warehouse": tx.destination_warehouse.code,
                "status": "POSTED",
                "received_by": actor,
            },
            correlation_id=tx.document_number,
        )

        return tx

    # =========================================================================
    # SALES INTEGRATION ENGINE (Reservation, Dispatch, Cancellation)
    # =========================================================================

    @classmethod
    @transaction.atomic
    def reserve_sales_stock(
        cls,
        sales_order_id: str,
        lines: List[Dict[str, Any]],
        warehouse_code: Optional[str] = None,
        customer: str = "",
        tenant_id: str = "default-tenant",
        project_id: str = "prj-default",
        correlation_id: str = "",
        actor: str = "integration:sales",
    ) -> Dict[str, Any]:
        """
        Soft-reserves inventory for a confirmed Sales Order without physical deduction.
        Ensures stock availability is locked and guaranteed against double-booking.
        """
        wh = cls._resolve_warehouse(warehouse_code)
        config = InventoryConfiguration.get_solo()
        reserved_items = []

        for line_data in lines:
            item = cls._resolve_item(line_data.get("item_code") or line_data.get("item_id"))
            qty = Decimal(str(line_data.get("quantity") or 0))
            if qty <= Decimal("0.0000"):
                continue

            balance = cls._get_or_create_locked_balance(item, None, wh, None)

            if not config.allow_negative_stock and balance.available_qty < qty:
                raise ValidationError(
                    f"Insufficient stock to reserve {qty} of {item.code} in warehouse {wh.code}. "
                    f"Available: {balance.available_qty}, On-Hand: {balance.on_hand_qty}, Already Reserved: {balance.reserved_qty}"
                )

            balance.reserved_qty += qty
            balance.save(update_fields=["reserved_qty", "updated_at"])

            reservation_ref = f"RES-{sales_order_id}"
            reservation, _ = StockReservation.objects.update_or_create(
                reference_number=sales_order_id,
                item=item,
                warehouse=wh,
                defaults={
                    "reservation_number": reservation_ref,
                    "reference_doc": sales_order_id,
                    "reservation_type": StockReservation.ReservationType.SALES,
                    "quantity": qty,
                    "status": StockReservation.Status.RESERVED,
                    "remarks": f"Sales reservation for customer: {customer}",
                },
            )

            reserved_items.append({
                "item_code": item.code,
                "item_name": item.name,
                "quantity": float(qty),
                "remaining_available": float(balance.available_qty),
            })

            # Record outbox event atomically
            cls._record_outbox_safely(
                event_type="inventory.stock_reserved",
                aggregate_type="StockReservation",
                aggregate_id=f"{sales_order_id}:{item.code}",
                payload={
                    "sales_order_id": sales_order_id,
                    "item_code": item.code,
                    "warehouse_code": wh.code,
                    "reserved_quantity": float(qty),
                    "customer": customer,
                },
                tenant_id=tenant_id,
                project_id=project_id,
                correlation_id=correlation_id or sales_order_id,
            )

        return {
            "status": "RESERVED",
            "sales_order_id": sales_order_id,
            "warehouse": wh.code,
            "items": reserved_items,
        }

    @classmethod
    @transaction.atomic
    def dispatch_sales_stock(
        cls,
        sales_order_id: str,
        lines: List[Dict[str, Any]],
        dispatch_ref: str,
        warehouse_code: Optional[str] = None,
        tenant_id: str = "default-tenant",
        project_id: str = "prj-default",
        correlation_id: str = "",
        actor: str = "integration:sales",
    ) -> Dict[str, Any]:
        """
        Consumes reservation and issues stock for an executed sales fulfillment/dispatch.
        Atomically reduces on-hand and reserved quantity, writes ledger, and raises low-stock check.
        """
        wh = cls._resolve_warehouse(warehouse_code)
        dispatched_items = []

        for line_data in lines:
            item = cls._resolve_item(line_data.get("item_code") or line_data.get("item_id"))
            qty = Decimal(str(line_data.get("quantity") or 0))
            if qty <= Decimal("0.0000"):
                continue

            balance = cls._get_or_create_locked_balance(item, None, wh, None)

            # Reduce on-hand stock
            balance.on_hand_qty -= qty
            # Release corresponding reservation quantity
            balance.reserved_qty = max(Decimal("0.0000"), balance.reserved_qty - qty)
            balance.save(update_fields=["on_hand_qty", "reserved_qty", "updated_at"])

            # Lookup current unit valuation cost
            val, _ = InventoryValuation.objects.get_or_create(item=item, warehouse=wh)
            cost = val.weighted_average_cost if val.weighted_average_cost > Decimal("0.0000") else Decimal("10.0000")

            val.total_on_hand = max(Decimal("0.0000"), val.total_on_hand - qty)
            val.total_value = val.total_on_hand * val.weighted_average_cost
            val.save(update_fields=["total_on_hand", "total_value"])

            # Append immutable stock ledger entry
            StockLedgerEntry.objects.create(
                item=item,
                warehouse=wh,
                movement_type=StockLedgerEntry.MovementType.ISSUE,
                quantity_delta=-qty,
                balance_after=balance.on_hand_qty,
                unit_cost=cost,
                total_value_delta=-(qty * cost),
                transaction_ref=dispatch_ref,
                reason=f"Sales Dispatch: Order {sales_order_id}",
                actor=actor,
            )

            # Update reservation status to fulfilled
            StockReservation.objects.filter(
                reference_number=sales_order_id,
                item=item,
                warehouse=wh,
            ).update(status=StockReservation.Status.FULFILLED)

            dispatched_items.append({
                "item_code": item.code,
                "quantity": float(qty),
                "on_hand_after": float(balance.on_hand_qty),
            })

            # Check low stock threshold
            cls._check_low_stock(balance, tenant_id=tenant_id, project_id=project_id, correlation_id=correlation_id)

            # Record outbox event atomically
            cls._record_outbox_safely(
                event_type="inventory.stock_changed",
                aggregate_type="StockBalance",
                aggregate_id=f"{wh.code}:{item.code}",
                payload={
                    "sales_order_id": sales_order_id,
                    "dispatch_ref": dispatch_ref,
                    "item_code": item.code,
                    "warehouse_code": wh.code,
                    "quantity_deducted": float(qty),
                    "new_on_hand": float(balance.on_hand_qty),
                    "new_available": float(balance.available_qty),
                },
                tenant_id=tenant_id,
                project_id=project_id,
                correlation_id=correlation_id or dispatch_ref,
            )

        return {
            "status": "DISPATCHED",
            "sales_order_id": sales_order_id,
            "dispatch_ref": dispatch_ref,
            "items": dispatched_items,
        }

    @classmethod
    @transaction.atomic
    def release_sales_reservation(
        cls,
        sales_order_id: str,
        lines: Optional[List[Dict[str, Any]]] = None,
        tenant_id: str = "default-tenant",
        project_id: str = "prj-default",
        correlation_id: str = "",
        actor: str = "integration:sales",
    ) -> Dict[str, Any]:
        """
        Releases reserved stock on sales order cancellation back to the available stock pool.
        """
        reservations = list(StockReservation.objects.filter(
            reference_number=sales_order_id,
            status=StockReservation.Status.RESERVED,
        ).select_related("item", "warehouse"))

        released_items = []
        for res in reservations:
            balance = cls._get_or_create_locked_balance(res.item, res.variant, res.warehouse, res.location)
            balance.reserved_qty = max(Decimal("0.0000"), balance.reserved_qty - res.quantity)
            balance.save(update_fields=["reserved_qty", "updated_at"])

            res.status = StockReservation.Status.RELEASED
            res.save(update_fields=["status"])

            released_items.append({
                "item_code": res.item.code,
                "quantity_released": float(res.quantity),
                "available_now": float(balance.available_qty),
            })

            cls._record_outbox_safely(
                event_type="inventory.stock_released",
                aggregate_type="StockReservation",
                aggregate_id=f"{sales_order_id}:{res.item.code}",
                payload={
                    "sales_order_id": sales_order_id,
                    "item_code": res.item.code,
                    "released_quantity": float(res.quantity),
                    "warehouse_code": res.warehouse.code,
                },
                tenant_id=tenant_id,
                project_id=project_id,
                correlation_id=correlation_id or sales_order_id,
            )

        return {
            "status": "RELEASED",
            "sales_order_id": sales_order_id,
            "items": released_items,
        }

    # =========================================================================
    # PURCHASE INTEGRATION ENGINE (Goods Receipt)
    # =========================================================================

    @classmethod
    @transaction.atomic
    def process_purchase_goods_receipt(
        cls,
        purchase_order_id: str,
        grn_number: str,
        lines: List[Dict[str, Any]],
        warehouse_code: Optional[str] = None,
        supplier: str = "",
        tenant_id: str = "default-tenant",
        project_id: str = "prj-default",
        correlation_id: str = "",
        actor: str = "integration:purchase",
    ) -> Dict[str, Any]:
        """
        Processes physical intake of inventory from an external Purchase Order GRN.
        Calculates Moving Weighted Average, records immutable ledger, registers batches/serials,
        and atomically stages inventory.stock_changed outbox event.
        """
        wh = cls._resolve_warehouse(warehouse_code)
        received_items = []

        for line_data in lines:
            item = cls._resolve_item(line_data.get("item_code") or line_data.get("item_id"))
            qty = Decimal(str(line_data.get("quantity") or 0))
            unit_cost = Decimal(str(line_data.get("unit_cost") or 0))
            batch_num = line_data.get("batch_number") or ""
            serial_numbers = line_data.get("serial_numbers") or []

            if qty <= Decimal("0.0000"):
                continue

            balance = cls._get_or_create_locked_balance(item, None, wh, None)
            balance.on_hand_qty += qty
            balance.save(update_fields=["on_hand_qty", "updated_at"])

            # Recalculate moving weighted average cost
            cls._update_valuation_on_receipt(item, wh, qty, unit_cost)

            # Record immutable ledger entry
            sn_str = serial_numbers[0] if serial_numbers else ""
            StockLedgerEntry.objects.create(
                item=item,
                warehouse=wh,
                movement_type=StockLedgerEntry.MovementType.RECEIPT,
                quantity_delta=qty,
                balance_after=balance.on_hand_qty,
                unit_cost=unit_cost,
                total_value_delta=qty * unit_cost,
                transaction_ref=grn_number,
                reason=f"Purchase PO: {purchase_order_id} ({supplier})",
                batch_number=batch_num,
                serial_number=sn_str,
                actor=actor,
            )

            # Handle batch registration
            batch_obj = None
            if batch_num:
                batch_obj, created = Batch.objects.get_or_create(
                    batch_number=batch_num,
                    item=item,
                    defaults={
                        "warehouse": wh,
                        "initial_quantity": qty,
                        "remaining_quantity": qty,
                        "batch_status": Batch.Status.RELEASED,
                        "status": Batch.Status.HEALTHY,
                        "supplier": supplier,
                        "received_date": timezone.now().date(),
                    },
                )
                if not created:
                    batch_obj.remaining_quantity += qty
                    batch_obj.save(update_fields=["remaining_quantity", "updated_at"])

            # Handle serial numbers
            for sn in serial_numbers:
                if str(sn).strip():
                    SerialNumber.objects.update_or_create(
                        serial_number=str(sn).strip(),
                        item=item,
                        defaults={
                            "warehouse": wh,
                            "status": SerialNumber.Status.AVAILABLE,
                            "batch": batch_obj,
                            "received_date": timezone.now().date(),
                        },
                    )

            received_items.append({
                "item_code": item.code,
                "quantity_received": float(qty),
                "unit_cost": float(unit_cost),
                "on_hand_after": float(balance.on_hand_qty),
            })

            # Record outbox event atomically
            cls._record_outbox_safely(
                event_type="inventory.stock_changed",
                aggregate_type="StockBalance",
                aggregate_id=f"{wh.code}:{item.code}",
                payload={
                    "purchase_order_id": purchase_order_id,
                    "grn_number": grn_number,
                    "item_code": item.code,
                    "warehouse_code": wh.code,
                    "quantity_added": float(qty),
                    "unit_cost": float(unit_cost),
                    "new_on_hand": float(balance.on_hand_qty),
                    "new_available": float(balance.available_qty),
                },
                tenant_id=tenant_id,
                project_id=project_id,
                correlation_id=correlation_id or grn_number,
            )

        return {
            "status": "RECEIVED",
            "purchase_order_id": purchase_order_id,
            "grn_number": grn_number,
            "warehouse": wh.code,
            "items": received_items,
        }

    # =========================================================================
    # RECONCILIATION VARIANCE POSTING
    # =========================================================================

    @classmethod
    @transaction.atomic
    def post_audit_variance(
        cls,
        item_code: str,
        warehouse_code: str,
        system_qty: Decimal,
        counted_qty: Decimal,
        variance_reason: str = "Physical Count Reconciliation",
        tenant_id: str = "default-tenant",
        project_id: str = "prj-default",
        actor: str = "system",
    ) -> Dict[str, Any]:
        """
        Posts approved physical count variances atomically.
        """
        item = cls._resolve_item(item_code)
        wh = cls._resolve_warehouse(warehouse_code)
        delta = counted_qty - system_qty

        balance = cls._get_or_create_locked_balance(item, None, wh, None)
        balance.on_hand_qty += delta
        balance.save(update_fields=["on_hand_qty", "updated_at"])

        val, _ = InventoryValuation.objects.get_or_create(item=item, warehouse=wh)
        cost = val.weighted_average_cost

        doc_num = f"VAR-{item.code}-{int(timezone.now().timestamp())}"
        StockLedgerEntry.objects.create(
            item=item,
            warehouse=wh,
            movement_type=StockLedgerEntry.MovementType.ADJUSTMENT,
            quantity_delta=delta,
            balance_after=balance.on_hand_qty,
            unit_cost=cost,
            total_value_delta=delta * cost,
            transaction_ref=doc_num,
            reason=variance_reason,
            actor=actor,
        )

        if delta < Decimal("0.0000"):
            cls._check_low_stock(balance, tenant_id=tenant_id, project_id=project_id)

        cls._record_outbox_safely(
            event_type="inventory.stock_adjusted",
            aggregate_type="StockReconciliation",
            aggregate_id=f"{wh.code}:{item.code}",
            payload={
                "item_code": item.code,
                "warehouse_code": wh.code,
                "system_qty": float(system_qty),
                "counted_qty": float(counted_qty),
                "variance": float(delta),
                "reason": variance_reason,
            },
            tenant_id=tenant_id,
            project_id=project_id,
            correlation_id=doc_num,
        )

        return {
            "status": "POSTED",
            "item_code": item.code,
            "variance": float(delta),
            "new_on_hand": float(balance.on_hand_qty),
        }

    # =========================================================================
    # INTERNAL HELPERS
    # =========================================================================

    @classmethod
    def _resolve_warehouse(cls, warehouse_ref: Optional[Any]) -> Warehouse:
        if warehouse_ref:
            if isinstance(warehouse_ref, Warehouse):
                return warehouse_ref
            wh = Warehouse.objects.filter(code=str(warehouse_ref)).first()
            if not wh and str(warehouse_ref).isdigit():
                wh = Warehouse.objects.filter(pk=int(warehouse_ref)).first()
            if wh:
                return wh

        default_wh = Warehouse.objects.filter(is_active=True).first()
        if not default_wh:
            default_wh = Warehouse.objects.create(code="WH-MAIN", name="Central Distribution Center")
        return default_wh

    @classmethod
    def _resolve_item(cls, item_ref: Any) -> InventoryItem:
        if isinstance(item_ref, InventoryItem):
            return item_ref
        item = InventoryItem.objects.filter(code=str(item_ref)).first()
        if not item and str(item_ref).isdigit():
            item = InventoryItem.objects.filter(pk=int(item_ref)).first()
        if not item:
            raise ValidationError(f"Item not found matching reference: {item_ref}")
        return item

    @classmethod
    def _check_low_stock(cls, balance: StockBalance, tenant_id: str = "default-tenant", project_id: str = "prj-default", correlation_id: str = ""):
        try:
            from apps.integration.services.low_stock_service import LowStockAlertService
            LowStockAlertService.evaluate_and_alert(balance, tenant_id=tenant_id, project_id=project_id, correlation_id=correlation_id)
        except Exception as e:
            logger.warning("Low stock alert evaluation failed: %s", e)

    @classmethod
    def _record_outbox_safely(cls, **kwargs):
        try:
            from apps.integration.services.outbox_service import OutboxService
            OutboxService.record_event(**kwargs)
        except Exception as e:
            logger.error("Failed to record outbox event: %s", e)

    @classmethod
    def _emit_transaction_events(cls, tx: StockTransaction, actor: str):
        # 1. Outbox Event
        cls._record_outbox_safely(
            event_type=f"inventory.stock.{tx.transaction_type.lower()}",
            aggregate_type="StockTransaction",
            aggregate_id=str(tx.id),
            payload={
                "transaction_id": tx.id,
                "document_number": tx.document_number,
                "transaction_type": tx.transaction_type,
                "warehouse_id": tx.warehouse_id,
                "warehouse_code": tx.warehouse.code if tx.warehouse else "",
                "line_count": tx.lines.count(),
                "posted_by": actor,
                "posted_at": tx.posted_at.isoformat() if tx.posted_at else None,
            },
            correlation_id=tx.document_number,
        )

        # 2. Legacy event bus compatibility
        try:
            from shared_event_bus.publisher import EventPublisher
            EventPublisher.publish(
                event_name=f"inventory.stock.{tx.transaction_type.lower()}",
                payload={"document_number": tx.document_number, "status": "POSTED"},
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

        cls._update_valuation_on_receipt(line.item, tx.warehouse, line.quantity, line.unit_cost)

        sn = getattr(line, "serial_number", "") or (line.serial_numbers[0] if getattr(line, "serial_numbers", None) else "")

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
            batch_number=line.batch_number or "",
            serial_number=sn,
            actor=actor,
        )

        batch_obj = None
        if line.batch_number:
            batch_obj, created = Batch.objects.get_or_create(
                batch_number=line.batch_number,
                item=line.item,
                defaults={
                    "warehouse": tx.warehouse,
                    "location": line.location,
                    "initial_quantity": line.quantity,
                    "remaining_quantity": line.quantity,
                    "batch_status": Batch.Status.RELEASED,
                    "status": Batch.Status.HEALTHY,
                    "expiry_date": getattr(line, "expiry_date", None),
                    "supplier": getattr(tx, "supplier", "") or "",
                    "received_date": getattr(tx, "transaction_date", None) or timezone.now().date(),
                },
            )
            if not created:
                batch_obj.remaining_quantity += line.quantity
                batch_obj.save(update_fields=["remaining_quantity", "updated_at"])

        if getattr(line, "serial_numbers", None):
            for s_num in line.serial_numbers:
                if str(s_num).strip():
                    SerialNumber.objects.update_or_create(
                        serial_number=str(s_num).strip(),
                        item=line.item,
                        defaults={
                            "warehouse": tx.warehouse,
                            "location": line.location,
                            "status": SerialNumber.Status.AVAILABLE,
                            "batch": batch_obj,
                            "received_date": getattr(tx, "transaction_date", None) or timezone.now().date(),
                        },
                    )

    @classmethod
    def _process_issue(cls, tx: StockTransaction, line: StockTransactionLine, actor: str):
        qty_to_issue = abs(line.quantity)
        if qty_to_issue <= 0:
            raise ValidationError(f"Issue quantity for {line.item.code} must be strictly positive.")

        config = InventoryConfiguration.get_solo()
        balance = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, line.location)

        if not config.allow_negative_stock and balance.available_qty < qty_to_issue:
            raise ValidationError(
                f"Insufficient available stock for {line.item.code} in {tx.warehouse.code}. "
                f"Requested: {qty_to_issue}, Available: {balance.available_qty} (On-hand: {balance.on_hand_qty}, Reserved: {balance.reserved_qty})"
            )

        if line.batch_number:
            batch_obj = Batch.objects.filter(batch_number=line.batch_number, item=line.item).first()
            if batch_obj:
                if batch_obj.batch_status == Batch.Status.QUARANTINED or batch_obj.status == "QUARANTINED":
                    raise ValidationError(f"Batch {line.batch_number} is quarantined and cannot be issued.")
                if batch_obj.expiry_date and batch_obj.days_remaining <= 0:
                    raise ValidationError(f"Batch {line.batch_number} has expired on {batch_obj.expiry_date} and cannot be issued.")
                batch_obj.remaining_quantity = max(Decimal("0.0000"), batch_obj.remaining_quantity - qty_to_issue)
                batch_obj.save(update_fields=["remaining_quantity", "updated_at"])

        if getattr(line, "serial_numbers", None):
            SerialNumber.objects.filter(serial_number__in=line.serial_numbers, item=line.item).update(
                status=SerialNumber.Status.ISSUED
            )

        balance.on_hand_qty -= qty_to_issue
        balance.save(update_fields=["on_hand_qty", "updated_at"])

        val, _ = InventoryValuation.objects.get_or_create(item=line.item, warehouse=tx.warehouse)
        cost = val.weighted_average_cost if val.weighted_average_cost > 0 else line.unit_cost

        val.total_on_hand = max(Decimal("0.0000"), val.total_on_hand - qty_to_issue)
        val.total_value = val.total_on_hand * val.weighted_average_cost
        val.save(update_fields=["total_on_hand", "total_value"])

        sn = getattr(line, "serial_number", "") or (line.serial_numbers[0] if getattr(line, "serial_numbers", None) else "")

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
            batch_number=line.batch_number or "",
            serial_number=sn,
            actor=actor,
        )

        cls._check_low_stock(balance)

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

        sn = getattr(line, "serial_number", "") or (line.serial_numbers[0] if getattr(line, "serial_numbers", None) else "")

        StockLedgerEntry.objects.create(
            item=line.item,
            variant=line.variant,
            warehouse=tx.warehouse,
            destination_warehouse=tx.destination_warehouse,
            location=line.location,
            movement_type=StockLedgerEntry.MovementType.TRANSFER_OUT,
            quantity_delta=-qty,
            balance_after=source_bal.on_hand_qty,
            unit_cost=line.unit_cost,
            total_value_delta=-(qty * line.unit_cost),
            transaction_ref=tx.document_number,
            reason=tx.reason or "Inter-Warehouse Transfer Out",
            batch_number=line.batch_number or "",
            serial_number=sn,
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
            batch_number=line.batch_number or "",
            serial_number=sn,
            actor=actor,
        )

        cls._check_low_stock(source_bal)

    @classmethod
    def _process_adjustment(cls, tx: StockTransaction, line: StockTransactionLine, actor: str):
        delta = line.quantity
        config = InventoryConfiguration.get_solo()
        balance = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, line.location)

        if not config.allow_negative_stock and delta < 0 and balance.available_qty < abs(delta):
            raise ValidationError(f"Adjustment cannot reduce stock below zero for {line.item.code}.")

        balance.on_hand_qty += delta
        balance.save(update_fields=["on_hand_qty", "updated_at"])

        sn = getattr(line, "serial_number", "") or (line.serial_numbers[0] if getattr(line, "serial_numbers", None) else "")

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
            batch_number=line.batch_number or "",
            serial_number=sn,
            actor=actor,
        )

        if delta < 0:
            cls._check_low_stock(balance)

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
            cls._check_low_stock(balance)
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

        sn = getattr(line, "serial_number", "") or (line.serial_numbers[0] if getattr(line, "serial_numbers", None) else "")

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
            batch_number=line.batch_number or "",
            serial_number=sn,
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
