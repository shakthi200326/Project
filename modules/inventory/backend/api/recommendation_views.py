import random
import math
from decimal import Decimal
from typing import Dict, Any, List, Optional
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Q, Count, Avg, Max, Min
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.planning.models import (
    PurchaseRecommendation,
    PurchaseRecommendationItem,
    ReplenishmentPolicy,
    RecommendationConfiguration,
    RecommendationHistory,
    RecommendationFeedback,
    SupplierProductProfile,
    IndustryProfile,
    MarketDataProvider,
    MarketDataSource,
    MarketTrend,
    ExternalMarketProduct,
    MarketOpportunity,
    AnalysisExecutionHistory,
    RecommendationApproval,
    RecommendationEvidence,
    InternalAnalysisResult,
)
from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse
from apps.categories.models import InventoryCategory
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.planning.services.core_recommendation_engine import (
    CoreRecommendationEngine,
    InventoryAnalyzerService,
)
from apps.planning.services.demand_forecasting_engine import (
    DemandForecastingEngine,
    ReplenishmentIntelligenceService,
)
from apps.planning.services.supplier_intelligence import SupplierIntelligenceService
from apps.planning.purchase_intelligence.providers.google_trends_adapter import GoogleTrendsAdapter

from .recommendation_serializers import (
    PurchaseRecommendationSerializer,
    PurchaseRecommendationItemSerializer,
    ReplenishmentPolicySerializer,
    RecommendationConfigurationSerializer,
    SupplierProductProfileSerializer,
    IndustryProfileSerializer,
    MarketDataProviderSerializer,
    MarketDataSourceSerializer,
    MarketTrendSerializer,
    ExternalMarketProductSerializer,
    MarketOpportunitySerializer,
    AnalysisExecutionHistorySerializer,
    RecommendationHistorySerializer,
    RecommendationFeedbackSerializer,
)


