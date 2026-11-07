from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.batches.models import (
    Batch,
    BatchQuarantineRecord,
    ShelfLifePolicy,
    ProductRecall,
    RecallAction,
    AllocationRecord,
)
from apps.serial_numbers.models import SerialNumber
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse
from apps.stock.models import StockLedgerEntry
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.goods_receipt.models import ReceiptInspection, ReceiptPutaway, ReceiptDiscrepancy

from .serializers import (
    BatchSerializer,
    SerialNumberSerializer,
    ShelfLifePolicySerializer,
    ProductRecallSerializer,
    RecallActionSerializer,
    AllocationRecordSerializer,
)


class ShelfLifePolicyViewSet(viewsets.ModelViewSet):
    """
    CRUD and calculation rules for Item / Variant Shelf Life Policies.
    Includes near-expiry and expired batch calculation.
    """
    queryset = ShelfLifePolicy.objects.select_related("item", "variant").all()
    serializer_class = ShelfLifePolicySerializer
    filterset_fields = ["item", "variant"]

    @action(detail=False, methods=["post"], url_path="calculate-expiry")
    def calculate_expiry(self, request):
        item_id = request.data.get("item") or request.data.get("item_id")
        variant_id = request.data.get("variant") or request.data.get("variant_id")
        mfg_date_raw = request.data.get("manufacturing_date") or request.data.get("received_date")

        if not item_id or not mfg_date_raw:
            return Response(
                {"error": "item and manufacturing_date (or received_date) are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if isinstance(mfg_date_raw, str):
                mfg_date = date.fromisoformat(mfg_date_raw[:10])
            else:
                mfg_date = mfg_date_raw
        except Exception:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        # Lookup policy
        policy = None
        if variant_id:
            policy = ShelfLifePolicy.objects.filter(item_id=item_id, variant_id=variant_id).first()
        if not policy:
            policy = ShelfLifePolicy.objects.filter(item_id=item_id, variant__isnull=True).first()

        if not policy:
            # Fallback default policy: 12 months, 30 days warning
            duration = 12
            unit = "MONTHS"
            warning_days = 30
            min_days = 0
        else:
            duration = policy.shelf_life_duration
            unit = policy.shelf_life_unit
            warning_days = policy.expiry_warning_days
            min_days = policy.min_remaining_shelf_life_days

        # Compute expiry
        if unit == "DAYS":
            expiry_date = mfg_date + timedelta(days=duration)
        elif unit == "YEARS":
            expiry_date = mfg_date + timedelta(days=duration * 365)
        else:  # MONTHS
            expiry_date = mfg_date + timedelta(days=int(duration * 30.4375))

        warning_date = expiry_date - timedelta(days=warning_days)
        is_acceptable = (expiry_date - date.today()).days >= min_days

        return Response({
            "item_id": item_id,
            "variant_id": variant_id,
            "manufacturing_date": mfg_date.isoformat(),
            "expiry_date": expiry_date.isoformat(),
            "warning_date": warning_date.isoformat(),
            "warning_days": warning_days,
            "min_remaining_shelf_life_days": min_days,
            "is_acceptable_for_receipt": is_acceptable,
            "policy_applied": {
                "duration": duration,
                "unit": unit,
                "is_custom": bool(policy),
            },
        })

    @action(detail=False, methods=["get"], url_path="near-expiry")
    def near_expiry_batches(self, request):
        days_threshold = int(request.query_params.get("days", 30))
        today = date.today()
        target_date = today + timedelta(days=days_threshold)

        batches = Batch.objects.filter(
            expiry_date__isnull=False,
            expiry_date__gte=today,
            expiry_date__lte=target_date,
            remaining_quantity__gt=Decimal("0.0000"),
        ).select_related("item", "warehouse", "location").order_by("expiry_date")

        serializer = BatchSerializer(batches, many=True)
        return Response({
            "threshold_days": days_threshold,
            "count": batches.count(),
            "results": serializer.data,
        })

    @action(detail=False, methods=["get"], url_path="expired")
    def expired_batches(self, request):
        today = date.today()
        batches = Batch.objects.filter(
            expiry_date__isnull=False,
            expiry_date__lt=today,
            remaining_quantity__gt=Decimal("0.0000"),
        ).select_related("item", "warehouse", "location").order_by("expiry_date")

        serializer = BatchSerializer(batches, many=True)
        return Response({
            "count": batches.count(),
            "results": serializer.data,
        })


class ProductRecallViewSet(viewsets.ModelViewSet):
    """
    Product Recall lifecycle management:
    DRAFT -> INITIATED -> INVESTIGATION -> IN_PROGRESS -> RESOLVED -> CLOSED
    """
    queryset = ProductRecall.objects.select_related("item", "batch").prefetch_related("actions").all()
    serializer_class = ProductRecallSerializer
    filterset_fields = ["item", "batch", "recall_type", "priority", "status"]

    def perform_create(self, serializer):
        if not serializer.validated_data.get("recall_number"):
            prefix = "REC-"
            count = ProductRecall.objects.count() + 1
            serializer.validated_data["recall_number"] = f"{prefix}{count:05d}"
        recall = serializer.save()
        RecallAction.objects.create(
            recall=recall,
            action_type="STATUS_CHANGE",
            actor=recall.initiated_by or "System",
            quantity_affected=recall.affected_quantity,
            notes=f"Recall created with status {recall.status}",
        )

    @action(detail=True, methods=["post"], url_path="initiate")
    def initiate(self, request, pk=None):
        recall = self.get_object()
        actor = request.data.get("actor") or request.user.username if hasattr(request.user, "username") else "Operator"
        recall.status = ProductRecall.Status.INITIATED
        recall.initiated_date = date.today()
        recall.initiated_by = actor
        recall.save(update_fields=["status", "initiated_date", "initiated_by", "updated_at"])

        RecallAction.objects.create(
            recall=recall,
            action_type="STATUS_CHANGE",
            actor=actor,
            quantity_affected=recall.affected_quantity,
            notes=f"Recall formally initiated by {actor}",
        )
        return Response(ProductRecallSerializer(recall).data)

    @action(detail=True, methods=["post"], url_path="quarantine-affected")
    def quarantine_affected(self, request, pk=None):
        recall = self.get_object()
        actor = request.data.get("actor") or "Operator"
        quarantined_qty = Decimal("0.0000")

        with transaction.atomic():
            if recall.batch:
                batch = recall.batch
                qty_to_quarantine = recall.affected_quantity or batch.remaining_quantity
                if qty_to_quarantine > 0:
                    quar_num = f"QUAR-REC-{recall.recall_number}-{batch.batch_number}"
                    BatchQuarantineRecord.objects.get_or_create(
                        quarantine_number=quar_num,
                        defaults={
                            "batch": batch,
                            "product": recall.item,
                            "warehouse": batch.warehouse,
                            "location": batch.location,
                            "quarantine_quantity": qty_to_quarantine,
                            "quarantine_reason": BatchQuarantineRecord.Reason.RECALL,
                            "remarks": f"Automated quarantine triggered by recall {recall.recall_number}",
                        },
                    )
                    batch.batch_status = Batch.Status.QUARANTINED
                    batch.quarantined_quantity = (batch.quarantined_quantity or Decimal("0")) + qty_to_quarantine
                    batch.save(update_fields=["batch_status", "quarantined_quantity", "updated_at"])
                    quarantined_qty = qty_to_quarantine

            # Check matching serials
            if recall.serial_number_ref:
                serials = SerialNumber.objects.filter(
                    item=recall.item,
                    serial_number=recall.serial_number_ref,
                )
                for sn in serials:
                    sn.status = SerialNumber.Status.QUARANTINED
                    sn.save(update_fields=["status", "updated_at"])
                    quarantined_qty += Decimal("1.0000")

            RecallAction.objects.create(
                recall=recall,
                action_type="QUARANTINE_APPLIED",
                actor=actor,
                quantity_affected=quarantined_qty,
                notes=f"Applied quarantine to affected batch/serial: {quarantined_qty} units",
            )

        return Response({
            "message": f"Successfully quarantined {quarantined_qty} units for recall {recall.recall_number}",
            "quarantined_quantity": str(quarantined_qty),
            "recall": ProductRecallSerializer(recall).data,
        })

    @action(detail=True, methods=["post"], url_path="record-action")
    def record_action(self, request, pk=None):
        recall = self.get_object()
        action_type = request.data.get("action_type", "STATUS_CHANGE")
        actor = request.data.get("actor") or "Operator"
        quantity = Decimal(str(request.data.get("quantity_affected", 0)))
        notes = request.data.get("notes", "")

        act = RecallAction.objects.create(
            recall=recall,
            action_type=action_type,
            actor=actor,
            quantity_affected=quantity,
            notes=notes,
        )
        return Response(RecallActionSerializer(act).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="close-recall")
    def close_recall(self, request, pk=None):
        recall = self.get_object()
        actor = request.data.get("actor") or "Supervisor"
        recall.status = ProductRecall.Status.CLOSED
        recall.closure_date = date.today()
        recall.save(update_fields=["status", "closure_date", "updated_at"])

        RecallAction.objects.create(
            recall=recall,
            action_type="STATUS_CHANGE",
            actor=actor,
            quantity_affected=recall.affected_quantity,
            notes=f"Recall closed by {actor}. Notes: {request.data.get('notes', 'Resolved')}",
        )
        return Response(ProductRecallSerializer(recall).data)


class AllocationViewSet(viewsets.ModelViewSet):
    """
    Stock Allocation engine:
    Supports FIFO (First In First Out) and FEFO (First Expired First Out).
    Provides allocation preview simulation and formal allocation records.
    """
    queryset = AllocationRecord.objects.select_related("item", "warehouse", "batch").all()
    serializer_class = AllocationRecordSerializer
    filterset_fields = ["item", "warehouse", "strategy", "batch"]

    @action(detail=False, methods=["post"], url_path="preview")
    def preview(self, request):
        item_id = request.data.get("item") or request.data.get("item_id")
        warehouse_id = request.data.get("warehouse") or request.data.get("warehouse_id")
        quantity_req = Decimal(str(request.data.get("quantity", 0)))
        strategy = request.data.get("strategy", "FIFO").upper()

        if not item_id or quantity_req <= 0:
            return Response(
                {"error": "item and quantity (> 0) are required for allocation preview."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        item = InventoryItem.objects.filter(pk=item_id).first()
        if not item:
            return Response({"error": "Item not found."}, status=status.HTTP_404_NOT_FOUND)

        # Query eligible batches with positive stock and released status
        batch_qs = Batch.objects.filter(
            item_id=item_id,
            remaining_quantity__gt=Decimal("0.0000"),
            batch_status__in=["Released", "HEALTHY"],
        )
        if warehouse_id:
            batch_qs = batch_qs.filter(warehouse_id=warehouse_id)

        if strategy == "FEFO":
            # First Expired First Out: earliest expiry date first
            batch_qs = batch_qs.order_by("expiry_date", "received_date", "id")
        else:
            # FIFO: earliest received date or created_at
            batch_qs = batch_qs.order_by("received_date", "created_at", "id")

        lines = []
        allocated_total = Decimal("0.0000")
        needed = quantity_req

        for b in batch_qs:
            if needed <= 0:
                break
            avail = b.remaining_quantity
            alloc = min(avail, needed)
            lines.append({
                "batch_id": b.id,
                "batch_number": b.batch_number,
                "warehouse_id": b.warehouse_id,
                "warehouse_name": b.warehouse.name if b.warehouse else "",
                "location_code": b.location.code if b.location else "",
                "manufacturing_date": b.manufacturing_date.isoformat() if b.manufacturing_date else None,
                "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
                "days_remaining": b.days_remaining,
                "available_quantity": str(avail),
                "allocated_quantity": str(alloc),
                "remaining_after": str(avail - alloc),
            })
            allocated_total += alloc
            needed -= alloc

        unallocated = max(Decimal("0.0000"), quantity_req - allocated_total)

        return Response({
            "item_id": item.id,
            "item_code": item.code,
            "item_name": item.name,
            "requested_quantity": str(quantity_req),
            "allocated_quantity": str(allocated_total),
            "unallocated_quantity": str(unallocated),
            "is_fully_allocated": unallocated == Decimal("0.0000"),
            "strategy": strategy,
            "batches_count": len(lines),
            "lines": lines,
        })

    @action(detail=False, methods=["post"], url_path="allocate")
    def allocate(self, request):
        item_id = request.data.get("item") or request.data.get("item_id")
        warehouse_id = request.data.get("warehouse") or request.data.get("warehouse_id")
        quantity_req = Decimal(str(request.data.get("quantity", 0)))
        strategy = request.data.get("strategy", "FIFO").upper()
        transaction_ref = request.data.get("transaction_ref") or f"ALLOC-{int(timezone.now().timestamp())}"

        if not item_id or not warehouse_id or quantity_req <= 0:
            return Response(
                {"error": "item, warehouse, and positive quantity are required to commit allocation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Run preview logic
        preview_resp = self.preview(request)
        if preview_resp.status_code != 200:
            return preview_resp

        data = preview_resp.data
        if Decimal(data["allocated_quantity"]) <= Decimal("0"):
            return Response(
                {"error": "Insufficient batch stock to allocate requested quantity."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_records = []
        with transaction.atomic():
            for line in data["lines"]:
                rec = AllocationRecord.objects.create(
                    item_id=item_id,
                    warehouse_id=warehouse_id,
                    batch_id=line["batch_id"],
                    transaction_ref=transaction_ref,
                    strategy=strategy,
                    allocated_quantity=Decimal(line["allocated_quantity"]),
                )
                created_records.append(rec)

        return Response({
            "message": f"Successfully allocated {data['allocated_quantity']} units across {len(created_records)} batches.",
            "transaction_ref": transaction_ref,
            "strategy": strategy,
            "records": AllocationRecordSerializer(created_records, many=True).data,
        }, status=status.HTTP_201_CREATED)


class TraceabilityViewSet(viewsets.ViewSet):
    """
    End-to-end forward and backward genealogy tracking & timeline for Batches and Serials.
    Traces from Supplier / GRN receipt -> Putaway -> Storage -> Movements -> Outward Dispatch.
    """

    @action(detail=False, methods=["get"], url_path="forward")
    def forward_traceability(self, request):
        batch_num = request.query_params.get("batch_number", "").strip()
        serial_num = request.query_params.get("serial_number", "").strip()

        if not batch_num and not serial_num:
            return Response(
                {"error": "Please provide either batch_number or serial_number query parameter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        identifier = batch_num or serial_num
        target_type = "BATCH" if batch_num else "SERIAL"

        # 1. Origin inspection
        origin = None
        item_data = None
        current_status = None

        if target_type == "BATCH":
            batch = Batch.objects.filter(batch_number=batch_num).select_related("item", "warehouse", "location").first()
            if batch:
                item_data = {
                    "id": batch.item.id,
                    "code": batch.item.code,
                    "name": batch.item.name,
                    "tracking": batch.item.tracking,
                }
                origin = {
                    "origin_type": "Goods Receipt / Inward",
                    "supplier": batch.supplier,
                    "goods_receipt_ref": batch.goods_receipt_ref,
                    "received_date": batch.received_date.isoformat() if batch.received_date else None,
                    "initial_quantity": str(batch.initial_quantity),
                    "remaining_quantity": str(batch.remaining_quantity),
                    "warehouse": batch.warehouse.name if batch.warehouse else "",
                    "location": batch.location.code if batch.location else "",
                }
                current_status = batch.batch_status
        else:
            sn = SerialNumber.objects.filter(serial_number=serial_num).select_related("item", "warehouse", "location", "batch").first()
            if sn:
                item_data = {
                    "id": sn.item.id,
                    "code": sn.item.code,
                    "name": sn.item.name,
                    "tracking": sn.item.tracking,
                }
                origin = {
                    "origin_type": "Serial Registration / GRN",
                    "batch_number": sn.batch.batch_number if sn.batch else "",
                    "goods_receipt_ref": sn.goods_receipt_ref,
                    "received_date": sn.received_date.isoformat() if sn.received_date else None,
                    "warehouse": sn.warehouse.name if sn.warehouse else "",
                    "location": sn.location.code if sn.location else "",
                }
                current_status = sn.status

        # 2. Forward movements from StockLedgerEntry
        ledger_q = Q(batch_number=identifier) if target_type == "BATCH" else Q(serial_number=identifier)
        ledger_entries = StockLedgerEntry.objects.filter(ledger_q).select_related(
            "item", "warehouse", "location", "destination_warehouse"
        ).order_by("created_at")

        movements = []
        for entry in ledger_entries:
            movements.append({
                "entry_id": entry.id,
                "timestamp": entry.created_at.isoformat(),
                "movement_type": entry.movement_type,
                "transaction_ref": entry.transaction_ref,
                "delta": str(entry.quantity_delta),
                "balance_after": str(entry.balance_after),
                "warehouse": entry.warehouse.name if entry.warehouse else "",
                "location": entry.location.code if entry.location else "",
                "destination_warehouse": entry.destination_warehouse.name if entry.destination_warehouse else "",
                "actor": entry.actor,
                "reason": entry.reason,
            })

        # 3. Recalls or Quarantines
        recalls = []
        if target_type == "BATCH":
            recall_qs = ProductRecall.objects.filter(batch__batch_number=batch_num)
        else:
            recall_qs = ProductRecall.objects.filter(serial_number_ref=serial_num)
        for r in recall_qs:
            recalls.append({
                "recall_number": r.recall_number,
                "title": r.title,
                "priority": r.priority,
                "status": r.status,
                "recall_type": r.recall_type,
            })

        return Response({
            "target_type": target_type,
            "identifier": identifier,
            "item": item_data,
            "current_status": current_status,
            "origin": origin,
            "forward_steps_count": len(movements),
            "movements": movements,
            "recalls": recalls,
        })

    @action(detail=False, methods=["get"], url_path="backward")
    def backward_traceability(self, request):
        batch_num = request.query_params.get("batch_number", "").strip()
        serial_num = request.query_params.get("serial_number", "").strip()

        if not batch_num and not serial_num:
            return Response(
                {"error": "Please provide either batch_number or serial_number query parameter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        identifier = batch_num or serial_num
        target_type = "BATCH" if batch_num else "SERIAL"

        # Lookup object
        batch_obj = None
        serial_obj = None
        item_obj = None

        if target_type == "BATCH":
            batch_obj = Batch.objects.filter(batch_number=batch_num).select_related("item", "warehouse", "location").first()
            if batch_obj:
                item_obj = batch_obj.item
        else:
            serial_obj = SerialNumber.objects.filter(serial_number=serial_num).select_related("item", "warehouse", "location", "batch").first()
            if serial_obj:
                item_obj = serial_obj.item
                batch_obj = serial_obj.batch

        # Trace back to GoodsReceipt
        grn_ref = None
        if batch_obj and batch_obj.goods_receipt_ref:
            grn_ref = batch_obj.goods_receipt_ref
        elif serial_obj and serial_obj.goods_receipt_ref:
            grn_ref = serial_obj.goods_receipt_ref

        grn_data = None
        if grn_ref:
            grn = StockTransaction.objects.filter(
                Q(transaction_number=grn_ref) | Q(reference_number=grn_ref)
            ).first()
            if grn:
                grn_data = {
                    "receipt_number": grn.transaction_number,
                    "receipt_date": grn.transaction_date.isoformat() if grn.transaction_date else None,
                    "receipt_type": grn.transaction_type,
                    "supplier_name": grn.source_document_reference or (batch_obj.supplier if batch_obj else ""),
                    "purchase_order_ref": grn.reference_number,
                    "status": grn.status,
                }

        # Backward timeline from movements
        ledger_q = Q(batch_number=identifier) if target_type == "BATCH" else Q(serial_number=identifier)
        entries = StockLedgerEntry.objects.filter(ledger_q).select_related(
            "warehouse", "location", "destination_warehouse"
        ).order_by("-created_at")

        backward_steps = []
        for e in entries:
            backward_steps.append({
                "step": e.movement_type,
                "timestamp": e.created_at.isoformat(),
                "delta": str(e.quantity_delta),
                "warehouse": e.warehouse.name if e.warehouse else "",
                "location": e.location.code if e.location else "",
                "transaction_ref": e.transaction_ref,
                "actor": e.actor,
                "reason": e.reason,
            })

        return Response({
            "target_type": target_type,
            "identifier": identifier,
            "item_name": item_obj.name if item_obj else "",
            "item_code": item_obj.code if item_obj else "",
            "supplier": batch_obj.supplier if batch_obj else "",
            "supplier_lot": batch_obj.supplier_lot if batch_obj else "",
            "manufacturer": batch_obj.manufacturer if batch_obj else "",
            "goods_receipt": grn_data or {"receipt_number": grn_ref or "N/A"},
            "backward_path": backward_steps,
        })

    @action(detail=False, methods=["get"], url_path="timeline")
    def movement_timeline(self, request):
        batch_num = request.query_params.get("batch_number", "").strip()
        serial_num = request.query_params.get("serial_number", "").strip()

        if not batch_num and not serial_num:
            return Response(
                {"error": "Please provide either batch_number or serial_number query parameter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        identifier = batch_num or serial_num
        target_type = "BATCH" if batch_num else "SERIAL"

        events = []

        # 1. Inward / Receipt events
        if target_type == "BATCH":
            batch = Batch.objects.filter(batch_number=batch_num).first()
            if batch:
                events.append({
                    "timestamp": batch.created_at.isoformat(),
                    "category": "CREATION",
                    "title": f"Batch {batch.batch_number} Created",
                    "description": f"Initial quantity: {batch.initial_quantity}. Supplier: {batch.supplier or 'N/A'}",
                    "severity": "info",
                })
                # Check quarantine records
                for q in batch.quarantine_records.all():
                    events.append({
                        "timestamp": q.created_at.isoformat(),
                        "category": "QUARANTINE",
                        "title": f"Batch Quarantined ({q.quarantine_number})",
                        "description": f"Reason: {q.quarantine_reason}. Quantity: {q.quarantine_quantity}",
                        "severity": "warning",
                    })
                    if q.is_released:
                        events.append({
                            "timestamp": (q.release_date or q.quarantine_date).isoformat(),
                            "category": "RELEASE",
                            "title": f"Batch Released from Quarantine",
                            "description": f"Released by: {q.released_by}. Result: {q.inspection_result}",
                            "severity": "success",
                        })
        else:
            sn = SerialNumber.objects.filter(serial_number=serial_num).first()
            if sn:
                events.append({
                    "timestamp": sn.created_at.isoformat(),
                    "category": "REGISTRATION",
                    "title": f"Serial {sn.serial_number} Registered",
                    "description": f"Initial status: {sn.status}. Warehouse: {sn.warehouse.name if sn.warehouse else 'N/A'}",
                    "severity": "info",
                })

        # 2. Ledger movements
        ledger_q = Q(batch_number=identifier) if target_type == "BATCH" else Q(serial_number=identifier)
        for e in StockLedgerEntry.objects.filter(ledger_q).order_by("created_at"):
            events.append({
                "timestamp": e.created_at.isoformat(),
                "category": "MOVEMENT",
                "title": f"{e.movement_type}: {e.quantity_delta} units",
                "description": f"Txn Ref: {e.transaction_ref}. Warehouse: {e.warehouse.name if e.warehouse else 'N/A'}. Location: {e.location.code if e.location else 'N/A'}",
                "severity": "info" if e.quantity_delta >= 0 else "neutral",
            })

        # 3. Recalls
        recall_qs = ProductRecall.objects.filter(batch__batch_number=batch_num) if target_type == "BATCH" else ProductRecall.objects.filter(serial_number_ref=serial_num)
        for r in recall_qs:
            events.append({
                "timestamp": r.created_at.isoformat(),
                "category": "RECALL",
                "title": f"Product Recall: {r.recall_number}",
                "description": f"{r.title} - Priority: {r.priority}. Status: {r.status}",
                "severity": "danger",
            })

        # Sort all events chronologically
        events.sort(key=lambda x: x["timestamp"])

        return Response({
            "target_type": target_type,
            "identifier": identifier,
            "events_count": len(events),
            "timeline": events,
        })
