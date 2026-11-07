"""
Goods Receipt & Inspection configuration engine.

Each submodule has an independently versioned settings document. Documents are
validated against SCHEMA so that the JSON stored in PostgreSQL always has a
known shape; GoodsReceiptService reads the *active* document (latest version
whose effective_from <= today) and enforces it.
"""
import copy
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.configuration.models import ConfigurationAuditLog
from apps.goods_receipt.models import GoodsReceiptSettingVersion

Submodule = GoodsReceiptSettingVersion.Submodule

NOTIFICATION_EVENTS = [
    "submitted",
    "approved",
    "inspection_completed",
    "quality_failed",
    "putaway_completed",
    "posted",
    "reversed",
    "discrepancy_raised",
]
OPTIONAL_HEADER_FIELDS = [
    "external_reference",
    "supplier",
    "supplier_reference",
    "purchase_order_reference",
    "expected_delivery_date",
    "receiving_location",
    "remarks",
    "attachments",
]


def _notifications(events):
    return {"enabled": False, "events": list(events), "recipients": []}


DEFAULTS: Dict[str, Dict[str, Any]] = {
    Submodule.REGISTER: {
        "enabled": True,
        "required_permission": "inventory.grn.view",
        "page_size": 25,
        "default_status_filter": "",
        "notifications": _notifications([]),
    },
    Submodule.CREATE: {
        "enabled": True,
        "required_permission": "inventory.grn.create",
        "document_type": "Goods Receipt",
        "allow_manual_number": False,
        "manual_number_permission": "inventory.grn.manual_number",
        "receipt_types": [
            {"code": "PURCHASE", "label": "Purchase Receipt"},
            {"code": "DIRECT", "label": "Direct Receipt"},
            {"code": "RETURN_FROM_CUSTOMER", "label": "Customer Return"},
            {"code": "PRODUCTION", "label": "Production Output"},
            {"code": "OTHER", "label": "Other Receipt"},
        ],
        "default_receipt_type": "PURCHASE",
        "default_warehouse_id": None,
        "default_location_id": None,
        "require_receiving_location": True,
        "required_fields": [],
        "require_expected_quantity_with_po": True,
        "over_receipt_policy": "BLOCK",
        "over_receipt_tolerance_percent": 0,
        "allow_future_receipt_date": False,
        "max_backdate_days": 30,
        "allow_duplicate_lines": False,
        "enforce_batch_tracking": True,
        "enforce_serial_tracking": True,
        "enforce_expiry_tracking": True,
        "reject_expired_goods": True,
        "min_remaining_shelf_life_days": 0,
        "approval_required": False,
        "approval_permission": "inventory.grn.approve",
        "post_permission": "inventory.grn.post",
        "reverse_permission": "inventory.grn.reverse",
        "notifications": _notifications(["submitted", "approved", "posted", "reversed"]),
    },
    Submodule.INSPECTION: {
        "enabled": True,
        "required_permission": "inventory.grn.inspect",
        "document_type": "Receipt Inspection",
        "inspection_mode": "OPTIONAL",
        "default_inspection_required": False,
        "notifications": _notifications(["inspection_completed"]),
    },
    Submodule.QUALITY: {
        "enabled": True,
        "required_permission": "inventory.grn.quality",
        "document_type": "Quality Inspection",
        "quality_inspection_required": False,
        "inspection_types": ["Visual", "Dimensional", "Functional", "Laboratory"],
        "criteria": [],
        "max_failure_rate_percent": 0,
        "notifications": _notifications(["quality_failed"]),
    },
    Submodule.ACCEPTED: {
        "enabled": True,
        "required_permission": "inventory.grn.view",
        "page_size": 25,
        "notifications": _notifications([]),
    },
    Submodule.REJECTED: {
        "enabled": True,
        "required_permission": "inventory.grn.view",
        "disposition_permission": "inventory.grn.inspect",
        "page_size": 25,
        "require_rejection_reason": True,
        "rejection_reasons": ["Damaged", "Wrong Item", "Quality Failure", "Expired", "Short Shelf Life", "Other"],
        "dispositions": ["Return to Supplier", "Scrap", "Hold for Review"],
        "default_disposition": "Hold for Review",
        "notifications": _notifications([]),
    },
    Submodule.PARTIAL: {
        "enabled": True,
        "required_permission": "inventory.grn.view",
        "allow_partial_acceptance": True,
        "page_size": 25,
        "notifications": _notifications([]),
    },
    Submodule.PUTAWAY: {
        "enabled": True,
        "required_permission": "inventory.grn.putaway",
        "document_type": "Putaway",
        "putaway_mandatory": False,
        "allow_multiple_locations": True,
        "require_location_allows_putaway": True,
        "notifications": _notifications(["putaway_completed"]),
    },
    Submodule.DISCREPANCY: {
        "enabled": True,
        "required_permission": "inventory.grn.discrepancy",
        "document_type": "Receipt Discrepancy",
        "discrepancy_types": ["SHORTAGE", "EXCESS", "DAMAGED", "WRONG_ITEM", "QUALITY", "OTHER"],
        "auto_create_on_quantity_variance": True,
        "auto_create_on_rejection": False,
        "block_posting_with_open_discrepancies": False,
        "notifications": _notifications(["discrepancy_raised"]),
    },
    Submodule.HISTORY: {
        "enabled": True,
        "required_permission": "inventory.grn.view",
        "page_size": 25,
        "include_cancelled": True,
        "notifications": _notifications([]),
    },
}

