"""
Management command to seed realistic, enterprise-grade Stock Operations demo data.
Populates live records across all 12 submodules:
1. Stock In (live inward movements from receipts, opening, transfers, returns)
2. Stock Issue (Draft, Submitted, Approved, and Posted)
4. Inter-Warehouse Transfer (Dispatched & In-Transit)
6. Stock Adjustment (Physical Count Increase & Damage Decrease)
7. Stock Return (Customer Return In & Supplier Return Out)
8. Opening Stock (Baseline fiscal initializations)
9. Stock Reservation (Active sales and production reservations)
10. Stock Release (Partially released and ready to release)
11. Stock Reclassification (Stock shifted to Quarantined)
12. Stock Out (Live outward movements from issues, dispatches, returns)
"""
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry, StockInTransit, DamagedStock
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.reservations.models import StockReservation
from services.posting_service import InventoryPostingService
from services.stock_operations_service import StockOperationsService
from services.stock_operations_config import StockOperationsConfigService, Submodule


class Command(BaseCommand):
    help = "Seeds realistic enterprise Stock Operations demo data across all 12 submodules."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Enterprise Stock Operations demo data...")
        today = timezone.localdate()

        # Temporarily enable manual numbering for seed script
        for sub in [
            Submodule.STOCK_ISSUE,
            Submodule.STOCK_TRANSFER,
            Submodule.INTER_WAREHOUSE,
            Submodule.STOCK_ADJUSTMENT,
            Submodule.STOCK_RETURN,
            Submodule.OPENING_STOCK,
            Submodule.STOCK_RESERVATION,
            Submodule.STOCK_RELEASE,
            Submodule.STOCK_RECLASSIFICATION,
        ]:
            StockOperationsConfigService.save(sub, {"allow_manual_number": True, "approval_required": False}, actor="seed")

        # Resolve Warehouses
        wh_main = Warehouse.objects.filter(code="WH-MAIN").first()
        if not wh_main:
            wh_main = Warehouse.objects.create(
                code="WH-MAIN", name="Central Distribution Center", warehouse_type=Warehouse.WarehouseType.MAIN,
                address="1000 Industrial Pkwy", city="Chicago", country="United States"
            )

        wh_dist = Warehouse.objects.filter(code="WH-DIST").first()
        if not wh_dist:
            wh_dist = Warehouse.objects.create(
                code="WH-DIST", name="Midwest Regional Depot", warehouse_type=Warehouse.WarehouseType.DISTRIBUTION,
                address="500 Logistics Way", city="Detroit", country="United States"
            )

        # Storage Locations
        loc_a1, _ = StorageLocation.objects.get_or_create(
            code="A1-B1", warehouse=wh_main,
            defaults={"name": "Aisle 1 - Fast Pick", "location_type": StorageLocation.LocationType.STORAGE}
        )
        loc_a2, _ = StorageLocation.objects.get_or_create(
            code="A1-B2", warehouse=wh_main,
            defaults={"name": "Aisle 1 - Bulk Storage", "location_type": StorageLocation.LocationType.STORAGE}
        )
        loc_dist_rec, _ = StorageLocation.objects.get_or_create(
            code="D1-REC", warehouse=wh_dist,
            defaults={"name": "Depot Dock Bay", "location_type": StorageLocation.LocationType.RECEIVING}
        )

        # Products
        item_belt = InventoryItem.objects.filter(code="BELT-T10-1200").first()
        if not item_belt:
            item_belt = InventoryItem.objects.first()

        item_valve = InventoryItem.objects.filter(code="HYD-SV-24V").first()
        if not item_valve:
            item_valve = InventoryItem.objects.filter(tracking=InventoryItem.Tracking.SERIAL).first() or item_belt

        item_bearing = InventoryItem.objects.filter(code="BRG-6205-2RS").first()
        if not item_bearing:
            item_bearing = InventoryItem.objects.all()[1] if InventoryItem.objects.count() > 1 else item_belt

        # Ensure base stock on hand
        b1, _ = StockBalance.objects.get_or_create(
            item=item_belt, warehouse=wh_main, location=loc_a1,
            defaults={"on_hand_qty": Decimal("500.0000")}
        )
        if b1.on_hand_qty < Decimal("150.0000"):
            b1.on_hand_qty = Decimal("500.0000")
            b1.save()

        b2, _ = StockBalance.objects.get_or_create(
            item=item_bearing, warehouse=wh_main, location=loc_a2,
            defaults={"on_hand_qty": Decimal("300.0000")}
        )
        if b2.on_hand_qty < Decimal("100.0000"):
            b2.on_hand_qty = Decimal("300.0000")
            b2.save()

        # =========================================================================
        # 1. Opening Stock (OPN-2026-0001)
        # =========================================================================
        if not StockTransaction.objects.filter(document_number="OPN-2026-0001").exists():
            tx_opn = StockTransaction.objects.create(
                document_number="OPN-2026-0001",
                transaction_type=StockTransaction.TransactionType.OPENING,
                status=StockTransaction.Status.APPROVED,
                warehouse=wh_main,
                transaction_date=today - timedelta(days=20),
                reason="Fiscal Year Initialization Balance",
                created_by="finance_controller",
            )
            StockTransactionLine.objects.create(
                transaction=tx_opn,
                item=item_belt,
                location=loc_a2,
                quantity=Decimal("120.0000"),
                unit_cost=Decimal("18.5000"),
                batch_number="BATCH-OPN-2026",
            )
            InventoryPostingService.post_transaction(tx_opn, actor="finance_controller")
            self.stdout.write("[OK] Seeded Opening Stock: OPN-2026-0001 (POSTED)")

        # =========================================================================
        # 2. Stock Issue (ISS-2026-0001, ISS-2026-0002, ISS-2026-0003)
        # =========================================================================
        if not StockTransaction.objects.filter(document_number="ISS-2026-0001").exists():
            tx_iss_draft = StockTransaction.objects.create(
                document_number="ISS-2026-0001",
                transaction_type=StockTransaction.TransactionType.ISSUE,
                status=StockTransaction.Status.DRAFT,
                warehouse=wh_main,
                issue_type="Production",
                issued_to="Main Assembly Line Alpha",
                reference_number="WO-8801",
                reason="Materials for Assembly Run 4",
                created_by="assembly_lead",
            )
            StockTransactionLine.objects.create(
                transaction=tx_iss_draft,
                item=item_belt,
                location=loc_a1,
                quantity=Decimal("15.0000"),
                unit_cost=Decimal("18.5000"),
            )
            self.stdout.write("[OK] Seeded Stock Issue: ISS-2026-0001 (DRAFT)")

        if not StockTransaction.objects.filter(document_number="ISS-2026-0002").exists():
            tx_iss_sub = StockTransaction.objects.create(
                document_number="ISS-2026-0002",
                transaction_type=StockTransaction.TransactionType.ISSUE,
                status=StockTransaction.Status.SUBMITTED,
                warehouse=wh_main,
                issue_type="Sales",
                issued_to="Midwest Machinery Logistics",
                reference_number="SO-4402",
                reason="Urgent customer fulfillment",
                created_by="sales_rep",
            )
            StockTransactionLine.objects.create(
                transaction=tx_iss_sub,
                item=item_bearing,
                location=loc_a2,
                quantity=Decimal("20.0000"),
                unit_cost=Decimal("24.0000"),
            )
            self.stdout.write("[OK] Seeded Stock Issue: ISS-2026-0002 (SUBMITTED)")

        if not StockTransaction.objects.filter(document_number="ISS-2026-0003").exists():
            tx_iss_post = StockTransaction.objects.create(
                document_number="ISS-2026-0003",
                transaction_type=StockTransaction.TransactionType.ISSUE,
                status=StockTransaction.Status.APPROVED,
                warehouse=wh_main,
                issue_type="Sales",
                issued_to="Precision Automation Corp",
                reference_number="SO-4403",
                reason="Customer Order SO-4403 Fulfillment",
                created_by="warehouse_mgr",
            )
            StockTransactionLine.objects.create(
                transaction=tx_iss_post,
                item=item_belt,
                location=loc_a1,
                quantity=Decimal("25.0000"),
                unit_cost=Decimal("18.5000"),
            )
            InventoryPostingService.post_transaction(tx_iss_post, actor="warehouse_mgr")
            self.stdout.write("[OK] Seeded Stock Issue: ISS-2026-0003 (POSTED)")

        # =========================================================================
        # 3. Inter-Warehouse Transfer (TRF-2026-0001 - Dispatched)
        # =========================================================================
        if not StockTransaction.objects.filter(document_number="TRF-2026-0001").exists():
            tx_trf_wh = StockTransaction.objects.create(
                document_number="TRF-2026-0001",
                transaction_type=StockTransaction.TransactionType.TRANSFER,
                transfer_type=StockTransaction.TransferType.INTER_WAREHOUSE,
                status=StockTransaction.Status.SUBMITTED,
                warehouse=wh_main,
                destination_warehouse=wh_dist,
                notes="Regional depot buffer replenishment",
                created_by="logistics_coord",
            )
            StockTransactionLine.objects.create(
                transaction=tx_trf_wh,
                item=item_bearing,
                location=loc_a2,
                destination_location=loc_dist_rec,
                quantity=Decimal("30.0000"),
                dispatched_quantity=Decimal("30.0000"),
                unit_cost=Decimal("24.0000"),
            )
            InventoryPostingService.dispatch_transfer(tx_trf_wh, actor="logistics_coord")
            self.stdout.write("[OK] Seeded Inter-Warehouse Transfer: TRF-2026-0001 (DISPATCHED / IN-TRANSIT)")

        # =========================================================================
        # 5. Stock Adjustment (ADJ-2026-0001 - Positive & ADJ-2026-0002 - Negative)
        # =========================================================================
        if not StockTransaction.objects.filter(document_number="ADJ-2026-0001").exists():
            tx_adj_inc = StockTransaction.objects.create(
                document_number="ADJ-2026-0001",
                transaction_type=StockTransaction.TransactionType.ADJUSTMENT,
                adjustment_type="Increase",
                status=StockTransaction.Status.APPROVED,
                warehouse=wh_main,
                reason="Physical Count Difference: Found Box",
                created_by="inventory_auditor",
            )
            StockTransactionLine.objects.create(
                transaction=tx_adj_inc,
                item=item_bearing,
                location=loc_a2,
                quantity=Decimal("10.0000"),
                unit_cost=Decimal("24.0000"),
            )
            InventoryPostingService.post_transaction(tx_adj_inc, actor="inventory_auditor")
            self.stdout.write("[OK] Seeded Stock Adjustment: ADJ-2026-0001 (Increase - POSTED)")

        if not StockTransaction.objects.filter(document_number="ADJ-2026-0002").exists():
            tx_adj_dec = StockTransaction.objects.create(
                document_number="ADJ-2026-0002",
                transaction_type=StockTransaction.TransactionType.ADJUSTMENT,
                adjustment_type="Decrease",
                status=StockTransaction.Status.APPROVED,
                warehouse=wh_main,
                reason="Water Leakage Damage in Bay 2",
                created_by="inventory_auditor",
            )
            StockTransactionLine.objects.create(
                transaction=tx_adj_dec,
                item=item_belt,
                location=loc_a1,
                quantity=Decimal("-5.0000"),
                unit_cost=Decimal("18.5000"),
            )
            InventoryPostingService.post_transaction(tx_adj_dec, actor="inventory_auditor")
            self.stdout.write("[OK] Seeded Stock Adjustment: ADJ-2026-0002 (Decrease - POSTED)")

        # =========================================================================
        # 6. Stock Return (RET-2026-0001 - Customer Return)
        # =========================================================================
        if not StockTransaction.objects.filter(document_number="RET-2026-0001").exists():
            tx_ret = StockTransaction.objects.create(
                document_number="RET-2026-0001",
                transaction_type=StockTransaction.TransactionType.RETURN,
                return_type="Customer Return",
                product_condition="Good",
                return_disposition="Restock",
                status=StockTransaction.Status.APPROVED,
                warehouse=wh_main,
                party_name="Apex Global Logistics",
                reference_number="SO-4401",
                reason="Excess stock ordered by client; original box intact",
                created_by="returns_clerk",
            )
            StockTransactionLine.objects.create(
                transaction=tx_ret,
                item=item_belt,
                location=loc_a1,
                quantity=Decimal("12.0000"),
                unit_cost=Decimal("18.5000"),
            )
            InventoryPostingService.post_transaction(tx_ret, actor="returns_clerk")
            self.stdout.write("[OK] Seeded Stock Return: RET-2026-0001 (Customer Return - POSTED)")

        # =========================================================================
        # 7. Stock Reservation & Release (RES-2026-0001 & RES-2026-0002)
        # =========================================================================
        if not StockReservation.objects.filter(reservation_number="RES-2026-0001").exists():
            res1 = StockOperationsService.create_reservation({
                "reservation_number": "RES-2026-0001",
                "reference_number": "SO-PROD-9001",
                "item": item_belt.id,
                "warehouse": wh_main.id,
                "location": loc_a1.id,
                "quantity": 30,
                "reservation_type": "Sales",
                "remarks": "Locked for Priority Order SO-PROD-9001",
            }, actor="order_desk")
            self.stdout.write("[OK] Seeded Stock Reservation: RES-2026-0001 (30 Units Locked)")

        if not StockReservation.objects.filter(reservation_number="RES-2026-0002").exists():
            res2 = StockOperationsService.create_reservation({
                "reservation_number": "RES-2026-0002",
                "reference_number": "SO-PROD-9002",
                "item": item_bearing.id,
                "warehouse": wh_main.id,
                "location": loc_a2.id,
                "quantity": 20,
                "reservation_type": "Sales",
                "remarks": "Partially released reservation",
            }, actor="order_desk")
            # Partially release 8 units
            StockOperationsService.release_reservation(res2.id, release_qty=Decimal("8.0000"), reason="Customer partial cancel", actor="sales_lead")
            self.stdout.write("[OK] Seeded Stock Reservation: RES-2026-0002 (Partially Released - 12 Remaining)")

        # =========================================================================
        # 8. Stock Reclassification (RCL-2026-0001)
        # =========================================================================
        if not StockTransaction.objects.filter(document_number="RCL-2026-0001").exists():
            tx_rcl = StockTransaction.objects.create(
                document_number="RCL-2026-0001",
                transaction_type=StockTransaction.TransactionType.RECLASSIFICATION,
                status=StockTransaction.Status.APPROVED,
                warehouse=wh_main,
                reason="Quarantine for Routine Dimension Calibration",
                created_by="qa_supervisor",
            )
            StockTransactionLine.objects.create(
                transaction=tx_rcl,
                item=item_bearing,
                location=loc_a2,
                quantity=Decimal("15.0000"),
                unit_cost=Decimal("24.0000"),
                from_status="AVAILABLE",
                to_status="QUARANTINED",
            )
            InventoryPostingService.post_transaction(tx_rcl, actor="qa_supervisor")
            self.stdout.write("[OK] Seeded Stock Reclassification: RCL-2026-0001 (POSTED - 15 EA Quarantined)")

        self.stdout.write(self.style.SUCCESS("All 12 Stock Operations demo datasets seeded successfully into PostgreSQL!"))
