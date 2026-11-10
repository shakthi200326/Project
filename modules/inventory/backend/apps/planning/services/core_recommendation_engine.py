"""
Core Recommendation Engine Compatibility Bridge.
Delegates to the decoupled Purchase Intelligence Domain Services:
- apps.planning.purchase_intelligence.domain.internal.position_service
- apps.planning.purchase_intelligence.domain.multi_warehouse.transfer_optimizer
- apps.planning.purchase_intelligence.domain.engine.recommendation_generator
Preserves full backward compatibility for existing viewsets, background tasks, and callers.
"""

import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional

from apps.products.models import InventoryItem, InventoryItemVariant
from apps.warehouses.models import Warehouse
from apps.planning.models import (
    RecommendationConfiguration,
    PurchaseRecommendation,
    PurchaseRecommendationItem,
)
from apps.planning.purchase_intelligence.domain.internal.position_service import PositionAnalysisService
from apps.planning.purchase_intelligence.domain.multi_warehouse.transfer_optimizer import TransferOptimizationService
from apps.planning.purchase_intelligence.domain.engine.recommendation_generator import PurchaseIntelligenceOrchestrator

logger = logging.getLogger(__name__)


class InventoryAnalyzerService:
    """
    Backward-compatible wrapper around PositionAnalysisService and TransferOptimizationService.
    """

    @classmethod
    def get_stock_position(
        cls,
        product: InventoryItem,
        warehouse: Warehouse,
        variant: Optional[InventoryItemVariant] = None,
    ) -> Dict[str, Any]:
        return PositionAnalysisService.get_stock_position(product, warehouse, variant=variant)

    @classmethod
    def check_warehouse_transfer_opportunity(
        cls,
        product: InventoryItem,
        destination_warehouse: Warehouse,
        deficit_quantity: Decimal,
        variant: Optional[InventoryItemVariant] = None,
    ) -> Optional[Dict[str, Any]]:
        eval_result = TransferOptimizationService.evaluate_inter_warehouse_transfers(
            product=product,
            destination_warehouse=destination_warehouse,
            required_quantity=deficit_quantity,
            variant=variant,
        )
        if eval_result.get("transfer_feasible"):
            return {
                "source_warehouse": eval_result.get("best_source_warehouse"),
                "transferable_quantity": eval_result.get("transferable_quantity"),
                "source_available": eval_result.get("candidates", [{}])[0].get("available_stock", 0.0),
                "source_safe_floor": eval_result.get("candidates", [{}])[0].get("safe_reserve_retained", 0.0),
            }
        return None


class CoreRecommendationEngine:
    """
    Backward-compatible wrapper around PurchaseIntelligenceOrchestrator.
    """

    @classmethod
    def get_or_create_config(cls, tenant_id: str = "default") -> RecommendationConfiguration:
        return PurchaseIntelligenceOrchestrator.get_or_create_config(tenant_id=tenant_id)

    @classmethod
    def evaluate_item_recommendation(
        cls,
        product: InventoryItem,
        warehouse: Warehouse,
        variant: Optional[InventoryItemVariant] = None,
        tenant_id: str = "default",
    ) -> Optional[Dict[str, Any]]:
        return PurchaseIntelligenceOrchestrator.evaluate_item_recommendation(
            product=product,
            warehouse=warehouse,
            variant=variant,
            tenant_id=tenant_id,
        )

    @classmethod
    def generate_recommendations_for_warehouse(
        cls,
        warehouse: Warehouse,
        user_actor: str = "system",
        tenant_id: str = "default",
    ) -> Optional[PurchaseRecommendation]:
        return PurchaseIntelligenceOrchestrator.generate_recommendations_for_warehouse(
            warehouse=warehouse,
            user_actor=user_actor,
            tenant_id=tenant_id,
        )
