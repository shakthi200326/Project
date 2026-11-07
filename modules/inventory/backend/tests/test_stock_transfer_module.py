from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from apps.warehouses.models import Warehouse, StorageLocation
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.categories.models import InventoryCategory
from apps.stock.models import StockBalance, StockLedgerEntry, StockInTransit, DamagedStock
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.configuration.models import DocumentNumberingRule
from services.posting_service import InventoryPostingService
from services.stock_operations_service import StockOperationsService


class StockTransferModuleTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Seed Category
        self.category = InventoryCategory.objects.create(
            name="Electronics",
            code="ELEC",
        )

        # Seed DocumentNumberingRule for Stock Transfer
        DocumentNumberingRule.objects.get_or_create(
            document_type="Stock Transfer",
            defaults={"prefix": "TRF", "current_number": 100, "number_length": 6},
        )

        # Same-City Warehouses (Chennai)
        self.wh_chennai_a = Warehouse.objects.create(
            code="WH-CHN-A",
            name="Chennai Central Warehouse A",
            city="Chennai",
            is_active=True,
            status="Active",
        )
        self.loc_chn_a = StorageLocation.objects.create(
            warehouse=self.wh_chennai_a,
            code="CHN-A-LOC-1",
            name="General Storage",
        )

        self.wh_chennai_b = Warehouse.objects.create(
            code="WH-CHN-B",
            name="Chennai Distribution Hub B",
            city="Chennai",
            is_active=True,
            status="Active",
        )
        self.loc_chn_b = StorageLocation.objects.create(
            warehouse=self.wh_chennai_b,
            code="CHN-B-LOC-1",
            name="Receiving Bay",
        )

        # Inter-City Warehouse (Coimbatore)
        self.wh_coimbatore = Warehouse.objects.create(
            code="WH-CBE-1",
            name="Coimbatore Regional Depot",
            city="Coimbatore",
            is_active=True,
            status="Active",
        )
        self.loc_cbe = StorageLocation.objects.create(
            warehouse=self.wh_coimbatore,
            code="CBE-LOC-1",
            name="Depot Receiving",
        )

        # Warehouse without city (for validation testing)
        self.wh_no_city = Warehouse.objects.create(
            code="WH-NO-CITY",
            name="Incomplete Warehouse",
            city="",
            is_active=True,
            status="Active",
        )

        # Products from prompt specification
        self.item_laptop = InventoryItem.objects.create(
            category=self.category,
            code="LAP-001",
            name="Enterprise Laptop Pro",
            base_unit="Nos",
            is_active=True,
            status=InventoryItem.ItemStatus.ACTIVE,
            track_inventory=True,
        )
        self.item_keyboard = InventoryItem.objects.create(
            category=self.category,
            code="KEY-001",
            name="Mechanical Keyboard",
            base_unit="Nos",
            is_active=True,
            status=InventoryItem.ItemStatus.ACTIVE,
            track_inventory=True,
        )
        self.item_mouse = InventoryItem.objects.create(
            category=self.category,
            code="MOU-001",
            name="Optical Wireless Mouse",
            base_unit="Nos",
            is_active=True,
            status=InventoryItem.ItemStatus.ACTIVE,
            track_inventory=True,
        )
        self.item_monitor = InventoryItem.objects.create(
            category=self.category,
            code="MON-001",
            name="27-inch 4K Monitor",
            base_unit="Nos",
            is_active=True,
            status=InventoryItem.ItemStatus.ACTIVE,
            track_inventory=True,
        )

        # Seed initial stock at Chennai Warehouse A:
        # Laptop: 100, Keyboard: 200, Mouse: 150, Monitor: 75
        StockBalance.objects.create(
            item=self.item_laptop,
            warehouse=self.wh_chennai_a,
            location=self.loc_chn_a,
            on_hand_qty=Decimal("100.0000"),
        )
        StockBalance.objects.create(
            item=self.item_keyboard,
            warehouse=self.wh_chennai_a,
            location=self.loc_chn_a,
            on_hand_qty=Decimal("200.0000"),
        )
        StockBalance.objects.create(
            item=self.item_mouse,
            warehouse=self.wh_chennai_a,
            location=self.loc_chn_a,
            on_hand_qty=Decimal("150.0000"),
        )
        StockBalance.objects.create(
            item=self.item_monitor,
            warehouse=self.wh_chennai_a,
            location=self.loc_chn_a,
            on_hand_qty=Decimal("75.0000"),
        )

    def test_01_same_city_inter_warehouse_transfer_end_to_end(self):
        """
        Master Scenario 1: Same-City Transfer
        Source: Chennai Warehouse A (City: Chennai)
        Destination: Chennai Warehouse B (City: Chennai)
        Multiple Products:
        - Laptop: 20
        - Keyboard: 50
        - Mouse: 30
        Workflow: Draft -> Submit -> Approve -> Dispatch -> Receive -> Complete
        """
        payload = {
            "source_warehouse": self.wh_chennai_a.id,
            "destination_warehouse": self.wh_chennai_b.id,
            "reason": "Replenishment for City Store Hub",
            "lines": [
                {"item": self.item_laptop.id, "quantity": 20, "unit_cost": 850.0},
                {"item": self.item_keyboard.id, "quantity": 50, "unit_cost": 45.0},
                {"item": self.item_mouse.id, "quantity": 30, "unit_cost": 25.0},
            ],
        }

        # 1. Create Draft
        res = self.client.post("/api/v1/inventory/transfers/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        data = res.data
        tx_id = data["id"]
        self.assertEqual(data["status"], "DRAFT")
        self.assertEqual(data["transfer_type"], "INTER_WAREHOUSE")
        self.assertEqual(data["transfer_scope"], "SAME_CITY")
        self.assertEqual(data["source_city"], "Chennai")
        self.assertEqual(data["destination_city"], "Chennai")
        self.assertEqual(data["total_items"], 3)
        self.assertEqual(data["total_quantity"], 100.0)

        # Balances untouched in draft
        bal_lap_src = StockBalance.objects.get(item=self.item_laptop, warehouse=self.wh_chennai_a)
        self.assertEqual(bal_lap_src.on_hand_qty, Decimal("100.0000"))

        # 2. Submit Transfer
        res_submit = self.client.post(f"/api/v1/inventory/transfers/{tx_id}/submit/")
        self.assertEqual(res_submit.status_code, status.HTTP_200_OK)
        self.assertEqual(res_submit.data["status"], "SUBMITTED")

        # 3. Approve Transfer
        res_appr = self.client.post(f"/api/v1/inventory/transfers/{tx_id}/approve/")
        self.assertEqual(res_appr.status_code, status.HTTP_200_OK)
        self.assertEqual(res_appr.data["status"], "APPROVED")

        # 4. Dispatch Transfer (Physical goods leave source)
        res_disp = self.client.post(f"/api/v1/inventory/transfers/{tx_id}/dispatch/")
        self.assertEqual(res_disp.status_code, status.HTTP_200_OK)
        self.assertEqual(res_disp.data["status"], "DISPATCHED")

        # Source balances reduced
        bal_lap_src.refresh_from_db()
        self.assertEqual(bal_lap_src.on_hand_qty, Decimal("80.0000"))
        bal_key_src = StockBalance.objects.get(item=self.item_keyboard, warehouse=self.wh_chennai_a)
        self.assertEqual(bal_key_src.on_hand_qty, Decimal("150.0000"))
        bal_mou_src = StockBalance.objects.get(item=self.item_mouse, warehouse=self.wh_chennai_a)
        self.assertEqual(bal_mou_src.on_hand_qty, Decimal("120.0000"))

        # In-Transit records created
        transit_records = StockInTransit.objects.filter(transfer_number=data["document_number"])
        self.assertEqual(transit_records.count(), 3)
        for tr in transit_records:
            self.assertEqual(tr.status, StockInTransit.Status.IN_TRANSIT)

        # Destination stock NOT yet increased before receipt
        dest_lap = StockBalance.objects.filter(item=self.item_laptop, warehouse=self.wh_chennai_b).first()
        self.assertTrue(dest_lap is None or dest_lap.on_hand_qty == Decimal("0.0000"))

        # 5. Receive Transfer at Destination
        res_recv = self.client.post(f"/api/v1/inventory/transfers/{tx_id}/receive/")
        self.assertEqual(res_recv.status_code, status.HTTP_200_OK)
        self.assertIn(res_recv.data["status"], ("POSTED", "RECEIVED", "COMPLETED"))

        # Destination balances increased
        dest_lap = StockBalance.objects.get(item=self.item_laptop, warehouse=self.wh_chennai_b)
        self.assertEqual(dest_lap.on_hand_qty, Decimal("20.0000"))
        dest_key = StockBalance.objects.get(item=self.item_keyboard, warehouse=self.wh_chennai_b)
        self.assertEqual(dest_key.on_hand_qty, Decimal("50.0000"))
        dest_mou = StockBalance.objects.get(item=self.item_mouse, warehouse=self.wh_chennai_b)
        self.assertEqual(dest_mou.on_hand_qty, Decimal("30.0000"))

        # In-Transit records closed
        for tr in StockInTransit.objects.filter(transfer_number=data["document_number"]):
            self.assertEqual(tr.status, StockInTransit.Status.RECEIVED)

        # 6. Complete Transfer
        res_comp = self.client.post(f"/api/v1/inventory/transfers/{tx_id}/complete/")
        self.assertEqual(res_comp.status_code, status.HTTP_200_OK)
        self.assertEqual(res_comp.data["status"], "COMPLETED")

    def test_02_inter_city_transfer_with_discrepancy_and_damaged_stock(self):
        """
        Master Scenario 2: Inter-City Transfer
        Source: Chennai Warehouse A (City: Chennai)
        Destination: Coimbatore Regional Depot (City: Coimbatore)
        Multiple Products:
        - Laptop: 20
        - Monitor: 10
        - Keyboard: 40
        Expected Scope: INTER_CITY
        Receipt captures 2 damaged keyboards in transit.
        """
        payload = {
            "source_warehouse": self.wh_chennai_a.id,
            "destination_warehouse": self.wh_coimbatore.id,
            "reason": "Regional Depot Replenishment",
            "lines": [
                {"item": self.item_laptop.id, "quantity": 20, "unit_cost": 850.0},
                {"item": self.item_monitor.id, "quantity": 10, "unit_cost": 320.0},
                {"item": self.item_keyboard.id, "quantity": 40, "unit_cost": 45.0},
            ],
        }

        res = self.client.post("/api/v1/inventory/transfers/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data
        tx_id = data["id"]
        self.assertEqual(data["transfer_scope"], "INTER_CITY")
        self.assertEqual(data["source_city"], "Chennai")
        self.assertEqual(data["destination_city"], "Coimbatore")

        # Submit -> Approve -> Dispatch
        self.client.post(f"/api/v1/inventory/transfers/{tx_id}/submit/")
        self.client.post(f"/api/v1/inventory/transfers/{tx_id}/approve/")
        res_disp = self.client.post(f"/api/v1/inventory/transfers/{tx_id}/dispatch/")
        self.assertEqual(res_disp.status_code, status.HTTP_200_OK)

        # Verify source deduction
        bal_mon_src = StockBalance.objects.get(item=self.item_monitor, warehouse=self.wh_chennai_a)
        self.assertEqual(bal_mon_src.on_hand_qty, Decimal("65.0000"))

        # Receive with 2 damaged keyboards
        tx = StockTransaction.objects.get(pk=tx_id)
        keyboard_line = tx.lines.get(item=self.item_keyboard)
        receive_payload = {
            "lines": [
                {
                    "id": keyboard_line.id,
                    "received_quantity": 40,
                    "damaged_quantity": 2,
                    "shortage_quantity": 0,
                }
            ]
        }
        res_recv = self.client.post(f"/api/v1/inventory/transfers/{tx_id}/receive/", receive_payload, format="json")
        self.assertEqual(res_recv.status_code, status.HTTP_200_OK)

        # Damaged stock record created for destination warehouse
        dmg = DamagedStock.objects.filter(item=self.item_keyboard, warehouse=self.wh_coimbatore).first()
        self.assertIsNotNone(dmg)
        self.assertEqual(dmg.damaged_qty, Decimal("2.0000"))

        # Destination stock increased for monitor and laptop
        dest_mon = StockBalance.objects.get(item=self.item_monitor, warehouse=self.wh_coimbatore)
        self.assertEqual(dest_mon.on_hand_qty, Decimal("10.0000"))

        # Finalize
        res_comp = self.client.post(f"/api/v1/inventory/transfers/{tx_id}/complete/")
        self.assertEqual(res_comp.status_code, status.HTTP_200_OK)
        self.assertEqual(res_comp.data["status"], "COMPLETED")

    def test_03_validation_same_source_and_destination_rejected(self):
        """Source and destination warehouses cannot be identical."""
        payload = {
            "source_warehouse": self.wh_chennai_a.id,
            "destination_warehouse": self.wh_chennai_a.id,
            "lines": [{"item": self.item_laptop.id, "quantity": 5}],
        }
        res = self.client.post("/api/v1/inventory/transfers/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be the same", str(res.data))

    def test_04_validation_missing_warehouse_city_rejected(self):
        """Warehouses must maintain a valid city reference."""
        payload = {
            "source_warehouse": self.wh_chennai_a.id,
            "destination_warehouse": self.wh_no_city.id,
            "lines": [{"item": self.item_laptop.id, "quantity": 5}],
        }
        res = self.client.post("/api/v1/inventory/transfers/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("does not have a city configured", str(res.data))

    def test_05_validation_insufficient_stock_rejected(self):
        """Transfer quantity cannot exceed eligible available stock at source."""
        payload = {
            "source_warehouse": self.wh_chennai_a.id,
            "destination_warehouse": self.wh_chennai_b.id,
            "lines": [{"item": self.item_monitor.id, "quantity": 9999}],  # Available is 75
        }
        res = self.client.post("/api/v1/inventory/transfers/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds available stock", str(res.data))

    def test_06_validation_duplicate_item_lines_rejected(self):
        """Prevent duplicate product/variant rows in one transfer document."""
        payload = {
            "source_warehouse": self.wh_chennai_a.id,
            "destination_warehouse": self.wh_chennai_b.id,
            "lines": [
                {"item": self.item_laptop.id, "quantity": 5},
                {"item": self.item_laptop.id, "quantity": 10},
            ],
        }
        res = self.client.post("/api/v1/inventory/transfers/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Duplicate product/variant rows", str(res.data))

    def test_07_validation_zero_or_negative_quantity_rejected(self):
        """Transfer quantity must be strictly positive."""
        payload = {
            "source_warehouse": self.wh_chennai_a.id,
            "destination_warehouse": self.wh_chennai_b.id,
            "lines": [{"item": self.item_laptop.id, "quantity": 0}],
        }
        res = self.client.post("/api/v1/inventory/transfers/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("greater than zero", str(res.data))

    def test_08_draft_update_allows_editing_lines(self):
        """Draft transfers allow editing lines, changing quantities, and updating metadata."""
        create_res = self.client.post(
            "/api/v1/inventory/transfers/",
            {
                "source_warehouse": self.wh_chennai_a.id,
                "destination_warehouse": self.wh_chennai_b.id,
                "lines": [{"item": self.item_laptop.id, "quantity": 5}],
            },
            format="json",
        )
        tx_id = create_res.data["id"]

        # Update draft with 2 different items
        update_res = self.client.put(
            f"/api/v1/inventory/transfers/{tx_id}/",
            {
                "warehouse": self.wh_chennai_a.id,
                "destination_warehouse": self.wh_chennai_b.id,
                "reason": "Updated transfer plan",
                "lines": [
                    {"item": self.item_keyboard.id, "quantity": 15},
                    {"item": self.item_mouse.id, "quantity": 25},
                ],
            },
            format="json",
        )
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        self.assertEqual(update_res.data["total_items"], 2)
        self.assertEqual(update_res.data["total_quantity"], 40.0)

    def test_09_transfer_cancellation_workflow(self):
        """Submitted or approved transfers can be cancelled before dispatch."""
        create_res = self.client.post(
            "/api/v1/inventory/transfers/",
            {
                "source_warehouse": self.wh_chennai_a.id,
                "destination_warehouse": self.wh_chennai_b.id,
                "lines": [{"item": self.item_laptop.id, "quantity": 5}],
            },
            format="json",
        )
        tx_id = create_res.data["id"]
        self.client.post(f"/api/v1/inventory/transfers/{tx_id}/submit/")

        cancel_res = self.client.post(
            f"/api/v1/inventory/transfers/{tx_id}/cancel/",
            {"reason": "Site maintenance at destination"},
            format="json",
        )
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_res.data["status"], "CANCELLED")

        # Dispatched transfer cannot be cancelled
        tx_disp = StockOperationsService.save_draft(
            StockTransaction.TransactionType.TRANSFER,
            {
                "source_warehouse": self.wh_chennai_a.id,
                "destination_warehouse": self.wh_chennai_b.id,
                "lines": [{"item": self.item_mouse.id, "quantity": 5}],
            },
        )
        InventoryPostingService.dispatch_transfer(tx_disp)
        cant_cancel = self.client.post(f"/api/v1/inventory/transfers/{tx_disp.id}/cancel/")
        self.assertEqual(cant_cancel.status_code, status.HTTP_400_BAD_REQUEST)

    def test_10_product_stock_lookup_endpoint(self):
        """Product-stock lookup endpoint returns real-time on-hand and available stock."""
        res = self.client.get(
            f"/api/v1/inventory/transfers/product-stock/?warehouse={self.wh_chennai_a.id}&item={self.item_laptop.id}"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["on_hand"], 100.0)
        self.assertEqual(res.data["available"], 100.0)
        self.assertEqual(res.data["city"], "Chennai")

    def test_11_transfer_history_timeline(self):
        """History action provides complete timeline, in-transit status, and ledger movements."""
        payload = {
            "source_warehouse": self.wh_chennai_a.id,
            "destination_warehouse": self.wh_chennai_b.id,
            "lines": [{"item": self.item_mouse.id, "quantity": 10}],
        }
        res = self.client.post("/api/v1/inventory/transfers/", payload, format="json")
        tx_id = res.data["id"]
        self.client.post(f"/api/v1/inventory/transfers/{tx_id}/submit/")
        self.client.post(f"/api/v1/inventory/transfers/{tx_id}/approve/")
        self.client.post(f"/api/v1/inventory/transfers/{tx_id}/dispatch/")

        hist_res = self.client.get(f"/api/v1/inventory/transfers/{tx_id}/history/")
        self.assertEqual(hist_res.status_code, status.HTTP_200_OK)
        self.assertIn("timeline", hist_res.data)
        self.assertIn("in_transit", hist_res.data)
        self.assertIn("ledger_movements", hist_res.data)
        self.assertTrue(len(hist_res.data["timeline"]) >= 4)
        self.assertTrue(len(hist_res.data["in_transit"]) >= 1)
