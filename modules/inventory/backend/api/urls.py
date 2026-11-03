from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    BrandViewSet,
    UnitOfMeasureViewSet,
    ItemViewSet,
    WarehouseViewSet,
    StorageLocationViewSet,
    RackViewSet,
    BinViewSet,
    WarehouseConfigurationViewSet,
    StockBalanceViewSet,
    StockLedgerViewSet,
    StockTransactionViewSet,
    ValuationViewSet,
    StockReservationViewSet,
    StockCountViewSet,
    DamagedStockViewSet,
    StockInTransitViewSet,
    BatchViewSet,
    BatchQuarantineViewSet,
    BatchMovementViewSet,
    SerialNumberViewSet,
    SerialMovementViewSet,
    DashboardKPIView,
    ReorderRuleViewSet,
    StockLevelViewSet,
    ReplenishmentPlanViewSet,
    PurchaseSuggestionViewSet,
    StockForecastViewSet,
    CycleCountViewSet,
    FullStockCountViewSet,
    AuditHistoryViewSet,
)

router = DefaultRouter()
router.register(r"categories", CategoryViewSet)
router.register(r"brands", BrandViewSet)
router.register(r"units", UnitOfMeasureViewSet)
router.register(r"items", ItemViewSet)
router.register(r"warehouses", WarehouseViewSet)
router.register(r"locations", StorageLocationViewSet)
router.register(r"racks", RackViewSet)
router.register(r"bins", BinViewSet)
router.register(r"warehouse-config", WarehouseConfigurationViewSet, basename="warehouse-config")
router.register(r"balances", StockBalanceViewSet)
router.register(r"ledger", StockLedgerViewSet)
router.register(r"movements", StockTransactionViewSet)
router.register(r"reservations", StockReservationViewSet)
router.register(r"reconciliation", StockCountViewSet)
router.register(r"damaged-stock", DamagedStockViewSet)
router.register(r"transit", StockInTransitViewSet, basename="transit")
router.register(r"batches", BatchViewSet)
router.register(r"batch-quarantines", BatchQuarantineViewSet, basename="batch-quarantine")
router.register(r"batch-movements", BatchMovementViewSet, basename="batch-movement")
router.register(r"serials", SerialNumberViewSet)
router.register(r"serial-movements", SerialMovementViewSet, basename="serial-movement")
router.register(r"valuation", ValuationViewSet)
router.register(r"planning/reorder-rules", ReorderRuleViewSet, basename="reorder-rules")
router.register(r"planning/stock-levels", StockLevelViewSet, basename="stock-levels")
router.register(r"planning/replenishment-plans", ReplenishmentPlanViewSet, basename="replenishment-plans")
router.register(r"planning/purchase-suggestions", PurchaseSuggestionViewSet, basename="purchase-suggestions")
router.register(r"planning/stock-forecast", StockForecastViewSet, basename="stock-forecast")
router.register(r"audit/stock-counts", StockCountViewSet, basename="audit-stock-counts")
router.register(r"audit/cycle-counts", CycleCountViewSet, basename="audit-cycle-counts")
router.register(r"audit/full-counts", FullStockCountViewSet, basename="audit-full-counts")
router.register(r"audit/variances", StockCountViewSet, basename="audit-variances")
router.register(r"audit/history", AuditHistoryViewSet, basename="audit-history")

urlpatterns = [
    path("dashboard/kpis/", DashboardKPIView.as_view(), name="inventory-dashboard-kpis"),
    path("", include(router.urls)),
]
