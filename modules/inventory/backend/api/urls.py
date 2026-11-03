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
    SerialNumberViewSet,
    DashboardKPIView,
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
router.register(r"serials", SerialNumberViewSet)
router.register(r"valuation", ValuationViewSet)

urlpatterns = [
    path("dashboard/kpis/", DashboardKPIView.as_view(), name="inventory-dashboard-kpis"),
    path("", include(router.urls)),
]
