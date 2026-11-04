import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@shared/shell-app/ThemeProvider.jsx";
import { WorkspaceProvider } from "@shared/shell-app/ContextSelector.jsx";
import { AppShell } from "@shared/shell-app/AppShell.jsx";
import LoadingState from "@ui/components/LoadingState.jsx";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";

// Lazy-loaded page components for optimal production chunking and lightning-fast load times
const DashboardPage = lazy(() => import("../pages/DashboardPage.jsx").then(m => ({ default: m.DashboardPage })));

const ProductOverviewPage = lazy(() => import("../pages/ProductOverviewPage.jsx").then(m => ({ default: m.ProductOverviewPage || m.default })));
const ProductVariantsPage = lazy(() => import("../pages/ProductVariantsPage.jsx").then(m => ({ default: m.ProductVariantsPage || m.default })));
const ProductAttributesPage = lazy(() => import("../pages/ProductAttributesPage.jsx").then(m => ({ default: m.ProductAttributesPage || m.default })));
const SkuManagementPage = lazy(() => import("../pages/SkuManagementPage.jsx").then(m => ({ default: m.SkuManagementPage || m.default })));
const ProductMediaPage = lazy(() => import("../pages/ProductMediaPage.jsx").then(m => ({ default: m.ProductMediaPage || m.default })));
const ProductImportPage = lazy(() => import("../pages/ProductImportPage.jsx").then(m => ({ default: m.ProductImportPage || m.default })));
const ProductExportPage = lazy(() => import("../pages/ProductExportPage.jsx").then(m => ({ default: m.ProductExportPage || m.default })));
const ProductImportHistoryPage = lazy(() => import("../pages/ProductImportHistoryPage.jsx").then(m => ({ default: m.ProductImportHistoryPage || m.default })));

