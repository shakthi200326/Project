from .report_views import (
    StockSummaryReportView,
    StockMovementReportView,
    StockLedgerReportView,
    StockValuationReportView,
    LowStockReportView,
    StockAgeingReportView,
    ExpiryReportView,
    WarehouseReportView,
)
from django.urls import path, include
from rest_framework.routers import DefaultRouter, SimpleRouter
from .views import (
    CategoryViewSet,
    BrandViewSet,
    UnitOfMeasureViewSet,
    ItemViewSet,
    ItemVariantViewSet,
    ProductImportHistoryViewSet,
    ProductAttributeViewSet,
    ProductBarcodeViewSet,
    ProductUnitConversionViewSet,
    WarehouseViewSet,
    WarehouseZoneViewSet,
    WarehouseMappingViewSet,
    WarehouseOperationalConfigurationViewSet,
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
    StockOperationsSettingsViewSet,
    StockReclassificationViewSet,
    ShelfLifePolicyViewSet,
    ProductRecallViewSet,
    AllocationViewSet,
    TraceabilityViewSet,
)
from .goods_receipt_views import (
    GoodsReceiptViewSet,
    ReceiptLineViewSet,
    ReceiptInspectionViewSet,
    QualityInspectionViewSet,
    ReceiptPutawayViewSet,
    ReceiptDiscrepancyViewSet,
    GoodsReceiptSettingsViewSet,
    GoodsReceiptLookupViewSet,
)
from .transfer_views import StockTransferViewSet
from .recommendation_views import (
    PurchaseRecommendationViewSet,
    ReplenishmentPolicyViewSet,
    RecommendationConfigurationViewSet,
    SupplierProductProfileViewSet,
    IndustryProfileViewSet,
    MarketDataProviderViewSet,
    MarketTrendViewSet,
    ExternalMarketProductViewSet,
    AnalysisExecutionHistoryViewSet,
)
from .configuration_views import (
    InventoryConfigurationView,
    DocumentNumberingViewSet,
    ConfigurationAuditLogListView,
)
from apps.integration.views import (
    InventoryAlertListView,
    InventoryAlertReadView,
    NotificationSettingsView,
)

grn_router = SimpleRouter()
grn_router.register(r"goods-receipt/receipts", GoodsReceiptViewSet, basename="grn-receipts")
grn_router.register(r"goods-receipt/lines", ReceiptLineViewSet, basename="grn-lines")
grn_router.register(r"goods-receipt/inspections", ReceiptInspectionViewSet, basename="grn-inspections")
grn_router.register(r"goods-receipt/quality-inspections", QualityInspectionViewSet, basename="grn-quality-inspections")
grn_router.register(r"goods-receipt/putaways", ReceiptPutawayViewSet, basename="grn-putaways")
grn_router.register(r"goods-receipt/discrepancies", ReceiptDiscrepancyViewSet, basename="grn-discrepancies")
grn_router.register(r"goods-receipt/settings", GoodsReceiptSettingsViewSet, basename="grn-settings")
grn_router.register(r"goods-receipt/lookups", GoodsReceiptLookupViewSet, basename="grn-lookups")

