"""
Stock Reclassification – database-backed tests (PostgreSQL).

Covers eligibility, UOM precision, transition rules, batch/serial selection,
location moves, approval, atomic + idempotent posting, ledger and on-hand
invariants.
"""
import threading
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.db import connection
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.batches.models import Batch
from apps.categories.models import InventoryCategory
from apps.movements.models import StockTransaction
from apps.products.models import InventoryItem
from apps.serial_numbers.models import SerialNumber
from apps.stock.models import DamagedStock, StockBalance, StockLedgerEntry
from apps.units.models import UnitOfMeasure
from apps.warehouses.models import StorageLocation, Warehouse
from services.posting_service import InventoryPostingService
from services.stock_operations_config import StockOperationsConfigService, Submodule

MOV = "/api/v1/inventory/movements/"
ELIG = "/api/v1/inventory/operations/reclassification/eligibility/"
D = Decimal


def build(test):
    cat = InventoryCategory.objects.create(name="RCL", code="RCL")
    ea = UnitOfMeasure.objects.create(code="EA", name="Each", decimal_places=0, allow_fractional_quantity=False)
    kg = UnitOfMeasure.objects.create(code="KG", name="Kilogram", dimension="WEIGHT", decimal_places=3, allow_fractional_quantity=True)
    test.wh = Warehouse.objects.create(code="WH-R", name="Reclass WH")
    test.wh2 = Warehouse.objects.create(code="WH-O", name="Other WH")
    test.loc = StorageLocation.objects.create(code="A1", name="Aisle 1", warehouse=test.wh)
    test.qloc = StorageLocation.objects.create(
        code="Q1", name="Quarantine", warehouse=test.wh, location_type=StorageLocation.LocationType.QUARANTINE
    )
    test.other_loc = StorageLocation.objects.create(code="X1", name="Elsewhere", warehouse=test.wh2)
    test.std = InventoryItem.objects.create(code="STD", name="Bolt", category=cat, base_unit="EA", base_uom=ea)
    test.bulk = InventoryItem.objects.create(code="BULK", name="Resin", category=cat, base_unit="KG", base_uom=kg)
    test.bat = InventoryItem.objects.create(
        code="BAT", name="Drug", category=cat, base_unit="EA", base_uom=ea, tracking=InventoryItem.Tracking.BATCH
    )
    test.ser = InventoryItem.objects.create(
        code="SER", name="Sensor", category=cat, base_unit="EA", base_uom=ea, tracking=InventoryItem.Tracking.SERIAL
    )
    for item, qty in ((test.std, "100"), (test.bulk, "50"), (test.bat, "40"), (test.ser, "3")):
        StockBalance.objects.create(item=item, warehouse=test.wh, location=test.loc, on_hand_qty=D(qty))
    test.lot_ok = Batch.objects.create(
        batch_number="LOT-OK", item=test.bat, warehouse=test.wh, location=test.loc, remaining_quantity=D("30"),
        initial_quantity=D("30"), expiry_date=timezone.localdate() + timedelta(days=90), batch_status=Batch.Status.RELEASED,
    )
    test.lot_old = Batch.objects.create(
        batch_number="LOT-OLD", item=test.bat, warehouse=test.wh, location=test.loc, remaining_quantity=D("10"),
        initial_quantity=D("10"), expiry_date=timezone.localdate() - timedelta(days=1), batch_status=Batch.Status.RELEASED,
    )
    for sn in ("S1", "S2", "S3"):
        SerialNumber.objects.create(serial_number=sn, item=test.ser, warehouse=test.wh, location=test.loc)
    SerialNumber.objects.filter(serial_number="S3").update(status=SerialNumber.Status.ISSUED)


class ReclassBase(APITestCase):
    def setUp(self):
        build(self)
        # Most tests exercise posting directly; approval is covered on its own.
        self.configure(approval_required=False)

    def configure(self, **kw):
        StockOperationsConfigService.save(Submodule.STOCK_RECLASSIFICATION, kw, actor="test")

    def payload(self, item=None, qty="10", frm="AVAILABLE", to="QUARANTINED", **line):
        body = {
            "transaction_type": "RECLASSIFICATION", "warehouse": self.wh.id, "reason": "QC hold",
            "transaction_date": str(timezone.localdate()), "reference_number": "QC-1",
        }
        row = {"item": (item or self.std).id, "location": self.loc.id, "quantity": qty, "from_status": frm, "to_status": to}
        row.update(line)
        body["lines"] = [row]
        return body

    def create(self, expect=201, headers=None, **kw):
        res = self.client.post(MOV, self.payload(**kw), format="json", headers=headers or {})
        self.assertEqual(res.status_code, expect, res.data)
        return res.data

    def act(self, tx_id, action, expect=200, **data):
        res = self.client.post(f"{MOV}{tx_id}/{action}/", data, format="json")
        self.assertEqual(res.status_code, expect, res.data)
        return res.data

    def run_flow(self, **kw):
        tx = self.create(**kw)
        self.act(tx["id"], "submit")
        return self.act(tx["id"], "post")

    def bal(self, item, loc=None):
        return StockBalance.objects.get(item=item, warehouse=self.wh, location=loc or self.loc)


