"""
Stock Operations configuration engine.

Each of the 12 Stock Operations submodules has an independently versioned settings document:
1. Stock In
2. Stock Issue
3. Stock Transfer
4. Inter-Warehouse Transfer
6. Stock Adjustment
7. Stock Return
8. Opening Stock
9. Stock Reservation
10. Stock Release
11. Stock Reclassification
12. Stock Out

Settings are versioned and stored in inv_stock_ops_setting_versions.
StockOperationsConfigService resolves the *active* version (latest effective_from <= today)
and enforces business rules, permissions, approval thresholds, and document numbering.
"""
import copy
from datetime import date
from typing import Any, Dict, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.configuration.models import (
    StockOperationsSettingVersion,
    ConfigurationAuditLog,
    DocumentNumberingRule,
    InventoryConfiguration,
)

Submodule = StockOperationsSettingVersion.Submodule


def _notifications(events):
    return {"enabled": False, "events": list(events), "recipients": []}


DEFAULTS: Dict[str, Dict[str, Any]] = {
    Submodule.STOCK_IN: {
        "enabled": True,
        "required_permission": "inventory.stock_in.view",
        "page_size": 25,
        "default_status_filter": "",
        "allow_manual_stock_in": False,
        "notifications": _notifications(["posted"]),
    },
    Submodule.STOCK_ISSUE: {
        "enabled": True,
        "required_permission": "inventory.stock_issue.create",
        "document_type": "Stock Issue",
        "allow_manual_number": False,
        "manual_number_permission": "inventory.stock_issue.manual_number",
        "allow_negative_stock": False,
        "approval_required": True,
        "approval_permission": "inventory.stock_issue.approve",
        "post_permission": "inventory.stock_issue.post",
        "enforce_batch_tracking": True,
        "enforce_serial_tracking": True,
        "issue_types": ["Sales", "Production", "Internal Consumption", "Other"],
        "notifications": _notifications(["submitted", "approved", "posted"]),
    },
    Submodule.STOCK_TRANSFER: {
        "enabled": True,
        "required_permission": "inventory.stock_transfer.create",
        "document_type": "Stock Transfer",
        "allow_manual_number": False,
        "manual_number_permission": "inventory.stock_transfer.manual_number",
        "approval_required": True,
        "approval_permission": "inventory.stock_transfer.approve",
        "dispatch_permission": "inventory.stock_transfer.dispatch",
        "receive_permission": "inventory.stock_transfer.receive",
        "allow_partial_dispatch": True,
        "allow_partial_receipt": True,
        "require_transit_tracking": True,
        "notifications": _notifications(["submitted", "approved", "dispatched", "received"]),
    },
    Submodule.INTER_WAREHOUSE: {
        "enabled": True,
        "required_permission": "inventory.transfer_warehouse.create",
        "document_type": "Inter-Warehouse Transfer",
        "allow_manual_number": False,
        "require_different_warehouses": True,
        "approval_required": True,
        "allow_partial_dispatch": True,
        "allow_partial_receipt": True,
        "notifications": _notifications(["dispatched", "received"]),
    },
    Submodule.STOCK_ADJUSTMENT: {
        "enabled": True,
        "required_permission": "inventory.stock_adjustment.create",
        "document_type": "Stock Adjustment",
        "allow_manual_number": False,
        "approval_required": True,
        "approval_permission": "inventory.stock_adjustment.approve",
        "approval_threshold_amount": 500.0,
        "allow_negative_stock": False,
        "require_reason": True,
        "adjustment_types": ["Increase", "Decrease"],
        "reasons": [
            "Physical Count Difference",
            "Damage",
            "Loss",
            "Found Stock",
            "Data Correction",
            "Other",
        ],
        "notifications": _notifications(["submitted", "approved", "posted"]),
    },
    Submodule.STOCK_RETURN: {
        "enabled": True,
        "required_permission": "inventory.stock_return.create",
        "document_type": "Stock Return",
        "allow_manual_number": False,
        "approval_required": True,
        "approval_permission": "inventory.stock_return.approve",
        "require_original_reference": False,
        "inspection_required_for_customer_return": True,
        "return_types": ["Customer Return", "Supplier Return"],
        "product_conditions": ["Good", "Damaged", "Defective"],
        "return_dispositions": ["Restock", "Quarantine", "Repair", "Scrap", "Return to Supplier"],
        "notifications": _notifications(["inspected", "posted"]),
    },
    Submodule.OPENING_STOCK: {
        "enabled": True,
        "required_permission": "inventory.opening_stock.create",
        "document_type": "Opening Stock",
        "allow_manual_number": False,
        "prevent_duplicate_scope": True,
        "approval_required": False,
        "require_unit_cost": True,
        "notifications": _notifications(["posted"]),
    },
    Submodule.STOCK_RESERVATION: {
        "enabled": True,
        "required_permission": "inventory.stock_reservation.create",
        "document_type": "Stock Reservation",
        "allow_manual_number": False,
        "allow_over_reservation": False,
        "default_expiry_days": 30,
        "reservation_types": ["Sales", "Production", "Internal Use", "Other"],
        "notifications": _notifications(["created", "expired"]),
    },
    Submodule.STOCK_RELEASE: {
        "enabled": True,
        "required_permission": "inventory.stock_release.execute",
        "document_type": "Stock Release",
        "allow_manual_number": False,
        "prevent_over_release": True,
        "require_release_reason": True,
        "notifications": _notifications(["released"]),
    },
    Submodule.STOCK_RECLASSIFICATION: {
        "enabled": True,
        "required_permission": "inventory.stock_reclassification.create",
        "document_type": "Stock Reclassification",
        "allow_manual_number": False,
        "approval_required": True,
        "approval_permission": "inventory.stock_reclassification.approve",
        "require_reason": True,
        "permitted_statuses": ["AVAILABLE", "QUARANTINED", "BLOCKED", "DAMAGED"],
        # Allowed source -> target status moves; DAMAGED stock leaves via the Damaged Stock write-off.
        "transition_matrix": {
            "AVAILABLE": ["QUARANTINED", "BLOCKED", "DAMAGED"],
            "QUARANTINED": ["AVAILABLE", "BLOCKED", "DAMAGED"],
            "BLOCKED": ["AVAILABLE", "QUARANTINED", "DAMAGED"],
            "DAMAGED": [],
        },
        # Expired batches may only move to these statuses (never back to AVAILABLE).
        "expired_stock_targets": ["QUARANTINED", "BLOCKED", "DAMAGED"],
        "allow_location_change": True,
        # Optional {target_status: [StorageLocation.location_type, ...]}; empty = no location move required.
        "target_location_types": {},
        "allow_future_effective_date": False,
        "notifications": _notifications(["reclassified"]),
    },
    Submodule.STOCK_OUT: {
        "enabled": True,
        "required_permission": "inventory.stock_out.view",
        "page_size": 25,
        "default_source_filter": "",
        "notifications": _notifications(["posted"]),
    },
}


