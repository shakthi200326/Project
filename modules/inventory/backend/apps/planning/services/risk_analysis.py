"""
Risk Analysis Service for Purchase Intelligence.
Calculates multi-dimensional risk scores across supply dependency,
lead-time volatility, stockout probability, and inventory exposure.
"""
from typing import Dict, Any, List


class RiskAnalysisService:

    @classmethod
    def analyze_risks(
        cls,
        stock_profile: Dict[str, Any],
        demand_intel: Dict[str, Any],
        supplier_intel: Dict[str, Any],
        market_intel: Dict[str, Any],
        overstock_intel: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Synthesizes indicators into an objective, evidence-based risk assessment:
        - Stockout Risk: Severity and timeline if not replenished
        - Supplier Delay Risk: Lead time vs on-time performance
        - Market Price Volatility Risk: Price spikes in market intelligence
        - Overstock / Expiry Risk: Capital tie-up or excessive stock
        """
        risk_factors: List[Dict[str, str]] = []
        overall_severity = "LOW"
        risk_score = 20  # Base scale 0 - 100

        avail = stock_profile["available_stock"]
        pipeline = stock_profile["incoming_purchase_qty"] + stock_profile["in_transit_transfer_qty"]
        daily = demand_intel["average_daily_demand"]
        lead_time = supplier_intel["preferred_lead_time"]

        # 1. Stockout Risk Assessment
        days_until_stockout = round(avail / max(0.01, daily), 1) if daily > 0 else 999.0
        if days_until_stockout <= lead_time:
            risk_score += 40
            risk_factors.append({
                "category": "Stockout Risk",
                "severity": "CRITICAL" if days_until_stockout <= 3 else "HIGH",
                "detail": f"Available stock covers only {days_until_stockout} days, while supplier lead time is {lead_time} days. Immediate order required to prevent stockout.",
                "mitigation": "Expedite purchase order or execute emergency warehouse transfer.",
            })
        elif days_until_stockout <= lead_time * 1.5:
            risk_score += 20
            risk_factors.append({
                "category": "Stockout Risk",
                "severity": "MEDIUM",
                "detail": f"Stock coverage ({days_until_stockout} days) is approaching replenishment horizon ({lead_time} days).",
                "mitigation": "Place replenishment order within standard planning window.",
            })

        # 2. Supplier Reliability Risk
        on_time = supplier_intel["options"][0].get("on_time_rate", 95.0) if supplier_intel.get("options") else 95.0
        if on_time < 80.0:
            risk_score += 25
            risk_factors.append({
                "category": "Supplier Delay Risk",
                "severity": "HIGH",
                "detail": f"Preferred supplier on-time delivery rate is only {on_time}%. Significant risk of late arrival.",
                "mitigation": "Add buffer safety stock or split order across secondary supplier.",
            })
        elif on_time < 90.0:
            risk_score += 10
            risk_factors.append({
                "category": "Supplier Delay Risk",
                "severity": "MEDIUM",
                "detail": f"Supplier delivery reliability is {on_time}%. Occasional delivery delays observed.",
                "mitigation": "Monitor shipment tracking upon order dispatch.",
            })

        # 3. Market Volatility Risk
        if market_intel.get("is_available") and market_intel.get("trend_direction") == "INCREASING":
            pct = market_intel.get("price_change_pct_30d", 0.0)
            if pct > 10.0:
                risk_score += 15
                risk_factors.append({
                    "category": "Price Volatility Risk",
                    "severity": "MEDIUM",
                    "detail": f"Raw material / commodity price increased {pct:+.1f}% in the last 30 days.",
                    "mitigation": "Lock in supplier contract price or issue advance bulk purchase before further escalation.",
                })

        # 4. Overstock / Excess Capital Risk
        if overstock_intel.get("is_overstock_risk"):
            risk_score += 15
            risk_factors.append({
                "category": "Overstock Exposure Risk",
                "severity": "MEDIUM",
                "detail": f"Potential inventory holding excess ({overstock_intel.get('post_order_days_supply')} days coverage).",
                "mitigation": "Cap order quantity or schedule staggered deliveries.",
            })

        # Final Severity Mapping
        if risk_score >= 70:
            overall_severity = "CRITICAL"
        elif risk_score >= 50:
            overall_severity = "HIGH"
        elif risk_score >= 30:
            overall_severity = "MEDIUM"
        else:
            overall_severity = "LOW"

        return {
            "overall_severity": overall_severity,
            "risk_score": min(100, risk_score),
            "days_until_stockout": days_until_stockout if daily > 0 else "Unlimited",
            "risk_factors": risk_factors,
            "mitigation_summary": (
                risk_factors[0]["mitigation"] if risk_factors else "Regular monitoring; standard reorder protocols apply."
            ),
        }