class EligibilityTests(ReclassBase):
    def test_eligible_quantity_uom_tracking_and_targets(self):
        StockBalance.objects.filter(item=self.std).update(reserved_qty=D("15"), blocked_qty=D("5"))
        data = self.client.get(ELIG, {"item": self.std.id, "warehouse": self.wh.id, "location": self.loc.id, "from_status": "AVAILABLE"}).data
        self.assertEqual(data["eligible_quantity"], "80.0000")  # 100 - 15 reserved - 5 blocked
        self.assertEqual(data["balance"]["blocked"], "5.0000")
        self.assertEqual(data["item"]["uom"], {"code": "EA", "decimal_places": 0, "allow_fractional": False})
        self.assertEqual(data["item"]["tracking"], {"batch": False, "serial": False, "expiry": False})
        self.assertEqual(data["permitted_targets"], ["QUARANTINED", "BLOCKED", "DAMAGED"])
        kg = self.client.get(ELIG, {"item": self.bulk.id}).data
        self.assertEqual(kg["item"]["uom"]["decimal_places"], 3)
        dmg = self.client.get(ELIG, {"item": self.std.id, "from_status": "DAMAGED"}).data
        self.assertEqual(dmg["permitted_targets"], [])
        bad = self.client.get(ELIG, {"item": self.std.id, "warehouse": self.wh.id, "location": self.other_loc.id})
        self.assertEqual(bad.status_code, 400)

    def test_batch_and_serial_lists(self):
        data = self.client.get(ELIG, {"item": self.bat.id, "warehouse": self.wh.id, "location": self.loc.id}).data
        batches = {b["batch_number"]: b for b in data["batches"]}
        self.assertEqual(batches["LOT-OK"]["eligible_quantity"], "30.0000")
        self.assertTrue(batches["LOT-OLD"]["expired"])
        self.assertNotIn("AVAILABLE", batches["LOT-OLD"]["permitted_targets"])
        sers = self.client.get(ELIG, {"item": self.ser.id, "warehouse": self.wh.id, "location": self.loc.id}).data["serials"]
        self.assertEqual([s["serial_number"] for s in sers], ["S1", "S2"])  # S3 is issued (consumed)


class ValidationTests(ReclassBase):
    def test_status_quantity_and_precision_rules(self):
        self.create(frm="AVAILABLE", to="AVAILABLE", expect=400)                      # 4 same status
        self.create(qty="101", expect=400)                                           # 5 beyond eligible
        self.create(qty="1.5", expect=400)                                           # 3 EA has no decimals
        self.create(item=self.bulk, qty="1.2345", expect=400)                        # 3 KG max 3 places
        self.create(item=self.bulk, qty="1.234")
        self.create(qty="0", expect=400)
        self.create(frm="DAMAGED", to="AVAILABLE", expect=400)                       # 13 not permitted
        self.create(frm="QUARANTINED", to="AVAILABLE", expect=400)                   # nothing quarantined yet
        res = self.create(qty="5", location=self.other_loc.id, expect=400)          # source in other warehouse
        self.assertIn("lines[0].location", res["errors"])
        future = {**self.payload(), "transaction_date": str(timezone.localdate() + timedelta(days=2))}
        res = self.client.post(MOV, future, format="json")                          # 11 effective date
        self.assertEqual(res.status_code, 400)
        self.assertIn("lines[0].transaction_date", res.data["errors"])
        self.assertEqual(self.client.post(MOV, {**self.payload(), "reason": ""}, format="json").status_code, 400)

    def test_reserved_stock_cannot_be_reclassified(self):
        StockBalance.objects.filter(item=self.std).update(reserved_qty=D("95"))
        self.create(qty="6", expect=400)
        self.create(qty="5")

    def test_target_location_rules(self):
        self.create(destination_location=self.other_loc.id, expect=400)              # 7 other warehouse
        self.create(destination_location=self.loc.id, expect=400)                    # same as source
        self.configure(target_location_types={"QUARANTINED": ["Quarantine"]})
        self.create(expect=400)                                                      # 6 move required
        self.create(destination_location=self.qloc.id)
        self.configure(allow_location_change=False, target_location_types={})
        self.create(destination_location=self.qloc.id, expect=400)

    def test_batch_rules(self):
        self.create(item=self.bat, expect=400)                                       # 8 batch required
        self.create(item=self.bat, batch_number="FREE-TEXT", expect=400)             # 8 must exist
        self.create(item=self.bat, batch_number="LOT-OK", qty="31", expect=400)      # capped by batch
        self.create(item=self.bat, batch_number="LOT-OLD", qty="5", frm="AVAILABLE", to="QUARANTINED")
        Batch.objects.filter(pk=self.lot_old.pk).update(batch_status=Batch.Status.CLOSED)
        self.create(item=self.bat, batch_number="LOT-OLD", qty="1", expect=400)      # 12 closed batch
        self.create(batch_number="LOT-OK", expect=400)                               # 10 not batch-tracked

    def test_expired_batch_cannot_return_to_available(self):
        self.run_flow(item=self.bat, batch_number="LOT-OLD", qty="10")
        res = self.create(item=self.bat, batch_number="LOT-OLD", qty="10", frm="QUARANTINED", to="AVAILABLE", expect=400)
        self.assertIn("expired", res["errors"]["lines[0].to_status"])

    def test_serial_rules(self):
        self.create(item=self.ser, qty="2", serial_numbers=["S1"], expect=400)       # 9 count mismatch
        self.create(item=self.ser, qty="1", serial_numbers=["S3"], expect=400)       # 12 consumed
        self.create(item=self.ser, qty="1", serial_numbers=["NOPE"], expect=400)
        self.create(item=self.ser, qty="2", serial_numbers=["S1", "S1"], expect=400)
        self.create(serial_numbers=["S1"], expect=400)                               # 10 not serial-tracked
        self.run_flow(item=self.ser, qty="2", serial_numbers=["S1", "S2"], to="DAMAGED")
        self.assertEqual(set(SerialNumber.objects.filter(status="Damaged").values_list("serial_number", flat=True)), {"S1", "S2"})


