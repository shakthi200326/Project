from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from apps.categories.models import InventoryCategory
from apps.units.models import UnitOfMeasure
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation, Bin
from apps.stock.models import StockBalance, StockLedgerEntry, DamagedStock
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.reservations.models import StockReservation
from apps.reconciliation.models import StockCount
from services.posting_service import InventoryPostingService

class StockControlPhase4Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = InventoryCategory.objects.create(name="Mechanical Parts", code="MECH")
        self.unit = UnitOfMeasure.objects.create(name="Piece", code="EA", symbol="ea")
        self.item = InventoryItem.objects.create(
            name="Deep Groove Ball Bearing",
            code="BRG-TEST-01",
            category=self.category,
            base_unit=self.unit,
            reorder_point=Decimal("20.0000"),
        )
        self.warehouse = Warehouse.objects.create(
            name="Central Warehouse",
            code="WH-CENTRAL",
            warehouse_type=Warehouse.WarehouseType.MAIN,
            address="100 Logistics Blvd",
            city="Metropolis",
            country="United States",
        )
        self.dest_warehouse = Warehouse.objects.create(
            name="Regional Hub",
            code="WH-REGIONAL",
            warehouse_type=Warehouse.WarehouseType.DISTRIBUTION,
            address="200 Express Way",
            city="Gotham",
            country="United States",
        )
        self.location = StorageLocation.objects.create(
            warehouse=self.warehouse,
            name="Primary Picking Zone",
            code="LOC-PICK-01",
            location_type=StorageLocation.LocationType.PICKING,
        )
        self.bin = Bin.objects.create(
            warehouse=self.warehouse,
            location=self.location,
            name="Bin A-1",
            code="BIN-A1",
        )
        self.balance = StockBalance.objects.create(
            item=self.item,
            warehouse=self.warehouse,
            location=self.location,
            bin=self.bin,
            on_hand_qty=Decimal("100.0000"),
            reserved_qty=Decimal("10.0000"),
            blocked_qty=Decimal("5.0000"),
        )

    def test_stock_overview_and_balance_api(self):
        resp = self.client.get(f"/api/v1/inventory/balances/?item={self.item.id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        self.assertTrue(len(results) >= 1)
        record = results[0]
        self.assertEqual(record["sku"], "BRG-TEST-01")
        self.assertEqual(record["product_name"], "Deep Groove Ball Bearing")
        self.assertEqual(Decimal(str(record["total_stock"])), Decimal("100.0000"))
        self.assertEqual(Decimal(str(record["reserved_stock"])), Decimal("10.0000"))
        self.assertEqual(Decimal(str(record["damaged_stock"])), Decimal("5.0000"))
        self.assertEqual(Decimal(str(record["available_stock"])), Decimal("85.0000"))
        self.assertEqual(record["stock_status"], "In Stock")

    def test_stock_ledger_and_in_out_history_filters(self):
        # Create an IN entry and an OUT entry in ledger
        in_entry = StockLedgerEntry.objects.create(
            item=self.item,
            warehouse=self.warehouse,
            location=self.location,
            movement_type=StockLedgerEntry.MovementType.RECEIPT,
            quantity_delta=Decimal("50.0000"),
            balance_after=Decimal("150.0000"),
            transaction_ref="GRN-2026-0001",
            batch_number="BATCH-2026-A",
            actor="test_user",
        )
        out_entry = StockLedgerEntry.objects.create(
            item=self.item,
            warehouse=self.warehouse,
            location=self.location,
            movement_type=StockLedgerEntry.MovementType.ISSUE,
            quantity_delta=Decimal("-20.0000"),
            balance_after=Decimal("130.0000"),
            transaction_ref="ISS-2026-0001",
            batch_number="BATCH-2026-A",
            actor="test_user",
        )

        # Full ledger
        resp = self.client.get(f"/api/v1/inventory/ledger/?item={self.item.id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        self.assertEqual(len(results), 2)

        # Stock In History (direction=in)
        resp_in = self.client.get("/api/v1/inventory/ledger/?direction=in")
        self.assertEqual(resp_in.status_code, status.HTTP_200_OK)
        in_results = resp_in.data.get("results", resp_in.data)
        self.assertTrue(all(Decimal(str(r["quantity_delta"])) > 0 for r in in_results))

        # Stock Out History (direction=out)
        resp_out = self.client.get("/api/v1/inventory/ledger/?direction=out")
        self.assertEqual(resp_out.status_code, status.HTTP_200_OK)
        out_results = resp_out.data.get("results", resp_out.data)
        self.assertTrue(all(Decimal(str(r["quantity_delta"])) < 0 for r in out_results))

    def test_stock_reservation_lifecycle(self):
        # Initial available: 85
        create_resp = self.client.post("/api/v1/inventory/reservations/", {
            "reservation_number": "RES-2026-9001",
            "reservation_type": "Sales",
            "item": self.item.id,
            "warehouse": self.warehouse.id,
            "location": self.location.id,
            "quantity": "25.0000",
            "status": "RESERVED",
        })
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        res_id = create_resp.data["id"]

        self.balance.refresh_from_db()
        self.assertEqual(self.balance.reserved_qty, Decimal("35.0000"))
        self.assertEqual(self.balance.available_qty, Decimal("60.0000"))

        # Release reservation
        rel_resp = self.client.post(f"/api/v1/inventory/reservations/{res_id}/release/")
        self.assertEqual(rel_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(rel_resp.data["status"], "RELEASED")

        self.balance.refresh_from_db()
        self.assertEqual(self.balance.reserved_qty, Decimal("10.0000"))
        self.assertEqual(self.balance.available_qty, Decimal("85.0000"))

    def test_reconciliation_generate_adjustment(self):
        recon = StockCount.objects.create(
            reconciliation_number="REC-2026-0001",
            warehouse=self.warehouse,
            location=self.location,
            item=self.item,
            system_quantity=Decimal("100.0000"),
            physical_quantity=Decimal("105.0000"),
            reason="Found Stock",
            status=StockCount.Status.DRAFT,
        )
        self.assertEqual(recon.difference_quantity, Decimal("5.0000"))

        # Submit
        sub_resp = self.client.post(f"/api/v1/inventory/reconciliation/{recon.id}/submit/")
        self.assertEqual(sub_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(sub_resp.data["status"], "SUBMITTED")

        # Approve
        app_resp = self.client.post(f"/api/v1/inventory/reconciliation/{recon.id}/approve/")
        self.assertEqual(app_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(app_resp.data["status"], "APPROVED")

        # Generate Adjustment
        adj_resp = self.client.post(f"/api/v1/inventory/reconciliation/{recon.id}/generate_adjustment/")
        self.assertEqual(adj_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(adj_resp.data["status"], "ADJUSTED")
        self.assertIsNotNone(adj_resp.data.get("adjustment_document_number"))

    def test_damaged_stock_quarantine_and_disposal(self):
        dmg = DamagedStock.objects.create(
            item=self.item,
            warehouse=self.warehouse,
            location=self.location,
            damaged_qty=Decimal("4.0000"),
            damage_reason="Water damage during handling",
            status=DamagedStock.Status.PENDING,
        )

        # Quarantine
        q_resp = self.client.post(f"/api/v1/inventory/damaged-stock/{dmg.id}/quarantine/")
        self.assertEqual(q_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(q_resp.data["status"], "QUARANTINED")

        # Dispose
        d_resp = self.client.post(f"/api/v1/inventory/damaged-stock/{dmg.id}/dispose/")
        self.assertEqual(d_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(d_resp.data["status"], "DISPOSED")

    def test_stock_in_transit_view(self):
        tx = StockTransaction.objects.create(
            document_number="TRF-2026-9001",
            transaction_type=StockTransaction.TransactionType.TRANSFER,
            status=StockTransaction.Status.DISPATCHED,
            warehouse=self.warehouse,
            destination_warehouse=self.dest_warehouse,
        )
        StockTransactionLine.objects.create(
            transaction=tx,
            item=self.item,
            quantity=Decimal("30.0000"),
            unit_cost=Decimal("15.0000"),
        )

        resp = self.client.get("/api/v1/inventory/transit/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        self.assertTrue(len(results) >= 1)
        transit_tx = [t for t in results if t["document_number"] == "TRF-2026-9001"][0]
        self.assertEqual(transit_tx["source_warehouse"], "Central Warehouse")
        self.assertEqual(transit_tx["destination_warehouse_name"], "Regional Hub")
        self.assertEqual(Decimal(str(transit_tx["dispatched_quantity"])), Decimal("30.0000"))
        self.assertEqual(Decimal(str(transit_tx["pending_quantity"])), Decimal("30.0000"))
        self.assertEqual(transit_tx["transit_status"], "In Transit")

