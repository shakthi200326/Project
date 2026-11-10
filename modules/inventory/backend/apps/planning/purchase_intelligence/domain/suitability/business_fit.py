import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional

from apps.planning.models import BusinessProfile, MarketProductObservation, SupplierMarketOffer

logger = logging.getLogger(__name__)


class BusinessSuitabilityEngine:
    """
    Decoupled Business Suitability & Financial Feasibility Engine.
    Evaluates whether an external market opportunity or purchasing proposal fits
    the business's margin requirements, category restrictions, industry profile,
    and working capital procurement budget.
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
                preferred_categories=[
                    "Grains & Pulses", "Edible Oils", "Spices & Masalas",
                    "Electronics", "Textile", "Hardware",
                ],
                procurement_budget=Decimal("500000.00"),
                min_expected_gross_margin_pct=Decimal("18.00"),
                restricted_categories=["Hazardous Chemicals", "Explosives", "Perishables Without Cold Chain"],
                is_active=True,
            )
        return profile

    @classmethod
    def evaluate_suitability(
        cls,
        category: str,
        industry_code: Optional[str] = None,
        estimated_retail_price: Optional[Decimal] = None,
        estimated_landed_cost: Optional[Decimal] = None,
        purchase_quantity: Decimal = Decimal("1.0000"),
        profile: Optional[BusinessProfile] = None,
    ) -> Dict[str, Any]:
        """
        Direct calculation of business suitability from parameters.
        Returns:
            - suitability_score (Decimal, 0-100)
            - suitability_status (EXCELLENT_FIT, GOOD_FIT, REQUIRES_REVIEW, NOT_SUITABLE)
            - breakdown: Dict[str, Any]
            - reasons: List[str]
        """
        if profile is None:
            profile = cls.get_or_create_default_profile()

        checks: Dict[str, Any] = {}
        reasons: List[str] = []
        passed_points = Decimal("0.00")

        # 1. Restriction Check (15 pts) - Hard Filter
        restricted_list = profile.restricted_categories or []
        is_restricted = any(r.lower() in category.lower() for r in restricted_list)
        if is_restricted:
            checks["restriction_check"] = {
                "passed": False,
                "score": 0.0,
                "reason": f"Category '{category}' is in restricted list for this business profile.",
            }
            reasons.append(f"Category '{category}' violates business regulatory or policy restrictions.")
            return {
                "suitability_score": Decimal("0.00"),
                "suitability_status": "NOT_SUITABLE",
                "breakdown": checks,
                "reasons": reasons,
            }
        else:
            checks["restriction_check"] = {
                "passed": True,
                "score": 15.0,
                "reason": "Passed regulatory and restriction checks",
            }
            passed_points += Decimal("15.00")

        # 2. Industry Alignment (25 pts)
        is_primary = bool(industry_code and industry_code.lower() == profile.primary_industry_code.lower())
        if is_primary:
            checks["industry_alignment"] = {
                "passed": True,
                "score": 25.0,
                "reason": f"Directly aligns with primary industry: {profile.primary_industry_code}",
            }
            passed_points += Decimal("25.00")
            reasons.append(f"Primary industry alignment ({profile.primary_industry_code}).")
        else:
            checks["industry_alignment"] = {
                "passed": True,
                "score": 15.0,
                "reason": f"Cross-industry opportunity from {industry_code or 'General Market'}",
            }
            passed_points += Decimal("15.00")
            reasons.append(f"Cross-industry opportunity from {industry_code or 'General Market'}.")

        # 3. Category Preference (20 pts)
        preferred = profile.preferred_categories or []
        is_preferred = any(p.lower() in category.lower() for p in preferred)
        if is_preferred:
            checks["category_preference"] = {
                "passed": True,
                "score": 20.0,
                "reason": f"Category '{category}' matches preferred inventory mix.",
            }
            passed_points += Decimal("20.00")
            reasons.append(f"Product category '{category}' is in preferred focus list.")
        else:
            checks["category_preference"] = {
                "passed": False,
                "score": 5.0,
                "reason": f"Category '{category}' is outside primary preferred lines.",
            }
            passed_points += Decimal("5.00")

        # 4. Gross Margin Hurdle (20 pts)
        retail_p = estimated_retail_price or Decimal("0.0000")
        landed_c = estimated_landed_cost or Decimal("0.0000")
        min_margin = profile.min_expected_gross_margin_pct or Decimal("18.00")

        if retail_p > Decimal("0.0000") and landed_c > Decimal("0.0000"):
            calc_margin = ((retail_p - landed_c) / retail_p) * Decimal("100.00")
            if calc_margin >= min_margin:
                checks["margin_hurdle"] = {
                    "passed": True,
                    "score": 20.0,
                    "margin_pct": float(round(calc_margin, 2)),
                    "min_required_pct": float(min_margin),
                    "reason": f"Gross margin {calc_margin:.1f}% meets/exceeds target hurdle {min_margin:.1f}%",
                }
                passed_points += Decimal("20.00")
                reasons.append(f"Expected gross margin of {calc_margin:.1f}% exceeds target {min_margin:.1f}%.")
            elif calc_margin > Decimal("0.0000"):
                proportional = (calc_margin / min_margin) * Decimal("20.00")
                score_val = min(Decimal("20.00"), max(Decimal("0.00"), proportional))
                checks["margin_hurdle"] = {
                    "passed": False,
                    "score": float(round(score_val, 2)),
                    "margin_pct": float(round(calc_margin, 2)),
                    "min_required_pct": float(min_margin),
                    "reason": f"Gross margin {calc_margin:.1f}% below target {min_margin:.1f}%",
                }
                passed_points += score_val
                reasons.append(f"Gross margin {calc_margin:.1f}% is below target hurdle {min_margin:.1f}%.")
            else:
                checks["margin_hurdle"] = {
                    "passed": False,
                    "score": 0.0,
                    "margin_pct": float(round(calc_margin, 2)),
                    "reason": "Negative gross margin (landed cost exceeds list price).",
                }
                reasons.append("Landed cost exceeds retail price.")
        else:
            # Fallback benchmark
            checks["margin_hurdle"] = {
                "passed": True,
                "score": 12.0,
                "reason": "Margin estimated from industry benchmark standard.",
            }
            passed_points += Decimal("12.00")

        # 5. Working Capital Budget Headroom (20 pts)
        unit_cost = landed_c if landed_c > Decimal("0.0000") else (retail_p * Decimal("0.70"))
        estimated_outlay = purchase_quantity * unit_cost
        budget = profile.procurement_budget or Decimal("500000.00")

        if budget > Decimal("0.0000"):
            outlay_pct = (estimated_outlay / budget) * Decimal("100.00")
            if estimated_outlay <= (budget * Decimal("0.25")):
                checks["budget_headroom"] = {
                    "passed": True,
                    "score": 20.0,
                    "outlay": float(estimated_outlay),
                    "budget": float(budget),
                    "reason": f"Outlay Rs. {estimated_outlay:,.2f} is well within working capital budget headroom ({outlay_pct:.1f}% of total).",
                }
                passed_points += Decimal("20.00")
                reasons.append(f"Procurement outlay Rs. {estimated_outlay:,.2f} within comfortable budget headroom.")
            elif estimated_outlay <= budget:
                checks["budget_headroom"] = {
                    "passed": True,
                    "score": 12.0,
                    "outlay": float(estimated_outlay),
                    "budget": float(budget),
                    "reason": f"Outlay Rs. {estimated_outlay:,.2f} utilizes {outlay_pct:.1f}% of budget.",
                }
                passed_points += Decimal("12.00")
                reasons.append(f"Outlay Rs. {estimated_outlay:,.2f} uses {outlay_pct:.1f}% of available budget.")
            else:
                checks["budget_headroom"] = {
                    "passed": False,
                    "score": 2.0,
                    "outlay": float(estimated_outlay),
                    "budget": float(budget),
                    "reason": f"Outlay Rs. {estimated_outlay:,.2f} exceeds total working capital budget (Rs. {budget:,.2f}).",
                }
                passed_points += Decimal("2.00")
                reasons.append(f"High capital requirement: Rs. {estimated_outlay:,.2f} exceeds allocated budget.")
        else:
            checks["budget_headroom"] = {"passed": True, "score": 15.0, "reason": "No hard budget limit configured."}
            passed_points += Decimal("15.00")

        # Determine Status
        final_score = Decimal(str(round(min(100.0, float(passed_points)), 2)))
        if final_score >= Decimal("75.00"):
            status = "EXCELLENT_FIT"
        elif final_score >= Decimal("55.00"):
            status = "GOOD_FIT"
        elif final_score >= Decimal("35.00"):
            status = "REQUIRES_REVIEW"
        else:
            status = "NOT_SUITABLE"

        return {
            "suitability_score": final_score,
            "suitability_status": status,
            "breakdown": checks,
            "reasons": reasons,
        }

    @classmethod
    def evaluate_market_observation(
        cls,
        observation: MarketProductObservation,
        supplier_offer: Optional[SupplierMarketOffer] = None,
        profile: Optional[BusinessProfile] = None,
    ) -> Dict[str, Any]:
        """Convenience wrapper for MarketProductObservation records."""
        cat = observation.category or "General"
        ind = observation.industry.code if observation.industry else None
        retail_p = observation.listed_retail_price
        landed_c = supplier_offer.landed_cost_unit if supplier_offer else None
        moq = supplier_offer.minimum_order_quantity if supplier_offer else Decimal("10.0000")

        return cls.evaluate_suitability(
            category=cat,
            industry_code=ind,
            estimated_retail_price=retail_p,
            estimated_landed_cost=landed_c,
            purchase_quantity=moq,
            profile=profile,
        )

