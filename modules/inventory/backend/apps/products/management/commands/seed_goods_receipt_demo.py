"""
Management command to seed realistic, enterprise-grade Goods Receipt demo data.
Populates receipts across all lifecycle stages:
  - DRAFT (ready to edit/submit)
  - SUBMITTED (ready for inspection)
  - PARTIALLY_ACCEPTED (with inspection events, quality check, and discrepancy)
  - PUTAWAY_PENDING (partially put away into locations)
  - READY_TO_POST (ready for one-click stock posting)
  - POSTED (in Receipt History with live stock ledger entries)
"""
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation
from apps.goods_receipt.models import ReceiptInspection, ReceiptPutaway, ReceiptDiscrepancy
from apps.movements.models import StockTransaction, StockTransactionLine
from services.goods_receipt_service import GoodsReceiptService
from services.goods_receipt_config import GoodsReceiptConfigService, Submodule


class Command(BaseCommand):
    help = "Seeds realistic enterprise Goods Receipt & Inspection demo data across all lifecycle stages."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Enterprise Goods Receipt & Inspection demo data...")
        today = timezone.localdate()

        # Temporarily enable manual numbering for seed script
        GoodsReceiptConfigService.save("create", {"allow_manual_number": True}, actor="seed")

        # Ensure WH-MAIN and locations exist
        wh = Warehouse.objects.filter(code="WH-MAIN").first()
        if not wh:
            wh = Warehouse.objects.create(
                code="WH-MAIN",
                name="Main Central Fulfillment Hub",
                warehouse_type="Main Warehouse",
                city="Chicago",
                country="United States",
                is_active=True,
                receiving_enabled=True,
            )

        loc_rec = StorageLocation.objects.filter(warehouse=wh, location_type="Receiving").first()
        if not loc_rec:
            loc_rec = StorageLocation.objects.create(
                warehouse=wh,
                code="REC-01",
                name="Receiving Dock 1",
                location_type=StorageLocation.LocationType.RECEIVING,
                allow_receiving=True,
                is_active=True,
            )

        loc_storage = StorageLocation.objects.filter(warehouse=wh, location_type="Storage").first()
        if not loc_storage:
            loc_storage = StorageLocation.objects.create(
                warehouse=wh,
                code="A3-RB",
                name="Aisle 3 - Rack B",
                location_type=StorageLocation.LocationType.STORAGE,
                is_active=True,
            )

        loc_picking = StorageLocation.objects.filter(warehouse=wh, location_type="Picking").first()
        if not loc_picking:
            loc_picking = StorageLocation.objects.create(
                warehouse=wh,
                code="A1-B4",
                name="Aisle 1 - Bin 4",
                location_type=StorageLocation.LocationType.PICKING,
                is_active=True,
            )

        # Get items
        itm_bolt = InventoryItem.objects.filter(code="BELT-T10-1200").first()
        itm_brg = InventoryItem.objects.filter(code="BRG-6205-2RS").first()
        itm_hyd = InventoryItem.objects.filter(code="HYD-SV-24V").first()
        itm_enc = InventoryItem.objects.filter(code="ENC-OPT-1024").first()
        itm_lub = InventoryItem.objects.filter(code="LUB-SYN-VG46").first()

        if not itm_bolt or not itm_brg or not itm_hyd:
            self.stdout.write("Items missing, running seed_inventory_demo first...")
            from django.core.management import call_command
            call_command("seed_inventory_demo")
            itm_bolt = InventoryItem.objects.get(code="BELT-T10-1200")
            itm_brg = InventoryItem.objects.get(code="BRG-6205-2RS")
            itm_hyd = InventoryItem.objects.get(code="HYD-SV-24V")
            itm_enc = InventoryItem.objects.get(code="ENC-OPT-1024")
            itm_lub = InventoryItem.objects.get(code="LUB-SYN-VG46")

        # -------------------------------------------------------------
        # 1. DRAFT Receipt: GRN-2026-0001
        # -------------------------------------------------------------
        if not StockTransaction.objects.filter(document_number="GRN-2026-0001").exists():
            grn1, _ = GoodsReceiptService.save_draft({
                "document_number": "GRN-2026-0001",
                "receipt_type": "PURCHASE",
                "transaction_date": str(today),
                "supplier": "Acme Industrial Fasteners",
                "supplier_reference": "DN-ACME-4091",
                "purchase_order_reference": "PO-2026-0850",
                "warehouse": wh.id,
                "receiving_location": loc_rec.id,
                "expected_date": str(today + timedelta(days=2)),
                "received_by": "Marcus Vance",
                "remarks": "Express shipment of replacement timing belts. Inspected outer boxes upon carrier unloading.",
                "inspection_required": False,
                "lines": [
                    {
                        "item": itm_bolt.id,
                        "received_quantity": "50.0000",
                        "expected_quantity": "50.0000",
                        "unit_cost": "32.4000",
                        "uom": "EA",
                        "description": "Polyurethane Timing Belt T10-1200",
                    }
                ],
            }, actor="Marcus Vance", can_manual_number=True)
            self.stdout.write(f"Created DRAFT: {grn1.document_number}")

        # -------------------------------------------------------------
        # 2. SUBMITTED (Awaiting Inspection): GRN-2026-0002
        # -------------------------------------------------------------
        if not StockTransaction.objects.filter(document_number="GRN-2026-0002").exists():
            grn2, _ = GoodsReceiptService.save_draft({
                "document_number": "GRN-2026-0002",
                "receipt_type": "PURCHASE",
                "transaction_date": str(today - timedelta(days=1)),
                "supplier": "Bosch Rexroth Corp",
                "supplier_reference": "DN-REX-7721",
                "purchase_order_reference": "PO-2026-0842",
                "warehouse": wh.id,
                "receiving_location": loc_rec.id,
                "expected_date": str(today - timedelta(days=1)),
                "received_by": "Elena Rostova",
                "remarks": "Hydraulic solenoid valves received at receiving dock. Staged for technical serialization inspection.",
                "inspection_required": True,
                "lines": [
                    {
                        "item": itm_hyd.id,
                        "received_quantity": "10.0000",
                        "expected_quantity": "10.0000",
                        "unit_cost": "128.5000",
                        "uom": "EA",
                        "serial_numbers": [f"SN-HYD-900{i}" for i in range(1, 10)] + ["SN-HYD-9010"],
                        "description": "Hydraulic Solenoid Valve 24V DC",
                    }
                ],
            }, actor="Elena Rostova", can_manual_number=True)
            GoodsReceiptService.submit(grn2, actor="Elena Rostova")
            self.stdout.write(f"Created SUBMITTED (Pending Inspection): {grn2.document_number}")

        # -------------------------------------------------------------
        # 3. PARTIALLY_ACCEPTED (Inspected with Rejection): GRN-2026-0003
        # -------------------------------------------------------------
        if not StockTransaction.objects.filter(document_number="GRN-2026-0003").exists():
            grn3, _ = GoodsReceiptService.save_draft({
                "document_number": "GRN-2026-0003",
                "receipt_type": "PURCHASE",
                "transaction_date": str(today - timedelta(days=2)),
                "supplier": "SKF Precision Bearings Ltd",
                "supplier_reference": "DN-SKF-8812",
                "purchase_order_reference": "PO-2026-0799",
                "warehouse": wh.id,
                "receiving_location": loc_rec.id,
                "expected_date": str(today - timedelta(days=2)),
                "received_by": "David Kim",
                "remarks": "100 units received. 15 units rejected due to carton drop damage. 85 units approved for putaway.",
                "inspection_required": True,
                "lines": [
                    {
                        "item": itm_brg.id,
                        "received_quantity": "100.0000",
                        "expected_quantity": "100.0000",
                        "unit_cost": "14.8500",
                        "uom": "EA",
                        "batch_number": "BAT-BRG-2026-99",
                        "description": "Industrial Ball Bearing 6205-2RS",
                    }
                ],
            }, actor="David Kim", can_manual_number=True)
            GoodsReceiptService.submit(grn3, actor="David Kim")
            line3 = grn3.lines.first()

            # Record quality check FIRST while in SUBMITTED / UNDER_INSPECTION
            GoodsReceiptService.record_quality_inspection(grn3, {
                "line": line3.id,
                "inspection_type": "Visual",
                "sample_quantity": "10.0000",
                "failed_quantity": "0.0000",
                "inspector": "Chief Metallurgist",
                "quality_result": "PASS",
                "remarks": "Sample passed microscopic bearing raceway inspection.",
            }, actor="Chief Metallurgist")

            # Then record inspection: 85 accepted, 15 rejected
            GoodsReceiptService.record_inspection(grn3, {
                "line": line3.id,
                "inspection_quantity": "100.0000",
                "accepted_quantity": "85.0000",
                "rejected_quantity": "15.0000",
                "rejection_reason": "Damaged",
                "rejection_disposition": "Return to Supplier",
                "inspector": "Quality Lab Inspector #4",
                "remarks": "Carton crushed in transit. Seal broken on 15 pieces. Returned to quarantined staging.",
            }, actor="Quality Inspector")

            # Create discrepancy for supplier credit note
            ReceiptDiscrepancy.objects.get_or_create(
                discrepancy_number="DISC-2026-0001",
                defaults={
                    "receipt": grn3,
                    "line": line3,
                    "discrepancy_type": "DAMAGED",
                    "expected_quantity": Decimal("100.0000"),
                    "received_quantity": Decimal("100.0000"),
                    "difference_quantity": Decimal("15.0000"),
                    "reason": "15 units rejected due to transit container compression. Vendor RMA requested.",
                    "resolution_status": ReceiptDiscrepancy.ResolutionStatus.UNDER_REVIEW,
                    "created_by": "David Kim",
                }
            )
            self.stdout.write(f"Created PARTIALLY_ACCEPTED (Inspected): {grn3.document_number}")

        # -------------------------------------------------------------
        # 4. PUTAWAY_PENDING (Partially Put Away): GRN-2026-0004
        # -------------------------------------------------------------
        if not StockTransaction.objects.filter(document_number="GRN-2026-0004").exists():
            grn4, _ = GoodsReceiptService.save_draft({
                "document_number": "GRN-2026-0004",
                "receipt_type": "PURCHASE",
                "transaction_date": str(today - timedelta(days=3)),
                "supplier": "Mobil Rarus Lubricants",
                "supplier_reference": "DN-MOB-5501",
                "purchase_order_reference": "PO-2026-0760",
                "warehouse": wh.id,
                "receiving_location": loc_rec.id,
                "received_by": "Sarah Jenkins",
                "remarks": "Bulk synthetic compressor oil delivery. Storing drums into chemical storage bay.",
                "inspection_required": False,
                "lines": [
                    {
                        "item": itm_lub.id,
                        "received_quantity": "200.0000",
                        "expected_quantity": "200.0000",
                        "unit_cost": "18.2000",
                        "uom": "LTR",
                        "batch_number": "BAT-LUB-2026-88",
                        "description": "Synthetic Compressor Lubricant ISO VG 46",
                    }
                ],
            }, actor="Sarah Jenkins", can_manual_number=True)
            GoodsReceiptService.submit(grn4, actor="Sarah Jenkins")
            line4 = grn4.lines.first()

            # Put away 120 LTR into loc_storage (A3-RB); 80 LTR remains
            GoodsReceiptService.record_putaway(grn4, {
                "line": line4.id,
                "location": loc_storage.id,
                "quantity": "120.0000",
                "putaway_by": "Forklift Operator Mike",
                "remarks": "Placed 6x 20L drums on Pallet Rack A01 Level 1.",
            }, actor="Forklift Operator Mike")
            self.stdout.write(f"Created PUTAWAY_PENDING: {grn4.document_number}")

        # -------------------------------------------------------------
        # 5. READY_TO_POST: GRN-2026-0005
        # -------------------------------------------------------------
        if not StockTransaction.objects.filter(document_number="GRN-2026-0005").exists():
            grn5, _ = GoodsReceiptService.save_draft({
                "document_number": "GRN-2026-0005",
                "receipt_type": "PURCHASE",
                "transaction_date": str(today - timedelta(days=2)),
                "supplier": "Gates Industrial Power",
                "supplier_reference": "DN-GAT-9011",
                "purchase_order_reference": "PO-2026-0810",
                "warehouse": wh.id,
                "receiving_location": loc_rec.id,
                "received_by": "Marcus Vance",
                "remarks": "Urgent belts for production assembly. Fully inspected and placed into forward picking shelf.",
                "inspection_required": True,
                "lines": [
                    {
                        "item": itm_bolt.id,
                        "received_quantity": "60.0000",
                        "expected_quantity": "60.0000",
                        "unit_cost": "32.4000",
                        "uom": "EA",
                        "description": "Polyurethane Timing Belt T10-1200",
                    }
                ],
            }, actor="Marcus Vance", can_manual_number=True)
            GoodsReceiptService.submit(grn5, actor="Marcus Vance")
            line5 = grn5.lines.first()

            # Full acceptance
            GoodsReceiptService.record_inspection(grn5, {
                "line": line5.id,
                "inspection_quantity": "60.0000",
                "accepted_quantity": "60.0000",
                "rejected_quantity": "0.0000",
                "inspector": "Lead Receiving Clerk",
                "remarks": "100% accepted, pristine condition.",
            }, actor="Lead Receiving Clerk")

            # Complete putaway to loc_picking
            GoodsReceiptService.record_putaway(grn5, {
                "line": line5.id,
                "location": loc_picking.id,
                "quantity": "60.0000",
                "putaway_by": "Marcus Vance",
                "remarks": "Placed in forward picking bin A1-B4.",
            }, actor="Marcus Vance")
            self.stdout.write(f"Created READY_TO_POST: {grn5.document_number}")

        # -------------------------------------------------------------
        # 6. POSTED (In History & Stock Ledger): GRN-2026-0006
        # -------------------------------------------------------------
        if not StockTransaction.objects.filter(document_number="GRN-2026-0006").exists():
            grn6, _ = GoodsReceiptService.save_draft({
                "document_number": "GRN-2026-0006",
                "receipt_type": "PURCHASE",
                "transaction_date": str(today - timedelta(days=5)),
                "supplier": "Omron Automation Global",
                "supplier_reference": "DN-OMR-3320",
                "purchase_order_reference": "PO-2026-0705",
                "warehouse": wh.id,
                "receiving_location": loc_rec.id,
                "received_by": "Elena Rostova",
                "remarks": "High-precision rotary encoders. Posted to active stock ledger.",
                "inspection_required": False,
                "lines": [
                    {
                        "item": itm_enc.id,
                        "received_quantity": "5.0000",
                        "expected_quantity": "5.0000",
                        "unit_cost": "95.0000",
                        "uom": "EA",
                        "serial_numbers": [f"SN-ENC-700{i}" for i in range(1, 6)],
                        "description": "Optical Rotary Encoder 1024 PPR",
                    }
                ],
            }, actor="Elena Rostova", can_manual_number=True)
            GoodsReceiptService.submit(grn6, actor="Elena Rostova")
            line6 = grn6.lines.first()

            # Complete putaway to loc_picking
            GoodsReceiptService.record_putaway(grn6, {
                "line": line6.id,
                "location": loc_picking.id,
                "quantity": "5.0000",
                "putaway_by": "Elena Rostova",
            }, actor="Elena Rostova")

            # Post to live inventory ledger
            GoodsReceiptService.post(grn6, actor="Elena Rostova")
            self.stdout.write(f"Created POSTED (In History & Ledger): {grn6.document_number}")

        self.stdout.write(self.style.SUCCESS("Successfully seeded comprehensive Goods Receipt & Inspection demo data!"))
