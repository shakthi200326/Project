"""
Integration of 4-Layer Scoring Engine into Centralized Recommendation Orchestrator.
Generates explainable, India-specific item recommendation cards and applies
the monthly Rs. 5 Lakh purchase budget constraint.
"""
from decimal import Decimal
from typing import Dict, Any, List, Optional
from datetime import timedelta
from django.utils import timezone

from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse
from apps.planning.models import PurchaseSuggestion
from apps.planning.services.calculation_engine import CalculationEngineService
from apps.planning.services.four_layer_engine import FourLayerScoringEngine


class RecommendationOrchestrator:

    @classmethod
    def generate_all_suggestions(cls, user_actor: str = "system") -> Dict[str, Any]:
        """
        Executes the 4-Layer scoring engine for all active items across active warehouses.
        Applies:
        - Layer 1: Internal demand & velocity trend
        - Layer 2: Market trends & PMI correlation
        - Layer 3: Tamil Nadu event & festival calendar with Order-By date
        - Layer 4: Supply landed cost & Buy-Timing signal (Buy now / Wait / Normal)
        - Dead-stock blocking (90d no movement)
        - Monthly Rs. 5 Lakh budget ranking (ROI / ABC Knapsack)
        """
        warehouses = list(Warehouse.objects.filter(status__in=["ACTIVE", "Active"])) or list(Warehouse.objects.all()[:1])
        products = list(InventoryItem.objects.filter(is_active=True))

        all_item_cards = []

        for wh in warehouses:
            for prod in products:
                card = FourLayerScoringEngine.evaluate_item_card(prod, wh)
                all_item_cards.append(card)

        # Apply monthly Rs. 5 Lakh budget constraint (greedy ROI knapsack)
        budget_summary = FourLayerScoringEngine.run_budget_optimizer(
            all_item_cards, monthly_budget=500000.0
        )

        created_count = 0
        updated_count = 0

        for card in all_item_cards:
            prod = card["product"]
            wh = card["warehouse"]

            # If dead stock or no suggested quantity, we still create/update a card for full visibility
            # but mark it blocked and dead stock
            existing = PurchaseSuggestion.objects.filter(
                product=prod, warehouse=wh, status=PurchaseSuggestion.Status.PENDING
            ).first()

            payload = {
                "available_stock": Decimal(str(CalculationEngineService.get_stock_profile(prod, wh)["available_stock"])),
                "reorder_point": Decimal(str(prod.reorder_point or 20.0)),
                "suggested_quantity": Decimal(str(card["suggested_quantity"])),
                "supplier": card["preferred_supplier"],
                "status": PurchaseSuggestion.Status.PENDING,
                "priority": PurchaseSuggestion.Priority.HIGH if card["demand_score"] >= 70 else (
                    PurchaseSuggestion.Priority.MEDIUM if card["demand_score"] >= 40 else PurchaseSuggestion.Priority.LOW
                ),
                "confidence_score": Decimal(str(round(card["confidence_pct"] / 100.0, 2))),
                "recommended_action": PurchaseSuggestion.ActionType.PURCHASE if not card["is_dead_stock"] else PurchaseSuggestion.ActionType.REVIEW,
                "recommended_purchase_date": card["order_by_date"],
                "required_delivery_date": card["order_by_date"] + timedelta(days=int(prod.lead_time_days or 4)),
                "order_by_date": card["order_by_date"],
                "estimated_unit_price": Decimal(str(card["unit_price"])),
                "estimated_total_cost": Decimal(str(card["estimated_total_cost"])),
                "currency": "INR",
                "explanation": " ".join(card["top_3_reasons"]),
                "reasons": card["top_3_reasons"],
                "internal_score": Decimal(str(card["layer_scores"]["internal"])),
                "market_score": Decimal(str(card["layer_scores"]["market"])),
                "event_score": Decimal(str(card["layer_scores"]["event"])),
                "supply_score": Decimal(str(card["layer_scores"]["supply"])),
                "final_demand_score": Decimal(str(card["demand_score"])),
                "buy_timing_signal": card["buy_timing_signal"],
                "is_dead_stock": card["is_dead_stock"],
                "budget_allocated_cost": Decimal(str(card.get("budget_allocated_cost", 0.0))),
                "is_budget_throttled": card.get("is_budget_throttled", False),
                "risk_analysis": {
                    "risk": card["risk"],
                    "overall_severity": "CRITICAL" if card["is_dead_stock"] else ("HIGH" if card["demand_score"] >= 75 else "MEDIUM"),
                },
                "demand_intelligence": {
                    "demand_score": card["demand_score"],
                    "demand_level": card["demand_score_level"],
                    "layer_scores": card["layer_scores"],
                },
                "calculation_breakdown": {
                    "suggested_quantity": card["suggested_quantity"],
                    "unit_price": card["unit_price"],
                    "confidence_pct": card["confidence_pct"],
                    "roi_priority_score": card.get("roi_priority_score", 0.0),
                },
            }

            if existing:
                for k, v in payload.items():
                    setattr(existing, k, v)
                existing.save()
                updated_count += 1
            else:
                payload["product"] = prod
                payload["warehouse"] = wh
                payload["created_by"] = user_actor
                PurchaseSuggestion.objects.create(**payload)
                created_count += 1

        return {
            "created_count": created_count,
            "updated_count": updated_count,
            "total_pending": PurchaseSuggestion.objects.filter(status=PurchaseSuggestion.Status.PENDING).count(),
            "budget_summary": budget_summary,
        }
