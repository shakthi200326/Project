from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.categories.models import InventoryCategory
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.valuation.models import InventoryValuation

class Command(BaseCommand):
    help = "Seeds realistic demo inventory products, warehouses, balances, and ledger entries."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Enterprise Inventory data...")

        # 1. Categories
        cat_mech, _ = InventoryCategory.objects.get_or_create(code="CAT-MECH", name="Mechanical Components")
        cat_hyd, _ = InventoryCategory.objects.get_or_create(code="CAT-HYD", name="Hydraulics & Pneumatics")
        cat_trans, _ = InventoryCategory.objects.get_or_create(code="CAT-TRANS", name="Power Transmission")
        cat_sens, _ = InventoryCategory.objects.get_or_create(code="CAT-SENS", name="Sensors & Automation")
        cat_chem, _ = InventoryCategory.objects.get_or_create(code="CAT-CHEM", name="Chemicals & Fluids")

        # 2. Warehouses
        wh_main, _ = Warehouse.objects.get_or_create(code="WH-MAIN", name="Main Central Fulfillment Hub", address="Chicago, IL")
        wh_east, _ = Warehouse.objects.get_or_create(code="WH-EAST", name="East Coast Logistics Terminal", address="Newark, NJ")

        loc_a3, _ = StorageLocation.objects.get_or_create(warehouse=wh_main, code="A3-RB", name="Aisle 3 - Rack B", zone="Zone A")
        loc_a1, _ = StorageLocation.objects.get_or_create(warehouse=wh_main, code="A1-B4", name="Aisle 1 - Bin 4", zone="Zone A")

        # 3. Items
        items_data = [
            ("BRG-6205-2RS", "Industrial Ball Bearing 6205-2RS", cat_mech, "SKF Precision", "EA", 100, 450, 14.85),
            ("HYD-SV-24V", "Hydraulic Solenoid Valve 24V DC", cat_hyd, "Bosch Rexroth", "EA", 25, 18, 128.50),
            ("BELT-T10-1200", "Polyurethane Timing Belt T10-1200", cat_trans, "Gates PowerGrip", "EA", 50, 280, 32.40),
            ("ENC-OPT-1024", "Optical Rotary Encoder 1024 PPR", cat_sens, "Omron Industrial", "EA", 15, 0, 95.00),
            ("LUB-SYN-VG46", "Synthetic Compressor Lubricant ISO VG 46", cat_chem, "Mobil Rarus", "LTR", 300, 1250, 18.20),
        ]

        for code, name, cat, brand, unit, reorder_pt, on_hand, cost in items_data:
            item, _ = InventoryItem.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "category": cat,
                    "brand": brand,
                    "base_unit": unit,
                    "reorder_point": Decimal(str(reorder_pt)),
                    "reorder_quantity": Decimal(str(reorder_pt * 2)),
                    "barcode": f"890123{code.replace('-', '')[:6]}",
                },
            )

            # Balance
            bal, _ = StockBalance.objects.get_or_create(
                item=item,
                warehouse=wh_main,
                location=loc_a3,
                defaults={"on_hand_qty": Decimal(str(on_hand)), "reserved_qty": Decimal("10") if on_hand > 20 else Decimal("0")},
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

        self.stdout.write(self.style.SUCCESS("Successfully seeded enterprise inventory catalog & balances!"))

