"""
Stock Operations Service Layer.

Orchestrates all 12 Stock Operations workflows in accordance with CLAUDE CODE MASTER PROMPT 02:
1. Stock In (Inward transactions register)
2. Stock Issue (Draft -> Submit -> Approve -> Post)
3. Stock Transfer (Inter-warehouse transfer engine)
4. Inter-Warehouse Transfer (Enforcing distinct warehouses)
6. Stock Adjustment (Backend-derived system qty and variance, approval thresholds)
7. Stock Return (Return In & Return Out, inspection disposition)
8. Opening Stock (Duplicate scope protection, valuation setup)
9. Stock Reservation (Available stock check, priority, expiry)
10. Stock Release (Active validation, positive qty, over-release protection)
11. Stock Reclassification (Permitted stock status transitions, audit history)
12. Stock Out (Outward transactions register)

All stock-affecting operations post strictly via InventoryPostingService.
"""
from decimal import Decimal
from typing import Any, Dict, List, Optional
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.movements.models import StockTransaction, StockTransactionLine
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry, StockInTransit, DamagedStock
from apps.reservations.models import StockReservation
from apps.configuration.models import DocumentNumberingRule, InventoryConfiguration
from services.posting_service import AlreadyPostedError, InventoryPostingService
from services.stock_operations_config import StockOperationsConfigService, Submodule
from services import stock_reclassification as reclass_rules
from apps.valuation.models import InventoryValuation


