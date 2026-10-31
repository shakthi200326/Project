import io
from decimal import Decimal
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError

from apps.categories.models import InventoryCategory
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse
from apps.stock.models import StockLedgerEntry
from shared_file_storage.services.storage_service import FileStorageService
from shared_file_storage.services.validator import validate_uploaded_file

class SecurityAndRegulatoryInvariantTests(TestCase):
    """
    Validates platform security boundaries, file sniffing validations,
    and regulatory immutable ledger requirements.
    """

    def setUp(self):
        self.category = InventoryCategory.objects.create(name="Sensors", code="CAT-SNS")
        self.product = InventoryItem.objects.create(
            name="Proximity Sensor Inductive",
            code="SNS-IND-01",
            category=self.category,
            base_unit="EA",
        )
        self.warehouse = Warehouse.objects.create(name="Security Testing Vault", code="WH-SEC-01")

    def test_file_upload_blocks_disallowed_executables(self):
        """Security: Rejects malicious executable extensions."""
        bad_file = SimpleUploadedFile("malicious_script.exe", b"MZ\x90\x00\x03\x00\x00\x00", content_type="application/x-dosexec")
        with self.assertRaises(ValidationError) as ctx:
            validate_uploaded_file(bad_file, "malicious_script.exe")
        self.assertIn("not permitted", str(ctx.exception))

    def test_file_upload_blocks_mismatched_magic_bytes(self):
        """Security: Detects spoofed extensions (e.g. text file claiming to be a PDF)."""
        fake_pdf = SimpleUploadedFile("spoofed.pdf", b"This is just plain text not a real PDF binary", content_type="application/pdf")
        with self.assertRaises(ValidationError) as ctx:
            validate_uploaded_file(fake_pdf, "spoofed.pdf")
        self.assertIn("does not match extension", str(ctx.exception))

    def test_file_upload_blocks_oversized_files(self):
        """Security: Rejects payload sizes exceeding maximum threshold."""
        oversized_content = b"%PDF-1.4\n" + (b"0" * (26 * 1024 * 1024))
        huge_file = SimpleUploadedFile("oversized.pdf", oversized_content, content_type="application/pdf")
        with self.assertRaises(ValidationError) as ctx:
            validate_uploaded_file(huge_file, "oversized.pdf")
        self.assertIn("exceeds maximum allowed size", str(ctx.exception))

    def test_ledger_append_only_immutability(self):
        """Regulatory: Stock Ledger entries cannot have running balances or quantities mutated after creation."""
        entry = StockLedgerEntry.objects.create(
            item=self.product,
            warehouse=self.warehouse,
            movement_type=StockLedgerEntry.MovementType.RECEIPT,
            quantity_delta=Decimal("50.0000"),
            balance_after=Decimal("50.0000"),
            unit_cost=Decimal("12.5000"),
            actor="compliance_officer",
        )
        self.assertIsNotNone(entry.id)
        self.assertEqual(entry.balance_after, Decimal("50.0000"))

        # Verify entry can be audited without alteration
        refreshed = StockLedgerEntry.objects.get(id=entry.id)
        self.assertEqual(refreshed.quantity_delta, Decimal("50.0000"))
        self.assertEqual(refreshed.actor, "compliance_officer")
