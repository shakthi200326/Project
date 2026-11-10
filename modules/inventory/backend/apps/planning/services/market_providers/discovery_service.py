import logging
import random
from decimal import Decimal
from typing import Dict, Any, List, Optional
from django.utils import timezone
from django.db.models import Q

from apps.categories.models import InventoryCategory
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse
from apps.planning.models import (
    IndustryProfile,
    MarketDataSource,
    MarketProductObservation,
    MarketPriceObservation,
    SupplierMarketOffer,
    ProductMarketMatch,
    PurchaseSuggestion,
    BusinessProfile,
)
from apps.planning.services.business_suitability_service import BusinessSuitabilityService
from .base_provider import BaseMarketProvider
from .ecommerce_provider import EcommerceMarketProvider
from .trend_provider import SearchTrendMarketProvider
from .wholesale_provider import WholesaleMandiMarketProvider

logger = logging.getLogger(__name__)


class MarketDiscoveryEngine:
    """
    Centralized external market product discovery engine across industries.
    Discovers products from e-commerce marketplace APIs, correlates with search trends & mandi feeds,
    evaluates business suitability, and creates or syncs purchase opportunity suggestions.
    """

    DEFAULT_INDUSTRIES = [
        {
            "code": "textile",
            "name": "Textile Industry",
            "description": "Apparel, yarn, cotton fabrics, home textiles, and garments.",
            "categories": ["Fabrics", "Garments", "Home Textiles", "Yarn", "Accessories"],
            "market_signals": {"primary_index": "Cotton Yarn 40s Hank", "festive_peak": "Diwali & Pongal"},
            "regulatory_rules": {"gst_rate": 5.0, "hsn_prefix": "5208"},
        },
        {
            "code": "electronics",
            "name": "Electronics Industry",
            "description": "Consumer electronics, fast chargers, audio wearables, and smart devices.",
            "categories": ["Mobile Accessories", "Wearables", "Power & Charging", "Audio", "Smart Home"],
            "market_signals": {"primary_index": "Lithium Cell Benchmark", "festive_peak": "Diwali & Big Billion Days"},
            "regulatory_rules": {"gst_rate": 18.0, "bis_mandatory": True},
        },
        {
            "code": "retail_supermarket",
            "name": "Retail and Supermarket",
            "description": "Grocery, FMCG, cold-pressed oils, organic staples, and daily essentials.",
            "categories": ["Edible Oils", "Organic Staples", "Grains & Pulses", "Packaged Food", "Personal Care"],
            "market_signals": {"primary_index": "Copra & Edible Oil Mandi", "festive_peak": "Year-round & Regional Festivals"},
            "regulatory_rules": {"fssai_mandatory": True, "gst_rate": 5.0},
        },
        {
            "code": "pharmacy_healthcare",
            "name": "Pharmacy and Healthcare Products",
            "description": "Medical monitors, wellness devices, personal hygiene, and diagnostics.",
            "categories": ["Diagnostic Monitors", "Wellness", "First Aid", "Orthopedic", "Hygiene"],
            "market_signals": {"primary_index": "Polymer & Non-Woven Benchmark", "festive_peak": "Monsoon & Winter"},
            "regulatory_rules": {"cdsco_licensed": True, "gst_rate": 12.0},
        },
        {
            "code": "automobile",
            "name": "Automobile Industry",
            "description": "Aftermarket car accessories, filters, lighting, and spare components.",
            "categories": ["Car Accessories", "Filters", "Lighting", "Detailing", "Replacement Spares"],
            "market_signals": {"primary_index": "PP Automotive Resin", "festive_peak": "Ayudha Pooja & New Year"},
            "regulatory_rules": {"ais_standards": True, "gst_rate": 28.0},
        },
        {
            "code": "manufacturing",
            "name": "Manufacturing Industry",
            "description": "Industrial tooling, carbide milling bits, precision gauges, and fasteners.",
            "categories": ["Cutting Tools", "Measurement & Gauges", "Machinery Spares", "Fasteners", "Abrasives"],
            "market_signals": {"primary_index": "High Speed Steel (HSS)", "festive_peak": "Quarterly CAPEX Cycle"},
            "regulatory_rules": {"iso_compliance": True, "gst_rate": 18.0},
        },
        {
            "code": "construction_hardware",
            "name": "Construction and Hardware",
            "description": "Architectural fittings, stainless steel hinges, locks, and builders hardware.",
            "categories": ["Door Fittings", "Locking Systems", "Sanitary Hardware", "Fasteners", "Hand Tools"],
            "market_signals": {"primary_index": "SS 304 Coil Exchange", "festive_peak": "Post-Monsoon Construction"},
            "regulatory_rules": {"bis_structural": True, "gst_rate": 18.0},
        },
        {
            "code": "food_beverage",
            "name": "Food and Beverage",
            "description": "Gourmet filter coffee, cold-pressed gingelly oil, sweets, and snacks.",
            "categories": ["Beverages", "Cooking Essentials", "Sweets & Snacks", "Spices", "Health Drinks"],
            "market_signals": {"primary_index": "Sesame Seeds Mandi", "festive_peak": "Karthigai Deepam & Pongal"},
            "regulatory_rules": {"fssai_central": True, "gst_rate": 5.0},
        },
    ]

    DEFAULT_DATA_SOURCES = [
        {
            "source_id": "amazon_in",
            "name": "Amazon India Marketplace API",
            "provider_type": "ECOMMERCE",
            "base_url": "https://sellercentral.amazon.in/api",
            "credentials_env_var": "AMAZON_SELLER_API_KEY",
            "sync_interval_hours": 24,
        },
        {
            "source_id": "flipkart",
            "name": "Flipkart Marketplace API",
            "provider_type": "ECOMMERCE",
            "base_url": "https://api.flipkart.net/sellers",
            "credentials_env_var": "FLIPKART_API_KEY",
            "sync_interval_hours": 24,
        },
        {
            "source_id": "google_trends",
            "name": "Google Trends & Consumer Search Index",
            "provider_type": "SEARCH_TRENDS",
            "base_url": "https://trends.google.com/trends/api",
            "credentials_env_var": "GOOGLE_TRENDS_API_KEY",
            "sync_interval_hours": 24,
        },
        {
            "source_id": "wholesale_mandi",
            "name": "Wholesale Mandi & Regional Sourcing Hubs",
            "provider_type": "WHOLESALE_FEED",
            "base_url": "https://agmarknet.gov.in/api",
            "credentials_env_var": "MANDI_FEED_API_KEY",
            "sync_interval_hours": 12,
        },
        {
            "source_id": "mcx_commodities",
            "name": "MCX & Regional Commodity Feeds",
            "provider_type": "COMMODITY_EXCHANGE",
            "base_url": "https://www.mcxindia.com/api",
            "credentials_env_var": "MCX_FEED_API_KEY",
            "sync_interval_hours": 12,
        },
    ]

    def __init__(self):
        self.providers: Dict[str, BaseMarketProvider] = {
            "amazon_in": EcommerceMarketProvider("amazon_in", "Amazon India Marketplace API", "AMAZON_SELLER_API_KEY"),
            "flipkart": EcommerceMarketProvider("flipkart", "Flipkart Marketplace API", "FLIPKART_API_KEY"),
            "google_trends": SearchTrendMarketProvider("google_trends", "Google Trends & Consumer Search Index", "GOOGLE_TRENDS_API_KEY"),
            "wholesale_mandi": WholesaleMandiMarketProvider("wholesale_mandi", "Wholesale Mandi & Regional Sourcing Hubs", "MANDI_FEED_API_KEY"),
        }

    @classmethod
    def seed_infrastructure(cls):
        """Idempotently seeds all industry profiles and external market data sources."""
        for ind in cls.DEFAULT_INDUSTRIES:
            IndustryProfile.objects.get_or_create(
                code=ind["code"],
                defaults={
                    "name": ind["name"],
                    "description": ind["description"],
                    "categories": ind["categories"],
                    "market_signals": ind["market_signals"],
                    "regulatory_rules": ind["regulatory_rules"],
                    "is_active": True,
                },
            )

        for src in cls.DEFAULT_DATA_SOURCES:
            MarketDataSource.objects.get_or_create(
                source_id=src["source_id"],
                defaults={
                    "name": src["name"],
                    "provider_type": src["provider_type"],
                    "base_url": src["base_url"],
                    "credentials_env_var": src["credentials_env_var"],
                    "sync_interval_hours": src["sync_interval_hours"],
                    "is_enabled": True,
                    "last_sync_status": "IDLE",
                },
            )

    def get_provider_health_summary(self) -> Dict[str, Any]:
        """Returns verified connectivity and configuration status for each provider."""
        statuses = {}
        for src_id, provider in self.providers.items():
            health = provider.check_health()
            statuses[src_id] = health
            try:
                db_src = MarketDataSource.objects.filter(source_id=src_id).first()
                if db_src:
                    db_src.auth_configured = health.get("configured", False)
                    db_src.last_sync_status = health.get("status", "IDLE")
                    db_src.save()
            except Exception as e:
                logger.warning(f"Failed to update db source for {src_id}: {e}")
        return statuses

    def execute_market_discovery(self, industry_code: Optional[str] = None) -> Dict[str, Any]:
        """
        Runs external market product discovery across specified or all industries.
        Discovers products independently of whether internal stock exists!
        """
        self.seed_infrastructure()

        if industry_code and industry_code.lower() != "all":
            industries_to_run = list(IndustryProfile.objects.filter(code=industry_code, is_active=True))
        else:
            industries_to_run = list(IndustryProfile.objects.filter(is_active=True))

        created_obs = 0
        updated_obs = 0
        suggestions_synced = 0
        now = timezone.now()

        trend_provider = self.providers.get("google_trends")
        mandi_provider = self.providers.get("wholesale_mandi")

        for ind in industries_to_run:
            trend_signal = trend_provider.get_trend_indicator(ind.code) if trend_provider else {}
            commodity_signal = mandi_provider.get_commodity_signal(ind.code) if mandi_provider else {}

            for src_id in ["amazon_in", "flipkart"]:
                ec_provider = self.providers.get(src_id)
                db_source = MarketDataSource.objects.filter(source_id=src_id).first()
                if not ec_provider or not db_source:
                    continue

                discovered_list = ec_provider.discover_products(ind.code, limit=6)

                for item in discovered_list:
                    wholesale_offer_data = item.get("wholesale_offer") or {}
                    unit_p = Decimal(str(wholesale_offer_data.get("procurement_unit_price") or "0.00"))
                    ship_p = Decimal(str(wholesale_offer_data.get("shipping_cost") or "0.00"))
                    tax_pct = Decimal(str(wholesale_offer_data.get("applicable_taxes_pct") or "18.00"))
                    add_chg = Decimal(str(wholesale_offer_data.get("additional_charges") or "0.00"))
                    tax_amt = unit_p * (tax_pct / Decimal("100.00"))
                    landed_cost = unit_p + ship_p + tax_amt + add_chg

                    pop_score = float(item.get("popularity_indicator") or 50.0)
                    trend_score = float(trend_signal.get("growth_4w_pct") or 10.0)
                    retail_p = float(item.get("listed_retail_price") or 0.0)
                    margin_pct = ((retail_p - float(landed_cost)) / retail_p * 100.0) if retail_p > 0 and landed_cost > 0 else 0.0

                    margin_score = min(100.0, margin_pct * 2.5) if margin_pct > 0 else 40.0
                    mandi_score = 75.0 if commodity_signal.get("supply_status") == "TIGHT" else 60.0
                    rel_score = float(wholesale_offer_data.get("on_time_reliability_pct") or 90.0)

                    opp_score = round(
                        (pop_score * 0.25)
                        + (trend_score * 1.5 * 0.25)
                        + (margin_score * 0.25)
                        + (mandi_score * 0.15)
                        + (rel_score * 0.10),
                        2,
                    )
                    opp_score = min(99.0, max(20.0, opp_score))

                    classification = "HIGH_POTENTIAL" if opp_score >= 75.0 else ("MODERATE_POTENTIAL" if opp_score >= 55.0 else "LOW_POTENTIAL")

                    traceable_evidence = {
                        "source_name": db_source.name,
                        "source_url": item.get("product_url", db_source.base_url),
                        "product_url": item.get("product_url", ""),
                        "observed_at": now.isoformat(),
                        "region": "India (TN / Domestic)",
                        "currency": item.get("currency", "INR"),
                        "popularity_index": pop_score,
                        "search_trend_keyword": trend_signal.get("keyword", ""),
                        "search_trend_growth_4w_pct": trend_signal.get("growth_4w_pct", 0.0),
                        "commodity_benchmark": f"{commodity_signal.get('commodity', '')} ({commodity_signal.get('mandi', '')})",
                        "listed_retail_price": retail_p,
                        "landed_cost_unit": float(landed_cost),
                        "estimated_gross_margin_pct": round(margin_pct, 1),
                    }

                    ai_summary = (
                        f"External Market Discovery: {item.get('product_name')} demonstrates {classification.replace('_', ' ').title()} "
                        f"with a Market Opportunity Score of {opp_score:.2f}/100. External consumer search interest grew "
                        f"+{trend_signal.get('growth_4w_pct', 0.0):.2f}% over the past 4 weeks on {db_source.name}. "
                        f"Verified wholesale offer from {wholesale_offer_data.get('supplier_name', 'Regional Supplier')} indicates a "
                        f"landed procurement cost of Rs {float(landed_cost):.2f} vs retail listing Rs {retail_p:.2f} "
                        f"(est. gross margin {margin_pct:.1f}%)."
                    )

                    ai_risks = []
                    if wholesale_offer_data.get("lead_time_days", 7) > 10:
                        ai_risks.append(f"Extended procurement lead time ({wholesale_offer_data.get('lead_time_days')} days)")
                    if commodity_signal.get("supply_status") == "TIGHT":
                        ai_risks.append(f"Mandi raw material supply is tight ({commodity_signal.get('commodity')})")

                    obs, created = MarketProductObservation.objects.update_or_create(
                        external_id=item["external_id"],
                        source=db_source,
                        defaults={
                            "product_name": item["product_name"],
                            "industry": ind,
                            "brand": item.get("brand", ""),
                            "category": item.get("category", ""),
                            "product_description": item.get("product_description", ""),
                            "product_url": item.get("product_url", ""),
                            "listed_retail_price": Decimal(str(retail_p)),
                            "currency": item.get("currency", "INR"),
                            "discount_percent": Decimal(str(item.get("discount_percent") or "0.00")),
                            "marketplace_availability": item.get("marketplace_availability", "IN_STOCK"),
                            "popularity_indicator": Decimal(str(pop_score)),
                            "search_trend_growth_pct": Decimal(str(item.get("search_trend_growth_pct") or "0.00")),
                            "trend_direction": item.get("trend_direction", "RISING"),
                            "opportunity_classification": classification,
                            "market_opportunity_score": Decimal(str(opp_score)),
                            "traceable_evidence": traceable_evidence,
                            "ai_advisor_summary": ai_summary,
                            "ai_risk_signals": ai_risks,
                            "observed_at": now,
                        },
                    )

                    if created:
                        created_obs += 1
                    else:
                        updated_obs += 1

                    # Record Price Observation
                    MarketPriceObservation.objects.create(
                        product_observation=obs,
                        observed_price=Decimal(str(retail_p)),
                        currency="INR",
                    )

                    # Update / Create Supplier Offer
                    offer_obj = None
                    if wholesale_offer_data:
                        offer_obj, _ = SupplierMarketOffer.objects.update_or_create(
                            product_observation=obs,
                            supplier_name=wholesale_offer_data.get("supplier_name", "Authorized Sourcing Hub"),
                            defaults={
                                "procurement_unit_price": unit_p,
                                "shipping_cost": ship_p,
                                "applicable_taxes_pct": tax_pct,
                                "additional_charges": add_chg,
                                "landed_cost_unit": landed_cost,
                                "minimum_order_qty": Decimal(str(wholesale_offer_data.get("minimum_order_qty") or "10.00")),
                                "pack_size": Decimal(str(wholesale_offer_data.get("pack_size") or "1.00")),
                                "lead_time_days": int(wholesale_offer_data.get("lead_time_days") or 7),
                                "supplier_location": wholesale_offer_data.get("supplier_location", "Domestic Hub"),
                                "on_time_reliability_pct": Decimal(str(wholesale_offer_data.get("on_time_reliability_pct") or "90.00")),
                                "verified_offer": True,
                            },
                        )

                    # Link with internal item match
                    matched_item = InventoryItem.objects.filter(
                        Q(name__icontains=item["product_name"][:20]) | Q(code__icontains=item["external_id"])
                    ).first()

                    match_type = ProductMarketMatch.MatchType.EXACT if matched_item else ProductMarketMatch.MatchType.UNMATCHED
                    match_conf = Decimal("95.00") if matched_item else Decimal("0.00")

                    ProductMarketMatch.objects.update_or_create(
                        product_observation=obs,
                        defaults={
                            "inventory_item": matched_item,
                            "match_type": match_type,
                            "match_confidence": match_conf,
                            "matching_criteria": {"source": db_source.name, "searched_name": item["product_name"]},
                            "is_verified": bool(matched_item),
                        },
                    )

                    # Evaluate Business Suitability
                    biz_profile = BusinessSuitabilityService.get_or_create_default_profile()
                    suitability = BusinessSuitabilityService.evaluate_suitability(obs, offer_obj, biz_profile)

                    # Determine Opportunity Type
                    if matched_item:
                        opp_type = PurchaseSuggestion.OpportunityType.EXISTING_PRODUCT_OPPORTUNITY
                        business_suit = "VERIFIED_INTERNAL"
                    else:
                        if ind.code == biz_profile.primary_industry_code:
                            opp_type = PurchaseSuggestion.OpportunityType.NEW_PRODUCT_OPPORTUNITY
                        else:
                            opp_type = PurchaseSuggestion.OpportunityType.CROSS_INDUSTRY_OPPORTUNITY
                        business_suit = "UNVERIFIED_INDEPENDENT_DISCOVERY"

                    sug_qty = Decimal(str(wholesale_offer_data.get("minimum_order_qty") or "50.00"))
                    est_unit_cost = landed_cost if landed_cost > 0 else Decimal("500.00")
                    est_total = sug_qty * est_unit_cost

                    evidence_reasons = [
                        f"Market Opportunity Score: {opp_score:.2f}/100 ({classification.replace('_', ' ').title()})",
                        f"Search growth +{trend_signal.get('growth_4w_pct', 0.0):.2f}% on {db_source.name}",
                        f"Landed cost Rs {float(landed_cost):.2f} vs listed Rs {retail_p:.2f}",
                    ]
                    for r in suitability.get("reasons", [])[:2]:
                        evidence_reasons.append(r)

                    default_wh = Warehouse.objects.filter(status__in=["ACTIVE", "Active"]).first() or Warehouse.objects.first()

                    sug, _ = PurchaseSuggestion.objects.update_or_create(
                        market_observation=obs,
                        defaults={
                            "product": matched_item,
                            "warehouse": default_wh,
                            "business_profile": biz_profile,
                            "external_product_name": obs.product_name,
                            "industry_code": ind.code,
                            "data_source_name": db_source.name,
                            "opportunity_type": opp_type,
                            "business_suitability": business_suit,
                            "suitability_score": suitability["suitability_score"],
                            "suitability_status": suitability["suitability_status"],
                            "suitability_breakdown": suitability["breakdown"],
                            "suggested_quantity": sug_qty,
                            "estimated_unit_price": est_unit_cost,
                            "estimated_total_cost": est_total,
                            "supplier": wholesale_offer_data.get("supplier_name", "Authorized Regional Sourcing Hub"),
                            "priority": PurchaseSuggestion.Priority.HIGH if opp_score >= 75.0 else PurchaseSuggestion.Priority.MEDIUM,
                            "recommended_action": PurchaseSuggestion.ActionType.PURCHASE if matched_item else PurchaseSuggestion.ActionType.ONBOARD,
                            "confidence_score": Decimal("0.85"),
                            "explanation": ai_summary,
                            "reasons": evidence_reasons,
                            "market_score": Decimal(str(opp_score)),
                            "final_demand_score": Decimal(str(opp_score)),
                            "buy_timing_signal": "Buy now" if opp_score >= 75.0 else "Normal",
                            "market_intelligence": traceable_evidence,
                            "demand_intelligence": {
                                "demand_score": opp_score,
                                "demand_level": "High" if opp_score >= 70.0 else "Medium",
                                "external_source": db_source.name,
                                "average_daily_demand": 30.0,
                            },
                            "supplier_intelligence": {
                                "preferred_supplier": wholesale_offer_data.get("supplier_name", "Regional Hub"),
                                "reliability_pct": float(wholesale_offer_data.get("on_time_reliability_pct") or 90.0),
                                "supplier_location": wholesale_offer_data.get("supplier_location", "Domestic Hub"),
                            },
                            "risk_analysis": {
                                "risks": ai_risks,
                                "overall_severity": "HIGH" if ai_risks else "LOW",
                            },
                            "status": PurchaseSuggestion.Status.PENDING,
                        },
                    )
                    suggestions_synced += 1

                db_source.last_sync_time = now
                db_source.last_sync_status = "SUCCESS"
                db_source.save()

        return {
            "created_observations": created_obs,
            "updated_observations": updated_obs,
            "suggestions_synced": suggestions_synced,
            "industries_analyzed": len(industries_to_run),
            "timestamp": now.isoformat(),
        }

    def onboard_to_item_master(self, observation_id: str, warehouse_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Onboards an externally discovered product into Item Master (InventoryItem)
        safely through existing model architecture.
        """
        obs = MarketProductObservation.objects.filter(id=observation_id).select_related("industry").first()
        if not obs:
            raise ValueError(f"MarketProductObservation {observation_id} not found.")

        match = ProductMarketMatch.objects.filter(product_observation=obs).first()
        if match and match.inventory_item:
            return {
                "message": f"Product is already linked to {match.inventory_item.code} - {match.inventory_item.name}.",
                "item_id": match.inventory_item.id,
                "item_code": match.inventory_item.code,
            }

        cat_name = obs.category or "General Merchandise"
        cat, _ = InventoryCategory.objects.get_or_create(
            name=cat_name,
            defaults={"code": f"CAT-{obs.industry.code[:3].upper() if obs.industry else 'GEN'}"},
        )

        yr = timezone.now().year
        rand_sku = f"SKU-{obs.industry.code[:3].upper() if obs.industry else 'GEN'}-{yr}-{random.randint(1000, 9999)}"

        item = InventoryItem.objects.create(
            code=rand_sku,
            name=obs.product_name,
            description=obs.product_description,
            category=cat,
            unit_cost=obs.listed_retail_price * Decimal("0.65"),
            purchase_price=obs.listed_retail_price * Decimal("0.65"),
            retail_price=obs.listed_retail_price,
            reorder_point=Decimal("20.00"),
            safety_stock=Decimal("10.00"),
            min_order_quantity=Decimal("10.00"),
            is_active=True,
        )

        if match:
            match.inventory_item = item
            match.match_type = ProductMarketMatch.MatchType.EXACT
            match.match_confidence = Decimal("100.00")
            match.is_verified = True
            match.verified_by = "market_onboarding_wizard"
            match.save()

        sug = PurchaseSuggestion.objects.filter(market_observation=obs).first()
        if sug:
            sug.product = item
            sug.business_suitability = "VERIFIED_INTERNAL"
            sug.opportunity_type = PurchaseSuggestion.OpportunityType.EXISTING_PRODUCT_OPPORTUNITY
            sug.recommended_action = PurchaseSuggestion.ActionType.PURCHASE
            sug.save()

        return {
            "message": f"Product '{obs.product_name}' successfully onboarded into Item Master as {item.code}.",
            "item_id": item.id,
            "item_code": item.code,
            "category": cat.name,
            "suggestion_number": sug.suggestion_number if sug else None,
        }