class StockOperationsService:
    """
    Unified, authoritative business service for Stock Operations.
    """

    @classmethod
    @transaction.atomic
    def save_draft(
        cls,
        tx_type: str,
        data: Dict[str, Any],
        actor: str = "system",
        can_manual_number: bool = False,
    ) -> StockTransaction:
        """
        Creates or updates a draft StockTransaction with lines.
        Backend assigns document number if not provided or manual numbering disallowed.
        """
        submodule_map = {
            StockTransaction.TransactionType.ISSUE: Submodule.STOCK_ISSUE,
            StockTransaction.TransactionType.TRANSFER: Submodule.STOCK_TRANSFER,
            StockTransaction.TransactionType.ADJUSTMENT: Submodule.STOCK_ADJUSTMENT,
            StockTransaction.TransactionType.RETURN: Submodule.STOCK_RETURN,
            StockTransaction.TransactionType.OPENING: Submodule.OPENING_STOCK,
            StockTransaction.TransactionType.RECLASSIFICATION: Submodule.STOCK_RECLASSIFICATION,
        }
        submodule = submodule_map.get(tx_type, Submodule.STOCK_ISSUE)
        cfg = StockOperationsConfigService.get(submodule)

        if not cfg.get("enabled", True):
            raise ValidationError(f"Submodule '{submodule}' is disabled in configuration.")

        # Document number generation
        doc_num = (data.get("document_number") or "").strip()
        doc_type_name = cfg.get("document_type", "Stock Issue")

        if not doc_num or not (cfg.get("allow_manual_number") and can_manual_number):
            doc_num = DocumentNumberingRule.generate_next_number(doc_type_name)

        wh_id = data.get("warehouse") or data.get("warehouse_id") or data.get("source_warehouse") or data.get("source_warehouse_id")
        wh = Warehouse.objects.filter(id=wh_id).first() if str(wh_id).isdigit() else Warehouse.objects.filter(code=str(wh_id)).first()
        if not wh:
            if tx_type == StockTransaction.TransactionType.TRANSFER:
                raise ValidationError({"warehouse": "Select a valid source warehouse."})
            wh = Warehouse.objects.filter(is_active=True).first()
            if not wh:
                raise ValidationError({"warehouse": "No active warehouse is available."})

        dest_wh = None
        dest_wh_id = data.get("destination_warehouse") or data.get("destination_warehouse_id")
        if dest_wh_id:
            dest_wh = (
                Warehouse.objects.filter(id=dest_wh_id).first()
                if str(dest_wh_id).isdigit()
                else Warehouse.objects.filter(code=str(dest_wh_id)).first()
            )

        transfer_scope = ""
        transfer_type = StockTransaction.TransferType.INTER_WAREHOUSE if tx_type == StockTransaction.TransactionType.TRANSFER else data.get("transfer_type", "")
        if tx_type == StockTransaction.TransactionType.TRANSFER:
            if not dest_wh:
                raise ValidationError("A destination warehouse is required for stock transfer.")
            if not wh.is_active or not dest_wh.is_active:
                raise ValidationError("Source and destination warehouses must be active.")
            if wh.id == dest_wh.id:
                raise ValidationError("Source and destination warehouses cannot be the same.")
            if not (wh.city or "").strip():
                raise ValidationError(f"Source warehouse '{wh.name}' does not have a city configured.")
            if not (dest_wh.city or "").strip():
                raise ValidationError(f"Destination warehouse '{dest_wh.name}' does not have a city configured.")
            src_city = (wh.city or "").strip().lower()
            dst_city = (dest_wh.city or "").strip().lower()
            transfer_scope = (
                StockTransaction.TransferScope.SAME_CITY
                if src_city == dst_city
                else StockTransaction.TransferScope.INTER_CITY
            )
            transfer_type = StockTransaction.TransferType.INTER_WAREHOUSE

        tx = StockTransaction.objects.create(
            document_number=doc_num,
            transaction_type=tx_type,
            status=StockTransaction.Status.DRAFT,
            transaction_date=data.get("transaction_date") or timezone.localdate(),
            warehouse=wh,
            destination_warehouse=dest_wh,
            transfer_type=transfer_type,
            transfer_scope=transfer_scope,
            expected_arrival_date=data.get("expected_arrival_date") or data.get("expected_date"),
            issue_type=data.get("issue_type", ""),
            issued_to=data.get("issued_to", ""),
            party_name=data.get("party_name", ""),
            return_type=data.get("return_type", ""),
            product_condition=data.get("product_condition", ""),
            return_disposition=data.get("return_disposition", ""),
            adjustment_type=data.get("adjustment_type", ""),
            reason=data.get("reason", ""),
            reference_number=data.get("reference_number", ""),
            notes=data.get("notes", ""),
            created_by=actor,
            requested_by=data.get("requested_by", actor),
        )

        lines_data = data.get("lines", [])
        if tx_type == StockTransaction.TransactionType.TRANSFER and not lines_data:
            raise ValidationError("Stock transfer requires at least one product item.")
        seen_transfer_items = set()
        for line in lines_data:
            item_ref = line.get("item") or line.get("item_id") or line.get("item_code")
            item, variant = cls._resolve_item_variant(item_ref, line.get("variant"))

            loc = cls._resolve_location(wh, line.get("location") or line.get("location_id"))
            if not loc and wh:
                bal_with_stock = StockBalance.objects.filter(item=item, warehouse=wh, on_hand_qty__gt=0).exclude(location__isnull=True).first()
                loc = bal_with_stock.location if bal_with_stock else StorageLocation.objects.filter(warehouse=wh, is_active=True).first()
            dest_loc = cls._resolve_location(dest_wh or wh, line.get("destination_location") or line.get("destination_location_id"))
            if not dest_loc and dest_wh:
                dest_loc = StorageLocation.objects.filter(warehouse=dest_wh, is_active=True).first()

            qty = Decimal(str(line.get("quantity", 1)))
            if tx_type == StockTransaction.TransactionType.TRANSFER:
                if qty <= Decimal("0"):
                    raise ValidationError({"lines": "Transfer quantity must be greater than zero."})
                item_key = (item.id, variant.id if variant else None)
                if item_key in seen_transfer_items:
                    raise ValidationError({"lines": "Duplicate product/variant rows are not allowed."})
                seen_transfer_items.add(item_key)
                balances = StockBalance.objects.filter(item=item, warehouse=wh)
                if variant:
                    balances = balances.filter(variant=variant)
                avail = sum((b.available_qty for b in balances), Decimal("0"))
                if not cfg.get("allow_negative_stock", False) and avail < qty:
                    raise ValidationError({"lines": f"Transfer quantity ({qty}) exceeds available stock ({avail}) for {item.name}."})
            unit_cost = Decimal(str(line.get("unit_cost", 0)))
            batch_num = line.get("batch_number", "") or ""
            serials = line.get("serial_numbers") or []
            if not serials and line.get("serial_number"):
                serials = [str(line.get("serial_number"))]

            res_obj = None
            res_id = line.get("reservation") or line.get("reservation_id")
            if res_id:
                res_obj = StockReservation.objects.filter(id=res_id).first() if str(res_id).isdigit() else StockReservation.objects.filter(reservation_number=str(res_id)).first()

            # For adjustments: system_quantity is backend-derived from balance
            sys_qty = Decimal("0.0000")
            act_qty = Decimal("0.0000")
            diff_qty = Decimal("0.0000")
            if tx_type == StockTransaction.TransactionType.ADJUSTMENT:
                bal = StockBalance.objects.filter(item=item, warehouse=wh, location=loc).first()
                sys_qty = bal.on_hand_qty if bal else Decimal("0.0000")
                if "actual_quantity" in line:
                    act_qty = Decimal(str(line.get("actual_quantity")))
                    diff_qty = act_qty - sys_qty
                    qty = diff_qty
                else:
                    diff_qty = qty
                    act_qty = sys_qty + diff_qty

            StockTransactionLine.objects.create(
                transaction=tx,
                item=item,
                variant=variant,
                location=loc,
                destination_location=dest_loc,
                quantity=qty,
                unit_cost=unit_cost,
                batch_number=batch_num,
                expiry_date=line.get("expiry_date") or None,
                serial_numbers=serials,
                system_quantity=sys_qty,
                actual_quantity=act_qty,
                difference_quantity=diff_qty,
                from_status=line.get("from_status", "") or "",
                to_status=line.get("to_status", "") or "",
                reservation=res_obj,
                description=line.get("description", "") or "",
            )

        return tx

    @classmethod
    @transaction.atomic
    def submit(cls, tx: StockTransaction, actor: str = "system") -> StockTransaction:
        """Submits transaction into SUBMITTED status; performs backend stock validations."""
        if tx.status != StockTransaction.Status.DRAFT:
            raise ValidationError(f"Transaction {tx.document_number} is already {tx.status}.")

        # Enforce validations
        submodule = cls._get_submodule_for_tx(tx)
        cfg = StockOperationsConfigService.get(submodule)

        if tx.transaction_type == StockTransaction.TransactionType.RECLASSIFICATION:
            # Stock may have moved since the draft was saved.
            cls._validate_reclassification_lines(tx)

        # Pre-validate stock availability for OUTBOUND operations
        if tx.transaction_type in (StockTransaction.TransactionType.ISSUE, StockTransaction.TransactionType.TRANSFER):
            for line in tx.lines.select_related("item", "variant", "location").all():
                qty = abs(line.quantity)
                bals = StockBalance.objects.filter(item=line.item, warehouse=tx.warehouse)
                if line.location:
                    bals = bals.filter(location=line.location)
                if line.variant:
                    bals = bals.filter(variant=line.variant)
                avail = sum((b.available_qty for b in bals), Decimal("0.0000"))
                if not getattr(line, "reservation", None) and not cfg.get("allow_negative_stock", False) and avail < qty:
                    raise ValidationError(
                        f"Insufficient available stock to submit {tx.document_number}. Item {line.item.code} needs {qty}, available is {avail}."
                    )

        tx.status = StockTransaction.Status.SUBMITTED
        tx.submitted_by = actor
        tx.submitted_at = timezone.now()
        tx.save(update_fields=["status", "submitted_by", "submitted_at"])
        return tx

    @classmethod
    @transaction.atomic
    def approve(cls, tx: StockTransaction, actor: str = "system") -> StockTransaction:
        """Approves a submitted transaction."""
        if tx.transaction_type == StockTransaction.TransactionType.RECLASSIFICATION:
            tx = StockTransaction.objects.select_for_update().get(pk=tx.pk)
            if tx.status != StockTransaction.Status.SUBMITTED:
                raise ValidationError(f"Only submitted reclassifications can be approved; {tx.document_number} is {tx.get_status_display()}.")
        if tx.status not in (StockTransaction.Status.SUBMITTED, StockTransaction.Status.DRAFT):
            raise ValidationError(f"Transaction {tx.document_number} cannot be approved in {tx.status} status.")

        tx.status = StockTransaction.Status.APPROVED
        tx.approved_by = actor
        tx.approved_at = timezone.now()
        tx.save(update_fields=["status", "approved_by", "approved_at"])
        return tx

    @classmethod
    @transaction.atomic
    def post(cls, tx: StockTransaction, actor: str = "system") -> StockTransaction:
        """Executes atomic ledger posting and balance mutation via central InventoryPostingService."""
        submodule = cls._get_submodule_for_tx(tx)
        cfg = StockOperationsConfigService.get(submodule)

        if tx.transaction_type == StockTransaction.TransactionType.RECLASSIFICATION:
            tx = StockTransaction.objects.select_for_update().get(pk=tx.pk)
            if tx.status == StockTransaction.Status.POSTED:
                raise AlreadyPostedError(f"{tx.document_number} has already been posted; no stock was changed.")
            if tx.status not in (StockTransaction.Status.SUBMITTED, StockTransaction.Status.APPROVED):
                raise ValidationError(f"Submit {tx.document_number} before posting (current status: {tx.get_status_display()}).")

        # Enforce approval rule if configured
        if cfg.get("approval_required", False) and tx.status != StockTransaction.Status.APPROVED:
            # Special check: for adjustments, only enforce if over threshold amount
            if tx.transaction_type == StockTransaction.TransactionType.ADJUSTMENT:
                threshold = Decimal(str(cfg.get("approval_threshold_amount", 500.0)))
                total_val = sum(abs(l.quantity * l.unit_cost) for l in tx.lines.all())
                if total_val >= threshold and tx.status != StockTransaction.Status.APPROVED:
                    raise ValidationError(f"Stock adjustment value (${total_val}) exceeds approval threshold (${threshold}). Approval required.")
            else:
                raise ValidationError(f"Approval is required before posting {tx.document_number}.")

        return InventoryPostingService.post_transaction(tx, actor=actor)

    @classmethod
    @transaction.atomic
    def dispatch_transfer(cls, tx: StockTransaction, actor: str = "system") -> StockTransaction:
        return InventoryPostingService.dispatch_transfer(tx, actor=actor)

    @classmethod
    @transaction.atomic
    def receive_transfer(cls, tx: StockTransaction, actor: str = "system") -> StockTransaction:
        return InventoryPostingService.receive_transfer(tx, actor=actor)

    @classmethod
    @transaction.atomic
    def complete(cls, tx: StockTransaction, actor: str = "system") -> StockTransaction:
        tx = StockTransaction.objects.select_for_update().get(pk=tx.pk)
        if tx.status not in (StockTransaction.Status.RECEIVED, StockTransaction.Status.POSTED):
            raise ValidationError(f"Transaction {tx.document_number} must be RECEIVED before completing (current status: {tx.status}).")
        tx.status = StockTransaction.Status.COMPLETED
        tx.save(update_fields=["status", "updated_at"])
        InventoryPostingService._record_outbox_safely(
            event_type="stock_transfer.completed",
            aggregate_type="StockTransaction",
            aggregate_id=str(tx.id),
            payload={
                "document_number": tx.document_number,
                "status": "COMPLETED",
                "completed_by": actor,
            },
            correlation_id=tx.document_number,
        )
        return tx

    @classmethod
    @transaction.atomic
    def update_draft_transfer(cls, tx: StockTransaction, data: Dict[str, Any], actor: str = "system") -> StockTransaction:
        if tx.status != StockTransaction.Status.DRAFT:
            raise ValidationError(f"Only draft transfers can be edited; {tx.document_number} is {tx.status}.")
        wh_id = data.get("warehouse") or data.get("source_warehouse") or data.get("warehouse_id")
        if wh_id:
            wh = Warehouse.objects.filter(id=wh_id).first() if str(wh_id).isdigit() else Warehouse.objects.filter(code=str(wh_id)).first()
            if not wh or not wh.is_active:
                raise ValidationError({"warehouse": "Select an active source warehouse."})
            tx.warehouse = wh

        dest_wh_id = data.get("destination_warehouse") or data.get("destination_warehouse_id")
        if dest_wh_id:
            dest_wh = Warehouse.objects.filter(id=dest_wh_id).first() if str(dest_wh_id).isdigit() else Warehouse.objects.filter(code=str(dest_wh_id)).first()
            if not dest_wh or not dest_wh.is_active:
                raise ValidationError({"destination_warehouse": "Select an active destination warehouse."})
            tx.destination_warehouse = dest_wh

        if tx.warehouse_id == tx.destination_warehouse_id:
            raise ValidationError("Source and destination warehouses cannot be the same.")
        src_city = (tx.warehouse.city or "").strip()
        dst_city = (tx.destination_warehouse.city or "").strip()
        if not src_city:
            raise ValidationError(f"Source warehouse '{tx.warehouse.name}' does not have a city configured.")
        if not dst_city:
            raise ValidationError(f"Destination warehouse '{tx.destination_warehouse.name}' does not have a city configured.")
        tx.transfer_scope = (
            StockTransaction.TransferScope.SAME_CITY
            if src_city.lower() == dst_city.lower()
            else StockTransaction.TransferScope.INTER_CITY
        )
        if "reason" in data:
            tx.reason = data.get("reason", "")
        if "notes" in data or "remarks" in data:
            tx.notes = data.get("notes") or data.get("remarks", "")
        if "expected_arrival_date" in data:
            tx.expected_arrival_date = data.get("expected_arrival_date") or None

        lines_data = data.get("lines")
        if lines_data is not None:
            if not lines_data:
                raise ValidationError("Stock transfer requires at least one product item.")
            tx.lines.all().delete()
            seen_items = set()
            cfg = StockOperationsConfigService.get(Submodule.STOCK_TRANSFER)
            for line in lines_data:
                item_ref = line.get("item") or line.get("item_id") or line.get("item_code")
                item, variant = cls._resolve_item_variant(item_ref, line.get("variant"))
                loc = cls._resolve_location(tx.warehouse, line.get("location") or line.get("location_id"))
                dest_loc = cls._resolve_location(tx.destination_warehouse, line.get("destination_location") or line.get("destination_location_id"))
                qty = Decimal(str(line.get("quantity", 1)))
                if qty <= Decimal("0"):
                    raise ValidationError({"lines": "Transfer quantity must be greater than zero."})
                item_key = (item.id, variant.id if variant else None)
                if item_key in seen_items:
                    raise ValidationError({"lines": "Duplicate product/variant rows are not allowed."})
                seen_items.add(item_key)

                balances = StockBalance.objects.filter(item=item, warehouse=tx.warehouse)
                if variant:
                    balances = balances.filter(variant=variant)
                avail = sum((b.available_qty for b in balances), Decimal("0"))
                if not cfg.get("allow_negative_stock", False) and avail < qty:
                    raise ValidationError({"lines": f"Transfer quantity ({qty}) exceeds available stock ({avail}) for {item.name}."})

                StockTransactionLine.objects.create(
                    transaction=tx,
                    item=item,
                    variant=variant,
                    location=loc,
                    destination_location=dest_loc,
                    quantity=qty,
                    unit_cost=Decimal(str(line.get("unit_cost", 0))),
                    batch_number=line.get("batch_number", "") or "",
                    expiry_date=line.get("expiry_date") or None,
                    serial_numbers=line.get("serial_numbers") or [],
                    transaction_uom=line.get("transaction_uom") or line.get("uom") or (item.base_unit.code if hasattr(item.base_unit, "code") else str(item.base_unit)) if item.base_unit else "Nos",
                    description=line.get("description", "") or "",
                )
        tx.save()
        return tx

    @classmethod
    @transaction.atomic
    def cancel(cls, tx: StockTransaction, actor: str = "system", reason: str = "") -> StockTransaction:
        tx = StockTransaction.objects.select_for_update().get(pk=tx.pk)
        if tx.status in (StockTransaction.Status.POSTED, StockTransaction.Status.DISPATCHED):
            raise ValidationError(f"Cannot cancel transfer {tx.document_number} in {tx.status} status.")
        tx.status = StockTransaction.Status.CANCELLED
        if reason:
            tx.notes = (f"{tx.notes}\n" if tx.notes else "") + f"Cancelled by {actor}: {reason}"
        tx.save(update_fields=["status", "notes", "updated_at"])
        InventoryPostingService._record_outbox_safely(
            event_type="stock_transfer.cancelled",
            aggregate_type="StockTransaction",
            aggregate_id=str(tx.id),
            payload={
                "document_number": tx.document_number,
                "status": "CANCELLED",
                "cancelled_by": actor,
                "reason": reason,
            },
            correlation_id=tx.document_number,
        )
        return tx

    @classmethod
    @transaction.atomic
    def reject(cls, tx: StockTransaction, actor: str, reason: str) -> StockTransaction:
        """Approver rejection of a submitted reclassification (terminal)."""
        tx = StockTransaction.objects.select_for_update().get(pk=tx.pk)
        if tx.status != StockTransaction.Status.SUBMITTED:
            raise ValidationError(f"Only submitted documents can be rejected; {tx.document_number} is {tx.get_status_display()}.")
        if not reason:
            raise ValidationError({"reason": "A rejection reason is required."})
        tx.status = StockTransaction.Status.REJECTED
        tx.notes = (f"{tx.notes}\n" if tx.notes else "") + f"Rejected by {actor}: {reason}"
        tx.save(update_fields=["status", "notes", "updated_at"])
        return tx

    @classmethod
    @transaction.atomic
    def save_reclassification_draft(
        cls, data: Dict[str, Any], actor: str = "system", idempotency_key: str = ""
    ) -> StockTransaction:
        """
        Strictly validated reclassification draft. Unlike the generic save_draft, nothing
        is defaulted silently: unknown warehouses, items or locations are errors.
        """
        cfg = reclass_rules.config()
        if not cfg.get("enabled", True):
            raise ValidationError("Stock Reclassification is disabled in configuration.")
        if idempotency_key:
            existing = StockTransaction.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                return existing

        wh_ref = str(data.get("warehouse") or "")
        wh = Warehouse.objects.filter(pk=wh_ref).first() if wh_ref.isdigit() else None
        if wh is None:
            raise ValidationError({"warehouse": "Select a valid warehouse."})
        effective = parse_date(str(data.get("transaction_date") or "")) if data.get("transaction_date") else timezone.localdate()
        if effective is None:
            raise ValidationError({"transaction_date": "Enter a valid effective date (YYYY-MM-DD)."})
        reason = str(data.get("reason") or "").strip()
        if cfg.get("require_reason", True) and not reason:
            raise ValidationError({"reason": "A business reason is required."})
        lines = data.get("lines") or []
        if not isinstance(lines, list) or not lines:
            raise ValidationError({"lines": "Add a reclassification line."})

        cleaned, errors = [], {}
        for idx, raw in enumerate(lines):
            try:
                cleaned.append(cls._clean_reclassification_line(wh, raw, effective))
            except ValidationError as exc:
                detail = exc.message_dict if hasattr(exc, "error_dict") else {"line": exc.messages}
                errors.update({f"lines[{idx}].{k}": v[0] for k, v in detail.items()})
        if errors:
            raise ValidationError(errors)

        tx = StockTransaction.objects.create(
            document_number=DocumentNumberingRule.generate_next_number(cfg.get("document_type", "Stock Reclassification")),
            transaction_type=StockTransaction.TransactionType.RECLASSIFICATION,
            status=StockTransaction.Status.DRAFT,
            transaction_date=effective,
            warehouse=wh,
            reason=reason[:2000],
            reference_number=str(data.get("reference_number") or "").strip()[:100],
            notes=str(data.get("notes") or ""),
            created_by=actor,
            requested_by=actor,
            idempotency_key=idempotency_key or None,
        )
        for row in cleaned:
            StockTransactionLine.objects.create(transaction=tx, **row)
        return tx

    @classmethod
    def _clean_reclassification_line(cls, wh: Warehouse, raw: Dict[str, Any], effective) -> Dict[str, Any]:
        item_ref = str(raw.get("item") or "")
        item = InventoryItem.objects.filter(pk=item_ref).first() if item_ref.isdigit() else None
        if item is None:
            raise ValidationError({"item": "Select a valid item."})
        variant = None
        if raw.get("variant"):
            variant = InventoryItemVariant.objects.filter(pk=raw.get("variant")).first()
            if variant is None:
                raise ValidationError({"variant": "Variant not found."})

        def location(key):
            ref = str(raw.get(key) or "")
            if not ref:
                return None
            loc = StorageLocation.objects.filter(pk=ref).first() if ref.isdigit() else None
            if loc is None:
                raise ValidationError({key: "Location not found."})
            return loc

        source, target = location("location"), location("destination_location")
        clean = reclass_rules.validate_line(
            warehouse=wh, item=item, variant=variant, source_location=source, target_location=target,
            from_status=raw.get("from_status"), to_status=raw.get("to_status"), quantity=raw.get("quantity"),
            batch_number=raw.get("batch_number") or "", serial_numbers=raw.get("serial_numbers") or [],
            effective_date=effective,
        )
        valuation = InventoryValuation.objects.filter(item=item, warehouse=wh).first()
        return {
            "item": item,
            "variant": variant,
            "location": source,
            "destination_location": target,
            "quantity": clean["quantity"],
            "unit_cost": valuation.weighted_average_cost if valuation else Decimal("0.0000"),
            "from_status": clean["from_status"],
            "to_status": clean["to_status"],
            "batch_number": clean["batch_number"],
            "serial_numbers": clean["serial_numbers"],
            "transaction_uom": reclass_rules.uom_rules(item)["code"],
            "quantity_base_uom": clean["quantity"],
        }

    @classmethod
    def _validate_reclassification_lines(cls, tx: StockTransaction):
        errors = {}
        lines = tx.lines.select_related("item", "variant", "location", "destination_location").order_by("id")
        for idx, line in enumerate(lines):
            try:
                reclass_rules.validate_line(
                    warehouse=tx.warehouse, item=line.item, variant=line.variant, source_location=line.location,
                    target_location=line.destination_location, from_status=line.from_status, to_status=line.to_status,
                    quantity=abs(line.quantity), batch_number=line.batch_number, serial_numbers=line.serial_numbers,
                    effective_date=tx.transaction_date,
                )
            except ValidationError as exc:
                detail = exc.message_dict if hasattr(exc, "error_dict") else {"line": exc.messages}
                errors.update({f"lines[{idx}].{k}": v[0] for k, v in detail.items()})
        if errors:
            raise ValidationError(errors)

    @classmethod
    @transaction.atomic
    def create_reservation(cls, payload: Dict[str, Any], actor: str = "system") -> StockReservation:
        """Creates and locks a StockReservation against available inventory."""
        cfg = StockOperationsConfigService.get(Submodule.STOCK_RESERVATION)
        if not cfg.get("enabled", True):
            raise ValidationError("Stock Reservation submodule is disabled.")

        item_ref = payload.get("item") or payload.get("item_id") or payload.get("item_code")
        item, variant = cls._resolve_item_variant(item_ref, payload.get("variant"))

        wh_id = payload.get("warehouse") or payload.get("warehouse_id")
        wh = Warehouse.objects.filter(id=wh_id).first() if str(wh_id).isdigit() else Warehouse.objects.filter(code=str(wh_id)).first()
        if not wh:
            wh = Warehouse.objects.filter(is_active=True).first()

        loc = cls._resolve_location(wh, payload.get("location"))
        qty = Decimal(str(payload.get("quantity") or payload.get("reservation_quantity") or 1))

        if qty <= Decimal("0.0000"):
            raise ValidationError("Reservation quantity must be strictly positive.")

        # Check available stock
        bal, _ = StockBalance.objects.get_or_create(
            item=item, variant=variant, warehouse=wh, location=loc,
            defaults={"on_hand_qty": Decimal("0.0000"), "reserved_qty": Decimal("0.0000"), "blocked_qty": Decimal("0.0000")}
        )
        locked_bal = StockBalance.objects.select_for_update().get(pk=bal.pk)

        if not cfg.get("allow_over_reservation", False) and locked_bal.available_qty < qty:
            raise ValidationError(
                f"Cannot reserve {qty} of {item.code}: only {locked_bal.available_qty} available in {wh.code} (On-hand: {locked_bal.on_hand_qty}, Reserved: {locked_bal.reserved_qty})."
            )

        doc_num = (payload.get("reservation_number") or "").strip()
        if not doc_num or not cfg.get("allow_manual_number", False):
            doc_num = DocumentNumberingRule.generate_next_number("Stock Reservation")

        # Mutate reserved quantity on balance atomically
        locked_bal.reserved_qty += qty
        locked_bal.save(update_fields=["reserved_qty", "updated_at"])

        res = StockReservation.objects.create(
            reservation_number=doc_num,
            reference_number=payload.get("reference_number", ""),
            reference_doc=doc_num,
            reservation_date=payload.get("reservation_date") or timezone.localdate(),
            reservation_type=payload.get("reservation_type", StockReservation.ReservationType.SALES),
            priority=payload.get("priority", "NORMAL"),
            reserved_by=actor,
            item=item,
            variant=variant,
            warehouse=wh,
            location=loc,
            quantity=qty,
            status=StockReservation.Status.RESERVED,
            remarks=payload.get("remarks", ""),
            expires_at=payload.get("expires_at"),
        )
        return res

    @classmethod
    @transaction.atomic
    def release_reservation(cls, res_id: Any, release_qty: Optional[Decimal] = None, reason: str = "", actor: str = "system") -> StockReservation:
        """Releases all or part of an active StockReservation back to the available pool."""
        cfg = StockOperationsConfigService.get(Submodule.STOCK_RELEASE)
        res = (
            StockReservation.objects.select_for_update().filter(id=res_id).first()
            if str(res_id).isdigit()
            else StockReservation.objects.select_for_update().filter(reservation_number=str(res_id)).first()
        )
        if not res:
            raise ValidationError(f"Reservation '{res_id}' not found.")

        if res.status not in (StockReservation.Status.RESERVED, StockReservation.Status.PARTIALLY_FULFILLED):
            raise ValidationError(f"Reservation {res.reservation_number} is {res.status} and cannot be released.")

        rem = res.remaining_quantity
        if release_qty is None:
            release_qty = rem
        else:
            release_qty = Decimal(str(release_qty))

        if release_qty <= Decimal("0.0000"):
            raise ValidationError("Release quantity must be strictly positive.")

        if cfg.get("prevent_over_release", True) and release_qty > rem:
            raise ValidationError(f"Cannot release {release_qty}; remaining reserved quantity is only {rem}.")

        res.released_quantity += release_qty
        if res.remaining_quantity <= Decimal("0.0000"):
            res.status = StockReservation.Status.RELEASED
        res.save(update_fields=["released_quantity", "status", "updated_at"])

        # Decrement reserved quantity from balance
        bal = StockBalance.objects.select_for_update().filter(
            item=res.item, variant=res.variant, warehouse=res.warehouse, location=res.location
        ).first()
        if bal:
            bal.reserved_qty = max(Decimal("0.0000"), bal.reserved_qty - release_qty)
            bal.save(update_fields=["reserved_qty", "updated_at"])

        return res

    @classmethod
    def get_inward_records(cls, filters: Optional[Dict[str, Any]] = None):
        """
        Stock In Register query: retrieves eligible inward stock ledger records:
        - RECEIPT (Goods Receipt, Opening Stock)
        - TRANSFER_IN (Transfer In)
        - RETURN (Customer Return In)
        - Positive ADJUSTMENT
        """
        qs = StockLedgerEntry.objects.select_related("item", "variant", "warehouse", "location").filter(
            quantity_delta__gt=0
        )
        if filters:
            if filters.get("warehouse"):
                qs = qs.filter(warehouse_id=filters["warehouse"])
            if filters.get("item"):
                qs = qs.filter(item_id=filters["item"])
            if filters.get("search"):
                term = filters["search"]
                qs = qs.filter(
                    transaction_ref__icontains=term
                ) | qs.filter(
                    item__name__icontains=term
                ) | qs.filter(
                    item__code__icontains=term
                )
        return qs.order_by("-created_at")

    @classmethod
    def get_outward_records(cls, filters: Optional[Dict[str, Any]] = None):
        """
        Stock Out Register query: retrieves eligible outward stock ledger records:
        - ISSUE (Sales, Production, Internal Consumption)
        - TRANSFER_OUT (Transfer Dispatch)
        - RETURN (Supplier Return Out)
        - Negative ADJUSTMENT
        """
        qs = StockLedgerEntry.objects.select_related("item", "variant", "warehouse", "location").filter(
            quantity_delta__lt=0
        )
        if filters:
            if filters.get("warehouse"):
                qs = qs.filter(warehouse_id=filters["warehouse"])
            if filters.get("item"):
                qs = qs.filter(item_id=filters["item"])
            if filters.get("search"):
                term = filters["search"]
                qs = qs.filter(
                    transaction_ref__icontains=term
                ) | qs.filter(
                    item__name__icontains=term
                ) | qs.filter(
                    item__code__icontains=term
                )
        return qs.order_by("-created_at")

    # --- Helpers ---
    @classmethod
    def _get_submodule_for_tx(cls, tx: StockTransaction) -> str:
        mapping = {
            StockTransaction.TransactionType.ISSUE: Submodule.STOCK_ISSUE,
            StockTransaction.TransactionType.TRANSFER: (
                Submodule.INTER_WAREHOUSE
            ),
            StockTransaction.TransactionType.ADJUSTMENT: Submodule.STOCK_ADJUSTMENT,
            StockTransaction.TransactionType.RETURN: Submodule.STOCK_RETURN,
            StockTransaction.TransactionType.OPENING: Submodule.OPENING_STOCK,
            StockTransaction.TransactionType.RECLASSIFICATION: Submodule.STOCK_RECLASSIFICATION,
        }
        return mapping.get(tx.transaction_type, Submodule.STOCK_ISSUE)

    @classmethod
    def _resolve_item_variant(cls, item_ref: Any, variant_ref: Any = None):
        item = None
        variant = None
        if isinstance(item_ref, InventoryItem):
            item = item_ref
        elif item_ref:
            item = InventoryItem.objects.filter(id=item_ref).first() if str(item_ref).isdigit() else InventoryItem.objects.filter(code=str(item_ref)).first()
            if not item:
                item = InventoryItem.objects.filter(name=str(item_ref)).first()

        if variant_ref:
            if isinstance(variant_ref, InventoryItemVariant):
                variant = variant_ref
            else:
                variant = InventoryItemVariant.objects.filter(id=variant_ref).first() if str(variant_ref).isdigit() else InventoryItemVariant.objects.filter(sku=str(variant_ref)).first()

        if not item:
            raise ValidationError(f"Item '{item_ref}' not found.")
        return item, variant

    @classmethod
    def _resolve_location(cls, warehouse: Warehouse, loc_ref: Any) -> Optional[StorageLocation]:
        if not loc_ref:
            return None
        if isinstance(loc_ref, StorageLocation):
            return loc_ref
        loc = (
            StorageLocation.objects.filter(id=loc_ref, warehouse=warehouse).first()
            if str(loc_ref).isdigit()
            else StorageLocation.objects.filter(code=str(loc_ref), warehouse=warehouse).first()
        )
        if not loc:
            loc = StorageLocation.objects.filter(id=loc_ref).first() if str(loc_ref).isdigit() else StorageLocation.objects.filter(code=str(loc_ref)).first()
        return loc
