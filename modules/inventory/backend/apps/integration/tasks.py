import logging
from typing import Any, Dict
from celery import shared_task
from apps.integration.services.outbox_service import OutboxService
from apps.integration.services.inbox_service import InboxConsumerService
from apps.integration.services.low_stock_service import LowStockAlertService
from apps.integration.services.notification_service import NotificationService

logger = logging.getLogger("ecosystem.integration.tasks")


@shared_task(name="apps.integration.tasks.drain_outbox_events_task", ignore_result=True)
def drain_outbox_events_task(batch_size: int = 50):
    """
    Scheduled background task that pulls pending transactional outbox events
    and publishes them to the external message broker/subscribers.
    """
    try:
        count = OutboxService.drain_pending_events(batch_size=batch_size)
        if count > 0:
            logger.info("Outbox drainer published %d pending events.", count)
    except Exception as e:
        logger.error("Outbox drainer task failed: %s", e)


@shared_task(name="apps.integration.tasks.process_incoming_event_task")
def process_incoming_event_task(event_packet: Dict[str, Any]) -> Dict[str, Any]:
    """
    Asynchronous worker task that handles an inbound event through the idempotent inbox.
    """
    try:
        return InboxConsumerService.receive_event(event_packet)
    except Exception as e:
        logger.error("Async inbox processing task failed: %s", e)
        return {"status": "ERROR", "error": str(e)}


@shared_task(name="apps.integration.tasks.check_low_stock_thresholds_task", ignore_result=True)
def check_low_stock_thresholds_task():
    """
    Periodic job that sweeps stock balances and publishes suppressed low-stock alerts.
    """
    try:
        alert_count = LowStockAlertService.check_all_balances()
        if alert_count > 0:
            logger.info("Low-stock sweep triggered %d new alerts.", alert_count)
    except Exception as e:
        logger.error("Periodic low-stock sweep failed: %s", e)


@shared_task(name="apps.integration.tasks.scan_inventory_notifications_task", ignore_result=True)
def scan_inventory_notifications_task():
    try:
        count = NotificationService.scan()
        if count:
            logger.info("Inventory notification scan found %d active alerts.", count)
    except Exception as e:
        logger.exception("Inventory notification scan failed: %s", e)


@shared_task(name="apps.integration.tasks.retry_dead_letter_task")
def retry_dead_letter_task(error_id: str, operator: str = "celery_worker") -> bool:
    """
    Worker task to retry a failed event from the Dead-Letter Queue.
    """
    try:
        return OutboxService.retry_dead_letter_event(error_id, resolved_by=operator)
    except Exception as e:
        logger.error("Retry dead-letter task failed for %s: %s", error_id, e)
        return False
