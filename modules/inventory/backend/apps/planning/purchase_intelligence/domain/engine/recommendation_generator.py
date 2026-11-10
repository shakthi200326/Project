import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional
from datetime import timedelta
from django.utils import timezone

from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse
from apps.planning.models import (
    ReplenishmentPolicy,
    RecommendationConfiguration,
    PurchaseRecommendation,
    PurchaseRecommendationItem,
    RecommendationHistory,
)
from apps.planning.purchase_intelligence.domain.internal.position_service import PositionAnalysisService
from apps.planning.purchase_intelligence.domain.forecasting.forecasting_engine import DemandForecastingEngine
from apps.planning.purchase_intelligence.domain.forecasting.replenishment_targets import ReplenishmentIntelligenceService
from apps.planning.purchase_intelligence.domain.multi_warehouse.transfer_optimizer import TransferOptimizationService
from apps.planning.purchase_intelligence.domain.suppliers.mcdm_evaluator import SupplierMCDMEvaluator
from apps.planning.purchase_intelligence.domain.suitability.business_fit import BusinessSuitabilityEngine
from apps.planning.purchase_intelligence.domain.engine.eight_category_classifier import (
    EightCategoryClassifier,
    RecommendationCategory,
)

logger = logging.getLogger(__name__)


class PurchaseIntelligenceOrchestrator:
    """
    Central Purchase Intelligence Decision & Orchestration Engine.
    Executes multi-layered evaluation:
    1. Inventory Position Analysis
    2. Demand Forecasting & Statistical Buffers
    3. Multi-Warehouse Transfer Optimization
    4. Supplier MCDM Evaluation & Risk Flagging
    5. Eight-Category Recommendation Classification
    6. Header-Line Purchase Recommendation Generation & Audit Trails
    """

    @classmethod
    def get_or_create_config(cls, tenant_id: str = "default") -> RecommendationConfiguration:
        config, _ = RecommendationConfiguration.objects.get_or_create(
            tenant_id=tenant_id,
            defaults={
                "auto_generate_daily": True,
                "default_lead_time_buffer_days": 2,
                "default_review_horizon_days": 30,
                "inter_warehouse_transfer_preferred": True,
            },
        )
        return config

    @classmethod
    def evaluate_item_recommendation(
        cls,
        product: InventoryItem,
        warehouse: Warehouse,
        variant: Optional[InventoryItemVariant] = None,
        tenant_id: str = "default",
        seasonal_multiplier: float = 1.0,
        price_trend: str = "STABLE",
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates a single SKU at a designated warehouse against all intelligence layers.
        Returns full recommendation evaluation dictionary or None.
        """
        if not product.is_active or not product.is_purchasable:
            return None

        # 1. Fetch policy or use item master fallbacks
        policy = ReplenishmentPolicy.objects.filter(
            product=product, warehouse=warehouse, is_active=True
        ).first()

        # 2. Compute Demand Forecast & Statistical Replenishment Targets
        forecast_result = DemandForecastingEngine.calculate_forecast(
            product=product, warehouse=warehouse, lookback_days=90, variant=variant
        )
        replenishment_targets = ReplenishmentIntelligenceService.calculate_replenishment_targets(
            product=product, warehouse=warehouse, forecast_result=forecast_result, policy=policy
        )

        reorder_point = Decimal(str(replenishment_targets["reorder_point"]))
        target_stock = Decimal(str(replenishment_targets["target_stock_level"]))
        safety_stock = Decimal(str(replenishment_targets["safety_stock"]))
        avg_daily_demand = Decimal(str(replenishment_targets["average_daily_demand"]))
        min_order_qty = policy.min_order_quantity if policy else (product.min_order_qty or Decimal("1.0000"))
        pack_size = policy.order_multiple_pack_size if policy else Decimal("1.0000")
        lead_time = replenishment_targets["lead_time_days"]

        # 3. Compute Granular Net Inventory Position
        pos = PositionAnalysisService.get_stock_position(product, warehouse, variant=variant)
        net_position = pos["net_inventory_position"]
        available_stock = pos["available_stock"]
        days_of_supply = PositionAnalysisService.calculate_days_of_supply(available_stock, avg_daily_demand)

        # 4. Check for potential Inter-Warehouse Transfer if stock deficit exists
        deficit = max(Decimal("0.0000"), target_stock - net_position)
        transfer_opportunity: Optional[Dict[str, Any]] = None
        if deficit > Decimal("0.0000") and net_position <= reorder_point:
            transfer_opportunity = TransferOptimizationService.evaluate_inter_warehouse_transfers(
                product=product,
                destination_warehouse=warehouse,
                required_quantity=deficit,
                variant=variant,
            )

        # 5. Pack size & MOQ rounding for suggested quantity
        raw_qty = deficit
        rounding_reasons = []

        if transfer_opportunity and transfer_opportunity.get("transfer_feasible"):
            raw_qty = transfer_opportunity["transferable_quantity"]
        else:
            if raw_qty > Decimal("0.0000") and raw_qty < min_order_qty:
                raw_qty = min_order_qty
                rounding_reasons.append(f"Adjusted to Supplier Minimum Order Quantity (MOQ: {min_order_qty:.0f}).")

            if raw_qty > Decimal("0.0000") and pack_size > Decimal("1.0000"):
                rem = raw_qty % pack_size
                if rem > Decimal("0.0000"):
                    raw_qty = raw_qty + (pack_size - rem)
                    rounding_reasons.append(f"Rounded up to full case pack multiple (Pack size: {pack_size:.0f}).")

        suggested_qty = raw_qty

        # 6. Multi-Criteria Supplier Selection & Intelligence
        config = cls.get_or_create_config(tenant_id=tenant_id)
        supplier_eval = SupplierMCDMEvaluator.evaluate_suppliers(
            product=product,
            required_qty=float(suggested_qty if suggested_qty > 0 else 10.0),
            warehouse=warehouse,
            config=config,
        )

        preferred_supplier = supplier_eval.get("preferred_supplier", "Standard Certified Vendor")
        unit_cost = Decimal(str(supplier_eval.get("preferred_unit_price", 100.0)))
        total_cost = Decimal(str(supplier_eval.get("preferred_total_cost", float(suggested_qty * unit_cost))))
        supplier_lead_time = int(supplier_eval.get("preferred_lead_time", lead_time))

        # 7. Business Suitability Evaluation
        suitability_eval = BusinessSuitabilityEngine.evaluate_suitability(
            category=product.category.name if product.category else "General",
            industry_code="retail_supermarket",
            estimated_retail_price=Decimal(str(getattr(product, "purchase_price", None) or getattr(product, "standard_cost", None) or 100.0)) * Decimal("1.30"),
            estimated_landed_cost=unit_cost,
            purchase_quantity=suggested_qty if suggested_qty > 0 else Decimal("10.0000"),
        )

        # 8. Deterministic 8-Category Recommendation Classification
        cat_result = EightCategoryClassifier.classify(
            is_catalog_item=True,
            net_position=net_position,
            reorder_point=reorder_point,
            target_stock=target_stock,
            days_of_supply=days_of_supply,
            transfer_eval=transfer_opportunity,
            forecast_intel=forecast_result,
            supplier_intel=supplier_eval,
            suitability_eval=suitability_eval,
            seasonal_multiplier=seasonal_multiplier,
            price_trend=price_trend,
        )

        # If net position is above reorder point and neither overstock, seasonal, nor discount, no purchase needed
        if net_position > reorder_point and cat_result["category"] not in [
            RecommendationCategory.HOLD,
            RecommendationCategory.SEASONAL,
            RecommendationCategory.PRICE_OPPORTUNITY,
            RecommendationCategory.DELAY,
        ]:
            return None

        # Build combined reasons
        reasons = list(cat_result["reasons"])
        reasons.extend(rounding_reasons)
        if pos["incoming_stock"] > Decimal("0.0000"):
            reasons.append(
                f"Factored {pos['incoming_stock']:.1f} units already confirmed in-transit or on open purchase orders."
            )
        if supplier_eval.get("recommendation_reason"):
            reasons.append(supplier_eval["recommendation_reason"])

        # Determine Recommendation Action & Suggested Warehouse
        rec_action = PurchaseRecommendationItem.Action.PURCHASE
        suggested_transfer_wh = None

        if cat_result["category"] == RecommendationCategory.TRANSFER and transfer_opportunity:
            rec_action = PurchaseRecommendationItem.Action.TRANSFER
            suggested_transfer_wh = transfer_opportunity.get("best_source_warehouse")
        elif cat_result["category"] == RecommendationCategory.HOLD:
            rec_action = PurchaseRecommendationItem.Action.HOLD
            suggested_qty = Decimal("0.0000")
            total_cost = Decimal("0.0000")
        elif cat_result["category"] == RecommendationCategory.DELAY:
            rec_action = PurchaseRecommendationItem.Action.REVIEW

        # Resolve Priority enum
        priority_str = cat_result.get("priority", "MEDIUM")
        priority_map = {
            "CRITICAL": PurchaseRecommendation.Priority.CRITICAL,
            "HIGH": PurchaseRecommendation.Priority.HIGH,
            "MEDIUM": PurchaseRecommendation.Priority.MEDIUM,
            "LOW": PurchaseRecommendation.Priority.LOW,
        }
        priority_enum = priority_map.get(priority_str, PurchaseRecommendation.Priority.MEDIUM)

        return {
            "product": product,
            "variant": variant,
            "warehouse": warehouse,
            "current_stock": pos["on_hand"],
            "available_stock": available_stock,
            "reserved_stock": pos["reserved_stock"],
            "incoming_stock": pos["incoming_stock"],
            "blocked_stock": pos["blocked_stock"],
            "inventory_position": net_position,
            "reorder_point": reorder_point,
            "safety_stock": safety_stock,
            "target_stock_level": target_stock,
            "average_daily_demand": avg_daily_demand,
            "days_of_supply_remaining": Decimal(str(days_of_supply)),
            "suggested_quantity": suggested_qty,
            "recommended_action": rec_action,
            "suggested_transfer_warehouse": suggested_transfer_wh,
            "preferred_supplier": preferred_supplier,
            "estimated_unit_price": unit_cost,
            "estimated_total_cost": total_cost,
            "lead_time_days": supplier_lead_time,
            "priority": priority_enum,
            "reasons": reasons,
            "category": cat_result["category"].value,
            "category_name": cat_result["category_name"],
            "calculation_breakdown": {
                "recommendation_category": cat_result["category"].value,
                "category_name": cat_result["category_name"],
                "on_hand": float(pos["on_hand"]),
                "reserved": float(pos["reserved_stock"]),
                "incoming": float(pos["incoming_stock"]),
                "net_position": float(net_position),
                "reorder_point": float(reorder_point),
                "safety_stock": float(safety_stock),
                "target_stock": float(target_stock),
                "average_daily_demand": float(avg_daily_demand),
                "days_of_supply": float(days_of_supply),
                "forecast_method": forecast_result.get("forecast_method"),
                "mape": forecast_result.get("mape"),
                "mad": forecast_result.get("mad"),
                "growth_trend_pct": forecast_result.get("growth_trend_pct"),
                "moq": float(min_order_qty),
                "pack_size": float(pack_size),
                "supplier_intelligence": {
                    "preferred_supplier": preferred_supplier,
                    "composite_score": supplier_eval.get("primary_option", {}).get("composite_score"),
                    "score_breakdown": supplier_eval.get("primary_option", {}).get("score_breakdown"),
                    "alternate_options": supplier_eval.get("alternate_options", []),
                    "risk_flags": supplier_eval.get("risk_flags", []),
                    "cost_saving_opportunity": supplier_eval.get("cost_saving_opportunity", 0.0),
                },
                "multi_warehouse": {
                    "transfer_feasible": transfer_opportunity.get("transfer_feasible", False) if transfer_opportunity else False,
                    "candidates_count": len(transfer_opportunity.get("candidates", [])) if transfer_opportunity else 0,
                },
                "business_suitability": {
                    "score": float(suitability_eval.get("suitability_score", 0.0)),
                    "status": suitability_eval.get("suitability_status"),
                    "breakdown": suitability_eval.get("breakdown"),
                },
            },
        }

    @classmethod
    def generate_recommendations_for_warehouse(
        cls,
        warehouse: Warehouse,
        user_actor: str = "system",
        tenant_id: str = "default",
    ) -> Optional[PurchaseRecommendation]:
        """
        Evaluates all active products at a designated warehouse and groups line items
        under a single PurchaseRecommendation header. Prevents duplicate active recommendations.
        """
        active_products = InventoryItem.objects.filter(is_active=True, is_purchasable=True)
        items_to_create = []

        for prod in active_products:
            res = cls.evaluate_item_recommendation(prod, warehouse, tenant_id=tenant_id)
            if res and res["suggested_quantity"] > Decimal("0.0000"):
                items_to_create.append(res)

        if not items_to_create:
            return None

        # Check for existing DRAFT or UNDER_REVIEW recommendation for this warehouse to prevent duplication
        existing_rec = PurchaseRecommendation.objects.filter(
            warehouse=warehouse,
            status__in=[PurchaseRecommendation.Status.DRAFT, PurchaseRecommendation.Status.UNDER_REVIEW],
            tenant_id=tenant_id,
        ).first()

        now = timezone.now()
        rec = existing_rec or PurchaseRecommendation(
            warehouse=warehouse,
            tenant_id=tenant_id,
            created_by=user_actor,
        )

        total_cost = sum((item["estimated_total_cost"] for item in items_to_create), Decimal("0.0000"))
        has_critical = any(item["priority"] == PurchaseRecommendation.Priority.CRITICAL for item in items_to_create)
        has_high = any(item["priority"] == PurchaseRecommendation.Priority.HIGH for item in items_to_create)

        rec.total_estimated_outlay = total_cost
        rec.total_items_count = len(items_to_create)
        rec.priority = (
            PurchaseRecommendation.Priority.CRITICAL if has_critical else (
                PurchaseRecommendation.Priority.HIGH if has_high else PurchaseRecommendation.Priority.MEDIUM
            )
        )
        rec.recommended_order_date = now.date()
        rec.required_by_date = now.date() + timedelta(days=7)
        rec.ai_executive_summary = (
            f"Evaluated {len(items_to_create)} item recommendations for {warehouse.name}. "
            f"Estimated outlay: Rs. {total_cost:,.2f}. Highest urgency: {rec.priority}."
        )
        rec.save()

        # Refresh line items
        rec.items.all().delete()
        category_map = {
            "REPLENISHMENT": "REPLENISH_EXISTING",
            "NEW_PRODUCT": "INTRODUCE_NEW_PRODUCT",
            "TRENDING": "EXPLORE_TRENDING_PRODUCT",
            "SEASONAL": "SEASONAL_PURCHASE_OPPORTUNITY",
            "PRICE_OPPORTUNITY": "MARKET_PRICE_OPPORTUNITY",
            "TRANSFER": "SUPPLIER_ALTERNATIVE",
            "HOLD": "EXCESS_STOCK_REDUCTION",
            "DELAY": "AVOID_OR_DELAY_PURCHASE",
        }
        for item_data in items_to_create:
            raw_cat = item_data.get("category", "REPLENISHMENT")
            rec_cat = category_map.get(raw_cat, raw_cat if raw_cat in category_map.values() else "REPLENISH_EXISTING")
            b_fit = Decimal(str(item_data.get("calculation_breakdown", {}).get("business_suitability", {}).get("score", 0.0) or 0.0))
            m_opp = Decimal(str(item_data.get("market_opportunity_score", 0.0) or 0.0))
            s_risk = Decimal(str(item_data.get("stockout_risk_score", 0.0) or 0.0))
            prod_name = item_data["product"].name if item_data.get("product") else ""

            PurchaseRecommendationItem.objects.create(
                recommendation=rec,
                product=item_data["product"],
                variant=item_data["variant"],
                warehouse=item_data["warehouse"],
                product_name_display=prod_name,
                recommendation_category=rec_cat,
                business_fit_score=b_fit,
                market_opportunity_score=m_opp,
                stockout_risk_score=s_risk,
                movement_classification=item_data.get("movement_classification", "REGULAR"),
                current_stock=item_data["current_stock"],
                available_stock=item_data["available_stock"],
                reserved_stock=item_data["reserved_stock"],
                incoming_stock=item_data["incoming_stock"],
                blocked_stock=item_data["blocked_stock"],
                inventory_position=item_data["inventory_position"],
                reorder_point=item_data["reorder_point"],
                safety_stock=item_data["safety_stock"],
                target_stock_level=item_data["target_stock_level"],
                average_daily_demand=item_data["average_daily_demand"],
                days_of_supply_remaining=item_data.get("days_of_supply_remaining", Decimal("0.00")),
                suggested_quantity=item_data["suggested_quantity"],
                recommended_action=item_data["recommended_action"],
                suggested_transfer_warehouse=item_data["suggested_transfer_warehouse"],
                preferred_supplier=item_data["preferred_supplier"],
                estimated_unit_price=item_data["estimated_unit_price"],
                estimated_total_cost=item_data["estimated_total_cost"],
                lead_time_days=item_data["lead_time_days"],
                priority=item_data["priority"],
                recommendation_reasons=item_data["reasons"],
                calculation_breakdown=item_data["calculation_breakdown"],
            )

        # Audit Log
        RecommendationHistory.objects.create(
            recommendation=rec,
            action_type="GENERATED_OR_REFRESHED",
            from_status="",
            to_status=rec.status,
            actor=user_actor,
            details=f"Evaluated {len(items_to_create)} recommendation lines with total value Rs {total_cost:.2f}.",
        )

        return rec