const ProductsPage = lazy(() => import("../pages/ProductsPage.jsx").then(m => ({ default: m.ProductsPage })));
const CategoriesPage = lazy(() => import("../pages/CategoriesPage.jsx").then(m => ({ default: m.CategoriesPage })));
const BrandsPage = lazy(() => import("../pages/BrandsPage.jsx").then(m => ({ default: m.BrandsPage })));
const UnitsPage = lazy(() => import("../pages/UnitsPage.jsx").then(m => ({ default: m.UnitsPage })));
const BarcodesPage = lazy(() => import("../pages/BarcodesPage.jsx").then(m => ({ default: m.BarcodesPage })));
const WarehousesPage = lazy(() => import("../pages/WarehousesPage.jsx").then(m => ({ default: m.WarehousesPage })));
const LocationsPage = lazy(() => import("../pages/LocationsPage.jsx").then(m => ({ default: m.LocationsPage })));
const RackBinPage = lazy(() => import("../pages/RackBinPage.jsx").then(m => ({ default: m.RackBinPage })));
const WarehouseOverviewPage = lazy(() => import("../pages/WarehouseOverviewPage.jsx").then(m => ({ default: m.WarehouseOverviewPage || m.default })));
const WarehouseMappingPage = lazy(() => import("../pages/WarehouseMappingPage.jsx").then(m => ({ default: m.WarehouseMappingPage || m.default })));
const WarehouseZonesPage = lazy(() => import("../pages/WarehouseZonesPage.jsx").then(m => ({ default: m.WarehouseZonesPage || m.default })));
const WarehouseRacksPage = lazy(() => import("../pages/WarehouseRacksPage.jsx").then(m => ({ default: m.WarehouseRacksPage || m.default })));
const WarehouseBinsPage = lazy(() => import("../pages/WarehouseBinsPage.jsx").then(m => ({ default: m.WarehouseBinsPage || m.default })));
const WarehouseCapacityPage = lazy(() => import("../pages/WarehouseCapacityPage.jsx").then(m => ({ default: m.WarehouseCapacityPage || m.default })));
const LocationUtilizationPage = lazy(() => import("../pages/LocationUtilizationPage.jsx").then(m => ({ default: m.LocationUtilizationPage || m.default })));
const WarehouseConfigPage = lazy(() => import("../pages/WarehouseConfigPage.jsx").then(m => ({ default: m.WarehouseConfigPage || m.default })));
const StockMovementsPage = lazy(() => import("../pages/StockMovementsPage.jsx").then(m => ({ default: m.StockMovementsPage })));
const ReceiptRegisterPage = lazy(() => import("../pages/goods-receipt/ReceiptRegisterPage.jsx").then(m => ({ default: m.ReceiptRegisterPage })));
const ReceiptFormPage = lazy(() => import("../pages/goods-receipt/ReceiptFormPage.jsx").then(m => ({ default: m.ReceiptFormPage })));
const ReceiptDetailPage = lazy(() => import("../pages/goods-receipt/ReceiptDetailPage.jsx").then(m => ({ default: m.ReceiptDetailPage })));
const ReceiptInspectionPage = lazy(() => import("../pages/goods-receipt/ReceiptInspectionPage.jsx").then(m => ({ default: m.ReceiptInspectionPage })));
const QualityInspectionPage = lazy(() => import("../pages/goods-receipt/QualityInspectionPage.jsx").then(m => ({ default: m.QualityInspectionPage })));
const AcceptedGoodsPage = lazy(() => import("../pages/goods-receipt/ReceiptOutcomePages.jsx").then(m => ({ default: m.AcceptedGoodsPage })));
const RejectedGoodsPage = lazy(() => import("../pages/goods-receipt/ReceiptOutcomePages.jsx").then(m => ({ default: m.RejectedGoodsPage })));
const PartialAcceptancePage = lazy(() => import("../pages/goods-receipt/ReceiptOutcomePages.jsx").then(m => ({ default: m.PartialAcceptancePage })));
const PutawayManagementPage = lazy(() => import("../pages/goods-receipt/PutawayManagementPage.jsx").then(m => ({ default: m.PutawayManagementPage })));
const ReceiptDiscrepancyPage = lazy(() => import("../pages/goods-receipt/ReceiptDiscrepancyPage.jsx").then(m => ({ default: m.ReceiptDiscrepancyPage })));
const GoodsReceiptSettingsPage = lazy(() => import("../pages/goods-receipt/GoodsReceiptSettingsPage.jsx").then(m => ({ default: m.GoodsReceiptSettingsPage })));
const StockInPage = lazy(() => import("../pages/StockInPage.jsx").then(m => ({ default: m.StockInPage || m.default })));
const StockIssuePage = lazy(() => import("../pages/StockIssuePage.jsx").then(m => ({ default: m.StockIssuePage || m.default })));
const StockTransferPage = lazy(() => import("../pages/StockTransferPage.jsx").then(m => ({ default: m.StockTransferPage || m.default })));
const StockAdjustmentPage = lazy(() => import("../pages/StockAdjustmentPage.jsx").then(m => ({ default: m.StockAdjustmentPage || m.default })));
const OpeningStockPage = lazy(() => import("../pages/OpeningStockPage.jsx").then(m => ({ default: m.OpeningStockPage || m.default })));
const StockReleasePage = lazy(() => import("../pages/StockReleasePage.jsx").then(m => ({ default: m.StockReleasePage || m.default })));
const StockReclassificationPage = lazy(() => import("../pages/StockReclassificationPage.jsx").then(m => ({ default: m.StockReclassificationPage || m.default })));
const StockOutPage = lazy(() => import("../pages/StockOutPage.jsx").then(m => ({ default: m.StockOutPage || m.default })));
const StockOverviewPage = lazy(() => import("../pages/StockOverviewPage.jsx").then(m => ({ default: m.StockOverviewPage || m.default })));
const StockLedgerPage = lazy(() => import("../pages/StockLedgerPage.jsx").then(m => ({ default: m.StockLedgerPage })));
const StockInHistoryPage = lazy(() => import("../pages/StockInHistoryPage.jsx").then(m => ({ default: m.StockInHistoryPage })));
const StockOutHistoryPage = lazy(() => import("../pages/StockOutHistoryPage.jsx").then(m => ({ default: m.StockOutHistoryPage })));
const StockBalancesPage = lazy(() => import("../pages/StockBalancesPage.jsx").then(m => ({ default: m.StockBalancesPage })));
const DamagedStockPage = lazy(() => import("../pages/DamagedStockPage.jsx").then(m => ({ default: m.DamagedStockPage })));
const StockInTransitPage = lazy(() => import("../pages/StockInTransitPage.jsx").then(m => ({ default: m.StockInTransitPage })));
const ValuationPage = lazy(() => import("../pages/ValuationPage.jsx").then(m => ({ default: m.ValuationPage })));
const SettingsPage = lazy(() => import("../pages/SettingsPage.jsx").then(m => ({ default: m.SettingsPage })));
const ReconciliationPage = lazy(() => import("../pages/ReconciliationPage.jsx").then(m => ({ default: m.ReconciliationPage })));
const BatchTrackingPage = lazy(() => import("../pages/BatchTrackingPage.jsx").then(m => ({ default: m.BatchTrackingPage })));
const SerialTrackingPage = lazy(() => import("../pages/SerialTrackingPage.jsx").then(m => ({ default: m.SerialTrackingPage })));
const BatchManagementPage = lazy(() => import("../pages/BatchManagementPage.jsx").then(m => ({ default: m.BatchManagementPage || m.default })));
const BatchMovementHistoryPage = lazy(() => import("../pages/BatchMovementHistoryPage.jsx").then(m => ({ default: m.BatchMovementHistoryPage || m.default })));
const BatchQuarantinePage = lazy(() => import("../pages/BatchQuarantinePage.jsx").then(m => ({ default: m.BatchQuarantinePage || m.default })));
const BatchReleasePage = lazy(() => import("../pages/BatchReleasePage.jsx").then(m => ({ default: m.BatchReleasePage || m.default })));
const ExpiryManagementPage = lazy(() => import("../pages/ExpiryManagementPage.jsx").then(m => ({ default: m.ExpiryManagementPage || m.default })));
const SerialManagementPage = lazy(() => import("../pages/SerialManagementPage.jsx").then(m => ({ default: m.SerialManagementPage || m.default })));
const SerialMovementHistoryPage = lazy(() => import("../pages/SerialMovementHistoryPage.jsx").then(m => ({ default: m.SerialMovementHistoryPage || m.default })));
const StockReservationsPage = lazy(() => import("../pages/StockReservationsPage.jsx").then(m => ({ default: m.StockReservationsPage })));
const StockReturnsPage = lazy(() => import("../pages/StockReturnsPage.jsx").then(m => ({ default: m.StockReturnsPage })));
const ReorderRulesPage = lazy(() => import("../pages/ReorderRulesPage.jsx").then(m => ({ default: m.ReorderRulesPage || m.default })));
const MinMaxStockPage = lazy(() => import("../pages/MinMaxStockPage.jsx").then(m => ({ default: m.MinMaxStockPage || m.default })));
const ReplenishmentPlanningPage = lazy(() => import("../pages/ReplenishmentPlanningPage.jsx").then(m => ({ default: m.ReplenishmentPlanningPage || m.default })));
const PurchaseSuggestionsPage = lazy(() => import("../pages/PurchaseSuggestionsPage.jsx").then(m => ({ default: m.PurchaseSuggestionsPage || m.default })));
const StockForecastPage = lazy(() => import("../pages/StockForecastPage.jsx").then(m => ({ default: m.StockForecastPage || m.default })));
const PhysicalStockCountPage = lazy(() => import("../pages/PhysicalStockCountPage.jsx").then(m => ({ default: m.PhysicalStockCountPage || m.default })));
const CycleCountPage = lazy(() => import("../pages/CycleCountPage.jsx").then(m => ({ default: m.CycleCountPage || m.default })));
const FullStockCountPage = lazy(() => import("../pages/FullStockCountPage.jsx").then(m => ({ default: m.FullStockCountPage || m.default })));
const StockVariancePage = lazy(() => import("../pages/StockVariancePage.jsx").then(m => ({ default: m.StockVariancePage || m.default })));
const AuditHistoryPage = lazy(() => import("../pages/AuditHistoryPage.jsx").then(m => ({ default: m.AuditHistoryPage || m.default })));
const ReplenishmentPage = lazy(() => import("../pages/ReplenishmentPage.jsx").then(m => ({ default: m.ReplenishmentPage })));
const ReportsPage = lazy(() => import("../pages/ReportsPage.jsx").then(m => ({ default: m.ReportsPage })));
const StockSummaryReportPage = lazy(() => import("../pages/StockSummaryReportPage.jsx").then(m => ({ default: m.StockSummaryReportPage || m.default })));
const StockMovementReportPage = lazy(() => import("../pages/StockMovementReportPage.jsx").then(m => ({ default: m.StockMovementReportPage || m.default })));
const StockLedgerReportPage = lazy(() => import("../pages/StockLedgerReportPage.jsx").then(m => ({ default: m.StockLedgerReportPage || m.default })));
const StockValuationReportPage = lazy(() => import("../pages/StockValuationReportPage.jsx").then(m => ({ default: m.StockValuationReportPage || m.default })));
const LowStockReportPage = lazy(() => import("../pages/LowStockReportPage.jsx").then(m => ({ default: m.LowStockReportPage || m.default })));
const StockAgeingReportPage = lazy(() => import("../pages/StockAgeingReportPage.jsx").then(m => ({ default: m.StockAgeingReportPage || m.default })));
const ExpiryReportPage = lazy(() => import("../pages/ExpiryReportPage.jsx").then(m => ({ default: m.ExpiryReportPage || m.default })));
const WarehouseReportPage = lazy(() => import("../pages/WarehouseReportPage.jsx").then(m => ({ default: m.WarehouseReportPage || m.default })));
const GeneralSettingsPage = lazy(() => import("../pages/GeneralSettingsPage.jsx").then(m => ({ default: m.GeneralSettingsPage || m.default })));
const StockSettingsPage = lazy(() => import("../pages/StockSettingsPage.jsx").then(m => ({ default: m.StockSettingsPage || m.default })));
const ProductTrackingSettingsPage = lazy(() => import("../pages/ProductTrackingSettingsPage.jsx").then(m => ({ default: m.ProductTrackingSettingsPage || m.default })));
const ValuationSettingsPage = lazy(() => import("../pages/ValuationSettingsPage.jsx").then(m => ({ default: m.ValuationSettingsPage || m.default })));
const DocumentNumberingPage = lazy(() => import("../pages/DocumentNumberingPage.jsx").then(m => ({ default: m.DocumentNumberingPage || m.default })));
const ApprovalSettingsPage = lazy(() => import("../pages/ApprovalSettingsPage.jsx").then(m => ({ default: m.ApprovalSettingsPage || m.default })));
const IntegrationDashboardPage = lazy(() => import("../pages/integrations/IntegrationDashboardPage.jsx").then(m => ({ default: m.IntegrationDashboardPage || m.default })));
const IncomingEventsPage = lazy(() => import("../pages/integrations/IncomingEventsPage.jsx").then(m => ({ default: m.IncomingEventsPage || m.default })));
const OutgoingEventsPage = lazy(() => import("../pages/integrations/OutgoingEventsPage.jsx").then(m => ({ default: m.OutgoingEventsPage || m.default })));
const FailedEventsPage = lazy(() => import("../pages/integrations/FailedEventsPage.jsx").then(m => ({ default: m.FailedEventsPage || m.default })));
const EventHistoryPage = lazy(() => import("../pages/integrations/EventHistoryPage.jsx").then(m => ({ default: m.EventHistoryPage || m.default })));
const IntegrationSettingsPage = lazy(() => import("../pages/integrations/IntegrationSettingsPage.jsx").then(m => ({ default: m.IntegrationSettingsPage || m.default })));