class PostingTests(ReclassBase):
    def test_pure_reclassification_keeps_on_hand_and_writes_ledger(self):
        tx = self.run_flow(qty="10")
        self.assertEqual(tx["status"], "POSTED")
        b = self.bal(self.std)
        self.assertEqual((b.on_hand_qty, b.quarantined_qty, b.available_qty), (D("100"), D("10"), D("90")))  # 16
        entry = StockLedgerEntry.objects.get(transaction_ref=tx["document_number"])
        self.assertEqual((entry.movement_type, entry.quantity_delta, entry.from_status, entry.to_status, entry.status_quantity),
                         ("RECLASSIFICATION", D("0"), "AVAILABLE", "QUARANTINED", D("10")))  # 15
        self.assertEqual(entry.actor, "anonymous")
        # Chain: QUARANTINED -> BLOCKED -> DAMAGED, on-hand unchanged throughout
        self.run_flow(qty="10", frm="QUARANTINED", to="BLOCKED")
        self.run_flow(qty="4", frm="BLOCKED", to="DAMAGED")
        b.refresh_from_db()
        self.assertEqual((b.on_hand_qty, b.quarantined_qty, b.blocked_qty, b.damaged_qty), (D("100"), D("0"), D("6"), D("4")))
        dmg = DamagedStock.objects.get(item=self.std)
        self.assertEqual((dmg.damaged_qty, dmg.status), (D("4"), "QUARANTINED"))
        res = self.client.post(f"/api/v1/inventory/damaged-stock/{dmg.id}/quarantine/")
        self.assertEqual(res.status_code, 400)  # not double-counted into blocked
        b.refresh_from_db()
        self.assertEqual(b.blocked_qty, D("6"))

    def test_location_change_is_balanced_transfer(self):
        tx = self.run_flow(qty="25", destination_location=self.qloc.id)
        src, dst = self.bal(self.std), self.bal(self.std, self.qloc)
        self.assertEqual((src.on_hand_qty, dst.on_hand_qty, dst.quarantined_qty), (D("75"), D("25"), D("25")))  # 17
        self.assertEqual(src.on_hand_qty + dst.on_hand_qty, D("100"))
        entries = StockLedgerEntry.objects.filter(transaction_ref=tx["document_number"])
        self.assertEqual(sorted((e.movement_type, e.quantity_delta) for e in entries),
                         [("TRANSFER_IN", D("25")), ("TRANSFER_OUT", D("-25"))])
        self.assertEqual(sum(e.quantity_delta for e in entries), D("0"))

    def test_batch_whole_move_updates_batch_status(self):
        self.run_flow(item=self.bat, batch_number="LOT-OK", qty="30", destination_location=self.qloc.id)
        self.lot_ok.refresh_from_db()
        self.assertEqual((self.lot_ok.batch_status, self.lot_ok.location_id), (Batch.Status.QUARANTINED, self.qloc.id))

    def test_repeat_post_is_rejected_and_stock_unchanged(self):
        tx = self.run_flow(qty="10")
        res = self.client.post(f"{MOV}{tx['id']}/post/")
        self.assertEqual(res.status_code, 409)
        self.assertTrue(res.data["already_posted"])
        self.assertEqual(StockLedgerEntry.objects.filter(transaction_ref=tx["document_number"]).count(), 1)
        self.assertEqual(self.bal(self.std).quarantined_qty, D("10"))

    def test_atomic_rollback_on_failure_then_retry(self):
        tx = self.create(qty="10")
        self.act(tx["id"], "submit")
        with mock.patch.object(StockLedgerEntry.objects, "create", side_effect=RuntimeError("db down")):
            with self.assertRaises(RuntimeError):
                self.client.post(f"{MOV}{tx['id']}/post/")
        self.assertEqual(StockTransaction.objects.get(pk=tx["id"]).status, "SUBMITTED")
        self.assertEqual(self.bal(self.std).quarantined_qty, D("0"))
        self.assertEqual(self.act(tx["id"], "post")["status"], "POSTED")

    def test_stock_consumed_after_submit_blocks_posting(self):
        tx = self.create(qty="10")
        self.act(tx["id"], "submit")
        StockBalance.objects.filter(item=self.std).update(reserved_qty=D("95"))  # 12 reserved meanwhile
        self.act(tx["id"], "post", expect=400)
        self.assertFalse(StockLedgerEntry.objects.filter(transaction_ref=tx["document_number"]).exists())

    def test_idempotent_create_and_draft_rules(self):
        key = {"Idempotency-Key": "rcl-req-1"}
        a = self.create(headers=key)
        b = self.create(headers=key)
        self.assertEqual(a["id"], b["id"])
        self.act(a["id"], "post", expect=400)  # draft cannot post
        self.assertEqual(self.client.patch(f"{MOV}{a['id']}/", {"notes": "x"}, format="json").status_code, 400)
        self.act(a["id"], "submit")
        self.assertEqual(self.client.delete(f"{MOV}{a['id']}/").status_code, 400)


