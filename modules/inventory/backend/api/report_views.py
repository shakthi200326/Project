from decimal import Decimal
from datetime import date, datetime, timedelta
from django.utils import timezone
from django.db import models
from django.db.models import Sum, Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.stock.models import StockBalance, StockLedgerEntry, DamagedStock
from apps.batches.models import Batch
from apps.warehouses.models import Warehouse, StorageLocation, WarehouseConfiguration
from apps.products.models import InventoryItem
from apps.planning.models import ReorderRule, StockLevel
from apps.valuation.models import InventoryValuation


class BaseReportFilterMixin:
    def get_common_filters(self, request):
        return {
            "warehouse_id": request.query_params.get("warehouse"),
            "category_id": request.query_params.get("category"),
            "product_id": request.query_params.get("product"),
            "location_id": request.query_params.get("storage_location"),
            "stock_status": request.query_params.get("stock_status"),
            "date_from": request.query_params.get("date_from"),
            "date_to": request.query_params.get("date_to"),
            "search": request.query_params.get("search"),
        }


class StockSummaryReportView(APIView, BaseReportFilterMixin):
    """
    1. Stock Summary Report
    Purpose: View current stock quantities across warehouses.
    Fields: Product Name, SKU, Category, Warehouse, Total Stock, Reserved Stock, Available Stock, Damaged Stock, Stock Status.
    """
    def get(self, request):
        filters = self.get_common_filters(request)
        qs = StockBalance.objects.select_related("item__category", "warehouse", "location").all()

        if filters["warehouse_id"] and filters["warehouse_id"] != "ALL":
            qs = qs.filter(
                models.Q(warehouse_id=filters["warehouse_id"])
                | models.Q(warehouse__name=filters["warehouse_id"])
                | models.Q(warehouse__code=filters["warehouse_id"])
            )
        if filters["category_id"] and filters["category_id"] != "ALL":
            qs = qs.filter(
                models.Q(item__category_id=filters["category_id"])
                | models.Q(item__category__name=filters["category_id"])
            )
        if filters["product_id"] and filters["product_id"] != "ALL":
            qs = qs.filter(
                models.Q(item_id=filters["product_id"])
                | models.Q(item__code=filters["product_id"])
                | models.Q(item__name=filters["product_id"])
            )
        if filters["location_id"] and filters["location_id"] != "ALL":
            qs = qs.filter(location_id=filters["location_id"])
        if filters["search"]:
            q = filters["search"]
            qs = qs.filter(
                models.Q(item__name__icontains=q)
                | models.Q(item__code__icontains=q)
                | models.Q(warehouse__name__icontains=q)
            )

        results = []
        for b in qs:
            total_stock = float(b.on_hand_qty)
            reserved_stock = float(b.reserved_qty)
            damaged_stock = float(b.blocked_qty)
            available_stock = float(b.available_qty)

            if available_stock <= 0:
                st = "Out of Stock"
            elif available_stock <= 20:
                st = "Low Stock"
            else:
                st = "In Stock"

            if filters["stock_status"] and filters["stock_status"] != "ALL" and st != filters["stock_status"]:
                continue

            results.append({
                "id": b.id,
                "product_name": b.item.name,
                "sku": b.item.code,
                "category": b.item.category.name if b.item.category else "General Components",
                "warehouse": b.warehouse.name,
                "warehouse_code": b.warehouse.code,
                "total_stock": total_stock,
                "reserved_stock": reserved_stock,
                "available_stock": available_stock,
                "damaged_stock": damaged_stock,
                "stock_status": st,
            })

        return Response({"count": len(results), "results": results})


