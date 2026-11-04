"""
CloudEvents 1.0 Specification and Schema Validation for Inventory Event Contracts.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid


class CloudEventSchema:
    @staticmethod
    def create_event(
        event_type: str,
        payload: Dict[str, Any],
        source: str = "ecosystem.inventory",
        tenant_id: str = "default-tenant",
        project_id: str = "prj-default",
        correlation_id: Optional[str] = None,
        causation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates a CloudEvents 1.0 compliant envelope."""
        event_id = str(uuid.uuid4())
        return {
            "specversion": "1.0",
            "id": event_id,
            "type": event_type,
            "source": source,
            "time": datetime.now(timezone.utc).isoformat(),
            "datacontenttype": "application/json",
            "tenantid": tenant_id,
            "projectid": project_id,
            "correlationid": correlation_id or event_id,
            "causationid": causation_id or "",
            "data": payload,
        }

    @staticmethod
    def validate_cloud_event(packet: Dict[str, Any]) -> bool:
        """Validates that a packet conforms to CloudEvents 1.0 requirements."""
        required = ["specversion", "id", "type", "source", "data"]
        for field in required:
            if field not in packet or not packet[field]:
                return False
        if str(packet.get("specversion")) != "1.0":
            return False
        return True


# Event Type Constants
EVENT_PURCHASE_GOODS_RECEIVED = "purchase.goods_received"
EVENT_SALES_ORDER_CONFIRMED = "sales.order_confirmed"
EVENT_SALES_ORDER_DISPATCHED = "sales.order_dispatched"
EVENT_SALES_ORDER_CANCELLED = "sales.order_cancelled"

EVENT_INVENTORY_STOCK_CHANGED = "inventory.stock_changed"
EVENT_INVENTORY_STOCK_RESERVED = "inventory.stock_reserved"
EVENT_INVENTORY_STOCK_RELEASED = "inventory.stock_released"
EVENT_INVENTORY_STOCK_ADJUSTED = "inventory.stock_adjusted"
EVENT_INVENTORY_LOW_STOCK = "inventory.low_stock"