# key -> (type, constraint). Types: bool, int, number, str, enum, list_str,
# list_obj, notifications, optional_int.
SCHEMA: Dict[str, Dict[str, tuple]] = {
    Submodule.REGISTER: {
        "page_size": ("int", (5, 200)),
        "default_status_filter": ("str", None),
    },
    Submodule.CREATE: {
        "document_type": ("str", None),
        "allow_manual_number": ("bool", None),
        "manual_number_permission": ("str", None),
        "receipt_types": ("list_obj", ("code", "label")),
        "default_receipt_type": ("str", None),
        "default_warehouse_id": ("optional_int", None),
        "default_location_id": ("optional_int", None),
        "require_receiving_location": ("bool", None),
        "required_fields": ("list_str", OPTIONAL_HEADER_FIELDS),
        "require_expected_quantity_with_po": ("bool", None),
        "over_receipt_policy": ("enum", ["BLOCK", "WARN", "ALLOW"]),
        "over_receipt_tolerance_percent": ("number", (0, 1000)),
        "allow_future_receipt_date": ("bool", None),
        "max_backdate_days": ("int", (0, 3650)),
        "allow_duplicate_lines": ("bool", None),
        "enforce_batch_tracking": ("bool", None),
        "enforce_serial_tracking": ("bool", None),
        "enforce_expiry_tracking": ("bool", None),
        "reject_expired_goods": ("bool", None),
        "min_remaining_shelf_life_days": ("int", (0, 3650)),
        "approval_required": ("bool", None),
        "approval_permission": ("str", None),
        "post_permission": ("str", None),
        "reverse_permission": ("str", None),
    },
    Submodule.INSPECTION: {
        "document_type": ("str", None),
        "inspection_mode": ("enum", ["OPTIONAL", "MANDATORY", "DISABLED"]),
        "default_inspection_required": ("bool", None),
    },
    Submodule.QUALITY: {
        "document_type": ("str", None),
        "quality_inspection_required": ("bool", None),
        "inspection_types": ("list_str", None),
        "criteria": ("list_obj", ("code", "name", "type")),
        "max_failure_rate_percent": ("number", (0, 100)),
    },
    Submodule.ACCEPTED: {"page_size": ("int", (5, 200))},
    Submodule.REJECTED: {
        "page_size": ("int", (5, 200)),
        "disposition_permission": ("str", None),
        "require_rejection_reason": ("bool", None),
        "rejection_reasons": ("list_str", None),
        "dispositions": ("list_str", None),
        "default_disposition": ("str", None),
    },
    Submodule.PARTIAL: {
        "allow_partial_acceptance": ("bool", None),
        "page_size": ("int", (5, 200)),
    },
    Submodule.PUTAWAY: {
        "document_type": ("str", None),
        "putaway_mandatory": ("bool", None),
        "allow_multiple_locations": ("bool", None),
        "require_location_allows_putaway": ("bool", None),
    },
    Submodule.DISCREPANCY: {
        "document_type": ("str", None),
        "discrepancy_types": ("list_str", None),
        "auto_create_on_quantity_variance": ("bool", None),
        "auto_create_on_rejection": ("bool", None),
        "block_posting_with_open_discrepancies": ("bool", None),
    },
    Submodule.HISTORY: {
        "page_size": ("int", (5, 200)),
        "include_cancelled": ("bool", None),
    },
}
COMMON_SCHEMA = {
    "enabled": ("bool", None),
    "required_permission": ("str", None),
    "notifications": ("notifications", None),
}
CRITERION_TYPES = ("BOOLEAN", "NUMERIC", "TEXT")