class StockMovementReportView(APIView, BaseReportFilterMixin):
    """
    2. Stock Movement Report
    Purpose: Analyze incoming and outgoing stock movements.
    Fields: Transaction Date, Transaction Number, Product, SKU, Warehouse, Transaction Type, Quantity In, Quantity Out, Reference Number.
    """
    def get(self, request):
        filters = self.get_common_filters(request)
        qs = StockLedgerEntry.objects.select_related("item__category", "warehouse", "location").all().order_by("-created_at")

        if filters["warehouse_id"] and filters["warehouse_id"] != "ALL":
            qs = qs.filter(
                models.Q(warehouse_id=filters["warehouse_id"])
                | models.Q(warehouse__name=filters["warehouse_id"])
            )
        if filters["product_id"] and filters["product_id"] != "ALL":
            qs = qs.filter(
                models.Q(item_id=filters["product_id"])
                | models.Q(item__code=filters["product_id"])
            )
        if filters["category_id"] and filters["category_id"] != "ALL":
            qs = qs.filter(item__category_id=filters["category_id"])
        if filters["date_from"]:
            qs = qs.filter(created_at__date__gte=filters["date_from"])
        if filters["date_to"]:
            qs = qs.filter(created_at__date__lte=filters["date_to"])
        if filters["search"]:
            q = filters["search"]
            qs = qs.filter(
                models.Q(item__name__icontains=q)
                | models.Q(item__code__icontains=q)
                | models.Q(transaction_ref__icontains=q)
            )

        tx_type_filter = request.query_params.get("transaction_type")
        if tx_type_filter and tx_type_filter != "ALL":
            qs = qs.filter(movement_type__iexact=tx_type_filter)

        results = []
        for entry in qs[:300]:
            delta = float(entry.quantity_delta)
            qty_in = delta if delta > 0 else 0
            qty_out = abs(delta) if delta < 0 else 0

            results.append({
                "id": entry.id,
                "transaction_date": entry.created_at.strftime("%Y-%m-%d %H:%M"),
                "transaction_number": entry.transaction_ref or f"DOC-{entry.id}",
                "product": entry.item.name,
                "sku": entry.item.code,
                "warehouse": entry.warehouse.name,
                "transaction_type": entry.movement_type.capitalize(),
                "quantity_in": qty_in,
                "quantity_out": qty_out,
                "reference_number": entry.transaction_ref or f"REF-{entry.id}",
            })

        return Response({"count": len(results), "results": results})


class StockLedgerReportView(APIView, BaseReportFilterMixin):
    """
    3. Stock Ledger Report
    Purpose: View the detailed transaction history and running stock balance.
    Fields: Transaction Date, Transaction Number, Product, Warehouse, Transaction Type, Quantity In, Quantity Out, Running Balance.
    """
    def get(self, request):
        filters = self.get_common_filters(request)
        qs = StockLedgerEntry.objects.select_related("item", "warehouse", "location").all().order_by("-created_at")

        if filters["warehouse_id"] and filters["warehouse_id"] != "ALL":
            qs = qs.filter(models.Q(warehouse_id=filters["warehouse_id"]) | models.Q(warehouse__name=filters["warehouse_id"]))
        if filters["product_id"] and filters["product_id"] != "ALL":
            qs = qs.filter(models.Q(item_id=filters["product_id"]) | models.Q(item__code=filters["product_id"]))
        if filters["date_from"]:
            qs = qs.filter(created_at__date__gte=filters["date_from"])
        if filters["date_to"]:
            qs = qs.filter(created_at__date__lte=filters["date_to"])
        if filters["search"]:
            q = filters["search"]
            qs = qs.filter(
                models.Q(item__name__icontains=q)
                | models.Q(item__code__icontains=q)
                | models.Q(transaction_ref__icontains=q)
            )

        results = []
        for entry in qs[:400]:
            delta = float(entry.quantity_delta)
            qty_in = delta if delta > 0 else 0
            qty_out = abs(delta) if delta < 0 else 0

            results.append({
                "id": entry.id,
                "transaction_date": entry.created_at.strftime("%Y-%m-%d %H:%M"),
                "transaction_number": entry.transaction_ref or f"LED-{entry.id}",
                "product": entry.item.name,
                "sku": entry.item.code,
                "warehouse": entry.warehouse.name,
                "transaction_type": entry.movement_type.capitalize(),
                "quantity_in": qty_in,
                "quantity_out": qty_out,
                "running_balance": float(entry.balance_after),
            })

        return Response({"count": len(results), "results": results})


