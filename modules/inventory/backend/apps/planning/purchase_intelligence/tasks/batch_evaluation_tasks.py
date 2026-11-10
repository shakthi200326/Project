import logging
from typing import Dict, Any, List, Optional
from django.utils import timezone

try:
    from celery import shared_task
except ImportError:
    # Fallback no-op decorator when celery is not installed in testing environments
    def shared_task(func):
        func.delay = func
        return func

from apps.warehouses.models import Warehouse
from apps.planning.purchase_intelligence.domain.engine.recommendation_generator import (
    PurchaseIntelligenceOrchestrator,
)

logger = logging.getLogger(__name__)


@shared_task
def evaluate_warehouse_recommendations_task(
    warehouse_id: int, user_actor: str = "celery_scheduler", tenant_id: str = "default"
) -> Dict[str, Any]:
    """
    Background worker task to evaluate replenishment positions and generate recommendations
    for a specific warehouse without blocking user interface requests.
    """
    try:
        warehouse = Warehouse.objects.get(id=warehouse_id)
        logger.info(f"Starting background recommendation evaluation for {warehouse.name} ({warehouse.code})")

        rec = PurchaseIntelligenceOrchestrator.generate_recommendations_for_warehouse(
            warehouse=warehouse, user_actor=user_actor, tenant_id=tenant_id
        )

        if rec:
            return {
                "success": True,
                "warehouse_id": warehouse.id,
                "recommendation_number": rec.recommendation_number,
                "items_count": rec.total_items_count,
                "total_outlay": float(rec.total_estimated_outlay),
                "status": rec.status,
            }
        else:
            return {
                "success": True,
                "warehouse_id": warehouse.id,
                "message": "Stock positions adequate across all SKUs; no purchase recommendations triggered.",
            }
    except Exception as exc:
        logger.exception(f"Error evaluating warehouse {warehouse_id}: {exc}")
        return {"success": False, "warehouse_id": warehouse_id, "error": str(exc)}


@shared_task
def nightly_batch_evaluation_job(tenant_id: str = "default") -> Dict[str, Any]:
    """
    Nightly cron job evaluating all active warehouses across the organization.
    Runs during off-peak hours to update daily replenishment requirements.
    """
    active_warehouses = Warehouse.objects.filter(status__in=["ACTIVE", "Active"])
    results = []

    for wh in active_warehouses:
        res = evaluate_warehouse_recommendations_task(
            warehouse_id=wh.id, user_actor="nightly_batch_job", tenant_id=tenant_id
        )
        results.append(res)

    return {
        "completed_at": timezone.now().isoformat(),
        "total_warehouses_evaluated": len(results),
        "results": results,
    }

