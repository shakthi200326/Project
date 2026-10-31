from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    ItemViewSet,
    WarehouseViewSet,
    StorageLocationViewSet,
    StockBalanceViewSet,
    StockLedgerViewSet,
    StockTransactionViewSet,
    ValuationViewSet,
    DashboardKPIView,
)

router = DefaultRouter()
router.register(r"categories", CategoryViewSet)
router.register(r"items", ItemViewSet)
router.register(r"warehouses", WarehouseViewSet)
router.register(r"locations", StorageLocationViewSet)
router.register(r"balances", StockBalanceViewSet)
router.register(r"ledger", StockLedgerViewSet)
router.register(r"movements", StockTransactionViewSet)
router.register(r"valuation", ValuationViewSet)

urlpatterns = [
    path("dashboard/kpis/", DashboardKPIView.as_view(), name="inventory-dashboard-kpis"),
    path("", include(router.urls)),
]