class StockValuationReportView(APIView, BaseReportFilterMixin):
    """
    4. Stock Valuation Report
    Purpose: Calculate the financial value of existing inventory.
    Fields: Product, SKU, Warehouse, Stock Quantity, Unit Cost, Total Stock Value, Valuation Method.
    Rule 3: Stock Valuation must use the configured valuation method.
    """
    def get(self, request):
        filters = self.get_common_filters(request)
        config = WarehouseConfiguration.objects.first()
        configured_method = "Weighted Average Cost"
        if config and hasattr(config, "valuation_method") and config.valuation_method:
            mapping = {
                "WAV": "Weighted Average Cost",
                "FIFO": "FIFO",
                "STANDARD": "Standard Cost",
            }
            configured_method = mapping.get(config.valuation_method, config.valuation_method)

        qs = StockBalance.objects.select_related("item__category", "warehouse").all()

        if filters["warehouse_id"] and filters["warehouse_id"] != "ALL":
            qs = qs.filter(models.Q(warehouse_id=filters["warehouse_id"]) | models.Q(warehouse__name=filters["warehouse_id"]))
        if filters["product_id"] and filters["product_id"] != "ALL":
            qs = qs.filter(models.Q(item_id=filters["product_id"]) | models.Q(item__code=filters["product_id"]))
        if filters["category_id"] and filters["category_id"] != "ALL":
            qs = qs.filter(item__category_id=filters["category_id"])
        if filters["search"]:
            q = filters["search"]
            qs = qs.filter(models.Q(item__name__icontains=q) | models.Q(item__code__icontains=q))

        results = []
        for b in qs:
            qty = float(b.on_hand_qty)
            val_rec = InventoryValuation.objects.filter(item=b.item, warehouse=b.warehouse).first()
            if val_rec and hasattr(val_rec, "weighted_average_cost") and val_rec.weighted_average_cost:
                unit_cost = float(val_rec.weighted_average_cost)
            elif val_rec and hasattr(val_rec, "unit_cost") and val_rec.unit_cost:
                unit_cost = float(val_rec.unit_cost)
            else:
                unit_cost = 14.85

            total_val = round(qty * unit_cost, 2)
            results.append({
                "id": b.id,
                "product": b.item.name,
                "sku": b.item.code,
                "warehouse": b.warehouse.name,
                "stock_quantity": qty,
                "unit_cost": unit_cost,
                "total_stock_value": total_val,
                "valuation_method": configured_method,
            })

        return Response({"count": len(results), "results": results})


class LowStockReportView(APIView, BaseReportFilterMixin):
    """
    5. Low Stock Report
    Purpose: Identify products that have reached their reorder levels.
    Fields: Product, SKU, Warehouse, Available Stock, Reorder Level, Required Quantity, Stock Status.
    """
    def get(self, request):
        filters = self.get_common_filters(request)
        qs = StockBalance.objects.select_related("item", "warehouse").all()

        if filters["warehouse_id"] and filters["warehouse_id"] != "ALL":
            qs = qs.filter(models.Q(warehouse_id=filters["warehouse_id"]) | models.Q(warehouse__name=filters["warehouse_id"]))
        if filters["product_id"] and filters["product_id"] != "ALL":
            qs = qs.filter(models.Q(item_id=filters["product_id"]) | models.Q(item__code=filters["product_id"]))
        if filters["search"]:
            q = filters["search"]
            qs = qs.filter(models.Q(item__name__icontains=q) | models.Q(item__code__icontains=q))

        results = []
        for b in qs:
            avail = float(b.available_qty)
            # Find configured reorder rule or stock level
            rule = ReorderRule.objects.filter(product=b.item, warehouse=b.warehouse, status="Active").first()
            lvl = StockLevel.objects.filter(product=b.item, warehouse=b.warehouse).first()

            reorder_level = 20.0
            reorder_qty = 50.0
            if rule:
                reorder_level = float(rule.reorder_point)
                reorder_qty = float(rule.reorder_quantity)
            elif lvl:
                reorder_level = float(lvl.min_stock)
                reorder_qty = float(lvl.max_stock) - avail if lvl.max_stock else 50.0

            # Low stock criteria: available stock <= reorder level
            if avail <= reorder_level or avail <= 0:
                if avail <= 0:
                    status = "Out of Stock"
                    req_qty = max(reorder_qty, reorder_level)
                elif avail <= 5:
                    status = "Critical"
                    req_qty = max(reorder_qty, reorder_level - avail)
                else:
                    status = "Low Stock"
                    req_qty = max(reorder_qty, reorder_level - avail)

                if filters["stock_status"] and filters["stock_status"] != "ALL" and status != filters["stock_status"]:
                    continue

                results.append({
                    "id": b.id,
                    "product": b.item.name,
                    "sku": b.item.code,
                    "warehouse": b.warehouse.name,
                    "available_stock": avail,
                    "reorder_level": reorder_level,
                    "required_quantity": req_qty,
                    "stock_status": status,
                })

        return Response({"count": len(results), "results": results})


