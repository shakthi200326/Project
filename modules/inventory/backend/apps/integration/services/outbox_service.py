import logging
import traceback
import uuid
from datetime import timedelta
from typing import Any, Dict, List, Optional
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from apps.integration.models import OutboxEvent, IntegrationError, IntegrationSettings
from apps.integration.services.event_contracts import CloudEventSchema
from shared_event_bus.publisher import EventPublisher

logger = logging.getLogger("ecosystem.integration.outbox")


class OutboxService:
    """
    Transactional Outbox Engine.
    Ensures that every domain event is durably staged in PostgreSQL before commit,
    and reliably delivered to external subscribers and Redis message bus.
    """

    @classmethod
    def record_event(
        cls,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        payload: Dict[str, Any],
        tenant_id: str = "default-tenant",
        project_id: str = "prj-default",
        correlation_id: Optional[str] = None,
        causation_id: Optional[str] = None,
        event_version: str = "1.0",
    ) -> OutboxEvent:
        """
        Record outbox event within the current active database transaction.
        If the outer transaction rolls back, this event is never published.
        """
        event_id = str(uuid.uuid4())
        settings = IntegrationSettings.get_settings()
        max_retries = settings.max_retry_attempts

        outbox_entry = OutboxEvent.objects.create(
            event_id=event_id,
            event_type=event_type,
            event_version=event_version,
            aggregate_type=aggregate_type,
            aggregate_id=str(aggregate_id),
            tenant_id=tenant_id or "default-tenant",
            project_id=project_id or "prj-default",
            payload=payload,
            correlation_id=correlation_id or event_id,
            causation_id=causation_id or "",
            status=OutboxEvent.Status.PENDING,
            max_retries=max_retries,
        )
        logger.info(
            "Staged outbox event %s [%s] for aggregate %s:%s",
            event_id,
            event_type,
            aggregate_type,
            aggregate_id,
        )
        return outbox_entry

    @classmethod
    def drain_pending_events(cls, batch_size: Optional[int] = None) -> int:
        """
        Polls for pending or retryable outbox events, delivers them to the event bus,
        and marks them published or schedules retry/DLQ on failure.
        Uses select_for_update(skip_locked=True) for multi-worker concurrency safety.
        """
        settings = IntegrationSettings.get_settings()
        limit = batch_size or settings.outbox_batch_size
        now = timezone.now()

        with transaction.atomic():
            candidates = list(
                OutboxEvent.objects.select_for_update(skip_locked=True)
                .filter(status=OutboxEvent.Status.PENDING)
                .order_by("created_at")[:limit]
            )

            # Also include retryable events whose backoff elapsed
            if len(candidates) < limit:
                retry_candidates = list(
                    OutboxEvent.objects.select_for_update(skip_locked=True)
                    .filter(
                        status=OutboxEvent.Status.FAILED,
                        next_retry_at__lte=now,
                        retry_count__lt=F("max_retries"),
                    )
                    .order_by("next_retry_at")[: limit - len(candidates)]
                )
                candidates.extend(retry_candidates)

        if not candidates:
            return 0

        published_count = 0
        for event in candidates:
            success = cls._publish_single_event(event, settings)
            if success:
                published_count += 1

        return published_count

    @classmethod
    def _publish_single_event(
        cls, event: OutboxEvent, settings: IntegrationSettings
    ) -> bool:
        """Publishes one event with error handling and DLQ recording."""
        now = timezone.now()
        cloud_event = CloudEventSchema.create_event(
            event_type=event.event_type,
            payload=event.payload,
            source="ecosystem.inventory",
            tenant_id=event.tenant_id,
            project_id=event.project_id,
            correlation_id=event.correlation_id,
            causation_id=event.causation_id,
        )
        cloud_event["id"] = event.event_id

        try:
            EventPublisher.publish(
                event_name=event.event_type,
                payload=cloud_event["data"],
                context={
                    "tenant_id": event.tenant_id,
                    "project_id": event.project_id,
                    "event_id": event.event_id,
                },
                correlation_id=event.correlation_id,
            )

            event.status = OutboxEvent.Status.PUBLISHED
            event.published_at = now
            event.last_error = ""
            event.save(update_fields=["status", "published_at", "last_error"])
            logger.info("Successfully published outbox event %s [%s]", event.event_id, event.event_type)
            return True

        except Exception as exc:
            err_msg = str(exc)
            tb = traceback.format_exc()
            logger.error("Failed to publish outbox event %s: %s", event.event_id, err_msg)

            event.retry_count += 1
            event.last_error = f"{err_msg}\n{tb}"

            if event.retry_count >= event.max_retries:
                event.status = OutboxEvent.Status.FAILED
                event.next_retry_at = None
                event.save(update_fields=["retry_count", "last_error", "status", "next_retry_at"])

                # Escalate to Dead-Letter Queue
                IntegrationError.objects.create(
                    event_id=event.event_id,
                    event_type=event.event_type,
                    direction=IntegrationError.Direction.OUTBOUND,
                    payload=event.payload,
                    error_type=type(exc).__name__,
                    error_message=err_msg,
                    stack_trace=tb,
                    retry_count=event.retry_count,
                    status=IntegrationError.Status.UNRESOLVED,
                )
            else:
                event.status = OutboxEvent.Status.FAILED
                backoff_secs = int((settings.backoff_multiplier ** event.retry_count) * 2)
                event.next_retry_at = now + timedelta(seconds=backoff_secs)
                event.save(update_fields=["retry_count", "last_error", "status", "next_retry_at"])

            return False

    @classmethod
    def retry_dead_letter_event(cls, error_id: str, resolved_by: str = "operator") -> bool:
        """Manual operator retry from the DLQ Management UI."""
        error = IntegrationError.objects.filter(id=error_id).first()
        if not error:
            return False

        event = OutboxEvent.objects.filter(event_id=error.event_id).first()
        if not event:
            return False

        event.retry_count = 0
        event.status = OutboxEvent.Status.PENDING
        event.next_retry_at = None
        event.save(update_fields=["retry_count", "status", "next_retry_at"])

        settings = IntegrationSettings.get_settings()
        success = cls._publish_single_event(event, settings)
        if success:
            error.status = IntegrationError.Status.RESOLVED
            error.resolved_by = resolved_by
            error.resolved_at = timezone.now()
            error.resolution_notes = "Manually retried and resolved from Integration Dashboard."
            error.save(update_fields=["status", "resolved_by", "resolved_at", "resolution_notes"])
            return True
        else:
            error.status = IntegrationError.Status.RETRIED
            error.retry_count += 1
            error.save(update_fields=["status", "retry_count"])
            return False
