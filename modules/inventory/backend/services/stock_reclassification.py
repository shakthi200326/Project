"""
Stock Reclassification business rules.

Shared by StockOperationsService (draft/submit validation), the eligibility
API and InventoryPostingService (re-validation under row locks), so every
entry point enforces the same transitions and quantity limits.

Status buckets on StockBalance (all part of on-hand):
    AVAILABLE   -> balance.available_qty (excludes reserved stock)
    QUARANTINED -> balance.quarantined_qty
    BLOCKED     -> balance.blocked_qty
    DAMAGED     -> balance.damaged_qty
"""
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.batches.models import Batch
from apps.configuration.models import InventoryConfiguration
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.serial_numbers.models import SerialNumber
from apps.stock.models import StockBalance
from apps.units.models import UnitOfMeasure
from apps.warehouses.models import StorageLocation, Warehouse
from services.stock_operations_config import StockOperationsConfigService, Submodule

ZERO = Decimal("0.0000")
STATUSES = ("AVAILABLE", "QUARANTINED", "BLOCKED", "DAMAGED")
BUCKET_FIELD = {"QUARANTINED": "quarantined_qty", "BLOCKED": "blocked_qty", "DAMAGED": "damaged_qty"}

# Serial registry status that corresponds to each stock status.
SERIAL_STATUS = {
    "AVAILABLE": SerialNumber.Status.AVAILABLE,
    "QUARANTINED": SerialNumber.Status.QUARANTINED,
    "BLOCKED": SerialNumber.Status.BLOCKED,
    "DAMAGED": SerialNumber.Status.DAMAGED,
}
SERIAL_SOURCE_STATUSES = {
    "AVAILABLE": (SerialNumber.Status.AVAILABLE, SerialNumber.Status.IN_STOCK),
    "QUARANTINED": (SerialNumber.Status.QUARANTINED,),
    "BLOCKED": (SerialNumber.Status.BLOCKED,),
    "DAMAGED": (SerialNumber.Status.DAMAGED, SerialNumber.Status.DEFECTIVE),
}
CLOSED_BATCH_STATUSES = (
    Batch.Status.CLOSED, Batch.Status.UP_CLOSED, Batch.Status.REJECTED, Batch.Status.UP_REJECTED,
)
BATCH_TARGET_STATUS = {
    "AVAILABLE": Batch.Status.RELEASED,
    "QUARANTINED": Batch.Status.QUARANTINED,
    "BLOCKED": Batch.Status.QUARANTINED,
    "DAMAGED": Batch.Status.REJECTED,
}


def config() -> Dict[str, Any]:
    return StockOperationsConfigService.get(Submodule.STOCK_RECLASSIFICATION)


def bucket_qty(balance: Optional[StockBalance], status: str) -> Decimal:
    if balance is None:
        return ZERO
    if status == "AVAILABLE":
        return balance.available_qty
    return getattr(balance, BUCKET_FIELD[status])


def tracking_flags(item: InventoryItem) -> Dict[str, bool]:
    g = InventoryConfiguration.get_solo()
    return {
        "batch": bool(item.tracks_batches and g.enable_batch_tracking),
        "serial": bool(item.tracks_serials and g.enable_serial_tracking),
        "expiry": bool(item.expiry_tracking_required and g.enable_expiry_tracking),
    }


def uom_rules(item: InventoryItem) -> Dict[str, Any]:
    uom = item.base_uom or UnitOfMeasure.objects.filter(code__iexact=item.base_unit or "").first()
    if uom is None:
        return {"code": item.base_unit or "EA", "decimal_places": 4, "allow_fractional": True}
    places = max(0, min(int(uom.decimal_places or 0), 4))
    fractional = bool(uom.allow_fractional_quantity) and places > 0
    return {"code": uom.code, "decimal_places": places if fractional else 0, "allow_fractional": fractional}