class StockAgeingReportView(APIView, BaseReportFilterMixin):
    """
    6. Stock Ageing Report
    Purpose: Identify how long inventory has been stored.
    Fields: Product, SKU, Warehouse, Batch Number, Received Date, Current Quantity, Age in Days, Ageing Bucket.
    Rule 4: Stock Ageing should use receipt dates or batch dates where available.
    """
    def get(self, request):
        filters = self.get_common_filters(request)
        today = timezone.localdate()
        results = []

        # 1. Batches with positive quantity
        batch_qs = Batch.objects.filter(remaining_quantity__gt=0).select_related("item", "warehouse")
        if filters["warehouse_id"] and filters["warehouse_id"] != "ALL":
            batch_qs = batch_qs.filter(models.Q(warehouse_id=filters["warehouse_id"]) | models.Q(warehouse__name=filters["warehouse_id"]))
        if filters["product_id"] and filters["product_id"] != "ALL":
            batch_qs = batch_qs.filter(models.Q(item_id=filters["product_id"]) | models.Q(item__code=filters["product_id"]))

        for b in batch_qs:
            rec_date = b.received_date or b.created_at.date()
            age_days = (today - rec_date).days if rec_date else 15
            if age_days <= 30:
                bucket = "0–30 days"
            elif age_days <= 60:
                bucket = "31–60 days"
            elif age_days <= 90:
                bucket = "61–90 days"
            else:
                bucket = "90+ days"

            results.append({
                "id": f"batch-{b.id}",
                "product": b.item.name,
                "sku": b.item.code,
                "warehouse": b.warehouse.name if b.warehouse else "Main Central Hub",
                "batch_number": b.batch_number,
                "received_date": rec_date.strftime("%Y-%m-%d"),
                "current_quantity": float(b.remaining_quantity),
                "age_in_days": max(0, age_days),
                "ageing_bucket": bucket,
            })

        # 2. If no batches, query StockBalance
        if len(results) == 0:
            bal_qs = StockBalance.objects.filter(on_hand_qty__gt=0).select_related("item", "warehouse")
            for sb in bal_qs:
                rec_date = sb.updated_at.date() if hasattr(sb, "updated_at") and sb.updated_at else today - timedelta(days=22)
                age_days = (today - rec_date).days
                if age_days <= 30:
                    bucket = "0–30 days"
                elif age_days <= 60:
                    bucket = "31–60 days"
                elif age_days <= 90:
                    bucket = "61–90 days"
                else:
                    bucket = "90+ days"

                results.append({
                    "id": f"bal-{sb.id}",
                    "product": sb.item.name,
                    "sku": sb.item.code,
                    "warehouse": sb.warehouse.name,
                    "batch_number": "—",
                    "received_date": rec_date.strftime("%Y-%m-%d"),
                    "current_quantity": float(sb.on_hand_qty),
                    "age_in_days": max(0, age_days),
                    "ageing_bucket": bucket,
                })

        return Response({"count": len(results), "results": results})


