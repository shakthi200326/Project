from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from apps.configuration.models import (
    InventoryConfiguration,
    DocumentNumberingRule,
    ConfigurationAuditLog,
)
from apps.warehouses.models import Warehouse


class ConfigurationPhase9Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.warehouse = Warehouse.objects.create(
            name="Alpha Hub",
            code="WH-ALPHA",
            address="123 Industrial Rd",
            city="Detroit",
            country="United States",
            is_active=True,
        )

    def test_get_and_update_general_settings(self):
        """1. General Settings: module name, base currency, default warehouse, default uom, multiple warehouses."""
        res = self.client.get("/api/v1/inventory/configuration/global/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["base_currency"], "USD")

        # Update general settings
        payload = {
            "inventory_module_name": "Nexus Global Inventory Engine",
            "base_currency": "EUR",
            "default_warehouse": self.warehouse.id,
            "default_uom": "PCS",
            "enable_multiple_warehouses": True,
            "_section": "General Settings",
            "changed_by": "System Admin",
        }
        update_res = self.client.patch("/api/v1/inventory/configuration/global/", payload, format="json")
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        self.assertEqual(update_res.data["inventory_module_name"], "Nexus Global Inventory Engine")
        self.assertEqual(update_res.data["base_currency"], "EUR")
        self.assertEqual(update_res.data["default_uom"], "PCS")

        # Verify audit log was created (Rule 6)
        log = ConfigurationAuditLog.objects.filter(section="General Settings").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.changed_by, "System Admin")
        self.assertIn("base_currency", log.new_values)
        self.assertEqual(log.new_values["base_currency"], "EUR")

    def test_stock_settings(self):
        """2. Stock Settings: negative stock, reservations, transfers, location/bin requirements, low stock threshold."""
        payload = {
            "allow_negative_stock": False,
            "enable_stock_reservation": True,
            "enable_stock_transfer": True,
            "require_warehouse_selection": True,
            "require_storage_location": True,
            "require_bin_selection": True,
            "default_low_stock_threshold": "25.00",
            "_section": "Stock Settings",
        }
        res = self.client.patch("/api/v1/inventory/configuration/global/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["require_bin_selection"], True)
        self.assertEqual(float(res.data["default_low_stock_threshold"]), 25.00)

    def test_product_tracking_settings(self):
        """3. Product Tracking Settings: batch, serial, expiry, barcode toggles."""
        payload = {
            "enable_batch_tracking": True,
            "enable_serial_tracking": True,
            "enable_expiry_tracking": True,
            "enable_barcode_tracking": True,
            "_section": "Product Tracking Settings",
        }
        res = self.client.patch("/api/v1/inventory/configuration/global/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["enable_batch_tracking"])
        self.assertTrue(res.data["enable_serial_tracking"])
        self.assertTrue(res.data["enable_expiry_tracking"])
        self.assertTrue(res.data["enable_barcode_tracking"])

    def test_valuation_settings(self):
        """4. Valuation Settings: valuation method, cost precision, additional costs."""
        payload = {
            "valuation_method": "FIFO",
            "cost_precision": 4,
            "include_additional_costs": True,
            "_section": "Valuation Settings",
        }
        res = self.client.patch("/api/v1/inventory/configuration/global/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["valuation_method"], "FIFO")
        self.assertEqual(res.data["cost_precision"], 4)
        self.assertTrue(res.data["include_additional_costs"])

    def test_document_numbering_rules_and_generation(self):
        """5. Document Numbering: prefix, starting number, length, reset frequency, sequential generation."""
        res = self.client.get("/api/v1/inventory/configuration/document-numbering/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rules = res.data.get("results", res.data)
        self.assertTrue(len(rules) >= 10)

        # Test consecutive atomic number generation for Goods Receipt
        num1 = DocumentNumberingRule.generate_next_number("Goods Receipt")
        num2 = DocumentNumberingRule.generate_next_number("Goods Receipt")
        self.assertTrue(num1.startswith("GRN-"))
        self.assertTrue(num2.startswith("GRN-"))
        self.assertNotEqual(num1, num2)

        # Test via API action
        gen_res = self.client.get("/api/v1/inventory/configuration/document-numbering/generate-next/?document_type=Stock Issue")
        self.assertEqual(gen_res.status_code, status.HTTP_200_OK)
        self.assertTrue(gen_res.data["generated_number"].startswith("ISS-"))

    def test_approval_settings(self):
        """6. Approval Settings: granular operation approval toggles."""
        payload = {
            "goods_receipt_approval": True,
            "stock_issue_approval": True,
            "stock_transfer_approval": True,
            "stock_adjustment_approval": True,
            "stock_return_approval": True,
            "stock_reconciliation_approval": True,
            "batch_release_approval": True,
            "_section": "Approval Settings",
        }
        res = self.client.patch("/api/v1/inventory/configuration/global/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["goods_receipt_approval"])
        self.assertTrue(res.data["stock_adjustment_approval"])
        self.assertTrue(res.data["batch_release_approval"])

    def test_configuration_audit_history(self):
        """Audit trail records configuration changes."""
        ConfigurationAuditLog.objects.create(
            section="Valuation Settings",
            action="UPDATE",
            changed_by="Auditor Jane",
            previous_values={"valuation_method": "Weighted Average"},
            new_values={"valuation_method": "FIFO"},
        )
        res = self.client.get("/api/v1/inventory/configuration/audit-log/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", [])
        self.assertTrue(len(results) >= 1)
        self.assertEqual(results[0]["changed_by"], "Auditor Jane")
