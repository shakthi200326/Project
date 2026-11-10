import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional
from apps.planning.models import BusinessProfile, MarketProductObservation, SupplierMarketOffer

logger = logging.getLogger(__name__)


class BusinessSuitabilityService:
    """
    Evaluates how well an external or replenishment product opportunity matches
    the specific business's profile, procurement budget, margins, and target market.
    """

    @classmethod
    def get_or_create_default_profile(cls) -> BusinessProfile:
        profile = BusinessProfile.objects.filter(is_active=True).first()
        if not profile:
            profile = BusinessProfile.objects.create(
                business_name="Universal Multi-Industry Enterprise",
                business_type="Retailer & Wholesaler",
                primary_industry_code="retail_supermarket",
                business_location="Tamil Nadu, India",
                target_customer_segment="Retail, Wholesale & B2B Distribution",
                target_market_region="South India / Pan-India",
                preferred_categories=["Grains & Pulses", "Edible Oils", "Spices & Masalas", "Electronics", "Textile"],
                procurement_budget=Decimal("500000.00"),
                min_expected_gross_margin_pct=Decimal("18.00"),
                restricted_categories=[],
                is_active=True,
            )
        return profile

    @classmethod
    def evaluate_suitability(
        cls,
        observation: MarketProductObservation,
        supplier_offer: Optional[SupplierMarketOffer],
        profile: Optional[BusinessProfile] = None,
    ) -> Dict[str, Any]:
        """
        Runs comprehensive suitability evaluation.
        Returns:
            {
                "suitability_score": Decimal,
                "suitability_status": str,
                "breakdown": dict,
                "reasons": list,
            }
        """
        if profile is None:
            profile = cls.get_or_create_default_profile()

        checks = {}
        reasons = []
        passed_points = Decimal("0.00")
        total_points = Decimal("100.00")

        # 1. Restriction check (15 pts)
        category = observation.category or ""
        restricted = profile.restricted_categories or []
        is_restricted = any(r.lower() in category.lower() for r in restricted)
        if is_restricted:
            checks["restriction_check"] = {"passed": False, "reason": f"Category '{category}' is in business restricted list."}
            reasons.append(f"Category '{category}' is restricted for this business profile.")
            return {
                "suitability_score": Decimal("0.00"),
                "suitability_status": "NOT_SUITABLE",
                "breakdown": checks,
                "reasons": reasons,
            }
        else:
            checks["restriction_check"] = {"passed": True, "reason": "No regulatory or business restrictions"}
            passed_points += Decimal("15.00")

        # 2. Industry alignment check (25 pts)
        is_primary_ind = observation.industry and observation.industry.code == profile.primary_industry_code
        if is_primary_ind:
            checks["industry_alignment"] = {"type": "PRIMARY_INDUSTRY", "score": 25.0, "reason": f"Matches primary industry: {profile.primary_industry_code}"}
            passed_points += Decimal("25.00")
            reasons.append(f"Matches primary industry: {profile.primary_industry_code}")
        else:
            checks["industry_alignment"] = {"type": "CROSS_INDUSTRY", "score": 15.0, "reason": f"Cross-industry opportunity from {observation.industry.name if observation.industry else 'Market'}"}
            passed_points += Decimal("15.00")
            reasons.append(f"Cross-industry opportunity from {observation.industry.name if observation.industry else 'Market'}")

        # 3. Category preference (20 pts)
        preferred = profile.preferred_categories or []
        cat_preferred = any(p.lower() in category.lower() for p in preferred)
        if cat_preferred:
            checks["category_preference"] = {"passed": True, "score": 20.0, "reason": f"Category '{category}' is in preferred categories list"}
            passed_points += Decimal("20.00")
            reasons.append(f"Category '{category}' is in preferred categories list")
        else:
            checks["category_preference"] = {"passed": False, "score": 5.0, "reason": f"Category '{category}' not in primary preference list"}
            passed_points += Decimal("5.00")

        # 4. Margin check (20 pts)
        retail_p = float(observation.listed_retail_price or 0)
        landed_c = float(supplier_offer.landed_cost_unit if supplier_offer else 0)
        if retail_p > 0 and landed_c > 0:
            calc_margin_pct = ((retail_p - landed_c) / retail_p) * 100.0
            target_margin = float(profile.min_expected_gross_margin_pct or 18.0)
            if calc_margin_pct >= target_margin:
                checks["margin_check"] = {"passed": True, "margin_pct": round(calc_margin_pct, 1), "threshold_pct": target_margin}
                passed_points += Decimal("20.00")
                reasons.append(f"Estimated gross margin {calc_margin_pct:.1f}% exceeds target {target_margin:.0f}%")
            else:
                checks["margin_check"] = {"passed": False, "margin_pct": round(calc_margin_pct, 1), "threshold_pct": target_margin}
                passed_points += Decimal("5.00")
                reasons.append(f"Gross margin {calc_margin_pct:.1f}% is below required {target_margin:.0f}%")
        else:
            checks["margin_check"] = {"status": "PENDING_VERIFIED_LANDED_COST", "score": 10.0}
            passed_points += Decimal("10.00")
            reasons.append("Procurement landed cost verification pending vendor inquiry")

        # 5. Budget & Supplier Check (20 pts)
        est_moq = float(supplier_offer.minimum_order_qty if supplier_offer else 10)
        est_outlay = est_moq * landed_c if landed_c > 0 else 5000.0
        budget = float(profile.procurement_budget or 500000.0)
        if est_outlay <= budget * 0.2:
            checks["budget_check"] = {"passed": True, "score": 10.0, "outlay": est_outlay}
            passed_points += Decimal("10.00")
        else:
            checks["budget_check"] = {"passed": False, "score": 4.0, "reason": f"Batch outlay Rs {est_outlay:.0f} exceeds single-order budget limit"}
            passed_points += Decimal("4.00")

        if supplier_offer:
            checks["supplier_check"] = {"passed": True, "score": 10.0, "supplier": supplier_offer.supplier_name, "reliability": float(supplier_offer.on_time_reliability_pct)}
            passed_points += Decimal("10.00")
            reasons.append(f"Preferred regional supplier {supplier_offer.supplier_name} ({supplier_offer.on_time_reliability_pct}% on-time)")
        else:
            checks["supplier_check"] = {"passed": False, "score": 5.0, "status": "NO_SUPPLIER_RECORD"}
            passed_points += Decimal("5.00")

        final_score = min(Decimal("100.00"), max(Decimal("0.00"), passed_points))

        if final_score >= Decimal("70.00"):
            status = "SUITABLE_FOR_PURCHASE"
        elif final_score >= Decimal("55.00"):
            status = "CROSS_INDUSTRY_EXPANSION" if not is_primary_ind else "REQUIRES_REVIEW"
        else:
            status = "REQUIRES_REVIEW"

        return {
            "suitability_score": final_score,
            "suitability_status": status,
            "breakdown": checks,
            "reasons": reasons,
        }
