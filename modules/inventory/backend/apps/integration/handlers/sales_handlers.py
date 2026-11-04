import logging
from typing import Any, Dict
from django.core.exceptions import ValidationError
from services.posting_service import InventoryPostingService

logger = logging.getLogger("ecosystem.integration.sales")


def handle_sales_order_confirmed(
    payload: Dict[str, Any],
    tenant_id: str = "default-tenant",
    project_id: str = "prj-default",
    correlation_id: str = "",
) -> Dict[str, Any]:
    """
    Inbound event handler for 'sales.order_confirmed'.
    Places a soft reservation on stock without physical deduction,
    safeguarding fulfillment and preventing double-booking.
    """
    so_id = payload.get("sales_order_id") or payload.get("order_number")
    customer = payload.get("customer") or ""
    warehouse_code = payload.get("warehouse_code") or payload.get("warehouse_id")
    lines = payload.get("lines") or []

    if not lines:
        raise ValidationError("Sales order confirmation event contains no line items.")

    return InventoryPostingService.reserve_sales_stock(
        tenant_id=tenant_id,
        project_id=project_id,
        sales_order_id=so_id,
        customer=customer,
        warehouse_code=warehouse_code,
        lines=lines,
        correlation_id=correlation_id,
        actor="integration:sales",
    )


def handle_sales_order_dispatched(
    payload: Dict[str, Any],
    tenant_id: str = "default-tenant",
    project_id: str = "prj-default",
    correlation_id: str = "",
) -> Dict[str, Any]:
    """
    Inbound event handler for 'sales.order_dispatched'.
    Consumes reserved stock and performs physical stock issue deduction.
    """
    so_id = payload.get("sales_order_id") or payload.get("order_number")
    dispatch_ref = payload.get("dispatch_ref") or payload.get("delivery_note") or f"DSP-{so_id}"
    warehouse_code = payload.get("warehouse_code") or payload.get("warehouse_id")
    lines = payload.get("lines") or []

    return InventoryPostingService.dispatch_sales_stock(
        tenant_id=tenant_id,
        project_id=project_id,
        sales_order_id=so_id,
        dispatch_ref=dispatch_ref,
        warehouse_code=warehouse_code,
        lines=lines,
        correlation_id=correlation_id,
        actor="integration:sales",
    )


def handle_sales_order_cancelled(
    payload: Dict[str, Any],
    tenant_id: str = "default-tenant",
    project_id: str = "prj-default",
    correlation_id: str = "",
) -> Dict[str, Any]:
    """
    Inbound event handler for 'sales.order_cancelled'.
    Releases previously held stock reservations back to available pool.
    """
    so_id = payload.get("sales_order_id") or payload.get("order_number")
    lines = payload.get("lines") or []

    return InventoryPostingService.release_sales_reservation(
        tenant_id=tenant_id,
        project_id=project_id,
        sales_order_id=so_id,
        lines=lines,
        correlation_id=correlation_id,
        actor="integration:sales",
    )

