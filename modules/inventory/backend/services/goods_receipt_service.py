"""
Goods Receipt & Inspection workflow engine.

A goods receipt is a StockTransaction of type RECEIPT. This service owns its
state machine and business rules; every stock mutation is delegated to
InventoryPostingService, which remains the only writer of balances and ledger.

Quantities on a receipt line are held in the line's transaction UOM:
    quantity (received) = accepted + rejected + pending_inspection
and posting converts accepted quantities to base UOM.
"""
import logging
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.batches.models import Batch
from apps.configuration.models import DocumentNumberingRule, InventoryConfiguration
from apps.goods_receipt.models import ReceiptDiscrepancy, ReceiptInspection, ReceiptPutaway
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.serial_numbers.models import SerialNumber
from apps.warehouses.models import StorageLocation, Warehouse
from services.goods_receipt_config import GoodsReceiptConfigService, Submodule
from services.posting_service import AlreadyPostedError, InventoryPostingService
from services.uom_service import UOMConversionService

logger = logging.getLogger("ecosystem.inventory.goods_receipt")

S = StockTransaction.Status
LineInspection = StockTransactionLine.InspectionStatus
LinePutaway = StockTransactionLine.PutawayStatus
ZERO = Decimal("0.0000")
ATTACHMENT_OWNER = "inventory.goods_receipt"

# Allowed header transitions. Preconditions (approval, inspection, putaway policy)
# are enforced by the action methods; this table rejects structurally invalid moves.
TRANSITIONS = {
    S.DRAFT: {S.SUBMITTED, S.CANCELLED},
    S.SUBMITTED: {S.DRAFT, S.APPROVED, S.UNDER_INSPECTION, S.ACCEPTED, S.PARTIALLY_ACCEPTED, S.REJECTED,
                  S.PUTAWAY_PENDING, S.READY_TO_POST, S.POSTED, S.CANCELLED},
    S.APPROVED: {S.UNDER_INSPECTION, S.ACCEPTED, S.PARTIALLY_ACCEPTED, S.REJECTED,
                 S.PUTAWAY_PENDING, S.READY_TO_POST, S.POSTED, S.CANCELLED},
    S.UNDER_INSPECTION: {S.ACCEPTED, S.PARTIALLY_ACCEPTED, S.REJECTED},
    S.ACCEPTED: {S.PUTAWAY_PENDING, S.READY_TO_POST, S.POSTED},
    S.PARTIALLY_ACCEPTED: {S.PUTAWAY_PENDING, S.READY_TO_POST, S.POSTED},
    # Back-transitions exist because a putaway can be cancelled before posting.
    S.PUTAWAY_PENDING: {S.SUBMITTED, S.APPROVED, S.ACCEPTED, S.PARTIALLY_ACCEPTED, S.READY_TO_POST, S.POSTED},
    S.READY_TO_POST: {S.SUBMITTED, S.APPROVED, S.PUTAWAY_PENDING, S.ACCEPTED, S.PARTIALLY_ACCEPTED, S.POSTED},
    S.POSTED: {S.REVERSED},
}
INSPECTABLE = {S.SUBMITTED, S.APPROVED, S.UNDER_INSPECTION}
PUTAWAY_OPEN = {S.SUBMITTED, S.APPROVED, S.ACCEPTED, S.PARTIALLY_ACCEPTED, S.PUTAWAY_PENDING, S.READY_TO_POST}
POSTABLE = PUTAWAY_OPEN
CANCELLABLE = {S.DRAFT, S.SUBMITTED, S.APPROVED}
CLOSED = {S.POSTED, S.REVERSED, S.CANCELLED, S.REJECTED}
OPEN_RECEIPT_EXCLUDED = (S.POSTED, S.REVERSED, S.CANCELLED, S.REJECTED)
ACTIVE_SERIAL_STATUSES = (
    SerialNumber.Status.AVAILABLE, SerialNumber.Status.RESERVED, SerialNumber.Status.IN_TRANSIT,
    SerialNumber.Status.QUARANTINED, SerialNumber.Status.IN_STOCK,
)
EVENT_SUBMODULE = {
    "submitted": Submodule.CREATE,
    "approved": Submodule.CREATE,
    "posted": Submodule.CREATE,
    "reversed": Submodule.CREATE,
    "inspection_completed": Submodule.INSPECTION,
    "quality_failed": Submodule.QUALITY,
    "putaway_completed": Submodule.PUTAWAY,
    "discrepancy_raised": Submodule.DISCREPANCY,
}


def _dec(value, field: str, allow_none: bool = False) -> Optional[Decimal]:
    if value in (None, ""):
        if allow_none:
            return None
        raise ValidationError({field: "This field is required."})
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValidationError({field: "Must be a number."})
    if not result.is_finite():
        raise ValidationError({field: "Must be a finite number."})
    if result.as_tuple().exponent < -4:
        raise ValidationError({field: "At most 4 decimal places are allowed."})
    return result


def _date(value, field: str) -> Optional[date]:
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    parsed = parse_date(str(value))
    if not parsed:
        raise ValidationError({field: "Enter a valid date (YYYY-MM-DD)."})
    return parsed


def _pk(value, field: str) -> Optional[int]:
    if value in (None, ""):
        return None
    if isinstance(value, dict):
        value = value.get("id")
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError({field: "Must be a record id."})


