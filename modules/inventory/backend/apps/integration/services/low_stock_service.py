import logging
from datetime import timedelta
from decimal import Decimal
from typing import Optional
from django.utils import timezone
from apps.configuration.models import InventoryConfiguration
from apps.integration.models import OutboxEvent, IntegrationSettings
from apps.integration.services.outbox_service import OutboxService
from apps.integration.services.event_contracts import EVENT_INVENTORY_LOW_STOCK

logger = logging.getLogger("ecosystem.integration.low_stock")


class LowStockAlertService:
    """
    Monitors inventory levels and generates suppressed low-stock alerts.
    Prevents event storms by throttling duplicate alerts within a configurable window.
    """

    @classmethod
    def evaluate_and_alert(
        cls,
        balance,
        tenant_id: str = "default-tenant",
        project_id: str = "prj-default",
        correlation_id: Optional[str] = None,
    ) -> Optional[OutboxEvent]:
        """
        Evaluates a single StockBalance record. If available stock is at or below
        the threshold and no recent alert has been emitted, an outbox event is created.
        """
        settings = IntegrationSettings.get_settings()
        if not settings.enable_low_stock_alerts:
            return None

        config = InventoryConfiguration.get_solo()
        item = balance.item
        warehouse = balance.warehouse

        threshold = item.reorder_point if item.reorder_point > Decimal("0.0000") else config.default_low_stock_threshold

        # Low stock condition
        if balance.available_qty > threshold:
            return None

        # Check suppression window
        aggregate_id = f"{item.id}:{warehouse.id}"
        cutoff = timezone.now() - timedelta(hours=settings.low_stock_suppression_hours)

        recent_alert = OutboxEvent.objects.filter(
            event_type=EVENT_INVENTORY_LOW_STOCK,
            aggregate_type="StockBalance",
            aggregate_id=aggregate_id,
            created_at__gte=cutoff,
        ).exists()

        if recent_alert:
            logger.debug(
                "Suppressed low-stock alert for item %s at warehouse %s (already alerted within %dh)",
                item.code,
                warehouse.code,
                settings.low_stock_suppression_hours,
            )
            return None

        # Calculate suggested reorder quantity
        suggested_qty = item.reorder_quantity if item.reorder_quantity > Decimal("0.0000") else (threshold * Decimal("2.0"))

        payload = {
            "item_id": item.id,
            "item_code": item.code,
            "item_name": item.name,
            "warehouse_id": warehouse.id,
            "warehouse_code": warehouse.code,
            "warehouse_name": warehouse.name,
            "current_on_hand": float(balance.on_hand_qty),
            "current_available": float(balance.available_qty),
            "reserved_qty": float(balance.reserved_qty),
            "threshold": float(threshold),
            "suggested_reorder_qty": float(suggested_qty),
            "severity": "CRITICAL" if balance.available_qty <= Decimal("0.0000") else "WARNING",
            "alerted_at": timezone.now().isoformat(),
        }

        outbox_event = OutboxService.record_event(
            event_type=EVENT_INVENTORY_LOW_STOCK,
            aggregate_type="StockBalance",
            aggregate_id=aggregate_id,
            payload=payload,
            tenant_id=tenant_id,
            project_id=project_id,
            correlation_id=correlation_id,
        )
        logger.warning(
            "LOW STOCK ALERT: Item %s at %s has available stock of %s (threshold: %s)",
            item.code,
            warehouse.code,
            balance.available_qty,
            threshold,
        )
        return outbox_event

    @classmethod
    def check_all_balances(cls, tenant_id: str = "default-tenant") -> int:
        """
        Batch check across all stock balances (used by scheduled Celery task).
        """
        from apps.stock.models import StockBalance
        balances = StockBalance.objects.select_related("item", "warehouse").all()
        alert_count = 0
        for bal in balances:
            if cls.evaluate_and_alert(bal, tenant_id=tenant_id):
                alert_count += 1
        return alert_count

