import pytest
from datetime import date, timedelta
from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation
from apps.categories.models import InventoryCategory
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


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def setup_tracking_data(db):
    cat, _ = InventoryCategory.objects.get_or_create(code="CAT-ENG", defaults={"name": "Engineering"})
    item = InventoryItem.objects.create(
        code="ITM-TRACK-01",
        name="Precision Pressure Sensor",
        category=cat,
        tracking=InventoryItem.Tracking.BATCH_SERIAL,
        batch_tracking_required=True,
        serial_tracking_required=True,
        expiry_tracking_required=True,
    )
    warehouse = Warehouse.objects.create(
        code="WH-NORTH",
        name="North Distribution Depot",
        is_active=True,
    )
    location = StorageLocation.objects.create(
        warehouse=warehouse,
        code="LOC-N1",
        name="North Aisle 1",
        is_active=True,
    )

    today = date.today()

    # Batch 1: Expiring earlier (FEFO winner)
    batch_fefo = Batch.objects.create(
        batch_number="BATCH-FEFO-01",
        tracking_type="BATCH",
        item=item,
        warehouse=warehouse,
        location=location,
        manufacturing_date=today - timedelta(days=60),
        received_date=today - timedelta(days=30),
        expiry_date=today + timedelta(days=20),
        initial_quantity=Decimal("100.0000"),
        remaining_quantity=Decimal("80.0000"),
        batch_status=Batch.Status.RELEASED,
        status=Batch.Status.HEALTHY,
    )

    # Batch 2: Received earlier (FIFO winner), expires later
    batch_fifo = Batch.objects.create(
        batch_number="BATCH-FIFO-02",
        tracking_type="BATCH",
        item=item,
        warehouse=warehouse,
        location=location,
        manufacturing_date=today - timedelta(days=120),
        received_date=today - timedelta(days=100),
        expiry_date=today + timedelta(days=200),
        initial_quantity=Decimal("100.0000"),
        remaining_quantity=Decimal("90.0000"),
        batch_status=Batch.Status.RELEASED,
        status=Batch.Status.HEALTHY,
    )

    # Serial
    serial = SerialNumber.objects.create(
        serial_number="SN-PR-10001",
        item=item,
        warehouse=warehouse,
        location=location,
        batch=batch_fifo,
        status=SerialNumber.Status.AVAILABLE,
    )

    return {
        "item": item,
        "warehouse": warehouse,
        "location": location,
        "batch_fefo": batch_fefo,
        "batch_fifo": batch_fifo,
        "serial": serial,
    }


