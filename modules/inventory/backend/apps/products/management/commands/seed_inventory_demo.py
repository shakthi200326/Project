from decimal import Decimal
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.categories.models import InventoryCategory
from apps.brands.models import Brand
from apps.units.models import UnitOfMeasure
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation, Rack, Bin
from apps.stock.models import StockBalance, StockLedgerEntry, DamagedStock
from apps.valuation.models import InventoryValuation
from apps.batches.models import Batch
from apps.serial_numbers.models import SerialNumber
from apps.planning.models import ReorderRule, StockLevel, ReplenishmentPlan, PurchaseSuggestion
from apps.reconciliation.models import StockCount
from apps.configuration.models import InventoryConfiguration, DocumentNumberingRule, ConfigurationAuditLog


class Command(BaseCommand):
    help = "Seeds comprehensive end-to-end demo inventory data across all 9 modules."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Enterprise Inventory data across all modules...")
        today = timezone.localdate()

        # 1. Categories
        cat_mech, _ = InventoryCategory.objects.get_or_create(code="CAT-MECH", name="Mechanical Components")
        cat_hyd, _ = InventoryCategory.objects.get_or_create(code="CAT-HYD", name="Hydraulics & Pneumatics")
        cat_trans, _ = InventoryCategory.objects.get_or_create(code="CAT-TRANS", name="Power Transmission")
        cat_sens, _ = InventoryCategory.objects.get_or_create(code="CAT-SENS", name="Sensors & Automation")
        cat_chem, _ = InventoryCategory.objects.get_or_create(code="CAT-CHEM", name="Chemicals & Fluids")

        # 2. Units of Measure
        uom_ea, _ = UnitOfMeasure.objects.get_or_create(code="EA", defaults={"name": "Each / Unit", "symbol": "ea", "is_base": True, "decimal_places": 0})
        uom_nos, _ = UnitOfMeasure.objects.get_or_create(code="NOS", defaults={"name": "Numbers", "symbol": "Nos", "is_base": True, "decimal_places": 0, "allow_fractional_quantity": False})
        uom_kg, _ = UnitOfMeasure.objects.get_or_create(code="KG", defaults={"name": "Kilogram", "symbol": "kg", "is_base": True, "decimal_places": 3})
        uom_ltr, _ = UnitOfMeasure.objects.get_or_create(code="LTR", defaults={"name": "Liter", "symbol": "L", "is_base": True, "decimal_places": 2})
        uom_mtr, _ = UnitOfMeasure.objects.get_or_create(code="MTR", defaults={"name": "Meter", "symbol": "m", "is_base": True, "decimal_places": 2})
        uom_box, _ = UnitOfMeasure.objects.get_or_create(code="BOX", defaults={"name": "Box (10 units)", "symbol": "bx", "is_base": False, "base_unit": uom_ea, "conversion_factor": Decimal("10.0000"), "decimal_places": 0})
        uom_pal, _ = UnitOfMeasure.objects.get_or_create(code="PAL", defaults={"name": "Pallet (100 units)", "symbol": "pal", "is_base": False, "base_unit": uom_ea, "conversion_factor": Decimal("100.0000"), "decimal_places": 0})

        # 3. Brands
        brand_skf, _ = Brand.objects.get_or_create(code="SKF", defaults={"name": "SKF Precision", "country": "Sweden"})
        brand_rex, _ = Brand.objects.get_or_create(code="REX", defaults={"name": "Bosch Rexroth", "country": "Germany"})
        brand_gat, _ = Brand.objects.get_or_create(code="GAT", defaults={"name": "Gates PowerGrip", "country": "USA"})
        brand_omr, _ = Brand.objects.get_or_create(code="OMR", defaults={"name": "Omron Industrial", "country": "Japan"})
        brand_mob, _ = Brand.objects.get_or_create(code="MOB", defaults={"name": "Mobil Rarus", "country": "USA"})

        # 4. Warehouses & Hierarchy
        wh_main, _ = Warehouse.objects.get_or_create(code="WH-MAIN", defaults={"name": "Main Central Fulfillment Hub", "address": "Chicago, IL", "warehouse_type": "Main Warehouse", "city": "Chicago", "country": "United States", "is_active": True})
        wh_east, _ = Warehouse.objects.get_or_create(code="WH-EAST", defaults={"name": "East Coast Logistics Terminal", "address": "Newark, NJ", "warehouse_type": "Distribution Warehouse", "city": "Newark", "country": "United States", "is_active": True})
        wh_west, _ = Warehouse.objects.get_or_create(code="WH-WEST", defaults={"name": "West Coast Depot", "address": "Reno, NV", "warehouse_type": "Distribution Warehouse", "city": "Reno", "country": "United States", "is_active": True})

        loc_a3, _ = StorageLocation.objects.get_or_create(warehouse=wh_main, code="A3-RB", defaults={"name": "Aisle 3 - Rack B", "location_type": "Storage", "is_active": True})
        loc_a1, _ = StorageLocation.objects.get_or_create(warehouse=wh_main, code="A1-B4", defaults={"name": "Aisle 1 - Bin 4", "location_type": "Picking", "is_active": True})
        loc_rec, _ = StorageLocation.objects.get_or_create(warehouse=wh_main, code="REC-01", defaults={"name": "Receiving Dock 1", "location_type": "Receiving", "is_active": True})

        rack_a, _ = Rack.objects.get_or_create(warehouse=wh_main, location=loc_a3, code="RACK-A01", defaults={"name": "Pallet Rack A01", "number_of_levels": 4, "status": "Active"})
        bin_1, _ = Bin.objects.get_or_create(warehouse=wh_main, location=loc_a3, rack=rack_a, code="BIN-A1-01", defaults={"name": "Bin Level 1 Slot 1", "rack_level": 1, "status": "Active"})

        # 5. Items
        items_data = [
            ("BRG-6205-2RS", "Industrial Ball Bearing 6205-2RS", cat_mech, "SKF Precision", "EA", 100, 450, 14.85, InventoryItem.Tracking.BATCH),
            ("HYD-SV-24V", "Hydraulic Solenoid Valve 24V DC", cat_hyd, "Bosch Rexroth", "EA", 25, 18, 128.50, InventoryItem.Tracking.SERIAL),
            ("BELT-T10-1200", "Polyurethane Timing Belt T10-1200", cat_trans, "Gates PowerGrip", "EA", 50, 280, 32.40, InventoryItem.Tracking.NONE),
            ("ENC-OPT-1024", "Optical Rotary Encoder 1024 PPR", cat_sens, "Omron Industrial", "EA", 15, 0, 95.00, InventoryItem.Tracking.SERIAL),
            ("LUB-SYN-VG46", "Synthetic Compressor Lubricant ISO VG 46", cat_chem, "Mobil Rarus", "LTR", 300, 1250, 18.20, InventoryItem.Tracking.BATCH),
        ]

        created_items = {}
        for code, name, cat, brand, unit, reorder_pt, on_hand, cost, tracking_type in items_data:
            item, _ = InventoryItem.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "category": cat,
                    "brand": brand,
                    "base_unit": unit,
                    "tracking": tracking_type,
                    "reorder_point": Decimal(str(reorder_pt)),
                    "reorder_quantity": Decimal(str(reorder_pt * 2)),
                    "barcode": f"890123{code.replace('-', '')[:6]}",
                },
            )
            created_items[code] = item

            # Balance
            bal, _ = StockBalance.objects.get_or_create(
                item=item,
                warehouse=wh_main,
                location=loc_a3,
                defaults={"on_hand_qty": Decimal(str(on_hand)), "reserved_qty": Decimal("10") if on_hand > 20 else Decimal("0"), "bin": bin_1},
            )

            # Valuation
            val, _ = InventoryValuation.objects.get_or_create(
                item=item,
                warehouse=wh_main,
                defaults={
                    "total_on_hand": Decimal(str(on_hand)),
                    "weighted_average_cost": Decimal(str(cost)),
                    "total_value": Decimal(str(on_hand)) * Decimal(str(cost)),
                },
            )

            # Ledger entry
            if on_hand > 0:
                StockLedgerEntry.objects.get_or_create(
                    item=item,
                    warehouse=wh_main,
                    location=loc_a3,
                    movement_type=StockLedgerEntry.MovementType.RECEIPT,
                    transaction_ref=f"INIT-{code}",
                    defaults={
                        "quantity_delta": Decimal(str(on_hand)),
                        "balance_after": Decimal(str(on_hand)),
                        "unit_cost": Decimal(str(cost)),
                        "total_value_delta": Decimal(str(on_hand)) * Decimal(str(cost)),
                        "actor": "seed_script",
                    },
                )

        # 6. Batches (Phase 5)
        item_brg = created_items["BRG-6205-2RS"]
        item_lub = created_items["LUB-SYN-VG46"]

        Batch.objects.get_or_create(
            batch_number="BAT-BRG-2026-01",
            defaults={
                "item": item_brg,
                "warehouse": wh_main,
                "location": loc_a3,
                "received_date": today - timedelta(days=20),
                "initial_quantity": Decimal("250.0000"),
                "remaining_quantity": Decimal("200.0000"),
                "batch_status": "Released",
            }
        )

        Batch.objects.get_or_create(
            batch_number="BAT-LUB-2026-04",
            defaults={
                "item": item_lub,
                "warehouse": wh_main,
                "location": loc_a3,
                "received_date": today - timedelta(days=40),
                "expiry_date": today + timedelta(days=18),  # Expiring soon
                "initial_quantity": Decimal("500.0000"),
                "remaining_quantity": Decimal("350.0000"),
                "batch_status": "Released",
            }
        )

        Batch.objects.get_or_create(
            batch_number="BAT-PST-2025-11",
            defaults={
                "item": item_lub,
                "warehouse": wh_main,
                "location": loc_a3,
                "received_date": today - timedelta(days=120),
                "expiry_date": today - timedelta(days=5),  # Expired
                "initial_quantity": Decimal("50.0000"),
                "remaining_quantity": Decimal("25.0000"),
                "batch_status": "Quarantined",
            }
        )

        # 7. Serials (Phase 5)
        item_hyd = created_items["HYD-SV-24V"]
        SerialNumber.objects.get_or_create(
            serial_number="SN-HYD-2026-001",
            defaults={"item": item_hyd, "warehouse": wh_main, "location": loc_a3, "status": "In Stock"}
        )
        SerialNumber.objects.get_or_create(
            serial_number="SN-HYD-2026-002",
            defaults={"item": item_hyd, "warehouse": wh_main, "location": loc_a3, "status": "In Stock"}
        )

        # 8. Reorder Rules & Min/Max (Phase 6)
        ReorderRule.objects.get_or_create(
            product=item_hyd,
            warehouse=wh_main,
            defaults={
                "reorder_point": Decimal("25.0000"),
                "reorder_quantity": Decimal("50.0000"),
                "lead_time_days": 7,
                "status": "Active",
            }
        )
        StockLevel.objects.get_or_create(
            product=item_brg,
            warehouse=wh_main,
            defaults={"min_stock": Decimal("50.0000"), "max_stock": Decimal("600.0000"), "safety_stock": Decimal("20.0000")}
        )

        # 9. Stock Counts & Audit (Phase 7)
        StockCount.objects.get_or_create(
            count_number="PC-2026-0001",
            defaults={
                "warehouse": wh_main,
                "item": item_hyd,
                "system_quantity": Decimal("18.0000"),
                "physical_quantity": Decimal("16.0000"),
                "difference_quantity": Decimal("-2.0000"),
                "status": "COMPLETED",
                "count_date": today,
            }
        )

        # 10. Global Configuration (Phase 9)
        cfg = InventoryConfiguration.get_solo()
        cfg.inventory_module_name = "Enterprise Inventory Management"
        cfg.base_currency = "USD"
        cfg.default_warehouse = wh_main
        cfg.default_uom = "EA"
        cfg.enable_multiple_warehouses = True
        cfg.save()

        # Seed Document Numbering Rules
        rules = [
            ("Warehouse", "WH", 1, 4, "Never"),
            ("Storage Location", "LOC", 1, 4, "Never"),
            ("Rack", "RACK", 1, 4, "Never"),
            ("Bin", "BIN", 1, 4, "Never"),
            ("Goods Receipt", "GRN", 1, 5, "Never"),
            ("Stock Issue", "ISS", 1, 5, "Never"),
            ("Stock Transfer", "TRF", 1, 5, "Never"),
            ("Stock Adjustment", "ADJ", 1, 5, "Never"),
            ("Stock Return", "RET", 1, 5, "Never"),
            ("Stock Reservation", "RES", 1, 5, "Never"),
            ("Stock Reconciliation", "REC", 1, 5, "Never"),
        ]
        for doc, pfx, start, length, freq in rules:
            DocumentNumberingRule.objects.get_or_create(
                document_type=doc,
                defaults={"prefix": pfx, "starting_number": start, "current_number": start, "number_length": length, "reset_frequency": freq}
            )

        self.stdout.write(self.style.SUCCESS("Successfully seeded comprehensive end-to-end inventory data across all 9 modules!"))