export default function App() {
  return (
    <ThemeProvider>
      <WorkspaceProvider>
        <BrowserRouter>
          <AppShell>
            <ErrorBoundary>
              <Suspense
                fallback={
                  <div className="flex h-96 items-center justify-center">
                    <LoadingState message="Loading module view..." />
                  </div>
                }
              >
              <Routes>
                <Route path="/" element={<Navigate to="/inventory" replace />} />
                <Route path="/inventory" element={<DashboardPage />} />
                
                {/* A. Product Overview */}
                <Route path="/inventory/products/overview" element={<ProductOverviewPage />} />

                {/* B. Product Management */}
                <Route path="/inventory/products" element={<ProductsPage />} />
                <Route path="/inventory/products/variants" element={<ProductVariantsPage />} />
                <Route path="/inventory/variants" element={<ProductVariantsPage />} />

                {/* C. Product Classification */}
                <Route path="/inventory/categories" element={<CategoriesPage />} />
                <Route path="/inventory/brands" element={<BrandsPage />} />
                <Route path="/inventory/units" element={<UnitsPage />} />
                <Route path="/inventory/attributes" element={<ProductAttributesPage />} />

                {/* D. Product Identification */}
                <Route path="/inventory/skus" element={<SkuManagementPage />} />
                <Route path="/inventory/barcodes" element={<BarcodesPage />} />

                {/* E. Product Media */}
                <Route path="/inventory/products/media" element={<ProductMediaPage />} />

                {/* F. Data Management */}
                <Route path="/inventory/products/import" element={<ProductImportPage />} />
                <Route path="/inventory/products/export" element={<ProductExportPage />} />
                <Route path="/inventory/products/import-history" element={<ProductImportHistoryPage />} />
                
                {/* A. Warehouse Overview */}
                <Route path="/inventory/warehouses/overview" element={<WarehouseOverviewPage />} />

                {/* B. Warehouse Management */}
                <Route path="/inventory/warehouses" element={<WarehousesPage />} />
                <Route path="/inventory/warehouses/mapping" element={<WarehouseMappingPage />} />

                {/* C. Storage Structure */}
                <Route path="/inventory/locations" element={<LocationsPage />} />
                <Route path="/inventory/zones" element={<WarehouseZonesPage />} />
                <Route path="/inventory/racks" element={<WarehouseRacksPage />} />
                <Route path="/inventory/bins" element={<WarehouseBinsPage />} />
                <Route path="/inventory/racks-bins" element={<WarehouseRacksPage />} />

                {/* D. Capacity Management */}
                <Route path="/inventory/warehouses/capacity" element={<WarehouseCapacityPage />} />
                <Route path="/inventory/locations/utilization" element={<LocationUtilizationPage />} />

                {/* E. Warehouse Configuration */}
                <Route path="/inventory/warehouses/configuration" element={<WarehouseConfigPage />} />

                {/* Goods Receipt & Inspection */}
                <Route path="/inventory/goods-receipt" element={<Navigate to="/inventory/goods-receipt/register" replace />} />
                <Route path="/inventory/goods-receipt/register" element={<ReceiptRegisterPage key="register" view="register" />} />
                <Route path="/inventory/goods-receipt/create" element={<ReceiptFormPage />} />
                <Route path="/inventory/goods-receipt/receipts/:id" element={<ReceiptDetailPage />} />
                <Route path="/inventory/goods-receipt/receipts/:id/edit" element={<ReceiptFormPage />} />
                <Route path="/inventory/goods-receipt/inspection" element={<ReceiptInspectionPage />} />
                <Route path="/inventory/goods-receipt/quality" element={<QualityInspectionPage />} />
                <Route path="/inventory/goods-receipt/accepted" element={<AcceptedGoodsPage />} />
                <Route path="/inventory/goods-receipt/rejected" element={<RejectedGoodsPage />} />
                <Route path="/inventory/goods-receipt/partial" element={<PartialAcceptancePage />} />
                <Route path="/inventory/goods-receipt/putaway" element={<PutawayManagementPage />} />
                <Route path="/inventory/goods-receipt/discrepancies" element={<ReceiptDiscrepancyPage />} />
                <Route path="/inventory/goods-receipt/history" element={<ReceiptRegisterPage key="history" view="history" />} />

                {/* Stock Operations — Complete 12 Submodules */}
                <Route path="/inventory/operations/stock-in" element={<StockInPage />} />
                <Route path="/inventory/operations/goods-receipt" element={<Navigate to="/inventory/goods-receipt/register" replace />} />
                <Route path="/inventory/operations/stock-issue" element={<StockIssuePage />} />
                <Route path="/inventory/operations/stock-transfer" element={<StockTransferPage mode="ALL" />} />
                <Route path="/inventory/operations/transfers" element={<StockTransferPage mode="ALL" />} />
                <Route path="/inventory/operations/inter-warehouse-transfer" element={<StockTransferPage mode="INTER_WAREHOUSE" />} />
                <Route path="/inventory/operations/inter-location-transfer" element={<StockTransferPage mode="INTER_LOCATION" />} />
                <Route path="/inventory/operations/stock-adjustment" element={<StockAdjustmentPage />} />
                <Route path="/inventory/operations/adjustments" element={<StockAdjustmentPage />} />
                <Route path="/inventory/operations/stock-return" element={<StockReturnsPage />} />
                <Route path="/inventory/operations/returns" element={<StockReturnsPage />} />
                <Route path="/inventory/operations/opening-stock" element={<OpeningStockPage />} />
                <Route path="/inventory/operations/stock-reservation" element={<StockReservationsPage />} />
                <Route path="/inventory/operations/reservations" element={<StockReservationsPage />} />
                <Route path="/inventory/operations/stock-release" element={<StockReleasePage />} />
                <Route path="/inventory/operations/stock-reclassification" element={<StockReclassificationPage />} />
                <Route path="/inventory/operations/stock-out" element={<StockOutPage />} />
                <Route path="/inventory/operations/movements" element={<StockMovementsPage initialType="ALL" />} />
                <Route path="/inventory/operations/reconciliation" element={<ReconciliationPage />} />

                {/* Stock Control — Exact 8 Modules */}
                <Route path="/inventory/control/overview" element={<StockOverviewPage />} />
                <Route path="/inventory/control/balances" element={<StockOverviewPage />} />
                <Route path="/inventory/control/ledger" element={<StockLedgerPage />} />
                <Route path="/inventory/control/stock-in-history" element={<StockInHistoryPage />} />
                <Route path="/inventory/control/stock-out-history" element={<StockOutHistoryPage />} />
                <Route path="/inventory/control/reservations" element={<StockReservationsPage />} />
                <Route path="/inventory/control/reconciliation" element={<ReconciliationPage />} />
                <Route path="/inventory/control/damaged" element={<DamagedStockPage />} />
                <Route path="/inventory/control/transit" element={<StockInTransitPage />} />
                <Route path="/inventory/control/batches" element={<BatchManagementPage />} />
                <Route path="/inventory/control/serials" element={<SerialManagementPage />} />
                <Route path="/inventory/control/expiry" element={<ExpiryManagementPage />} />

                {/* Batch & Serial Tracking — Exact 7 Modules */}
                <Route path="/inventory/tracking/batches" element={<BatchManagementPage />} />
                <Route path="/inventory/tracking/batch-movements" element={<BatchMovementHistoryPage />} />
                <Route path="/inventory/tracking/batch-quarantine" element={<BatchQuarantinePage />} />
                <Route path="/inventory/tracking/batch-release" element={<BatchReleasePage />} />
                <Route path="/inventory/tracking/expiry" element={<ExpiryManagementPage />} />
                <Route path="/inventory/tracking/serials" element={<SerialManagementPage />} />
                <Route path="/inventory/tracking/serial-movements" element={<SerialMovementHistoryPage />} />

                {/* Planning & Replenishment — Exact 5 Modules */}
                <Route path="/inventory/planning/reorder-rules" element={<ReorderRulesPage />} />
                <Route path="/inventory/planning/min-max-levels" element={<MinMaxStockPage />} />
                <Route path="/inventory/planning/replenishment" element={<ReplenishmentPlanningPage />} />
                <Route path="/inventory/planning/purchase-suggestions" element={<PurchaseSuggestionsPage />} />
                <Route path="/inventory/planning/stock-forecast" element={<StockForecastPage />} />
                <Route path="/inventory/planning/low-stock" element={<ReplenishmentPlanningPage />} />

                {/* Physical Inventory & Audit — Exact 5 Modules */}
                <Route path="/inventory/audit/stock-count" element={<PhysicalStockCountPage />} />
                <Route path="/inventory/audit/cycle-count" element={<CycleCountPage />} />
                <Route path="/inventory/audit/full-count" element={<FullStockCountPage />} />
                <Route path="/inventory/audit/variance" element={<StockVariancePage />} />
                <Route path="/inventory/audit/history" element={<AuditHistoryPage />} />
                {/* Reports & Analytics — Exact 8 Reports */}
                <Route path="/inventory/reports/stock-summary" element={<StockSummaryReportPage />} />
                <Route path="/inventory/reports/stock-movement" element={<StockMovementReportPage />} />
                <Route path="/inventory/reports/stock-ledger" element={<StockLedgerReportPage />} />
                <Route path="/inventory/reports/valuation" element={<StockValuationReportPage />} />
                <Route path="/inventory/reports/low-stock" element={<LowStockReportPage />} />
                <Route path="/inventory/reports/ageing" element={<StockAgeingReportPage />} />
                <Route path="/inventory/reports/expiry" element={<ExpiryReportPage />} />
                <Route path="/inventory/reports/warehouse" element={<WarehouseReportPage />} />
                <Route path="/inventory/analytics/reports" element={<Navigate to="/inventory/reports/stock-summary" replace />} />
                <Route path="/inventory/analytics/valuation" element={<Navigate to="/inventory/reports/valuation" replace />} />
                <Route path="/inventory/analytics/movement" element={<Navigate to="/inventory/reports/stock-movement" replace />} />

                {/* Inventory Configuration — Exact 6 Settings Modules */}
                <Route path="/inventory/configuration/general" element={<GeneralSettingsPage />} />
                <Route path="/inventory/configuration/stock" element={<StockSettingsPage />} />
                <Route path="/inventory/configuration/tracking" element={<ProductTrackingSettingsPage />} />
                <Route path="/inventory/configuration/valuation" element={<ValuationSettingsPage />} />
                <Route path="/inventory/configuration/numbering" element={<DocumentNumberingPage />} />
                <Route path="/inventory/configuration/approvals" element={<ApprovalSettingsPage />} />
                <Route path="/inventory/configuration/goods-receipt" element={<GoodsReceiptSettingsPage />} />
                <Route path="/inventory/configuration" element={<Navigate to="/inventory/configuration/general" replace />} />
                <Route path="/inventory/settings" element={<Navigate to="/inventory/configuration/general" replace />} />

                {/* Integration & Events — Exact 6 Modules */}
                <Route path="/inventory/integrations/dashboard" element={<IntegrationDashboardPage />} />
                <Route path="/inventory/integrations/incoming" element={<IncomingEventsPage />} />
                <Route path="/inventory/integrations/outgoing" element={<OutgoingEventsPage />} />
                <Route path="/inventory/integrations/failed" element={<FailedEventsPage />} />
                <Route path="/inventory/integrations/history" element={<EventHistoryPage />} />
                <Route path="/inventory/integrations/settings" element={<IntegrationSettingsPage />} />
                <Route path="/inventory/integrations" element={<Navigate to="/inventory/integrations/dashboard" replace />} />

                {/* Direct & Convenience Route Aliases */}
                <Route path="/integrations/dashboard" element={<Navigate to="/inventory/integrations/dashboard" replace />} />
                <Route path="/integrations/incoming" element={<Navigate to="/inventory/integrations/incoming" replace />} />
                <Route path="/integrations/outgoing" element={<Navigate to="/inventory/integrations/outgoing" replace />} />
                <Route path="/integrations/failed" element={<Navigate to="/inventory/integrations/failed" replace />} />
                <Route path="/integrations/history" element={<Navigate to="/inventory/integrations/history" replace />} />
                <Route path="/integrations/settings" element={<Navigate to="/inventory/integrations/settings" replace />} />
                <Route path="/integrations" element={<Navigate to="/inventory/integrations/dashboard" replace />} />

                {/* Direct & Convenience Route Aliases */}
                <Route path="/products" element={<Navigate to="/inventory/products" replace />} />
                <Route path="/categories" element={<Navigate to="/inventory/categories" replace />} />
                <Route path="/brands" element={<Navigate to="/inventory/brands" replace />} />
                <Route path="/variants" element={<Navigate to="/inventory/products" replace />} />
                <Route path="/units" element={<Navigate to="/inventory/units" replace />} />
                <Route path="/barcodes" element={<Navigate to="/inventory/barcodes" replace />} />
                <Route path="/goods-receipt" element={<Navigate to="/inventory/goods-receipt/register" replace />} />
                <Route path="/stock-in" element={<Navigate to="/inventory/goods-receipt/register" replace />} />
                <Route path="/stock-issue" element={<Navigate to="/inventory/operations/stock-out" replace />} />
                <Route path="/stock-out" element={<Navigate to="/inventory/operations/stock-out" replace />} />
                <Route path="/stock-transfer" element={<Navigate to="/inventory/operations/transfers" replace />} />
                <Route path="/transfers" element={<Navigate to="/inventory/operations/transfers" replace />} />
                <Route path="/stock-adjustment" element={<Navigate to="/inventory/operations/adjustments" replace />} />
                <Route path="/adjustments" element={<Navigate to="/inventory/operations/adjustments" replace />} />
                <Route path="/warehouses" element={<Navigate to="/inventory/warehouses" replace />} />
                <Route path="/locations" element={<Navigate to="/inventory/locations" replace />} />
                <Route path="/racks-bins" element={<Navigate to="/inventory/racks-bins" replace />} />
                <Route path="/racks" element={<Navigate to="/inventory/racks-bins" replace />} />
                <Route path="/bins" element={<Navigate to="/inventory/racks-bins" replace />} />
                <Route path="/overview" element={<Navigate to="/inventory/control/overview" replace />} />
                <Route path="/ledger" element={<Navigate to="/inventory/control/ledger" replace />} />
                <Route path="/balances" element={<Navigate to="/inventory/control/balances" replace />} />
                <Route path="/stock-in-history" element={<Navigate to="/inventory/control/stock-in-history" replace />} />
                <Route path="/stock-out-history" element={<Navigate to="/inventory/control/stock-out-history" replace />} />
                <Route path="/reservations" element={<Navigate to="/inventory/control/reservations" replace />} />
                <Route path="/reconciliation" element={<Navigate to="/inventory/control/reconciliation" replace />} />
                <Route path="/damaged" element={<Navigate to="/inventory/control/damaged" replace />} />
                <Route path="/transit" element={<Navigate to="/inventory/control/transit" replace />} />
                <Route path="/batches" element={<Navigate to="/inventory/tracking/batches" replace />} />
                <Route path="/control/batches" element={<Navigate to="/inventory/tracking/batches" replace />} />
                <Route path="/serials" element={<Navigate to="/inventory/tracking/serials" replace />} />
                <Route path="/expiry" element={<Navigate to="/inventory/tracking/expiry" replace />} />
                <Route path="/batch-quarantine" element={<Navigate to="/inventory/tracking/batch-quarantine" replace />} />
                <Route path="/batch-release" element={<Navigate to="/inventory/tracking/batch-release" replace />} />
                <Route path="/replenishment" element={<Navigate to="/inventory/planning/replenishment" replace />} />
                <Route path="/reorder-rules" element={<Navigate to="/inventory/planning/reorder-rules" replace />} />
                <Route path="/min-max-levels" element={<Navigate to="/inventory/planning/min-max-levels" replace />} />
                <Route path="/purchase-suggestions" element={<Navigate to="/inventory/planning/purchase-suggestions" replace />} />
                <Route path="/stock-forecast" element={<Navigate to="/inventory/planning/stock-forecast" replace />} />
                <Route path="/stock-count" element={<Navigate to="/inventory/audit/stock-count" replace />} />
                <Route path="/cycle-count" element={<Navigate to="/inventory/audit/cycle-count" replace />} />
                <Route path="/full-count" element={<Navigate to="/inventory/audit/full-count" replace />} />
                <Route path="/variance" element={<Navigate to="/inventory/audit/variance" replace />} />
                <Route path="/audit-history" element={<Navigate to="/inventory/audit/history" replace />} />
                <Route path="/valuation" element={<Navigate to="/inventory/analytics/valuation" replace />} />
                <Route path="/reports" element={<Navigate to="/inventory/reports/stock-summary" replace />} />
                <Route path="/reports/stock-summary" element={<Navigate to="/inventory/reports/stock-summary" replace />} />
                <Route path="/reports/stock-movement" element={<Navigate to="/inventory/reports/stock-movement" replace />} />
                <Route path="/reports/stock-ledger" element={<Navigate to="/inventory/reports/stock-ledger" replace />} />
                <Route path="/reports/valuation" element={<Navigate to="/inventory/reports/valuation" replace />} />
                <Route path="/reports/low-stock" element={<Navigate to="/inventory/reports/low-stock" replace />} />
                <Route path="/reports/ageing" element={<Navigate to="/inventory/reports/ageing" replace />} />
                <Route path="/reports/expiry" element={<Navigate to="/inventory/reports/expiry" replace />} />
                <Route path="/reports/warehouse" element={<Navigate to="/inventory/reports/warehouse" replace />} />
                <Route path="/settings" element={<Navigate to="/inventory/configuration/general" replace />} />
                <Route path="/configuration" element={<Navigate to="/inventory/configuration/general" replace />} />
                <Route path="/configuration/general" element={<Navigate to="/inventory/configuration/general" replace />} />
                <Route path="/configuration/stock" element={<Navigate to="/inventory/configuration/stock" replace />} />
                <Route path="/configuration/tracking" element={<Navigate to="/inventory/configuration/tracking" replace />} />
                <Route path="/configuration/valuation" element={<Navigate to="/inventory/configuration/valuation" replace />} />
                <Route path="/configuration/numbering" element={<Navigate to="/inventory/configuration/numbering" replace />} />
                <Route path="/configuration/approvals" element={<Navigate to="/inventory/configuration/approvals" replace />} />
                <Route path="/returns" element={<Navigate to="/inventory/operations/returns" replace />} />
                <Route path="/inventory/returns" element={<Navigate to="/inventory/operations/returns" replace />} />
                <Route path="/inter-warehouse-transfer" element={<Navigate to="/inventory/operations/inter-warehouse-transfer" replace />} />
                <Route path="/inter-location-transfer" element={<Navigate to="/inventory/operations/inter-location-transfer" replace />} />
                <Route path="/opening-stock" element={<Navigate to="/inventory/operations/opening-stock" replace />} />
                <Route path="/stock-reservation" element={<Navigate to="/inventory/operations/stock-reservation" replace />} />
                <Route path="/stock-release" element={<Navigate to="/inventory/operations/stock-release" replace />} />
                <Route path="/stock-reclassification" element={<Navigate to="/inventory/operations/stock-reclassification" replace />} />
                <Route path="/stock-return" element={<Navigate to="/inventory/operations/stock-return" replace />} />

                <Route path="*" element={<Navigate to="/inventory" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AppShell>
        </BrowserRouter>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