class GoodsReceiptConfigService:
    @classmethod
    def submodules(cls):
        return [choice for choice, _ in Submodule.choices]

    @classmethod
    def _check_submodule(cls, submodule: str):
        if submodule not in DEFAULTS:
            raise ValidationError(f"Unknown goods receipt submodule '{submodule}'.")

    @classmethod
    def defaults(cls, submodule: str) -> Dict[str, Any]:
        cls._check_submodule(submodule)
        return copy.deepcopy(DEFAULTS[submodule])

    @classmethod
    def active_version(cls, submodule: str, on_date: Optional[date] = None) -> Optional[GoodsReceiptSettingVersion]:
        cls._check_submodule(submodule)
        on_date = on_date or timezone.localdate()
        return (
            GoodsReceiptSettingVersion.objects.filter(submodule=submodule, effective_from__lte=on_date)
            .order_by("-effective_from", "-id")
            .first()
        )

    @classmethod
    def get(cls, submodule: str, on_date: Optional[date] = None) -> Dict[str, Any]:
        """Active settings merged over defaults, so keys added later always resolve."""
        merged = cls.defaults(submodule)
        version = cls.active_version(submodule, on_date)
        if version:
            merged.update(version.settings or {})
        return merged

    @classmethod
    def get_all(cls) -> Dict[str, Dict[str, Any]]:
        return {sm: cls.get(sm) for sm in cls.submodules()}

    @classmethod
    def validate(
        cls, submodule: str, payload: Dict[str, Any], on_date: Optional[date] = None
    ) -> Dict[str, Any]:
        cls._check_submodule(submodule)
        if not isinstance(payload, dict):
            raise ValidationError("Settings must be an object.")
        schema = {**COMMON_SCHEMA, **SCHEMA[submodule]}
        errors = {}
        clean = {}
        for key, value in payload.items():
            if key not in schema:
                errors[key] = "Unknown setting."
                continue
            kind, constraint = schema[key]
            try:
                clean[key] = cls._coerce(kind, constraint, value)
            except ValidationError as exc:
                errors[key] = exc.messages[0]
        if errors:
            raise ValidationError(errors)

        merged = {**cls.get(submodule, on_date=on_date), **clean}
        cls._cross_validate(submodule, merged)
        return merged

    @classmethod
    def _coerce(cls, kind, constraint, value):
        if kind == "bool":
            if not isinstance(value, bool):
                raise ValidationError("Must be true or false.")
            return value
        if kind in ("int", "optional_int"):
            if value is None and kind == "optional_int":
                return None
            if isinstance(value, bool) or not isinstance(value, int):
                raise ValidationError("Must be a whole number.")
            if constraint and not (constraint[0] <= value <= constraint[1]):
                raise ValidationError(f"Must be between {constraint[0]} and {constraint[1]}.")
            return value
        if kind == "number":
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValidationError("Must be a number.")
            if constraint and not (constraint[0] <= value <= constraint[1]):
                raise ValidationError(f"Must be between {constraint[0]} and {constraint[1]}.")
            return value
        if kind == "str":
            if not isinstance(value, str):
                raise ValidationError("Must be text.")
            return value.strip()
        if kind == "enum":
            if value not in constraint:
                raise ValidationError(f"Must be one of: {', '.join(constraint)}.")
            return value
        if kind == "list_str":
            if not isinstance(value, list) or not all(isinstance(v, str) and v.strip() for v in value):
                raise ValidationError("Must be a list of non-empty text values.")
            cleaned = [v.strip() for v in value]
            if len(set(cleaned)) != len(cleaned):
                raise ValidationError("Values must be unique.")
            if constraint:
                bad = [v for v in cleaned if v not in constraint]
                if bad:
                    raise ValidationError(f"Unsupported values: {', '.join(bad)}.")
            return cleaned
        if kind == "list_obj":
            if not isinstance(value, list):
                raise ValidationError("Must be a list.")
            codes = set()
            cleaned = []
            allowed_fields = set(constraint)
            if "type" in constraint:
                allowed_fields.update({"mandatory", "min", "max"})
            for entry in value:
                if not isinstance(entry, dict) or any(not str(entry.get(k, "")).strip() for k in constraint):
                    raise ValidationError(f"Each entry needs: {', '.join(constraint)}.")
                code = str(entry["code"]).strip()
                code_key = code.casefold()
                if code_key in codes:
                    raise ValidationError(f"Duplicate code '{code}'.")
                codes.add(code_key)
                if "type" in constraint and entry["type"] not in CRITERION_TYPES:
                    raise ValidationError(f"Criterion type must be one of: {', '.join(CRITERION_TYPES)}.")
                unknown = set(entry) - allowed_fields
                if unknown:
                    raise ValidationError(f"Unknown entry fields: {', '.join(sorted(unknown))}.")
                cleaned_entry = {
                    key: str(entry[key]).strip() if key in ("code", "name", "label", "type") else entry[key]
                    for key in entry
                }
                if "mandatory" in entry and not isinstance(entry["mandatory"], bool):
                    raise ValidationError("Criterion mandatory must be true or false.")
                if "type" in constraint:
                    bounds = {}
                    for bound in ("min", "max"):
                        if bound not in entry or entry[bound] in (None, ""):
                            continue
                        if entry["type"] != "NUMERIC" or isinstance(entry[bound], bool):
                            raise ValidationError("Only numeric criteria may have numeric min/max bounds.")
                        try:
                            number = Decimal(str(entry[bound]))
                        except (InvalidOperation, ValueError):
                            raise ValidationError(f"Criterion {bound} must be a finite number.")
                        if not number.is_finite():
                            raise ValidationError(f"Criterion {bound} must be a finite number.")
                        bounds[bound] = number
                    if "min" in bounds and "max" in bounds and bounds["min"] > bounds["max"]:
                        raise ValidationError("Criterion minimum cannot exceed its maximum.")
                cleaned.append(cleaned_entry)
            return cleaned
        if kind == "notifications":
            if not isinstance(value, dict):
                raise ValidationError("Must be an object.")
            enabled = value.get("enabled", False)
            events = value.get("events", [])
            recipients = value.get("recipients", [])
            if not isinstance(enabled, bool):
                raise ValidationError("notifications.enabled must be true or false.")
            if not isinstance(events, list) or any(e not in NOTIFICATION_EVENTS for e in events):
                raise ValidationError(f"notifications.events must be drawn from: {', '.join(NOTIFICATION_EVENTS)}.")
            if not isinstance(recipients, list) or not all(isinstance(r, str) for r in recipients):
                raise ValidationError("notifications.recipients must be a list of text values.")
            return {"enabled": enabled, "events": events, "recipients": [r.strip() for r in recipients if r.strip()]}
        raise ValidationError("Unsupported setting type.")

    @classmethod
    def _cross_validate(cls, submodule, merged):
        if submodule == Submodule.CREATE:
            codes = [t["code"] for t in merged["receipt_types"]]
            if not codes:
                raise ValidationError({"receipt_types": "At least one receipt type is required."})
            if merged["default_receipt_type"] and merged["default_receipt_type"] not in codes:
                raise ValidationError({"default_receipt_type": "Must be one of the configured receipt types."})
            from apps.warehouses.models import Warehouse, StorageLocation

            wh_id = merged.get("default_warehouse_id")
            loc_id = merged.get("default_location_id")
            if wh_id and not Warehouse.objects.filter(pk=wh_id, is_active=True).exists():
                raise ValidationError({"default_warehouse_id": "Warehouse does not exist or is inactive."})
            if loc_id:
                loc = StorageLocation.objects.filter(pk=loc_id, is_active=True).first()
                if not loc:
                    raise ValidationError({"default_location_id": "Location does not exist or is inactive."})
                if wh_id and loc.warehouse_id != wh_id:
                    raise ValidationError({"default_location_id": "Location must belong to the default warehouse."})
        if submodule == Submodule.REJECTED:
            if merged["default_disposition"] and merged["default_disposition"] not in merged["dispositions"]:
                raise ValidationError({"default_disposition": "Must be one of the configured dispositions."})

    @classmethod
    @transaction.atomic
    def save(
        cls,
        submodule: str,
        payload: Dict[str, Any],
        actor: str,
        effective_from: Optional[date] = None,
        reason: str = "",
        is_reset: bool = False,
    ) -> GoodsReceiptSettingVersion:
        effective_from = effective_from or timezone.localdate()
        previous = cls.get(submodule, on_date=effective_from)
        new_settings = (
            cls.defaults(submodule)
            if is_reset
            else cls.validate(submodule, payload, on_date=effective_from)
        )
        version = GoodsReceiptSettingVersion.objects.create(
            submodule=submodule,
            settings=new_settings,
            effective_from=effective_from,
            change_reason=reason[:255],
            is_reset=is_reset,
            created_by=actor,
        )
        changed = {k for k in new_settings if previous.get(k) != new_settings.get(k)}
        ConfigurationAuditLog.objects.create(
            section=f"Goods Receipt: {Submodule(submodule).label}",
            action="RESET" if is_reset else "UPDATE",
            changed_by=actor,
            previous_values={k: previous.get(k) for k in changed},
            new_values={**{k: new_settings.get(k) for k in changed}, "_effective_from": str(effective_from)},
        )
        return version