def permitted_targets(from_status: str, expired: bool = False) -> List[str]:
    cfg = config()
    allowed = [s for s in cfg["transition_matrix"].get(from_status, []) if s in cfg["permitted_statuses"] and s != from_status]
    if expired:
        allowed = [s for s in allowed if s in cfg["expired_stock_targets"] and s != "AVAILABLE"]
    return allowed


def parse_quantity(value, item: InventoryItem) -> Decimal:
    try:
        qty = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise ValidationError({"quantity": "Quantity must be a number."})
    if not qty.is_finite() or qty <= 0:
        raise ValidationError({"quantity": "Reclassification quantity must be greater than zero."})
    rules = uom_rules(item)
    # Compare values, not representation: stored quantities come back as e.g. 10.0000.
    if qty != qty.quantize(Decimal(1).scaleb(-rules["decimal_places"])):
        if rules["decimal_places"] == 0:
            raise ValidationError({"quantity": f"{rules['code']} does not allow fractional quantities."})
        raise ValidationError({"quantity": f"{rules['code']} allows at most {rules['decimal_places']} decimal places."})
    return qty


def is_expired(batch: Optional[Batch], on_date: date) -> bool:
    return bool(batch and batch.expiry_date and batch.expiry_date < on_date)


def eligible_batches(item, variant, warehouse, location, from_status: str, on_date: date):
    qs = Batch.objects.filter(item=item, remaining_quantity__gt=0).exclude(batch_status__in=CLOSED_BATCH_STATUSES)
    if variant is not None:
        qs = qs.filter(variant__in=[variant]) | qs.filter(variant__isnull=True)
    # Batch.location only records where a batch was first stored, so batches are scoped by
    # warehouse; the location's status bucket caps the eligible quantity.
    qs = qs.filter(warehouse__in=[warehouse]) | qs.filter(warehouse__isnull=True)
    return qs.distinct().order_by("expiry_date", "batch_number")


def eligible_serials(item, variant, warehouse, location, from_status: str, batch: Optional[Batch] = None):
    qs = SerialNumber.objects.filter(item=item, warehouse=warehouse, status__in=SERIAL_SOURCE_STATUSES[from_status])
    if variant is not None:
        qs = qs.filter(variant=variant)
    qs = qs.filter(location=location) if location is not None else qs.filter(location__isnull=True)
    if batch is not None:
        qs = qs.filter(batch=batch)
    return qs.order_by("serial_number")