class ApprovalAndPermissionTests(ReclassBase):
    def setUp(self):
        super().setUp()
        self.configure(approval_required=True)

    def test_approval_required_before_posting(self):
        tx = self.create()
        self.act(tx["id"], "submit")
        self.act(tx["id"], "post", expect=400)
        self.assertEqual(self.act(tx["id"], "approve")["status"], "APPROVED")
        self.assertEqual(self.act(tx["id"], "post")["status"], "POSTED")

    def test_reject_and_permissions(self):
        tx = self.create()
        self.act(tx["id"], "approve", expect=400)  # must be submitted first
        self.act(tx["id"], "submit")
        self.act(tx["id"], "reject", expect=400)   # reason required
        self.assertEqual(self.act(tx["id"], "reject", reason="Wrong lot")["status"], "REJECTED")
        self.configure(approval_permission="inventory.stock_reclassification.supervisor")
        tx2 = self.create()
        self.act(tx2["id"], "submit")
        self.act(tx2["id"], "approve", expect=403)
        self.configure(required_permission="inventory.stock_reclassification.restricted")
        self.create(expect=403)
        self.configure(enabled=False)
        self.create(expect=403)


class ConcurrentReclassPostingTests(TransactionTestCase):
    def setUp(self):
        build(self)
        StockOperationsConfigService.save(Submodule.STOCK_RECLASSIFICATION, {"approval_required": False}, actor="test")

    def test_parallel_posts_create_single_movement(self):
        client = APIClient()
        tx = client.post(MOV, {
            "transaction_type": "RECLASSIFICATION", "warehouse": self.wh.id, "reason": "hold",
            "lines": [{"item": self.std.id, "location": self.loc.id, "quantity": "10", "from_status": "AVAILABLE", "to_status": "BLOCKED"}],
        }, format="json").data
        client.post(f"{MOV}{tx['id']}/submit/")
        codes, barrier = [], threading.Barrier(2)

        def worker():
            try:
                barrier.wait()
                codes.append(APIClient().post(f"{MOV}{tx['id']}/post/").status_code)
            finally:
                connection.close()

        threads = [threading.Thread(target=worker) for _ in range(2)]
        [t.start() for t in threads]
        [t.join() for t in threads]
        self.assertEqual(sorted(codes), [200, 409])
        self.assertEqual(StockBalance.objects.get(item=self.std, location=self.loc).blocked_qty, D("10"))
        self.assertEqual(StockLedgerEntry.objects.filter(transaction_ref=tx["document_number"]).count(), 1)