class StockOperationsConfigService:
    """
    Independently scoped configuration management and enforcement for
    all 12 Stock Operations submodules.
    """

    @classmethod
    def get(cls, submodule: str, target_date: Optional[date] = None) -> Dict[str, Any]:
        """
        Returns active settings for the given submodule.
        Falls back cleanly to DEFAULTS merged with any global settings.
        """
        if target_date is None:
            target_date = timezone.localdate()

        defaults = copy.deepcopy(DEFAULTS.get(submodule, {}))

        # Check for saved active version in database
        version = (
            StockOperationsSettingVersion.objects.filter(
                submodule=submodule, effective_from__lte=target_date
            )
            .order_by("-effective_from", "-id")
            .first()
        )

        merged = defaults
        if version and isinstance(version.settings, dict):
            merged.update(version.settings)

        # Inherit global negative stock policy if not explicitly overridden
        global_cfg = InventoryConfiguration.get_solo()
        if "allow_negative_stock" in merged and not version:
            merged["allow_negative_stock"] = global_cfg.allow_negative_stock

        return merged

    @classmethod
    @transaction.atomic
    def save(
        cls,
        submodule: str,
        new_settings: Dict[str, Any],
        actor: str = "Operations Admin",
        change_reason: str = "",
        effective_from: Optional[date] = None,
    ) -> StockOperationsSettingVersion:
        """
        Saves a new version of the submodule's settings and records audit log.
        """
        if effective_from is None:
            effective_from = timezone.localdate()

        current = cls.get(submodule, target_date=effective_from)
        clean_settings = copy.deepcopy(current)
        clean_settings.update(new_settings)

        version = StockOperationsSettingVersion.objects.create(
            submodule=submodule,
            settings=clean_settings,
            effective_from=effective_from,
            change_reason=change_reason or f"Updated {submodule} configuration",
            created_by=actor,
        )

        ConfigurationAuditLog.objects.create(
            section=f"stock_operations.{submodule}",
            action="UPDATE",
            changed_by=actor,
            previous_values=current,
            new_values=clean_settings,
        )

        return version

    @classmethod
    @transaction.atomic
    def reset(cls, submodule: str, actor: str = "Operations Admin") -> StockOperationsSettingVersion:
        """
        Resets submodule settings to default factory values.
        """
        defaults = copy.deepcopy(DEFAULTS.get(submodule, {}))
        version = StockOperationsSettingVersion.objects.create(
            submodule=submodule,
            settings=defaults,
            effective_from=timezone.localdate(),
            change_reason="Reset to defaults",
            is_reset=True,
            created_by=actor,
        )

        ConfigurationAuditLog.objects.create(
            section=f"stock_operations.{submodule}",
            action="RESET",
            changed_by=actor,
            previous_values=cls.get(submodule),
            new_values=defaults,
        )

        return version

    @classmethod
    def history(cls, submodule: str):
        """
        Returns full version audit history for the submodule.
        """
        return StockOperationsSettingVersion.objects.filter(submodule=submodule).order_by("-effective_from", "-id")

    @classmethod
    def get_all(cls, target_date: Optional[date] = None) -> Dict[str, Dict[str, Any]]:
        """
        Returns active configuration for all 12 submodules.
        """
        result = {}
        for sub, _ in Submodule.choices:
            result[sub] = cls.get(sub, target_date=target_date)
        return result