def validate_line(
    *,
    warehouse: Warehouse,
    item: InventoryItem,
    variant: Optional[InventoryItemVariant],
    source_location: Optional[StorageLocation],
    target_location: Optional[StorageLocation],
    from_status: str,
    to_status: str,
    quantity,
    batch_number: str,
    serial_numbers: List[str],
    effective_date: date,
    balance: Optional[StockBalance] = None,
) -> Dict[str, Any]:
    """
    Validates one reclassification line and returns the cleaned values.
    `balance` should be the row-locked source balance when called from posting.
    """
    cfg = config()
    errors: Dict[str, str] = {}

    if not item.is_active or item.status != InventoryItem.ItemStatus.ACTIVE:
        raise ValidationError({"item": f"Item {item.code} is not active."})
    if variant is not None and (variant.item_id != item.id or not variant.is_active):
        raise ValidationError({"variant": f"Variant does not belong to item {item.code} or is inactive."})
    if not warehouse.is_active:
        raise ValidationError({"warehouse": f"Warehouse {warehouse.code} is inactive."})

    from_status, to_status = (from_status or "").upper(), (to_status or "").upper()
    for key, value in (("from_status", from_status), ("to_status", to_status)):
        if value not in STATUSES or value not in cfg["permitted_statuses"]:
            errors[key] = f"Status must be one of: {', '.join(cfg['permitted_statuses'])}."
    if not errors and from_status == to_status:
        errors["to_status"] = "Target status must differ from the source status."
    if errors:
        raise ValidationError(errors)

    if source_location is not None and source_location.warehouse_id != warehouse.id:
        errors["location"] = f"Source location {source_location.code} does not belong to warehouse {warehouse.code}."
    target_types = cfg["target_location_types"].get(to_status) or []
    if target_location is not None:
        if not cfg["allow_location_change"]:
            errors["destination_location"] = "Location change is disabled for reclassification."
        elif target_location.warehouse_id != warehouse.id:
            errors["destination_location"] = f"Target location {target_location.code} does not belong to warehouse {warehouse.code}."
        elif not target_location.is_active:
            errors["destination_location"] = f"Target location {target_location.code} is inactive."
        elif source_location is not None and target_location.id == source_location.id:
            errors["destination_location"] = "Target location must differ from the source location."
        elif target_types and target_location.location_type not in target_types:
            errors["destination_location"] = f"{to_status} stock must move to a {' / '.join(target_types)} location."
    elif target_types:
        errors["destination_location"] = f"{to_status} stock must move to a {' / '.join(target_types)} location."

    today = timezone.localdate()
    if effective_date > today and not cfg["allow_future_effective_date"]:
        errors["transaction_date"] = "Effective date cannot be in the future."

    try:
        qty = parse_quantity(quantity, item)
    except ValidationError as exc:
        errors.update(exc.message_dict)
        qty = None

    flags = tracking_flags(item)
    batch = None
    batch_number = (batch_number or "").strip()
    if flags["batch"]:
        if not batch_number:
            errors["batch_number"] = f"Item {item.code} is batch-tracked; select a batch."
        else:
            batch = eligible_batches(item, variant, warehouse, source_location, from_status, effective_date).filter(
                batch_number=batch_number
            ).first()
            if batch is None:
                errors["batch_number"] = f"Batch {batch_number} is not an open batch of {item.code} at this location."
    elif batch_number:
        errors["batch_number"] = f"Item {item.code} is not batch-tracked."

    expired = is_expired(batch, effective_date)
    allowed = permitted_targets(from_status, expired)
    if "to_status" not in errors and to_status not in allowed:
        reason = "expired stock" if expired else from_status
        errors["to_status"] = (
            f"Transition {from_status} -> {to_status} is not permitted for {reason}. "
            f"Allowed: {', '.join(allowed) or 'none'}."
        )

    serials = [str(s).strip() for s in serial_numbers or [] if str(s).strip()]
    if flags["serial"]:
        if len(set(serials)) != len(serials):
            errors["serial_numbers"] = "Serial numbers must be unique."
        elif qty is not None and (qty != qty.to_integral_value() or len(serials) != int(qty)):
            errors["serial_numbers"] = f"Select exactly {qty.normalize()} serial number(s); {len(serials)} selected."
        else:
            found = set(
                eligible_serials(item, variant, warehouse, source_location, from_status, batch)
                .filter(serial_number__in=serials).values_list("serial_number", flat=True)
            )
            missing = [s for s in serials if s not in found]
            if missing:
                errors["serial_numbers"] = (
                    f"Not eligible ({from_status} at this location{' in this batch' if batch else ''}): {', '.join(missing)}."
                )
    elif serials:
        errors["serial_numbers"] = f"Item {item.code} is not serial-tracked."

    if qty is not None and "quantity" not in errors:
        if balance is None:
            balance = StockBalance.objects.filter(item=item, variant=variant, warehouse=warehouse, location=source_location).first()
        eligible = bucket_qty(balance, from_status)
        if batch is not None:
            eligible = min(eligible, batch.remaining_quantity)
        if qty > eligible:
            errors["quantity"] = f"Only {eligible.normalize()} {uom_rules(item)['code']} is eligible in {from_status}; requested {qty.normalize()}."

    if errors:
        raise ValidationError(errors)
    return {
        "quantity": qty,
        "from_status": from_status,
        "to_status": to_status,
        "batch": batch,
        "batch_number": batch_number,
        "serial_numbers": serials,
        "expired": expired,
    }
