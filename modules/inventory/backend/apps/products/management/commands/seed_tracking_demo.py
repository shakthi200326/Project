from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation
from apps.batches.models import (
    Batch,
    BatchQuarantineRecord,
    ShelfLifePolicy,
    ProductRecall,
    RecallAction,
    AllocationRecord,
)
from apps.serial_numbers.models import SerialNumber
from apps.stock.models import StockLedgerEntry
from apps.movements.models import StockTransaction


class Command(BaseCommand):
    help = "Seed comprehensive enterprise demo data for Batch, Lot & Serial Tracking module."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Enterprise Batch, Lot & Serial Tracking demo data...")

        warehouse = Warehouse.objects.first()
        if not warehouse:
            warehouse = Warehouse.objects.create(
                code="WH-MAIN",
                name="Main Central Fulfillment Hub",
                is_active=True,
            )

        location = StorageLocation.objects.filter(warehouse=warehouse).first()
        if not location:
            location = StorageLocation.objects.create(
                warehouse=warehouse,
                code="LOC-STO-A1",
                name="Main Storage Aisle 1",
                is_active=True,
            )

        # Get or create demo items with tracking configurations
        item_batch = InventoryItem.objects.filter(tracking="BATCH").first()
        if not item_batch:
            item_batch = InventoryItem.objects.first()
            if item_batch:
                item_batch.tracking = "BATCH"
                item_batch.batch_tracking_required = True
                item_batch.save()

        item_serial = InventoryItem.objects.filter(tracking="SERIAL").first()
        if not item_serial:
            item_serial = InventoryItem.objects.exclude(id=item_batch.id if item_batch else 0).first()
            if item_serial:
                item_serial.tracking = "SERIAL"
                item_serial.serial_tracking_required = True
                item_serial.save()

        today = date.today()

        # ── 1. Batches & Lots ────────────────────────────────────────────────
        batches_data = [
            {
                "batch_number": "BAT-2026-BRG-01",
                "tracking_type": "BATCH",
                "item": item_batch,
                "warehouse": warehouse,
                "location": location,
                "supplier": "Apex Precision Components",
                "supplier_lot": "LOT-APX-9981",
                "goods_receipt_ref": "GRN-2026-0001",
                "manufacturer": "Apex Precision Ltd",
                "manufacturing_date": today - timedelta(days=120),
                "received_date": today - timedelta(days=100),
                "expiry_date": today + timedelta(days=600),
                "initial_quantity": Decimal("500.0000"),
                "remaining_quantity": Decimal("450.0000"),
                "batch_status": Batch.Status.RELEASED,
                "status": Batch.Status.HEALTHY,
            },
            {
                "batch_number": "LOT-2026-LUB-88",
                "tracking_type": "LOT",
                "item": item_batch,
                "warehouse": warehouse,
                "location": location,
                "supplier": "PetroSynth Chemical Corp",
                "supplier_lot": "SYN-LOT-441",
                "goods_receipt_ref": "GRN-2026-0002",
                "manufacturer": "PetroSynth Chemicals",
                "manufacturing_date": today - timedelta(days=180),
                "received_date": today - timedelta(days=170),
                "expiry_date": today + timedelta(days=20),  # Near Expiry!
                "initial_quantity": Decimal("1000.0000"),
                "remaining_quantity": Decimal("380.0000"),
                "batch_status": Batch.Status.RELEASED,
                "status": Batch.Status.EXPIRING_SOON,
            },
            {
                "batch_number": "LOT-2025-PST-09",
                "tracking_type": "LOT",
                "item": item_batch,
                "warehouse": warehouse,
                "location": location,
                "supplier": "Global Polymers Ltd",
                "supplier_lot": "POLY-7782",
                "goods_receipt_ref": "GRN-2025-0045",
                "manufacturer": "Global Polymers",
                "manufacturing_date": today - timedelta(days=400),
                "received_date": today - timedelta(days=390),
                "expiry_date": today - timedelta(days=15),  # Expired!
                "initial_quantity": Decimal("200.0000"),
                "remaining_quantity": Decimal("45.0000"),
                "batch_status": Batch.Status.RELEASED,
                "status": Batch.Status.EXPIRED,
            },
            {
                "batch_number": "BAT-2026-VAL-44",
                "tracking_type": "BATCH",
                "item": item_batch,
                "warehouse": warehouse,
                "location": location,
                "supplier": "ValvTech Industries",
                "supplier_lot": "VT-LOT-8810",
                "goods_receipt_ref": "GRN-2026-0003",
                "manufacturer": "ValvTech",
                "manufacturing_date": today - timedelta(days=30),
                "received_date": today - timedelta(days=20),
                "expiry_date": today + timedelta(days=700),
                "initial_quantity": Decimal("150.0000"),
                "remaining_quantity": Decimal("100.0000"),
                "quarantined_quantity": Decimal("50.0000"),
                "batch_status": Batch.Status.QUARANTINED,
                "status": Batch.Status.QUARANTINED,
            },
        ]

        created_batches = {}
        for b_dict in batches_data:
            b, _ = Batch.objects.update_or_create(
                batch_number=b_dict["batch_number"],
                defaults=b_dict,
            )
            created_batches[b.batch_number] = b

        # ── 2. Batch Quarantine Record ───────────────────────────────────────
        q_batch = created_batches.get("BAT-2026-VAL-44")
        if q_batch:
            BatchQuarantineRecord.objects.get_or_create(
                quarantine_number="QUAR-2026-0012",
                defaults={
                    "batch": q_batch,
                    "product": q_batch.item,
                    "warehouse": warehouse,
                    "location": location,
                    "quarantine_quantity": Decimal("50.0000"),
                    "quarantine_reason": BatchQuarantineRecord.Reason.QUALITY_ISSUE,
                    "remarks": "Quarantined for metallurgical seal inspection variance under QA alert.",
                    "quarantine_date": today - timedelta(days=5),
                },
            )

        # ── 3. Serial Numbers ────────────────────────────────────────────────
        serials_data = [
            ("SN-HYD-9001", SerialNumber.Status.AVAILABLE, 0),
            ("SN-HYD-9002", SerialNumber.Status.AVAILABLE, 0),
            ("SN-HYD-9003", SerialNumber.Status.RESERVED, 0),
            ("SN-HYD-9004", SerialNumber.Status.ISSUED, 0),
            ("SN-HYD-9005", SerialNumber.Status.IN_TRANSIT, 0),
            ("SN-HYD-9006", SerialNumber.Status.QUARANTINED, 0),
            ("SN-HYD-9007", SerialNumber.Status.DAMAGED, 0),
            ("SN-HYD-9008", SerialNumber.Status.RETURNED, 0),
        ]

        for sn_code, sn_stat, _ in serials_data:
            SerialNumber.objects.update_or_create(
                serial_number=sn_code,
                defaults={
                    "item": item_serial or item_batch,
                    "warehouse": warehouse,
                    "location": location,
                    "batch": created_batches.get("BAT-2026-BRG-01"),
                    "received_date": today - timedelta(days=60),
                    "status": sn_stat,
                    "goods_receipt_ref": "GRN-2026-0001",
                    "warranty_start_date": today - timedelta(days=60),
                    "warranty_until": today + timedelta(days=305),
                    "notes": f"Serial {sn_code} verified and logged.",
                },
            )

        # ── 4. Shelf Life Policies ───────────────────────────────────────────
        if item_batch:
            ShelfLifePolicy.objects.update_or_create(
                item=item_batch,
                variant=None,
                defaults={
                    "shelf_life_duration": 18,
                    "shelf_life_unit": ShelfLifePolicy.ShelfLifeUnit.MONTHS,
                    "expiry_warning_days": 30,
                    "min_remaining_shelf_life_days": 60,
                    "auto_calculate_expiry": True,
                    "allow_manual_override": True,
                },
            )

        if item_serial:
            ShelfLifePolicy.objects.update_or_create(
                item=item_serial,
                variant=None,
                defaults={
                    "shelf_life_duration": 36,
                    "shelf_life_unit": ShelfLifePolicy.ShelfLifeUnit.MONTHS,
                    "expiry_warning_days": 45,
                    "min_remaining_shelf_life_days": 90,
                    "auto_calculate_expiry": True,
                    "allow_manual_override": True,
                },
            )

        # ── 5. Allocation Records ────────────────────────────────────────────
        allocations_data = [
            {
                "item": item_batch,
                "warehouse": warehouse,
                "batch": created_batches.get("BAT-2026-BRG-01"),
                "transaction_ref": "ALLOC-2026-SO-8891",
                "strategy": AllocationRecord.Strategy.FIFO,
                "allocated_quantity": Decimal("25.0000"),
            },
            {
                "item": item_batch,
                "warehouse": warehouse,
                "batch": created_batches.get("LOT-2026-LUB-88"),
                "transaction_ref": "ALLOC-2026-SO-8902",
                "strategy": AllocationRecord.Strategy.FEFO,
                "allocated_quantity": Decimal("40.0000"),
            },
        ]
        for a_dict in allocations_data:
            AllocationRecord.objects.get_or_create(
                transaction_ref=a_dict["transaction_ref"],
                batch=a_dict["batch"],
                defaults=a_dict,
            )

        # ── 6. Product Recalls & Actions ─────────────────────────────────────
        recall_1, _ = ProductRecall.objects.update_or_create(
            recall_number="REC-2026-0001",
            defaults={
                "title": "Voluntary Recall: Hydraulic Solenoid Valve Seal Variance",
                "reason": "Dimensional variance detected on internal Nitrile seals causing minor hydraulic seep at high pressures.",
                "recall_type": ProductRecall.RecallType.VOLUNTARY,
                "item": item_batch,
                "batch": created_batches.get("BAT-2026-VAL-44"),
                "priority": ProductRecall.Priority.HIGH,
                "status": ProductRecall.Status.IN_PROGRESS,
                "affected_quantity": Decimal("50.0000"),
                "description": "Notice issued to distributors to isolate batches immediately.",
                "corrective_action": "Exchange with rev-C certified seals from Tier-1 supplier.",
                "initiated_by": "Quality Lead - QA Dept",
                "initiated_date": today - timedelta(days=4),
            },
        )

        RecallAction.objects.get_or_create(
            recall=recall_1,
            action_type=RecallAction.ActionType.STATUS_CHANGE,
            actor="QA Lead",
            defaults={
                "quantity_affected": Decimal("50.0000"),
                "notes": "Recall initiated after field report notification.",
            },
        )
        RecallAction.objects.get_or_create(
            recall=recall_1,
            action_type=RecallAction.ActionType.QUARANTINE_APPLIED,
            actor="QA Lead",
            defaults={
                "quantity_affected": Decimal("50.0000"),
                "notes": "50 units in warehouse placed under immediate hold in Vault A.",
            },
        )

        # ── 7. Stock Ledger Movements for Genealogies ────────────────────────
        StockLedgerEntry.objects.get_or_create(
            transaction_ref="GRN-2026-0001",
            batch_number="BAT-2026-BRG-01",
            movement_type="RECEIPT",
            defaults={
                "item": item_batch,
                "warehouse": warehouse,
                "location": location,
                "quantity_delta": Decimal("500.0000"),
                "balance_after": Decimal("500.0000"),
                "unit_cost": Decimal("14.5000"),
                "total_value_delta": Decimal("7250.0000"),
                "actor": "receiving_clerk",
                "reason": "Inward receipt against PO-89001",
            },
        )

        StockLedgerEntry.objects.get_or_create(
            transaction_ref="ISS-2026-0091",
            batch_number="BAT-2026-BRG-01",
            movement_type="ISSUE",
            defaults={
                "item": item_batch,
                "warehouse": warehouse,
                "location": location,
                "quantity_delta": Decimal("-50.0000"),
                "balance_after": Decimal("450.0000"),
                "unit_cost": Decimal("14.5000"),
                "total_value_delta": Decimal("-725.0000"),
                "actor": "dispatch_lead",
                "reason": "Issued for production assembly Line 2",
            },
        )

        self.stdout.write(self.style.SUCCESS("Batch, Lot & Serial Tracking demo data seeded successfully!"))

