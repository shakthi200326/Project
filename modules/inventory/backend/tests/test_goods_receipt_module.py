"""
Goods Receipt & Inspection – database-backed workflow tests (PostgreSQL).

Covers draft -> submit -> inspection -> quality -> putaway -> post -> reversal,
stock/ledger/valuation effects, idempotent posting, validation rules and
configuration/permission enforcement.
"""
import threading
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.db import connection
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.categories.models import InventoryCategory
from apps.configuration.models import InventoryConfiguration
from apps.goods_receipt.models import GoodsReceiptSettingVersion, ReceiptDiscrepancy, ReceiptInspection
from apps.integration.models import OutboxEvent
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.products.models import InventoryItem, InventoryItemVariant, ProductUnitConversion
from apps.serial_numbers.models import SerialNumber
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.units.models import UnitOfMeasure
from apps.valuation.models import InventoryValuation
from apps.warehouses.models import StorageLocation, Warehouse
from services.goods_receipt_config import GoodsReceiptConfigService
from services.goods_receipt_service import GoodsReceiptService
from services.posting_service import InventoryPostingService

BASE = "/api/v1/inventory/goods-receipt"
D = Decimal


def build_fixtures(test):
    test.cat = InventoryCategory.objects.create(name="GRN Components", code="GRNC")
    test.ea = UnitOfMeasure.objects.create(code="EA", name="Each", is_base=True)
    test.box = UnitOfMeasure.objects.create(code="BOX", name="Box", is_base=False)
    test.wh = Warehouse.objects.create(code="WH-GRN", name="GRN Warehouse")
    test.wh_other = Warehouse.objects.create(code="WH-OTH", name="Other Warehouse")
    test.dock = StorageLocation.objects.create(
        code="DOCK-1", name="Receiving Dock", warehouse=test.wh,
        location_type=StorageLocation.LocationType.RECEIVING, allow_receiving=True,
    )
    test.bin_a = StorageLocation.objects.create(code="BIN-A", name="Bin A", warehouse=test.wh)
    test.bin_b = StorageLocation.objects.create(code="BIN-B", name="Bin B", warehouse=test.wh)
    test.bin_other = StorageLocation.objects.create(code="BIN-X", name="Other Bin", warehouse=test.wh_other)
    test.std = InventoryItem.objects.create(code="STD-1", name="Hex Bolt", category=test.cat, base_unit="EA", base_uom=test.ea)
    test.batch_item = InventoryItem.objects.create(
        code="BAT-1", name="Resin", category=test.cat, base_unit="EA", base_uom=test.ea,
        tracking=InventoryItem.Tracking.BATCH, expiry_tracking_required=True,
    )
    test.serial_item = InventoryItem.objects.create(
        code="SER-1", name="Sensor", category=test.cat, base_unit="EA", base_uom=test.ea,
        tracking=InventoryItem.Tracking.SERIAL,
    )
    test.var_item = InventoryItem.objects.create(
        code="VAR-1", name="T-Shirt", category=test.cat, base_unit="EA", base_uom=test.ea, has_variants=True,
    )
    test.variant = InventoryItemVariant.objects.create(item=test.var_item, sku="VAR-1-RED", variant_name="Red")
    test.foreign_variant = InventoryItemVariant.objects.create(item=test.std, sku="STD-1-ALT", variant_name="Alt")
    ProductUnitConversion.objects.create(item=test.std, from_uom=test.box, to_uom=test.ea, conversion_factor=D("10"))


class GoodsReceiptApiBase(APITestCase):
    def setUp(self):
        build_fixtures(self)

    # ---- helpers
    def configure(self, submodule, **settings):
        GoodsReceiptConfigService.save(submodule, settings, actor="test")

    def header(self, **extra):
        data = {
            "receipt_type": "PURCHASE",
            "transaction_date": str(timezone.localdate()),
            "warehouse": self.wh.id,
            "receiving_location": self.dock.id,
            "supplier": "Acme Supplies",
            "external_reference": "DN-77",
        }
        data.update(extra)
        return data

    def line(self, item=None, qty="100", **extra):
        data = {"item": (item or self.std).id, "received_quantity": qty, "unit_cost": "5.00"}
        data.update(extra)
        return data

    def create(self, lines=None, expect=status.HTTP_201_CREATED, headers=None, **header):
        payload = self.header(**header)
        payload["lines"] = lines if lines is not None else [self.line()]
        res = self.client.post(f"{BASE}/receipts/", payload, format="json", headers=headers or {})
        self.assertEqual(res.status_code, expect, res.data)
        return res.data

    def act(self, receipt_id, action, expect=status.HTTP_200_OK, **data):
        res = self.client.post(f"{BASE}/receipts/{receipt_id}/{action}/", data, format="json")
        self.assertEqual(res.status_code, expect, res.data)
        return res.data

    def inspect(self, receipt, line_id, accepted, rejected="0", expect=status.HTTP_201_CREATED, **extra):
        payload = {"receipt": receipt["id"], "line": line_id, "accepted_quantity": accepted, "rejected_quantity": rejected}
        payload.update(extra)
        res = self.client.post(f"{BASE}/inspections/", payload, format="json")
        self.assertEqual(res.status_code, expect, res.data)
        return res.data

    def putaway(self, receipt, line_id, location, qty, expect=status.HTTP_201_CREATED):
        res = self.client.post(
            f"{BASE}/putaways/", {"receipt": receipt["id"], "line": line_id, "location": location.id, "quantity": qty},
            format="json",
        )
        self.assertEqual(res.status_code, expect, res.data)
        return res.data

    def get(self, receipt_id):
        return self.client.get(f"{BASE}/receipts/{receipt_id}/").data

    def on_hand(self, item, location):
        bal = StockBalance.objects.filter(item=item, warehouse=self.wh, location=location).first()
        return bal.on_hand_qty if bal else D("0")

    def receipt_ledger(self, number):
        return StockLedgerEntry.objects.filter(transaction_ref=number, movement_type=StockLedgerEntry.MovementType.RECEIPT)


