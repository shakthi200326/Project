import uuid
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.test import APITestCase

from apps.warehouses.models import (
    Warehouse,
    StorageLocation,
    WarehouseZone,
    Rack,
    Bin,
    WarehouseMapping,
    WarehouseConfiguration,
    WarehouseOperationalConfiguration,
)
from apps.categories.models import InventoryCategory
from apps.units.models import UnitOfMeasure
from apps.products.models import InventoryItem
from apps.stock.models import StockBalance, StockLedgerEntry
from services.warehouse_service import (
    WarehouseCapacityService,
    WarehousePutawayService,
)


class WarehouseEnterpriseMasterSuite(APITestCase):
    def setUp(self):
        self.cat_main = InventoryCategory.objects.create(code="CAT-WH", name="Warehouse Testing Category")
        self.uom_ea = UnitOfMeasure.objects.create(code="EA", name="Each", dimension=UnitOfMeasure.Dimension.COUNT)
        self.uom_kg = UnitOfMeasure.objects.create(code="KG", name="Kilogram", dimension=UnitOfMeasure.Dimension.WEIGHT)

        self.item_heavy = InventoryItem.objects.create(
            code="STEEL-BEAM-01",
            name="Structural Steel Beam",
            category=self.cat_main,
            base_uom=self.uom_ea,
            weight=Decimal("50.0000"),  # 50 kg per piece
            volume=Decimal("0.250000"),  # 0.25 m³ per piece
            standard_cost=Decimal("150.0000"),
            list_price=Decimal("250.0000"),
        )

        self.item_light = InventoryItem.objects.create(
            code="BOLT-HEX-01",
            name="Hex Bolt M12",
            category=self.cat_main,
            base_uom=self.uom_ea,
            weight=Decimal("0.1000"),   # 0.1 kg per piece
            volume=Decimal("0.000500"),  # 0.0005 m³ per piece
            standard_cost=Decimal("0.5000"),
            list_price=Decimal("1.2000"),
        )

        self.wh_main = Warehouse.objects.create(
            code="WH-MASTER-01",
            name="Central Regional Distribution Center",
            warehouse_type=Warehouse.WarehouseType.DISTRIBUTION,
            address="500 Logistics Parkway",
            city="Dallas",
            state="TX",
            country="United States",
            postal_code="75201",
            contact_person="Sarah Jenkins",
            contact_number="+1 (214) 555-0188",
            email="dallas.hub@example.com",
            manager="Marcus Vance",
            timezone="America/Chicago",
            operating_hours="06:00 - 22:00",
            receiving_enabled=True,
            dispatch_enabled=True,
            storage_enabled=True,
            returns_enabled=True,
            max_weight_capacity=Decimal("250000.0000"),
            max_volume_capacity=Decimal("15000.0000"),
            max_pallet_positions=500,
            status="Active",
        )

        self.zone_ambient = WarehouseZone.objects.create(
            warehouse=self.wh_main,
            code="ZONE-AMB-01",
            name="Ambient High-Bay Zone",
            zone_type=WarehouseZone.ZoneType.STANDARD,
        )

        self.loc_rec = StorageLocation.objects.create(
            warehouse=self.wh_main,
            code="LOC-REC-DOCK1",
            name="Inbound Receiving Dock 1",
            location_type=StorageLocation.LocationType.RECEIVING,
            allow_receiving=True,
            allow_putaway=False,
            allow_picking=False,
            allow_dispatch=False,
            status="Active",
        )

        self.loc_storage = StorageLocation.objects.create(
            warehouse=self.wh_main,
            code="LOC-BULK-A1",
            name="Bulk Storage Aisle 1",
            location_type=StorageLocation.LocationType.STORAGE,
            zone_ref=self.zone_ambient,
            allow_receiving=False,
            allow_putaway=True,
            allow_picking=True,
            allow_dispatch=False,
            allow_product_mixing=True,
            allow_batch_mixing=True,
            max_weight=Decimal("10000.0000"),
            max_volume=Decimal("500.0000"),
            status="Active",
        )

        self.rack_01 = Rack.objects.create(
            warehouse=self.wh_main,
            location=self.loc_storage,
            zone=self.zone_ambient,
            code="RACK-A1-01",
            name="Aisle 1 Heavy Pallet Rack",
            number_of_levels=5,
            max_weight=Decimal("5000.0000"),
            status="Active",
        )

        self.bin_01 = Bin.objects.create(
            warehouse=self.wh_main,
            location=self.loc_storage,
            rack=self.rack_01,
            code="BIN-A1-01-01",
            name="Aisle 1 Level 1 Position 1",
            rack_level=1,
            barcode="BIN-A1-01-01-7788",
            max_weight=Decimal("1000.0000"),
            max_volume=Decimal("2.5000"),
            putaway_priority=10,
            picking_priority=10,
            allow_mixing_products=True,
            allow_mixing_batches=True,
            status="Active",
        )

    # -------------------------------------------------------------------------
    # Scenario 1: Warehouse Master Creation & Capability Flags
    # -------------------------------------------------------------------------
    def test_01_warehouse_master_creation(self):
        resp = self.client.post("/api/v1/inventory/warehouses/", {
            "code": "WH-PROD-01",
            "name": "Midwest Production Plant",
            "warehouse_type": "Production Warehouse",
            "address": "1200 Assembly Row",
            "city": "Detroit",
            "state": "MI",
            "country": "United States",
            "postal_code": "48201",
            "contact_person": "David Miller",
            "contact_number": "+1 (313) 555-0144",
            "email": "detroit.plant@example.com",
            "manager": "Elena Rostova",
            "timezone": "America/Detroit",
            "receiving_enabled": True,
            "dispatch_enabled": False,
            "storage_enabled": True,
            "returns_enabled": False,
            "max_weight_capacity": "500000.0000",
            "max_volume_capacity": "20000.0000",
            "max_pallet_positions": 800,
            "status": "Active",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["code"], "WH-PROD-01")
        self.assertTrue(resp.data["receiving_enabled"])
        self.assertFalse(resp.data["dispatch_enabled"])

    # -------------------------------------------------------------------------
    # Scenario 2: Duplicate Warehouse Code Prevention
    # -------------------------------------------------------------------------
    def test_02_duplicate_warehouse_code_prevention(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Warehouse.objects.create(
                    code="WH-MASTER-01",
                    name="Duplicate Hub",
                    warehouse_type=Warehouse.WarehouseType.MAIN,
                )

    # -------------------------------------------------------------------------
    # Scenario 3: Multiple Multi-Type Warehouses
    # -------------------------------------------------------------------------
    def test_03_multiple_multi_type_warehouses(self):
        types = [
            ("WH-MAIN-HQ", "Main Warehouse", Warehouse.WarehouseType.MAIN),
            ("WH-RET-01", "Retail Store #101", Warehouse.WarehouseType.RETAIL),
            ("WH-TRN-01", "Cross-Dock Transit", Warehouse.WarehouseType.TRANSIT),
        ]
        for code, name, w_type in types:
            wh = Warehouse.objects.create(code=code, name=name, warehouse_type=w_type)
            self.assertEqual(wh.warehouse_type, w_type)
            self.assertTrue(wh.is_active)

    # -------------------------------------------------------------------------
    # Scenario 4: Location Hierarchy & Circular Reference Prevention
    # -------------------------------------------------------------------------
    def test_04_location_hierarchy_and_circular_check(self):
        parent_loc = StorageLocation.objects.create(
            warehouse=self.wh_main,
            code="LOC-ZONE-A",
            name="Zone A Area",
            location_type=StorageLocation.LocationType.STORAGE,
        )
        child_loc = StorageLocation.objects.create(
            warehouse=self.wh_main,
            parent_location=parent_loc,
            code="LOC-ZONE-A-SEC1",
            name="Zone A Section 1",
            location_type=StorageLocation.LocationType.STORAGE,
        )
        self.assertEqual(child_loc.parent_location, parent_loc)
        self.assertEqual(parent_loc.sub_locations.count(), 1)

        # Circular check: setting parent's parent to child must raise ValidationError
        parent_loc.parent_location = child_loc
        with self.assertRaises(ValidationError):
            parent_loc.save()

    # -------------------------------------------------------------------------
    # Scenario 5: Simple Warehouse Support (No Racks/Bins Forced)
    # -------------------------------------------------------------------------
    def test_05_simple_warehouse_support(self):
        wh_simple = Warehouse.objects.create(
            code="WH-RETAIL-BACKROOM",
            name="Downtown Retail Backroom",
            warehouse_type=Warehouse.WarehouseType.RETAIL,
        )
        loc_flat = StorageLocation.objects.create(
            warehouse=wh_simple,
            code="SHELF-01",
            name="Main Stock Shelf",
            location_type=StorageLocation.LocationType.STORAGE,
        )
        self.assertEqual(loc_flat.warehouse, wh_simple)
        self.assertEqual(loc_flat.racks.count(), 0)
        self.assertEqual(loc_flat.bins.count(), 0)

    # -------------------------------------------------------------------------
    # Scenario 6: Rack & Shelf Level Creation
    # -------------------------------------------------------------------------
    def test_06_rack_and_shelf_creation(self):
        rack = Rack.objects.create(
            warehouse=self.wh_main,
            location=self.loc_storage,
            code="RACK-A1-02",
            name="Aisle 1 Drive-In Rack",
            rack_type="Drive-In Pallet",
            number_of_levels=6,
            max_weight=Decimal("8000.0000"),
        )
        self.assertEqual(rack.number_of_levels, 6)
        self.assertEqual(rack.rack_type, "Drive-In Pallet")

    # -------------------------------------------------------------------------
    # Scenario 7: Bin Creation & Physical Capacities
    # -------------------------------------------------------------------------
    def test_07_bin_creation_and_capacity_limits(self):
        bin_slot = Bin.objects.create(
            warehouse=self.wh_main,
            location=self.loc_storage,
            rack=self.rack_01,
            code="BIN-A1-01-02",
            name="Aisle 1 Level 1 Position 2",
            rack_level=1,
            bin_type="Carton Flow Slot",
            barcode="BIN-A1-01-02-9900",
            qr_code="QR-BIN-A1-01-02",
            max_weight=Decimal("500.0000"),
            max_volume=Decimal("1.2000"),
            max_quantity=Decimal("100.0000"),
            putaway_priority=5,
            picking_priority=5,
        )
        self.assertEqual(bin_slot.max_weight, Decimal("500.0000"))
        self.assertEqual(bin_slot.putaway_priority, 5)

    # -------------------------------------------------------------------------
    # Scenario 8: Bin Barcode Fast Lookup Endpoint
    # -------------------------------------------------------------------------
    def test_08_bin_barcode_fast_lookup(self):
        resp = self.client.get("/api/v1/inventory/bins/lookup/?barcode=BIN-A1-01-01-7788")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["found"])
        self.assertEqual(resp.data["code"], "BIN-A1-01-01")
        self.assertEqual(resp.data["warehouse_code"], "WH-MASTER-01")

        # Unknown barcode returns 200 with found=False
        resp_404 = self.client.get("/api/v1/inventory/bins/lookup/?barcode=UNKNOWN-BIN-999")
        self.assertEqual(resp_404.status_code, status.HTTP_200_OK)
        self.assertFalse(resp_404.data["found"])

    # -------------------------------------------------------------------------
    # Scenario 9: Product Mixing Policy Rejection
    # -------------------------------------------------------------------------
    def test_09_product_mixing_policy_rejection(self):
        loc_single_sku = StorageLocation.objects.create(
            warehouse=self.wh_main,
            code="LOC-DEDICATED-01",
            name="Dedicated Steel Location",
            location_type=StorageLocation.LocationType.STORAGE,
            allow_product_mixing=False,  # Single SKU only!
            allow_putaway=True,
        )
        # Put steel beams in location
        StockBalance.objects.create(
            warehouse=self.wh_main,
            location=loc_single_sku,
            item=self.item_heavy,
            on_hand_qty=Decimal("10.0000"),
        )
        # Attempting putaway of hex bolts must raise ValidationError
        with self.assertRaises(ValidationError) as cm:
            WarehousePutawayService.validate_putaway_to_location(
                location=loc_single_sku,
                item=self.item_light,
                quantity=Decimal("50.0000"),
            )
        self.assertIn("disallows product mixing", str(cm.exception))

    # -------------------------------------------------------------------------
    # Scenario 10: Batch Mixing Policy Rejection
    # -------------------------------------------------------------------------
    def test_10_batch_mixing_policy_rejection(self):
        loc_single_batch = StorageLocation.objects.create(
            warehouse=self.wh_main,
            code="LOC-LOT-ISO-01",
            name="Single Lot Holding Bay",
            location_type=StorageLocation.LocationType.STORAGE,
            allow_batch_mixing=False,  # Single Lot only!
            allow_putaway=True,
        )
        from apps.batches.models import Batch
        Batch.objects.create(
            batch_number="BATCH-2026-ALPHA",
            item=self.item_heavy,
            warehouse=self.wh_main,
            location=loc_single_batch,
            remaining_quantity=Decimal("5.0000"),
        )
        StockBalance.objects.create(
            warehouse=self.wh_main,
            location=loc_single_batch,
            item=self.item_heavy,
            on_hand_qty=Decimal("5.0000"),
        )
        # Attempting putaway of different batch must raise ValidationError
        with self.assertRaises(ValidationError) as cm:
            WarehousePutawayService.validate_putaway_to_location(
                location=loc_single_batch,
                item=self.item_heavy,
                quantity=Decimal("5.0000"),
                batch_number="BATCH-2026-BETA",
            )
        self.assertIn("disallows batch mixing", str(cm.exception))

    # -------------------------------------------------------------------------
    # Scenario 11: Real-Time Capacity Calculation
    # -------------------------------------------------------------------------
    def test_11_real_time_capacity_calculation(self):
        # 10 beams @ 50kg = 500kg, 0.25m³ = 2.5m³
        StockBalance.objects.create(
            warehouse=self.wh_main,
            location=self.loc_storage,
            bin=self.bin_01,
            item=self.item_heavy,
            on_hand_qty=Decimal("10.0000"),
        )
        # 500 bolts @ 0.1kg = 50kg, 0.0005m³ = 0.25m³
        StockBalance.objects.create(
            warehouse=self.wh_main,
            location=self.loc_storage,
            bin=self.bin_01,
            item=self.item_light,
            on_hand_qty=Decimal("500.0000"),
        )

        cap = WarehouseCapacityService.get_warehouse_capacity(self.wh_main)
        self.assertEqual(cap["warehouse_code"], "WH-MASTER-01")
        # Total weight = 500 + 50 = 550 kg
        self.assertEqual(cap["weight"]["used_kg"], 550.0)
        # Total volume = 2.5 + 0.25 = 2.75 m³
        self.assertEqual(cap["volume"]["used_m3"], 2.75)
        self.assertEqual(cap["capacity_status"], "OPTIMAL")

    # -------------------------------------------------------------------------
    # Scenario 12: Capacity Overflow Enforcement
    # -------------------------------------------------------------------------
    def test_12_capacity_overflow_enforcement(self):
        loc_small = StorageLocation.objects.create(
            warehouse=self.wh_main,
            code="LOC-TINY-01",
            name="Light Duty Shelf",
            location_type=StorageLocation.LocationType.STORAGE,
            max_weight=Decimal("100.0000"),  # 100 kg max
            allow_putaway=True,
        )
        WarehouseOperationalConfiguration.objects.create(
            warehouse=self.wh_main,
            capacity_enforcement=WarehouseOperationalConfiguration.CapacityEnforcement.STRICT_BLOCK,
        )

        # 3 beams = 150 kg > 100 kg capacity
        with self.assertRaises(ValidationError) as cm:
            WarehousePutawayService.validate_putaway_to_location(
                location=loc_small,
                item=self.item_heavy,
                quantity=Decimal("3.0000"),
            )
        self.assertIn("weight capacity exceeded", str(cm.exception))

    # -------------------------------------------------------------------------
    # Scenario 13: Warehouse Mapping (User / Product / Business Unit)
    # -------------------------------------------------------------------------
    def test_13_warehouse_mapping(self):
        resp = self.client.post("/api/v1/inventory/warehouse-mappings/", {
            "warehouse": self.wh_main.id,
            "mapping_type": "PRODUCT",
            "entity_id": str(self.item_heavy.id),
            "entity_name": self.item_heavy.name,
            "is_default": True,
            "is_receiving_default": True,
            "status": "Active",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["mapping_type"], "PRODUCT")
        self.assertTrue(resp.data["is_receiving_default"])

    # -------------------------------------------------------------------------
    # Scenario 14: Goods Receipt Receiving Location Gate
    # -------------------------------------------------------------------------
    def test_14_goods_receipt_receiving_location(self):
        self.assertTrue(self.loc_rec.allow_receiving)
        self.assertFalse(self.loc_storage.allow_receiving)

    # -------------------------------------------------------------------------
    # Scenario 15: Inspection & Quality Hold Routing
    # -------------------------------------------------------------------------
    def test_15_inspection_and_quality_hold_routing(self):
        loc_qa = StorageLocation.objects.create(
            warehouse=self.wh_main,
            code="LOC-INSP-01",
            name="Inbound Quality Inspection Bench",
            location_type=StorageLocation.LocationType.INSPECTION,
        )
        self.assertFalse(loc_qa.allow_picking)
        self.assertFalse(loc_qa.allow_dispatch)

    # -------------------------------------------------------------------------
    # Scenario 16: Accepted Putaway to Storage Bin
    # -------------------------------------------------------------------------
    def test_16_accepted_putaway_to_storage_bin(self):
        can_putaway = WarehousePutawayService.validate_putaway_to_location(
            location=self.loc_storage,
            item=self.item_heavy,
            quantity=Decimal("2.0000"),
        )
        self.assertTrue(can_putaway)

    # -------------------------------------------------------------------------
    # Scenario 17: Quarantine Rejection Isolation
    # -------------------------------------------------------------------------
    def test_17_quarantine_rejection_isolation(self):
        loc_quar = StorageLocation.objects.create(
            warehouse=self.wh_main,
            code="LOC-QUAR-01",
            name="Reject Quarantine Cage",
            location_type=StorageLocation.LocationType.QUARANTINE,
            status="Blocked",
        )
        self.assertFalse(loc_quar.allow_picking)
        self.assertFalse(loc_quar.allow_dispatch)
        self.assertFalse(loc_quar.is_active)

    # -------------------------------------------------------------------------
    # Scenario 18: Same-Warehouse Bin Transfer Total Stock Invariant
    # -------------------------------------------------------------------------
    def test_18_same_warehouse_bin_transfer(self):
        bin_02 = Bin.objects.create(
            warehouse=self.wh_main,
            location=self.loc_storage,
            rack=self.rack_01,
            code="BIN-A1-01-03",
            name="Aisle 1 Level 1 Position 3",
            rack_level=1,
            status="Active",
        )
        valid = WarehousePutawayService.validate_bin_transfer(
            warehouse=self.wh_main,
            source_bin=self.bin_01,
            dest_bin=bin_02,
            item=self.item_heavy,
            quantity=Decimal("5.0000"),
        )
        self.assertTrue(valid)

    # -------------------------------------------------------------------------
    # Scenario 19: Inter-Warehouse Transit Transfer Validation
    # -------------------------------------------------------------------------
    def test_19_inter_warehouse_transit_transfer(self):
        wh_dest = Warehouse.objects.create(
            code="WH-AUSTIN-02",
            name="Austin Hub",
            warehouse_type=Warehouse.WarehouseType.DISTRIBUTION,
        )
        loc_dest_rec = StorageLocation.objects.create(
            warehouse=wh_dest,
            code="LOC-ATX-REC",
            name="Austin Receiving Dock",
            location_type=StorageLocation.LocationType.RECEIVING,
            allow_receiving=True,
        )
        self.assertNotEqual(self.wh_main.id, wh_dest.id)
        self.assertTrue(loc_dest_rec.allow_receiving)

    # -------------------------------------------------------------------------
    # Scenario 20: Inactive Facility & Deletion Safety Protection
    # -------------------------------------------------------------------------
    def test_20_inactive_facility_and_deletion_safety(self):
        # 1. Deactivate warehouse via API
        resp_deact = self.client.post(f"/api/v1/inventory/warehouses/{self.wh_main.id}/deactivate/")
        self.assertEqual(resp_deact.status_code, status.HTTP_200_OK)
        self.wh_main.refresh_from_db()
        self.assertFalse(self.wh_main.is_active)

        # 2. Add an active stock balance referencing this warehouse
        StockBalance.objects.create(
            warehouse=self.wh_main,
            location=self.loc_storage,
            item=self.item_heavy,
            on_hand_qty=Decimal("15.0000"),
        )

        # 3. Attempting deletion must return HTTP 400 Bad Request
        resp_del = self.client.delete(f"/api/v1/inventory/warehouses/{self.wh_main.id}/")
        self.assertEqual(resp_del.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Active inventory balances", resp_del.data["error"])
