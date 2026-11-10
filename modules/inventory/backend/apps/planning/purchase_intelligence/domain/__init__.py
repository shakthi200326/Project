"""
Purchase Intelligence Domain Layer.
Decoupled, industry-agnostic micro-domain modules for:
- Internal inventory positions and days of supply
- Statistical demand forecasting and replenishment thresholds
- MCDM supplier matrix evaluation
- Multi-warehouse surplus & transfer optimization
- Decoupled business suitability and financial headroom checks
- Eight-category deterministic recommendation classification
- Purchase recommendation orchestration
- Non-destructive scenario simulation
"""

from apps.planning.purchase_intelligence.domain.internal.position_service import PositionAnalysisService
from apps.planning.purchase_intelligence.domain.forecasting.forecasting_engine import DemandForecastingEngine
from apps.planning.purchase_intelligence.domain.forecasting.replenishment_targets import ReplenishmentIntelligenceService
from apps.planning.purchase_intelligence.domain.suppliers.mcdm_evaluator import SupplierMCDMEvaluator
from apps.planning.purchase_intelligence.domain.multi_warehouse.transfer_optimizer import TransferOptimizationService
from apps.planning.purchase_intelligence.domain.suitability.business_fit import BusinessSuitabilityEngine
from apps.planning.purchase_intelligence.domain.engine.eight_category_classifier import (
    EightCategoryClassifier,
    RecommendationCategory,
)
from apps.planning.purchase_intelligence.domain.engine.recommendation_generator import PurchaseIntelligenceOrchestrator
from apps.planning.purchase_intelligence.domain.engine.simulator import ScenarioSimulatorService

__all__ = [
    "PositionAnalysisService",
    "DemandForecastingEngine",
    "ReplenishmentIntelligenceService",
    "SupplierMCDMEvaluator",
    "TransferOptimizationService",
    "BusinessSuitabilityEngine",
    "EightCategoryClassifier",
    "RecommendationCategory",
    "PurchaseIntelligenceOrchestrator",
    "ScenarioSimulatorService",
]
