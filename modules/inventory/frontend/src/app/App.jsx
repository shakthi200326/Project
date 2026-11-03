import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@shared/shell-app/ThemeProvider.jsx";
import { WorkspaceProvider } from "@shared/shell-app/ContextSelector.jsx";
import { AppShell } from "@shared/shell-app/AppShell.jsx";
import LoadingState from "@ui/components/LoadingState.jsx";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";

// Lazy-loaded page components for optimal production chunking and lightning-fast load times
const DashboardPage = lazy(() => import("../pages/DashboardPage.jsx").then(m => ({ default: m.DashboardPage })));
const ProductsPage = lazy(() => import("../pages/ProductsPage.jsx").then(m => ({ default: m.ProductsPage })));
const CategoriesPage = lazy(() => import("../pages/CategoriesPage.jsx").then(m => ({ default: m.CategoriesPage })));
const BrandsPage = lazy(() => import("../pages/BrandsPage.jsx").then(m => ({ default: m.BrandsPage })));
const UnitsPage = lazy(() => import("../pages/UnitsPage.jsx").then(m => ({ default: m.UnitsPage })));
const BarcodesPage = lazy(() => import("../pages/BarcodesPage.jsx").then(m => ({ default: m.BarcodesPage })));
const WarehousesPage = lazy(() => import("../pages/WarehousesPage.jsx").then(m => ({ default: m.WarehousesPage })));
const LocationsPage = lazy(() => import("../pages/LocationsPage.jsx").then(m => ({ default: m.LocationsPage })));
const RackBinPage = lazy(() => import("../pages/RackBinPage.jsx").then(m => ({ default: m.RackBinPage })));
const StockMovementsPage = lazy(() => import("../pages/StockMovementsPage.jsx").then(m => ({ default: m.StockMovementsPage })));
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
const StockReservationsPage = lazy(() => import("../pages/StockReservationsPage.jsx").then(m => ({ default: m.StockReservationsPage })));
const StockReturnsPage = lazy(() => import("../pages/StockReturnsPage.jsx").then(m => ({ default: m.StockReturnsPage })));
const ReplenishmentPage = lazy(() => import("../pages/ReplenishmentPage.jsx").then(m => ({ default: m.ReplenishmentPage })));
const ReportsPage = lazy(() => import("../pages/ReportsPage.jsx").then(m => ({ default: m.ReportsPage })));

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
                
                {/* Products & Catalog */}
                <Route path="/inventory/products" element={<ProductsPage />} />
                <Route path="/inventory/categories" element={<CategoriesPage />} />
                <Route path="/inventory/brands" element={<BrandsPage />} />
                <Route path="/inventory/variants" element={<ProductsPage />} />
                <Route path="/inventory/units" element={<UnitsPage />} />
                <Route path="/inventory/barcodes" element={<BarcodesPage />} />
                
                {/* Warehouses */}
                <Route path="/inventory/warehouses" element={<WarehousesPage />} />
                <Route path="/inventory/warehouses/overview" element={<WarehousesPage />} />
                <Route path="/inventory/locations" element={<LocationsPage />} />
                <Route path="/inventory/racks-bins" element={<RackBinPage />} />
                <Route path="/inventory/racks" element={<RackBinPage />} />
                <Route path="/inventory/bins" element={<RackBinPage />} />

                {/* Stock Operations */}
                <Route path="/inventory/operations/stock-in" element={<StockMovementsPage initialType="RECEIPT" />} />
                <Route path="/inventory/operations/stock-out" element={<StockMovementsPage initialType="ISSUE" />} />
                <Route path="/inventory/operations/transfers" element={<StockMovementsPage initialType="TRANSFER" />} />
                <Route path="/inventory/operations/adjustments" element={<StockMovementsPage initialType="ADJUSTMENT" />} />
                <Route path="/inventory/operations/returns" element={<StockReturnsPage />} />
                <Route path="/inventory/operations/reservations" element={<StockReservationsPage />} />
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
                <Route path="/inventory/control/batches" element={<BatchTrackingPage />} />
                <Route path="/inventory/control/serials" element={<SerialTrackingPage />} />
                <Route path="/inventory/control/expiry" element={<BatchTrackingPage />} />

                {/* Planning & Analytics */}
                <Route path="/inventory/planning/replenishment" element={<ReplenishmentPage />} />
                <Route path="/inventory/planning/low-stock" element={<ReplenishmentPage />} />
                <Route path="/inventory/analytics/reports" element={<ReportsPage />} />
                <Route path="/inventory/analytics/valuation" element={<ValuationPage />} />
                <Route path="/inventory/analytics/movement" element={<DashboardPage />} />

                {/* Settings */}
                <Route path="/inventory/settings" element={<SettingsPage />} />

                {/* Direct & Convenience Route Aliases */}
                <Route path="/products" element={<Navigate to="/inventory/products" replace />} />
                <Route path="/categories" element={<Navigate to="/inventory/categories" replace />} />
                <Route path="/brands" element={<Navigate to="/inventory/brands" replace />} />
                <Route path="/variants" element={<Navigate to="/inventory/products" replace />} />
                <Route path="/units" element={<Navigate to="/inventory/units" replace />} />
                <Route path="/barcodes" element={<Navigate to="/inventory/barcodes" replace />} />
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
                <Route path="/batches" element={<Navigate to="/inventory/control/batches" replace />} />
                <Route path="/control/batches" element={<Navigate to="/inventory/control/batches" replace />} />
                <Route path="/serials" element={<Navigate to="/inventory/control/serials" replace />} />
                <Route path="/replenishment" element={<Navigate to="/inventory/planning/replenishment" replace />} />
                <Route path="/valuation" element={<Navigate to="/inventory/analytics/valuation" replace />} />
                <Route path="/reports" element={<Navigate to="/inventory/analytics/reports" replace />} />
                <Route path="/settings" element={<Navigate to="/inventory/settings" replace />} />
                <Route path="/returns" element={<Navigate to="/inventory/operations/returns" replace />} />
                <Route path="/inventory/returns" element={<Navigate to="/inventory/operations/returns" replace />} />

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
