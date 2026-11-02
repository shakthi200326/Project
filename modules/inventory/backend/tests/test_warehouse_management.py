import pytest
from rest_framework.test import APITestCase
from apps.warehouses.models import (
    Warehouse,
    StorageLocation,
    Rack,
    Bin,
    WarehouseConfiguration,
)

class WarehouseManagementPhase2Tests(APITestCase):
    def setUp(self):
        self.wh = Warehouse.objects.create(
            code="WH-MAIN",
            name="Main Fulfillment Hub",
            warehouse_type=Warehouse.WarehouseType.MAIN,
            description="Central automated distribution warehouse",
            address="100 Logistics Blvd",
            city="Chicago",
            state="IL",
            country="United States",
            postal_code="60601",
            manager="Alex Morgan",
            contact_number="+1 (312) 555-0192",
            status="Active",
            is_active=True,
        )

        self.location = StorageLocation.objects.create(
            warehouse=self.wh,
            code="LOC-STO-01",
            name="Bulk Storage Aisle 1",
            location_type=StorageLocation.LocationType.STORAGE,
            description="High-bay heavy pallet storage",
            status="Active",
            is_active=True,
        )

        self.rack = Rack.objects.create(
            warehouse=self.wh,
            location=self.location,
            code="RACK-001",
            name="Aisle 1 Heavy Pallet Rack",
            number_of_levels=5,
            status="Active",
        )

        self.bin = Bin.objects.create(
            warehouse=self.wh,
            location=self.location,
            rack=self.rack,
            code="BIN-A1-01",
            name="Aisle 1 Level 1 Pick Bin",
            rack_level=1,
            barcode="BIN-A1-01-9942",
            status="Active",
        )

    def test_warehouse_creation_and_type_choices(self):
        """Test warehouse model creation with all Phase 2 necessary fields."""
        wh_dist = Warehouse.objects.create(
            code="WH-EAST",
            name="East Coast Distribution Center",
            warehouse_type=Warehouse.WarehouseType.DISTRIBUTION,
            address="42 Harbor Rd",
            city="Newark",
            state="NJ",
            country="United States",
            status="Active",
        )
        self.assertEqual(wh_dist.warehouse_type, "Distribution Warehouse")
        self.assertTrue(wh_dist.is_active)
        self.assertEqual(wh_dist.city, "Newark")

    def test_storage_location_types_and_statuses(self):
        """Test creating storage locations for each required location type and status."""
        types_to_test = [
            StorageLocation.LocationType.RECEIVING,
            StorageLocation.LocationType.STORAGE,
            StorageLocation.LocationType.PICKING,
            StorageLocation.LocationType.PACKING,
            StorageLocation.LocationType.DISPATCH,
            StorageLocation.LocationType.INSPECTION,
            StorageLocation.LocationType.QUARANTINE,
            StorageLocation.LocationType.RETURNS,
        ]
        for idx, loc_type in enumerate(types_to_test):
            loc = StorageLocation.objects.create(
                warehouse=self.wh,
                code=f"LOC-TEST-{idx}",
                name=f"Location for {loc_type}",
                location_type=loc_type,
                status="Blocked" if loc_type == StorageLocation.LocationType.QUARANTINE else "Active",
            )
            self.assertEqual(loc.location_type, loc_type)
            if loc_type == StorageLocation.LocationType.QUARANTINE:
                self.assertFalse(loc.is_active)
                self.assertEqual(loc.status, "Blocked")

    def test_rack_and_bin_hierarchy_and_barcodes(self):
        """Test creating racks and multi-level bins with barcode identification."""
        rack2 = Rack.objects.create(
            warehouse=self.wh,
            location=self.location,
            code="RACK-002",
            name="Aisle 2 Carton Flow Rack",
            number_of_levels=4,
            status="Active",
        )
        bin2 = Bin.objects.create(
            warehouse=self.wh,
            location=self.location,
            rack=rack2,
            code="BIN-A2-02",
            name="Aisle 2 Level 2 Bin",
            rack_level=2,
            barcode="BIN-A2-02-1234",
            status="Active",
        )
        self.assertEqual(bin2.rack.number_of_levels, 4)
        self.assertEqual(bin2.rack_level, 2)
        self.assertEqual(bin2.barcode, "BIN-A2-02-1234")

    def test_warehouse_configuration_defaults(self):
        """Test default warehouse configuration model fields."""
        config = WarehouseConfiguration.objects.create(
            default_warehouse=self.wh,
            allow_negative_stock=False,
            require_storage_location=True,
            require_bin_selection=True,
            enable_multiple_warehouses=True,
            allow_inter_warehouse_transfer=True,
            warehouse_code_prefix="WH",
            location_code_prefix="LOC",
            rack_code_prefix="RACK",
            bin_code_prefix="BIN",
        )
        self.assertEqual(config.warehouse_code_prefix, "WH")
        self.assertEqual(config.location_code_prefix, "LOC")
        self.assertEqual(config.rack_code_prefix, "RACK")
        self.assertEqual(config.bin_code_prefix, "BIN")
        self.assertFalse(config.allow_negative_stock)
        self.assertTrue(config.require_storage_location)
        self.assertTrue(config.require_bin_selection)

    def test_warehouse_api_lifecycle(self):
        """Test REST API endpoints for Warehouse, Location, Rack, Bin, and Config."""
        # 1. Warehouse API
        wh_resp = self.client.post("/api/v1/inventory/warehouses/", {
            "code": "WH-API-1",
            "name": "API Provisioned Hub",
            "warehouse_type": "Production Warehouse",
            "address": "900 Industrial Pkwy",
            "city": "Austin",
            "state": "TX",
            "country": "United States",
            "status": "Active",
        })
        self.assertEqual(wh_resp.status_code, 201)
        created_wh_id = wh_resp.data["id"]

        # 2. Storage Location API
        loc_resp = self.client.post("/api/v1/inventory/locations/", {
            "warehouse": created_wh_id,
            "code": "LOC-API-1",
            "name": "API Pick Station",
            "location_type": "Picking",
            "description": "High velocity conveyor line",
            "status": "Active",
        })
        self.assertEqual(loc_resp.status_code, 201)
        created_loc_id = loc_resp.data["id"]

        # 3. Rack API
        rack_resp = self.client.post("/api/v1/inventory/racks/", {
            "warehouse": created_wh_id,
            "location": created_loc_id,
            "code": "RACK-API-1",
            "name": "API High Rack",
            "number_of_levels": 6,
            "status": "Active",
        })
        self.assertEqual(rack_resp.status_code, 201)
        created_rack_id = rack_resp.data["id"]

        # 4. Bin API
        bin_resp = self.client.post("/api/v1/inventory/bins/", {
            "warehouse": created_wh_id,
            "location": created_loc_id,
            "rack": created_rack_id,
            "code": "BIN-API-1",
            "name": "API Put Bin L1",
            "rack_level": 1,
            "barcode": "BIN-API-1-7788",
            "status": "Active",
        })
        self.assertEqual(bin_resp.status_code, 201)

        # 5. Config API
        cfg_resp = self.client.get("/api/v1/inventory/warehouse-config/")
        self.assertEqual(cfg_resp.status_code, 200)
        self.assertIn("warehouse_code_prefix", cfg_resp.data)
        self.assertIn("location_code_prefix", cfg_resp.data)
        self.assertIn("rack_code_prefix", cfg_resp.data)
        self.assertIn("bin_code_prefix", cfg_resp.data)