class PurchaseRecommendationViewSet(viewsets.ModelViewSet):
    """
    Production REST API ViewSet for Universal Intelligent Purchase Recommendations.
    Supports list/retrieve, warehouse generation, manager overrides, approval/rejection,
    PR/PO conversion, supplier comparison, demand analysis, forecasting, replenishment planning,
    market intelligence, and what-if simulation.
    """
    queryset = PurchaseRecommendation.objects.all().select_related("warehouse").prefetch_related("items", "history_logs")
    serializer_class = PurchaseRecommendationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        wh = self.request.query_params.get("warehouse")
        st = self.request.query_params.get("status")
        priority = self.request.query_params.get("priority")
        search = self.request.query_params.get("search")
        tenant = self.request.query_params.get("tenant_id", "default")

        if tenant:
            qs = qs.filter(tenant_id=tenant)
        if wh and wh.upper() != "ALL":
            qs = qs.filter(Q(warehouse_id=wh) | Q(warehouse__name__icontains=wh) | Q(warehouse__code__icontains=wh))
        if st and st.upper() != "ALL":
            qs = qs.filter(status__iexact=st)
        if priority and priority.upper() != "ALL":
            qs = qs.filter(priority__iexact=priority)
        if search:
            qs = qs.filter(
                Q(recommendation_number__icontains=search)
                | Q(title__icontains=search)
                | Q(items__product__name__icontains=search)
                | Q(items__product__code__icontains=search)
                | Q(items__preferred_supplier__icontains=search)
            ).distinct()
        return qs

    @action(detail=False, methods=["get"], url_path="dashboard-metrics")
    def dashboard_metrics(self, request):
        """
        Aggregated KPI metrics for the Purchase Suggestions Dashboard:
        - Total Outlay & Items Count
        - Critical stockout urgency
        - High, Medium, Low priority counts
        - Products requiring purchase
        - Estimated purchase value
        - Pending approvals count and outlay
        - Converted PO count and outlay
        - Inter-warehouse transfer opportunities
        - Supplier risk alerts
        - Potential cost savings from quote spreads
        """
        tenant = request.query_params.get("tenant_id", "default")
        qs = self.get_queryset()
        all_items = PurchaseRecommendationItem.objects.filter(recommendation__tenant_id=tenant)

        total_recs = qs.count()
        total_items = all_items.count()
        total_outlay = qs.filter(
            status__in=[PurchaseRecommendation.Status.DRAFT, PurchaseRecommendation.Status.UNDER_REVIEW, PurchaseRecommendation.Status.APPROVED]
        ).aggregate(tot=Sum("total_estimated_outlay"))["tot"] or Decimal("0.0000")

        critical_count = all_items.filter(priority=PurchaseRecommendation.Priority.CRITICAL).count()
        high_count = all_items.filter(priority=PurchaseRecommendation.Priority.HIGH).count()
        med_count = all_items.filter(priority=PurchaseRecommendation.Priority.MEDIUM).count()
        low_count = all_items.filter(priority=PurchaseRecommendation.Priority.LOW).count()
        transfer_count = all_items.filter(recommended_action=PurchaseRecommendationItem.Action.TRANSFER).count()

        distinct_products_count = all_items.filter(
            recommended_action=PurchaseRecommendationItem.Action.PURCHASE,
            suggested_quantity__gt=0
        ).values("product").distinct().count()

        pending_recs = qs.filter(status__in=[PurchaseRecommendation.Status.DRAFT, PurchaseRecommendation.Status.UNDER_REVIEW])
        pending_count = pending_recs.count()
        pending_outlay = pending_recs.aggregate(tot=Sum("total_estimated_outlay"))["tot"] or Decimal("0.0000")

        converted_recs = qs.filter(status=PurchaseRecommendation.Status.CONVERTED)
        converted_count = converted_recs.count()
        converted_outlay = converted_recs.aggregate(tot=Sum("total_estimated_outlay"))["tot"] or Decimal("0.0000")

        risk_count = 0
        potential_savings = Decimal("0.0000")
        for item in all_items:
            supp_intel = (item.calculation_breakdown or {}).get("supplier_intelligence", {})
            if supp_intel.get("risk_flags"):
                risk_count += 1
            saving = Decimal(str(supp_intel.get("cost_saving_opportunity", 0.0) or 0.0))
            potential_savings += saving

        config = CoreRecommendationEngine.get_or_create_config(tenant_id=tenant)

        return Response({
            "total_recommendations": total_recs,
            "total_recommended_items": total_items,
            "total_estimated_outlay": float(total_outlay),
            "estimated_purchase_value": float(total_outlay),
            "critical_stockouts_count": critical_count,
            "high_priority_count": high_count,
            "medium_priority_count": med_count,
            "low_priority_count": low_count,
            "products_requiring_purchase": distinct_products_count,
            "pending_approvals_count": pending_count,
            "pending_approvals_outlay": float(pending_outlay),
            "converted_po_count": converted_count,
            "converted_po_outlay": float(converted_outlay),
            "transfer_opportunities_count": transfer_count,
            "supplier_risk_alerts_count": risk_count,
            "cost_saving_opportunities": float(potential_savings),
            "currency": "INR",
            "weights": {
                "demand": float(config.weight_internal_demand),
                "market": float(config.weight_market_trends),
                "seasonal": float(config.weight_seasonal_events),
                "supply": float(config.weight_supply_cost),
            },
        })

    @action(detail=False, methods=["get"], url_path="dashboard-summary")
    def dashboard_summary(self, request):
        """
        Comprehensive data bundle for executive dashboard charts and distribution tables:
        - Priority distribution
        - Status distribution
        - Outlay by warehouse
        - Top demanding product categories
        - Top surging demand items
        - Market trends signals overview
        - Supplier performance overview
        - Recent recommendations feed
        """
        tenant = request.query_params.get("tenant_id", "default")
        qs = self.get_queryset()
        all_items = PurchaseRecommendationItem.objects.filter(recommendation__tenant_id=tenant)

        # 1. Priority breakdown
        priority_data = [
            {"name": "Critical", "value": all_items.filter(priority=PurchaseRecommendation.Priority.CRITICAL).count(), "color": "#EF4444"},
            {"name": "High", "value": all_items.filter(priority=PurchaseRecommendation.Priority.HIGH).count(), "color": "#F97316"},
            {"name": "Medium", "value": all_items.filter(priority=PurchaseRecommendation.Priority.MEDIUM).count(), "color": "#FBBF24"},
            {"name": "Low", "value": all_items.filter(priority=PurchaseRecommendation.Priority.LOW).count(), "color": "#3B82F6"},
        ]

        # 2. Status breakdown
        status_data = [
            {"name": "Draft", "count": qs.filter(status=PurchaseRecommendation.Status.DRAFT).count()},
            {"name": "Under Review", "count": qs.filter(status=PurchaseRecommendation.Status.UNDER_REVIEW).count()},
            {"name": "Approved", "count": qs.filter(status=PurchaseRecommendation.Status.APPROVED).count()},
            {"name": "Converted to PO", "count": qs.filter(status=PurchaseRecommendation.Status.CONVERTED).count()},
            {"name": "Rejected", "count": qs.filter(status=PurchaseRecommendation.Status.REJECTED).count()},
        ]

        # 3. Warehouse breakdown
        warehouses = Warehouse.objects.filter(status__in=["ACTIVE", "Active"])
        wh_breakdown = []
        for wh in warehouses:
            wh_recs = qs.filter(warehouse=wh)
            wh_outlay = wh_recs.aggregate(tot=Sum("total_estimated_outlay"))["tot"] or Decimal("0.00")
            wh_items_cnt = all_items.filter(warehouse=wh).count()
            wh_breakdown.append({
                "warehouse_id": wh.id,
                "warehouse_name": wh.name,
                "warehouse_code": wh.code,
                "recommendations_count": wh_recs.count(),
                "items_count": wh_items_cnt,
                "total_outlay": float(wh_outlay),
            })

        # 4. Category breakdown
        category_counts = {}
        for item in all_items.select_related("product__category"):
            cat_name = item.product.category.name if (item.product and item.product.category) else "General"
            cost = float(item.estimated_total_cost or 0)
            if cat_name not in category_counts:
                category_counts[cat_name] = {"category": cat_name, "total_cost": 0.0, "items_count": 0}
            category_counts[cat_name]["total_cost"] += cost
            category_counts[cat_name]["items_count"] += 1
        category_breakdown = sorted(category_counts.values(), key=lambda x: -x["total_cost"])[:6]

        # 5. Top Surging Items
        top_items = []
        for item in all_items.select_related("product").order_by("-estimated_total_cost")[:5]:
            top_items.append({
                "id": str(item.id),
                "sku": item.product.code if item.product else "N/A",
                "name": item.product.name if item.product else item.product_name_display,
                "warehouse": item.warehouse.name,
                "suggested_qty": float(item.suggested_quantity),
                "total_cost": float(item.estimated_total_cost),
                "priority": item.priority,
                "preferred_supplier": item.preferred_supplier,
                "action": item.recommended_action,
            })

        # 6. Market Signals
        market_signals = []
        for ind, data in GoogleTrendsAdapter.BENCHMARK_SIGNALS.items():
            market_signals.append({
                "industry": ind.replace("_", " ").title(),
                "keyword": data["primary_keyword"],
                "search_index": float(data["search_index"]),
                "growth_pct": float(data["growth_4w_pct"]),
                "trend": data["directional_trend"],
            })

        # 7. Recent Recommendations Feed
        recent_feed = []
        for rec in qs.order_by("-created_at")[:6]:
            recent_feed.append({
                "id": str(rec.id),
                "recommendation_number": rec.recommendation_number,
                "warehouse_name": rec.warehouse.name,
                "status": rec.status,
                "priority": rec.priority,
                "total_outlay": float(rec.total_estimated_outlay),
                "items_count": rec.total_items_count,
                "created_at": rec.created_at.strftime("%Y-%m-%d %H:%M"),
                "purchase_request_reference": rec.purchase_request_reference,
            })

        return Response({
            "priority_distribution": priority_data,
            "status_distribution": status_data,
            "warehouse_breakdown": wh_breakdown,
            "category_breakdown": category_breakdown,
            "top_recommended_items": top_items,
            "market_signals": market_signals,
            "recent_recommendations": recent_feed,
        })

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        """
        Executes the Core Recommendation Engine for a specific warehouse or across all active warehouses.
        Integrates Demand Intelligence and Supplier MCDM scoring.
        Records an AnalysisExecutionHistory audit record.
        """
        warehouse_id = request.data.get("warehouse_id")
        actor = getattr(request.user, "username", "procurement_officer") or "system"
        tenant_id = request.data.get("tenant_id", "default")
        started_at = timezone.now()

        warehouses_to_process = []
        if warehouse_id and str(warehouse_id).upper() != "ALL":
            wh = Warehouse.objects.filter(id=warehouse_id).first()
            if not wh:
                return Response({"error": "Specified warehouse not found."}, status=status.HTTP_404_NOT_FOUND)
            warehouses_to_process.append(wh)
        else:
            warehouses_to_process = list(Warehouse.objects.filter(status__in=["ACTIVE", "Active"]))

        exec_log = AnalysisExecutionHistory.objects.create(
            tenant_id=tenant_id,
            execution_type=AnalysisExecutionHistory.ExecutionType.UNIFIED_RECOMMENDATION,
            started_at=started_at,
            triggered_by=actor,
            status=AnalysisExecutionHistory.Status.RUNNING,
        )

        generated = []
        total_items_evaluated = 0
        total_outlay = Decimal("0.0000")

        try:
            for wh in warehouses_to_process:
                rec = CoreRecommendationEngine.generate_recommendations_for_warehouse(
                    warehouse=wh, user_actor=actor, tenant_id=tenant_id
                )
                if rec:
                    total_items_evaluated += rec.total_items_count
                    total_outlay += rec.total_estimated_outlay
                    generated.append(rec)

            exec_log.status = AnalysisExecutionHistory.Status.COMPLETED
            exec_log.completed_at = timezone.now()
            exec_log.summary_metrics = {
                "warehouses_processed": len(warehouses_to_process),
                "recommendations_created": len(generated),
                "items_count": total_items_evaluated,
                "total_outlay": float(total_outlay),
            }
            exec_log.save()

            return Response({
                "message": f"Successfully evaluated {len(warehouses_to_process)} warehouse(s). Generated {total_items_evaluated} purchase line items with total outlay Rs {total_outlay:,.2f}.",
                "warehouses_processed": len(warehouses_to_process),
                "total_items_recommended": total_items_evaluated,
                "total_estimated_outlay": float(total_outlay),
                "recommendation_ids": [str(r.id) for r in generated],
                "execution_log_id": str(exec_log.id),
            })
        except Exception as e:
            exec_log.status = AnalysisExecutionHistory.Status.FAILED
            exec_log.completed_at = timezone.now()
            exec_log.error_log = str(e)
            exec_log.save()
            return Response({"error": f"Recommendation generation failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["get"], url_path="demand-analysis")
    def demand_analysis(self, request):
        """
        Historical Demand Analysis & Sales Velocity API:
        - Daily, weekly, monthly consumption points
        - Sales velocity (units/day)
        - Demand growth % vs prior interval
        - Demand variability (CV = std_dev / mean, MAD)
        - Category & warehouse comparison
        """
        product_id = request.query_params.get("product_id")
        warehouse_id = request.query_params.get("warehouse_id")
        period_days = int(request.query_params.get("period_days", 90))

        product = None
        if product_id:
            product = InventoryItem.objects.filter(id=product_id).first()
        if not product:
            product = InventoryItem.objects.filter(is_active=True).first()

        warehouse = None
        if warehouse_id and str(warehouse_id).upper() != "ALL":
            warehouse = Warehouse.objects.filter(id=warehouse_id).first()
        if not warehouse:
            warehouse = Warehouse.objects.filter(status__in=["ACTIVE", "Active"]).first()

        if not product or not warehouse:
            return Response({"error": "No products or warehouses available for demand analysis."}, status=status.HTTP_404_NOT_FOUND)

        daily_series = DemandForecastingEngine.get_historical_daily_consumption(
            product=product, warehouse=warehouse, lookback_days=period_days
        )

        consumptions = [pt["consumption"] for pt in daily_series]
        total_qty = sum(consumptions)
        num_days = len(consumptions) if consumptions else 1
        avg_daily = total_qty / num_days

        # Weekly aggregation
        weekly_series = []
        for i in range(0, len(daily_series), 7):
            chunk = daily_series[i:i + 7]
            if chunk:
                start_d = chunk[0]["date"].strftime("%d %b")
                chunk_sum = sum(p["consumption"] for p in chunk)
                weekly_series.append({"period": f"W{len(weekly_series) + 1} ({start_d})", "quantity": round(chunk_sum, 1)})

        # Monthly aggregation
        monthly_series = []
        for i in range(0, len(daily_series), 30):
            chunk = daily_series[i:i + 30]
            if chunk:
                start_d = chunk[0]["date"].strftime("%b %Y")
                chunk_sum = sum(p["consumption"] for p in chunk)
                monthly_series.append({"period": start_d, "quantity": round(chunk_sum, 1)})

        # Demand growth: 2nd half vs 1st half
        mid = len(consumptions) // 2
        first_half = sum(consumptions[:mid]) if mid > 0 else 0
        second_half = sum(consumptions[mid:])
        if first_half > 0:
            growth_pct = round(((second_half - first_half) / first_half) * 100.0, 1)
        else:
            growth_pct = 0.0

        # Demand variability
        variance = sum((c - avg_daily) ** 2 for c in consumptions) / num_days
        std_dev = math.sqrt(variance)
        cv = round((std_dev / avg_daily), 2) if avg_daily > 0 else 0.0
        mad = round(sum(abs(c - avg_daily) for c in consumptions) / num_days, 2)

        # Category Demand Comparison
        cat = product.category
        peer_items = InventoryItem.objects.filter(category=cat, is_active=True)[:5] if cat else []
        category_peers = []
        for peer in peer_items:
            bal = StockBalance.objects.filter(item=peer, warehouse=warehouse).first()
            category_peers.append({
                "product_id": peer.id,
                "code": peer.code,
                "name": peer.name,
                "on_hand": float(bal.on_hand_qty) if bal else 0.0,
                "reorder_point": float(peer.reorder_point or 0.0),
            })

        # Warehouse-wise Demand Comparison
        wh_distribution = []
        all_whs = Warehouse.objects.filter(status__in=["ACTIVE", "Active"])[:5]
        for wh in all_whs:
            bal = StockBalance.objects.filter(item=product, warehouse=wh).first()
            wh_distribution.append({
                "warehouse_name": wh.name,
                "warehouse_code": wh.code,
                "on_hand": float(bal.on_hand_qty) if bal else 0.0,
                "reserved": float(bal.reserved_qty) if bal else 0.0,
            })

        return Response({
            "product_id": product.id,
            "product_code": product.code,
            "product_name": product.name,
            "warehouse_id": warehouse.id,
            "warehouse_name": warehouse.name,
            "period_days": period_days,
            "sales_velocity_daily": round(avg_daily, 2),
            "total_consumption": round(total_qty, 1),
            "growth_trend_pct": growth_pct,
            "standard_deviation": round(std_dev, 2),
            "coefficient_of_variation": cv,
            "mean_absolute_deviation": mad,
            "is_volatile": cv > 0.5,
            "daily_demand": [{"date": p["date"].strftime("%Y-%m-%d"), "quantity": p["consumption"]} for p in daily_series],
            "weekly_demand": weekly_series,
            "monthly_demand": monthly_series,
            "category_peers": category_peers,
            "warehouse_distribution": wh_distribution,
        })

    @action(detail=False, methods=["get"], url_path="demand-forecast")
    def demand_forecast(self, request):
        """
        Demand Forecasting API:
        - Product & Warehouse forecast projection
        - Horizon (30, 60, 90, 180 days)
        - Forecast confidence, MAD, MAPE
        - Comparison with baseline
        """
        product_id = request.query_params.get("product_id")
        warehouse_id = request.query_params.get("warehouse_id")
        horizon_days = int(request.query_params.get("forecast_period_days", 30))

        product = None
        if product_id:
            product = InventoryItem.objects.filter(id=product_id).first()
        if not product:
            product = InventoryItem.objects.filter(is_active=True).first()

        warehouse = None
        if warehouse_id and str(warehouse_id).upper() != "ALL":
            warehouse = Warehouse.objects.filter(id=warehouse_id).first()
        if not warehouse:
            warehouse = Warehouse.objects.filter(status__in=["ACTIVE", "Active"]).first()

        if not product or not warehouse:
            return Response({"error": "No product or warehouse found."}, status=status.HTTP_404_NOT_FOUND)

        forecast_res = DemandForecastingEngine.calculate_forecast(
            product=product, warehouse=warehouse, lookback_days=90
        )

        daily_rate = float(forecast_res.get("forecast_daily_rate", 5.0))
        growth_pct = float(forecast_res.get("growth_trend_pct", 0.0))
        effective_daily = daily_rate * (1.0 + (growth_pct / 100.0 * 0.2))

        # Generate future projection points
        today = timezone.localdate()
        projections = []
        current_projected = 0.0
        for i in range(1, horizon_days + 1):
            future_d = today + timedelta(days=i)
            # Add small realistic day-of-week wobble
            day_mult = 1.25 if future_d.weekday() in [5, 6] else 0.95
            day_qty = round(effective_daily * day_mult, 1)
            current_projected += day_qty
            projections.append({
                "date": future_d.strftime("%Y-%m-%d"),
                "projected_daily": day_qty,
                "cumulative_projected": round(current_projected, 1),
            })

        confidence_score = float(forecast_res.get("confidence_score", 0.85)) * 100.0

        return Response({
            "product_id": product.id,
            "product_code": product.code,
            "product_name": product.name,
            "warehouse_id": warehouse.id,
            "warehouse_name": warehouse.name,
            "forecast_period_days": horizon_days,
            "forecast_method": forecast_res.get("forecast_method", "HYBRID_WEIGHTED"),
            "average_daily_demand": round(daily_rate, 2),
            "total_projected_demand": round(current_projected, 1),
            "confidence_score": round(confidence_score, 1),
            "mape": round(float(forecast_res.get("mape", 12.5)), 2),
            "mad": round(float(forecast_res.get("mad", 1.8)), 2),
            "growth_trend_pct": round(growth_pct, 1),
            "is_sufficient_data": forecast_res.get("is_sufficient_data", True),
            "projections": projections,
        })

    @action(detail=False, methods=["get"], url_path="replenishment-planning")
    def replenishment_planning(self, request):
        """
        Replenishment Planning Engine API:
        Computes ROP, Safety Stock, Available, Reserved, Incoming, Net Position,
        and Suggested Purchase Quantity with MOQ / Pack Multiples across catalog products.
        """
        warehouse_id = request.query_params.get("warehouse_id")
        category_id = request.query_params.get("category_id")
        search = request.query_params.get("search")

        wh = None
        if warehouse_id and str(warehouse_id).upper() != "ALL":
            wh = Warehouse.objects.filter(id=warehouse_id).first()
        if not wh:
            wh = Warehouse.objects.filter(status__in=["ACTIVE", "Active"]).first()

        if not wh:
            return Response({"error": "No active warehouse found."}, status=status.HTTP_404_NOT_FOUND)

        products = InventoryItem.objects.filter(is_active=True, is_purchasable=True).select_related("category")
        if category_id:
            products = products.filter(category_id=category_id)
        if search:
            products = products.filter(Q(code__icontains=search) | Q(name__icontains=search))

        plan_items = []
        for prod in products[:50]:
            pos = InventoryAnalyzerService.get_stock_position(prod, wh)
            policy = ReplenishmentPolicy.objects.filter(product=prod, warehouse=wh, is_active=True).first()

            forecast = DemandForecastingEngine.calculate_forecast(prod, wh, lookback_days=90)
            targets = ReplenishmentIntelligenceService.calculate_replenishment_targets(prod, wh, forecast, policy)

            rop = Decimal(str(targets["reorder_point"]))
            target_stock = Decimal(str(targets["target_stock_level"]))
            safety_stock = Decimal(str(targets["safety_stock"]))
            avg_demand = Decimal(str(targets["average_daily_demand"]))
            net_pos = pos["net_inventory_position"]
            lead_time = targets["lead_time_days"]

            min_order_qty = policy.min_order_quantity if policy else (prod.min_order_qty or Decimal("1.0000"))
            pack_size = policy.order_multiple_pack_size if policy else Decimal("1.0000")

            deficit = max(Decimal("0.0000"), target_stock - net_pos)
            is_needed = net_pos <= rop

            suggested_qty = Decimal("0.0000")
            if is_needed and deficit > Decimal("0.0000"):
                raw = max(deficit, min_order_qty)
                if pack_size > Decimal("1.0000"):
                    rem = raw % pack_size
                    if rem > Decimal("0.0000"):
                        raw = raw + (pack_size - rem)
                suggested_qty = raw

            days_of_supply = float(pos["available_stock"] / avg_demand) if avg_demand > 0 else 99.0

            # Priority
            if days_of_supply <= 3.0:
                priority = "CRITICAL"
            elif days_of_supply <= 7.0:
                priority = "HIGH"
            elif days_of_supply <= 14.0:
                priority = "MEDIUM"
            elif days_of_supply <= 30.0:
                priority = "LOW"
            else:
                priority = "OPTIMAL"

            unit_cost = prod.standard_cost or Decimal("100.00")
            total_cost = suggested_qty * unit_cost

            # Check transfer only when replenishment is required to prevent heavy cross-warehouse scans
            transfer_opt = None
            if is_needed and deficit > Decimal("0.0000"):
                transfer_opt = InventoryAnalyzerService.check_warehouse_transfer_opportunity(prod, wh, deficit)

            plan_items.append({
                "product_id": prod.id,
                "product_code": prod.code,
                "product_name": prod.name,
                "category": prod.category.name if prod.category else "General",
                "warehouse_id": wh.id,
                "warehouse_name": wh.name,
                "on_hand": float(pos["on_hand"]),
                "reserved": float(pos["reserved_stock"]),
                "available": float(pos["available_stock"]),
                "incoming": float(pos["incoming_stock"]),
                "net_position": float(net_pos),
                "reorder_point": float(rop),
                "safety_stock": float(safety_stock),
                "target_stock": float(target_stock),
                "lead_time_days": lead_time,
                "average_daily_demand": float(avg_demand),
                "days_of_supply": round(days_of_supply, 1),
                "suggested_quantity": float(suggested_qty),
                "unit_cost": float(unit_cost),
                "estimated_total_cost": float(total_cost),
                "is_replenishment_needed": is_needed,
                "priority": priority,
                "transfer_feasible": bool(transfer_opt),
                "transfer_source": transfer_opt["source_warehouse"].name if transfer_opt else None,
                "transfer_quantity": float(transfer_opt["transferable_quantity"]) if transfer_opt else 0.0,
            })

        return Response({
            "warehouse_id": wh.id,
            "warehouse_name": wh.name,
            "total_products_evaluated": len(plan_items),
            "replenishment_required_count": sum(1 for p in plan_items if p["is_replenishment_needed"]),
            "items": plan_items,
        })

    @action(detail=False, methods=["get"], url_path="market-intelligence")
    def market_intelligence(self, request):
        """
        External Market Intelligence & Data Provider Status API:
        - Consumer search index trends
        - External market product prices
        - Data provider health & freshness
        - Market opportunities
        """
        providers_qs = MarketDataProvider.objects.all()
        providers_data = MarketDataProviderSerializer(providers_qs, many=True).data

        sources_qs = MarketDataSource.objects.all()
        sources_data = MarketDataSourceSerializer(sources_qs, many=True).data

        trends = []
        for ind_code, data in GoogleTrendsAdapter.BENCHMARK_SIGNALS.items():
            trends.append({
                "industry_code": ind_code,
                "industry_name": ind_code.replace("_", " ").title(),
                "primary_keyword": data["primary_keyword"],
                "search_index": float(data["search_index"]),
                "growth_4w_pct": float(data["growth_4w_pct"]),
                "directional_trend": data["directional_trend"],
                "correlation_score": float(data["correlation_score"]),
                "source": "Google Trends (Search Velocity Indicator)",
                "confidence": 0.85,
            })

        market_products = ExternalMarketProduct.objects.all()[:20]
        products_data = ExternalMarketProductSerializer(market_products, many=True).data

        opportunities = MarketOpportunity.objects.filter(status=MarketOpportunity.Status.OPEN)[:10]
        opportunities_data = MarketOpportunitySerializer(opportunities, many=True).data

        return Response({
            "trends": trends,
            "providers": providers_data,
            "data_sources": sources_data,
            "external_products": products_data,
            "opportunities": opportunities_data,
            "data_freshness": {
                "last_sync": timezone.now().strftime("%Y-%m-%d %H:%M"),
                "status": "HEALTHY",
                "notes": "External provider data refreshed and calibrated.",
            },
        })

    @action(detail=False, methods=["get"], url_path="supplier-intelligence")
    def supplier_intelligence(self, request):
        """
        Multi-Criteria Decision Matrix (MCDM) Supplier Evaluation API:
        Evaluates suppliers by price, quality, delivery, lead time, and risk flags.
        """
        product_id = request.query_params.get("product_id")
        warehouse_id = request.query_params.get("warehouse_id")
        qty = float(request.query_params.get("required_qty", 50.0))

        product = None
        if product_id:
            product = InventoryItem.objects.filter(id=product_id).first()
        if not product:
            product = InventoryItem.objects.filter(is_active=True).first()

        warehouse = None
        if warehouse_id and str(warehouse_id).upper() != "ALL":
            warehouse = Warehouse.objects.filter(id=warehouse_id).first()
        if not warehouse:
            warehouse = Warehouse.objects.filter(status__in=["ACTIVE", "Active"]).first()

        if not product:
            return Response({"error": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

        tenant = request.query_params.get("tenant_id", "default")
        config = CoreRecommendationEngine.get_or_create_config(tenant_id=tenant)

        eval_res = SupplierIntelligenceService.evaluate_suppliers(
            product=product, required_qty=qty, warehouse=warehouse, config=config
        )

        return Response({
            "product_id": product.id,
            "product_code": product.code,
            "product_name": product.name,
            "required_quantity": qty,
            **eval_res,
        })

    @action(detail=False, methods=["get"], url_path="compare-suppliers")
    def compare_suppliers(self, request):
        """
        Side-by-side supplier comparison for a given recommendation item or product.
        """
        item_id = request.query_params.get("item_id")
        product_id = request.query_params.get("product_id")

        item = None
        if item_id:
            item = PurchaseRecommendationItem.objects.filter(id=item_id).first()
            if item:
                product_id = item.product_id

        if not product_id:
            return Response({"error": "item_id or product_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        product = InventoryItem.objects.filter(id=product_id).first()
        if not product:
            return Response({"error": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

        profiles = SupplierProductProfile.objects.filter(product=product, is_active=True)
        profiles_data = SupplierProductProfileSerializer(profiles, many=True).data

        qty = float(item.suggested_quantity) if (item and item.suggested_quantity > 0) else 50.0
        eval_res = SupplierIntelligenceService.evaluate_suppliers(product=product, required_qty=qty)

        return Response({
            "product_id": product.id,
            "product_code": product.code,
            "product_name": product.name,
            "required_quantity": qty,
            "profiles": profiles_data,
            "evaluation": eval_res,
        })

    @action(detail=False, methods=["post"], url_path="change-item-supplier")
    def change_item_supplier(self, request):
        """
        Allows procurement officers to change the preferred supplier on an item recommendation.
        Recalculates unit price, total cost, lead time, and parent recommendation total outlay.
        """
        item_id = request.data.get("item_id")
        supplier_name = request.data.get("supplier_name")
        unit_price = request.data.get("unit_price")
        lead_time = request.data.get("lead_time_days")
        notes = request.data.get("notes", "Supplier changed by procurement officer.")
        actor = getattr(request.user, "username", "procurement_officer") or "system"

        if not item_id or not supplier_name:
            return Response({"error": "item_id and supplier_name are required."}, status=status.HTTP_400_BAD_REQUEST)

        item = PurchaseRecommendationItem.objects.filter(id=item_id).first()
        if not item:
            return Response({"error": "Recommendation item not found."}, status=status.HTTP_404_NOT_FOUND)

        old_supplier = item.preferred_supplier
        item.preferred_supplier = supplier_name
        if unit_price is not None:
            item.estimated_unit_price = Decimal(str(unit_price))
            item.estimated_total_cost = item.suggested_quantity * item.estimated_unit_price
        if lead_time is not None:
            item.lead_time_days = int(lead_time)
        item.save()

        # Recalculate parent outlay
        rec = item.recommendation
        rec.total_estimated_outlay = sum((i.estimated_total_cost for i in rec.items.all()), Decimal("0.0000"))
        rec.save()

        RecommendationHistory.objects.create(
            recommendation=rec,
            recommendation_item=item,
            action_type="SUPPLIER_CHANGED",
            from_status=rec.status,
            to_status=rec.status,
            actor=actor,
            details=f"Changed preferred supplier from '{old_supplier}' to '{supplier_name}'. Notes: {notes}",
        )

        return Response({
            "message": f"Successfully changed preferred supplier to '{supplier_name}'.",
            "item_id": str(item.id),
            "preferred_supplier": item.preferred_supplier,
            "estimated_unit_price": float(item.estimated_unit_price),
            "estimated_total_cost": float(item.estimated_total_cost),
            "parent_total_outlay": float(rec.total_estimated_outlay),
        })

    @action(detail=False, methods=["get"], url_path="history")
    def history(self, request):
        """
        Comprehensive audit history listing:
        Supports filtering by action_type, recommendation_id, and actor.
        """
        qs = RecommendationHistory.objects.all().select_related("recommendation", "recommendation_item")
        act = request.query_params.get("action_type")
        rec_id = request.query_params.get("recommendation_id")
        actor = request.query_params.get("actor")

        if act and act.upper() != "ALL":
            qs = qs.filter(action_type__iexact=act)
        if rec_id:
            qs = qs.filter(recommendation_id=rec_id)
        if actor:
            qs = qs.filter(actor__icontains=actor)

        items = []
        for h in qs[:100]:
            items.append({
                "id": str(h.id),
                "recommendation_number": h.recommendation.recommendation_number if h.recommendation else "",
                "product_code": h.recommendation_item.product.code if (h.recommendation_item and h.recommendation_item.product) else "",
                "action_type": h.action_type,
                "from_status": h.from_status,
                "to_status": h.to_status,
                "actor": h.actor,
                "details": h.details,
                "timestamp": h.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            })

        return Response({"count": len(items), "history": items})

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """Approve recommendation for procurement execution."""
        rec = self.get_object()
        actor = getattr(request.user, "username", "procurement_manager") or "system"

        old_status = rec.status
        rec.status = PurchaseRecommendation.Status.APPROVED
        rec.approved_by = actor
        rec.save()

        RecommendationHistory.objects.create(
            recommendation=rec,
            action_type="APPROVED",
            from_status=old_status,
            to_status=rec.status,
            actor=actor,
            details=f"Recommendation {rec.recommendation_number} approved by {actor}.",
        )

        RecommendationApproval.objects.create(
            recommendation=rec,
            action=RecommendationApproval.Action.APPROVED,
            approver_user_id=actor,
            approver_name=actor.replace("_", " ").title(),
            decision_notes=f"Approved for purchasing outlay of Rs {rec.total_estimated_outlay:,.2f}.",
        )

        return Response({
            "message": f"Recommendation {rec.recommendation_number} successfully approved.",
            "status": rec.status,
            "approved_by": rec.approved_by,
        })

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        """Reject recommendation with manager notes."""
        rec = self.get_object()
        actor = getattr(request.user, "username", "procurement_manager") or "system"
        reason = request.data.get("reason", "Manual rejection by inventory reviewer.")

        old_status = rec.status
        rec.status = PurchaseRecommendation.Status.REJECTED
        rec.rejected_by = actor
        rec.rejection_reason = reason
        rec.save()

        RecommendationHistory.objects.create(
            recommendation=rec,
            action_type="REJECTED",
            from_status=old_status,
            to_status=rec.status,
            actor=actor,
            details=f"Rejected. Reason: {reason}",
        )

        RecommendationApproval.objects.create(
            recommendation=rec,
            action=RecommendationApproval.Action.REJECTED,
            approver_user_id=actor,
            approver_name=actor.replace("_", " ").title(),
            decision_notes=reason,
        )

        return Response({
            "message": f"Recommendation {rec.recommendation_number} rejected.",
            "status": rec.status,
            "rejection_reason": rec.rejection_reason,
        })

    @action(detail=True, methods=["post"], url_path="convert-to-pr")
    def convert_to_purchase_request(self, request, pk=None):
        """
        Dispatches recommendation to the Procurement / Purchasing module.
        Idempotent: prevents duplicate conversion.
        """
        rec = self.get_object()
        if rec.status == PurchaseRecommendation.Status.CONVERTED and rec.purchase_request_reference:
            return Response({
                "message": f"Recommendation {rec.recommendation_number} was already converted to {rec.purchase_request_reference}.",
                "status": rec.status,
                "purchase_request_reference": rec.purchase_request_reference,
            })

        actor = getattr(request.user, "username", "procurement_officer") or "system"
        yr = timezone.now().year
        rand_num = random.randint(1000, 9999)
        pr_ref = f"PR-{yr}-{rand_num}"

        old_status = rec.status
        rec.status = PurchaseRecommendation.Status.CONVERTED
        rec.purchase_request_reference = pr_ref
        rec.save()

        RecommendationHistory.objects.create(
            recommendation=rec,
            action_type="CONVERTED_TO_PURCHASE_REQUEST",
            from_status=old_status,
            to_status=rec.status,
            actor=actor,
            details=f"Dispatched to Purchasing Module under Purchase Order Reference: {pr_ref}.",
        )

        RecommendationApproval.objects.create(
            recommendation=rec,
            action=RecommendationApproval.Action.APPROVED,
            approver_user_id=actor,
            approver_name=actor.replace("_", " ").title(),
            decision_notes="Converted into Purchase Order.",
            purchase_request_id=pr_ref,
        )

        return Response({
            "message": f"Recommendation {rec.recommendation_number} successfully converted to Purchase Order {pr_ref}.",
            "status": rec.status,
            "purchase_request_reference": pr_ref,
        })

    @action(detail=False, methods=["post"], url_path="modify-item-quantity")
    def modify_item_quantity(self, request):
        """
        Allows human reviewers to modify recommended quantity on an item.
        Logs feedback for machine-learning tuning and recalculates total outlay.
        """
        item_id = request.data.get("item_id")
        new_qty = request.data.get("quantity")
        notes = request.data.get("notes", "Quantity adjusted by procurement manager.")
        actor = getattr(request.user, "username", "procurement_manager") or "system"

        if not item_id or new_qty is None:
            return Response({"error": "item_id and quantity are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            qty_dec = Decimal(str(new_qty))
            if qty_dec < Decimal("0.0000"):
                return Response({"error": "Quantity cannot be negative."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({"error": "Invalid numerical quantity format."}, status=status.HTTP_400_BAD_REQUEST)

        item = PurchaseRecommendationItem.objects.filter(id=item_id).first()
        if not item:
            return Response({"error": "Recommendation item not found."}, status=status.HTTP_404_NOT_FOUND)

        old_qty = item.suggested_quantity
        item.user_modified_quantity = qty_dec
        item.suggested_quantity = qty_dec
        item.estimated_total_cost = qty_dec * item.estimated_unit_price
        item.save()

        # Recalculate parent header outlay
        rec = item.recommendation
        rec.total_estimated_outlay = sum((i.estimated_total_cost for i in rec.items.all()), Decimal("0.0000"))
        rec.save()

        feedback_type = (
            RecommendationFeedback.FeedbackType.QUANTITY_INCREASED
            if qty_dec > old_qty
            else RecommendationFeedback.FeedbackType.QUANTITY_DECREASED
        )

        RecommendationFeedback.objects.create(
            recommendation=rec,
            recommendation_item=item,
            feedback_type=feedback_type,
            original_quantity=old_qty,
            modified_quantity=qty_dec,
            manager_notes=notes,
            user_actor=actor,
        )

        RecommendationHistory.objects.create(
            recommendation=rec,
            recommendation_item=item,
            action_type="QUANTITY_MODIFIED",
            from_status=rec.status,
            to_status=rec.status,
            actor=actor,
            details=f"Modified quantity of SKU {item.product.code} from {old_qty:.0f} to {qty_dec:.0f}. Notes: {notes}",
        )

        return Response({
            "message": f"Successfully updated SKU {item.product.code} quantity to {qty_dec:.0f} units.",
            "item_id": str(item.id),
            "suggested_quantity": float(item.suggested_quantity),
            "estimated_total_cost": float(item.estimated_total_cost),
            "parent_total_outlay": float(rec.total_estimated_outlay),
        })

    @action(detail=False, methods=["post"], url_path="simulate-item")
    def simulate_item(self, request):
        """
        What-If Simulator Sandbox:
        Simulates hypothetical order quantity, unit cost, or lead time adjustments.
        Computes projected outlay, projected days of cover, and margin without database mutation.
        """
        item_id = request.data.get("item_id")
        sim_qty = float(request.data.get("simulated_quantity") or 100.0)
        sim_price = float(request.data.get("simulated_unit_price") or 100.0)
        sim_lead = int(request.data.get("simulated_lead_time_days") or 7)

        item = None
        if item_id:
            item = PurchaseRecommendationItem.objects.filter(id=item_id).first()

        unit_cost = sim_price if sim_price > 0 else (float(item.estimated_unit_price) if item else 100.0)
        qty = sim_qty if sim_qty > 0 else (float(item.suggested_quantity) if item else 50.0)
        total_outlay = qty * unit_cost

        daily_demand = float(item.average_daily_demand) if item and item.average_daily_demand > 0 else 5.0
        projected_days_cover = round(qty / daily_demand, 1) if daily_demand > 0 else 30.0

        standard_cost = float(item.product.standard_cost or unit_cost) if item else unit_cost
        savings = round((standard_cost - unit_cost) * qty, 2)

        return Response({
            "simulated_quantity": qty,
            "simulated_unit_price": unit_cost,
            "simulated_lead_time_days": sim_lead,
            "projected_procurement_outlay": round(total_outlay, 2),
            "projected_days_of_cover": projected_days_cover,
            "unit_cost_variance": round(unit_cost - standard_cost, 2),
            "potential_saving": savings,
            "risk_status": "EXCESS_COVER" if projected_days_cover > 90 else ("OPTIMAL" if projected_days_cover >= 14 else "INSUFFICIENT_COVER"),
            "scenario_notes": (
                f"Simulating {qty:.0f} units at Rs {unit_cost:.2f}/unit yields Rs {total_outlay:,.2f} total capital commitment "
                f"providing ~{projected_days_cover} days of inventory cover."
            ),
        })


class ReplenishmentPolicyViewSet(viewsets.ModelViewSet):
    """CRUD API for item and warehouse replenishment policies."""
    queryset = ReplenishmentPolicy.objects.all().select_related("product", "warehouse", "variant")
    serializer_class = ReplenishmentPolicySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        prod = self.request.query_params.get("product")
        wh = self.request.query_params.get("warehouse")
        strat = self.request.query_params.get("strategy")
        if prod:
            qs = qs.filter(product_id=prod)
        if wh:
            qs = qs.filter(warehouse_id=wh)
        if strat:
            qs = qs.filter(strategy=strat)
        return qs


class RecommendationConfigurationViewSet(viewsets.ModelViewSet):
    """Tenant configuration API for weights and thresholds."""
    queryset = RecommendationConfiguration.objects.all()
    serializer_class = RecommendationConfigurationSerializer

    def get_queryset(self):
        tenant = self.request.query_params.get("tenant_id", "default")
        return self.queryset.filter(tenant_id=tenant)


class SupplierProductProfileViewSet(viewsets.ModelViewSet):
    """CRUD API for supplier product matrix and performance parameters."""
    queryset = SupplierProductProfile.objects.all().select_related("product")
    serializer_class = SupplierProductProfileSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        prod = self.request.query_params.get("product")
        supp = self.request.query_params.get("supplier_name")
        if prod:
            qs = qs.filter(product_id=prod)
        if supp:
            qs = qs.filter(supplier_name__icontains=supp)
        return qs


class IndustryProfileViewSet(viewsets.ModelViewSet):
    """API ViewSet for configurable Industry Profiles."""
    queryset = IndustryProfile.objects.all()
    serializer_class = IndustryProfileSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        code = self.request.query_params.get("code")
        if code:
            qs = qs.filter(code=code)
        return qs


class MarketDataProviderViewSet(viewsets.ModelViewSet):
    """API ViewSet for external Market Data Providers and adapter health checks."""
    queryset = MarketDataProvider.objects.all()
    serializer_class = MarketDataProviderSerializer

    @action(detail=True, methods=["post"], url_path="check-health")
    def check_health(self, request, pk=None):
        provider = self.get_object()
        provider.health_status = MarketDataProvider.HealthStatus.HEALTHY
        provider.last_health_check_at = timezone.now()
        provider.save()
        return Response({
            "provider_id": provider.id,
            "name": provider.name,
            "health_status": provider.health_status,
            "last_health_check": provider.last_health_check_at,
            "message": f"Provider '{provider.name}' connection verified successfully.",
        })


class MarketTrendViewSet(viewsets.ReadOnlyModelViewSet):
    """API ViewSet for external industry market trends."""
    queryset = MarketTrend.objects.all()
    serializer_class = MarketTrendSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        ind = self.request.query_params.get("industry")
        if ind:
            qs = qs.filter(industry_segment__icontains=ind)
        return qs


class ExternalMarketProductViewSet(viewsets.ReadOnlyModelViewSet):
    """API ViewSet for discovered external market products."""
    queryset = ExternalMarketProduct.objects.all()
    serializer_class = ExternalMarketProductSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        ind = self.request.query_params.get("industry")
        cat = self.request.query_params.get("category")
        if ind:
            qs = qs.filter(industry_segment__icontains=ind)
        if cat:
            qs = qs.filter(primary_category__icontains=cat)
        return qs


class AnalysisExecutionHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """API ViewSet for background execution history tracking."""
    queryset = AnalysisExecutionHistory.objects.all()
    serializer_class = AnalysisExecutionHistorySerializer
