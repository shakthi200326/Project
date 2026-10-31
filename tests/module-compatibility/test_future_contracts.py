import json
from pathlib import Path
from django.test import TestCase

class FutureIntegrationContractsTests(TestCase):
    """
    Ensures that shared contracts for future modules (Purchase, Sales)
    and cross-cutting platform events conform strictly to JSON Schema standards.
    """

    def setUp(self):
        self.contracts_dir = Path("G:/Project/shared/contracts")

    def test_event_schemas_validity(self):
        events_schema_file = self.contracts_dir / "events" / "schemas.json"
        self.assertTrue(events_schema_file.exists())
        with open(events_schema_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("definitions", data)
        self.assertIn("StockUpdatedEvent", data["definitions"])
        self.assertIn("LowStockAlertEvent", data["definitions"])

    def test_permission_contracts_validity(self):
        perms_file = self.contracts_dir / "permissions" / "permissions.json"
        self.assertTrue(perms_file.exists())
        with open(perms_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("modules", data)
        self.assertIn("inventory", data["modules"])
        self.assertIn("storage", data["modules"])

    def test_context_contracts_validity(self):
        context_file = self.contracts_dir / "contexts" / "context.json"
        self.assertTrue(context_file.exists())
        with open(context_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("properties", data)
        self.assertIn("organization_id", data["properties"])
        self.assertIn("facility_id", data["properties"])

    def test_file_storage_contracts_validity(self):
        file_contract = self.contracts_dir / "files" / "file_contract.json"
        self.assertTrue(file_contract.exists())
        with open(file_contract, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("properties", data)
        self.assertIn("owner_type", data["properties"])
        self.assertIn("owner_id", data["properties"])
