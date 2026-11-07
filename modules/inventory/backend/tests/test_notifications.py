from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from apps.categories.models import InventoryCategory
from apps.products.models import InventoryItem
from apps.stock.models import StockBalance
from apps.warehouses.models import Warehouse
from apps.integration.models import InventoryAlert, NotificationSettings
from apps.integration.services.notification_service import NotificationService


class InventoryNotificationTests(TestCase):
    def setUp(self):
        self.settings = NotificationSettings.get_settings()
        self.settings.alert_types = {
            "low_stock": True,
            "out_of_stock": True,
            "expiry": True,
            "overstock": True,
            "pending_receipt": True,
            "pending_approval": True,
            "stock_discrepancy": True,
        }
        self.settings.channels = {"in_app": True, "email": False, "webhook": False}
        self.settings.save()
        self.candidate = {
            "source_key": "test:1:low_stock",
            "alert_type": "low_stock",
            "severity": "WARNING",
            "title": "Low stock: TEST-1",
            "description": "Test alert",
            "action_url": "/inventory/reports/low-stock",
            "payload": {},
        }

    @patch.object(NotificationService, "_deliver")
    @patch.object(NotificationService, "_collect_candidates")
    def test_scan_deduplicates_and_reactivates_alerts(self, collect, deliver):
        collect.return_value = [self.candidate]
        self.assertEqual(NotificationService.scan(), 1)
        alert = InventoryAlert.objects.get(source_key=self.candidate["source_key"])
        self.assertTrue(alert.is_active)
        self.assertFalse(alert.is_read)
        self.assertEqual(deliver.call_count, 1)

        alert.is_read = True
        alert.save(update_fields=["is_read"])
        NotificationService.scan()
        self.assertEqual(InventoryAlert.objects.count(), 1)
        self.assertTrue(InventoryAlert.objects.get().is_read)
        self.assertEqual(deliver.call_count, 2)

        collect.return_value = []
        NotificationService.scan()
        alert.refresh_from_db()
        self.assertFalse(alert.is_active)

        collect.return_value = [self.candidate]
        NotificationService.scan()
        alert.refresh_from_db()
        self.assertTrue(alert.is_active)
        self.assertFalse(alert.is_read)
        self.assertEqual(InventoryAlert.objects.count(), 1)

    def test_notification_settings_require_channel_destinations(self):
        from apps.integration.serializers import NotificationSettingsSerializer

        serializer = NotificationSettingsSerializer(
            self.settings,
            data={
                "channels": {"in_app": True, "email": True, "webhook": False},
                "recipient_emails": [],
            },
            partial=True,
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("recipient_emails", serializer.errors)

    def test_webhook_notifications_require_https(self):
        from apps.integration.serializers import NotificationSettingsSerializer

        serializer = NotificationSettingsSerializer(
            self.settings,
            data={"webhook_url": "http://example.com/alerts"},
            partial=True,
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("webhook_url", serializer.errors)

    def test_stock_alerts_are_created_from_live_balances(self):
        category = InventoryCategory.objects.create(name="Notification Test", code="NTF")
        item = InventoryItem.objects.create(
            name="Notification Test Item",
            code="NTF-001",
            category=category,
            base_unit="EA",
            reorder_point=Decimal("10.0000"),
        )
        warehouse = Warehouse.objects.create(name="Notification Test Warehouse", code="WH-NTF")
        balance = StockBalance.objects.create(
            item=item,
            warehouse=warehouse,
            on_hand_qty=Decimal("5.0000"),
        )

        candidates = NotificationService._collect_candidates(
            self.settings, {"low_stock", "out_of_stock"}
        )
        self.assertEqual([candidate["alert_type"] for candidate in candidates], ["low_stock"])

        balance.on_hand_qty = Decimal("0.0000")
        balance.save()
        candidates = NotificationService._collect_candidates(
            self.settings, {"low_stock", "out_of_stock"}
        )
        self.assertEqual([candidate["alert_type"] for candidate in candidates], ["out_of_stock"])