@pytest.mark.django_db
class TestTrackingModuleComprehensive:

    def test_batch_and_lot_creation_via_api(self, api_client, setup_tracking_data):
        item = setup_tracking_data["item"]
        wh = setup_tracking_data["warehouse"]

        # Create Lot
        url = "/api/v1/inventory/batches/"
        payload = {
            "batch_number": "LOT-2026-ENG-99",
            "tracking_type": "LOT",
            "item": item.id,
            "warehouse": wh.id,
            "initial_quantity": "50.0000",
            "remaining_quantity": "50.0000",
            "batch_status": "Released",
            "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
        }
        res = api_client.post(url, payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["batch_number"] == "LOT-2026-ENG-99"
        assert res.data["tracking_type"] == "LOT"

    def test_serial_registration_and_status(self, api_client, setup_tracking_data):
        item = setup_tracking_data["item"]
        wh = setup_tracking_data["warehouse"]

        url = "/api/v1/inventory/serials/"
        payload = {
            "serial_number": "SN-NEW-9901",
            "item": item.id,
            "warehouse": wh.id,
            "status": "Available",
        }
        res = api_client.post(url, payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["serial_number"] == "SN-NEW-9901"

        # Duplicate serial should fail
        res_dup = api_client.post(url, payload, format="json")
        assert res_dup.status_code == status.HTTP_400_BAD_REQUEST

    def test_shelf_life_policy_and_calculation(self, api_client, setup_tracking_data):
        item = setup_tracking_data["item"]

        # Create policy
        url = "/api/v1/inventory/tracking/shelf-life-policies/"
        policy_payload = {
            "item": item.id,
            "shelf_life_duration": 6,
            "shelf_life_unit": "MONTHS",
            "expiry_warning_days": 25,
            "min_remaining_shelf_life_days": 30,
        }
        res = api_client.post(url, policy_payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED

        # Test calculate-expiry action
        calc_url = "/api/v1/inventory/tracking/shelf-life-policies/calculate-expiry/"
        calc_res = api_client.post(calc_url, {
            "item": item.id,
            "manufacturing_date": "2026-01-01",
        }, format="json")
        assert calc_res.status_code == status.HTTP_200_OK
        assert "expiry_date" in calc_res.data
        assert calc_res.data["warning_days"] == 25

    def test_stock_allocation_fifo_and_fefo_simulation(self, api_client, setup_tracking_data):
        item = setup_tracking_data["item"]
        wh = setup_tracking_data["warehouse"]

        url = "/api/v1/inventory/tracking/allocations/preview/"

        # 1. FEFO preview: Should pick batch_fefo first because it expires in 20 days
        res_fefo = api_client.post(url, {
            "item": item.id,
            "warehouse": wh.id,
            "quantity": 50,
            "strategy": "FEFO",
        }, format="json")
        assert res_fefo.status_code == status.HTTP_200_OK
        lines_fefo = res_fefo.data["lines"]
        assert len(lines_fefo) > 0
        assert lines_fefo[0]["batch_number"] == "BATCH-FEFO-01"

        # 2. FIFO preview: Should pick batch_fifo first because it was received 100 days ago
        res_fifo = api_client.post(url, {
            "item": item.id,
            "warehouse": wh.id,
            "quantity": 50,
            "strategy": "FIFO",
        }, format="json")
        assert res_fifo.status_code == status.HTTP_200_OK
        lines_fifo = res_fifo.data["lines"]
        assert len(lines_fifo) > 0
        assert lines_fifo[0]["batch_number"] == "BATCH-FIFO-02"

        # 3. Commit allocation
        alloc_url = "/api/v1/inventory/tracking/allocations/allocate/"
        commit_res = api_client.post(alloc_url, {
            "item": item.id,
            "warehouse": wh.id,
            "quantity": 30,
            "strategy": "FEFO",
            "transaction_ref": "ALLOC-TEST-001",
        }, format="json")
        assert commit_res.status_code == status.HTTP_201_CREATED
        assert len(commit_res.data["records"]) > 0

    def test_product_recall_lifecycle_and_quarantine(self, api_client, setup_tracking_data):
        item = setup_tracking_data["item"]
        batch = setup_tracking_data["batch_fefo"]

        # 1. Create recall
        url = "/api/v1/inventory/tracking/recalls/"
        recall_payload = {
            "recall_number": "REC-TEST-9001",
            "title": "Recall on Pressure Sensor Batch",
            "reason": "Calibration drift detected at elevated temperatures",
            "recall_type": "VOLUNTARY",
            "item": item.id,
            "batch": batch.id,
            "priority": "HIGH",
            "status": "DRAFT",
            "affected_quantity": "80.0000",
        }
        res = api_client.post(url, recall_payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        recall_id = res.data["id"]

        # 2. Initiate recall
        init_res = api_client.post(f"{url}{recall_id}/initiate/", {"actor": "QA Specialist"})
        assert init_res.status_code == status.HTTP_200_OK
        assert init_res.data["status"] == "INITIATED"

        # 3. Quarantine affected stock
        quar_res = api_client.post(f"{url}{recall_id}/quarantine-affected/", {"actor": "Warehouse Lead"})
        assert quar_res.status_code == status.HTTP_200_OK
        batch.refresh_from_db()
        assert batch.batch_status == Batch.Status.QUARANTINED

        # 4. Close recall
        close_res = api_client.post(f"{url}{recall_id}/close-recall/", {"actor": "Quality Director"})
        assert close_res.status_code == status.HTTP_200_OK
        assert close_res.data["status"] == "CLOSED"

    def test_genealogy_and_traceability_endpoints(self, api_client, setup_tracking_data):
        item = setup_tracking_data["item"]
        batch = setup_tracking_data["batch_fifo"]
        wh = setup_tracking_data["warehouse"]

        # Create ledger entry
        StockLedgerEntry.objects.create(
            transaction_ref="GRN-PO-1009",
            batch_number=batch.batch_number,
            item=item,
            warehouse=wh,
            movement_type="RECEIPT",
            quantity_delta=Decimal("100.0000"),
            balance_after=Decimal("100.0000"),
            actor="receiving_lead",
            reason="PO Inward",
        )

        # Forward traceability
        fwd_res = api_client.get(f"/api/v1/inventory/tracking/traceability/forward/?batch_number={batch.batch_number}")
        assert fwd_res.status_code == status.HTTP_200_OK
        assert fwd_res.data["identifier"] == batch.batch_number
        assert len(fwd_res.data["movements"]) > 0

        # Backward traceability
        bwd_res = api_client.get(f"/api/v1/inventory/tracking/traceability/backward/?batch_number={batch.batch_number}")
        assert bwd_res.status_code == status.HTTP_200_OK
        assert len(bwd_res.data["backward_path"]) > 0

        # Timeline
        tl_res = api_client.get(f"/api/v1/inventory/tracking/traceability/timeline/?batch_number={batch.batch_number}")
        assert tl_res.status_code == status.HTTP_200_OK
        assert len(tl_res.data["timeline"]) > 0

