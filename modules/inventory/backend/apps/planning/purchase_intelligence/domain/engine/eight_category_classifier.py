import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class RecommendationCategory(str, Enum):
    REPLENISHMENT = "REPLENISHMENT"              # 1. Existing Product Replenishment
    NEW_PRODUCT = "NEW_PRODUCT"                  # 2. New Product Discovery (Catalog Expansion)
    TRENDING = "TRENDING"                        # 3. Trending Product Opportunities
    SEASONAL = "SEASONAL"                        # 4. Seasonal & Festive Surge Planning
    PRICE_OPPORTUNITY = "PRICE_OPPORTUNITY"      # 5. Supplier and Price Arbitrage
    TRANSFER = "TRANSFER"                        # 6. Stock Transfer Recommendation
    HOLD = "HOLD"                                # 7. Excess Stock Avoidance (Purchase Hold)
    DELAY = "DELAY"                              # 8. Purchase Delay Recommendation (Price Easing)


class EightCategoryClassifier:
    """
    Industry-Agnostic Eight-Category Purchase Recommendation Classifier.
    Deterministically evaluates multi-dimensional signals:
    - Internal Stock Position & Days of Cover
    - Forecasting Velocity & Growth Trend %
    - Inter-Depot Surplus
    - Supplier Pricing Arbitrage & Trends
    - Seasonal Multipliers & Festival Horizons
    - External Market Signals & Business Suitability
    """

    CATEGORY_METADATA = {
        RecommendationCategory.REPLENISHMENT: {
            "name": "Existing Product Replenishment",
            "short_desc": "Standard catalog replenishment triggered by net position falling below reorder threshold.",
            "action_type": "PURCHASE",
            "default_urgency": "MEDIUM",
        },
        RecommendationCategory.NEW_PRODUCT: {
            "name": "New Product Discovery",
            "short_desc": "External high-potential product not currently in organization catalog, passing business fit.",
            "action_type": "CATALOG_ADD_AND_PURCHASE",
            "default_urgency": "LOW",
        },
        RecommendationCategory.TRENDING: {
            "name": "Trending Product Opportunity",
            "short_desc": "Accelerating demand velocity (>20% growth) or high consumer search index surge.",
            "action_type": "EXPEDITE_OR_EXPAND",
            "default_urgency": "HIGH",
        },
        RecommendationCategory.SEASONAL: {
            "name": "Seasonal Purchase Opportunity",
            "short_desc": "Anticipated surge for upcoming festival, agricultural harvest, or regional seasonal cycle.",
            "action_type": "SEASONAL_PRE_ORDER",
            "default_urgency": "MEDIUM",
        },
        RecommendationCategory.PRICE_OPPORTUNITY: {
            "name": "Supplier & Price Opportunity",
            "short_desc": "Favorable supplier price dip, bulk discount tier, or landed cost arbitrage opportunity.",
            "action_type": "OPPORTUNISTIC_BUY",
            "default_urgency": "MEDIUM",
        },
        RecommendationCategory.TRANSFER: {
            "name": "Stock Transfer Recommendation",
            "short_desc": "Surplus floor stock available in another depot; internal transfer prioritized over buying.",
            "action_type": "INTERNAL_TRANSFER",
            "default_urgency": "HIGH",
        },
        RecommendationCategory.HOLD: {
            "name": "Excess Stock Avoidance",
            "short_desc": "Excess stock (>120 days cover) or dead stock detected; procurement blocked to save capital.",
            "action_type": "HOLD",
            "default_urgency": "LOW",
        },
        RecommendationCategory.DELAY: {
            "name": "Purchase Delay Recommendation",
            "short_desc": "Market price softening or supplier lead time easing; delay order to capture lower cost.",
            "action_type": "DELAY",
            "default_urgency": "LOW",
        },
    }

    @classmethod
    def classify(
        cls,
        is_catalog_item: bool,
        net_position: Decimal,
        reorder_point: Decimal,
        target_stock: Decimal,
        days_of_supply: float,
        transfer_eval: Optional[Dict[str, Any]] = None,
        forecast_intel: Optional[Dict[str, Any]] = None,
        supplier_intel: Optional[Dict[str, Any]] = None,
        market_intel: Optional[Dict[str, Any]] = None,
        suitability_eval: Optional[Dict[str, Any]] = None,
        seasonal_multiplier: float = 1.0,
        price_trend: str = "STABLE",  # "RISING", "FALLING", "STABLE", "DISCOUNTED"
    ) -> Dict[str, Any]:
        """
        Deterministic classification into exactly one primary category,
        with optional secondary tags and transparent audit reasoning.
        """
        reasons: List[str] = []
        forecast = forecast_intel or {}
        supplier = supplier_intel or {}
        market = market_intel or {}
        suitability = suitability_eval or {}
        transfer = transfer_eval or {}

        # -------------------------------------------------------------
        # Branch A: External Market Discovery (Not currently in catalog)
        # -------------------------------------------------------------
        if not is_catalog_item:
            suitability_score = Decimal(str(suitability.get("suitability_score", "0.00")))
            suitability_status = suitability.get("suitability_status", "NOT_SUITABLE")

            if suitability_status == "NOT_SUITABLE" or suitability_score < Decimal("35.00"):
                return {
                    "category": RecommendationCategory.HOLD,
                    "category_name": cls.CATEGORY_METADATA[RecommendationCategory.HOLD]["name"],
                    "action": "DISCARD",
                    "priority": "LOW",
                    "reasons": [
                        f"External item rejected by business suitability checks (Score: {suitability_score:.1f}/100).",
                        *suitability.get("reasons", []),
                    ],
                    "metadata": cls.CATEGORY_METADATA[RecommendationCategory.HOLD],
                }

            # Check if it is a Trending opportunity
            market_trend_growth = float(market.get("growth_4w_pct", 0.0))
            search_index = float(market.get("search_index", 0.0))
            if market_trend_growth >= 20.0 or search_index >= 80.0:
                reasons.append(
                    f"External trending product identified with {market_trend_growth:.1f}% search growth "
                    f"and interest index {search_index:.0f}/100."
                )
                reasons.extend(suitability.get("reasons", []))
                return {
                    "category": RecommendationCategory.TRENDING,
                    "category_name": cls.CATEGORY_METADATA[RecommendationCategory.TRENDING]["name"],
                    "action": "DISCOVER_AND_TEST",
                    "priority": "HIGH" if search_index >= 85.0 else "MEDIUM",
                    "reasons": reasons,
                    "metadata": cls.CATEGORY_METADATA[RecommendationCategory.TRENDING],
                }

            # Standard New Product Discovery
            reasons.append(
                f"New external product opportunity matches business profile (Fit Score: {suitability_score:.1f}/100)."
            )
            reasons.extend(suitability.get("reasons", []))
            return {
                "category": RecommendationCategory.NEW_PRODUCT,
                "category_name": cls.CATEGORY_METADATA[RecommendationCategory.NEW_PRODUCT]["name"],
                "action": "CATALOG_ADD_AND_PURCHASE",
                "priority": "MEDIUM",
                "reasons": reasons,
                "metadata": cls.CATEGORY_METADATA[RecommendationCategory.NEW_PRODUCT],
            }

        # -------------------------------------------------------------
        # Branch B: Existing Catalog Items
        # -------------------------------------------------------------
        # 7. Check Overstock Avoidance / Hold first (ONLY when net position is above reorder point)
        max_stock_level = Decimal(str(target_stock * Decimal("1.8"))) if target_stock > 0 else Decimal("999999")
        if net_position > reorder_point and (days_of_supply >= 120.0 or net_position > max_stock_level):
            reasons.append(
                f"Substantial inventory coverage ({days_of_supply:.1f} days of supply) exceeds overstock threshold (120 days). "
                f"Procurement halted to prevent capital lockup and holding costs."
            )
            return {
                "category": RecommendationCategory.HOLD,
                "category_name": cls.CATEGORY_METADATA[RecommendationCategory.HOLD]["name"],
                "action": "HOLD",
                "priority": "LOW",
                "reasons": reasons,
                "metadata": cls.CATEGORY_METADATA[RecommendationCategory.HOLD],
            }

        # 8. Check Purchase Delay Recommendation
        # If net position is still above reorder point or has > 25 days cover, AND market price is dropping sharply
        if price_trend == "FALLING" and days_of_supply >= 20.0 and net_position > (reorder_point * Decimal("0.8")):
            reasons.append(
                f"Market intelligence indicates declining wholesale prices (-{market.get('price_drop_pct', 8.5):.1f}%). "
                f"With {days_of_supply:.1f} days of supply in stock, delaying purchase will lower acquisition cost."
            )
            return {
                "category": RecommendationCategory.DELAY,
                "category_name": cls.CATEGORY_METADATA[RecommendationCategory.DELAY]["name"],
                "action": "DELAY",
                "priority": "LOW",
                "reasons": reasons,
                "metadata": cls.CATEGORY_METADATA[RecommendationCategory.DELAY],
            }

        # 6. Check Stock Transfer Recommendation (Net position deficit, but adjacent warehouse has surplus)
        deficit = max(Decimal("0.0000"), target_stock - net_position)
        if deficit > Decimal("0.0000") and net_position <= reorder_point:
            if transfer.get("transfer_feasible") and transfer.get("transferable_quantity", Decimal("0")) > Decimal("0"):
                reasons.append(transfer.get("reason", "Adjacent warehouse surplus detected. Recommend internal transfer."))
                return {
                    "category": RecommendationCategory.TRANSFER,
                    "category_name": cls.CATEGORY_METADATA[RecommendationCategory.TRANSFER]["name"],
                    "action": "INTERNAL_TRANSFER",
                    "priority": "HIGH" if days_of_supply <= 3.0 else "MEDIUM",
                    "reasons": reasons,
                    "metadata": cls.CATEGORY_METADATA[RecommendationCategory.TRANSFER],
                }

        # 4. Seasonal & Festival Surge Planning
        if seasonal_multiplier >= 1.25:
            reasons.append(
                f"Upcoming seasonal/festive event applies a {seasonal_multiplier:.2f}x demand surge multiplier."
            )
            return {
                "category": RecommendationCategory.SEASONAL,
                "category_name": cls.CATEGORY_METADATA[RecommendationCategory.SEASONAL]["name"],
                "action": "SEASONAL_PRE_ORDER",
                "priority": "HIGH" if days_of_supply <= 15.0 else "MEDIUM",
                "reasons": reasons,
                "metadata": cls.CATEGORY_METADATA[RecommendationCategory.SEASONAL],
            }

        # 5. Supplier Price Arbitrage / Discount Opportunity
        cost_saving = float(supplier.get("cost_saving_opportunity", 0.0))
        if cost_saving >= 10.0 or price_trend == "DISCOUNTED":
            reasons.append(
                f"Supplier discount / price arbitrage detected: {cost_saving:.1f}% landed cost advantage available."
            )
            return {
                "category": RecommendationCategory.PRICE_OPPORTUNITY,
                "category_name": cls.CATEGORY_METADATA[RecommendationCategory.PRICE_OPPORTUNITY]["name"],
                "action": "OPPORTUNISTIC_BUY",
                "priority": "MEDIUM",
                "reasons": reasons,
                "metadata": cls.CATEGORY_METADATA[RecommendationCategory.PRICE_OPPORTUNITY],
            }

        # 3. Trending Product Opportunity (For internal catalog items experiencing sharp demand growth)
        growth_trend = float(forecast.get("growth_trend_pct", 0.0))
        if growth_trend >= 20.0:
            reasons.append(
                f"Surging demand velocity: consumption velocity grew by {growth_trend:.1f}% over the recent evaluation window."
            )
            return {
                "category": RecommendationCategory.TRENDING,
                "category_name": cls.CATEGORY_METADATA[RecommendationCategory.TRENDING]["name"],
                "action": "EXPEDITE_OR_EXPAND",
                "priority": "HIGH" if days_of_supply <= 7.0 else "MEDIUM",
                "reasons": reasons,
                "metadata": cls.CATEGORY_METADATA[RecommendationCategory.TRENDING],
            }

        # 1. Existing Product Replenishment (Standard baseline replenishment)
        reasons.append(
            f"Net inventory position ({net_position:.1f}) is at or below reorder threshold ({reorder_point:.1f}). "
            f"Days of supply remaining: {days_of_supply:.1f} days."
        )
        return {
            "category": RecommendationCategory.REPLENISHMENT,
            "category_name": cls.CATEGORY_METADATA[RecommendationCategory.REPLENISHMENT]["name"],
            "action": "PURCHASE",
            "priority": "CRITICAL" if days_of_supply <= 0.0 else ("HIGH" if days_of_supply <= 5.0 else "MEDIUM"),
            "reasons": reasons,
            "metadata": cls.CATEGORY_METADATA[RecommendationCategory.REPLENISHMENT],
        }