class DraftAndSubmitTests(GoodsReceiptApiBase):
    def test_inspection_required_rejects_non_boolean_values(self):
        response = self.client.post(
            f"{BASE}/receipts/",
            self.header(lines=[self.line()], inspection_required="false"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inspection_required", response.data["errors"])

    def test_product_tracking_choices_enable_receipt_batch_and_serial_rules(self):
        batch_serial_item = InventoryItem.objects.create(
            code="BATCH-SERIAL",
            name="Batch and serial tracked item",
            category=self.cat,
            base_unit="EA",
            base_uom=self.ea,
            tracking=InventoryItem.Tracking.BATCH_SERIAL,
        )
        lot_item = InventoryItem.objects.create(
            code="LOT-TRACKED",
            name="Lot tracked item",
            category=self.cat,
            base_unit="EA",
            base_uom=self.ea,
            tracking=InventoryItem.Tracking.LOT,
        )

        self.assertTrue(batch_serial_item.batch_tracking_required)
        self.assertTrue(batch_serial_item.serial_tracking_required)
        self.assertTrue(lot_item.batch_tracking_required)

        global_config = mock.Mock(
            enable_batch_tracking=True,
            enable_serial_tracking=True,
            enable_expiry_tracking=True,
        )
        receipt_settings = {
            "enforce_batch_tracking": True,
            "enforce_serial_tracking": True,
            "enforce_expiry_tracking": True,
        }
        with mock.patch.object(
            InventoryConfiguration, "get_solo", return_value=global_config
        ), mock.patch.object(
            GoodsReceiptConfigService, "get", return_value=receipt_settings
        ):
            self.assertEqual(
                GoodsReceiptService.tracking_flags(batch_serial_item),
                {"batch": True, "serial": True, "expiry": False},
            )
            self.assertEqual(
                GoodsReceiptService.tracking_flags(lot_item),
                {"batch": True, "serial": False, "expiry": False},
            )

    def test_01_02_draft_persists_all_fields_and_does_not_touch_stock(self):
        rec = self.create(lines=[
            self.line(qty="2", uom="BOX", expected_quantity="2", description="Bolts by the box"),
            self.line(self.batch_item, qty="40", batch_number="LOT-1",
                      manufacturing_date=str(timezone.localdate() - timedelta(days=10)),
                      expiry_date=str(timezone.localdate() + timedelta(days=200))),
            self.line(self.var_item, qty="5", variant=self.variant.id),
        ], purchase_order_reference="", supplier_reference="SUP-REF-9", remarks="Dock 1")
        self.assertEqual(rec["status"], "DRAFT")
        self.assertTrue(rec["document_number"].startswith("GRN-"))
        tx = StockTransaction.objects.get(pk=rec["id"])
        self.assertEqual((tx.supplier_reference, tx.reference_number, tx.notes), ("SUP-REF-9", "DN-77", "Dock 1"))
        self.assertEqual(tx.receiving_location_id, self.dock.id)
        self.assertEqual(tx.received_by, "anonymous")
        box_line = tx.lines.get(item=self.std)
        self.assertEqual((box_line.transaction_uom, box_line.conversion_factor_at_txn, box_line.quantity_base_uom),
                         ("BOX", D("10.000000"), D("20.0000")))
        self.assertEqual(box_line.location_id, self.dock.id)
        batch_line = tx.lines.get(item=self.batch_item)
        self.assertEqual(batch_line.batch_number, "LOT-1")
        self.assertIsNotNone(batch_line.expiry_date)
        self.assertEqual(tx.lines.get(item=self.var_item).variant_id, self.variant.id)
        # Draft must not affect stock
        self.assertFalse(StockBalance.objects.filter(warehouse=self.wh).exists())
        self.assertFalse(StockLedgerEntry.objects.filter(transaction_ref=rec["document_number"]).exists())

    def test_draft_edit_and_delete_rules(self):
        rec = self.create()
        res = self.client.patch(f"{BASE}/receipts/{rec['id']}/", {"lines": [self.line(qty="7")]}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["lines"][0]["received_quantity"], "7.0000")
        self.act(rec["id"], "submit")
        res = self.client.patch(f"{BASE}/receipts/{rec['id']}/", {"remarks": "x"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.client.delete(f"{BASE}/receipts/{rec['id']}/").status_code, 400)

    def test_03_submit_without_inspection_auto_accepts_but_does_not_post(self):
        rec = self.create()
        rec = self.act(rec["id"], "submit")
        self.assertEqual(rec["status"], "SUBMITTED")
        line = rec["lines"][0]
        self.assertEqual((line["accepted_quantity"], line["pending_inspection_quantity"]), ("100.0000", "0.0000"))
        self.assertFalse(StockLedgerEntry.objects.filter(transaction_ref=rec["document_number"]).exists())

    def test_submit_with_inspection_marks_lines_pending(self):
        rec = self.create(inspection_required=True)
        rec = self.act(rec["id"], "submit")
        self.assertTrue(rec["inspection_required"])
        self.assertEqual(rec["lines"][0]["pending_inspection_quantity"], "100.0000")
        self.assertEqual(rec["lines"][0]["inspection_status"], "PENDING")
        self.assertIn("inspect", rec["available_actions"])

    def test_invalid_transition_rejected(self):
        rec = self.create()
        self.act(rec["id"], "post", expect=400)  # draft cannot post
        self.act(rec["id"], "approve", expect=400)  # approval not enabled / not submitted
        self.act(rec["id"], "reverse", expect=400, reason="x")


class InspectionWorkflowTests(GoodsReceiptApiBase):
    def submitted(self, qty="100", **header):
        rec = self.create(lines=[self.line(qty=qty)], inspection_required=True, **header)
        return self.act(rec["id"], "submit")

    def test_recorded_inspection_appears_in_inspection_log(self):
        receipt = self.submitted(qty="10")
        line_id = receipt["lines"][0]["id"]
        inspection = self.inspect(receipt, line_id, "10")

        response = self.client.get(f"{BASE}/inspections/")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], inspection["id"])
        self.assertEqual(response.data["results"][0]["inspection_number"], inspection["inspection_number"])

    def test_inspection_rejects_fractional_quantities_for_discrete_uom(self):
        rec = self.submitted(qty="2")
        response = self.client.post(
            f"{BASE}/inspections/",
            {
                "receipt": rec["id"],
                "line": rec["lines"][0]["id"],
                "accepted_quantity": "1.5",
                "rejected_quantity": "0.5",
                "rejection_reason": "Damaged",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("accepted_quantity", response.data["errors"])
        self.assertEqual(
            self.get(rec["id"])["lines"][0]["pending_inspection_quantity"], "2.0000"
        )

    def test_04_05_full_acceptance_then_post(self):
        rec = self.submitted()
        line_id = rec["lines"][0]["id"]
        insp = self.inspect(rec, line_id, "100")
        self.assertTrue(insp["inspection_number"].startswith("RIN-"))
        rec = self.get(rec["id"])
        self.assertEqual(rec["status"], "ACCEPTED")
        self.assertEqual(rec["lines"][0]["inspection_status"], "PASSED")
        rec = self.act(rec["id"], "post")
        self.assertEqual(rec["status"], "POSTED")
        self.assertEqual(self.on_hand(self.std, self.dock), D("100"))

    def test_06_partial_acceptance_posts_only_accepted(self):
        rec = self.submitted()
        line_id = rec["lines"][0]["id"]
        self.inspect(rec, line_id, "80", "20", rejection_reason="Damaged")
        rec = self.get(rec["id"])
        self.assertEqual(rec["status"], "PARTIALLY_ACCEPTED")
        self.assertEqual(rec["lines"][0]["inspection_status"], "PARTIAL")
        self.act(rec["id"], "post")
        self.assertEqual(self.on_hand(self.std, self.dock), D("80"))
        self.assertEqual(sum(e.quantity_delta for e in self.receipt_ledger(rec["document_number"])), D("80"))
        rejected = self.client.get(f"{BASE}/lines/", {"outcome": "rejected"}).data["results"]
        partial = self.client.get(f"{BASE}/lines/", {"outcome": "partial"}).data["results"]
        self.assertEqual([r["rejected_quantity"] for r in rejected], ["20.0000"])
        self.assertEqual(len(partial), 1)

    def test_07_full_rejection_never_reaches_stock(self):
        rec = self.submitted()
        self.inspect(rec, rec["lines"][0]["id"], "0", "100", rejection_reason="Wrong Item")
        rec = self.get(rec["id"])
        self.assertEqual(rec["status"], "REJECTED")
        self.act(rec["id"], "post", expect=400)
        self.assertFalse(StockBalance.objects.filter(item=self.std).exists())

    def test_08_pending_inspection_blocks_post_and_putaway(self):
        rec = self.submitted()
        line_id = rec["lines"][0]["id"]
        self.inspect(rec, line_id, "50")
        rec = self.get(rec["id"])
        self.assertEqual(rec["status"], "UNDER_INSPECTION")
        self.assertEqual(rec["lines"][0]["pending_inspection_quantity"], "50.0000")
        self.act(rec["id"], "post", expect=400)
        self.putaway(rec, line_id, self.bin_a, "10", expect=400)
        self.assertFalse(StockBalance.objects.filter(item=self.std).exists())
        # inspecting more than what remains is refused
        self.inspect(rec, line_id, "51", expect=400)

    def test_rejection_reason_and_partial_acceptance_config(self):
        rec = self.submitted()
        line_id = rec["lines"][0]["id"]
        self.inspect(rec, line_id, "90", "10", expect=400)  # reason required
        self.inspect(rec, line_id, "90", "10", rejection_reason="Not a configured reason", expect=400)
        self.configure("partial", allow_partial_acceptance=False)
        self.inspect(rec, line_id, "90", "10", rejection_reason="Damaged", expect=400)
        self.inspect(rec, line_id, "100")

    def test_rejected_disposition_update(self):
        rec = self.submitted()
        insp = self.inspect(rec, rec["lines"][0]["id"], "90", "10", rejection_reason="Damaged")
        self.assertEqual(insp["rejection_disposition"], "Hold for Review")
        res = self.client.post(f"{BASE}/inspections/{insp['id']}/disposition/",
                               {"rejection_disposition": "Return to Supplier"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        res = self.client.post(f"{BASE}/inspections/{insp['id']}/disposition/",
                               {"rejection_disposition": "Burn"}, format="json")
        self.assertEqual(res.status_code, 400)


class QualityInspectionTests(GoodsReceiptApiBase):
    def setUp(self):
        super().setUp()
        self.configure("quality", quality_inspection_required=True, max_failure_rate_percent=5, criteria=[
            {"code": "VIS", "name": "Visual check", "type": "BOOLEAN", "mandatory": True},
            {"code": "DIA", "name": "Diameter mm", "type": "NUMERIC", "min": 9.9, "max": 10.1, "mandatory": True},
            {"code": "NOTE", "name": "Packaging note", "type": "TEXT", "mandatory": False},
        ])

    def qi(self, rec, line_id, sample, failed, criteria, expect=status.HTTP_201_CREATED):
        res = self.client.post(f"{BASE}/quality-inspections/", {
            "receipt": rec["id"], "line": line_id, "inspection_type": "Dimensional",
            "sample_quantity": sample, "passed_quantity": str(D(sample) - D(failed)), "failed_quantity": failed,
            "criteria_results": criteria,
        }, format="json")
        self.assertEqual(res.status_code, expect, res.data)
        return res.data

    def test_09_quality_fail_blocks_acceptance_pass_allows(self):
        rec = self.create()  # quality required forces inspection even though not requested
        rec = self.act(rec["id"], "submit")
        self.assertTrue(rec["inspection_required"])
        line_id = rec["lines"][0]["id"]
        self.inspect(rec, line_id, "100", expect=400)  # no QI yet

        self.qi(rec, line_id, "10", "0", [{"code": "VIS", "value": True}], expect=400)  # mandatory DIA missing
        failed = self.qi(rec, line_id, "10", "0", [{"code": "VIS", "value": True}, {"code": "DIA", "value": 10.4}])
        self.assertEqual(failed["quality_result"], "FAIL")
        self.assertTrue(failed["inspection_number"].startswith("QIN-"))
        self.inspect(rec, line_id, "100", expect=400)  # FAIL -> accept refused

        passed = self.qi(rec, line_id, "10", "0", [{"code": "VIS", "value": True}, {"code": "DIA", "value": "10.0"}])
        self.assertEqual(passed["quality_result"], "PASS")
        self.inspect(rec, line_id, "100")
        self.assertEqual(self.get(rec["id"])["status"], "ACCEPTED")

    def test_failure_rate_and_conditional_results(self):
        rec = self.act(self.create()["id"], "submit")
        line_id = rec["lines"][0]["id"]
        ok = [{"code": "VIS", "value": True}, {"code": "DIA", "value": 10}]
        self.assertEqual(self.qi(rec, line_id, "20", "2", ok)["quality_result"], "FAIL")  # 10% > 5%
        self.assertEqual(self.qi(rec, line_id, "100", "1", ok)["quality_result"], "CONDITIONAL")
        self.assertEqual(self.qi(rec, line_id, "10", "0", ok + [{"code": "NOTE", "value": ""}])["quality_result"], "PASS")
        self.qi(rec, line_id, "10", "0", ok + [{"code": "BOGUS", "value": 1}], expect=400)
        self.qi(
            rec,
            line_id,
            "10",
            "0",
            [{"code": "VIS", "value": True}, {"code": "DIA", "value": "Infinity"}],
            expect=400,
        )


class PutawayAndPostingTests(GoodsReceiptApiBase):
    def accepted(self, qty="80"):
        rec = self.create(lines=[self.line(qty=qty)], inspection_required=True)
        rec = self.act(rec["id"], "submit")
        self.inspect(rec, rec["lines"][0]["id"], qty)
        return self.get(rec["id"])

    def test_10_partial_putaway_and_mandatory_policy(self):
        self.configure("putaway", putaway_mandatory=True)
        rec = self.accepted()
        line_id = rec["lines"][0]["id"]
        put = self.putaway(rec, line_id, self.bin_a, "30")
        self.assertTrue(put["putaway_number"].startswith("PUT-"))
        rec = self.get(rec["id"])
        self.assertEqual(rec["status"], "PUTAWAY_PENDING")
        self.assertEqual(rec["lines"][0]["pending_putaway_quantity"], "50.0000")
        self.assertEqual(rec["lines"][0]["putaway_status"], "PARTIAL")
        self.act(rec["id"], "post", expect=400)
        self.putaway(rec, line_id, self.bin_a, "51", expect=400)  # exceeds remaining eligible

    def test_putaway_rejects_fractional_quantity_for_discrete_uom(self):
        rec = self.accepted(qty="2")
        line_id = rec["lines"][0]["id"]
        self.putaway(rec, line_id, self.bin_a, "0.5", expect=400)
        self.putaway(rec, line_id, self.bin_a, "1")

    def test_11_to_15_multi_location_putaway_post_ledger_balance_valuation(self):
        rec = self.accepted()
        line_id = rec["lines"][0]["id"]
        self.putaway(rec, line_id, self.bin_a, "30")
        self.putaway(rec, line_id, self.bin_b, "50")
        rec = self.get(rec["id"])
        self.assertEqual(rec["status"], "READY_TO_POST")
        rec = self.act(rec["id"], "post")
        self.assertEqual(rec["status"], "POSTED")
        self.assertEqual(rec["posted_by"], "anonymous")
        self.assertIsNotNone(rec["posted_at"])
        # Automatic stock-in ledger per putaway location
        entries = {e.location_id: e for e in self.receipt_ledger(rec["document_number"])}
        self.assertEqual(set(entries), {self.bin_a.id, self.bin_b.id})
        self.assertEqual(entries[self.bin_a.id].quantity_delta, D("30"))
        self.assertEqual(entries[self.bin_b.id].balance_after, D("50"))
        self.assertEqual(entries[self.bin_b.id].total_value_delta, D("250"))
        self.assertEqual((self.on_hand(self.std, self.bin_a), self.on_hand(self.std, self.bin_b)), (D("30"), D("50")))
        self.assertEqual(self.on_hand(self.std, self.dock), D("0"))
        val = InventoryValuation.objects.get(item=self.std, warehouse=self.wh)
        self.assertEqual((val.total_on_hand, val.weighted_average_cost), (D("80"), D("5")))

    def test_putaway_location_must_belong_to_warehouse_and_single_location_rule(self):
        rec = self.accepted()
        line_id = rec["lines"][0]["id"]
        self.putaway(rec, line_id, self.bin_other, "10", expect=400)
        self.configure("putaway", allow_multiple_locations=False)
        self.putaway(rec, line_id, self.bin_a, "10")
        self.putaway(rec, line_id, self.bin_b, "10", expect=400)

    def test_optional_putaway_posts_remainder_to_receiving_location(self):
        rec = self.accepted()
        self.putaway(rec, rec["lines"][0]["id"], self.bin_a, "30")
        self.act(rec["id"], "post")
        self.assertEqual((self.on_hand(self.std, self.bin_a), self.on_hand(self.std, self.dock)), (D("30"), D("50")))

    def test_cancel_putaway_restores_eligibility(self):
        rec = self.accepted()
        put = self.putaway(rec, rec["lines"][0]["id"], self.bin_a, "80")
        self.assertEqual(self.get(rec["id"])["status"], "READY_TO_POST")
        res = self.client.post(f"{BASE}/putaways/{put['id']}/cancel/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(self.get(rec["id"])["status"], "ACCEPTED")

    def test_uom_conversion_posts_base_quantity(self):
        rec = self.create(lines=[self.line(qty="3", uom="BOX", unit_cost="50")])
        self.act(rec["id"], "submit")
        self.act(rec["id"], "post")
        self.assertEqual(self.on_hand(self.std, self.dock), D("30"))
        entry = self.receipt_ledger(rec["document_number"]).get()
        self.assertEqual((entry.unit_cost, entry.transaction_uom, entry.conversion_factor_at_txn), (D("5"), "BOX", D("10")))

    def test_16_repeat_post_is_rejected_without_duplicate_stock(self):
        rec = self.accepted()
        self.act(rec["id"], "post")
        res = self.client.post(f"{BASE}/receipts/{rec['id']}/post/")
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(res.data["already_posted"])
        legacy = self.client.post(f"/api/v1/inventory/movements/{rec['id']}/post/")
        self.assertEqual(legacy.status_code, status.HTTP_409_CONFLICT)
        with self.assertRaises(Exception):
            InventoryPostingService.post_transaction(StockTransaction.objects.get(pk=rec["id"]))
        self.assertEqual(self.receipt_ledger(rec["document_number"]).count(), 1)
        self.assertEqual(self.on_hand(self.std, self.dock), D("80"))

    def test_posted_receipt_is_immutable_and_reversal_compensates(self):
        rec = self.accepted()
        self.act(rec["id"], "post")
        self.assertEqual(self.client.patch(f"/api/v1/inventory/movements/{rec['id']}/", {"notes": "x"}, format="json").status_code, 400)
        self.assertEqual(self.client.delete(f"/api/v1/inventory/movements/{rec['id']}/").status_code, 400)
        self.assertEqual(self.client.delete(f"{BASE}/receipts/{rec['id']}/").status_code, 400)
        self.act(rec["id"], "reverse", expect=400)  # reason required
        rec = self.act(rec["id"], "reverse", reason="Supplier recalled lot")
        self.assertEqual(rec["status"], "REVERSED")
        self.assertEqual(rec["reversal_document"], f"{rec['document_number']}-REV")
        self.assertEqual(self.on_hand(self.std, self.dock), D("0"))
        self.assertEqual(self.receipt_ledger(rec["document_number"]).count(), 1)  # original ledger untouched
        self.assertTrue(StockLedgerEntry.objects.filter(
            transaction_ref=rec["reversal_document"], movement_type="REVERSAL", quantity_delta=D("-80")).exists())
        self.act(rec["id"], "reverse", expect=400, reason="again")

    def test_legacy_movement_flow_still_posts(self):
        tx = StockTransaction.objects.create(
            document_number="LEG-1", transaction_type="RECEIPT", status="DRAFT", warehouse=self.wh)
        StockTransactionLine.objects.create(transaction=tx, item=self.std, quantity=D("12"), unit_cost=D("2"), location=self.dock)
        self.assertEqual(self.client.post(f"/api/v1/inventory/movements/{tx.id}/post/").status_code, 400)  # draft
        self.assertEqual(self.client.post(f"/api/v1/inventory/movements/{tx.id}/inspect/").status_code, 400)
        self.assertEqual(self.client.post(f"/api/v1/inventory/movements/{tx.id}/submit/").status_code, 200)
        self.assertEqual(self.client.post(f"/api/v1/inventory/movements/{tx.id}/post/").status_code, 200)
        self.assertEqual(self.on_hand(self.std, self.dock), D("12"))


class ValidationTests(GoodsReceiptApiBase):
    def test_17_serial_validation(self):
        good = [f"SN-{i}" for i in range(3)]
        rec = self.create(lines=[self.line(self.serial_item, qty="3", serial_numbers=good)])
        self.create(lines=[self.line(self.serial_item, qty="3", serial_numbers=["A", "B"])], expect=400)  # count
        self.create(lines=[self.line(self.serial_item, qty="2", serial_numbers=["A", "A"])], expect=400)  # dup in receipt
        self.create(lines=[self.line(self.serial_item, qty="1.5", serial_numbers=["A"])], expect=400)  # fractional
        clash = self.create(lines=[self.line(self.serial_item, qty="1", serial_numbers=["SN-1"])], expect=400)
        self.assertIn(rec["document_number"], clash["error"])  # already on another open receipt
        SerialNumber.objects.create(serial_number="SN-REG", item=self.serial_item, warehouse=self.wh)
        self.create(lines=[self.line(self.serial_item, qty="1", serial_numbers=["SN-REG"])], expect=400)
        self.create(lines=[self.line(qty="1", serial_numbers=["Z"])], expect=400)  # not serial-tracked

        # posting registers only accepted serials
        rec2 = self.create(lines=[self.line(self.serial_item, qty="2", serial_numbers=["S-OK", "S-BAD"])], inspection_required=True)
        rec2 = self.act(rec2["id"], "submit")
        line_id = rec2["lines"][0]["id"]
        self.inspect(rec2, line_id, "1", "1", rejection_reason="Damaged", expect=400)  # must name rejected serial
        self.inspect(rec2, line_id, "1", "1", rejection_reason="Damaged", rejected_serial_numbers=["S-BAD"])
        self.act(rec2["id"], "post")
        self.assertTrue(SerialNumber.objects.filter(serial_number="S-OK", status="Available", location=self.dock).exists())
        self.assertFalse(SerialNumber.objects.filter(serial_number="S-BAD").exists())

    def test_18_invalid_warehouse_and_location(self):
        res = self.create(receiving_location=self.bin_other.id, expect=400)
        self.assertIn("receiving_location", res["errors"])
        res = self.create(lines=[self.line(location=self.bin_other.id)], expect=400)
        self.assertIn("lines[0].location", res["errors"])
        self.wh_other.status = "Inactive"
        self.wh_other.save()
        self.create(warehouse=self.wh_other.id, receiving_location=None, expect=400)
        self.create(warehouse=None, expect=400)
        self.create(receiving_location=None, expect=400)  # location tracking required

    def test_item_variant_uom_batch_expiry_rules(self):
        self.std.is_active = False
        self.std.save()
        self.create(expect=400)
        self.std.is_active, self.std.status = True, "ACTIVE"
        self.std.save()
        self.create(lines=[self.line(self.var_item)], expect=400)  # variant required
        self.create(lines=[self.line(self.var_item, variant=self.foreign_variant.id)], expect=400)
        self.create(lines=[self.line(uom="KG")], expect=400)
        self.create(lines=[self.line(qty="0")], expect=400)
        self.create(lines=[self.line(qty="-5")], expect=400)
        future = str(timezone.localdate() + timedelta(days=100))
        self.create(lines=[self.line(self.batch_item, expiry_date=future)], expect=400)  # batch missing
        self.create(lines=[self.line(self.batch_item, batch_number="L1")], expect=400)  # expiry missing
        self.create(lines=[self.line(self.batch_item, batch_number="L1",
                                     expiry_date=str(timezone.localdate() - timedelta(days=1)))], expect=400)
        self.create(lines=[self.line(self.batch_item, batch_number="L1", expiry_date=future,
                                     manufacturing_date=str(timezone.localdate() + timedelta(days=1)))], expect=400)
        self.create(transaction_date=str(timezone.localdate() + timedelta(days=1)), expect=400)
        self.create(lines=[self.line(), self.line()], expect=400)  # duplicate line
        self.create(receipt_type="NOPE", expect=400)

    def test_19_over_receipt_policy(self):
        self.configure("create", over_receipt_tolerance_percent=10)
        self.create(lines=[self.line(qty="115", expected_quantity="100")], expect=400)
        self.create(lines=[self.line(qty="110", expected_quantity="100")])
        self.configure("create", over_receipt_policy="WARN")
        res = self.create(lines=[self.line(qty="150", expected_quantity="100")])
        self.assertEqual(len(res["warnings"]), 1)
        self.configure("create", over_receipt_policy="ALLOW")
        self.assertNotIn("warnings", self.create(lines=[self.line(qty="500", expected_quantity="100")]))
        # Expected quantity is required once a PO is referenced
        self.create(purchase_order_reference="PO-1", expect=400)
        self.create(purchase_order_reference="PO-1", lines=[self.line(expected_quantity="100")])

    def test_shortage_creates_discrepancy_and_resolution_flow(self):
        rec = self.create(lines=[self.line(qty="90", expected_quantity="100")])
        self.act(rec["id"], "submit")
        disc = ReceiptDiscrepancy.objects.get(receipt_id=rec["id"])
        self.assertEqual((disc.discrepancy_type, disc.difference_quantity, disc.is_system_generated), ("SHORTAGE", D("-10"), True))
        url = f"{BASE}/discrepancies/{disc.id}/"
        self.assertEqual(self.client.patch(url, {"resolution_status": "CLOSED"}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(url, {"resolution_status": "RESOLVED"}, format="json").status_code, 400)
        res = self.client.patch(url, {"resolution_status": "RESOLVED", "resolution_notes": "Credit note"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["resolved_by"], "anonymous")
        manual = self.client.post(f"{BASE}/discrepancies/", {
            "receipt": rec["id"], "line": rec["lines"][0]["id"] if "lines" in rec else None,
            "discrepancy_type": "DAMAGED", "reason": "Crushed carton",
        }, format="json")
        self.assertEqual(manual.status_code, 201, manual.data)
        self.assertTrue(manual.data["discrepancy_number"].startswith("RDN-"))


class ConfigurationAndPermissionTests(GoodsReceiptApiBase):
    def test_receipt_create_cors_allows_idempotency_header(self):
        response = self.client.options(
            f"{BASE}/receipts/",
            HTTP_ORIGIN="http://localhost:5173",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type,idempotency-key",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        allowed_headers = response["Access-Control-Allow-Headers"].lower().split(", ")
        self.assertIn("idempotency-key", allowed_headers)

    def test_20_submodule_disable_and_permission_enforcement(self):
        rec = self.act(self.create(inspection_required=True)["id"], "submit")
        self.configure("inspection", enabled=False)
        self.inspect(rec, rec["lines"][0]["id"], "100", expect=403)
        self.assertEqual(self.client.get(f"{BASE}/inspections/").status_code, 403)
        self.configure("inspection", enabled=True)
        self.configure("accepted", required_permission="inventory.grn.restricted_view")
        self.assertEqual(self.client.get(f"{BASE}/lines/", {"outcome": "accepted"}).status_code, 403)
        self.configure("create", post_permission="inventory.grn.post_supervisor")
        self.inspect(rec, rec["lines"][0]["id"], "100")
        res = self.client.post(f"{BASE}/receipts/{rec['id']}/post/")
        self.assertEqual(res.status_code, 403)
        self.assertNotIn("post", self.get(rec["id"])["available_actions"])

    def test_rejected_goods_view_has_its_own_gate(self):
        rec = self.act(self.create(inspection_required=True)["id"], "submit")
        self.inspect(rec, rec["lines"][0]["id"], "90", "10", rejection_reason="Damaged")
        self.configure("inspection", enabled=False)
        res = self.client.get(f"{BASE}/inspections/", {"rejected": "true"})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["count"], 1)
        self.configure("rejected", enabled=False)
        self.assertEqual(self.client.get(f"{BASE}/inspections/", {"rejected": "true"}).status_code, 403)

    def test_inspection_mode_and_approval_rules(self):
        self.configure("inspection", inspection_mode="MANDATORY")
        rec = self.create(inspection_required=False)
        self.assertTrue(rec["inspection_required"])
        self.configure("inspection", inspection_mode="DISABLED")
        self.assertFalse(self.create(lines=[self.line(qty="3")], inspection_required=True)["inspection_required"])

        self.configure("create", approval_required=True)
        rec = self.act(self.create(lines=[self.line(qty="4")])["id"], "submit")
        self.act(rec["id"], "post", expect=400)  # awaiting approval
        self.assertEqual(self.act(rec["id"], "approve")["status"], "APPROVED")
        self.assertEqual(self.act(rec["id"], "post")["status"], "POSTED")

    def test_manual_numbering_requires_config_and_permission(self):
        self.create(document_number="MAN-1", expect=400)
        self.configure("create", allow_manual_number=True, manual_number_permission="inventory.grn.view")
        self.assertEqual(self.create(document_number="MAN-1")["document_number"], "MAN-1")
        self.create(document_number="MAN-1", expect=400)  # unique

    def test_settings_api_validation_versions_reset_and_effective_dates(self):
        url = f"{BASE}/settings/create/"
        bad = self.client.put(url, {"settings": {"over_receipt_policy": "MAYBE", "nope": 1}}, format="json")
        self.assertEqual(bad.status_code, 400)
        self.assertIn("over_receipt_policy", bad.data["errors"])
        self.assertIn("nope", bad.data["errors"])
        malformed_date = self.client.put(
            url, {"settings": {}, "effective_from": 0}, format="json"
        )
        self.assertEqual(malformed_date.status_code, 400)
        ok = self.client.put(url, {"settings": {"over_receipt_tolerance_percent": 5}, "reason": "Tighten"}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(ok.data["settings"]["over_receipt_tolerance_percent"], 5)
        future = str(timezone.localdate() + timedelta(days=7))
        sched = self.client.put(url, {"settings": {"over_receipt_tolerance_percent": 50}, "effective_from": future}, format="json")
        self.assertEqual(sched.data["settings"]["over_receipt_tolerance_percent"], 5)  # not yet effective
        self.assertEqual(len(sched.data["scheduled_versions"]), 1)
        rescheduled = self.client.put(
            url,
            {"settings": {"max_backdate_days": 60}, "effective_from": future},
            format="json",
        )
        self.assertEqual(rescheduled.status_code, 200, rescheduled.data)
        self.assertEqual(len(rescheduled.data["scheduled_versions"]), 2)
        future_settings = GoodsReceiptConfigService.get(
            "create", on_date=timezone.localdate() + timedelta(days=8)
        )
        self.assertEqual(future_settings["over_receipt_tolerance_percent"], 50)
        self.assertEqual(future_settings["max_backdate_days"], 60)
        reset = self.client.post(f"{url}reset/")
        self.assertEqual(reset.data["settings"]["over_receipt_tolerance_percent"], 0)
        history = self.client.get(f"{url}history/").data
        self.assertEqual(len(history), 4)
        self.assertEqual(GoodsReceiptSettingVersion.objects.filter(submodule="create", is_reset=True).count(), 1)
        self.assertEqual(self.client.get(f"{BASE}/settings/unknown/").status_code, 404)

    def test_goods_receipt_settings_and_context_require_permissions(self):
        with mock.patch("api.goods_receipt_views.has_perm", return_value=False):
            self.assertEqual(self.client.get(f"{BASE}/settings/").status_code, 403)
            self.assertEqual(self.client.get(f"{BASE}/settings/create/").status_code, 403)
            self.assertEqual(self.client.get(f"{BASE}/settings/create/history/").status_code, 403)
            self.assertEqual(self.client.get(f"{BASE}/lookups/context/").status_code, 403)

    def test_quality_settings_reject_invalid_criterion_bounds(self):
        response = self.client.put(
            f"{BASE}/settings/quality/",
            {
                "settings": {
                    "criteria": [
                        {
                            "code": "TEMP",
                            "name": "Temperature",
                            "type": "NUMERIC",
                            "min": "not-a-number",
                        }
                    ]
                }
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("criteria", response.data["errors"])

    def test_notifications_follow_configuration(self):
        rec = self.create()
        self.act(rec["id"], "submit")
        self.assertFalse(OutboxEvent.objects.filter(event_type="inventory.goods_receipt.submitted").exists())
        self.configure("create", notifications={"enabled": True, "events": ["submitted"], "recipients": ["qa@example.com"]})
        rec = self.create(lines=[self.line(qty="5")])
        self.act(rec["id"], "submit")
        event = OutboxEvent.objects.get(event_type="inventory.goods_receipt.submitted")
        self.assertEqual(event.payload["recipients"], ["qa@example.com"])


class RetryAndFailureTests(GoodsReceiptApiBase):
    def test_idempotency_key_from_another_transaction_type_is_rejected(self):
        StockTransaction.objects.create(
            document_number="ISS-IDEMPOTENCY",
            transaction_type=StockTransaction.TransactionType.ISSUE,
            status=StockTransaction.Status.DRAFT,
            warehouse=self.wh,
            idempotency_key="used-by-issue",
        )

        response = self.client.post(
            f"{BASE}/receipts/",
            {**self.header(), "lines": [self.line()]},
            format="json",
            headers={"Idempotency-Key": "used-by-issue"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("idempotency_key", response.data["errors"])

    def test_21_idempotent_create_and_atomic_post_retry(self):
        key = {"Idempotency-Key": "client-req-123"}
        first = self.create(headers=key)
        second = self.client.post(f"{BASE}/receipts/", {**self.header(), "lines": [self.line()]}, format="json", headers=key)
        self.assertEqual(second.data["id"], first["id"])
        self.assertEqual(StockTransaction.objects.filter(idempotency_key="client-req-123").count(), 1)

        rec = self.act(first["id"], "submit")
        with mock.patch.object(InventoryPostingService, "_update_valuation_on_receipt", side_effect=RuntimeError("db down")):
            with self.assertRaises(RuntimeError):
                self.client.post(f"{BASE}/receipts/{rec['id']}/post/")
        tx = StockTransaction.objects.get(pk=rec["id"])
        self.assertEqual(tx.status, "SUBMITTED")  # rolled back
        self.assertFalse(StockLedgerEntry.objects.filter(transaction_ref=tx.document_number).exists())
        self.assertFalse(StockBalance.objects.filter(item=self.std).exists())
        self.assertEqual(self.act(rec["id"], "post")["status"], "POSTED")  # retry succeeds once
        self.assertEqual(self.receipt_ledger(tx.document_number).count(), 1)

    def test_register_history_filters_and_timeline(self):
        a = self.act(self.create(lines=[self.line(qty="5")])["id"], "submit")
        self.act(a["id"], "post")
        self.create(lines=[self.line(qty="6")], supplier="Other Co")
        reg = self.client.get(f"{BASE}/receipts/", {"search": "Other"}).data
        self.assertEqual(reg["count"], 1)
        self.assertEqual(reg["results"][0]["totals"]["received"], "6.0000")
        posted = self.client.get(f"{BASE}/receipts/", {"posted": "true"}).data
        self.assertEqual([r["id"] for r in posted["results"]], [a["id"]])
        hist = self.client.get(f"{BASE}/receipts/", {"view": "history"}).data
        self.assertEqual([r["status"] for r in hist["results"]], ["POSTED"])
        events = [e["event"] for e in self.client.get(f"{BASE}/receipts/{a['id']}/timeline/").data]
        self.assertEqual(events, ["Created", "Submitted", "Posted to stock"])
        page = self.client.get(f"{BASE}/receipts/", {"page_size": 1}).data
        self.assertEqual((page["count"], len(page["results"])), (2, 1))
        invalid_date = self.client.get(f"{BASE}/receipts/", {"date_from": "not-a-date"})
        self.assertEqual(invalid_date.status_code, 400)
        reversed_range = self.client.get(
            f"{BASE}/receipts/",
            {"date_from": str(timezone.localdate()), "date_to": str(timezone.localdate() - timedelta(days=1))},
        )
        self.assertEqual(reversed_range.status_code, 400)
        self.assertEqual(self.client.get(f"{BASE}/receipts/", {"warehouse": "invalid"}).status_code, 400)
        self.assertEqual(self.client.get(f"{BASE}/lines/", {"receipt": "invalid"}).status_code, 400)
        self.assertEqual(self.client.get(f"{BASE}/inspections/", {"warehouse": "invalid"}).status_code, 400)
        self.assertEqual(self.client.get(f"{BASE}/lookups/items/", {"id": "invalid"}).status_code, 400)
        self.assertEqual(self.client.get(f"{BASE}/receipts/not-an-id/").status_code, 404)


class ConcurrentPostingTests(TransactionTestCase):
    """Two simultaneous post requests must yield exactly one stock-in."""

    def setUp(self):
        build_fixtures(self)

    def test_parallel_post_creates_single_stock_in(self):
        client = APIClient()
        rec = client.post(f"{BASE}/receipts/", {
            "receipt_type": "PURCHASE", "warehouse": self.wh.id, "receiving_location": self.dock.id,
            "lines": [{"item": self.std.id, "received_quantity": "40", "unit_cost": "1"}],
        }, format="json").data
        client.post(f"{BASE}/receipts/{rec['id']}/submit/")

        codes, barrier = [], threading.Barrier(2)

        def worker():
            try:
                barrier.wait()
                codes.append(APIClient().post(f"{BASE}/receipts/{rec['id']}/post/").status_code)
            finally:
                connection.close()

        threads = [threading.Thread(target=worker) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(sorted(codes), [200, 409])
        self.assertEqual(StockLedgerEntry.objects.filter(transaction_ref=rec["document_number"]).count(), 1)
        self.assertEqual(StockBalance.objects.get(item=self.std, location=self.dock).on_hand_qty, D("40"))
