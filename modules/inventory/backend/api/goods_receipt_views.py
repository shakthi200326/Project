"""
Goods Receipt & Inspection API.

Receipts are StockTransaction(RECEIPT) rows; all business rules live in
GoodsReceiptService. Every endpoint is gated by its submodule's `enabled`
flag and `required_permission` from the GRN configuration.
"""
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db.models import Count, DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, ValidationError as APIValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.goods_receipt.models import (
    GoodsReceiptSettingVersion,
    ReceiptDiscrepancy,
    ReceiptInspection,
    ReceiptPutaway,
)
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.products.models import InventoryItem, ProductBarcode
from services.goods_receipt_config import GoodsReceiptConfigService, Submodule
from services.goods_receipt_service import (
    CANCELLABLE,
    INSPECTABLE,
    POSTABLE,
    PUTAWAY_OPEN,
    AlreadyPostedError,
    GoodsReceiptService,
)

S = StockTransaction.Status
ZERO = Decimal("0.0000")
DEC = DecimalField(max_digits=20, decimal_places=4)


class GuardDenied(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "You do not have permission to perform this action."


def actor_of(request) -> str:
    ctx = getattr(request, "context", None)
    return getattr(ctx, "username", None) or "system"


def has_perm(request, codename: str) -> bool:
    ctx = getattr(request, "context", None)
    return bool(ctx and codename and ctx.has_permission(codename))


def guard(request, submodule: str, perm_key: str = "required_permission"):
    cfg = GoodsReceiptConfigService.get(submodule)
    if not cfg["enabled"]:
        raise GuardDenied(f"{Submodule(submodule).label} is disabled in the goods receipt configuration.")
    codename = cfg.get(perm_key)
    if not has_perm(request, codename):
        raise GuardDenied(f"Missing permission '{codename}' for {Submodule(submodule).label}.")
    return cfg


def error_response(exc: ValidationError, code=status.HTTP_400_BAD_REQUEST):
    if hasattr(exc, "error_dict"):
        errors = {k: v[0] if len(v) == 1 else v for k, v in exc.message_dict.items()}
        first = next(iter(errors.values()))
        return Response({"error": first if isinstance(first, str) else first[0], "errors": errors}, status=code)
    return Response({"error": " ".join(exc.messages)}, status=code)


class ConfigPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 200

    def __init__(self, default_size=25):
        self.page_size = default_size


def paginate(view, request, queryset, serializer_cls, default_size, context=None):
    paginator = ConfigPagination(default_size)
    page = paginator.paginate_queryset(queryset, request, view=view)
    data = serializer_cls(page, many=True, context=context or {"request": request}).data
    return paginator.get_paginated_response(data)


def date_range(qs, request, field):
    params = request.query_params
    parsed = {}
    for key in ("date_from", "date_to"):
        value = params.get(key)
        if value:
            parsed[key] = parse_date(value) if isinstance(value, str) else None
            if parsed[key] is None:
                raise APIValidationError({key: "Enter a valid date (YYYY-MM-DD)."})
    if parsed.get("date_from") and parsed.get("date_to") and parsed["date_from"] > parsed["date_to"]:
        raise APIValidationError({"date_to": "Must be on or after date_from."})
    if parsed.get("date_from"):
        qs = qs.filter(**{f"{field}__gte": parsed["date_from"]})
    if parsed.get("date_to"):
        qs = qs.filter(**{f"{field}__lte": parsed["date_to"]})
    return qs


def positive_int_param(request, name):
    value = request.query_params.get(name)
    if value in (None, ""):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise APIValidationError({name: "Enter a valid positive integer."})
    if parsed < 1:
        raise APIValidationError({name: "Enter a valid positive integer."})
    return parsed


# ---------------------------------------------------------------- serializers
class ReceiptLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    variant_sku = serializers.CharField(source="variant.sku", read_only=True, default="")
    variant_name = serializers.CharField(source="variant.variant_name", read_only=True, default="")
    sku = serializers.SerializerMethodField()
    barcode = serializers.SerializerMethodField()
    uom = serializers.CharField(source="transaction_uom", read_only=True)
    received_quantity = serializers.DecimalField(source="quantity", max_digits=20, decimal_places=4, read_only=True)
    pending_putaway_quantity = serializers.SerializerMethodField()
    location_code = serializers.CharField(source="location.code", read_only=True, default="")
    putaway_location_code = serializers.CharField(source="putaway_location.code", read_only=True, default="")
    line_value = serializers.SerializerMethodField()
    tracking = serializers.SerializerMethodField()
    rejected_serial_numbers = serializers.SerializerMethodField()
    receipt_id = serializers.IntegerField(source="transaction.id", read_only=True)
    receipt_number = serializers.CharField(source="transaction.document_number", read_only=True)
    receipt_status = serializers.CharField(source="transaction.status", read_only=True)
    receipt_date = serializers.DateField(source="transaction.transaction_date", read_only=True)
    warehouse = serializers.IntegerField(source="transaction.warehouse_id", read_only=True)
    warehouse_code = serializers.CharField(source="transaction.warehouse.code", read_only=True)
    supplier = serializers.CharField(source="transaction.supplier", read_only=True)

    class Meta:
        model = StockTransactionLine
        fields = (
            "id", "receipt_id", "receipt_number", "receipt_status", "receipt_date", "warehouse", "warehouse_code",
            "supplier", "item", "item_code", "item_name", "variant", "variant_sku", "variant_name", "sku", "barcode",
            "description", "uom", "conversion_factor_at_txn", "quantity_base_uom", "expected_quantity",
            "received_quantity", "accepted_quantity", "rejected_quantity", "hold_quantity", "pending_inspection_quantity",
            "inspection_status", "rejection_reason", "inspection_remarks", "inspected_by", "inspected_at",
            "putaway_quantity", "pending_putaway_quantity", "putaway_status", "putaway_location",
            "putaway_location_code", "location", "location_code", "unit_cost", "line_value", "batch_number",
            "serial_numbers", "rejected_serial_numbers", "manufacturing_date", "expiry_date", "tracking",
        )

    def get_sku(self, obj):
        return obj.variant.sku if obj.variant_id else obj.item.code

    def get_barcode(self, obj):
        return (obj.variant.barcode if obj.variant_id else "") or obj.item.barcode or ""

    def get_pending_putaway_quantity(self, obj):
        return str(obj.accepted_quantity - obj.putaway_quantity)

    def get_line_value(self, obj):
        return str((obj.quantity * obj.unit_cost).quantize(Decimal("0.01")))

    def get_tracking(self, obj):
        return GoodsReceiptService.tracking_flags(obj.item)

    def get_rejected_serial_numbers(self, obj):
        return GoodsReceiptService.rejected_serials(obj) if obj.serial_numbers else []


class ReceiptSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    receipt_type_label = serializers.SerializerMethodField()
    external_reference = serializers.CharField(source="reference_number", read_only=True)
    remarks = serializers.CharField(source="notes", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    receiving_location_code = serializers.CharField(source="receiving_location.code", read_only=True, default="")
    receiving_location_name = serializers.CharField(source="receiving_location.name", read_only=True, default="")
    totals = serializers.SerializerMethodField()
    putaway_progress = serializers.SerializerMethodField()
    posted = serializers.SerializerMethodField()
    reversal_document = serializers.SerializerMethodField()
    available_actions = serializers.SerializerMethodField()

    class Meta:
        model = StockTransaction
        fields = (
            "id", "document_number", "receipt_type", "receipt_type_label", "transaction_date", "status",
            "status_label", "external_reference", "supplier", "supplier_reference", "purchase_order_reference",
            "warehouse", "warehouse_code", "warehouse_name", "receiving_location", "receiving_location_code",
            "receiving_location_name", "expected_date", "received_by", "remarks", "inspection_required", "reason",
            "created_by", "created_at", "submitted_by", "submitted_at", "approved_by", "approved_at", "posted_by",
            "posted_at", "updated_at", "totals", "putaway_progress", "posted", "reversal_document",
            "available_actions",
        )

    def _types(self):
        if "_types" not in self.context:
            self.context["_types"] = {t["code"]: t["label"] for t in GoodsReceiptConfigService.get(Submodule.CREATE)["receipt_types"]}
        return self.context["_types"]

    def get_receipt_type_label(self, obj):
        return self._types().get(obj.receipt_type, obj.receipt_type)

    def get_totals(self, obj):
        if hasattr(obj, "t_lines"):
            values = {
                "lines": obj.t_lines, "received": obj.t_received, "accepted": obj.t_accepted,
                "rejected": obj.t_rejected, "pending": obj.t_pending, "putaway": obj.t_putaway,
            }
        else:
            agg = obj.lines.aggregate(
                lines=Count("id"), received=Sum("quantity"), accepted=Sum("accepted_quantity"),
                rejected=Sum("rejected_quantity"), pending=Sum("pending_inspection_quantity"),
                putaway=Sum("putaway_quantity"),
            )
            values = {k: (v if v is not None else (0 if k == "lines" else ZERO)) for k, v in agg.items()}
        return {k: (v if k == "lines" else str(v)) for k, v in values.items()}

    def get_putaway_progress(self, obj):
        totals = self.get_totals(obj)
        accepted, putaway = Decimal(totals["accepted"]), Decimal(totals["putaway"])
        if obj.status in (S.DRAFT, S.CANCELLED) or accepted == 0:
            return "NOT_APPLICABLE"
        if putaway == 0:
            return "PENDING"
        return "COMPLETED" if putaway >= accepted else "PARTIAL"

    def get_posted(self, obj):
        return obj.status in (S.POSTED, S.REVERSED)

    def get_reversal_document(self, obj):
        rev = obj.reversals.first() if obj.status == S.REVERSED else None
        return rev.document_number if rev else ""

    def get_available_actions(self, obj):
        request = self.context.get("request")
        if request is None:
            return []
        cfg = GoodsReceiptConfigService.get_all()
        create = cfg[Submodule.CREATE]

        def allowed(sub, key="required_permission"):
            return cfg[sub]["enabled"] and has_perm(request, cfg[sub][key])

        awaiting_approval = obj.status == S.SUBMITTED and create["approval_required"] and not obj.approved_at
        actions = []
        if obj.status == S.DRAFT and allowed(Submodule.CREATE):
            actions += ["edit", "delete", "submit"]
        if awaiting_approval and allowed(Submodule.CREATE, "approval_permission"):
            actions += ["approve", "return_to_draft"]
        elif obj.status == S.SUBMITTED and allowed(Submodule.CREATE):
            actions.append("return_to_draft")
        if obj.status in CANCELLABLE and allowed(Submodule.CREATE):
            actions.append("cancel")
        if not awaiting_approval and obj.inspection_required and obj.status in INSPECTABLE:
            if allowed(Submodule.INSPECTION):
                actions.append("inspect")
            if allowed(Submodule.QUALITY):
                actions.append("quality")
        if not awaiting_approval and obj.status in PUTAWAY_OPEN and allowed(Submodule.PUTAWAY):
            actions.append("putaway")
        if not awaiting_approval and obj.status in POSTABLE and has_perm(request, create["post_permission"]):
            actions.append("post")
        if obj.status == S.POSTED and has_perm(request, create["reverse_permission"]):
            actions.append("reverse")
        if obj.status not in (S.DRAFT, S.CANCELLED) and allowed(Submodule.DISCREPANCY):
            actions.append("discrepancy")
        return actions


class ReceiptDetailSerializer(ReceiptSerializer):
    lines = serializers.SerializerMethodField()

    class Meta(ReceiptSerializer.Meta):
        fields = ReceiptSerializer.Meta.fields + ("lines",)

    def get_lines(self, obj):
        lines = obj.lines.select_related("item", "variant", "location", "putaway_location", "transaction__warehouse").order_by("id")
        return ReceiptLineSerializer(lines, many=True).data


class InspectionSerializer(serializers.ModelSerializer):
    receipt_number = serializers.CharField(source="receipt.document_number", read_only=True)
    receipt_status = serializers.CharField(source="receipt.status", read_only=True)
    item = serializers.IntegerField(source="line.item_id", read_only=True)
    item_code = serializers.CharField(source="line.item.code", read_only=True)
    item_name = serializers.CharField(source="line.item.name", read_only=True)
    variant_sku = serializers.CharField(source="line.variant.sku", read_only=True, default="")
    received_quantity = serializers.DecimalField(source="line.quantity", max_digits=20, decimal_places=4, read_only=True)
    uom = serializers.CharField(source="line.transaction_uom", read_only=True)
    batch_number = serializers.CharField(source="line.batch_number", read_only=True)

    class Meta:
        model = ReceiptInspection
        fields = "__all__"


class PutawaySerializer(serializers.ModelSerializer):
    receipt_number = serializers.CharField(source="receipt.document_number", read_only=True)
    receipt_status = serializers.CharField(source="receipt.status", read_only=True)
    item_code = serializers.CharField(source="line.item.code", read_only=True)
    item_name = serializers.CharField(source="line.item.name", read_only=True)
    variant_sku = serializers.CharField(source="line.variant.sku", read_only=True, default="")
    accepted_quantity = serializers.DecimalField(source="line.accepted_quantity", max_digits=20, decimal_places=4, read_only=True)
    line_putaway_quantity = serializers.DecimalField(source="line.putaway_quantity", max_digits=20, decimal_places=4, read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    location_code = serializers.CharField(source="location.code", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True)
    uom = serializers.CharField(source="line.transaction_uom", read_only=True)

    class Meta:
        model = ReceiptPutaway
        fields = "__all__"


class DiscrepancySerializer(serializers.ModelSerializer):
    receipt_number = serializers.CharField(source="receipt.document_number", read_only=True)
    item_code = serializers.CharField(source="line.item.code", read_only=True, default="")
    item_name = serializers.CharField(source="line.item.name", read_only=True, default="")

    class Meta:
        model = ReceiptDiscrepancy
        fields = "__all__"


class SettingVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoodsReceiptSettingVersion
        fields = "__all__"


# -------------------------------------------------------------------- views
class GoodsReceiptViewSet(viewsets.ViewSet):
    """Receipt Register / Create / History and workflow actions."""

    lookup_value_regex = r"\d+"

    def _base(self):
        return GoodsReceiptService.receipt_queryset().select_related("warehouse", "receiving_location")

    def _get(self, pk):
        tx = self._base().filter(pk=pk).first()
        if not tx:
            from django.http import Http404
            raise Http404("Goods receipt not found.")
        return tx

    def _detail(self, request, tx, code=status.HTTP_200_OK, warnings=None):
        data = ReceiptDetailSerializer(tx, context={"request": request}).data
        if warnings:
            data["warnings"] = warnings
        return Response(data, status=code)

    def list(self, request):
        view = request.query_params.get("view", "register")
        submodule = Submodule.HISTORY if view == "history" else Submodule.REGISTER
        cfg = guard(request, submodule)
        qs = self._base().annotate(
            t_lines=Count("lines"),
            t_received=Coalesce(Sum("lines__quantity"), Value(ZERO), output_field=DEC),
            t_accepted=Coalesce(Sum("lines__accepted_quantity"), Value(ZERO), output_field=DEC),
            t_rejected=Coalesce(Sum("lines__rejected_quantity"), Value(ZERO), output_field=DEC),
            t_hold=Coalesce(Sum("lines__hold_quantity"), Value(ZERO), output_field=DEC),
            t_pending=Coalesce(Sum("lines__pending_inspection_quantity"), Value(ZERO), output_field=DEC),
            t_putaway=Coalesce(Sum("lines__putaway_quantity"), Value(ZERO), output_field=DEC),
        )
        p = request.query_params
        if view == "history":
            closed = [S.POSTED, S.REVERSED, S.REJECTED] + ([S.CANCELLED] if cfg["include_cancelled"] else [])
            qs = qs.filter(status__in=closed)
        if p.get("search"):
            term = p["search"].strip()
            qs = qs.filter(
                Q(document_number__icontains=term) | Q(supplier__icontains=term) | Q(supplier_reference__icontains=term)
                | Q(reference_number__icontains=term) | Q(purchase_order_reference__icontains=term)
                | Q(lines__item__code__icontains=term) | Q(lines__item__name__icontains=term)
                | Q(lines__batch_number__iexact=term)
            ).distinct()
        statuses = [s for s in (p.get("status") or cfg.get("default_status_filter") or "").split(",") if s]
        if statuses:
            qs = qs.filter(status__in=statuses)
        if p.get("receipt_type"):
            qs = qs.filter(receipt_type=p["receipt_type"])
        warehouse_id = positive_int_param(request, "warehouse")
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)
        if p.get("posted") in ("true", "false"):
            posted_q = Q(status__in=[S.POSTED, S.REVERSED])
            qs = qs.filter(posted_q) if p["posted"] == "true" else qs.exclude(posted_q)
        if p.get("created_by"):
            qs = qs.filter(created_by__icontains=p["created_by"])
        if p.get("putaway") in ("PENDING", "PARTIAL", "COMPLETED"):
            qs = qs.filter(t_accepted__gt=0).exclude(status__in=[S.DRAFT, S.CANCELLED])
            qs = {
                "PENDING": qs.filter(t_putaway=0),
                "PARTIAL": qs.filter(t_putaway__gt=0, t_putaway__lt=F("t_accepted")),
                "COMPLETED": qs.filter(t_putaway__gte=F("t_accepted")),
            }[p["putaway"]]
        qs = date_range(qs, request, "transaction_date")
        ordering = p.get("ordering", "-created_at")
        allowed = {"created_at", "transaction_date", "document_number", "status"}
        if ordering.lstrip("-") in allowed:
            qs = qs.order_by(ordering, "-id")
        return paginate(self, request, qs, ReceiptSerializer, cfg["page_size"])

    @action(detail=False, methods=["get"])
    def metrics(self, request):
        guard(request, Submodule.REGISTER)
        qs = StockTransaction.objects.filter(transaction_type=StockTransaction.TransactionType.RECEIPT)
        warehouse_id = positive_int_param(request, "warehouse")
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)
        total_count = qs.count()
        draft_count = qs.filter(status=S.DRAFT).count()
        under_inspection_count = qs.filter(status=S.UNDER_INSPECTION).count()
        pending_insp_lines = StockTransactionLine.objects.filter(
            transaction__transaction_type=StockTransaction.TransactionType.RECEIPT,
            pending_inspection_quantity__gt=0,
        )
        if warehouse_id:
            pending_insp_lines = pending_insp_lines.filter(transaction__warehouse_id=warehouse_id)
        pending_insp_sum = pending_insp_lines.aggregate(s=Coalesce(Sum("pending_inspection_quantity"), Value(ZERO), output_field=DEC))["s"]
        putaway_pending_count = qs.filter(status__in=[S.ACCEPTED, S.PARTIALLY_ACCEPTED, S.PUTAWAY_PENDING]).count()
        ready_to_post_count = qs.filter(status=S.READY_TO_POST).count()
        posted_count = qs.filter(status=S.POSTED).count()
        received_agg = qs.aggregate(
            total_lines=Count("lines__id"),
            total_received_qty=Coalesce(Sum("lines__quantity"), Value(ZERO), output_field=DEC),
            total_accepted_qty=Coalesce(Sum("lines__accepted_quantity"), Value(ZERO), output_field=DEC),
            total_rejected_qty=Coalesce(Sum("lines__rejected_quantity"), Value(ZERO), output_field=DEC),
            total_hold_qty=Coalesce(Sum("lines__hold_quantity"), Value(ZERO), output_field=DEC),
        )
        return Response({
            "total_receipts": total_count,
            "draft_count": draft_count,
            "under_inspection_count": under_inspection_count,
            "pending_inspection_units": str(pending_insp_sum),
            "putaway_pending_count": putaway_pending_count,
            "ready_to_post_count": ready_to_post_count,
            "posted_count": posted_count,
            "total_lines": received_agg["total_lines"],
            "total_received_qty": str(received_agg["total_received_qty"]),
            "total_accepted_qty": str(received_agg["total_accepted_qty"]),
            "total_rejected_qty": str(received_agg["total_rejected_qty"]),
            "total_hold_qty": str(received_agg["total_hold_qty"]),
        })


    def retrieve(self, request, pk=None):
        view = request.query_params.get("view")
        guard(request, Submodule.HISTORY if view == "history" else Submodule.REGISTER)
        return self._detail(request, self._get(pk))

    def create(self, request):
        cfg = guard(request, Submodule.CREATE)
        try:
            tx, warnings = GoodsReceiptService.save_draft(
                request.data,
                actor_of(request),
                can_manual_number=has_perm(request, cfg["manual_number_permission"]),
                idempotency_key=request.headers.get("Idempotency-Key", "")[:150],
            )
        except ValidationError as exc:
            return error_response(exc)
        return self._detail(request, tx, status.HTTP_201_CREATED, warnings)

    def partial_update(self, request, pk=None):
        guard(request, Submodule.CREATE)
        try:
            tx, warnings = GoodsReceiptService.save_draft(request.data, actor_of(request), tx=self._get(pk))
        except ValidationError as exc:
            return error_response(exc)
        return self._detail(request, tx, warnings=warnings)

    update = partial_update

    def destroy(self, request, pk=None):
        guard(request, Submodule.CREATE)
        try:
            GoodsReceiptService.delete_draft(self._get(pk))
        except ValidationError as exc:
            return error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _run(self, request, pk, fn, *args):
        tx = self._get(pk)
        try:
            result = fn(tx, actor_of(request), *args)
        except AlreadyPostedError as exc:
            tx.refresh_from_db()
            payload = ReceiptDetailSerializer(tx, context={"request": request}).data
            return Response({"error": exc.messages[0], "already_posted": True, "receipt": payload}, status=status.HTTP_409_CONFLICT)
        except ValidationError as exc:
            return error_response(exc)
        warnings = []
        if isinstance(result, tuple):
            result, warnings = result
        return self._detail(request, result, warnings=warnings)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        guard(request, Submodule.CREATE)
        return self._run(request, pk, GoodsReceiptService.submit)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        guard(request, Submodule.CREATE, "approval_permission")
        return self._run(request, pk, GoodsReceiptService.approve)

    @action(detail=True, methods=["post"], url_path="return-to-draft")
    def return_to_draft(self, request, pk=None):
        guard(request, Submodule.CREATE)
        return self._run(request, pk, GoodsReceiptService.return_to_draft, str(request.data.get("reason") or "").strip())

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        guard(request, Submodule.CREATE)
        return self._run(request, pk, GoodsReceiptService.cancel, str(request.data.get("reason") or "").strip())

    @action(detail=True, methods=["post"])
    def post(self, request, pk=None):
        guard(request, Submodule.CREATE, "post_permission")
        return self._run(request, pk, GoodsReceiptService.post)

    @action(detail=True, methods=["post"])
    def reverse(self, request, pk=None):
        guard(request, Submodule.CREATE, "reverse_permission")
        return self._run(request, pk, GoodsReceiptService.reverse, str(request.data.get("reason") or "").strip())

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        guard(request, Submodule.HISTORY)
        tx = self._get(pk)
        events = [{"at": tx.created_at, "event": "Created", "by": tx.created_by, "detail": tx.document_number}]
        if tx.submitted_at:
            events.append({"at": tx.submitted_at, "event": "Submitted", "by": tx.submitted_by, "detail": ""})
        if tx.approved_at:
            events.append({"at": tx.approved_at, "event": "Approved", "by": tx.approved_by, "detail": ""})
        for insp in tx.receipt_inspections.select_related("line__item").order_by("created_at"):
            if insp.kind == ReceiptInspection.InspectionKind.QUALITY:
                detail = f"{insp.line.item.code}: {insp.quality_result} (sample {insp.sample_quantity}, failed {insp.failed_quantity})"
            else:
                detail = f"{insp.line.item.code}: accepted {insp.accepted_quantity}, rejected {insp.rejected_quantity}"
            events.append({"at": insp.created_at, "event": insp.get_kind_display(), "by": insp.inspector,
                           "detail": f"{insp.inspection_number} – {detail}"})
        for put in tx.receipt_putaways.select_related("line__item", "location").order_by("created_at"):
            events.append({"at": put.created_at, "event": f"Putaway {put.get_status_display().lower()}", "by": put.putaway_by,
                           "detail": f"{put.putaway_number} – {put.line.item.code} {put.quantity} to {put.location.code}"})
        for disc in tx.receipt_discrepancies.order_by("created_at"):
            events.append({"at": disc.created_at, "event": "Discrepancy raised", "by": disc.created_by or "system",
                           "detail": f"{disc.discrepancy_number} – {disc.discrepancy_type} ({disc.resolution_status})"})
        if tx.posted_at:
            events.append({"at": tx.posted_at, "event": "Posted to stock", "by": tx.posted_by, "detail": ""})
        rev = tx.reversals.first()
        if rev:
            events.append({"at": rev.created_at, "event": "Reversed", "by": rev.created_by,
                           "detail": f"{rev.document_number} – {rev.reason}"})
        events.sort(key=lambda e: e["at"])
        return Response(events)


class ReceiptLineViewSet(viewsets.ViewSet):
    """
    Derived line views (no separate storage): accepted, rejected, partial,
    pending inspection and putaway queues.
    """

    OUTCOMES = {
        "accepted": (Submodule.ACCEPTED, Q(accepted_quantity__gt=0)),
        "rejected": (Submodule.REJECTED, Q(rejected_quantity__gt=0)),
        "partial": (
            Submodule.PARTIAL,
            Q(accepted_quantity__gt=0) & (Q(rejected_quantity__gt=0) | Q(pending_inspection_quantity__gt=0)),
        ),
        "pending_inspection": (Submodule.INSPECTION, Q(pending_inspection_quantity__gt=0)),
        "pending_putaway": (Submodule.PUTAWAY, Q(accepted_quantity__gt=F("putaway_quantity"))),
        "putaway": (Submodule.PUTAWAY, Q(accepted_quantity__gt=0)),
    }

    def list(self, request):
        p = request.query_params
        outcome = p.get("outcome", "accepted")
        if outcome not in self.OUTCOMES:
            return Response({"error": f"outcome must be one of: {', '.join(self.OUTCOMES)}"}, status=400)
        submodule, condition = self.OUTCOMES[outcome]
        cfg = guard(request, submodule)
        qs = (
            StockTransactionLine.objects.filter(transaction__transaction_type=StockTransaction.TransactionType.RECEIPT)
            .exclude(transaction__status__in=[S.DRAFT, S.CANCELLED])
            .filter(condition)
            .select_related("item", "variant", "location", "putaway_location", "transaction__warehouse")
        )
        if outcome == "pending_inspection":
            qs = qs.filter(transaction__status__in=list(INSPECTABLE))
        if outcome in ("pending_putaway",):
            qs = qs.filter(transaction__status__in=list(PUTAWAY_OPEN))
        receipt_id = positive_int_param(request, "receipt")
        warehouse_id = positive_int_param(request, "warehouse")
        if receipt_id:
            qs = qs.filter(transaction_id=receipt_id)
        if warehouse_id:
            qs = qs.filter(transaction__warehouse_id=warehouse_id)
        if p.get("receipt_status"):
            qs = qs.filter(transaction__status__in=p["receipt_status"].split(","))
        if p.get("posted") in ("true", "false"):
            posted_q = Q(transaction__status__in=[S.POSTED, S.REVERSED])
            qs = qs.filter(posted_q) if p["posted"] == "true" else qs.exclude(posted_q)
        if p.get("search"):
            term = p["search"].strip()
            qs = qs.filter(
                Q(transaction__document_number__icontains=term) | Q(item__code__icontains=term)
                | Q(item__name__icontains=term) | Q(batch_number__icontains=term)
                | Q(transaction__supplier__icontains=term)
            )
        qs = date_range(qs, request, "transaction__transaction_date").order_by("-transaction__created_at", "id")
        return paginate(self, request, qs, ReceiptLineSerializer, cfg.get("page_size", 25))


class _RecordViewSet(viewsets.ViewSet):
    def _receipt(self, data):
        try:
            pk = int(data.get("receipt"))
        except (TypeError, ValueError):
            raise ValidationError({"receipt": "Receipt is required."})
        tx = GoodsReceiptService.receipt_queryset().filter(pk=pk).first()
        if not tx:
            raise ValidationError({"receipt": "Goods receipt not found."})
        return tx

    def _filter_common(self, qs, request):
        p = request.query_params
        receipt_id = positive_int_param(request, "receipt")
        warehouse_id = positive_int_param(request, "warehouse")
        if receipt_id:
            qs = qs.filter(receipt_id=receipt_id)
        if warehouse_id:
            qs = qs.filter(receipt__warehouse_id=warehouse_id)
        if p.get("search"):
            term = p["search"].strip()
            qs = qs.filter(
                Q(receipt__document_number__icontains=term) | Q(line__item__code__icontains=term)
                | Q(line__item__name__icontains=term)
            )
        return qs


class ReceiptInspectionViewSet(_RecordViewSet):
    kind = ReceiptInspection.InspectionKind.RECEIPT
    submodule = Submodule.INSPECTION
    lookup_value_regex = r"\d+"

    def list(self, request):
        p = request.query_params
        # The Rejected Goods screen reads rejection records under its own gate.
        rejected_view = p.get("rejected") == "true" and self.kind == ReceiptInspection.InspectionKind.RECEIPT
        cfg = guard(request, Submodule.REJECTED if rejected_view else self.submodule)
        qs = ReceiptInspection.objects.filter(kind=self.kind).select_related("receipt", "line__item", "line__variant")
        qs = self._filter_common(qs, request)
        if p.get("result"):
            qs = qs.filter(quality_result=p["result"])
        if p.get("rejected") == "true":
            qs = qs.filter(rejected_quantity__gt=0)
        qs = date_range(qs, request, "inspection_date")
        return paginate(self, request, qs, InspectionSerializer, cfg.get("page_size", 25))

    def create(self, request):
        guard(request, self.submodule)
        try:
            tx = self._receipt(request.data)
            if self.kind == ReceiptInspection.InspectionKind.QUALITY:
                record = GoodsReceiptService.record_quality_inspection(tx, request.data, actor_of(request))
            else:
                record = GoodsReceiptService.record_inspection(tx, request.data, actor_of(request))
        except ValidationError as exc:
            return error_response(exc)
        record.refresh_from_db()
        return Response(InspectionSerializer(record).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def disposition(self, request, pk=None):
        guard(request, Submodule.REJECTED, "disposition_permission")
        record = ReceiptInspection.objects.filter(pk=pk, kind=ReceiptInspection.InspectionKind.RECEIPT).first()
        if not record:
            return Response({"error": "Inspection not found."}, status=404)
        try:
            record = GoodsReceiptService.set_disposition(record, str(request.data.get("rejection_disposition") or ""))
        except ValidationError as exc:
            return error_response(exc)
        return Response(InspectionSerializer(record).data)


class QualityInspectionViewSet(ReceiptInspectionViewSet):
    kind = ReceiptInspection.InspectionKind.QUALITY
    submodule = Submodule.QUALITY


class ReceiptPutawayViewSet(_RecordViewSet):
    lookup_value_regex = r"\d+"

    def list(self, request):
        guard(request, Submodule.PUTAWAY)
        qs = ReceiptPutaway.objects.select_related("receipt", "line__item", "line__variant", "warehouse", "location")
        qs = self._filter_common(qs, request)
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        qs = date_range(qs, request, "putaway_date")
        return paginate(self, request, qs, PutawaySerializer, 25)

    def create(self, request):
        guard(request, Submodule.PUTAWAY)
        try:
            record = GoodsReceiptService.record_putaway(self._receipt(request.data), request.data, actor_of(request))
        except ValidationError as exc:
            return error_response(exc)
        record.refresh_from_db()
        return Response(PutawaySerializer(record).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        guard(request, Submodule.PUTAWAY)
        record = ReceiptPutaway.objects.filter(pk=pk).first()
        if not record:
            return Response({"error": "Putaway not found."}, status=404)
        try:
            record = GoodsReceiptService.cancel_putaway(record, actor_of(request))
        except ValidationError as exc:
            return error_response(exc)
        return Response(PutawaySerializer(record).data)


class ReceiptDiscrepancyViewSet(_RecordViewSet):
    lookup_value_regex = r"\d+"

    def list(self, request):
        guard(request, Submodule.DISCREPANCY)
        qs = ReceiptDiscrepancy.objects.select_related("receipt", "line__item")
        qs = self._filter_common(qs, request)
        p = request.query_params
        if p.get("resolution_status"):
            qs = qs.filter(resolution_status__in=p["resolution_status"].split(","))
        if p.get("discrepancy_type"):
            qs = qs.filter(discrepancy_type=p["discrepancy_type"])
        qs = date_range(qs, request, "created_at__date")
        return paginate(self, request, qs, DiscrepancySerializer, 25)

    def create(self, request):
        guard(request, Submodule.DISCREPANCY)
        try:
            record = GoodsReceiptService.create_discrepancy(self._receipt(request.data), request.data, actor_of(request))
        except ValidationError as exc:
            return error_response(exc)
        return Response(DiscrepancySerializer(record).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        guard(request, Submodule.DISCREPANCY)
        record = ReceiptDiscrepancy.objects.filter(pk=pk).first()
        if not record:
            return Response({"error": "Discrepancy not found."}, status=404)
        try:
            record = GoodsReceiptService.update_discrepancy(record, request.data, actor_of(request))
        except ValidationError as exc:
            return error_response(exc)
        return Response(DiscrepancySerializer(record).data)


class GoodsReceiptSettingsViewSet(viewsets.ViewSet):
    """Independently versioned settings per submodule (lookup = submodule key)."""

    lookup_field = "submodule"
    CONFIGURE = "inventory.grn.configure"

    def _check(self, request, submodule):
        if submodule not in GoodsReceiptConfigService.submodules():
            raise ValidationError({"submodule": f"Unknown submodule '{submodule}'."})
        if not has_perm(request, self.CONFIGURE):
            raise GuardDenied(f"Missing permission '{self.CONFIGURE}'.")

    def _payload(self, submodule):
        active = GoodsReceiptConfigService.active_version(submodule)
        upcoming = GoodsReceiptSettingVersion.objects.filter(
            submodule=submodule, effective_from__gt=timezone.localdate()
        ).order_by("effective_from", "id")
        return {
            "submodule": submodule,
            "label": Submodule(submodule).label,
            "settings": GoodsReceiptConfigService.get(submodule),
            "defaults": GoodsReceiptConfigService.defaults(submodule),
            "active_version": SettingVersionSerializer(active).data if active else None,
            "scheduled_versions": SettingVersionSerializer(upcoming, many=True).data,
        }

    def list(self, request):
        if not has_perm(request, self.CONFIGURE):
            raise GuardDenied(f"Missing permission '{self.CONFIGURE}'.")
        return Response({sm: self._payload(sm) for sm in GoodsReceiptConfigService.submodules()})

    def retrieve(self, request, submodule=None):
        try:
            self._check(request, submodule)
        except ValidationError as exc:
            return error_response(exc, status.HTTP_404_NOT_FOUND)
        return Response(self._payload(submodule))

    def update(self, request, submodule=None):
        try:
            self._check(request, submodule)
            effective = request.data.get("effective_from")
            effective_date = None
            if effective is not None and effective != "":
                effective_date = parse_date(effective) if isinstance(effective, str) else None
                if effective_date is None:
                    raise ValidationError({"effective_from": "Enter a valid date (YYYY-MM-DD)."})
            GoodsReceiptConfigService.save(
                submodule, request.data.get("settings") or {}, actor_of(request),
                effective_from=effective_date, reason=str(request.data.get("reason") or ""),
            )
        except ValidationError as exc:
            return error_response(exc)
        return Response(self._payload(submodule))

    partial_update = update

    @action(detail=True, methods=["post"])
    def reset(self, request, submodule=None):
        try:
            self._check(request, submodule)
            GoodsReceiptConfigService.save(submodule, {}, actor_of(request), reason="Reset to defaults", is_reset=True)
        except ValidationError as exc:
            return error_response(exc)
        return Response(self._payload(submodule))

    @action(detail=True, methods=["get"])
    def history(self, request, submodule=None):
        try:
            self._check(request, submodule)
        except ValidationError as exc:
            return error_response(exc, status.HTTP_404_NOT_FOUND)
        versions = GoodsReceiptSettingVersion.objects.filter(submodule=submodule).order_by("-created_at", "-id")[:100]
        return Response(SettingVersionSerializer(versions, many=True).data)


class GoodsReceiptLookupViewSet(viewsets.ViewSet):
    @action(detail=False, methods=["get"])
    def context(self, request):
        guard(request, Submodule.REGISTER)
        ctx = getattr(request, "context", None)
        return Response({
            "username": actor_of(request),
            "permissions": sorted(set(getattr(ctx, "permissions", []) or [])),
            "roles": getattr(ctx, "roles", []),
            "settings": GoodsReceiptConfigService.get_all(),
            "statuses": [{"code": c, "label": l} for c, l in S.choices],
        })

    @action(detail=False, methods=["get"])
    def items(self, request):
        guard(request, Submodule.CREATE)
        term = (request.query_params.get("search") or "").strip()
        qs = InventoryItem.objects.filter(is_active=True, status=InventoryItem.ItemStatus.ACTIVE, track_inventory=True)
        qs = qs.exclude(item_type__in=[InventoryItem.ItemType.NON_STOCK, InventoryItem.ItemType.SERVICE])
        item_id = positive_int_param(request, "id")
        if item_id:
            qs = qs.filter(pk=item_id)
        elif term:
            barcode_hit = ProductBarcode.objects.filter(barcode_value=term, is_active=True).values_list("item_id", flat=True)
            qs = qs.filter(
                Q(code__icontains=term) | Q(name__icontains=term) | Q(barcode=term)
                | Q(variants__sku__iexact=term) | Q(variants__barcode=term) | Q(pk__in=barcode_hit)
            ).distinct()
        results = []
        for item in qs.select_related("base_uom", "category", "subcategory", "brand_ref").prefetch_related("variants", "uom_conversions__from_uom", "uom_conversions__to_uom").order_by("code")[:25]:
            base = item.base_uom.code if item.base_uom_id else (item.base_unit or "EA")
            uoms = {base}
            for conv in item.uom_conversions.all():
                if conv.is_active:
                    uoms.update({conv.from_uom.code, conv.to_uom.code})
            results.append({
                "id": item.id,
                "code": item.code,
                "name": item.name,
                "description": item.short_description or item.name,
                "barcode": item.barcode,
                "base_uom": base,
                "uom_options": sorted(uoms),
                "standard_cost": str(item.standard_cost),
                "category": item.category.name if item.category_id else "",
                "subcategory": item.subcategory.name if item.subcategory_id else "",
                "brand": item.brand_ref.name if item.brand_ref_id else item.brand,
                "manufacturer": item.manufacturer,
                "model_number": item.model_number,
                "item_type": item.get_item_type_display(),
                "has_variants": item.has_variants,
                "tracking": GoodsReceiptService.tracking_flags(item),
                "variants": [
                    {"id": v.id, "sku": v.sku, "name": v.variant_name, "barcode": v.barcode}
                    for v in item.variants.all() if v.is_active
                ],
            })
        return Response(results)
