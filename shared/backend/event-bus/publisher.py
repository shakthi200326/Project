import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from django.conf import settings

logger = logging.getLogger("ecosystem.event_bus")

class EventPublisher:
    """
    Universal Event Bus for decoupled asynchronous communication between modules.
    Supports in-memory subscriptions and Redis pub/sub streams.
    """
    _in_memory_subscribers: Dict[str, List[Callable]] = {}

    @classmethod
    def subscribe(cls, event_name: str, handler: Callable):
        """Register an in-process subscriber for an event pattern."""
        if event_name not in cls._in_memory_subscribers:
            cls._in_memory_subscribers[event_name] = []
        cls._in_memory_subscribers[event_name].append(handler)

    @classmethod
    def publish(
        cls,
        event_name: str,
        payload: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
        correlation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Publishes a normalized CloudEvents-compliant event packet.
        """
        event_packet = {
            "specversion": "1.0",
            "id": str(uuid.uuid4()),
            "type": event_name,
            "source": "ecosystem.inventory",
            "time": datetime.now(timezone.utc).isoformat(),
            "correlation_id": correlation_id or str(uuid.uuid4()),
            "context": context or {},
            "data": payload,
        }

        # 1. Trigger registered local handlers synchronously
        handlers = cls._in_memory_subscribers.get(event_name, [])
        for handler in handlers:
            try:
                handler(event_packet)
            except Exception as e:
                logger.error("Error executing event handler %s: %s", handler.__name__, e)

        # 2. Publish to Redis if configured
        redis_url = getattr(settings, "REDIS_URL", None)
        if redis_url:
            try:
                import redis
                r = redis.Redis.from_url(redis_url)
                r.publish(f"events:{event_name}", json.dumps(event_packet))
            except Exception as e:
                logger.warning("Could not broadcast event %s to Redis: %s", event_name, e)

        logger.info("Published event [%s] ID: %s", event_name, event_packet["id"])
        return event_packet

def publish_event(event_name: str, payload: Dict[str, Any], context: Optional[Dict[str, Any]] = None):
    return EventPublisher.publish(event_name, payload, context)