class GoodsReceiptService:
    # ------------------------------------------------------------------ helpers
    @staticmethod
    def cfg(submodule: str) -> Dict[str, Any]:
        return GoodsReceiptConfigService.get(submodule)

    @classmethod
    def inspection_enforced(cls) -> Optional[bool]:
        """True = always required, False = never, None = user's choice per receipt."""
        quality = cls.cfg(Submodule.QUALITY)
        if quality["enabled"] and quality["quality_inspection_required"]:
            return True
        insp = cls.cfg(Submodule.INSPECTION)
        if not insp["enabled"] or insp["inspection_mode"] == "DISABLED":
            return False
        if insp["inspection_mode"] == "MANDATORY":
            return True
        return None

    @classmethod
    def quality_required(cls) -> bool:
        quality = cls.cfg(Submodule.QUALITY)
        return bool(quality["enabled"] and quality["quality_inspection_required"])

    @classmethod
    def putaway_mandatory(cls) -> bool:
        putaway = cls.cfg(Submodule.PUTAWAY)
        return bool(putaway["enabled"] and putaway["putaway_mandatory"])

    @staticmethod
    def _next_number(document_type: str, model, field: str) -> str:
        # The numbering engine is row-locked; the loop only guards against a
        # sequence that was reset onto numbers already in use.
        for _ in range(50):
            number = DocumentNumberingRule.generate_next_number(document_type)
            if not model.objects.filter(**{field: number}).exists():
                return number
        raise ValidationError(f"Could not allocate a unique {document_type} number; check the numbering rule.")

    @staticmethod
    def _transition(tx: StockTransaction, new_status: str):
        if tx.status == new_status:
            return
        if new_status not in TRANSITIONS.get(tx.status, set()):
            raise ValidationError(
                f"Receipt {tx.document_number} cannot move from {tx.get_status_display()} to "
                f"{S(new_status).label}."
            )
        tx.status = new_status

    @staticmethod
    def _lock(tx: StockTransaction) -> StockTransaction:
        locked = StockTransaction.objects.select_for_update().get(pk=tx.pk)
        if locked.transaction_type != StockTransaction.TransactionType.RECEIPT:
            raise ValidationError("Document is not a goods receipt.")
        return locked

    @classmethod
    def _require_processing_allowed(cls, tx: StockTransaction):
        if tx.status == S.SUBMITTED and cls.cfg(Submodule.CREATE)["approval_required"] and not tx.approved_at:
            raise ValidationError(f"Receipt {tx.document_number} is awaiting approval.")

    @staticmethod
    def _line_of(tx: StockTransaction, line_id) -> StockTransactionLine:
        line = (
            StockTransactionLine.objects.select_for_update(of=("self",))
            .select_related("item", "variant", "location")
            .filter(pk=_pk(line_id, "line"), transaction=tx)
            .first()
        )
        if not line:
            raise ValidationError({"line": "Line does not belong to this receipt."})
        return line

    @classmethod
    def notify(cls, event: str, tx: StockTransaction, payload: Optional[Dict[str, Any]] = None):
        settings = cls.cfg(EVENT_SUBMODULE[event])["notifications"]
        if not settings.get("enabled") or event not in settings.get("events", []):
            return
        InventoryPostingService._record_outbox_safely(
            event_type=f"inventory.goods_receipt.{event}",
            aggregate_type="GoodsReceipt",
            aggregate_id=str(tx.id),
            payload={
                "document_number": tx.document_number,
                "status": tx.status,
                "warehouse_code": tx.warehouse.code if tx.warehouse_id else "",
                "recipients": settings.get("recipients", []),
                **(payload or {}),
            },
            correlation_id=tx.document_number,
        )

    # --------------------------------------------------------- tracking rules
    @staticmethod
    def tracking_flags(item: InventoryItem) -> Dict[str, bool]:
        global_cfg = InventoryConfiguration.get_solo()
        create = GoodsReceiptConfigService.get(Submodule.CREATE)
        batch = item.tracks_batches
        serial = item.tracks_serials
        return {
            "batch": bool(batch and global_cfg.enable_batch_tracking and create["enforce_batch_tracking"]),
            "serial": bool(serial and global_cfg.enable_serial_tracking and create["enforce_serial_tracking"]),
            "expiry": bool(
                item.expiry_tracking_required and global_cfg.enable_expiry_tracking and create["enforce_expiry_tracking"]
            ),
        }

    @staticmethod
    def resolve_uom(item: InventoryItem, uom_code: str) -> Tuple[str, Decimal]:
        base_code = item.base_uom.code if item.base_uom_id else (item.base_unit or "EA")
        code = (uom_code or "").strip() or base_code
        if code.upper() == base_code.upper():
            return base_code, Decimal("1.000000")
        try:
            _, factor = UOMConversionService.convert_quantity(item, Decimal("1"), code)
        except ValidationError:
            raise ValidationError({"uom": f"UOM '{code}' is not valid for item {item.code}."})
        return code.upper(), factor

    # ------------------------------------------------------- header validation
    @classmethod
    def _clean_header(cls, data: Dict[str, Any], tx: Optional[StockTransaction]) -> Dict[str, Any]:
        create = cls.cfg(Submodule.CREATE)
        errors: Dict[str, str] = {}
        clean: Dict[str, Any] = {}

        def pick(key, default=None):
            if key in data:
                return data[key]
            return getattr(tx, key, default) if tx else default

        receipt_type = (pick("receipt_type") or create["default_receipt_type"] or "").strip()
        codes = [t["code"] for t in create["receipt_types"]]
        if not receipt_type:
            errors["receipt_type"] = "Receipt type is required."
        elif receipt_type not in codes:
            errors["receipt_type"] = f"Receipt type must be one of: {', '.join(codes)}."
        clean["receipt_type"] = receipt_type

        try:
            receipt_date = _date(pick("transaction_date"), "transaction_date") or timezone.localdate()
            today = timezone.localdate()
            if receipt_date > today and not create["allow_future_receipt_date"]:
                errors["transaction_date"] = "Receipt date cannot be in the future."
            elif receipt_date < today - timedelta(days=create["max_backdate_days"]):
                errors["transaction_date"] = f"Receipt date cannot be more than {create['max_backdate_days']} days in the past."
            clean["transaction_date"] = receipt_date
        except ValidationError as exc:
            errors.update(exc.message_dict)

        try:
            clean["expected_date"] = _date(pick("expected_date"), "expected_date")
        except ValidationError as exc:
            errors.update(exc.message_dict)

        wh_id = _pk(pick("warehouse") if "warehouse" in data else (tx.warehouse_id if tx else None), "warehouse") \
            or create["default_warehouse_id"]
        warehouse = Warehouse.objects.filter(pk=wh_id).first() if wh_id else None
        if not warehouse:
            errors["warehouse"] = "Destination warehouse is required."
        elif not warehouse.is_active:
            errors["warehouse"] = f"Warehouse {warehouse.code} is inactive."
        elif not warehouse.receiving_enabled:
            errors["warehouse"] = f"Receiving is disabled for warehouse {warehouse.code}."
        clean["warehouse"] = warehouse

        loc_raw = data["receiving_location"] if "receiving_location" in data else (
            tx.receiving_location_id if tx else create["default_location_id"]
        )
        loc_id = _pk(loc_raw, "receiving_location")
        location = StorageLocation.objects.filter(pk=loc_id).first() if loc_id else None
        if loc_id and not location:
            errors["receiving_location"] = "Receiving location does not exist."
        elif location:
            if not location.is_active:
                errors["receiving_location"] = f"Location {location.code} is inactive."
            elif warehouse and location.warehouse_id != warehouse.id:
                errors["receiving_location"] = f"Location {location.code} does not belong to warehouse {warehouse.code}."
        # A missing header location is checked per line, since lines may carry their own.
        clean["receiving_location"] = location

        for key, model_field, limit in (
            ("external_reference", "reference_number", 100),
            ("supplier", "supplier", 150),
            ("supplier_reference", "supplier_reference", 100),
            ("purchase_order_reference", "purchase_order_reference", 100),
            ("received_by", "received_by", 120),
        ):
            raw = data.get(key) if key in data else (getattr(tx, model_field) if tx else "")
            value = str(raw or "").strip()
            if len(value) > limit:
                errors[key] = f"At most {limit} characters."
            clean[model_field] = value
        clean["notes"] = str(data.get("remarks") if "remarks" in data else (tx.notes if tx else "") or "").strip()

        enforced = cls.inspection_enforced()
        if enforced is None:
            requested = data.get("inspection_required") if "inspection_required" in data else (
                tx.inspection_required if tx else cls.cfg(Submodule.INSPECTION)["default_inspection_required"]
            )
            if not isinstance(requested, bool):
                errors["inspection_required"] = "Must be true or false."
                requested = False
            clean["inspection_required"] = requested
        else:
            clean["inspection_required"] = enforced

        if errors:
            raise ValidationError(errors)
        return clean

    @classmethod
    def _check_required_fields(cls, tx: StockTransaction):
        create = cls.cfg(Submodule.CREATE)
        values = {
            "external_reference": tx.reference_number,
            "supplier": tx.supplier,
            "supplier_reference": tx.supplier_reference,
            "purchase_order_reference": tx.purchase_order_reference,
            "expected_delivery_date": tx.expected_date,
            "receiving_location": tx.receiving_location_id,
            "remarks": tx.notes,
        }
        errors = {f: "This field is required by the receipt configuration." for f, v in values.items()
                  if f in create["required_fields"] and not v}
        if "attachments" in create["required_fields"]:
            from shared_file_storage.models import StoredFile

            if not StoredFile.objects.filter(owner_type=ATTACHMENT_OWNER, owner_id=str(tx.id)).exists():
                errors["attachments"] = "At least one attachment is required."
        if errors:
            raise ValidationError(errors)

    # --------------------------------------------------------- line validation
    @classmethod
    def _clean_lines(
        cls, tx_header: Dict[str, Any], lines_data: List[Dict[str, Any]], exclude_tx_id: Optional[int]
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        create = cls.cfg(Submodule.CREATE)
        if not isinstance(lines_data, list):
            raise ValidationError({"lines": "Lines must be a list."})

        warehouse = tx_header["warehouse"]
        receipt_date = tx_header["transaction_date"]
        has_po = bool(tx_header.get("purchase_order_reference"))
        cleaned, warnings = [], []
        errors: Dict[str, Any] = {}
        seen_keys, seen_serials = set(), set()

        for idx, raw in enumerate(lines_data):
            row_errors: Dict[str, str] = {}
            try:
                row = cls._clean_line(raw, warehouse, receipt_date, tx_header["receiving_location"], has_po, create, warnings, idx)
            except ValidationError as exc:
                detail = exc.message_dict if hasattr(exc, "error_dict") else {"line": exc.messages}
                for field, messages in detail.items():
                    errors[f"lines[{idx}].{field}"] = messages[0] if isinstance(messages, list) else messages
                continue

            key = (row["item"].id, row["variant"].id if row["variant"] else None, row["batch_number"], row["transaction_uom"])
            if not create["allow_duplicate_lines"] and key in seen_keys:
                row_errors["item"] = "Duplicate line: the same item, variant, batch and UOM already appear on this receipt."
            seen_keys.add(key)

            for sn in row["serial_numbers"]:
                if sn in seen_serials:
                    row_errors["serial_numbers"] = f"Serial {sn} appears more than once on this receipt."
                seen_serials.add(sn)
            if not row_errors and row["serial_numbers"]:
                conflict = cls._serial_conflict(row["item"], row["serial_numbers"], exclude_tx_id)
                if conflict:
                    row_errors["serial_numbers"] = conflict
            if row_errors:
                errors.update({f"lines[{idx}].{field}": msg for field, msg in row_errors.items()})
            else:
                cleaned.append(row)

        if errors:
            raise ValidationError(errors)
        return cleaned, warnings

    @classmethod
    def _clean_line(cls, raw, warehouse, receipt_date, header_location, has_po, create, warnings, idx) -> Dict[str, Any]:
        if not isinstance(raw, dict):
            raise ValidationError({"line": "Each line must be an object."})
        errors: Dict[str, str] = {}

        item_id = _pk(raw.get("item"), "item")
        item = InventoryItem.objects.select_related("base_uom").filter(pk=item_id).first() if item_id else None
        if not item:
            raise ValidationError({"item": "Item is required." if not item_id else "Item does not exist."})
        if not item.is_active or item.status != InventoryItem.ItemStatus.ACTIVE:
            raise ValidationError({"item": f"Item {item.code} is not active."})
        if not item.track_inventory or item.item_type in (InventoryItem.ItemType.NON_STOCK, InventoryItem.ItemType.SERVICE):
            raise ValidationError({"item": f"Item {item.code} is not a stock-tracked item."})

        variant = None
        variant_id = _pk(raw.get("variant"), "variant")
        if variant_id:
            variant = InventoryItemVariant.objects.filter(pk=variant_id).first()
            if not variant or variant.item_id != item.id:
                errors["variant"] = f"Variant does not belong to item {item.code}."
            elif not variant.is_active:
                errors["variant"] = f"Variant {variant.sku} is inactive."
        elif item.has_variants and item.variants.filter(is_active=True).exists():
            errors["variant"] = f"Item {item.code} has variants; select one."

        try:
            uom, factor = cls.resolve_uom(item, raw.get("uom") or raw.get("transaction_uom") or "")
        except ValidationError as exc:
            raise ValidationError({**errors, **exc.message_dict})

        try:
            qty = _dec(raw.get("received_quantity", raw.get("quantity")), "received_quantity")
            if qty <= 0:
                errors["received_quantity"] = "Received quantity must be greater than zero."
            else:
                try:
                    UOMConversionService.validate_fractional_allowed(uom, qty)
                except ValidationError as exc:
                    if "not found" not in exc.messages[0]:
                        errors["received_quantity"] = exc.messages[0]
        except ValidationError as exc:
            errors.update(exc.message_dict)
            qty = None

        try:
            expected = _dec(raw.get("expected_quantity"), "expected_quantity", allow_none=True)
            if expected is not None and expected < 0:
                errors["expected_quantity"] = "Expected quantity cannot be negative."
            if expected is None and has_po and create["require_expected_quantity_with_po"]:
                errors["expected_quantity"] = "Expected quantity is required when a purchase order is referenced."
        except ValidationError as exc:
            errors.update(exc.message_dict)
            expected = None

        if qty and expected is not None and expected > 0 and "received_quantity" not in errors:
            limit = expected * (Decimal("1") + Decimal(str(create["over_receipt_tolerance_percent"])) / Decimal("100"))
            if qty > limit:
                msg = (f"Received {qty} exceeds expected {expected} beyond the "
                       f"{create['over_receipt_tolerance_percent']}% over-receipt tolerance.")
                if create["over_receipt_policy"] == "BLOCK":
                    errors["received_quantity"] = msg
                elif create["over_receipt_policy"] == "WARN":
                    warnings.append(f"Line {idx + 1}: {msg}")

        try:
            unit_cost = _dec(raw.get("unit_cost") or 0, "unit_cost")
            if unit_cost < 0:
                errors["unit_cost"] = "Unit cost cannot be negative."
        except ValidationError as exc:
            errors.update(exc.message_dict)
            unit_cost = ZERO

        location = header_location
        loc_id = _pk(raw.get("location"), "location")
        if loc_id:
            location = StorageLocation.objects.filter(pk=loc_id).first()
            if not location:
                errors["location"] = "Location does not exist."
            elif location.warehouse_id != warehouse.id:
                errors["location"] = f"Location {location.code} does not belong to warehouse {warehouse.code}."
            elif not location.is_active:
                errors["location"] = f"Location {location.code} is inactive."
        elif location is None and create["require_receiving_location"]:
            errors["location"] = "Receiving location is required (set it on the receipt header or the line)."

        flags = cls.tracking_flags(item)
        batch_number = str(raw.get("batch_number") or "").strip()
        if flags["batch"] and not batch_number:
            errors["batch_number"] = f"Item {item.code} is batch-tracked; batch number is required."
        if batch_number:
            if len(batch_number) > 80:
                errors["batch_number"] = "At most 80 characters."
            other = Batch.objects.filter(batch_number=batch_number).exclude(item=item).first()
            if other:
                errors["batch_number"] = f"Batch {batch_number} already belongs to item {other.item.code}."

        raw_serials = raw.get("serial_numbers") or []
        if isinstance(raw_serials, str):
            raw_serials = [s for s in raw_serials.replace("\n", ",").split(",")]
        serials = [str(s).strip() for s in raw_serials if str(s).strip()]
        if flags["serial"]:
            base_qty = (qty or ZERO) * factor
            if base_qty != base_qty.to_integral_value():
                errors["received_quantity"] = "Serial-tracked quantities must be whole units."
            elif len(serials) != int(base_qty):
                errors["serial_numbers"] = f"{int(base_qty)} serial number(s) required; {len(serials)} provided."
        elif serials:
            errors["serial_numbers"] = f"Item {item.code} is not serial-tracked."
        if any(len(s) > 100 for s in serials):
            errors["serial_numbers"] = "Serial numbers are limited to 100 characters."

        mfg_date = expiry_date = None
        try:
            mfg_date = _date(raw.get("manufacturing_date"), "manufacturing_date")
            expiry_date = _date(raw.get("expiry_date"), "expiry_date")
        except ValidationError as exc:
            errors.update(exc.message_dict)
        if mfg_date and mfg_date > receipt_date:
            errors["manufacturing_date"] = "Manufacturing date cannot be after the receipt date."
        if flags["expiry"] and not expiry_date:
            errors["expiry_date"] = f"Item {item.code} is expiry-tracked; expiry date is required."
        if expiry_date:
            if mfg_date and expiry_date <= mfg_date:
                errors["expiry_date"] = "Expiry date must be after the manufacturing date."
            elif create["reject_expired_goods"] and expiry_date <= receipt_date:
                errors["expiry_date"] = "Goods are already expired on the receipt date."
            elif (expiry_date - receipt_date).days < create["min_remaining_shelf_life_days"]:
                errors["expiry_date"] = f"Remaining shelf life is below the {create['min_remaining_shelf_life_days']}-day minimum."

        if errors:
            raise ValidationError(errors)

        description = str(raw.get("description") or "").strip() or (item.short_description or item.name)
        return {
            "item": item,
            "variant": variant,
            "location": location,
            "quantity": qty,
            "expected_quantity": expected,
            "unit_cost": unit_cost,
            "transaction_uom": uom,
            "conversion_factor_at_txn": factor,
            "quantity_base_uom": (qty * factor).quantize(Decimal("0.0001")),
            "batch_number": batch_number,
            "serial_numbers": serials,
            "manufacturing_date": mfg_date,
            "expiry_date": expiry_date,
            "description": description[:255],
        }

    @staticmethod
    def _serial_conflict(item: InventoryItem, serials: List[str], exclude_tx_id: Optional[int]) -> str:
        existing = SerialNumber.objects.filter(serial_number__in=serials).select_related("item").first()
        if existing and (existing.item_id != item.id or existing.status in ACTIVE_SERIAL_STATUSES):
            return f"Serial {existing.serial_number} is already registered ({existing.item.code}, {existing.status})."
        open_lines = StockTransactionLine.objects.filter(
            transaction__transaction_type=StockTransaction.TransactionType.RECEIPT,
        ).exclude(transaction__status__in=OPEN_RECEIPT_EXCLUDED)
        if exclude_tx_id:
            open_lines = open_lines.exclude(transaction_id=exclude_tx_id)
        for sn in serials:
            clash = open_lines.filter(serial_numbers__contains=[sn]).select_related("transaction").first()
            if clash:
                return f"Serial {sn} is already on open receipt {clash.transaction.document_number}."
        return ""

    # ------------------------------------------------------------ draft CRUD
    @classmethod
    @transaction.atomic
    def save_draft(
        cls,
        data: Dict[str, Any],
        actor: str,
        tx: Optional[StockTransaction] = None,
        can_manual_number: bool = False,
        idempotency_key: str = "",
    ) -> Tuple[StockTransaction, List[str]]:
        create = cls.cfg(Submodule.CREATE)
        if tx is None and idempotency_key:
            existing = StockTransaction.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                if existing.transaction_type != StockTransaction.TransactionType.RECEIPT:
                    raise ValidationError(
                        {"idempotency_key": "This key is already in use by another transaction."}
                    )
                return existing, []
        if tx is not None:
            tx = cls._lock(tx)
            if tx.status != S.DRAFT:
                raise ValidationError(f"Only draft receipts can be edited; {tx.document_number} is {tx.get_status_display()}.")

        header = cls._clean_header(data, tx)
        lines_data = data.get("lines") if "lines" in data else None
        if lines_data is None and tx is not None:
            # Header edits (e.g. warehouse) must still hold for the lines already on the draft.
            lines_data = cls._lines_payload(tx)
        lines, warnings = ([], [])
        if lines_data is not None:
            lines, warnings = cls._clean_lines(header, lines_data, tx.id if tx else None)

        manual = str(data.get("document_number") or "").strip()
        if tx is None:
            if manual:
                if not (create["allow_manual_number"] and can_manual_number):
                    raise ValidationError({"document_number": "Manual receipt numbers are not enabled for you."})
                if len(manual) > 60:
                    raise ValidationError({"document_number": "At most 60 characters."})
                if StockTransaction.objects.filter(document_number=manual).exists():
                    raise ValidationError({"document_number": f"Receipt number {manual} is already in use."})
                number = manual
            else:
                number = cls._next_number(create["document_type"], StockTransaction, "document_number")
            tx = StockTransaction(
                document_number=number,
                transaction_type=StockTransaction.TransactionType.RECEIPT,
                status=S.DRAFT,
                created_by=actor,
                idempotency_key=idempotency_key or None,
            )
        elif manual and manual != tx.document_number:
            raise ValidationError({"document_number": "The receipt number cannot be changed after creation."})

        if not header["received_by"]:
            header["received_by"] = actor
        for field, value in header.items():
            setattr(tx, field, value)
        try:
            tx.save()
        except IntegrityError:
            raise ValidationError({"document_number": "Receipt number or idempotency key is already in use."})

        if lines_data is not None:
            tx.lines.all().delete()
            for row in lines:
                StockTransactionLine.objects.create(transaction=tx, received_quantity=row["quantity"], **row)
        return tx, warnings

    @staticmethod
    def _lines_payload(tx: StockTransaction) -> List[Dict[str, Any]]:
        return [
            {
                "item": l.item_id, "variant": l.variant_id, "location": l.location_id, "uom": l.transaction_uom,
                "received_quantity": l.quantity, "expected_quantity": l.expected_quantity, "unit_cost": l.unit_cost,
                "batch_number": l.batch_number, "serial_numbers": l.serial_numbers,
                "manufacturing_date": l.manufacturing_date, "expiry_date": l.expiry_date, "description": l.description,
            }
            for l in tx.lines.order_by("id")
        ]

    @classmethod
    @transaction.atomic
    def delete_draft(cls, tx: StockTransaction):
        tx = cls._lock(tx)
        if tx.status != S.DRAFT:
            raise ValidationError("Only draft receipts can be deleted. Cancel or reverse it instead.")
        tx.lines.all().delete()
        tx.delete()

    # --------------------------------------------------------------- workflow
    @classmethod
    @transaction.atomic
    def submit(cls, tx: StockTransaction, actor: str) -> Tuple[StockTransaction, List[str]]:
        tx = cls._lock(tx)
        cls._transition(tx, S.SUBMITTED)
        # Re-validate: master data, serial registry and settings may have changed since the draft was saved.
        header = cls._clean_header({}, tx)
        lines = list(tx.lines.select_related("item", "variant", "location"))
        if not lines:
            raise ValidationError({"lines": "Add at least one receipt line before submitting."})
        _, warnings = cls._clean_lines(header, cls._lines_payload(tx), tx.id)
        tx.inspection_required = header["inspection_required"]
        cls._check_required_fields(tx)

        for line in lines:
            line.received_quantity = line.quantity
            if tx.inspection_required:
                line.accepted_quantity, line.rejected_quantity = ZERO, ZERO
                line.pending_inspection_quantity = line.quantity
                line.inspection_status = LineInspection.PENDING
            else:
                line.accepted_quantity = line.quantity
                line.rejected_quantity = line.pending_inspection_quantity = ZERO
                line.inspection_status = LineInspection.NOT_REQUIRED
            line.putaway_quantity = ZERO
            line.putaway_status = LinePutaway.PENDING
            line.save()

        tx.submitted_by, tx.submitted_at = actor, timezone.now()
        tx.save()

        disc = cls.cfg(Submodule.DISCREPANCY)
        if disc["enabled"] and disc["auto_create_on_quantity_variance"]:
            for line in lines:
                if line.expected_quantity is not None and line.expected_quantity != line.quantity:
                    kind = "SHORTAGE" if line.quantity < line.expected_quantity else "EXCESS"
                    cls._create_discrepancy(
                        tx, line, kind if kind in disc["discrepancy_types"] else disc["discrepancy_types"][0],
                        f"Received {line.quantity} against expected {line.expected_quantity}.",
                        actor, system=True,
                    )
        cls.notify("submitted", tx)
        return tx, warnings

    @classmethod
    @transaction.atomic
    def approve(cls, tx: StockTransaction, actor: str) -> StockTransaction:
        tx = cls._lock(tx)
        if not cls.cfg(Submodule.CREATE)["approval_required"]:
            raise ValidationError("Goods receipt approval is not enabled.")
        if tx.status != S.SUBMITTED or tx.approved_at:
            raise ValidationError(f"Only receipts awaiting approval can be approved; {tx.document_number} is {tx.get_status_display()}.")
        cls._transition(tx, S.APPROVED)
        tx.approved_by, tx.approved_at = actor, timezone.now()
        tx.save()
        cls.notify("approved", tx)
        return tx

    @classmethod
    @transaction.atomic
    def return_to_draft(cls, tx: StockTransaction, actor: str, reason: str) -> StockTransaction:
        tx = cls._lock(tx)
        if tx.status != S.SUBMITTED:
            raise ValidationError("Only submitted receipts that have not been processed can be returned to draft.")
        if tx.receipt_inspections.exists() or tx.receipt_putaways.exists():
            raise ValidationError("Receipt already has inspection or putaway records.")
        if not reason:
            raise ValidationError({"reason": "A reason is required."})
        cls._transition(tx, S.DRAFT)
        tx.lines.update(
            accepted_quantity=ZERO, rejected_quantity=ZERO, pending_inspection_quantity=ZERO,
            inspection_status=LineInspection.NOT_REQUIRED, putaway_quantity=ZERO, putaway_status=LinePutaway.PENDING,
        )
        tx.receipt_discrepancies.filter(is_system_generated=True).delete()
        tx.submitted_at, tx.submitted_by = None, ""
        tx.notes = (f"{tx.notes}\n" if tx.notes else "") + f"Returned to draft by {actor}: {reason}"
        tx.save()
        return tx

    @classmethod
    @transaction.atomic
    def cancel(cls, tx: StockTransaction, actor: str, reason: str) -> StockTransaction:
        tx = cls._lock(tx)
        if tx.status not in CANCELLABLE:
            raise ValidationError(f"A {tx.get_status_display()} receipt cannot be cancelled.")
        if tx.receipt_inspections.exists() or tx.receipt_putaways.filter(status=ReceiptPutaway.Status.COMPLETED).exists():
            raise ValidationError("Receipt already has inspection or putaway records and cannot be cancelled.")
        if not reason:
            raise ValidationError({"reason": "A cancellation reason is required."})
        cls._transition(tx, S.CANCELLED)
        tx.reason = reason
        tx.save()
        return tx

    @classmethod
    def refresh_status(cls, tx: StockTransaction) -> str:
        totals = tx.lines.aggregate(
            accepted=Sum("accepted_quantity"), rejected=Sum("rejected_quantity"),
            hold=Sum("hold_quantity"), pending=Sum("pending_inspection_quantity"), putaway=Sum("putaway_quantity"),
        )
        accepted = totals["accepted"] or ZERO
        rejected = totals["rejected"] or ZERO
        hold = totals["hold"] or ZERO
        pending = totals["pending"] or ZERO
        putaway = totals["putaway"] or ZERO
        inspected = tx.receipt_inspections.exists()

        if pending > 0:
            new = S.UNDER_INSPECTION if inspected or tx.status == S.UNDER_INSPECTION else tx.status
        elif accepted == 0 and hold == 0:
            new = S.REJECTED
        elif accepted == 0 and hold > 0:
            new = S.UNDER_INSPECTION
        elif putaway == 0:
            if tx.inspection_required:
                new = S.PARTIALLY_ACCEPTED if rejected > 0 or hold > 0 else S.ACCEPTED
            else:
                new = S.APPROVED if tx.approved_at else S.SUBMITTED
        elif putaway < accepted:
            new = S.PUTAWAY_PENDING
        else:
            new = S.READY_TO_POST

        if new != tx.status:
            if tx.status in (S.SUBMITTED, S.APPROVED) and new in (S.SUBMITTED, S.APPROVED):
                return tx.status
            previous = tx.status
            cls._transition(tx, new)
            tx.save(update_fields=["status", "updated_at"])
            if previous == S.UNDER_INSPECTION:
                cls.notify("inspection_completed", tx, {"accepted": str(accepted), "rejected": str(rejected)})
            if new == S.READY_TO_POST:
                cls.notify("putaway_completed", tx)
        return tx.status

    # ------------------------------------------------------------- inspection
    @staticmethod
    def _line_inspection_status(line: StockTransactionLine) -> str:
        if line.pending_inspection_quantity > 0:
            return LineInspection.PENDING
        if line.rejected_quantity == 0 and line.hold_quantity == 0:
            return LineInspection.PASSED
        if line.accepted_quantity == 0 and line.hold_quantity == 0:
            return LineInspection.FAILED
        return LineInspection.PARTIAL

    @classmethod
    @transaction.atomic
    def record_inspection(cls, tx: StockTransaction, data: Dict[str, Any], actor: str) -> ReceiptInspection:
        tx = cls._lock(tx)
        insp_cfg = cls.cfg(Submodule.INSPECTION)
        rej_cfg = cls.cfg(Submodule.REJECTED)
        partial_cfg = cls.cfg(Submodule.PARTIAL)
        if not tx.inspection_required:
            raise ValidationError("This receipt does not require inspection.")
        if tx.status not in INSPECTABLE:
            raise ValidationError(f"Receipt {tx.document_number} is {tx.get_status_display()} and cannot be inspected.")
        cls._require_processing_allowed(tx)
        line = cls._line_of(tx, data.get("line"))

        accepted = _dec(data.get("accepted_quantity") or 0, "accepted_quantity")
        rejected = _dec(data.get("rejected_quantity") or 0, "rejected_quantity")
        hold = _dec(data.get("hold_quantity") or 0, "hold_quantity")
        if accepted < 0 or rejected < 0 or hold < 0:
            raise ValidationError({"accepted_quantity": "Quantities cannot be negative."})
        inspected = accepted + rejected + hold
        if inspected <= 0:
            raise ValidationError({"accepted_quantity": "Inspect at least some quantity."})
        if "inspection_quantity" in data and data["inspection_quantity"] not in (None, ""):
            declared = _dec(data["inspection_quantity"], "inspection_quantity")
            if declared != inspected:
                raise ValidationError({"inspection_quantity": "Inspection quantity must equal accepted + rejected + hold."})
        if inspected > line.pending_inspection_quantity:
            raise ValidationError({
                "inspection_quantity": f"Only {line.pending_inspection_quantity} remains to inspect on this line "
                                       f"(received {line.quantity}, already inspected "
                                       f"{line.accepted_quantity + line.rejected_quantity})."
            })
        for field, quantity in (
            ("accepted_quantity", accepted),
            ("rejected_quantity", rejected),
            ("hold_quantity", hold),
        ):
            try:
                UOMConversionService.validate_fractional_allowed(line.transaction_uom, quantity)
            except ValidationError as exc:
                raise ValidationError({field: exc.messages[0]}) from exc
        if line.serial_numbers:
            for field, quantity in (
                ("accepted_quantity", accepted),
                ("rejected_quantity", rejected),
            ):
                base_quantity = quantity * line.conversion_factor_at_txn
                if base_quantity != base_quantity.to_integral_value():
                    raise ValidationError(
                        {field: "Serial-tracked inspection quantities must be whole units."}
                    )

        if not partial_cfg["allow_partial_acceptance"]:
            final_acc = line.accepted_quantity + accepted
            final_rej = line.rejected_quantity + rejected
            if final_acc > 0 and final_rej > 0:
                raise ValidationError("Partial acceptance is disabled: a line must be fully accepted or fully rejected.")

        reason = str(data.get("rejection_reason") or "").strip()
        disposition = str(data.get("rejection_disposition") or "").strip()
        rejected_serials: List[str] = []
        held_serials: List[str] = []
        if rejected > 0:
            if rej_cfg["require_rejection_reason"] and not reason:
                raise ValidationError({"rejection_reason": "A rejection reason is required."})
            if reason and rej_cfg["rejection_reasons"] and reason not in rej_cfg["rejection_reasons"]:
                raise ValidationError({"rejection_reason": f"Reason must be one of: {', '.join(rej_cfg['rejection_reasons'])}."})
            disposition = disposition or rej_cfg["default_disposition"]
            if disposition and disposition not in rej_cfg["dispositions"]:
                raise ValidationError({"rejection_disposition": f"Disposition must be one of: {', '.join(rej_cfg['dispositions'])}."})
            if line.serial_numbers:
                rejected_serials = [str(s).strip() for s in data.get("rejected_serial_numbers") or [] if str(s).strip()]
                already = set(cls.rejected_serials(line)) | set(cls.held_serials(line))
                needed = rejected * line.conversion_factor_at_txn
                if needed != needed.to_integral_value():
                    raise ValidationError({"rejected_quantity": "Serial-tracked quantities must be whole units."})
                if len(rejected_serials) != int(needed) or len(set(rejected_serials)) != len(rejected_serials):
                    raise ValidationError({"rejected_serial_numbers": f"Identify exactly {int(needed)} rejected serial number(s)."})
                bad = [s for s in rejected_serials if s not in line.serial_numbers or s in already]
                if bad:
                    raise ValidationError({"rejected_serial_numbers": f"Not available on this line: {', '.join(bad)}."})
        if hold > 0 and line.serial_numbers:
            held_serials = [str(s).strip() for s in data.get("held_serial_numbers") or [] if str(s).strip()]
            used = set(cls.rejected_serials(line)) | set(cls.held_serials(line))
            needed = hold * line.conversion_factor_at_txn
            if needed != needed.to_integral_value() or len(held_serials) != int(needed) or len(set(held_serials)) != len(held_serials):
                raise ValidationError({"held_serial_numbers": f"Identify exactly {int(needed)} held serial number(s)."})
            bad = [s for s in held_serials if s not in line.serial_numbers or s in used or s in rejected_serials]
            if bad:
                raise ValidationError({"held_serial_numbers": f"Not available on this line: {', '.join(bad)}."})
        if rejected <= 0:
            disposition = ""

        if cls.quality_required() and accepted > 0:
            latest = line.inspections.filter(kind=ReceiptInspection.InspectionKind.QUALITY).first()
            if not latest:
                raise ValidationError("Quality inspection is required before accepting goods on this line.")
            if latest.quality_result == ReceiptInspection.QualityResult.FAIL:
                raise ValidationError("The latest quality inspection failed; goods on this line can only be rejected.")

        inspection_date = _date(data.get("inspection_date"), "inspection_date") or timezone.localdate()
        if inspection_date > timezone.localdate() or inspection_date < tx.transaction_date:
            raise ValidationError({"inspection_date": "Inspection date must be between the receipt date and today."})

        line.accepted_quantity += accepted
        line.rejected_quantity += rejected
        line.hold_quantity += hold
        line.pending_inspection_quantity -= inspected
        line.inspection_status = cls._line_inspection_status(line)
        line.inspected_by, line.inspected_at = data.get("inspector") or actor, timezone.now()
        line.inspection_remarks = str(data.get("remarks") or "")
        if rejected > 0:
            line.rejection_reason = reason
        line.save()

        record = ReceiptInspection.objects.create(
            inspection_number=cls._next_number(insp_cfg["document_type"], ReceiptInspection, "inspection_number"),
            kind=ReceiptInspection.InspectionKind.RECEIPT,
            receipt=tx,
            line=line,
            inspection_quantity=inspected,
            accepted_quantity=accepted,
            rejected_quantity=rejected,
            hold_quantity=hold,
            delivery_challan_reference=str(data.get("delivery_challan_reference") or "")[:100],
            packaging_condition=str(data.get("packaging_condition") or "")[:60],
            pending_quantity_after=line.pending_inspection_quantity,
            rejection_reason=reason,
            rejected_serial_numbers=rejected_serials,
            held_serial_numbers=held_serials,
            rejection_disposition=disposition,
            inspector=str(data.get("inspector") or actor)[:120],
            inspection_date=inspection_date,
            remarks=str(data.get("remarks") or ""),
        )

        if tx.status in (S.SUBMITTED, S.APPROVED):
            cls._transition(tx, S.UNDER_INSPECTION)
            tx.save(update_fields=["status", "updated_at"])
        disc = cls.cfg(Submodule.DISCREPANCY)
        if rejected > 0 and disc["enabled"] and disc["auto_create_on_rejection"]:
            kind = "QUALITY" if "QUALITY" in disc["discrepancy_types"] else disc["discrepancy_types"][0]
            cls._create_discrepancy(tx, line, kind, f"{rejected} rejected at inspection {record.inspection_number}: {reason}",
                                    actor, system=True)
        cls.refresh_status(tx)
        return record

    @staticmethod
    def rejected_serials(line: StockTransactionLine) -> List[str]:
        serials: List[str] = []
        for insp in line.inspections.filter(kind=ReceiptInspection.InspectionKind.RECEIPT):
            serials.extend(insp.rejected_serial_numbers or [])
        return serials

    @staticmethod
    def held_serials(line: StockTransactionLine) -> List[str]:
        serials: List[str] = []
        for insp in line.inspections.filter(kind=ReceiptInspection.InspectionKind.RECEIPT):
            serials.extend(insp.held_serial_numbers or [])
        return serials

    @classmethod
    @transaction.atomic
    def record_quality_inspection(cls, tx: StockTransaction, data: Dict[str, Any], actor: str) -> ReceiptInspection:
        tx = cls._lock(tx)
        q_cfg = cls.cfg(Submodule.QUALITY)
        if tx.status not in INSPECTABLE:
            raise ValidationError(f"Receipt {tx.document_number} is {tx.get_status_display()} and cannot be quality-inspected.")
        cls._require_processing_allowed(tx)
        line = cls._line_of(tx, data.get("line"))
        if tx.inspection_required and line.pending_inspection_quantity <= 0:
            raise ValidationError("This line has already been fully inspected.")

        inspection_type = str(data.get("inspection_type") or "").strip()
        if not inspection_type:
            raise ValidationError({"inspection_type": "Inspection type is required."})
        if q_cfg["inspection_types"] and inspection_type not in q_cfg["inspection_types"]:
            raise ValidationError({"inspection_type": f"Must be one of: {', '.join(q_cfg['inspection_types'])}."})

        sample = _dec(data.get("sample_quantity"), "sample_quantity")
        passed = _dec(data.get("passed_quantity") or 0, "passed_quantity")
        failed = _dec(data.get("failed_quantity") or 0, "failed_quantity")
        if sample <= 0:
            raise ValidationError({"sample_quantity": "Sample quantity must be greater than zero."})
        if sample > line.quantity:
            raise ValidationError({"sample_quantity": f"Sample cannot exceed the received quantity ({line.quantity})."})
        if passed < 0 or failed < 0 or passed + failed != sample:
            raise ValidationError({"passed_quantity": "Passed + failed quantity must equal the sample quantity."})
        for field, quantity in (
            ("sample_quantity", sample),
            ("passed_quantity", passed),
            ("failed_quantity", failed),
        ):
            try:
                UOMConversionService.validate_fractional_allowed(line.transaction_uom, quantity)
            except ValidationError as exc:
                raise ValidationError({field: exc.messages[0]}) from exc

        criteria_to_evaluate = q_cfg.get("criteria")
        if not criteria_to_evaluate:
            criteria_to_evaluate = cls.DEFAULT_CRITERIA_CATALOG
        results, mandatory_failed, optional_failed = cls._evaluate_criteria(criteria_to_evaluate, data.get("criteria_results") or [])
        failure_rate = failed / sample * Decimal("100")
        if mandatory_failed or failure_rate > Decimal(str(q_cfg["max_failure_rate_percent"])):
            result = ReceiptInspection.QualityResult.FAIL
        elif failed > 0 or optional_failed:
            result = ReceiptInspection.QualityResult.CONDITIONAL
        else:
            result = ReceiptInspection.QualityResult.PASS

        inspection_date = _date(data.get("inspection_date"), "inspection_date") or timezone.localdate()
        if inspection_date > timezone.localdate() or inspection_date < tx.transaction_date:
            raise ValidationError({"inspection_date": "Inspection date must be between the receipt date and today."})

        record = ReceiptInspection.objects.create(
            inspection_number=cls._next_number(q_cfg["document_type"], ReceiptInspection, "inspection_number"),
            kind=ReceiptInspection.InspectionKind.QUALITY,
            receipt=tx,
            line=line,
            inspection_type=inspection_type,
            sample_quantity=sample,
            passed_quantity=passed,
            failed_quantity=failed,
            criteria_results=results,
            quality_result=result,
            inspector=str(data.get("inspector") or actor)[:120],
            inspection_date=inspection_date,
            remarks=str(data.get("remarks") or ""),
        )
        if tx.inspection_required and tx.status in (S.SUBMITTED, S.APPROVED):
            cls._transition(tx, S.UNDER_INSPECTION)
            tx.save(update_fields=["status", "updated_at"])
        if result == ReceiptInspection.QualityResult.FAIL:
            cls.notify("quality_failed", tx, {"inspection_number": record.inspection_number, "item_code": line.item.code})
        return record

    DEFAULT_CRITERIA_CATALOG: List[Dict[str, Any]] = [
        {"code": "PACK_INTEG", "name": "Packaging & Tamper-Proof Seal", "type": "BOOLEAN", "mandatory": True},
        {"code": "DIM_CHECK", "name": "Dimensional & Physical Tolerance", "type": "BOOLEAN", "mandatory": True},
        {"code": "SPEC_BARCODE", "name": "Specification, Rating & Barcode Scan", "type": "BOOLEAN", "mandatory": True},
        {"code": "SURFACE_FINISH", "name": "Surface Finish & Corrosion Inspection", "type": "BOOLEAN", "mandatory": False},
    ]

    @classmethod
    def _evaluate_criteria(cls, criteria: List[Dict[str, Any]], submitted: List[Dict[str, Any]]):
        by_code = {}
        if not isinstance(submitted, list):
            raise ValidationError({"criteria_results": "Must be a list of criteria results."})
        for entry in submitted:
            if not isinstance(entry, dict) or not isinstance(entry.get("code"), str) or not entry["code"].strip():
                raise ValidationError({"criteria_results": "Each result needs a criterion code and value."})
            code = entry["code"].strip()
            if code in by_code:
                raise ValidationError({"criteria_results": f"Criterion '{code}' was supplied more than once."})
            by_code[code] = entry.get("value")

        active_criteria = [dict(c) for c in (criteria or [])]
        if not active_criteria:
            active_criteria = [dict(c) for c in cls.DEFAULT_CRITERIA_CATALOG]

        known = {c["code"] for c in active_criteria}
        catalog_map = {c["code"]: c for c in cls.DEFAULT_CRITERIA_CATALOG}

        unknown = set(by_code) - known
        for code in list(unknown):
            if code in catalog_map:
                active_criteria.append(dict(catalog_map[code]))
                known.add(code)
                unknown.remove(code)

        if unknown:
            raise ValidationError({"criteria_results": f"Unknown criteria: {', '.join(sorted(unknown))}."})

        results, mandatory_failed, optional_failed = [], False, False
        errors = {}
        for crit in active_criteria:
            code, kind = crit["code"], crit["type"]
            mandatory = bool(crit.get("mandatory", True))
            value = by_code.get(code)
            if value in (None, ""):
                if mandatory:
                    errors[code] = f"'{crit['name']}' is a mandatory criterion."
                continue
            if kind == "BOOLEAN":
                if not isinstance(value, bool):
                    errors[code] = f"'{crit['name']}' must be true or false."
                    continue
                passed = value
            elif kind == "NUMERIC":
                try:
                    num = Decimal(str(value))
                except (InvalidOperation, ValueError):
                    errors[code] = f"'{crit['name']}' must be a number."
                    continue
                if not num.is_finite():
                    errors[code] = f"'{crit['name']}' must be a finite number."
                    continue
                low, high = crit.get("min"), crit.get("max")
                passed = (low in (None, "") or num >= Decimal(str(low))) and (high in (None, "") or num <= Decimal(str(high)))
                value = str(num)
            else:
                passed = bool(str(value).strip())
            results.append({"code": code, "name": crit["name"], "type": kind, "value": value,
                            "mandatory": mandatory, "passed": passed})
            if not passed:
                if mandatory:
                    mandatory_failed = True
                else:
                    optional_failed = True
        if errors:
            raise ValidationError({f"criteria_results.{code}": msg for code, msg in errors.items()})
        return results, mandatory_failed, optional_failed

    @classmethod
    @transaction.atomic
    def set_disposition(cls, inspection: ReceiptInspection, disposition: str) -> ReceiptInspection:
        rej_cfg = cls.cfg(Submodule.REJECTED)
        inspection = ReceiptInspection.objects.select_for_update().get(pk=inspection.pk)
        if inspection.rejected_quantity <= 0:
            raise ValidationError("This inspection has no rejected quantity.")
        if disposition not in rej_cfg["dispositions"]:
            raise ValidationError({"rejection_disposition": f"Must be one of: {', '.join(rej_cfg['dispositions'])}."})
        inspection.rejection_disposition = disposition
        inspection.save(update_fields=["rejection_disposition"])
        return inspection

    # ---------------------------------------------------------------- putaway
    @classmethod
    @transaction.atomic
    def record_putaway(cls, tx: StockTransaction, data: Dict[str, Any], actor: str) -> ReceiptPutaway:
        tx = cls._lock(tx)
        p_cfg = cls.cfg(Submodule.PUTAWAY)
        if tx.status not in PUTAWAY_OPEN:
            raise ValidationError(f"Putaway is not possible while the receipt is {tx.get_status_display()}.")
        cls._require_processing_allowed(tx)
        line = cls._line_of(tx, data.get("line"))
        if line.pending_inspection_quantity > 0:
            raise ValidationError("Complete inspection of this line before putaway.")

        qty = _dec(data.get("quantity"), "quantity")
        if qty <= 0:
            raise ValidationError({"quantity": "Putaway quantity must be greater than zero."})
        try:
            UOMConversionService.validate_fractional_allowed(line.transaction_uom, qty)
        except ValidationError as exc:
            raise ValidationError({"quantity": exc.messages[0]}) from exc
        eligible = line.accepted_quantity - line.putaway_quantity
        if qty > eligible:
            raise ValidationError({
                "quantity": f"Only {eligible} accepted quantity is pending putaway "
                            f"(accepted {line.accepted_quantity}, already put away {line.putaway_quantity})."
            })
        if line.serial_numbers:
            base = qty * line.conversion_factor_at_txn
            if base != base.to_integral_value():
                raise ValidationError({"quantity": "Serial-tracked putaway must be in whole units."})

        loc_id = _pk(data.get("location"), "location")
        location = StorageLocation.objects.filter(pk=loc_id).first() if loc_id else None
        if not location:
            raise ValidationError({"location": "Destination location is required."})
        if location.warehouse_id != tx.warehouse_id:
            raise ValidationError({"location": f"Location {location.code} does not belong to warehouse {tx.warehouse.code}."})
        if not location.is_active:
            raise ValidationError({"location": f"Location {location.code} is inactive."})
        if p_cfg["require_location_allows_putaway"] and not location.allow_putaway:
            raise ValidationError({"location": f"Location {location.code} does not allow putaway."})
        if not p_cfg["allow_multiple_locations"]:
            other = line.putaways.filter(status=ReceiptPutaway.Status.COMPLETED).exclude(location=location).first()
            if other:
                raise ValidationError({"location": f"Multiple putaway locations are disabled; this line is going to {other.location.code}."})

        putaway_date = _date(data.get("putaway_date"), "putaway_date") or timezone.localdate()
        if putaway_date > timezone.localdate() or putaway_date < tx.transaction_date:
            raise ValidationError({"putaway_date": "Putaway date must be between the receipt date and today."})

        record = ReceiptPutaway.objects.create(
            putaway_number=cls._next_number(p_cfg["document_type"], ReceiptPutaway, "putaway_number"),
            receipt=tx,
            line=line,
            warehouse=tx.warehouse,
            location=location,
            quantity=qty,
            putaway_by=str(data.get("putaway_by") or actor)[:120],
            putaway_date=putaway_date,
            remarks=str(data.get("remarks") or ""),
        )
        cls._sync_line_putaway(line)
        cls.refresh_status(tx)
        return record

    @classmethod
    @transaction.atomic
    def cancel_putaway(cls, putaway: ReceiptPutaway, actor: str) -> ReceiptPutaway:
        tx = cls._lock(putaway.receipt)
        putaway = ReceiptPutaway.objects.select_for_update().get(pk=putaway.pk)
        if tx.status in CLOSED:
            raise ValidationError(f"Receipt is {tx.get_status_display()}; putaway can no longer be changed.")
        if putaway.status != ReceiptPutaway.Status.COMPLETED:
            raise ValidationError("Putaway is already cancelled.")
        putaway.status = ReceiptPutaway.Status.CANCELLED
        putaway.remarks = (f"{putaway.remarks}\n" if putaway.remarks else "") + f"Cancelled by {actor}"
        putaway.save(update_fields=["status", "remarks"])
        cls._sync_line_putaway(StockTransactionLine.objects.select_for_update().get(pk=putaway.line_id))
        cls.refresh_status(tx)
        return putaway

    @staticmethod
    def _sync_line_putaway(line: StockTransactionLine):
        done = line.putaways.filter(status=ReceiptPutaway.Status.COMPLETED)
        total = done.aggregate(t=Sum("quantity"))["t"] or ZERO
        first = done.order_by("id").first()
        line.putaway_quantity = total
        line.putaway_location = first.location if first else None
        if total == 0:
            line.putaway_status = LinePutaway.PENDING
        elif total < line.accepted_quantity:
            line.putaway_status = LinePutaway.PARTIAL
        else:
            line.putaway_status = LinePutaway.COMPLETED
        line.save(update_fields=["putaway_quantity", "putaway_location", "putaway_status"])

    # ---------------------------------------------------------------- posting
    @classmethod
    def build_posting_plan(cls, tx: StockTransaction) -> Dict[int, Dict[str, Any]]:
        mandatory = cls.putaway_mandatory()
        plan = {}
        for line in tx.lines.select_related("location"):
            allocations = [
                (p.location, p.quantity)
                for p in line.putaways.filter(status=ReceiptPutaway.Status.COMPLETED).select_related("location").order_by("id")
            ]
            remainder = line.accepted_quantity - line.putaway_quantity
            if remainder > 0:
                if mandatory:
                    raise ValidationError(f"Line {line.item.code}: {remainder} accepted quantity has not been put away.")
                allocations.append((line.location or tx.receiving_location, remainder))
            rejected = set(cls.rejected_serials(line)) | set(cls.held_serials(line))
            plan[line.id] = {
                "allocations": allocations,
                "serials": [s for s in (line.serial_numbers or []) if s not in rejected],
            }
        return plan

    @classmethod
    @transaction.atomic
    def post(cls, tx: StockTransaction, actor: str) -> StockTransaction:
        tx = cls._lock(tx)
        if tx.status == S.POSTED:
            raise AlreadyPostedError(f"Receipt {tx.document_number} is already posted; no stock was changed.")
        if tx.status not in POSTABLE:
            raise ValidationError(f"Receipt {tx.document_number} cannot be posted while {tx.get_status_display()}.")
        cls._require_processing_allowed(tx)

        totals = tx.lines.aggregate(pending=Sum("pending_inspection_quantity"), accepted=Sum("accepted_quantity"))
        if (totals["pending"] or ZERO) > 0:
            raise ValidationError("Inspection is still pending on one or more lines.")
        if (totals["accepted"] or ZERO) <= 0:
            raise ValidationError("No accepted quantity to post.")
        disc = cls.cfg(Submodule.DISCREPANCY)
        if disc["enabled"] and disc["block_posting_with_open_discrepancies"] and tx.receipt_discrepancies.filter(
            resolution_status__in=[ReceiptDiscrepancy.ResolutionStatus.OPEN, ReceiptDiscrepancy.ResolutionStatus.UNDER_REVIEW]
        ).exists():
            raise ValidationError("Resolve open discrepancies before posting.")

        plan = cls.build_posting_plan(tx)
        cls._transition(tx, S.POSTED)
        InventoryPostingService.post_transaction(tx, actor=actor, receipt_plan=plan)
        tx.refresh_from_db()
        cls.notify("posted", tx)
        return tx

    @classmethod
    @transaction.atomic
    def reverse(cls, tx: StockTransaction, actor: str, reason: str) -> StockTransaction:
        if not reason:
            raise ValidationError({"reason": "A reversal reason is required."})
        tx = InventoryPostingService.reverse_receipt(tx, actor=actor, reason=reason)
        cls.notify("reversed", tx, {"reason": reason})
        return tx

    # ----------------------------------------------------------- discrepancies
    @classmethod
    def _create_discrepancy(cls, tx, line, kind, reason, actor, system=False, **extra) -> ReceiptDiscrepancy:
        d_cfg = cls.cfg(Submodule.DISCREPANCY)
        expected = extra.pop("expected_quantity", line.expected_quantity if line else None)
        received = extra.pop("received_quantity", line.quantity if line else None)
        record = ReceiptDiscrepancy.objects.create(
            discrepancy_number=cls._next_number(d_cfg["document_type"], ReceiptDiscrepancy, "discrepancy_number"),
            receipt=tx,
            line=line,
            discrepancy_type=kind,
            expected_quantity=expected,
            received_quantity=received,
            difference_quantity=(received or ZERO) - (expected or ZERO) if expected is not None and received is not None else ZERO,
            reason=reason,
            is_system_generated=system,
            created_by=actor,
            **extra,
        )
        cls.notify("discrepancy_raised", tx, {"discrepancy_number": record.discrepancy_number, "type": kind})
        return record

    @classmethod
    @transaction.atomic
    def create_discrepancy(cls, tx: StockTransaction, data: Dict[str, Any], actor: str) -> ReceiptDiscrepancy:
        tx = cls._lock(tx)
        d_cfg = cls.cfg(Submodule.DISCREPANCY)
        if tx.status in (S.DRAFT, S.CANCELLED):
            raise ValidationError("Discrepancies can only be raised on submitted receipts.")
        kind = str(data.get("discrepancy_type") or "").strip()
        if kind not in d_cfg["discrepancy_types"]:
            raise ValidationError({"discrepancy_type": f"Must be one of: {', '.join(d_cfg['discrepancy_types'])}."})
        line = None
        if data.get("line"):
            line = tx.lines.filter(pk=_pk(data["line"], "line")).first()
            if not line:
                raise ValidationError({"line": "Line does not belong to this receipt."})
        reason = str(data.get("reason") or "").strip()
        if not reason:
            raise ValidationError({"reason": "A reason is required."})
        expected = _dec(data.get("expected_quantity"), "expected_quantity", allow_none=True)
        received = _dec(data.get("received_quantity"), "received_quantity", allow_none=True)
        extra = {"remarks": str(data.get("remarks") or "")}
        if expected is not None:
            extra["expected_quantity"] = expected
        if received is not None:
            extra["received_quantity"] = received
        return cls._create_discrepancy(tx, line, kind, reason, actor, **extra)

    RESOLUTION_FLOW = {
        ReceiptDiscrepancy.ResolutionStatus.OPEN: {ReceiptDiscrepancy.ResolutionStatus.UNDER_REVIEW,
                                                   ReceiptDiscrepancy.ResolutionStatus.RESOLVED},
        ReceiptDiscrepancy.ResolutionStatus.UNDER_REVIEW: {ReceiptDiscrepancy.ResolutionStatus.RESOLVED,
                                                           ReceiptDiscrepancy.ResolutionStatus.OPEN},
        ReceiptDiscrepancy.ResolutionStatus.RESOLVED: {ReceiptDiscrepancy.ResolutionStatus.CLOSED,
                                                       ReceiptDiscrepancy.ResolutionStatus.UNDER_REVIEW},
        ReceiptDiscrepancy.ResolutionStatus.CLOSED: set(),
    }

    @classmethod
    @transaction.atomic
    def update_discrepancy(cls, record: ReceiptDiscrepancy, data: Dict[str, Any], actor: str) -> ReceiptDiscrepancy:
        cls._lock(record.receipt)
        record = ReceiptDiscrepancy.objects.select_for_update().get(pk=record.pk)
        if record.resolution_status == ReceiptDiscrepancy.ResolutionStatus.CLOSED:
            raise ValidationError("Closed discrepancies cannot be changed.")
        new_status = data.get("resolution_status")
        if new_status and new_status != record.resolution_status:
            if new_status not in cls.RESOLUTION_FLOW.get(record.resolution_status, set()):
                raise ValidationError({"resolution_status": f"Cannot move from {record.resolution_status} to {new_status}."})
            if new_status == ReceiptDiscrepancy.ResolutionStatus.RESOLVED:
                notes = str(data.get("resolution_notes") or record.resolution_notes or "").strip()
                if not notes:
                    raise ValidationError({"resolution_notes": "Resolution notes are required to resolve a discrepancy."})
                record.resolved_by, record.resolved_at = actor, timezone.now()
            record.resolution_status = new_status
        for field in ("resolution_notes", "remarks", "reason"):
            if field in data:
                setattr(record, field, str(data[field] or ""))
        record.save()
        return record

    # -------------------------------------------------------------- summaries
    @staticmethod
    def line_summary(line: StockTransactionLine) -> Dict[str, Any]:
        return {
            "eligible_putaway_quantity": line.accepted_quantity - line.putaway_quantity,
        }

    @staticmethod
    def receipt_queryset():
        return StockTransaction.objects.filter(transaction_type=StockTransaction.TransactionType.RECEIPT)

    @staticmethod
    def open_receipt_filter() -> Q:
        return ~Q(status__in=OPEN_RECEIPT_EXCLUDED)