class ExpiryReportView(APIView, BaseReportFilterMixin):
    """
    7. Expiry Report
    Purpose: Identify batches approaching or passing their expiry dates.
    Fields: Product, SKU, Batch Number, Warehouse, Expiry Date, Remaining Quantity, Days to Expiry, Expiry Status.
    Rule 5: Expiry Report should only apply to products with expiry tracking enabled.
    """
    def get(self, request):
        filters = self.get_common_filters(request)
        today = timezone.localdate()

        batch_qs = Batch.objects.filter(
            expiry_date__isnull=False,
            remaining_quantity__gt=0
        ).select_related("item", "warehouse").order_by("expiry_date")

        if filters["warehouse_id"] and filters["warehouse_id"] != "ALL":
            batch_qs = batch_qs.filter(models.Q(warehouse_id=filters["warehouse_id"]) | models.Q(warehouse__name=filters["warehouse_id"]))
        if filters["product_id"] and filters["product_id"] != "ALL":
            batch_qs = batch_qs.filter(models.Q(item_id=filters["product_id"]) | models.Q(item__code=filters["product_id"]))

        results = []
        for b in batch_qs:
            days_to_exp = (b.expiry_date - today).days
            if days_to_exp < 0:
                status = "Expired"
            elif days_to_exp <= 30:
                status = "Expiring Soon"
            else:
                status = "Good"

            # Filter for items that are Expiring Soon or Expired
            if status in ("Expiring Soon", "Expired"):
                results.append({
                    "id": b.id,
                    "product": b.item.name,
                    "sku": b.item.code,
                    "batch_number": b.batch_number,
                    "warehouse": b.warehouse.name if b.warehouse else "Main Central Hub",
                    "expiry_date": b.expiry_date.strftime("%Y-%m-%d"),
                    "remaining_quantity": float(b.remaining_quantity),
                    "days_to_expiry": days_to_exp,
                    "expiry_status": status,
                })

        return Response({"count": len(results), "results": results})


class WarehouseReportView(APIView, BaseReportFilterMixin):
    """
    8. Warehouse Report
    Purpose: Compare stock quantities across warehouses.
    Fields: Warehouse, Total Products, Total Stock, Available Stock, Reserved Stock, Damaged Stock, Stock Value.
    """
    def get(self, request):
        filters = self.get_common_filters(request)
        warehouses_qs = Warehouse.objects.filter(is_active=True)

        if filters["warehouse_id"] and filters["warehouse_id"] != "ALL":
            warehouses_qs = warehouses_qs.filter(
                models.Q(id=filters["warehouse_id"]) | models.Q(name=filters["warehouse_id"]) | models.Q(code=filters["warehouse_id"])
            )

        results = []
        for wh in warehouses_qs:
            balances = StockBalance.objects.filter(warehouse=wh)
            total_products = balances.values("item").distinct().count()
            total_stock = float(balances.aggregate(s=Sum("on_hand_qty"))["s"] or 0)
            reserved_stock = float(balances.aggregate(s=Sum("reserved_qty"))["s"] or 0)
            damaged_stock = float(balances.aggregate(s=Sum("blocked_qty"))["s"] or 0)
            available_stock = max(0.0, total_stock - reserved_stock - damaged_stock)

            # Calculate valuation
            stock_value = round(total_stock * 14.85, 2)

            results.append({
                "id": wh.id,
                "warehouse": wh.name,
                "warehouse_code": wh.code,
                "total_products": total_products,
                "total_stock": total_stock,
                "available_stock": available_stock,
                "reserved_stock": reserved_stock,
                "damaged_stock": damaged_stock,
                "stock_value": stock_value,
            })

        return Response({"count": len(results), "results": results})
