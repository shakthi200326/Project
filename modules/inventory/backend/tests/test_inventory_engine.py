from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError

from apps.categories.models import InventoryCategory
from apps.brands.models import Brand
from apps.units.models import UnitOfMeasure
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.valuation.models import InventoryValuation
from services.posting_service import InventoryPostingService

class InventoryPostingServiceTest(TestCase):
    def setUp(self):
        self.category = InventoryCategory.objects.create(code="TEST-CAT", name="Test Category")
        self.item = InventoryItem.objects.create(
            code="ITEM-TEST-01",
            name="Precision Test Bearing",
            category=self.category,
            base_unit="EA",
            reorder_point=Decimal("20"),
        )
        self.warehouse = Warehouse.objects.create(code="WH-TEST", name="Test Warehouse")
        self.location = StorageLocation.objects.create(
            warehouse=self.warehouse, code="LOC-01", name="Location 01"
        )

    def test_stock_receipt_and_wav_valuation(self):
        """Test goods receipt updates on-hand, creates immutable ledger, and calculates WAV."""
        # 1. First Receipt: 100 @ $10.00
        tx1 = StockTransaction.objects.create(
            document_number="TX-REC-01",
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            warehouse=self.warehouse,
        )
        StockTransactionLine.objects.create(
            transaction=tx1,
            item=self.item,
            location=self.location,
            quantity=Decimal("100"),
            unit_cost=Decimal("10.00"),
        )

        InventoryPostingService.post_transaction(tx1, actor="tester")

        balance = StockBalance.objects.get(item=self.item, warehouse=self.warehouse, location=self.location)
        self.assertEqual(balance.on_hand_qty, Decimal("100"))
        self.assertEqual(balance.available_qty, Decimal("100"))

        val = InventoryValuation.objects.get(item=self.item, warehouse=self.warehouse)
        self.assertEqual(val.weighted_average_cost, Decimal("10.00"))
        self.assertEqual(val.total_value, Decimal("1000.00"))

        # Verify ledger entry
        ledger = StockLedgerEntry.objects.filter(transaction_ref="TX-REC-01")
        self.assertEqual(ledger.count(), 1)
        self.assertEqual(ledger.first().quantity_delta, Decimal("100"))

        # 2. Second Receipt: 50 @ $16.00
        # Expected new WAV: (100 * 10 + 50 * 16) / 150 = 1800 / 150 = $12.00
        tx2 = StockTransaction.objects.create(
            document_number="TX-REC-02",
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            warehouse=self.warehouse,
        )
        StockTransactionLine.objects.create(
            transaction=tx2,
            item=self.item,
            location=self.location,
            quantity=Decimal("50"),
            unit_cost=Decimal("16.00"),
        )

        InventoryPostingService.post_transaction(tx2, actor="tester")

        balance.refresh_from_db()
        self.assertEqual(balance.on_hand_qty, Decimal("150"))

        val.refresh_from_db()
        self.assertEqual(val.weighted_average_cost, Decimal("12.00"))
        self.assertEqual(val.total_value, Decimal("1800.00"))

    def test_insufficient_stock_rejection(self):
        """Test system strictly rejects issuing more stock than available."""
        # Try issuing 10 when stock is 0
        tx = StockTransaction.objects.create(
            document_number="TX-ISS-FAIL",
            transaction_type=StockTransaction.TransactionType.ISSUE,
            warehouse=self.warehouse,
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item,
            location=self.location,
            quantity=Decimal("10"),
        )

        with self.assertRaises(ValidationError):
            InventoryPostingService.post_transaction(tx, actor="tester")

class CatalogAndMasterDataTests(TestCase):
    def test_brand_creation_and_attributes(self):
        brand = Brand.objects.create(code="TIMK", name="Timken Industrial", country="USA")
        self.assertEqual(str(brand), "Timken Industrial (TIMK)")
        self.assertTrue(brand.is_active)

    def test_unit_of_measure_conversions(self):
        base_ea = UnitOfMeasure.objects.create(code="EA", name="Each", is_base=True, decimal_places=0)
        box = UnitOfMeasure.objects.create(
            code="BOX", name="Box of 12", is_base=False, base_unit=base_ea, conversion_factor=Decimal("12.0000")
        )
        self.assertEqual(box.conversion_factor, Decimal("12.0000"))
        self.assertEqual(box.base_unit.code, "EA")