router = DefaultRouter()
router.register(r"categories", CategoryViewSet)
router.register(r"brands", BrandViewSet)
router.register(r"units", UnitOfMeasureViewSet)
router.register(r"items", ItemViewSet)
router.register(r"variants", ItemVariantViewSet, basename="variants")
router.register(r"import-history", ProductImportHistoryViewSet, basename="import-history")
router.register(r"attributes", ProductAttributeViewSet, basename="attributes")
router.register(r"product-barcodes", ProductBarcodeViewSet, basename="product-barcodes")
router.register(r"product-uom-conversions", ProductUnitConversionViewSet, basename="product-uom-conversions")
router.register(r"warehouses", WarehouseViewSet)
router.register(r"zones", WarehouseZoneViewSet, basename="zones")
router.register(r"warehouse-mappings", WarehouseMappingViewSet, basename="warehouse-mappings")
router.register(r"warehouse-operational-config", WarehouseOperationalConfigurationViewSet, basename="warehouse-operational-config")
router.register(r"locations", StorageLocationViewSet)
router.register(r"storage-locations", StorageLocationViewSet, basename="storage-locations")
router.register(r"racks", RackViewSet)
router.register(r"bins", BinViewSet)
router.register(r"warehouse-config", WarehouseConfigurationViewSet, basename="warehouse-config")
router.register(r"balances", StockBalanceViewSet)
router.register(r"stock-balances", StockBalanceViewSet, basename="stock-balances")
router.register(r"ledger", StockLedgerViewSet)
router.register(r"stock-ledger", StockLedgerViewSet, basename="stock-ledger")
router.register(r"movements", StockTransactionViewSet)
router.register(r"transactions", StockTransactionViewSet, basename="transactions")
router.register(r"transfers", StockTransferViewSet, basename="transfers")
router.register(r"reservations", StockReservationViewSet)
router.register(r"reconciliation", StockCountViewSet)
router.register(r"damaged-stock", DamagedStockViewSet)
router.register(r"transit", StockInTransitViewSet, basename="transit")
router.register(r"in-transit", StockInTransitViewSet, basename="in-transit")
router.register(r"batches", BatchViewSet)
router.register(r"batch-quarantines", BatchQuarantineViewSet, basename="batch-quarantine")
router.register(r"batch-movements", BatchMovementViewSet, basename="batch-movement")
router.register(r"serials", SerialNumberViewSet)
router.register(r"serial-movements", SerialMovementViewSet, basename="serial-movement")
router.register(r"tracking/shelf-life-policies", ShelfLifePolicyViewSet, basename="tracking-shelf-life-policies")
router.register(r"shelf-life-policies", ShelfLifePolicyViewSet, basename="shelf-life-policies")
router.register(r"tracking/recalls", ProductRecallViewSet, basename="tracking-product-recalls")
router.register(r"product-recalls", ProductRecallViewSet, basename="product-recalls")
router.register(r"tracking/allocations", AllocationViewSet, basename="tracking-allocations")
router.register(r"allocations", AllocationViewSet, basename="allocations")
router.register(r"tracking/traceability", TraceabilityViewSet, basename="tracking-traceability")
router.register(r"traceability", TraceabilityViewSet, basename="traceability")
router.register(r"valuation", ValuationViewSet)
router.register(r"planning/reorder-rules", ReorderRuleViewSet, basename="reorder-rules")
router.register(r"planning/stock-levels", StockLevelViewSet, basename="stock-levels")
router.register(r"stock-levels", StockLevelViewSet, basename="stock-levels-root")
router.register(r"planning/replenishment-plans", ReplenishmentPlanViewSet, basename="replenishment-plans")
router.register(r"planning/purchase-suggestions", PurchaseSuggestionViewSet, basename="purchase-suggestions")
router.register(r"planning/purchase-recommendations", PurchaseRecommendationViewSet, basename="purchase-recommendations")
router.register(r"planning/replenishment-policies", ReplenishmentPolicyViewSet, basename="replenishment-policies")
router.register(r"planning/recommendation-configs", RecommendationConfigurationViewSet, basename="recommendation-configs")
router.register(r"planning/supplier-profiles", SupplierProductProfileViewSet, basename="supplier-profiles")
router.register(r"planning/industry-profiles", IndustryProfileViewSet, basename="industry-profiles")
router.register(r"planning/market-providers", MarketDataProviderViewSet, basename="market-providers")
router.register(r"planning/market-trends", MarketTrendViewSet, basename="market-trends")
router.register(r"planning/external-products", ExternalMarketProductViewSet, basename="external-products")
router.register(r"planning/analysis-history", AnalysisExecutionHistoryViewSet, basename="analysis-history")
router.register(r"planning/stock-forecast", StockForecastViewSet, basename="stock-forecast")
router.register(r"audit/stock-counts", StockCountViewSet, basename="audit-stock-counts")
router.register(r"audit/cycle-counts", CycleCountViewSet, basename="audit-cycle-counts")
router.register(r"audit/full-counts", FullStockCountViewSet, basename="audit-full-counts")
router.register(r"audit/variances", StockCountViewSet, basename="audit-variances")
router.register(r"audit/history", AuditHistoryViewSet, basename="audit-history")
router.register(r"configuration/document-numbering", DocumentNumberingViewSet, basename="config-doc-numbering")
router.register(r"operations/settings", StockOperationsSettingsViewSet, basename="operations-settings")
router.register(r"operations/reclassification", StockReclassificationViewSet, basename="operations-reclassification")

urlpatterns = [
    path("dashboard/kpis/", DashboardKPIView.as_view(), name="inventory-dashboard-kpis"),
    path("reports/stock-summary/", StockSummaryReportView.as_view(), name="report-stock-summary"),
    path("reports/stock-movement/", StockMovementReportView.as_view(), name="report-stock-movement"),
    path("reports/stock-ledger/", StockLedgerReportView.as_view(), name="report-stock-ledger"),
    path("reports/valuation/", StockValuationReportView.as_view(), name="report-valuation"),
    path("reports/low-stock/", LowStockReportView.as_view(), name="report-low-stock"),
    path("reports/ageing/", StockAgeingReportView.as_view(), name="report-ageing"),
    path("reports/expiry/", ExpiryReportView.as_view(), name="report-expiry"),
    path("reports/warehouse/", WarehouseReportView.as_view(), name="report-warehouse"),
    path("configuration/global/", InventoryConfigurationView.as_view(), name="configuration-global"),
    path("configuration/audit-log/", ConfigurationAuditLogListView.as_view(), name="configuration-audit-log"),
    path("notifications/settings/", NotificationSettingsView.as_view(), name="notification-settings"),
    path("notifications/alerts/", InventoryAlertListView.as_view(), name="inventory-alerts"),
    path("notifications/alerts/read-all/", InventoryAlertReadView.as_view(), name="inventory-alerts-read-all"),
    path("notifications/alerts/<int:alert_id>/read/", InventoryAlertReadView.as_view(), name="inventory-alert-read"),
    path("integrations/", include("apps.integration.urls")),
    path("", include(grn_router.urls)),
    path("", include(router.urls)),
]
