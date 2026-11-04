import logging
from apps.integration.services.inbox_service import InboxConsumerService
from apps.integration.services.event_contracts import (
    EVENT_PURCHASE_GOODS_RECEIVED,
    EVENT_SALES_ORDER_CONFIRMED,
    EVENT_SALES_ORDER_DISPATCHED,
    EVENT_SALES_ORDER_CANCELLED,
)
from apps.integration.handlers.purchase_handlers import handle_purchase_goods_received
from apps.integration.handlers.sales_handlers import (
    handle_sales_order_confirmed,
    handle_sales_order_dispatched,
    handle_sales_order_cancelled,
)
from shared_event_bus.publisher import EventPublisher

logger = logging.getLogger("ecosystem.integration.subscriptions")


def initialize_subscriptions():
    """
    Wires up event handlers to the universal EventBus and Inbox consumer router.
    """
    subscriptions = {
        EVENT_PURCHASE_GOODS_RECEIVED: handle_purchase_goods_received,
        EVENT_SALES_ORDER_CONFIRMED: handle_sales_order_confirmed,
        EVENT_SALES_ORDER_DISPATCHED: handle_sales_order_dispatched,
        EVENT_SALES_ORDER_CANCELLED: handle_sales_order_cancelled,
    }

    for event_type, handler in subscriptions.items():
        # Register in inbox consumer
        InboxConsumerService.register_handler(event_type, handler)

        # Wire EventPublisher in-memory dispatch to go through idempotent Inbox
        def make_bus_bridge(et):
            return lambda packet: InboxConsumerService.receive_event(packet)

        EventPublisher.subscribe(event_type, make_bus_bridge(event_type))

    logger.info("Initialized %d event bus integration subscriptions.", len(subscriptions))
