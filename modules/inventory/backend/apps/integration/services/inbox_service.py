import logging
import time
import traceback
from typing import Any, Callable, Dict, Optional
from django.db import transaction
from django.utils import timezone
from apps.integration.models import (
    ProcessedEvent,
    EventProcessingAttempt,
    IntegrationError,
    IntegrationSettings,
)
from apps.integration.services.event_contracts import (
    CloudEventSchema,
    EVENT_PURCHASE_GOODS_RECEIVED,
    EVENT_SALES_ORDER_CONFIRMED,
    EVENT_SALES_ORDER_DISPATCHED,
    EVENT_SALES_ORDER_CANCELLED,
)

logger = logging.getLogger("ecosystem.integration.inbox")


class InboxConsumerService:
    """
    Idempotent Inbox Event Consumer.
    Ensures exactly-once business logic processing even when external producers
    retransmit identical event messages multiple times.
    """

    _registry: Dict[str, Callable] = {}

    @classmethod
    def register_handler(cls, event_type: str, handler: Callable):
        cls._registry[event_type] = handler
        logger.info("Registered inbox consumer for %s -> %s", event_type, handler.__name__)

    @classmethod
    def receive_event(cls, event_packet: Dict[str, Any]) -> Dict[str, Any]:
        """
        Receives, validates, deduplicates, and dispatches an incoming event packet.
        """
        start_time = time.perf_counter()
        now = timezone.now()

        # 1. Normalize packet fields
        event_id = str(event_packet.get("id") or "")
        event_type = str(event_packet.get("type") or "")
        source = str(event_packet.get("source") or "external")
        version = str(event_packet.get("specversion") or "1.0")
        tenant_id = str(
            event_packet.get("tenantid")
            or event_packet.get("tenant_id")
            or event_packet.get("context", {}).get("tenant_id")
            or "default-tenant"
        )
        project_id = str(
            event_packet.get("projectid")
            or event_packet.get("project_id")
            or event_packet.get("context", {}).get("project_id")
            or "prj-default"
        )
        correlation_id = str(event_packet.get("correlation_id") or event_packet.get("correlationid") or event_id)
        causation_id = str(event_packet.get("causation_id") or "")
        payload = event_packet.get("data") or {}

        if not event_id or not event_type:
            logger.warning("Rejecting invalid event packet missing id or type: %s", event_packet)
            return {"status": "REJECTED", "reason": "Missing required id or type"}

        settings = IntegrationSettings.get_settings()

        # Feature toggle checks
        if event_type.startswith("purchase.") and not settings.enable_purchase_integration:
            logger.info("Ignoring %s: Purchase integration disabled in settings", event_type)
            return {"status": "IGNORED", "reason": "Purchase integration disabled"}

        if event_type.startswith("sales.") and not settings.enable_sales_integration:
            logger.info("Ignoring %s: Sales integration disabled in settings", event_type)
            return {"status": "IGNORED", "reason": "Sales integration disabled"}

        # 2. Idempotency Check
        with transaction.atomic():
            processed_event, created = ProcessedEvent.objects.select_for_update().get_or_create(
                event_id=event_id,
                defaults={
                    "event_type": event_type,
                    "event_source": source,
                    "event_version": version,
                    "tenant_id": tenant_id,
                    "project_id": project_id,
                    "correlation_id": correlation_id,
                    "causation_id": causation_id,
                    "payload": payload,
                    "status": ProcessedEvent.Status.PROCESSING,
                },
            )

            if not created and processed_event.status == ProcessedEvent.Status.PROCESSED:
                logger.info(
                    "Duplicate event %s [%s] received - suppressing idempotent replay.",
                    event_id,
                    event_type,
                )
                return {
                    "status": "ALREADY_PROCESSED",
                    "event_id": event_id,
                    "idempotent": True,
                    "processed_at": processed_event.processed_at.isoformat() if processed_event.processed_at else None,
                }

            if not created:
                processed_event.status = ProcessedEvent.Status.PROCESSING
                processed_event.save(update_fields=["status"])

            attempt_count = processed_event.attempts.count() + 1
            attempt = EventProcessingAttempt.objects.create(
                event=processed_event,
                attempt_number=attempt_count,
                status=EventProcessingAttempt.Status.FAILED,
            )

        # 3. Route to Registered Handler
        handler = cls._registry.get(event_type)
        if not handler:
            err_msg = f"No handler registered for incoming event type '{event_type}'."
            logger.warning(err_msg)
            cls._record_failure(
                processed_event, attempt, err_msg, "", start_time, settings
            )
            return {"status": "NO_HANDLER", "error": err_msg}

        try:
            # Execute business logic handler
            result = handler(
                payload=payload,
                tenant_id=tenant_id,
                project_id=project_id,
                correlation_id=correlation_id,
            )

            # Handler succeeded
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            now = timezone.now()

            with transaction.atomic():
                processed_event.status = ProcessedEvent.Status.PROCESSED
                processed_event.processed_at = now
                processed_event.last_error = ""
                processed_event.save(update_fields=["status", "processed_at", "last_error"])

                attempt.status = EventProcessingAttempt.Status.SUCCESS
                attempt.completed_at = now
                attempt.duration_ms = duration_ms
                attempt.save(update_fields=["status", "completed_at", "duration_ms"])

            logger.info(
                "Processed event %s [%s] successfully in %d ms",
                event_id,
                event_type,
                duration_ms,
            )
            return {"status": "SUCCESS", "event_id": event_id, "duration_ms": duration_ms, "result": result}

        except Exception as exc:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            err_msg = str(exc)
            tb = traceback.format_exc()
            logger.error("Processing failed for event %s [%s]: %s", event_id, event_type, err_msg)
            cls._record_failure(
                processed_event, attempt, err_msg, tb, start_time, settings
            )
            return {"status": "FAILED", "event_id": event_id, "error": err_msg}

    @classmethod
    def _record_failure(
        cls,
        processed_event: ProcessedEvent,
        attempt: EventProcessingAttempt,
        err_msg: str,
        tb: str,
        start_time: float,
        settings: IntegrationSettings,
    ):
        now = timezone.now()
        duration_ms = int((time.perf_counter() - start_time) * 1000)

        with transaction.atomic():
            attempt.status = EventProcessingAttempt.Status.FAILED
            attempt.completed_at = now
            attempt.duration_ms = duration_ms
            attempt.error_message = err_msg
            attempt.stack_trace = tb
            attempt.save(
                update_fields=["status", "completed_at", "duration_ms", "error_message", "stack_trace"]
            )

            processed_event.last_error = f"{err_msg}\n{tb}"
            total_attempts = processed_event.attempts.count()

            if total_attempts >= settings.dead_letter_threshold:
                processed_event.status = ProcessedEvent.Status.DEAD_LETTER
                processed_event.save(update_fields=["status", "last_error"])

                IntegrationError.objects.create(
                    event_id=processed_event.event_id,
                    event_type=processed_event.event_type,
                    direction=IntegrationError.Direction.INBOUND,
                    payload=processed_event.payload,
                    error_type=err_msg.split(":")[0][:120],
                    error_message=err_msg,
                    stack_trace=tb,
                    retry_count=total_attempts,
                    status=IntegrationError.Status.UNRESOLVED,
                )
                logger.warning(
                    "Event %s dead-lettered after %d failed attempts",
                    processed_event.event_id,
                    total_attempts,
                )
            else:
                processed_event.status = ProcessedEvent.Status.FAILED
                processed_event.save(update_fields=["status", "last_error"])

