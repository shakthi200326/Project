from services.uom_service import UOMConversionService
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


class AlreadyPostedError(ValidationError):
    """Raised when posting is retried on a document that is already posted."""


class InventoryPostingService:
    """
    Core Concurrency-Safe Inventory Stock Posting Engine.
    All stock balance mutations, ledger records, valuation adjustments,
    and event outbox recordings MUST pass through this engine.
    """

    @classmethod
    @transaction.atomic
    def post_transaction(
        cls,
        transaction_obj: StockTransaction,
        actor: str = "system",
        receipt_plan: Optional[Dict[int, Dict[str, Any]]] = None,
    ) -> StockTransaction:
        """
        `receipt_plan` (RECEIPT only) maps line id -> {"allocations": [(location, qty)], "serials": [...]}
        in transaction UOM. Lines absent from the plan post their accepted quantity at line.location.
        """
        # Row lock serialises concurrent post attempts; the re-read status is authoritative.
        locked = StockTransaction.objects.select_for_update().get(pk=transaction_obj.pk)
        if locked.status == StockTransaction.Status.POSTED:
            raise AlreadyPostedError(f"{locked.document_number} has already been posted; no stock was changed.")
        if (
            locked.transaction_type == StockTransaction.TransactionType.RECEIPT
            and StockLedgerEntry.objects.filter(
                transaction_ref=locked.document_number, movement_type=StockLedgerEntry.MovementType.RECEIPT
            ).exists()
        ):
            raise ValidationError("Stock has already been received against this document.")
        caller_obj, transaction_obj = transaction_obj, locked

        lines = list(transaction_obj.lines.select_related("item", "variant", "location").all())
        if not lines:
            raise ValidationError("Transaction must have at least one line.")

        # Sort items to lock in consistent primary key order (eliminating deadlocks)
        lines.sort(key=lambda l: (l.item_id, l.location_id or 0))

        for line in lines:
            if transaction_obj.transaction_type == StockTransaction.TransactionType.RECEIPT:
                cls._process_receipt(transaction_obj, line, actor, (receipt_plan or {}).get(line.id))
            elif transaction_obj.transaction_type == StockTransaction.TransactionType.ISSUE:
                cls._process_issue(transaction_obj, line, actor)
            elif transaction_obj.transaction_type == StockTransaction.TransactionType.TRANSFER:
                cls._process_transfer(transaction_obj, line, actor)
            elif transaction_obj.transaction_type == StockTransaction.TransactionType.ADJUSTMENT:
                cls._process_adjustment(transaction_obj, line, actor)
            elif transaction_obj.transaction_type == StockTransaction.TransactionType.RETURN:
                cls._process_return(transaction_obj, line, actor)
            elif transaction_obj.transaction_type == StockTransaction.TransactionType.OPENING:
                cls._process_opening(transaction_obj, line, actor)
            elif transaction_obj.transaction_type == StockTransaction.TransactionType.RECLASSIFICATION:
                cls._process_reclassification(transaction_obj, line, actor)

        transaction_obj.status = StockTransaction.Status.POSTED
        transaction_obj.posted_by = actor
        transaction_obj.posted_at = timezone.now()
        transaction_obj.save(update_fields=["status", "posted_by", "posted_at"])
        caller_obj.status, caller_obj.posted_by, caller_obj.posted_at = (
            transaction_obj.status, transaction_obj.posted_by, transaction_obj.posted_at
        )

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
        if not tx.destination_warehouse:
            raise ValidationError("Transfer requires a destination warehouse.")
        if tx.warehouse_id == tx.destination_warehouse_id:
            raise ValidationError("Source and destination warehouses cannot be the same.")
        if not tx.warehouse.is_active or not tx.destination_warehouse.is_active:
            raise ValidationError("Source and destination warehouses must be active.")
        if not (tx.warehouse.city or "").strip():
            raise ValidationError(f"Source warehouse '{tx.warehouse.name}' does not have a city configured.")
        if not (tx.destination_warehouse.city or "").strip():
            raise ValidationError(f"Destination warehouse '{tx.destination_warehouse.name}' does not have a city configured.")
        if tx.status not in (StockTransaction.Status.DRAFT, StockTransaction.Status.SUBMITTED, StockTransaction.Status.APPROVED):
            raise ValidationError("Transaction must be DRAFT, SUBMITTED, or APPROVED to dispatch.")

        lines = list(tx.lines.select_related("item", "variant", "location").all())
        for line in lines:
            qty = line.dispatched_quantity if (line.dispatched_quantity and line.dispatched_quantity > Decimal("0")) else abs(line.quantity)
            line.dispatched_quantity = qty
            if not line.location and tx.warehouse:
                bal_with_stock = StockBalance.objects.filter(item=line.item, variant=line.variant, warehouse=tx.warehouse, on_hand_qty__gt=0).exclude(location__isnull=True).first()
                line.location = bal_with_stock.location if bal_with_stock else StorageLocation.objects.filter(warehouse=tx.warehouse, is_active=True).first()
                line.save(update_fields=["dispatched_quantity", "location"])
            else:
                line.save(update_fields=["dispatched_quantity"])
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
        tx.dispatched_at = timezone.now()
        tx.dispatched_by = actor
        tx.save(update_fields=["status", "dispatched_at", "dispatched_by"])

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

        from apps.stock.models import DamagedStock
        lines = list(tx.lines.select_related("item", "variant", "destination_location").all())
        for line in lines:
            if not line.destination_location and tx.destination_warehouse:
                line.destination_location = StorageLocation.objects.filter(warehouse=tx.destination_warehouse, is_active=True).first()
                line.save(update_fields=["destination_location"])
            disp_qty = line.dispatched_quantity if (line.dispatched_quantity and line.dispatched_quantity > Decimal("0")) else abs(line.quantity)
            recv_qty = line.received_quantity if (line.received_quantity is not None and line.received_quantity > Decimal("0")) else disp_qty
            shortage_qty = line.shortage_quantity if line.shortage_quantity is not None else Decimal("0.0000")
            damaged_qty = line.damaged_quantity if line.damaged_quantity is not None else Decimal("0.0000")
            line.received_quantity = recv_qty
            line.shortage_quantity = shortage_qty
            line.damaged_quantity = damaged_qty
            line.save(update_fields=["received_quantity", "shortage_quantity", "damaged_quantity"])

            dest_bal = cls._get_or_create_locked_balance(
                line.item, line.variant, tx.destination_warehouse, line.destination_location
            )
            dest_bal.on_hand_qty += recv_qty
            dest_bal.save(update_fields=["on_hand_qty", "updated_at"])

            # If damaged in transit, record DamagedStock record
            if damaged_qty > Decimal("0.0000"):
                DamagedStock.objects.create(
                    item=line.item,
                    variant=line.variant,
                    warehouse=tx.destination_warehouse,
                    location=line.destination_location,
                    damaged_qty=damaged_qty,
                    damage_reason=f"Damaged in transit from {tx.warehouse.code} ({tx.document_number})",
                    batch_number=line.batch_number or "",
                )

            sn = getattr(line, "serial_number", "") or (line.serial_numbers[0] if getattr(line, "serial_numbers", None) else "")
            StockLedgerEntry.objects.create(
                item=line.item,
                variant=line.variant,
                warehouse=tx.destination_warehouse,
                location=line.destination_location,
                movement_type=StockLedgerEntry.MovementType.TRANSFER_IN,
                quantity_delta=recv_qty,
                balance_after=dest_bal.on_hand_qty,
                unit_cost=line.unit_cost,
                total_value_delta=recv_qty * line.unit_cost,
                transaction_ref=tx.document_number,
                reason=f"Transfer Received (Recv: {recv_qty}, Short: {shortage_qty}, Damaged: {damaged_qty})",
                batch_number=line.batch_number or "",
                serial_number=sn,
                actor=actor,
            )

            # Update transit status
            transit_status = (
                StockInTransit.Status.RECEIVED
                if (recv_qty == disp_qty and shortage_qty == Decimal("0.0000") and damaged_qty == Decimal("0.0000"))
                else (StockInTransit.Status.PARTIALLY_RECEIVED if recv_qty > Decimal("0.0000") else StockInTransit.Status.LOST)
            )
            StockInTransit.objects.filter(
                transfer_number=tx.document_number,
                item=line.item,
                status=StockInTransit.Status.IN_TRANSIT,
            ).update(status=transit_status, received_at=timezone.now())

            if getattr(line, "serial_numbers", None):
                SerialNumber.objects.filter(serial_number__in=line.serial_numbers, item=line.item).update(
                    status=SerialNumber.Status.AVAILABLE,
                    warehouse=tx.destination_warehouse,
                    location=line.destination_location,
                )

        tx.status = StockTransaction.Status.POSTED
        tx.posted_by = actor
        tx.posted_at = timezone.now()
        tx.received_by = actor
        tx.received_at = timezone.now()
        tx.save(update_fields=["status", "posted_by", "posted_at", "received_by", "received_at"])

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
        sales_order_id: Any = None,
        lines: Optional[List[Dict[str, Any]]] = None,
        warehouse_code: Optional[str] = None,
        customer: str = "",
        tenant_id: str = "default-tenant",
        project_id: str = "prj-default",
        correlation_id: str = "",
        actor: str = "integration:sales",
        **kwargs,
    ) -> Dict[str, Any]:
        if isinstance(sales_order_id, dict):
            payload = sales_order_id
            sales_order_id = payload.get("sales_order_id") or payload.get("order_id") or "SO-DIRECT"
            lines = payload.get("lines") or []
            warehouse_code = payload.get("warehouse_code") or warehouse_code
            customer = payload.get("customer") or customer
            tenant_id = payload.get("tenant_id") or tenant_id
            project_id = payload.get("project_id") or project_id
            correlation_id = payload.get("correlation_id") or correlation_id
            actor = payload.get("actor") or actor
        """
        Soft-reserves inventory for a confirmed Sales Order without physical deduction.
        Ensures stock availability is locked and guaranteed against double-booking.
        """
        wh = cls._resolve_warehouse(warehouse_code)
        config = InventoryConfiguration.get_solo()
        reserved_items = []

        for line_data in lines:
            item, variant = cls._resolve_item_and_variant(
                line_data.get("item_code") or line_data.get("item_id"),
                line_data.get("variant_sku") or line_data.get("variant_id"),
            )
            raw_qty = Decimal(str(line_data.get("quantity") or 0))
            line_uom = line_data.get("uom") or line_data.get("uom_code") or ""
            if raw_qty <= Decimal("0.0000"):
                continue

            if line_uom:
                qty, _ = UOMConversionService.convert_quantity(item, raw_qty, line_uom)
            else:
                qty = raw_qty

            balance = cls._get_or_create_locked_balance(item, variant, wh, None)

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
        sales_order_id: Any = None,
        lines: Optional[List[Dict[str, Any]]] = None,
        dispatch_ref: Optional[str] = None,
        warehouse_code: Optional[str] = None,
        tenant_id: str = "default-tenant",
        project_id: str = "prj-default",
        correlation_id: str = "",
        actor: str = "integration:sales",
        **kwargs,
    ) -> Dict[str, Any]:
        if isinstance(sales_order_id, dict):
            payload = sales_order_id
            sales_order_id = payload.get("sales_order_id") or payload.get("order_id") or "SO-DIRECT"
            dispatch_ref = payload.get("dispatch_ref") or payload.get("dispatch_note_id") or payload.get("dn_number") or f"DN-{sales_order_id}"
            lines = payload.get("lines") or []
            warehouse_code = payload.get("warehouse_code") or warehouse_code
            tenant_id = payload.get("tenant_id") or tenant_id
            project_id = payload.get("project_id") or project_id
            correlation_id = payload.get("correlation_id") or correlation_id
            actor = payload.get("actor") or actor
        """
        Consumes reservation and issues stock for an executed sales fulfillment/dispatch.
        Atomically reduces on-hand and reserved quantity, writes ledger, and raises low-stock check.
        """
        wh = cls._resolve_warehouse(warehouse_code)
        dispatched_items = []

        for line_data in lines:
            item, variant = cls._resolve_item_and_variant(
                line_data.get("item_code") or line_data.get("item_id"),
                line_data.get("variant_sku") or line_data.get("variant_id"),
            )
            raw_qty = Decimal(str(line_data.get("quantity") or 0))
            line_uom = line_data.get("uom") or line_data.get("uom_code") or ""
            if raw_qty <= Decimal("0.0000"):
                continue

            if line_uom:
                qty, conv_factor = UOMConversionService.convert_quantity(item, raw_qty, line_uom)
            else:
                qty, conv_factor = raw_qty, Decimal("1.000000")

            balance = cls._get_or_create_locked_balance(item, variant, wh, None)

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
                variant=variant,
                warehouse=wh,
                movement_type=StockLedgerEntry.MovementType.ISSUE,
                quantity_delta=-qty,
                balance_after=balance.on_hand_qty,
                unit_cost=cost,
                total_value_delta=-(qty * cost),
                transaction_ref=dispatch_ref,
                reason=f"Sales Dispatch: Order {sales_order_id}",
                transaction_uom=line_uom,
                conversion_factor_at_txn=conv_factor,
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
        purchase_order_id: Any = None,
        grn_number: Optional[str] = None,
        lines: Optional[List[Dict[str, Any]]] = None,
        warehouse_code: Optional[str] = None,
        supplier: str = "",
        tenant_id: str = "default-tenant",
        project_id: str = "prj-default",
        correlation_id: str = "",
        actor: str = "integration:purchase",
        **kwargs,
    ) -> Dict[str, Any]:
        if isinstance(purchase_order_id, dict):
            payload = purchase_order_id
            purchase_order_id = payload.get("purchase_order_id") or payload.get("po_id") or "PO-DIRECT"
            grn_number = payload.get("grn_number") or payload.get("document_number") or f"GRN-{purchase_order_id}"
            lines = payload.get("lines") or []
            warehouse_code = payload.get("warehouse_code") or warehouse_code
            supplier = payload.get("supplier") or supplier
            tenant_id = payload.get("tenant_id") or tenant_id
            project_id = payload.get("project_id") or project_id
            correlation_id = payload.get("correlation_id") or correlation_id
            actor = payload.get("actor") or actor
        elif grn_number is None and isinstance(lines, list):
            grn_number = f"GRN-{purchase_order_id}" 
        """
        Processes physical intake of inventory from an external Purchase Order GRN.
        Calculates Moving Weighted Average, records immutable ledger, registers batches/serials,
        and atomically stages inventory.stock_changed outbox event.
        """
        wh = cls._resolve_warehouse(warehouse_code)
        received_items = []

        for line_data in lines:
            item, variant = cls._resolve_item_and_variant(
                line_data.get("item_code") or line_data.get("item_id"),
                line_data.get("variant_sku") or line_data.get("variant_id"),
            )
            raw_qty = Decimal(str(line_data.get("quantity") or 0))
            unit_cost = Decimal(str(line_data.get("unit_cost") or 0))
            batch_num = line_data.get("batch_number") or ""
            serial_numbers = line_data.get("serial_numbers") or []
            line_uom = line_data.get("uom") or line_data.get("uom_code") or ""

            if raw_qty <= Decimal("0.0000"):
                continue

            # UOM Conversion snapshotting
            if line_uom:
                qty, conv_factor = UOMConversionService.convert_quantity(item, raw_qty, line_uom)
            else:
                qty, conv_factor = raw_qty, Decimal("1.000000")

            balance = cls._get_or_create_locked_balance(item, variant, wh, None)
            balance.on_hand_qty += qty
            balance.save(update_fields=["on_hand_qty", "updated_at"])

            # Recalculate moving weighted average cost
            cls._update_valuation_on_receipt(item, wh, qty, unit_cost)

            # Record immutable ledger entry
            sn_str = serial_numbers[0] if serial_numbers else ""
            StockLedgerEntry.objects.create(
                item=item,
                variant=variant,
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
                transaction_uom=line_uom,
                conversion_factor_at_txn=conv_factor,
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
    def _resolve_item_and_variant(cls, item_ref: Any, variant_ref: Any = None):
        """
        Resolves item and optional variant from code, id, SKU, or barcode.
        Validates item and variant active status.
        """
        item = None
        variant = None

        if isinstance(item_ref, InventoryItem):
            item = item_ref
        elif isinstance(variant_ref, InventoryItemVariant):
            variant = variant_ref
            item = variant.item
        elif variant_ref:
            variant = InventoryItemVariant.objects.filter(sku=str(variant_ref)).first()
            if not variant and str(variant_ref).isdigit():
                variant = InventoryItemVariant.objects.filter(pk=int(variant_ref)).first()
            if variant:
                item = variant.item

        if not item and item_ref:
            # Check by item code or id
            item = InventoryItem.objects.filter(code=str(item_ref)).first()
            if not item and str(item_ref).isdigit():
                item = InventoryItem.objects.filter(pk=int(item_ref)).first()
            # If not found directly, check if item_ref was actually a variant SKU
            if not item:
                v_cand = InventoryItemVariant.objects.filter(sku=str(item_ref)).first()
                if v_cand:
                    variant = v_cand
                    item = variant.item
            # Check by barcode
            if not item:
                from apps.products.models import ProductBarcode
                bc = ProductBarcode.objects.select_related("item", "variant").filter(barcode_value=str(item_ref)).first()
                if bc:
                    item = bc.item
                    variant = bc.variant

        if not item:
            raise ValidationError(f"Item not found matching reference: '{item_ref}'.")

        if not item.is_active or getattr(item, "status", "ACTIVE") in ["DISCONTINUED", "ARCHIVED"]:
            raise ValidationError(f"Item '{item.code}' is inactive or discontinued and unavailable for new transactions.")

        if variant and not variant.is_active:
            raise ValidationError(f"Variant '{variant.sku}' is inactive and unavailable for new transactions.")

        return item, variant

    @classmethod
    def _resolve_item(cls, item_ref: Any) -> InventoryItem:
        item, _ = cls._resolve_item_and_variant(item_ref)
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
    def _process_receipt(cls, tx: StockTransaction, line: StockTransactionLine, actor: str, plan=None):
        if line.quantity <= 0:
            raise ValidationError(f"Receipt quantity for {line.item.code} must be strictly positive.")

        if plan is None:
            # Once a line carries inspection results only the accepted portion is stock;
            # rejected and pending-inspection quantities never reach the balance.
            inspected = (
                line.inspection_status != StockTransactionLine.InspectionStatus.NOT_REQUIRED
                or line.accepted_quantity
                or line.rejected_quantity
            )
            qty = line.accepted_quantity if inspected else line.quantity
            plan = {
                "allocations": [(line.location, qty)] if qty > 0 else [],
                "serials": list(line.serial_numbers or []),
            }

        allocations = [(loc, Decimal(str(q))) for loc, q in plan["allocations"] if Decimal(str(q)) > 0]
        if not allocations:
            return

        factor = line.conversion_factor_at_txn or Decimal("1.000000")
        base_unit_cost = (line.unit_cost / factor).quantize(Decimal("0.0001"))
        total_base = sum(q for _, q in allocations) * factor
        received_on = getattr(tx, "transaction_date", None) or timezone.now().date()

        cls._update_valuation_on_receipt(line.item, tx.warehouse, total_base, base_unit_cost)

        batch_obj = None
        if line.batch_number:
            batch_obj, created = Batch.objects.get_or_create(
                batch_number=line.batch_number,
                item=line.item,
                defaults={
                    "variant": line.variant,
                    "warehouse": tx.warehouse,
                    "location": allocations[0][0],
                    "initial_quantity": total_base,
                    "remaining_quantity": total_base,
                    "batch_status": Batch.Status.RELEASED,
                    "status": Batch.Status.HEALTHY,
                    "manufacturing_date": line.manufacturing_date,
                    "expiry_date": getattr(line, "expiry_date", None),
                    "supplier": getattr(tx, "supplier", "") or "",
                    "received_date": received_on,
                },
            )
            if not created:
                batch_obj.remaining_quantity += total_base
                batch_obj.save(update_fields=["remaining_quantity", "updated_at"])

        # Serials are assigned to allocations in order, one serial per base unit.
        serials = [str(s).strip() for s in plan.get("serials") or [] if str(s).strip()]
        cursor = 0
        for location, qty in allocations:
            base_qty = qty * factor
            balance = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, location)
            balance.on_hand_qty += base_qty
            balance.save(update_fields=["on_hand_qty", "updated_at"])

            alloc_serials = serials[cursor:cursor + int(base_qty)] if serials else []
            cursor += len(alloc_serials)

            StockLedgerEntry.objects.create(
                item=line.item,
                variant=line.variant,
                warehouse=tx.warehouse,
                location=location,
                movement_type=StockLedgerEntry.MovementType.RECEIPT,
                quantity_delta=base_qty,
                balance_after=balance.on_hand_qty,
                unit_cost=base_unit_cost,
                total_value_delta=base_qty * base_unit_cost,
                transaction_ref=tx.document_number,
                reason=tx.reason or (f"Supplier: {tx.supplier}" if tx.supplier else "Goods Receipt"),
                batch_number=line.batch_number or "",
                serial_number=alloc_serials[0] if alloc_serials else "",
                transaction_uom=line.transaction_uom or "",
                conversion_factor_at_txn=factor,
                actor=actor,
            )

            for s_num in alloc_serials:
                SerialNumber.objects.update_or_create(
                    serial_number=s_num,
                    item=line.item,
                    defaults={
                        "variant": line.variant,
                        "warehouse": tx.warehouse,
                        "location": location,
                        "status": SerialNumber.Status.AVAILABLE,
                        "batch": batch_obj,
                        "received_date": received_on,
                        "received_at": timezone.now(),
                    },
                )

    @classmethod
    @transaction.atomic
    def reverse_receipt(cls, tx: StockTransaction, actor: str = "system", reason: str = "") -> StockTransaction:
        """
        Compensates a posted goods receipt: every RECEIPT ledger entry is offset by a
        REVERSAL entry under a new reversal document. The original ledger is untouched.
        """
        tx = StockTransaction.objects.select_for_update().get(pk=tx.pk)
        if tx.transaction_type != StockTransaction.TransactionType.RECEIPT:
            raise ValidationError("Only goods receipts can be reversed here.")
        if tx.status == StockTransaction.Status.REVERSED:
            raise ValidationError("Receipt has already been reversed.")
        if tx.status != StockTransaction.Status.POSTED:
            raise ValidationError("Only posted receipts can be reversed.")

        entries = list(
            StockLedgerEntry.objects.select_related("item", "variant", "location").filter(
                transaction_ref=tx.document_number, movement_type=StockLedgerEntry.MovementType.RECEIPT
            ).order_by("item_id", "location_id", "id")
        )
        config = InventoryConfiguration.get_solo()
        reversal = StockTransaction.objects.create(
            document_number=f"{tx.document_number}-REV",
            transaction_type=StockTransaction.TransactionType.ADJUSTMENT,
            adjustment_type="REVERSAL",
            status=StockTransaction.Status.POSTED,
            warehouse=tx.warehouse,
            reversal_of=tx,
            reference_number=tx.document_number,
            reason=reason or f"Reversal of goods receipt {tx.document_number}",
            created_by=actor,
            posted_by=actor,
            posted_at=timezone.now(),
        )

        for entry in entries:
            qty = entry.quantity_delta
            balance = cls._get_or_create_locked_balance(entry.item, entry.variant, tx.warehouse, entry.location)
            if not config.allow_negative_stock and balance.available_qty < qty:
                raise ValidationError(
                    f"Cannot reverse {tx.document_number}: only {balance.available_qty} of {entry.item.code} "
                    f"is available at {entry.location.code if entry.location else tx.warehouse.code} (needs {qty})."
                )
            balance.on_hand_qty -= qty
            balance.save(update_fields=["on_hand_qty", "updated_at"])

            StockTransactionLine.objects.create(
                transaction=reversal,
                item=entry.item,
                variant=entry.variant,
                location=entry.location,
                quantity=-qty,
                unit_cost=entry.unit_cost,
                batch_number=entry.batch_number,
            )
            StockLedgerEntry.objects.create(
                item=entry.item,
                variant=entry.variant,
                warehouse=tx.warehouse,
                location=entry.location,
                movement_type=StockLedgerEntry.MovementType.REVERSAL,
                quantity_delta=-qty,
                balance_after=balance.on_hand_qty,
                unit_cost=entry.unit_cost,
                total_value_delta=-(qty * entry.unit_cost),
                transaction_ref=reversal.document_number,
                reason=reversal.reason,
                batch_number=entry.batch_number,
                serial_number=entry.serial_number,
                actor=actor,
            )

            val, _ = InventoryValuation.objects.get_or_create(item=entry.item, warehouse=tx.warehouse)
            val.total_on_hand = max(Decimal("0.0000"), val.total_on_hand - qty)
            val.total_value = val.total_on_hand * val.weighted_average_cost
            val.save(update_fields=["total_on_hand", "total_value"])

            if entry.batch_number:
                batch = Batch.objects.select_for_update().filter(batch_number=entry.batch_number, item=entry.item).first()
                if batch:
                    batch.remaining_quantity = max(Decimal("0.0000"), batch.remaining_quantity - qty)
                    batch.save(update_fields=["remaining_quantity", "updated_at"])
            cls._check_low_stock(balance)

        for line in tx.lines.all():
            if line.serial_numbers:
                SerialNumber.objects.filter(serial_number__in=line.serial_numbers, item=line.item).update(
                    status=SerialNumber.Status.RETURNED, location=None
                )

        tx.status = StockTransaction.Status.REVERSED
        tx.save(update_fields=["status", "updated_at"])
        cls._record_outbox_safely(
            event_type="inventory.stock.receipt_reversed",
            aggregate_type="StockTransaction",
            aggregate_id=str(tx.id),
            payload={"document_number": tx.document_number, "reversal_document": reversal.document_number, "reversed_by": actor},
            correlation_id=tx.document_number,
        )
        return tx

    @classmethod
    def _process_issue(cls, tx: StockTransaction, line: StockTransactionLine, actor: str):
        qty_to_issue = abs(line.quantity)
        if qty_to_issue <= 0:
            raise ValidationError(f"Issue quantity for {line.item.code} must be strictly positive.")

        config = InventoryConfiguration.get_solo()
        balance = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, line.location)

        # Handle reservation consumption if line is tied to a reservation
        if getattr(line, "reservation", None):
            res = line.reservation
            if res.item_id != line.item_id or res.warehouse_id != tx.warehouse_id:
                raise ValidationError("Selected reservation does not match the item and warehouse.")
            if res.status not in (StockReservation.Status.RESERVED, StockReservation.Status.PARTIALLY_FULFILLED):
                raise ValidationError(f"Reservation {res.reservation_number} is {res.status} and cannot be consumed.")
            if res.remaining_quantity < qty_to_issue:
                raise ValidationError(
                    f"Reservation {res.reservation_number} only has {res.remaining_quantity} remaining, cannot issue {qty_to_issue}."
                )
            res.released_quantity += qty_to_issue
            if res.remaining_quantity <= Decimal("0.0000"):
                res.status = StockReservation.Status.FULFILLED
            else:
                res.status = StockReservation.Status.PARTIALLY_FULFILLED
            res.save(update_fields=["released_quantity", "status", "updated_at"])

            # Decrement reserved quantity from balance
            balance.reserved_qty = max(Decimal("0.0000"), balance.reserved_qty - qty_to_issue)
        else:
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
        balance.save(update_fields=["on_hand_qty", "reserved_qty", "updated_at"])

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
        if not tx.destination_warehouse or tx.warehouse == tx.destination_warehouse:
            raise ValidationError("Inter-warehouse transfer requires different source and destination warehouses.")
        dest_warehouse = tx.destination_warehouse

        qty = abs(line.quantity)

        # 1. Source Deduction
        source_bal = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, line.location)
        if source_bal.available_qty < qty:
            raise ValidationError(f"Insufficient available stock at source warehouse {tx.warehouse.code}.")
        source_bal.on_hand_qty -= qty
        source_bal.save(update_fields=["on_hand_qty", "updated_at"])

        # 2. Destination Addition
        dest_bal = cls._get_or_create_locked_balance(
            line.item, line.variant, dest_warehouse, line.destination_location
        )
        dest_bal.on_hand_qty += qty
        dest_bal.save(update_fields=["on_hand_qty", "updated_at"])

        sn = getattr(line, "serial_number", "") or (line.serial_numbers[0] if getattr(line, "serial_numbers", None) else "")

        StockLedgerEntry.objects.create(
            item=line.item,
            variant=line.variant,
            warehouse=tx.warehouse,
            destination_warehouse=dest_warehouse,
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
            warehouse=dest_warehouse,
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
    def _process_opening(cls, tx: StockTransaction, line: StockTransactionLine, actor: str):
        qty = abs(line.quantity)
        if qty <= Decimal("0.0000"):
            raise ValidationError(f"Opening stock quantity for {line.item.code} must be strictly positive.")

        # Prevent duplicate opening balance posting for same item, warehouse and location scope
        existing = StockLedgerEntry.objects.filter(
            item=line.item,
            variant=line.variant,
            warehouse=tx.warehouse,
            location=line.location,
            movement_type=StockLedgerEntry.MovementType.RECEIPT,
            reason__icontains="Opening Stock",
        ).exclude(transaction_ref=tx.document_number).exists()

        if existing:
            raise ValidationError(
                f"Opening stock has already been posted for item {line.item.code} in warehouse {tx.warehouse.code}."
            )

        balance = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, line.location)
        balance.on_hand_qty += qty
        balance.save(update_fields=["on_hand_qty", "updated_at"])

        cls._update_valuation_on_receipt(line.item, tx.warehouse, qty, line.unit_cost)

        batch_obj = None
        if line.batch_number:
            batch_obj, created = Batch.objects.get_or_create(
                batch_number=line.batch_number,
                item=line.item,
                defaults={
                    "variant": line.variant,
                    "warehouse": tx.warehouse,
                    "location": line.location,
                    "initial_quantity": qty,
                    "remaining_quantity": qty,
                    "batch_status": Batch.Status.RELEASED,
                    "status": Batch.Status.HEALTHY,
                    "received_date": tx.transaction_date,
                },
            )
            if not created:
                batch_obj.remaining_quantity += qty
                batch_obj.save(update_fields=["remaining_quantity", "updated_at"])

        serials = [str(s).strip() for s in getattr(line, "serial_numbers", []) or [] if str(s).strip()]
        if serials:
            dupes = SerialNumber.objects.filter(serial_number__in=serials, item=line.item).values_list("serial_number", flat=True)
            if dupes:
                raise ValidationError(f"Duplicate serial numbers detected: {list(dupes)}")

            for s_num in serials:
                SerialNumber.objects.create(
                    serial_number=s_num,
                    item=line.item,
                    variant=line.variant,
                    warehouse=tx.warehouse,
                    location=line.location,
                    status=SerialNumber.Status.AVAILABLE,
                    batch=batch_obj,
                    received_date=tx.transaction_date,
                    received_at=timezone.now(),
                )

        StockLedgerEntry.objects.create(
            item=line.item,
            variant=line.variant,
            warehouse=tx.warehouse,
            location=line.location,
            movement_type=StockLedgerEntry.MovementType.RECEIPT,
            quantity_delta=qty,
            balance_after=balance.on_hand_qty,
            unit_cost=line.unit_cost,
            total_value_delta=qty * line.unit_cost,
            transaction_ref=tx.document_number,
            reason=f"Opening Stock: {tx.reason}" if tx.reason else "Opening Stock Balance",
            batch_number=line.batch_number or "",
            serial_number=serials[0] if serials else "",
            actor=actor,
        )

    @classmethod
    def _process_reclassification(cls, tx: StockTransaction, line: StockTransactionLine, actor: str):
        """
        Moves quantity between stock-status buckets. On-hand never changes for a pure
        reclassification; when the target location differs, the stock moves with a
        balanced TRANSFER_OUT / TRANSFER_IN pair inside the warehouse.
        """
        from apps.stock.models import DamagedStock
        from services import stock_reclassification as rules

        source_loc = line.location
        target_loc = line.destination_location if line.destination_location_id else None
        moving = target_loc is not None and target_loc.id != (source_loc.id if source_loc else None)

        # Lock both balances in a stable order to avoid deadlocks with concurrent postings.
        keys = [source_loc] + ([target_loc] if moving else [])
        locked = {}
        for loc in sorted(keys, key=lambda l: l.id if l else 0):
            locked[loc.id if loc else None] = cls._get_or_create_locked_balance(line.item, line.variant, tx.warehouse, loc)
        src = locked[source_loc.id if source_loc else None]
        dst = locked[target_loc.id] if moving else src

        clean = rules.validate_line(
            warehouse=tx.warehouse, item=line.item, variant=line.variant,
            source_location=source_loc, target_location=target_loc if moving else None,
            from_status=line.from_status, to_status=line.to_status, quantity=abs(line.quantity),
            batch_number=line.batch_number, serial_numbers=line.serial_numbers,
            effective_date=tx.transaction_date, balance=src,
        )
        qty, from_status, to_status = clean["quantity"], clean["from_status"], clean["to_status"]
        on_hand_before = src.on_hand_qty + (dst.on_hand_qty if moving else Decimal("0"))

        if from_status != "AVAILABLE":
            field = rules.BUCKET_FIELD[from_status]
            setattr(src, field, getattr(src, field) - qty)
        if moving:
            src.on_hand_qty -= qty
            dst.on_hand_qty += qty
        if to_status != "AVAILABLE":
            field = rules.BUCKET_FIELD[to_status]
            setattr(dst, field, getattr(dst, field) + qty)
        src.save()
        if moving:
            dst.save()
        if src.on_hand_qty + (dst.on_hand_qty if moving else Decimal("0")) != on_hand_before:
            raise ValidationError("Reclassification must not change total on-hand quantity.")

        reason = tx.reason or f"Stock Reclassification: {from_status} -> {to_status}"
        common = dict(
            item=line.item, variant=line.variant, warehouse=tx.warehouse, unit_cost=line.unit_cost,
            transaction_ref=tx.document_number, batch_number=clean["batch_number"],
            serial_number=clean["serial_numbers"][0] if clean["serial_numbers"] else "",
            actor=actor, from_status=from_status, to_status=to_status, status_quantity=qty,
        )
        if moving:
            StockLedgerEntry.objects.create(
                location=source_loc, destination_warehouse=tx.warehouse,
                movement_type=StockLedgerEntry.MovementType.TRANSFER_OUT, quantity_delta=-qty,
                balance_after=src.on_hand_qty, total_value_delta=-(qty * line.unit_cost),
                reason=f"{reason} (moved to {target_loc.code})", **common,
            )
            StockLedgerEntry.objects.create(
                location=target_loc, movement_type=StockLedgerEntry.MovementType.TRANSFER_IN, quantity_delta=qty,
                balance_after=dst.on_hand_qty, total_value_delta=qty * line.unit_cost,
                reason=f"{reason} (moved from {source_loc.code if source_loc else tx.warehouse.code})", **common,
            )
        else:
            StockLedgerEntry.objects.create(
                location=source_loc, movement_type=StockLedgerEntry.MovementType.RECLASSIFICATION,
                quantity_delta=Decimal("0.0000"), balance_after=src.on_hand_qty,
                total_value_delta=Decimal("0.0000"), reason=reason, **common,
            )

        if to_status == "DAMAGED":
            # Already segregated in the damaged bucket; the Damaged Stock module handles write-off.
            DamagedStock.objects.create(
                item=line.item, variant=line.variant, warehouse=tx.warehouse, location=dst.location,
                damaged_qty=qty, damage_reason=reason[:255], batch_number=clean["batch_number"],
                status=DamagedStock.Status.QUARANTINED, remarks=f"Created by reclassification {tx.document_number}",
            )

        batch = clean["batch"]
        if batch is not None:
            batch = Batch.objects.select_for_update().get(pk=batch.pk)
            if qty >= batch.remaining_quantity:
                # Only a whole-batch move changes the batch's own status/location.
                batch.batch_status = rules.BATCH_TARGET_STATUS[to_status]
                if moving:
                    batch.location = target_loc
                batch.save(update_fields=["batch_status", "location", "updated_at"])
        if clean["serial_numbers"]:
            updates = {"status": rules.SERIAL_STATUS[to_status]}
            if moving:
                updates["location"] = target_loc
            SerialNumber.objects.filter(
                serial_number__in=clean["serial_numbers"], item=line.item, warehouse=tx.warehouse
            ).update(**updates)

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
