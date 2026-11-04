import logging
from typing import Any, Dict
from django.core.exceptions import ValidationError
from services.posting_service import InventoryPostingService

logger = logging.getLogger("ecosystem.integration.purchase")


def handle_purchase_goods_received(
    payload: Dict[str, Any],
    tenant_id: str = "default-tenant",
    project_id: str = "prj-default",
    correlation_id: str = "",
) -> Dict[str, Any]:
    """
    Inbound event handler for 'purchase.goods_received'.
    Triggers inventory receipt, recalculates moving average valuation,
    updates stock balances atomically, and emits inventory.stock_changed outbox event.
    """
    logger.info("Executing handle_purchase_goods_received for PO %s", payload.get("purchase_order_id"))

    po_id = payload.get("purchase_order_id") or payload.get("po_number")
    grn_number = payload.get("grn_number") or f"GRN-{po_id}"
    supplier = payload.get("supplier") or ""
    warehouse_code = payload.get("warehouse_code") or payload.get("warehouse_id")
    lines = payload.get("lines") or []

    if not lines:
        raise ValidationError("Purchase goods receipt event contains no line items.")

    result = InventoryPostingService.process_purchase_goods_receipt(
        tenant_id=tenant_id,
        project_id=project_id,
        purchase_order_id=po_id,
        grn_number=grn_number,
        warehouse_code=warehouse_code,
        lines=lines,
        supplier=supplier,
        correlation_id=correlation_id,
        actor="integration:purchase",
    )
    return result

