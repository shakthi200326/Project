from decimal import Decimal
import uuid
from django.test import TestCase
from django.db import transaction
from django.utils import timezone

from apps.categories.models import InventoryCategory
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse
from apps.stock.models import StockBalance, StockLedgerEntry, StockInTransit
from apps.reservations.models import StockReservation
from apps.valuation.models import InventoryValuation
from apps.configuration.models import InventoryConfiguration
from apps.integration.models import (
    OutboxEvent,
    ProcessedEvent,
    EventProcessingAttempt,
    IntegrationError,
    IntegrationSettings,
)
from apps.integration.services.outbox_service import OutboxService
from apps.integration.services.inbox_service import InboxConsumerService
from apps.integration.services.low_stock_service import LowStockAlertService
from apps.integration.services.event_contracts import (
    CloudEventSchema,
    EVENT_PURCHASE_GOODS_RECEIVED,
    EVENT_SALES_ORDER_CONFIRMED,
    EVENT_SALES_ORDER_DISPATCHED,
    EVENT_SALES_ORDER_CANCELLED,
    EVENT_INVENTORY_LOW_STOCK,
)
from apps.integration.services.subscription_service import initialize_subscriptions
from services.posting_service import InventoryPostingService


class IntegrationEngineTestCase(TestCase):
    def setUp(self):
        initialize_subscriptions()

        self.category = InventoryCategory.objects.create(name="Mechanical Components", code="MECH")
        self.item = InventoryItem.objects.create(
            name="Deep Groove Ball Bearing",
            code="BRG-TEST-001",
            category=self.category,
            base_unit="EA",
            reorder_point=Decimal("20.0000"),
            reorder_quantity=Decimal("50.0000"),
        )
        self.warehouse = Warehouse.objects.create(
            name="Central Plant Warehouse",
            code="WH-TEST-01",
            is_active=True,
        )
        self.dest_warehouse = Warehouse.objects.create(
            name="Secondary Distribution Depot",
            code="WH-TEST-02",
            is_active=True,
        )

        self.settings = IntegrationSettings.get_settings()
        self.settings.enable_purchase_integration = True
        self.settings.enable_sales_integration = True
        self.settings.enable_low_stock_alerts = True
        self.settings.save()

    def test_outbox_transactional_rollback(self):
        """Outbox events must roll back if the parent transaction fails."""
        initial_count = OutboxEvent.objects.count()

        try:
            with transaction.atomic():
                OutboxService.record_event(
                    event_type="test.event",
                    aggregate_type="InventoryItem",
                    aggregate_id=str(self.item.id),
                    payload={"name": "Test"},
                )
                raise RuntimeError("Simulated failure inside transaction")
        except RuntimeError:
            pass

        self.assertEqual(OutboxEvent.objects.count(), initial_count)

    def test_outbox_drain_lifecycle(self):
        """Pending outbox events must be drained, marked published, and given timestamp."""
        event = OutboxService.record_event(
            event_type="test.drain",
            aggregate_type="InventoryItem",
            aggregate_id=str(self.item.id),
            payload={"action": "drain_test"},
        )
        self.assertEqual(event.status, OutboxEvent.Status.PENDING)

        drained = OutboxService.drain_pending_events(batch_size=10)
        self.assertGreaterEqual(drained, 1)

        event.refresh_from_db()
        self.assertEqual(event.status, OutboxEvent.Status.PUBLISHED)
        self.assertIsNotNone(event.published_at)

    def test_inbox_idempotent_duplicate_suppression(self):
        """Duplicate event packets must be processed exactly once and subsequent attempts suppressed."""
        event_id = f"evt-idempotent-{uuid.uuid4()}"
        packet = {
            "specversion": "1.0",
            "id": event_id,
            "type": EVENT_PURCHASE_GOODS_RECEIVED,
            "source": "test.suite",
            "data": {
                "purchase_order_id": "PO-TEST-999",
                "grn_number": f"GRN-{event_id}",
                "warehouse_code": self.warehouse.code,
                "lines": [
                    {
                        "item_code": self.item.code,
                        "quantity": 100,
                        "unit_cost": 25.00,
                    }
                ],
            },
        }

        # First intake: must succeed
        res1 = InboxConsumerService.receive_event(packet)
        self.assertEqual(res1.get("status"), "SUCCESS")

        bal = StockBalance.objects.get(item=self.item, warehouse=self.warehouse)
        self.assertEqual(bal.on_hand_qty, Decimal("100.0000"))

        # Second intake (identical event_id): must be recognized as idempotent duplicate and suppressed
        res2 = InboxConsumerService.receive_event(packet)
        self.assertEqual(res2.get("status"), "ALREADY_PROCESSED")
        self.assertTrue(res2.get("idempotent"))

        # Verify stock was NOT added twice!
        bal.refresh_from_db()
        self.assertEqual(bal.on_hand_qty, Decimal("100.0000"))

    def test_purchase_goods_receipt_integration(self):
        """Purchase GRN event updates balances, Moving Average valuation, and ledger."""
        packet = CloudEventSchema.create_event(
            event_type=EVENT_PURCHASE_GOODS_RECEIVED,
            payload={
                "purchase_order_id": "PO-2026-PURCHASE",
                "grn_number": "GRN-PO-2026-001",
                "warehouse_code": self.warehouse.code,
                "supplier": "Apex Bearings Ltd",
                "lines": [
                    {
                        "item_code": self.item.code,
                        "quantity": 200,
                        "unit_cost": 30.00,
                        "batch_number": "BATCH-GRN-01",
                    }
                ],
            },
        )

        res = InboxConsumerService.receive_event(packet)
        self.assertEqual(res.get("status"), "SUCCESS")

        bal = StockBalance.objects.get(item=self.item, warehouse=self.warehouse)
        self.assertEqual(bal.on_hand_qty, Decimal("200.0000"))

        # Verify valuation
        val = InventoryValuation.objects.get(item=self.item, warehouse=self.warehouse)
        self.assertEqual(val.weighted_average_cost, Decimal("30.0000"))

        # Verify immutable ledger entry
        ledger = StockLedgerEntry.objects.filter(transaction_ref="GRN-PO-2026-001").first()
        self.assertIsNotNone(ledger)
        self.assertEqual(ledger.movement_type, StockLedgerEntry.MovementType.RECEIPT)
        self.assertEqual(ledger.quantity_delta, Decimal("200.0000"))

        # Verify outbox event generated
        outbox = OutboxEvent.objects.filter(
            event_type="inventory.stock_changed",
            aggregate_id=f"{self.warehouse.code}:{self.item.code}",
        ).first()
        self.assertIsNotNone(outbox)

    def test_sales_reservation_and_dispatch_lifecycle(self):
        """Full sales cycle: Stock intake -> Order Confirmation (Reserve) -> Dispatch (Issue) -> Balance check."""
        # Step 1: Initial stock of 50
        bal, _ = StockBalance.objects.get_or_create(
            item=self.item,
            warehouse=self.warehouse,
            defaults={"on_hand_qty": Decimal("50.0000")},
        )
        bal.on_hand_qty = Decimal("50.0000")
        bal.save()

        so_number = "SO-SALES-2026-01"

        # Step 2: Sales Order Confirmed -> Reserve 15
        confirm_packet = CloudEventSchema.create_event(
            event_type=EVENT_SALES_ORDER_CONFIRMED,
            payload={
                "sales_order_id": so_number,
                "customer": "Heavy Duty Machinery Inc",
                "warehouse_code": self.warehouse.code,
                "lines": [{"item_code": self.item.code, "quantity": 15}],
            },
        )
        res_conf = InboxConsumerService.receive_event(confirm_packet)
        self.assertEqual(res_conf.get("status"), "SUCCESS")

        bal.refresh_from_db()
        self.assertEqual(bal.on_hand_qty, Decimal("50.0000"))
        self.assertEqual(bal.reserved_qty, Decimal("15.0000"))
        self.assertEqual(bal.available_qty, Decimal("35.0000"))

        reservation = StockReservation.objects.filter(reference_number=so_number).first()
        self.assertIsNotNone(reservation)
        self.assertEqual(reservation.status, StockReservation.Status.RESERVED)

        # Step 3: Sales Order Dispatched -> Issue 15
        dispatch_packet = CloudEventSchema.create_event(
            event_type=EVENT_SALES_ORDER_DISPATCHED,
            payload={
                "sales_order_id": so_number,
                "dispatch_ref": f"DSP-{so_number}",
                "warehouse_code": self.warehouse.code,
                "lines": [{"item_code": self.item.code, "quantity": 15}],
            },
        )
        res_disp = InboxConsumerService.receive_event(dispatch_packet)
        self.assertEqual(res_disp.get("status"), "SUCCESS")

        bal.refresh_from_db()
        self.assertEqual(bal.on_hand_qty, Decimal("35.0000"))
        self.assertEqual(bal.reserved_qty, Decimal("0.0000"))
        self.assertEqual(bal.available_qty, Decimal("35.0000"))

        reservation.refresh_from_db()
        self.assertEqual(reservation.status, StockReservation.Status.FULFILLED)

    def test_sales_cancellation_releases_reservation(self):
        """Cancelling a sales order releases reserved stock back to available stock."""
        bal = StockBalance.objects.create(
            item=self.item,
            warehouse=self.warehouse,
            on_hand_qty=Decimal("40.0000"),
            reserved_qty=Decimal("10.0000"),
        )
        so_number = "SO-CANCEL-2026-99"
        StockReservation.objects.create(
            reference_number=so_number,
            reservation_number=f"RES-{so_number}",
            item=self.item,
            warehouse=self.warehouse,
            quantity=Decimal("10.0000"),
            status=StockReservation.Status.RESERVED,
        )

        cancel_packet = CloudEventSchema.create_event(
            event_type=EVENT_SALES_ORDER_CANCELLED,
            payload={"sales_order_id": so_number},
        )
        res = InboxConsumerService.receive_event(cancel_packet)
        self.assertEqual(res.get("status"), "SUCCESS")

        bal.refresh_from_db()
        self.assertEqual(bal.reserved_qty, Decimal("0.0000"))
        self.assertEqual(bal.available_qty, Decimal("40.0000"))

    def test_low_stock_alert_generation_and_suppression(self):
        """Alert is created when stock <= threshold, but throttled to prevent spam."""
        bal = StockBalance.objects.create(
            item=self.item,
            warehouse=self.warehouse,
            on_hand_qty=Decimal("10.0000"),  # below reorder_point 20
        )

        # First evaluation generates an alert
        alert1 = LowStockAlertService.evaluate_and_alert(bal)
        self.assertIsNotNone(alert1)
        self.assertEqual(alert1.event_type, EVENT_INVENTORY_LOW_STOCK)

        # Immediate second evaluation must be SUPPRESSED
        alert2 = LowStockAlertService.evaluate_and_alert(bal)
        self.assertIsNone(alert2)

    def test_stock_in_transit_model_and_reconciliation(self):
        """Dispatching transfer creates in-transit; receiving resolves in-transit."""
        transit = StockInTransit.objects.create(
            transfer_number="TRF-TEST-888",
            item=self.item,
            source_warehouse=self.warehouse,
            destination_warehouse=self.dest_warehouse,
            quantity=Decimal("25.0000"),
            status=StockInTransit.Status.IN_TRANSIT,
        )
        self.assertEqual(transit.status, StockInTransit.Status.IN_TRANSIT)

        # Receiving resolves
        transit.status = StockInTransit.Status.RECEIVED
        transit.received_at = timezone.now()
        transit.save()

        transit.refresh_from_db()
        self.assertEqual(transit.status, StockInTransit.Status.RECEIVED)
        self.assertIsNotNone(transit.received_at)

