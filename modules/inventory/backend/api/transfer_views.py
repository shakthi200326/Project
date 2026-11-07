from decimal import Decimal
from typing import Any, Dict
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.exceptions import ValidationError as DjangoValidationError

from apps.movements.models import StockTransaction, StockTransactionLine
from apps.warehouses.models import Warehouse, StorageLocation
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.stock.models import StockBalance, StockLedgerEntry, StockInTransit, DamagedStock
from services.posting_service import InventoryPostingService
from services.stock_operations_service import StockOperationsService
from api.serializers import StockTransactionSerializer


class StockTransferViewSet(viewsets.ModelViewSet):
    """
    Dedicated enterprise Stock Transfer ViewSet.
    Manages Inter-Warehouse Transfers (both Same-City and Inter-City) with multi-item line items,
    backend-derived transfer scope, and full lifecycle actions:
    DRAFT -> SUBMITTED -> APPROVED -> DISPATCHED -> IN_TRANSIT -> RECEIVED -> COMPLETED
    """
    queryset = (
        StockTransaction.objects.filter(transaction_type=StockTransaction.TransactionType.TRANSFER)
        .select_related("warehouse", "destination_warehouse")
        .prefetch_related(
            "lines__item",
            "lines__variant",
            "lines__location",
            "lines__destination_location",
        )
        .order_by("-transaction_date", "-id")
    )
    serializer_class = StockTransactionSerializer

    def _get_actor(self, request):
        if hasattr(request, "context") and getattr(request.context, "username", None):
            return request.context.username
        if getattr(request, "user", None) and getattr(request.user, "username", None):
            return request.user.username
        return "system"

    def get_queryset(self):
        qs = super().get_queryset()
        params = getattr(self.request, "query_params", getattr(self.request, "GET", {}))

        # Scope filter (SAME_CITY or INTER_CITY)
        scope = params.get("scope") or params.get("transfer_scope")
        if scope and scope.upper() in ("SAME_CITY", "INTER_CITY"):
            qs = qs.filter(transfer_scope=scope.upper())

        # Source Warehouse filter (by ID or Code)
        src_wh = params.get("source_warehouse") or params.get("warehouse")
        if src_wh and str(src_wh).upper() != "ALL":
            if str(src_wh).isdigit():
                qs = qs.filter(warehouse_id=int(src_wh))
            else:
                qs = qs.filter(Q(warehouse__code__iexact=str(src_wh)) | Q(warehouse__name__icontains=str(src_wh)))

        # Destination Warehouse filter (by ID or Code)
        dest_wh = params.get("destination_warehouse") or params.get("dest_warehouse")
        if dest_wh and str(dest_wh).upper() != "ALL":
            if str(dest_wh).isdigit():
                qs = qs.filter(destination_warehouse_id=int(dest_wh))
            else:
                qs = qs.filter(
                    Q(destination_warehouse__code__iexact=str(dest_wh))
                    | Q(destination_warehouse__name__icontains=str(dest_wh))
                )

        # City filters
        src_city = params.get("source_city") or params.get("city")
        if src_city:
            qs = qs.filter(warehouse__city__icontains=src_city.strip())
        dest_city = params.get("destination_city")
        if dest_city:
            qs = qs.filter(destination_warehouse__city__icontains=dest_city.strip())

        # Status filter
        stat = params.get("status")
        if stat and stat.upper() != "ALL":
            qs = qs.filter(status=stat.upper())

        # Date range filters
        date_from = params.get("date_from") or params.get("start_date")
        if date_from:
            qs = qs.filter(transaction_date__gte=date_from)
        date_to = params.get("date_to") or params.get("end_date")
        if date_to:
            qs = qs.filter(transaction_date__lte=date_to)

        # Keyword Search
        search = (params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(document_number__icontains=search)
                | Q(warehouse__name__icontains=search)
                | Q(warehouse__code__icontains=search)
                | Q(destination_warehouse__name__icontains=search)
                | Q(destination_warehouse__code__icontains=search)
                | Q(reason__icontains=search)
                | Q(notes__icontains=search)
                | Q(lines__item__name__icontains=search)
                | Q(lines__item__code__icontains=search)
            ).distinct()

        return qs

    def create(self, request, *args, **kwargs):
        actor = self._get_actor(request)
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        data["transaction_type"] = StockTransaction.TransactionType.TRANSFER

        try:
            tx = StockOperationsService.save_draft(
                StockTransaction.TransactionType.TRANSFER,
                data,
                actor=actor,
            )
            # If immediate submit is requested
            if data.get("submit") is True:
                tx = StockOperationsService.submit(tx, actor=actor)

            return Response(
                StockTransactionSerializer(tx).data,
                status=status.HTTP_201_CREATED,
            )
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"error": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        tx = self.get_object()
        actor = self._get_actor(request)
        if tx.status != StockTransaction.Status.DRAFT:
            return Response(
                {"error": f"Cannot edit transfer {tx.document_number} in {tx.status} status. Only DRAFT transfers can be modified."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            tx = StockOperationsService.update_draft_transfer(tx, request.data, actor=actor)
            if request.data.get("submit") is True:
                tx = StockOperationsService.submit(tx, actor=actor)
            return Response(StockTransactionSerializer(tx).data)
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"error": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"], url_path="inter-warehouse")
    def inter_warehouse(self, request):
        """Returns filtered Inter-Warehouse transfers."""
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="items")
    def items(self, request):
        """Search active inventory items for the stock transfer item picker."""
        term = (request.query_params.get("search") or "").strip()
        qs = (
            InventoryItem.objects.filter(
                is_active=True,
                status=InventoryItem.ItemStatus.ACTIVE,
                track_inventory=True,
            )
            .exclude(item_type__in=[InventoryItem.ItemType.NON_STOCK, InventoryItem.ItemType.SERVICE])
            .select_related("base_uom", "category", "subcategory", "brand_ref")
            .prefetch_related("variants")
        )
        if term:
            qs = qs.filter(
                Q(code__icontains=term)
                | Q(name__icontains=term)
                | Q(barcode__icontains=term)
                | Q(variants__sku__icontains=term)
                | Q(variants__barcode__icontains=term)
            ).distinct()

        results = []
        for item in qs.order_by("code")[:25]:
            base_uom = item.base_uom.code if item.base_uom_id else (item.base_unit or "EA")
            results.append({
                "id": item.id,
                "code": item.code,
                "sku": item.sku,
                "name": item.name,
                "description": item.short_description or item.name,
                "barcode": item.barcode,
                "base_uom": base_uom,
                "standard_cost": float(item.standard_cost),
                "category": item.category.name if item.category_id else "",
                "subcategory": item.subcategory.name if item.subcategory_id else "",
                "brand": item.brand_ref.name if item.brand_ref_id else item.brand,
                "manufacturer": item.manufacturer,
                "model_number": item.model_number,
                "tracking": getattr(item, "tracking", "NONE"),
                "variants": [
                    {
                        "id": variant.id,
                        "sku": variant.sku,
                        "name": variant.variant_name,
                        "barcode": variant.barcode,
                    }
                    for variant in item.variants.all()
                    if getattr(variant, "is_active", True) and getattr(variant, "status", "ACTIVE") == "ACTIVE"
                ],
            })
        return Response(results)

    @action(detail=False, methods=["get"], url_path="product-stock")
    def product_stock(self, request):
        """
        Retrieves real-time on-hand and available stock for a specific item and optional variant
        at the specified source warehouse.
        """
        wh_id = request.query_params.get("warehouse") or request.query_params.get("warehouse_id")
        item_id = request.query_params.get("item") or request.query_params.get("item_id")
        variant_id = request.query_params.get("variant") or request.query_params.get("variant_id")

        if not wh_id or not item_id:
            return Response(
                {"error": "Both 'warehouse' and 'item' parameters are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        wh = Warehouse.objects.filter(pk=wh_id).first() if str(wh_id).isdigit() else Warehouse.objects.filter(code=str(wh_id)).first()
        if not wh:
            return Response({"error": f"Warehouse '{wh_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        item = InventoryItem.objects.filter(pk=item_id).first() if str(item_id).isdigit() else InventoryItem.objects.filter(code=str(item_id)).first()
        if not item:
            return Response({"error": f"Item '{item_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        balances = StockBalance.objects.filter(warehouse=wh, item=item)
        if variant_id and str(variant_id).strip():
            if str(variant_id).isdigit():
                balances = balances.filter(variant_id=int(variant_id))
            else:
                balances = balances.filter(variant__sku=str(variant_id))

        total_on_hand = sum((b.on_hand_qty for b in balances), Decimal("0"))
        total_available = sum((b.available_qty for b in balances), Decimal("0"))

        return Response({
            "warehouse_id": wh.id,
            "warehouse_code": wh.code,
            "warehouse_name": wh.name,
            "city": wh.city,
            "item_id": item.id,
            "item_code": item.code,
            "item_name": item.name,
            "variant_id": int(variant_id) if (variant_id and str(variant_id).isdigit()) else None,
            "on_hand": float(total_on_hand),
            "available": float(total_available),
        })

    @action(detail=True, methods=["post"], url_path="submit")
    def submit_transfer(self, request, pk=None):
        tx = self.get_object()
        actor = self._get_actor(request)
        try:
            submitted = StockOperationsService.submit(tx, actor=actor)
            return Response(StockTransactionSerializer(submitted).data)
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"error": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve_transfer(self, request, pk=None):
        tx = self.get_object()
        actor = self._get_actor(request)
        try:
            approved = StockOperationsService.approve(tx, actor=actor)
            return Response(StockTransactionSerializer(approved).data)
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"error": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject_transfer(self, request, pk=None):
        tx = self.get_object()
        actor = self._get_actor(request)
        reason = request.data.get("reason", "").strip()
        try:
            rejected = StockOperationsService.reject(tx, actor=actor, reason=reason)
            return Response(StockTransactionSerializer(rejected).data)
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"error": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="dispatch")
    def dispatch_transfer(self, request, pk=None):
        tx = self.get_object()
        actor = self._get_actor(request)
        try:
            dispatched = InventoryPostingService.dispatch_transfer(tx, actor=actor)
            return Response(StockTransactionSerializer(dispatched).data)
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"error": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="receive")
    def receive_transfer(self, request, pk=None):
        tx = self.get_object()
        actor = self._get_actor(request)
        # Update line receipt quantities if provided in payload
        lines_payload = request.data.get("lines")
        if lines_payload and isinstance(lines_payload, list):
            for lp in lines_payload:
                line_id = lp.get("id")
                line = tx.lines.filter(pk=line_id).first() if line_id else None
                if line:
                    if "received_quantity" in lp:
                        line.received_quantity = Decimal(str(lp["received_quantity"]))
                    if "shortage_quantity" in lp:
                        line.shortage_quantity = Decimal(str(lp["shortage_quantity"]))
                    if "damaged_quantity" in lp:
                        line.damaged_quantity = Decimal(str(lp["damaged_quantity"]))
                    line.save(update_fields=["received_quantity", "shortage_quantity", "damaged_quantity"])

        try:
            received = InventoryPostingService.receive_transfer(tx, actor=actor)
            return Response(StockTransactionSerializer(received).data)
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"error": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete_transfer(self, request, pk=None):
        tx = self.get_object()
        actor = self._get_actor(request)
        try:
            completed = StockOperationsService.complete(tx, actor=actor)
            return Response(StockTransactionSerializer(completed).data)
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"error": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel_transfer(self, request, pk=None):
        tx = self.get_object()
        actor = self._get_actor(request)
        reason = request.data.get("reason", "").strip()
        try:
            cancelled = StockOperationsService.cancel(tx, actor=actor, reason=reason)
            return Response(StockTransactionSerializer(cancelled).data)
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"error": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        tx = self.get_object()
        # Fetch associated transit and ledger entries
        transit_records = StockInTransit.objects.filter(transfer_number=tx.document_number).order_by("-created_at")
        ledger_entries = StockLedgerEntry.objects.filter(transaction_ref=tx.document_number).order_by("created_at")

        history_events = [
            {
                "event": "Created (Draft)",
                "timestamp": tx.created_at,
                "actor": tx.created_by or "system",
                "notes": f"Created with {tx.lines.count()} items",
            }
        ]
        if tx.submitted_at:
            history_events.append({
                "event": "Submitted for Approval",
                "timestamp": tx.submitted_at,
                "actor": tx.submitted_by or "system",
                "notes": "Stock revalidated; awaiting supervisor approval",
            })
        if tx.approved_at:
            history_events.append({
                "event": "Approved",
                "timestamp": tx.approved_at,
                "actor": tx.approved_by or "system",
                "notes": "Ready for warehouse dispatch",
            })
        if tx.dispatched_at:
            history_events.append({
                "event": "Dispatched (In-Transit)",
                "timestamp": tx.dispatched_at,
                "actor": tx.dispatched_by or "system",
                "notes": f"Stock deducted from {tx.warehouse.name}; in transit to {tx.destination_warehouse.name if tx.destination_warehouse else ''}",
            })
        if tx.received_at:
            history_events.append({
                "event": "Received at Destination",
                "timestamp": tx.received_at,
                "actor": tx.received_by or "system",
                "notes": f"Stock posted to {tx.destination_warehouse.name if tx.destination_warehouse else ''}",
            })
        if tx.status == StockTransaction.Status.COMPLETED:
            history_events.append({
                "event": "Completed",
                "timestamp": tx.updated_at,
                "actor": tx.posted_by or "system",
                "notes": "Transfer order finalized and closed",
            })
        elif tx.status == StockTransaction.Status.CANCELLED:
            history_events.append({
                "event": "Cancelled",
                "timestamp": tx.updated_at,
                "actor": "system",
                "notes": tx.notes or "Transfer cancelled",
            })
        elif tx.status == StockTransaction.Status.REJECTED:
            history_events.append({
                "event": "Rejected",
                "timestamp": tx.updated_at,
                "actor": "system",
                "notes": tx.notes or "Transfer rejected",
            })

        return Response({
            "document_number": tx.document_number,
            "status": tx.status,
            "transfer_scope": tx.transfer_scope,
            "timeline": history_events,
            "in_transit": [
                {
                    "item_code": tr.item.code if tr.item else "",
                    "item_name": tr.item.name if tr.item else "",
                    "quantity": float(tr.quantity),
                    "status": tr.status,
                    "dispatched_at": tr.dispatched_at,
                    "received_at": tr.received_at,
                }
                for tr in transit_records
            ],
            "ledger_movements": [
                {
                    "id": le.id,
                    "movement_type": le.movement_type,
                    "warehouse": le.warehouse.code if le.warehouse else "",
                    "item_code": le.item.code if le.item else "",
                    "quantity_delta": float(le.quantity_delta),
                    "balance_after": float(le.balance_after),
                    "timestamp": le.created_at,
                    "actor": le.actor,
                }
                for le in ledger_entries
            ],
        })
