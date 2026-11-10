import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional
from django.db.models import Sum, Q

from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse
from apps.movements.models import StockTransaction, StockTransactionLine
from apps.goods_receipt.models import ReceiptInspection
from apps.planning.models import (
    SupplierProductProfile,
    RecommendationConfiguration,
)

logger = logging.getLogger(__name__)


class SupplierMCDMEvaluator:
    """
    Multi-Criteria Decision Matrix (MCDM) Supplier Evaluation & Selection Engine.
    Evaluates landed costs, quality acceptance rates, delivery reliability,
    and lead times, while actively flagging supply chain risks.
    """

    @classmethod
    def get_empirical_performance(
        cls, supplier_name: str, product: InventoryItem
    ) -> Dict[str, Any]:
        """
        Analyzes historical goods receipts and quality inspections for this supplier.
        Returns empirical on-time delivery rate, quality acceptance rate, and transaction count.
        """
        receipts = StockTransaction.objects.filter(
            transaction_type=StockTransaction.TransactionType.RECEIPT,
            supplier_reference__iexact=supplier_name.strip(),
            status__in=[
                StockTransaction.Status.COMPLETED,
                StockTransaction.Status.RECEIVED,
                StockTransaction.Status.ACCEPTED,
                StockTransaction.Status.POSTED,
            ],
            lines__item=product,
        ).distinct()

        total_receipts = receipts.count()
        if total_receipts == 0:
            return {
                "has_empirical_data": False,
                "receipt_count": 0,
                "empirical_on_time_pct": None,
                "empirical_quality_pct": None,
            }

        dated_receipts = receipts.filter(expected_date__isnull=False)
        dated_count = dated_receipts.count()
        if dated_count > 0:
            on_time_count = 0
            for r in dated_receipts:
                if r.transaction_date and r.expected_date and r.transaction_date <= r.expected_date:
                    on_time_count += 1
            empirical_on_time = round((on_time_count / dated_count) * 100.0, 2)
        else:
            empirical_on_time = 100.0

        inspections = ReceiptInspection.objects.filter(
            receipt__in=receipts,
            line__item=product,
        )
        total_inspected = inspections.aggregate(tot=Sum("inspection_quantity"))["tot"] or Decimal("0.0000")
        total_accepted = inspections.aggregate(tot=Sum("accepted_quantity"))["tot"] or Decimal("0.0000")

        if total_inspected > Decimal("0.0000"):
            empirical_quality = round(float((total_accepted / total_inspected) * Decimal("100.0")), 2)
        else:
            empirical_quality = None

        return {
            "has_empirical_data": True,
            "receipt_count": total_receipts,
            "empirical_on_time_pct": empirical_on_time,
            "empirical_quality_pct": empirical_quality,
        }

    @classmethod
    def evaluate_suppliers(
        cls,
        product: InventoryItem,
        required_qty: float,
        warehouse: Optional[Warehouse] = None,
        config: Optional[RecommendationConfiguration] = None,
    ) -> Dict[str, Any]:
        """
        Multi-criteria supplier evaluation matrix.
        Evaluates Price Competitiveness, Quality, On-Time Delivery, and Lead Time.
        Returns selected primary supplier, backup alternates, score breakdown, and risk flags.
        """
        qty = Decimal(str(max(1.0, required_qty)))

        w_price = float(config.supplier_weight_price if config else Decimal("0.35"))
        w_quality = float(config.supplier_weight_quality if config else Decimal("0.25"))
        w_delivery = float(config.supplier_weight_delivery if config else Decimal("0.25"))
        w_lead_time = float(config.supplier_weight_lead_time if config else Decimal("0.15"))
        min_quality_threshold = float(config.supplier_min_quality_score if config else Decimal("80.00"))
        min_delivery_threshold = float(config.supplier_min_delivery_rate if config else Decimal("80.00"))

        profiles = list(SupplierProductProfile.objects.filter(product=product, is_active=True))

        # 1. Fallback if no supplier profile exists in database
        if not profiles:
            unit_cost = float(getattr(product, "purchase_price", None) or getattr(product, "standard_cost", None) or 100.0)
            lead_time = int(product.lead_time_days or 7)
            total_est = round(unit_cost * float(qty), 2)
            default_supplier = "Standard Certified Vendor"

            return {
                "has_profiles": False,
                "preferred_supplier": default_supplier,
                "preferred_unit_price": unit_cost,
                "preferred_total_cost": total_est,
                "preferred_lead_time": lead_time,
                "currency": "INR",
                "price_opportunity_detected": False,
                "cost_saving_opportunity": 0.0,
                "primary_option": {
                    "supplier_name": default_supplier,
                    "unit_price": unit_cost,
                    "lead_time_days": lead_time,
                    "landed_cost_per_unit": unit_cost,
                    "total_cost": total_est,
                    "on_time_rate": 95.0,
                    "quality_score": 98.0,
                    "composite_score": 85.0,
                    "score_breakdown": {
                        "price_score": 85.0,
                        "quality_score": 98.0,
                        "delivery_score": 95.0,
                        "lead_time_score": 80.0,
                    },
                    "risk_flags": ["SINGLE_SOURCE_RISK", "UNMAPPED_SUPPLIER_PROFILE"],
                },
                "alternate_options": [],
                "all_options": [],
                "risk_flags": ["SINGLE_SOURCE_RISK", "UNMAPPED_SUPPLIER_PROFILE"],
                "recommendation_reason": "Evaluated using item master baseline standard costing and default lead time buffer.",
            }

        # 2. Compute landed costs and determine minimum landed cost for normalization
        temp_options = []
        for p in profiles:
            eval_qty = max(qty, p.minimum_order_qty)
            base_cost = p.unit_price * eval_qty
            tax_mult = Decimal("1.0") + (p.tax_rate_percent / Decimal("100.0"))
            total_landed = (base_cost + p.shipping_cost) * tax_mult
            landed_per_unit = total_landed / eval_qty

            temp_options.append({
                "profile": p,
                "eval_qty": eval_qty,
                "total_landed": float(total_landed),
                "landed_per_unit": float(landed_per_unit),
            })

        min_landed_unit = min(opt["landed_per_unit"] for opt in temp_options)
        min_lead_time = min(opt["profile"].lead_time_days for opt in temp_options)

        # 3. Score Each Supplier on Multi-Criteria Decision Matrix (MCDM)
        evaluated_options = []
        for opt in temp_options:
            p = opt["profile"]
            landed_unit = opt["landed_per_unit"]
            total_landed = opt["total_landed"]

            price_score = round((min_landed_unit / landed_unit) * 100.0, 2) if landed_unit > 0 else 100.0
            eff_quality = float(p.quality_acceptance_rate)
            eff_delivery = float(p.on_time_delivery_rate)

            lead_penalty = max(0, p.lead_time_days - min_lead_time) * 5.0
            lead_time_score = max(0.0, min(100.0, 100.0 - lead_penalty))

            composite_score = round(
                (w_price * price_score)
                + (w_quality * eff_quality)
                + (w_delivery * eff_delivery)
                + (w_lead_time * lead_time_score),
                2,
            )

            risk_flags = []
            if len(profiles) == 1:
                risk_flags.append("SINGLE_SOURCE_RISK")
            if eff_quality < min_quality_threshold:
                risk_flags.append("QUALITY_RISK_BELOW_THRESHOLD")
            if eff_delivery < min_delivery_threshold:
                risk_flags.append("DELIVERY_DELAY_RISK")
            if p.lead_time_days > 14:
                risk_flags.append("EXTENDED_LEAD_TIME_RISK")
            if qty < p.minimum_order_qty:
                risk_flags.append("ORDER_QTY_BELOW_MOQ")

            evaluated_options.append({
                "supplier_name": p.supplier_name,
                "unit_price": float(p.unit_price),
                "currency": p.currency,
                "lead_time_days": p.lead_time_days,
                "moq": float(p.minimum_order_qty),
                "pack_size": float(p.pack_size),
                "shipping_cost": float(p.shipping_cost),
                "tax_rate_percent": float(p.tax_rate_percent),
                "landed_cost_per_unit": round(landed_unit, 2),
                "total_cost": round(total_landed, 2),
                "on_time_rate": round(eff_delivery, 1),
                "quality_score": round(eff_quality, 1),
                "is_preferred": p.is_preferred,
                "composite_score": composite_score,
                "score_breakdown": {
                    "price_score": price_score,
                    "quality_score": round(eff_quality, 1),
                    "delivery_score": round(eff_delivery, 1),
                    "lead_time_score": lead_time_score,
                },
                "risk_flags": risk_flags,
            })

        # 4. Rank Options: Highest Composite Score first
        evaluated_options.sort(key=lambda x: (-x["composite_score"], x["total_cost"]))
        primary = evaluated_options[0]
        alternates = evaluated_options[1:]

        costs = [opt["total_cost"] for opt in evaluated_options]
        cost_saving = round(max(costs) - min(costs), 2) if len(costs) > 1 else 0.0
        all_risks = list(set([risk for opt in evaluated_options for risk in opt["risk_flags"]]))

        reasons = [
            f"Selected {primary['supplier_name']} with top composite score of {primary['composite_score']}/100 "
            f"(Price: {primary['score_breakdown']['price_score']}, Quality: {primary['quality_score']}%, Delivery: {primary['on_time_rate']}%).",
            f"Landed procurement cost is {primary['currency']} {primary['landed_cost_per_unit']}/unit with {primary['lead_time_days']} days lead time.",
        ]
        if primary["risk_flags"]:
            reasons.append(f"Noted supplier risk factors: {', '.join(primary['risk_flags'])}.")
        if alternates:
            reasons.append(f"{len(alternates)} qualified alternate supplier(s) available for contingency.")

        return {
            "has_profiles": True,
            "preferred_supplier": primary["supplier_name"],
            "preferred_unit_price": primary["unit_price"],
            "preferred_total_cost": primary["total_cost"],
            "preferred_lead_time": primary["lead_time_days"],
            "currency": primary["currency"],
            "price_opportunity_detected": cost_saving > 0.0,
            "cost_saving_opportunity": cost_saving,
            "primary_option": primary,
            "alternate_options": alternates,
            "all_options": evaluated_options,
            "options": evaluated_options,
            "risk_flags": all_risks,
            "recommendation_reason": " ".join(reasons),
        }

